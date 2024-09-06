const Api = require('../api').Api
const {createHmac} = require('crypto');
const {v4: uuidv4} = require('uuid');

/**
 * @class Bybit
 */
class Bybit extends Api {
    #baseUrl
    #apiKey
    #apiSecret
    #recvWindow

    constructor(apiKey, apiSecret) {
        super();
        this.#baseUrl = 'https://api.bybit.com'
        this.#apiKey = apiKey
        this.#apiSecret = apiSecret
        this.#recvWindow = "5000"
        this.symbolInfo = {}
    }

    async #sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }

    async #signAndRequest(input, requestInit) {
        const timestamp = Date.now();
        const url = new URL(input);
        const params = new URLSearchParams(url.search);
        let message = `${timestamp}${this.#apiKey}${this.#recvWindow}${params.toString()}`;
        if (requestInit?.body) {
            message += requestInit.body;
        }
        const signature = createHmac('sha256', this.#apiSecret).update(message).digest('hex')

        return fetch(input, {
            headers: {
                'Content-Type':
                    requestInit?.method !== 'GET' && requestInit?.method !== 'DELETE'
                        ? 'application/json'
                        : 'application/x-www-form-urlencoded',
                'X-BAPI-SIGN': signature,
                'X-BAPI-API-KEY': this.#apiKey,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': this.#recvWindow,
                'X-Referer': `Rf000580`,
                ...(requestInit?.headers ?? {})
            },
            ...(requestInit ?? {})
        });
    }

