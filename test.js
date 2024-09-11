const smxt = require("./index")


async function test() {
    let okx = new smxt.Okx(
        )

    let result = await okx.getAllPositions()
    console.log(result)

}

test()
