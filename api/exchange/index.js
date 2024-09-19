const Binance = require("./binance.js").Binance;
const Bybit = require("./bybit.js").Bybit;
const GateIo = require("./gateio.js").GateIo;
const Orderly = require("./orderly.js").Orderly;
const Okx = require("./okx.js").Okx;


module.exports = {
    Binance: Binance,
    Bybit: Bybit,
    GateIo: GateIo,
    Orderly: Orderly,
    Okx: Okx,
};