    async initSymbolInfo() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/market/instruments-info?category=linear`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        let info = data['result']['list'];
        for (const item of info) {
            this.symbolInfo[item['symbol']] = {
                'amountTick': parseFloat(item['lotSizeFilter']['qtyStep']),
                'priceTick': parseFloat(item['priceFilter']['tickSize']),
                'minValue': parseFloat(item['lotSizeFilter']['minOrderQty']),
                'maxOrderSize': parseFloat(item['lotSizeFilter']['maxMktOrderQty']),
                'contractValue': 1
            }
        }
        return this.symbolInfo;
    }

    async getSymbolList() {
        const symbolInfo = await this.initSymbolInfo();
        return Object.keys(symbolInfo);
    }

    async getSymbolBalance(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/account/wallet-balance?accountType=UNIFIED&coin=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        return parseFloat(data['result']['list'][0]['coin'][0]['walletBalance'])
    }

    async getTotalEquity() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/account/wallet-balance?accountType=UNIFIED`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        return parseFloat(data['result']['list'][0]['totalEquity'])
    }

    async getPrice(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/market/tickers?category=linear&symbol=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        return parseFloat(data['result']['list'][0]['lastPrice']);
    }

    async getPosition(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/position/list?category=linear&symbol=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const positions = data['result']['list'];
        let curPosition = {
            'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
        }
        for (const item of positions) {
            if (item["pos"] === "0") {
                continue
            }
            curPosition["amount"] += parseFloat(item['size'])
            curPosition["averageEntryPrice"] = parseFloat(item['avgPrice'])
            let unrealisedPnl = item['unrealisedPnl']
            if (unrealisedPnl === '') {
                unrealisedPnl = 0
            }
            curPosition["unrealisedPnl"] = parseFloat(unrealisedPnl)
        }
        return curPosition;
    }

    async getAllPositions(settleCoin = "USDT") {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/position/list?category=linear&settleCoin=${settleCoin}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const positions = data['result']['list'];
        let curPositions = {}
        for (const item of positions) {
            let curPosition = {
                'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
            }
            if (item["pos"] === "0") {
                continue
            }
            curPosition["amount"] += parseFloat(item['size'])
            curPosition["averageEntryPrice"] = parseFloat(item['avgPrice'])
            let unrealisedPnl = item['unrealisedPnl']
            if (unrealisedPnl === '') {
                unrealisedPnl = 0
            }
            curPosition["unrealisedPnl"] = parseFloat(unrealisedPnl)
            curPositions[item['symbol']] = curPosition
        }
        return curPositions;
    }

    async postOrder(symbol, orderType, side, amount, price, reduceOnly = false, orderTag = '') {
        let params = {
            category: "linear",
            symbol: symbol,
            orderType: orderType === "limit" ? "Limit" : "Market",
            side: side === "buy" ? "Buy" : "Sell",
            qty: amount.toString(),
            timeInForce: "GTC",
            reduceOnly: reduceOnly,
            closeOnTrigger: reduceOnly
        }
        if (orderType === 'limit') {
            params['price'] = price.toString();
        }
        if (orderTag === '') {
            params['orderLinkId'] = (uuidv4().replaceAll("-", "")).substring(0, 36);
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/order/create`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        return data['result']['orderId']
    }

    async cancelOrder(symbol, orderId) {
        const params = {
            category: 'linear',
            symbol: symbol,
            orderId: orderId,
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/order/cancel`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        return true;
    }

    async cancelAllOrders(symbol) {
        const params = {
            category: 'linear',
            symbol: symbol,
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/order/cancel-all`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        return true;
    }

    async getPendingOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/order/realtime?category=linear&symbol=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const positions = data['result']['list'];
        let pendingOrders = []
        for (const item of positions) {
            let amount = parseFloat(item['qty'])
            if (item['side'] === 'Sell' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['orderId'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['createdTime']
            })
        }
        return pendingOrders
    }

    async getAllPendingOrders(settleCoin = "USDT") {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/order/realtime?category=linear&settleCoin=${settleCoin}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const positions = data['result']['list'];
        let pendingOrders = []
        for (const item of positions) {
            let amount = parseFloat(item['qty'])
            if (item['side'] === 'Sell' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['orderId'],
                'symbol': item['symbol'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['createdTime']
            })
        }
        return pendingOrders
    }

    async getTradeHistory(symbol = "", limit = 100) {
        let url = `${this.#baseUrl}/v5/execution/list?category=linear&limit=${limit}`
        if (symbol.length > 0) {
            url += `&symbol=${symbol}`
        }
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const rows = data['result']["list"]
        let historyList = []
        for (const item of rows) {
            let amount = parseFloat(item['execQty'])
            if (item['side'] === 'Sell' && amount > 0) {
                amount *= -1
            }
            let historyItem = {
                'ordId': item['orderId'],
                'price': parseFloat(item['execPrice']),
                'amount': amount,
                'executed_time': item['execTime'],
            }
            if (symbol === "") {
                historyItem['symbol'] = item['symbol']
            }
            historyList.push(historyItem)
        }
        return historyList
    }

    async getPositionHistory(symbol = "", limit = 100) {
        let url = `${this.#baseUrl}/v5/position/closed-pnl?category=linear&limit=${limit}`
        if (symbol.length > 0) {
            url += `&symbol=${symbol}`
        }
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const rows = data['result']['list']
        let historyList = []
        for (const item of rows) {
            let amount = parseFloat(item['qty'])
            if (item['side'] === 'Sell' && amount > 0) {
                amount *= -1
            }
            let historyItem =
                {
                    'id': item['orderId'],
                    'price': parseFloat(item['orderPrice']),
                    'pnl': parseFloat(item['closedPnl']),
                    'amount': amount,
                    'executed_time': item['updatedTime'],
                }
            if (symbol === "") {
                historyItem['symbol'] = item['symbol']
            }
            historyList.push(historyItem)
        }
        return historyList
    }


    async getOrderBook(symbol, limit = 20) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/market/orderbook?category=linear&symbol=${symbol}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const asks = data['result']['a'];
        const bids = data['result']['b'];

        let newAsks = [];
        let newBids = [];
        for (const ask of asks) {
            newAsks.push({'price': parseFloat(ask[0]), 'qty': parseFloat(ask[1])});
        }
        for (const bid of bids) {
            newBids.push({'price': parseFloat(bid[0]), 'qty': parseFloat(bid[1])});
        }

        newAsks.sort(function (first, second) {
            return first.price - second.price;
        });
        newBids.sort(function (first, second) {
            return second.price - first.price;
        });
        return {
            'asks': newAsks.slice(0, limit),
            'bids': newBids.slice(0, limit),
        }
    }

    // getKline of okx retrieve only complete candle
    async getKline(symbol, timeframe, limit = 100) {
        if (timeframe === "1d") {
            timeframe = "D"
        } else if (timeframe === "12h") {
            timeframe = "720"
        } else if (timeframe === "6h") {
            timeframe = "360"
        } else if (timeframe === "4h") {
            timeframe = "240"
        } else if (timeframe === "2h") {
            timeframe = "120"
        } else if (timeframe === "1h") {
            timeframe = "60"
        } else {
            timeframe = timeframe.replaceAll("m", "")
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/market/kline?category=linear&symbol=${symbol}&interval=${timeframe}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['retCode'] !== 0) {
            throw new Error(data['retMsg']);
        }
        const klines = data['result']['list'];
        let newKline = [];
        for (const kline of klines) {
            newKline.push({
                "open": parseFloat(kline[1]),
                "high": parseFloat(kline[2]),
                "low": parseFloat(kline[3]),
                "close": parseFloat(kline[4]),
                "volume": parseFloat(kline[5]),
                "timestamp": parseInt(kline[0]),
            })
        }
        newKline.sort(function (first, second) {
            return second.date - first.date;
        });
        return newKline;
    }

    async setLeverage(symbol, leverage) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v5/position/set-leverage`,
            {
                method: 'POST',
                body: JSON.stringify({
                    category: "linear",
                    symbol: symbol,
                    buyLeverage: leverage.toString(),
                    sellLeverage: leverage.toString(),
                })
            }
        )
        const data = await result.json();
        // skip error if leverage not modified
        if (data['retCode'] !== 0 && data['retCode'] !== 110043) {
            throw new Error(data['retMsg']);
        }
        return true;
    }
}


module.exports = {
    Bybit
};
