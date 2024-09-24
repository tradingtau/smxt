const Binance = require("./binance.js").Binance;
const Bitget = require("./bitget").Bitget;
const Bybit = require("./bybit.js").Bybit;
const GateIo = require("./gateio.js").GateIo;
const Orderly = require("./orderly.js").Orderly;
const Okx = require("./okx.js").Okx;

module.exports = {
    Binance: Binance,
    Bitget: Bitget,
    Bybit: Bybit,
    GateIo: GateIo,
    Orderly: Orderly,
    Okx: Okx,
};

