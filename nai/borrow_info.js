const nearHelper = require('../helpers/near');
const config = require('config')
const BigNumber = require('bignumber.js')
const { transactions } = require("near-api-js");
let accountToConnect = config.accountConnect
const Helper = {
    callFunction: async (methodName, args) => {
        let account = await nearHelper.connectAccount(accountToConnect)
        let ret = await nearHelper.accountViewFunction(methodName, args, account)
        return ret
    },
    computeNAIAmountForLiquidation: async (borrowInfo) => {
        if (borrowInfo.borrowed == '0' || borrowInfo.current_collateral_ratio >= borrowInfo.collateral_ratio) {
            return '0'
        }

        //compute collateral value in USD
        let collateral_value_usd = new BigNumber(borrowInfo.collateral_value).dividedBy(new BigNumber(`1e${borrowInfo.decimals}`)).toString()
        collateral_value_usd = parseInt(collateral_value_usd)
        let bc = new BigNumber(borrowInfo.borrowed).dividedBy(new BigNumber(`1e18`))
        bc = parseInt(bc)
        bc = bc * borrowInfo.collateral_ratio / 10000
        bc = Math.floor(bc)

        let ts = bc - collateral_value_usd

        let ms = parseFloat(borrowInfo.collateral_ratio) - 10000.0 - borrowInfo.collateral_ratio * borrowInfo.liquidation_fee / 10000
        let p = parseFloat(borrowInfo.collateral_token_price) / 100000000
        ms = ms * p
        ms = ms / 10000

        console.log('ts', ts)
        console.log('ms', ms)
        console.log('liquidated amount', ts/ms)   
        let liquidated_nai = (p * (10000 - borrowInfo.liquidation_fee) / 10000) * ts/ms
        liquidated_nai = Math.floor(liquidated_nai)
        console.log('liquidated nai', liquidated_nai)   
        return new BigNumber('1e18').multipliedBy(liquidated_nai).toFixed(0)
    }
}

async function main() {
    let borrowInfos = await Helper.callFunction("get_current_borrow_info", {account_id: "deganstable.testnet"})
    //let priceData = await Helper.callFunction("get_price_data", {})
    for(const b of borrowInfos) {
        console.log(b.token_id)
        let l = await Helper.computeNAIAmountForLiquidation(b)
        if (l != '0') {
            let account = await nearHelper.connectAccount("liquidatortest.testnet")
            await account.signAndSendTransaction({
                receiverId: nearHelper.vaultContract(),
                actions: [
                    transactions.functionCall("liquidate", Buffer.from(JSON.stringify({ account_id: accountToConnect, collateral_token_id: b.token_id, nai_amount: `${l}`})), 100000000000000, "100000000000000000000000")
                ],
            })
        }
    }
}

module.exports = Helper