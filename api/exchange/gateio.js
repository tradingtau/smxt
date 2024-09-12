const Api = require('../api').Api
const {createHmac, createHash} = require('crypto');
const {v4: uuidv4} = require('uuid');

/**
 * @class GateIo
 */
class GateIo extends Api {
    #baseUrl
    #apiKey
    #apiSecret
    #recvWindow

    constructor(apiKey, apiSecret) {
        super();
        this.#baseUrl = 'https://api.gateio.ws'
        this.#apiKey = apiKey
        this.#apiSecret = apiSecret
        this.#recvWindow = "5000"
        this.symbolInfo = {}
    }

    async initSymbolInfo() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/contracts`,
            {
                method: 'GET',
            }
        )
        const data = await result.json();
        for (const item of data) {
            this.symbolInfo[item['name']] = {
                'amountTick': parseFloat(item['order_size_min']),
                'priceTick': parseFloat(item['order_price_round']),
                'minValue': parseFloat(item['order_size_min']),
                'maxOrderSize': parseFloat(item['order_size_max']),
                'contractValue': parseFloat(item['quanto_multiplier'])
            }
        }
        return this.symbolInfo;
    }

    async getSymbolList() {
        const symbolInfo = await this.initSymbolInfo();
        return Object.keys(symbolInfo);
    }

    async getSymbolBalance(symbol="USDT") {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/${symbol.toLowerCase()}/accounts`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return parseFloat(data["total"]);
    }

    async getTotalEquity() {
        const total = await this.getSymbolBalance("USDT")
        return total
    }

    async getPrice(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/trades?contract=${symbol}&limit=1`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return parseFloat(data[0]["price"]);
    }

    async getPosition(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/positions/${symbol}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        let curPosition = {
            'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
        }
        const data = await result.json();
        curPosition['amount'] = parseFloat(data['size'])
        curPosition['averageEntryPrice'] = parseFloat(data['entry_price'])
        curPosition['unrealisedPnl'] = parseFloat(data['unrealised_pnl'])
        return curPosition;
    }

    async getAllPositions(settleCoin = "USDT") {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/${settleCoin.toLowerCase()}/positions`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let curPositions = {}
        for (const item of data) {
            let curPosition = {
                'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
            }
            if (parseFloat(item["size"]) === 0) {
                continue
            }
            curPosition["amount"] += parseFloat(item['size'])
            curPosition["averageEntryPrice"] = parseFloat(item['entry_price'])
            let unrealisedPnl = item['unrealised_pnl']
            if (unrealisedPnl === '') {
                unrealisedPnl = 0
            }
            curPosition["unrealisedPnl"] = parseFloat(unrealisedPnl)
            curPositions[item['contract']] = curPosition
        }
        return curPositions;
    }

    async postOrder(symbol, orderType, side, amount, price, reduceOnly = false, orderTag = '') {
        if (side === 'sell') {
            amount = -Math.abs(amount)
        } else {
            amount = Math.abs(amount)
        }
        let params = {
            contract: symbol,
            size: amount.toString(),
            tif: "gtc",
        }
        if (orderType === 'limit') {
            params['price'] = price.toString();
        } else {
            params['price'] = 0;
            params['tif'] = 'ioc'
        }
        if (reduceOnly) {
            params['reduce_only'] = true
        }
        if (orderTag !== '') {
            params['text'] = orderTag.substring(0, 28)
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/orders`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return data['id']
    }

    async cancelOrder(symbol, orderId) {
        if(orderId === '') {
            throw new Error("no order id");
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/orders/${orderId}`,
            {
                method: 'DELETE'
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return true
    }

    async cancelAllOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/orders?contract=${symbol}`,
            {
                method: 'DELETE'
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return true
    }

    async getPendingOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/orders?contract=${symbol}&status=open`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let pendingOrders = []
        for (const item of data) {
            let amount = parseFloat(item['size'])
            let side = 'buy';
            if (amount < 0) {
                side = 'sell'
            }
            pendingOrders.push({
                'orderId': item['id'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['create_time']
            })
        }
        return pendingOrders
    }

    async getAllPendingOrders(settleCoin = "USDT") {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/${settleCoin.toLowerCase()}/orders?status=open`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let pendingOrders = []
        for (const item of data) {
            let amount = parseFloat(item['size'])
            let side = 'buy';
            if (amount < 0) {
                side = 'sell'
            }
            pendingOrders.push({
                'symbol': item['contract'],
                'orderId': item['id'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['create_time']
            })
        }
        return pendingOrders
    }

    async getTradeHistory(symbol = "", limit = 100) {
        let url = `${this.#baseUrl}/api/v4/futures/usdt/my_trades?limit=${limit}`
        if (symbol.length > 0) {
            url += `&contract=${symbol}`
        }
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let historyList = []
        for (const item of data) {
            let amount = parseFloat(item['size'])
            let historyItem = {
                'ordId': item['id'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'executed_time': item['create_time'],
            }
            if (symbol === "") {
                historyItem['symbol'] = item['contract']
            }
            historyList.push(historyItem)
        }
        return historyList
    }

    async getPositionHistory(symbol = "", limit = 100) {
        let url = `${this.#baseUrl}/api/v4/futures/usdt/position_close?limit=${limit}`
        if (symbol.length > 0) {
            url += `&contract=${symbol}`
        }
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let historyList = []
        for (const item of data) {
            let amount = parseFloat(item['accum_size'])
            let historyItem =
                {
                    'id': item['first_open_time'],
                    'price': amount > 0 ? parseFloat(item['long_price']) : parseFloat(item['short_price']),
                    'pnl': parseFloat(item['pnl']),
                    'amount': amount,
                    'executed_time': item['time'],
                }
            if (symbol === "") {
                historyItem['symbol'] = item['contract']
            }
            historyList.push(historyItem)
        }
        return historyList
    }


    async getOrderBook(symbol, limit = 20) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/order_book?contract=${symbol}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        const asks = data['asks'];
        const bids = data['bids'];

        let newAsks = [];
        let newBids = [];
        for (const ask of asks) {
            newAsks.push({'price': parseFloat(ask['p']), 'qty': parseFloat(ask['s'])});
        }
        for (const bid of bids) {
            newBids.push({'price': parseFloat(bid['p']), 'qty': parseFloat(bid['s'])});
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
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/candlesticks?contract=${symbol}&interval=${timeframe}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let newKline = [];
        for (const kline of data) {
            newKline.push({
                "open": parseFloat(kline['o']),
                "high": parseFloat(kline['h']),
                "low": parseFloat(kline['l']),
                "close": parseFloat(kline['c']),
                "volume": parseFloat(kline['v']),
                "timestamp": parseInt(kline['t']),
            })
        }
        newKline.sort(function (first, second) {
            return second.timestamp - first.timestamp;
        });
        return newKline;
    }

    async setLeverage(symbol, leverage) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v4/futures/usdt/positions/${symbol}/leverage?leverage=0&cross_leverage_limit=${leverage}`,
            {
                method: 'POST',
            }
        )

        if(result.status !== 200 && result.status !== 201) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return true;
    }

    async #sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }

    async #signAndRequest(input, requestInit = {}) {
        const timestamp = Math.floor(Date.now() / 1000);
        const url = new URL(input);
        const queryString = url.search || '';
        const body = requestInit.body || '';
        const method = requestInit.method || 'GET';
        const hashedPayload = createHash('sha512').update(body || '').digest('hex')

        const message = `${method}\n${url.pathname}\n${queryString.replace("?", "")}\n${hashedPayload}\n${timestamp}`;
        const signature = createHmac('sha512', this.#apiSecret).update(message).digest('hex')

        const headers = {
            'Accept': 'application/json',
            'Content-Type': method !== 'GET' ? 'application/json' : 'application/x-www-form-urlencoded',
            'KEY': this.#apiKey,
            'SIGN': signature,
            'Timestamp': timestamp.toString(),
            'X-Gate-Channel_Id': Base64.decode('bWFzdGVycmF5bg=='),
            ...(requestInit.headers || {})
        };

        return fetch(input, {
            ...requestInit,
            headers,
        });
    }
}

let Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}


module.exports = {
    GateIo
};
