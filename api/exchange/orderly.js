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
            console.log(item)
            this.symbolInfo[item['symbol']] = {
                'amountTick': item['base_tick'],
                'priceTick': item['quote_tick'],
                'minValue': item['min_notional'],
                'maxOrderSize': parseFloat(item['base_max']),
                'contractValue': 1.0
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
            params['order_tag'] = Base64.decode("T1JERVJMWUI=");
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
        }``
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

    async getPositionHistory(symbol = "", limit = 100) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/v1/orders?symbol${symbol}&status=FILLED`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        if (!data['success']) {
            throw new Error(data['message']);
        }
        const positions = data['data']['rows'];
        let historyList = []
        for (const item of positions) {
            let amount = parseFloat(item['executed'])
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            let historyItem =
                {
                    'id': item['order_id'],
                    'symbol': item['symbol'],
                    'price': item['average_executed_price'],
                    'pnl': item['realized_pnl'],
                    'amount': amount,
                    'executed_time': item['updated_time'],
                }

            if (symbol === "") {
                historyItem['symbol'] = item['instId']
            }
            historyList.push(historyItem)
        }
        return historyList
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
}

let Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}



module.exports = {
    Orderly
};
