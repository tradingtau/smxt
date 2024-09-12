const Bybit = require("./api/exchange/bybit").Bybit
const GateIo = require("./api/exchange/gateio").GateIo
const Orderly = require("./api/exchange/orderly").Orderly
const Okx = require("./api/exchange/okx").Okx

module.exports = {
    Bybit,
    GateIo,
    Orderly,
    Okx,
}
