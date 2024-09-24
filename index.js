const Binance = require("./api/exchange/binance").Binance
const Bitget = require("./api/exchange/bitget").Bitget
const Bybit = require("./api/exchange/bybit").Bybit
const GateIo = require("./api/exchange/gateio").GateIo
const Orderly = require("./api/exchange/orderly").Orderly
const Okx = require("./api/exchange/okx").Okx

module.exports = {
    Binance,
    Bitget,
    Bybit,
    GateIo,
    Orderly,
    Okx,
}
