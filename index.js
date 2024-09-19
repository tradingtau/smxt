const Binance = require("./api/exchange/binance").Binance
const Bybit = require("./api/exchange/bybit").Bybit
const GateIo = require("./api/exchange/gateio").GateIo
const Orderly = require("./api/exchange/orderly").Orderly
const Okx = require("./api/exchange/okx").Okx

module.exports = {
    Binance,
    Bybit,
    GateIo,
    Orderly,
    Okx,
}
