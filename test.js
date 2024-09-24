const Binance = require("./api/exchange/binance").Binance
const Bitget = require("./api/exchange/bitget").Bitget
const Bybit = require("./api/exchange/bybit").Bybit
const GateIo = require("./api/exchange/gateio").GateIo
const Orderly = require("./api/exchange/orderly").Orderly
const Okx = require("./api/exchange/okx").Okx

async function test() {
    let api = new Bitget("", "", "")
    // let result = await api.initSymbolInfo()
    // let result = await api.getSymbolList()
    // let result = await api.getSymbolBalance()
    // let result = await api.getTotalEquity()
    // let result = await api.getPrice("BTCUSDT")
    // let result = await api.getPosition("ETHUSDT")
    // let result = await api.getAllPositions()
    // let result = await api.postOrder("XRPUSDT", "limit", "sell", "10", "0.81" , false)
    // let result = await api.cancelOrder("XRPUSDT", "1222294109885521930")
    // let result = await api.cancelAllOrders("XRPUSDT")
    // let result = await api.getPendingOrders("XRPUSDT")
    // let result = await api.getAllPendingOrders()
    // let result = await api.getTradeHistory("ETHUSDT")
    // let result = await api.getPositionHistory("SOLUSDT")
    // let result = await api.getOrderBook("XRPUSDT")
    // let result = await api.getKline("XRPUSDT", "1d")
    // let result = await api.setLeverage("XRPUSDT", 10)
    // console.log(result)
}

test()
