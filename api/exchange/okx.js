const Api = require('../api').Api
const {createHmac} = require('crypto');
const {v4: uuidv4} = require('uuid');

/**
 * @class Okx
 */
class Okx extends Api {
    #baseUrl
    #apiKey
    #apiSecret
    #passphrase

    constructor(apiKey, apiSecret, passphrase) {
        super();
        this.#baseUrl = 'https://www.okx.com'
        this.#apiKey = apiKey
        this.#apiSecret = apiSecret
        this.#passphrase = passphrase
        this.symbolInfo = {}
    }

    async #sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }

    async #signAndRequest(input, requestInit) {
        const timestamp = new Date().toISOString();
        const url = new URL(input);
        let message = `${timestamp}${requestInit?.method ?? 'GET'}${url.pathname}${url.search}`;
        if (requestInit?.body) {
            message += requestInit.body;
        }
        const signature = createHmac('sha256', this.#apiSecret).update(message).digest('base64')

        return fetch(input, {
            headers: {
                'Content-Type':
                    requestInit?.method !== 'GET' && requestInit?.method !== 'DELETE'
                        ? 'application/json'
                        : 'application/x-www-form-urlencoded',
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-KEY': this.#apiKey,
                'OK-ACCESS-SIGN': `${signature}`,
                'OK-ACCESS-PASSPHRASE': `${this.#passphrase}`,
                ...(requestInit?.headers ?? {})
            },
            ...(requestInit ?? {})
        });
    }

    async initSymbolInfo() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/public/instruments?instType=SWAP`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        let info = data['data'];
        for (const item of info) {
            this.symbolInfo[item['instId']] = {
                'amountTick': item['minSz'],
                'priceTick': item['tickSz'],
                'minValue': item['lotSz'],
                'contractValue': item['ctVal']
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
            `${this.#baseUrl}/api/v5/account/balance`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const details = data['data'][0]['details'];
        for (let i = 0; i < details.length; i++) {
            const cur_detail = details[i]
            const cur_symbol = cur_detail["ccy"]
            if (cur_symbol === symbol) {
                return parseFloat(cur_detail["eq"])
            }
        }
        return 0;
    }

    async getTotalEquity() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/account/balance`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        return parseFloat(data['data'][0]['totalEq']);
    }

    async getPrice(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/market/trades?instId=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        return data['data'][0]['px'];
    }

    async getPosition(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/account/positions?instType=SWAP&instId=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const positions = data['data'];
        let curPosition = {
            'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
        }
        for (const item of positions) {
            if (item["pos"] === "0") {
                continue
            }
            curPosition["amount"] += parseFloat(item['pos'])
            curPosition["averageEntryPrice"] = parseFloat(item['avgPx'])
            curPosition["unrealisedPnl"] = parseFloat(item['upl'])
        }
        return curPosition;
    }

    async getAllPositions() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/account/positions?instType=SWAP`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const positions = data['data'];
        let curPositions = {}
        for (const item of positions) {
            curPositions[item['instId']] = {
                'amount': parseFloat(item['pos']),
                'averageEntryPrice': parseFloat(item['avgPx']),
                'unsettled_pnl': parseFloat(item['upl'])
            }
        }
        return curPositions;
    }

    async postOrder(symbol, orderType, side, amount, price, reduceOnly = false, orderTag = '') {
        let params = {
            instId: symbol,
            tdMode: "cross",
            ordType: orderType,
            sz: amount,
            side: side,
            reduceOnly: reduceOnly,
        }
        if (orderType === 'limit') {
            params['px'] = price;
        }
        if (orderTag === '') {
            params['clOrdId'] = ('8d53cdda9f79BCDE' + uuidv4().replaceAll("-", "")).substring(0, 32);
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/trade/order`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        return data['data'][0]['ordId'];
    }

    async cancelOrder(symbol, orderId) {
        const params = {
            instId: symbol,
            ordId: orderId,
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/trade/cancel-order`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        return true;
    }

    async cancelAllOrders(symbol) {
        const data = await this.getPendingOrders(symbol)
        for (const item of data) {
            const orderId = item['orderId'];
            await this.#sleep(1 / 30);
            await this.cancelOrder(symbol, orderId);
        }
        return true;
    }

    async getPendingOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/trade/orders-pending?instType=SWAP&instId=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const positions = data['data'];
        let pendingOrders = []
        for (const item of positions) {
            let amount = parseFloat(item['sz'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['ordId'],
                'price': parseFloat(item['px']),
                'amount': amount,
                'createdTime': item['cTime']
            })
        }
        return pendingOrders
    }

    async getAllPendingOrders() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/trade/orders-pending?instType=SWAP`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const positions = data['data'];
        let pendingOrders = []
        for (const item of positions) {
            let amount = parseFloat(item['sz'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'symbol': item['instId'],
                'orderId': item['ordId'],
                'price': parseFloat(item['px']),
                'amount': amount,
                'createdTime': item['cTime']
            })
        }
        return pendingOrders
    }

    async getTradeHistory(symbol = "", limit = 100) {
        let url = `${this.#baseUrl}/api/v5/trade/orders-history?instType=SWAP&state=filled&limit=${limit}`
        if (symbol.length > 0) {
            url += `&instId=${symbol}`
        }
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const rows = data['data']
        let historyList = []
        for (const item of rows) {
            let amount = parseFloat(item['sz'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            historyList.push(
                {
                    'id': item['ordId'],
                    'price': item['avgPx'],
                    'amount': amount,
                    'executed_time': item['cTime'],
                }
            )
        }
        return historyList
    }

    async getPositionHistory(symbol = "", limit = 100) {
        let url = `${this.#baseUrl}/api/v5/account/positions-history?instType=SWAP&state=filled&limit=${limit}&type=2`
        if (symbol.length > 0) {
            url += `&instId=${symbol}`
        }
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const rows = data['data']
        let historyList = []
        for (const item of rows) {
            let amount = parseFloat(item['closeTotalPos'])
            if (item['direction'] === 'short' && amount > 0) {
                amount *= -1
            }
            let historyItem =
                {
                    'id': item['posId'],
                    'symbol': item['instId'],
                    'price': item['openAvgPx'],
                    'pnl': item['pnl'],
                    'amount': amount,
                    'executed_time': item['cTime'],
                }

            if (symbol === "") {
                historyItem['symbol'] = item['instId']
            }
            historyList.push(historyItem)
        }
        return historyList
    }


    async getOrderBook(symbol, limit = 20) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/market/books?instId=${symbol}&sz=${limit}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const asks = data['data'][0]['asks'];
        const bids = data['data'][0]['bids'];

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
            timeframe = "1Dutc"
        } else if (timeframe === "6h" || timeframe === "12h") {
            timeframe = timeframe.replaceAll("h", "Hutc")
        } else {
            timeframe = timeframe.replaceAll("h", "H")
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v5/market/history-candles?instId=${symbol}&bar=${timeframe}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        const klines = data['data'];
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
            `${this.#baseUrl}/api/v5/account/set-leverage`,
            {
                method: 'POST',
                body: JSON.stringify({
                    instId: symbol,
                    lever: leverage,
                    mgnMode: "cross",
                })
            }
        )
        const data = await result.json();
        if (data['code'] !== '0') {
            throw new Error(data['msg']);
        }
        return true;
    }
}


module.exports = {
    Okx
};
