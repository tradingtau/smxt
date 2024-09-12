class Api {
    constructor() {
    }

    async initSymbolInfo() {
        /**
         * @abstract
         * @name initSymbolInfo
         * @description get symbol info and store in class symbol_info
         * @returns {map} symbol info
         * @example
         * {
         *   BTCUSDT: { amountTick: 0.1, priceTick: 0.001, minValue: 10, maxOrderSize: 100, contractValue: 1 },
         *   ETHUSDT: { amountTick: 1, priceTick: 0.0001, minValue: 10, maxOrderSize: 10000, contractValue: 1 }
         * }
         */
        throw new Error("Method 'initSymbolInfo()' must be implemented.");
    }

    async getSymbolList() {
        /**
         * @abstract
         * @name getSymbolList
         * @description get symbol list
         * @returns {array} symbol list
         * @example
         * [
         *   'BTCUSDT',
         *   'ETHUSDT'
         * ]
         */
        throw new Error("Method 'getSymbolList' must be implemented.");
    }

    async getSymbolBalance(symbol) {
        /**
         * @abstract
         * @name getSymbolBalance
         * @description get symbol balance
         * @param {string} symbol symbol (ex USDT)
         * @returns {number} symbol balance
         */
        throw new Error("Method 'getSymbolBalance' must be implemented.");
    }

    async getTotalEquity() {
        /**
         * @abstract
         * @name getTotalEquity
         * @description get total equity
         * @returns {number} total equity
         */
        throw new Error("Method 'getTotalEquity' must be implemented.");
    }

    async getPrice(symbol) {
        /**
         * @abstract
         * @name getPrice
         * @description get recent price of symbol
         * @param {string} symbol symbol
         * @returns {number} recent price
         */
        throw new Error("Method 'getPrice' must be implemented.");
    }

    async getPosition(symbol) {
        /**
         * @abstract
         * @name getPosition
         * @description get position of symbol. If short, amount will be negative
         * @param {string} symbol symbol
         * @returns {map} position amount, average entry price
         * @example
         * { amount: 0.01, averageEntryPrice: 3164.71, unrealisedPnl: 10.0 }
         */
        throw new Error("Method 'getPosition' must be implemented.");
    }

    async getAllPositions() {
        /**
         * @abstract
         * @name getPosition
         * @description get all positions. If short, amount will be negative
         * @returns {map} symbol's position amount, average entry price
         * @example
         * {
         *   BTCUSDT: { amount: 234.4, averageEntryPrice: 0.62983226 , unrealisedPnl: 10.0 },
         *   ETHUSDT: { amount: 1.33, averageEntryPrice: 42.19988676 , unrealisedPnl: 15.0 }
         * }
         */
        throw new Error("Method 'getAllPositions' must be implemented.");
    }

    async postOrder(symbol, orderType, side, amount, price, reduceOnly, orderTag) {
        /**
         * @abstract
         * @name postOrder
         * @description post order
         * @param {string} symbol symbol
         * @param {string} orderType limit or market
         * @param {string} side buy or sell
         * @param {number} amount amount
         * @param {number} price price
         * @param {boolean} reduceOnly is reduce only (default false)
         * @param {string} orderTag order tag (default none)
         * @returns {number} order id
         */
        throw new Error("Method 'postOrder' must be implemented.");
    }

    async cancelOrder(symbol, orderId) {
        /**
         * @abstract
         * @name cancelOrder
         * @description cancel a pending order
         * @param {string} symbol symbol
         * @param {number} orderId symbol
         * @returns {boolean} success
         */
        throw new Error("Method 'cancelOrder' must be implemented.");
    }

    async cancelAllOrders(symbol) {
        /**
         * @abstract
         * @name cancelAllOrders
         * @description cancel all pending orders of symbol
         * @param {string} symbol symbol
         * @returns {boolean} success
         */
        throw new Error("Method 'cancelAllOrders' must be implemented.");
    }

    async getPendingOrders(symbol) {
        /**
         * @abstract
         * @name getPendingOrders
         * @description get list of pending orders of symbol
         * @param {string} symbol symbol
         * @returns {array} list of pending orders
         * @example
         * [
         *   {
         *     orderId: 937181153,
         *     price: 4000,
         *     amount: -0.01,
         *     createdTime: 1714031471707
         *   },
         *   {
         *     orderId: 937166374,
         *     price: 3000,
         *     amount: 0.01,
         *     createdTime: 1714031306332
         *   }
         * ]
         */
        throw new Error("Method 'getPendingOrders' must be implemented.");
    }

    async getAllPendingOrders() {
        /**
         * @abstract
         * @name getPendingOrders
         * @description get list of pending all orders
         * @returns {array} list of pending all orders
         * @example
         * [
         *   {
         *     symbol: 'BTCUSDT',
         *     orderId: 937181153,
         *     price: 4000,
         *     amount: -0.01,
         *     createdTime: 1714031471707
         *   },
         *   {
         *     symbol: 'BTCUSDT',
         *     orderId: 937166374,
         *     price: 3000,
         *     amount: 0.01,
         *     createdTime: 1714031306332
         *   }
         * ]
         */
        throw new Error("Method 'getPendingOrders' must be implemented.");
    }

    async getTradeHistory(symbol, limit) {
        /**
         * @abstract
         * @name getTradeHistory
         * @description get list of trades of symbol
         * @param {string} symbol symbol
         * @param {number} limit limit
         * @returns {array} list of trades of symbol
         * @example
         * [
         *   {
         *     id: 933348449,
         *     price: 3164.71,
         *     amount: 0.01,
         *     executed_time: 1714026792144
         *   },
         *   {
         *     id: 638883501,
         *     price: 3437.45,
         *     amount: -1.4055,
         *     executed_time: 1712752912688
         *   }
         * ]
         */
        throw new Error("Method 'getTradeHistory' must be implemented.");
    }

    async getPositionHistory(symbol, limit) {
        /**
         * @abstract
         * @name getPositionHistory
         * @description get list of positions of symbol
         * @param {string} symbol symbol
         * @param {number} limit limit
         * @returns {array} list of positions of symbol
         * @example
         * [
         *   {
         *     id: 933348449,
         *     price: 3164.71,
         *     pnl: 10.2,
         *     amount: 0.01,
         *     executed_time: 1714026792144
         *   },
         *  {
         *     id: 933348431,
         *     price: 3162.71,
         *     pnl: -2.2,
         *     amount: 0.01,
         *     executed_time: 1714026792042
         *   },
         * ]
         */
        throw new Error("Method 'getPositionHistory' must be implemented.");
    }

    async getOrderBook(symbol, limit) {
        /**
         * @abstract
         * @name getOrderBook
         * @description get orderbook of symbol
         * @param {string} symbol symbol
         * @param {number} limit asks, bids limit number
         * @returns {map} asks, bids map. First data of bids, asks is close to middle price
         * @example
         * {
         *   asks: [
         *     { price: 3136.72, qty: 104.9492 },
         *     { price: 3136.73, qty: 10.7934 },
         *     { price: 3136.74, qty: 4.4539 }
         *   ],
         *   bids: [
         *     { price: 3136.71, qty: 9.0414 },
         *     { price: 3136.63, qty: 1.5927 },
         *     { price: 3136.46, qty: 0.7963 }
         *   ]
         * }
         */
        throw new Error("Method 'getOrderBook' must be implemented.");
    }

    async getKline(symbol, timeframe, limit) {
        /**
         * @abstract
         * @name getKline
         * @description get kline of symbol. First data is recent data
         * @param {string} timeframe 1d, 1h, 30m
         * @param {number} limit limit
         * @returns {map} kline
         * @example
         * [
         *   {
         *     open: 3138.75,
         *     high: 3169.63,
         *     low: 3126.45,
         *     close: 3135.52,
         *     volume: 10228.3683,
         *     timestamp: 1714003200000
         *   },
         *   {
         *     open: 3219.37,
         *     high: 3292.7,
         *     low: 3103.04,
         *     close: 3138.74,
         *     volume: 53623.2576,
         *     timestamp: 1713916800000
         *   }
         * ]
         */
        throw new Error("Method 'getKline' must be implemented.");
    }

    async setLeverage(symbol, leverage) {
        /**
         * @abstract
         * @name setLeverage
         * @description set leverage of symbol
         * @param {string} symbol symbol
         * @param {number} leverage leverage
         * @returns {boolean} set leverage result
         */
        throw new Error("Method 'setLeverage' must be implemented.");
    }

}

module.exports = {
    Api
};
