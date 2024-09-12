const Api = require('../api').Api

/**
 * @class Orderly
 */
class Orderly extends Api {
    #baseUrl
    #accountId
    #apiSecret

    constructor(accountId, apiSecret) {
        super();
        this.#baseUrl = 'https://api-evm.orderly.network'
        this.#accountId = accountId
        this.#apiSecret = apiSecret.replace('ed25519:', '')
        this.symbolInfo = {}
    }

    async #signAndRequest(input, requestInit) {
        const {signAsync, getPublicKeyAsync} = await import('@noble/ed25519');
        const {binary_to_base58, base58_to_binary} = await import('base58-js')
        const timestamp = Date.now();
        const encoder = new TextEncoder();
        const url = new URL(input);
        let message = `${String(timestamp)}${requestInit?.method ?? 'GET'}${url.pathname}${url.search}`;
        if (requestInit?.body) {
            message += requestInit.body;
        }
        const orderlySignature = await signAsync(encoder.encode(message), base58_to_binary(this.#apiSecret));

        return fetch(input, {
            headers: {
                'Content-Type':
                    requestInit?.method !== 'GET' && requestInit?.method !== 'DELETE'
                        ? 'application/json'
                        : 'application/x-www-form-urlencoded',
                'orderly-timestamp': String(timestamp),
                'orderly-account-id': this.#accountId,
                'orderly-key': `ed25519:${binary_to_base58(await getPublicKeyAsync(base58_to_binary(this.#apiSecret)))}`,
                'orderly-signature': Buffer.from(orderlySignature).toString('base64url'),
                ...(requestInit?.headers ?? {})
            },
            ...(requestInit ?? {})
        });
    }

    async initSymbolInfo() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/public/info`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        let info = data['data']['rows'];
        for (const item of info) {
            this.symbolInfo[item['symbol']] = {
                'amountTick': item['base_tick'],
                'priceTick': item['quote_tick'],
                'minValue': item['min_notional']
            }
        }
        return this.symbolInfo;
    }

    async getSymbolList() {
        const symbolInfo = await this.initSymbolInfo();
        return Object.keys(symbolInfo);
    }

    async getFiatBalance(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/positions`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        return data['data']['total_collateral_value'];
    }

    async getPrice(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/public/market_trades?symbol=${symbol}&limit=1`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        return data['data']['rows'][0]['executed_price'];
    }

    async getPosition(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/positions`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const positions = data['data']['rows'];
        let curPosition = {
            'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
        }
        for (const item of positions) {
            if (symbol === item['symbol']) {
                curPosition = {
                    'amount': item['position_qty'],
                    'averageEntryPrice': item['average_open_price'],
                    'unrealisedPnl': item['unsettled_pnl']
                }
            }
        }
        return curPosition;
    }

    async getAllPositions() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/positions`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const positions = data['data']['rows'];
        let curPositions = {}
        for (const item of positions) {
            console.log(item)
            curPositions[item['symbol']] = {
                'amount': item['position_qty'],
                'averageEntryPrice': item['average_open_price'],
                'unrealisedPnl': item['unsettled_pnl']
            }
        }
        return curPositions;
    }

    async postOrder(symbol, orderType, side, amount, price, reduceOnly = false, orderTag = '') {
        let params = {
            symbol: symbol,
            order_type: orderType.toUpperCase(),
            order_quantity: amount,
            side: side.toUpperCase(),
            reduce_only: reduceOnly,
        }
        if (orderType === 'limit') {
            params['order_price'] = price;
        }
        if (orderTag === '') {
            params['order_tag'] = 'ORDERLYB';
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/order`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        return data['data']['order_id'];
    }

    async cancelOrder(symbol, orderId) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/order?symbol=${symbol}&order_id=${orderId}`,
            {
                method: 'DELETE',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        return true;
    }

    async cancelAllOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/orders?symbol=${symbol}`,
            {
                method: 'DELETE',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        return true;
    }

    async getPendingOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/orders?symbol${symbol}&status=INCOMPLETE`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const positions = data['data']['rows'];
        let pendingOrders = []
        for (const item of positions) {
            let amount = item['quantity']
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['order_id'],
                'price': item['price'],
                'amount': amount,
                'createdTime': item['created_time']
            })
        }
        return pendingOrders
    }

    async getAllPendingOrders() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/orders?status=INCOMPLETE`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const positions = data['data']['rows'];
        let pendingOrders = []
        for (const item of positions) {
            let amount = item['quantity']
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'symbol': item['symbol'],
                'orderId': item['order_id'],
                'price': item['price'],
                'amount': amount,
                'createdTime': item['created_time']
            })
        }
        return pendingOrders
    }

    async getTradeHistory(symbol, limit) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/trades?symbol=${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const rows = data['data']['rows']
        let historyList = []
        for (const item of rows) {
            let amount = item['executed_quantity']
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            historyList.push(
                {
                    'id': item['order_id'],
                    'price': item['executed_price'],
                    'amount': amount,
                    'executed_time': item['executed_timestamp'],
                }
            )
        }
        return historyList.slice(0, limit)
    }


    async getOrderBook(symbol, limit) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/orderbook/${symbol}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const asks = data['data']['asks'];
        const bids = data['data']['bids'];

        let newAsks = [];
        let newBids = [];
        for (const ask of asks) {
            newAsks.push({'price': ask['price'], 'qty': ask['quantity']});
        }
        for (const bid of bids) {
            newBids.push({'price': bid['price'], 'qty': bid['quantity']});
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

    async getKline(symbol, timeframe, limit) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/kline?symbol=${symbol}&type=${timeframe}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const klines = data['data']['rows'];
        let newKline = [];
        for (const kline of klines) {
            newKline.push({
                "open": kline["open"],
                "high": kline["high"],
                "low": kline["low"],
                "close": kline["close"],
                "volume": kline["volume"],
                "timestamp": kline["start_timestamp"],
            })
        }
        newKline.sort(function (first, second) {
            return second.timestamp - first.timestamp;
        });
        return newKline;
    }

    async setLeverage(symbol, leverage) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/client/leverage`,
            {
                method: 'POST',
                body: JSON.stringify({
                    leverage: leverage,
                })
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        return data["success"];
    }
}


module.exports = {
    Orderly
};
