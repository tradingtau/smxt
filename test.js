const Binance = require("./api/exchange/binance").Binance
const Bybit = require("./api/exchange/bybit").Bybit
const GateIo = require("./api/exchange/gateio").GateIo
const Orderly = require("./api/exchange/orderly").Orderly
const Okx = require("./api/exchange/okx").Okx

async function test() {
    // let api = new Binance("", "")
    // let result = await api.initSymbolInfo()
    // let result = await api.getSymbolList()
    // let result = await api.getSymbolBalance()
    // let result = await api.getTotalEquity()
    // let result = await api.getPrice("BTCUSDT")
    // let result = await api.getPosition("TIAUSDT")
    // let result = await api.getAllPositions()
    // let result = await api.postOrder("XRPUSDT", "limit", "buy", "10", "0.51" , false)
    // let result = await api.cancelOrder("XRPUSDT", "65890181324")
    // let result = await api.cancelAllOrders("XRPUSDT")
    // let result = await api.getPendingOrders("XRPUSDT")
    // let result = await api.getAllPendingOrders()
    // let result = await api.getTradeHistory("XRPUSDT")
    // let result = await api.getPositionHistory("XRPUSDT")
    // let result = await api.getOrderBook("BTCUSDT")
    // let result = await api.getKline("XRPUSDT", "1m")
    // let result = await api.setLeverage("XRPUSDT", 50)
    // console.log(result)
}

test()
