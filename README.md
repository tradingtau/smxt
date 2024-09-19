# SMXT – SiMple eXchange Trading

A JavaScript library for cryptocurrency trading.

We aim to easily link multiple exchanges with one strategy code.

---

## Exchange currently supported
### CEX
- Binance Futures
- Bybit Futures (Unified, cross, one-way mode)
- Okx Futures
- Gate.io Futures

### DEX
- Orderly Futrues

---

## Install
### JavaScript (NPM)
[smxt in **NPM**](https://www.npmjs.com/package/smxt)
```shell
npm install smxt
```
```JavaScript
//cjs
var smxt = require('smxt')
console.log(smxt) // print all available exchanges
```

---

## Documentation

#### market data
- initSymbolInfo()
- getSymbolList()
- getPrice(symbol)
- getOrderBook(symbol, limit)
- getKline(symbol, timeframe, limit)
#### wallet data
- getSymbolBalance(symbol)
- getTotalEquity()
#### trade function
- getPosition(symbol)
- getAllPositions()
- postOrder(symbol, orderType, side, amount, price, reduceOnly, orderTag)
- cancelOrder(symbol, orderId)
- cancelAllOrders(symbol)
- getPendingOrders(symbol)
- getAllPendingOrders()
- getTradeHistory(symbol, limit)
- getPositionHistory(symbol, limit)
- setLeverage(symbol, leverage)

### For Detail
[-> Manual](https://github.com/tradingtau/smxt/blob/main/api/api.js)

## Usage
#### initialize
```JavaScript
var smxt = require('smxt')

let binance = new smxt.Binance(
    apiKey = "YOUR_API_KEY",
    apiSecret = "YOUR_API_SECERT"
)

let bybit = new smxt.Bybit(
    apiKey = "YOUR_API_KEY", 
    apiSecret = "YOUR_API_SECERT"
)

let okx = new smxt.Okx(
    apiKey = "YOUR_API_KEY",
    apiSecret = "YOUR_API_SECERT",
    passphrase = "YOUR_PASSPHRASE"
)

let gateIo = new smxt.GateIo(
    apiKey = "YOUR_API_KEY",
    apiSecret = "YOUR_API_SECERT"
)

let orderly = new smxt.Orderly(
    accountId = "YOUR_ACCOUNT_ID",
    apiSecret = "YOUR_API_SECERT"
)
```

#### get wallet data
```JavaScript
let totalEquity = await bybit.getTotalEquity()
console.log(totalEquity) // 1000.0

let symbolBalance = await bybit.getSymbolBalance("USDT")
console.log(symbolBalance) // 700.0
```

#### get market data
```JavaScript
// init symbol info (tick step, qty step, min qty)
await bybit.initSymbolInfo()
console.log(bybit.symbolInfo)
// {
//    BTCUSDT: { amountTick: 0.001, priceTick: 0.1, minValue: 0.001, maxOrderSize: 100, contractValue: 1}
//    ETHUSDT: { amountTick: 1, priceTick: 0.0001, minValue: 1, maxOrderSize: 10000, contractValue: 1}
// }

let timeframe = "1d" // or 4h, 1h, 30m, 15m, 5m, 1m
let kline = await bybit.getKline("ETHUSDT", timeframe)
console.log(kline)
// [
//  {
//     open: 3138.75,
//     high: 3169.63,
//     low: 3126.45,
//     close: 3135.52,
//     volume: 10228.3683,
//     timestamp: 1714003200000
//  },
//  {
//     open: 3219.37,
//     high: 3292.7,
//     low: 3103.04,
//     close: 3138.74,
//     volume: 53623.2576,
//     timestamp: 1713916800000
//  }
// ]
```

#### trade function
```JavaScript
let orderType = "limit" // or market
let side = "buy" // or sell
let amount = 10
let price = 0.4
let orderId = await bybit.postOrder(
    "XRPUSDT", 
    orderType, 
    side, 
    amount, 
    price
)
console.log(orderId) 

let position = await bybit.getPosition("XRPUSDT")
console.log(position) // 10.0(long) or -10.0(short)

await bybit.cancelAllOrders("XRPUSDT")
```

--- 

## Contact Us

For business inquiries: dev@tradingtau.com

---


