const Api = require('../api').Api
const {createHmac} = require('crypto');
const {v4: uuidv4} = require('uuid');

/**
 * @class Binance
 */
class Binance extends Api {
    #baseUrl
    #apiKey
    #apiSecret
    #recvWindow

    constructor(apiKey, apiSecret) {
        super();
        this.#baseUrl = 'https://fapi.binance.com'
        this.#apiKey = apiKey
        this.#apiSecret = apiSecret
        this.#recvWindow = "5000"
        this.symbolInfo = {}
    }



    async initSymbolInfo() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/exchangeInfo`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let info = data['symbols'];
        for (const item of info) {
            let amountTick = 0.0
            let priceTick = 0.0
            let minValue = 0.0
            let maxOrderSize = 0.0
            for (const filter of item['filters']) {
                if (filter['filterType'] === 'LOT_SIZE') {
                    amountTick = parseFloat(filter['stepSize'])
                }
                if (filter['filterType'] === 'PRICE_FILTER') {
                    priceTick = parseFloat(filter['tickSize'])
                }
                if (filter['filterType'] === 'MIN_NOTIONAL') {
                    minValue = parseFloat(filter['notional'])
                }
                if (filter['filterType'] === 'MARKET_LOT_SIZE') {
                    maxOrderSize = parseFloat(filter['maxQty'])
                }
            }
            this.symbolInfo[item['symbol']] = {
                'amountTick': amountTick,
                'priceTick': priceTick,
                'minValue': minValue,
                'maxOrderSize': maxOrderSize,
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
            `${this.#baseUrl}/fapi/v3/account`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        for (let item of data['assets']) {
            if (item['asset'] === symbol) {
                return parseFloat(item['walletBalance'])
            }
        }
        return 0.0;
    }

    async getTotalEquity() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v3/account`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return parseFloat(data['totalWalletBalance'])
    }

    async getPrice(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/trades?symbol=${symbol}&limit=1`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return parseFloat(data[0]['price']);
    }

    async getPosition(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v3/positionRisk?symbol=${symbol}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let curPosition = {
            'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
        }
        for (const item of data) {
            if (item["pos"] === "0") {
                continue
            }
            curPosition["amount"] += parseFloat(item['positionAmt'])
            curPosition["averageEntryPrice"] = parseFloat(item['entryPrice'])
            let unrealisedPnl = item['unRealizedProfit']
            if (unrealisedPnl === '') {
                unrealisedPnl = 0
            }
            curPosition["unrealisedPnl"] = parseFloat(unrealisedPnl)
        }
        return curPosition;
    }

    async getAllPositions() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v3/positionRisk`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const positions = await result.json();
        let curPositions = {}
        for (const item of positions) {
            let curPosition = {
                'amount': 0, 'averageEntryPrice': 0, 'unrealisedPnl': 0
            }
            if (item["positionAmt"] === "0") {
                continue
            }
            curPosition["amount"] += parseFloat(item['positionAmt'])
            curPosition["averageEntryPrice"] = parseFloat(item['entryPrice'])
            let unrealisedPnl = item['unRealizedProfit']
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
            type: orderType === "limit" ? "LIMIT" : "MARKET",
            side: side === "buy" ? "BUY" : "SELL",
            quantity: amount.toString(),
            reduceOnly: reduceOnly,
        }
        if (orderType === 'limit') {
            params['price'] = price.toString();
            params['timeInForce'] = "GTC";
        }
        if (orderTag === '') {
            params['newClientOrderId'] = (Base64.decode("eC15UVZkUDZqTg==") + uuidv4().replaceAll("-", "")).substring(0, 36);
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/order?` + new URLSearchParams(params).toString(),
            {
                method: 'POST',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        return data['orderId']
    }

    async cancelOrder(symbol, orderId) {
        const params = {
            symbol: symbol,
            orderId: orderId,
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/order?` + new URLSearchParams(params).toString(),
            {
                method: 'DELETE',
            }
        )
        const data = await result.json();
        if(result.status !== 200) {
            let errMsg = ''
            try{
                errMsg = await result.text()
            } catch (e) {
                errMsg = data.msg;
            }
            throw new Error(errMsg);
        }
        return true;
    }

    async cancelAllOrders(symbol) {
        const params = {
            symbol: symbol,
        }
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/allOpenOrders?` + new URLSearchParams(params).toString(),
            {
                method: 'DELETE',
            }
        )
        const data = await result.json();
        if(result.status !== 200) {
            let errMsg = ''
            try{
                errMsg = await result.text()
            } catch (e) {
                errMsg = data.msg;
            }
            throw new Error(errMsg);
        }
        return true;
    }

    async getPendingOrders(symbol) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/openOrders?symbol=${symbol}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let pendingOrders = []
        for (const item of data) {
            let amount = parseFloat(item['origQty'])
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['orderId'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['updateTime']
            })
        }
        return pendingOrders
    }

    async getAllPendingOrders() {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/openOrders`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let pendingOrders = []
        for (const item of data) {
            let amount = parseFloat(item['origQty'])
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            pendingOrders.push({
                'orderId': item['orderId'],
                'symbol': item['symbol'],
                'price': parseFloat(item['price']),
                'amount': amount,
                'createdTime': item['updateTime']
            })
        }
        return pendingOrders
    }

    async getTradeHistory(symbol, limit = 500) {
        let url = `${this.#baseUrl}/fapi/v1/allOrders?symbol=${symbol}&limit=${limit}`
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
        let historyList = []
        for (const item of data) {
            let amount = parseFloat(item['executedQty'])
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            if (item['status'] !== "FILLED") {
                continue
            }
            let historyItem = {
                'ordId': item['orderId'],
                'price': parseFloat(item['avgPrice']),
                'amount': amount,
                'executed_time': item['updateTime'],
            }
            historyList.push(historyItem)
        }
        return historyList
    }

    async getPositionHistory(symbol, limit = 100) {
        let url = `${this.#baseUrl}/fapi/v1/userTrades?symbol=${symbol}&limit=${limit}`
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
        let historyList = []
        for (const item of data) {
            let amount = parseFloat(item['qty'])
            if (item['side'] === 'SELL' && amount > 0) {
                amount *= -1
            }
            let historyItem =
                {
                    'id': item['orderId'],
                    'price': parseFloat(item['price']),
                    'pnl': parseFloat(item['realizedPnl']),
                    'amount': amount,
                    'executed_time': item['time'],
                }
            historyList.push(historyItem)
        }
        return historyList
    }


    async getOrderBook(symbol, limit = 20) {
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/depth?symbol=${symbol}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        const asks = data['asks'];
        const bids = data['bids'];

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
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`,
            {
                method: 'GET',
            }
        )
        if(result.status !== 200) {
            const errMsg = await result.text()
            throw new Error(errMsg);
        }
        const data = await result.json();
        let newKline = [];
        for (const kline of data) {
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
        const result = await this.#signAndRequest(
            `${this.#baseUrl}/fapi/v1/leverage?symbol=${symbol}&leverage=${leverage}`,
            {
                method: 'POST',
            }
        )
        if(result.status !== 200) {
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

    async #signAndRequest(input, requestInit) {
        input += (input.includes("?") ? "&" : "?") + "timestamp=" + Date.now()
        const url = new URL(input);
        const params = new URLSearchParams(url.search);
        let message = `${params.toString()}`;
        if (requestInit?.body) {
            message += requestInit.body;
        }
        const signature = createHmac('sha256', this.#apiSecret).update(message).digest('hex')
        input += "&signature=" + signature;

        return fetch(input, {
            headers: {
                'Content-Type':
                    requestInit?.method !== 'GET' && requestInit?.method !== 'DELETE'
                        ? 'application/json'
                        : 'application/x-www-form-urlencoded',
                'X-MBX-APIKEY': this.#apiKey,
                ...(requestInit?.headers ?? {})
            },
            ...(requestInit ?? {})
        });
    }
}

let Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}


module.exports = {
    Binance
};
