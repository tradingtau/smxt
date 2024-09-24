const Api = require('../api').Api
const {createHmac} = require('crypto');
const {v4: uuidv4} = require('uuid');

/**
 * @class Bitget
 */
class Bitget extends Api {
    #baseUrl
    #apiKey
    #apiSecret
    #recvWindow
    #passphrase

    constructor(apiKey, apiSecret, passphrase) {
        super();
        this.#baseUrl = 'https://api.bitget.com'
        this.#apiKey = apiKey
        this.#apiSecret = apiSecret
        this.#recvWindow = "5000"
        this.#passphrase = passphrase
        this.symbolInfo = {}
    }



    async initSymbolInfo() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/market/contracts?productType=usdt-futures`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let info = data['data'];
        for (const item of info) {
            let pricePlace = parseInt(item['pricePlace'])
            this.symbolInfo[item['symbol']] = {
                'amountTick': parseFloat(item['sizeMultiplier']),
                'priceTick': parseFloat(parseFloat(10 ** -pricePlace).toFixed(pricePlace)),
                'minValue': parseFloat(item['minTradeUSDT']),
                'maxOrderSize': parseFloat(item['maxPositionNum']),
                'contractValue': 1.0
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
            `${this.#baseUrl}/api/v2/mix/account/accounts?productType=USDT-FUTURES`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        for (let item of data['data']) {
            if (item['marginCoin'] === symbol) {
                return parseFloat(item['usdtEquity'])
            }
        }
        return 0.0;
    }

    async getTotalEquity() {
        const result = await this.getSymbolBalance("USDT")
        return result
    }

    async getPrice(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/market/fills?productType=USDT-FUTURES&symbol=${symbol}&limit=1`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        return parseFloat(data['data'][0]['price']);
    }

    async getPosition(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/position/single-position?productType=USDT-FUTURES&symbol=${symbol}&marginCoin=USDT`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let curPosition = {
            'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
        }
        for (const item of data['data']) {
            let amount = parseFloat(item['total'])
            if (item['holdSide'] === 'short' && amount > 0) {
                amount *= -1
            }
            curPosition["amount"] = amount
            curPosition["averageEntryPrice"] = parseFloat(item['openPriceAvg'])
            let unrealisedPnl = item['unrealizedPL']
            if (unrealisedPnl === '') {
                unrealisedPnl = 0
            }
            curPosition["unrealisedPnl"] = parseFloat(unrealisedPnl)
        }
        return curPosition;
    }

    async getAllPositions() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let curPositions = {}
        for (const item of data['data']) {
            let curPosition = {
                'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
            }
            if (item["positionAmt"] === "0") {
                continue
            }
            let amount = parseFloat(item['total'])
            if (item['holdSide'] === 'short' && amount > 0) {
                amount *= -1
            }
            curPosition["amount"]  = amount
            curPosition["averageEntryPrice"] = parseFloat(item['openPriceAvg'])
            let unrealisedPnl = item['unrealizedPL']
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
            symbol: symbol,
            productType: 'USDT-FUTURES',
            marginMode : 'crossed',
            marginCoin: 'USDT',
            orderType: orderType,
            side: side,
            size: amount.toString(),
            reduceOnly: reduceOnly ? 'YES' : 'NO',
        }
        if (orderType === 'limit') {
            params['price'] = price.toString();
        }
        console.log(new URLSearchParams(params).toString())
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/order/place-order`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        return data['data']['orderId']
    }

    async cancelOrder(symbol, orderId) {
        const params = {
            symbol: symbol,
            productType: 'USDT-FUTURES',
            orderId: orderId,
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/order/cancel-order`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        return true;
    }

    async cancelAllOrders(symbol) {
        const params = {
            symbol: symbol,
            productType: 'USDT-FUTURES',
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/order/cancel-all-orders`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        return true;
    }

    async getPendingOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/order/orders-pending?symbol=${symbol}&productType=USDT-FUTURES`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let pendingOrders = []
        for (const item of data['data']['entrustedList']) {
            let amount = parseFloat(item['size'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['orderId'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['uTime']
            })
        }
        return pendingOrders
    }

    async getAllPendingOrders() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/order/orders-pending?productType=USDT-FUTURES`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let pendingOrders = []
        for (const item of data['data']['entrustedList']) {
            let amount = parseFloat(item['size'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['orderId'],
                'symbol': item['symbol'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['uTime']
            })
        }
        return pendingOrders
    }

    async getTradeHistory(symbol, limit = 100) {
        let url = `${this.#baseUrl}/api/v2/mix/order/fills?symbol=${symbol}&limit=${limit}&productType=USDT-FUTURES`
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let historyList = []
        for (const item of data['data']['fillList']) {
            let amount = parseFloat(item['baseVolume'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            let historyItem = {
                'ordId': item['orderId'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'executed_time': item['cTime'],
            }
            historyList.push(historyItem)
        }
        return historyList
    }

    async getPositionHistory(symbol, limit = 100) {
        let url = `${this.#baseUrl}/api/v2/mix/order/fills?symbol=${symbol}&limit=${limit}&productType=USDT-FUTURES`
        const result = await this.#signAndRequest(
            url,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let historyList = []
        for (const item of data['data']['fillList']) {
            let amount = parseFloat(item['baseVolume'])
            if (item['side'] === 'sell' && amount > 0) {
                amount *= -1
            }
            let historyItem =
                {
                    'id': item['orderId'],
                    'price': parseFloat(item['price']),
                    'pnl': parseFloat(item['profit']),
                    'amount': amount,
                    'executed_time': item['cTime'],
                }
            historyList.push(historyItem)
        }
        return historyList
    }


    async getOrderBook(symbol, limit = 15) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/market/merge-depth?symbol=${symbol}&limit=${limit}&productType=USDT-FUTURES`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        const asks = data['data']['asks'];
        const bids = data['data']['bids'];

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
            `${this.#baseUrl}/api/v2/mix/market/candles?symbol=${symbol}&granularity=${timeframe}&limit=${limit}&productType=USDT-FUTURES`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        let newKline = [];
        for (const kline of data['data']) {
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
            return second.timestamp - first.timestamp;
        });
        return newKline;
    }

    async setLeverage(symbol, leverage) {
        const params = {
            symbol: symbol,
            leverage: leverage,
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/api/v2/mix/account/set-leverage`,
            {
                method: 'POST',
                body: JSON.stringify(params)
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        if (data['code'] !== "00000") {
            throw new Error(data['msg']);
        }
        return true;
    }

    async #sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }

    async #signAndRequest(input, requestInit) {
        const url = new URL(input);
        const timestamp = Math.round(new Date())
        let message = `${timestamp}${requestInit?.method ?? 'GET'}${url.pathname}${url.search}`;
        if (requestInit?.body) {
            message += requestInit.body;
        }
        console.log(message)
        const signature = createHmac('sha256', this.#apiSecret).update(message).digest('base64')

        return fetch(input, {
            headers: {
                'Content-Type':
                    requestInit?.method !== 'GET' && requestInit?.method !== 'DELETE'
                        ? 'application/json'
                        : 'application/x-www-form-urlencoded',
                'ACCESS-KEY': this.#apiKey,
                'ACCESS-PASSPHRASE': this.#passphrase,
                'ACCESS-SIGN': signature,
                'ACCESS-TIMESTAMP': timestamp,
                'X-CHANNEL-API-CODE': Base64.decode('MWpidHo='),
                ...(requestInit?.headers ?? {})
            },
            ...(requestInit ?? {})
        });
    }
}

let Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}


module.exports = {
    Bitget
};
