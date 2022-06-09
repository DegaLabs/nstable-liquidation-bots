const nearHelper = require('../helpers/near');
const config = require('config')
let accountToConnect = config.accountConnect
let borrowHelper = require('./borrow_info')
let generalHelper = require('../helpers/general')
let db = require('../models')

const NUM_ACCOUNT_PER_BATCH = 50;
const UPDATE_PERIOD = 300;

async function check() {
    let borrowInfos = await Helper.callFunction("get_current_borrow_info", { account_id: "deganstable.testnet" })
    //let priceData = await Helper.callFunction("get_price_data", {})
    for (const b of borrowInfos) {
        console.log(b.token_id)
        let l = await Helper.computeNAIAmountForLiquidation(b)
        if (l != '0') {
            let account = await nearHelper.connectAccount("liquidatortest.testnet")
            await account.signAndSendTransaction({
                receiverId: nearHelper.vaultContract(),
                actions: [
                    transactions.functionCall("liquidate", Buffer.from(JSON.stringify({ account_id: accountToConnect, collateral_token_id: b.token_id, nai_amount: `${l}` })), 100000000000000, "100000000000000000000000")
                ],
            })
        }
    }
}

async function updateAccountList(accountIds) {
    for (const accountId of accountIds) {
        let trial = 20
        while (true) {
            try {
                let borrowInfos = await borrowHelper.callFunction("get_current_borrow_info", { account_id: accountId })
                for (const b of borrowInfos) {
                    await db.NaiVault.updateOne(
                        { ownerId: b.owner_id, tokenId: b.token_id },
                        {
                            $set: {
                                ownerId: b.owner_id,
                                tokenId: b.token_id,
                                decimals: b.decimals,
                                deposited: b.deposited,
                                borrowed: b.borrowed,
                                lastDeposit: b.last_deposit,
                                lastBorrowed: b.last_borrowed,
                                currentCollateralRatio: b.current_collateral_ratio,
                                collateralRatio: b.collateral_ratio,
                                collateralTokenPrice: parseInt(b.collateral_token_price),
                                collateralTokenPriceDecimal: b.collateral_token_price_decimal,
                                collateralValue: b.collateral_value,
                                liquidationPrice: parseInt(b.liquidation_price.multiplier),
                                maxBorrowable: db.max_borrowable,
                                liquidationFee: b.liquidation_fee,
                                dustLimit: b.dust_limit,
                                lastUpdated: generalHelper.now()
                            }
                        },
                        { upsert: true, new: true }
                    )
                }
                await db.Account.updateOne(
                    { accountId: accountId },
                    { $set: { lastNAIUpdated: generalHelper.now() } },
                    { upsert: true, new: true }
                )
                break
            } catch (e) {
                console.log('error', e)
                await generalHelper.sleep(5 * 1000)
                trial--
                if (trial == 0) {
                    break
                }
            }
        }
    }
}

async function start() {
    let now = generalHelper.now()
    while (true) {
        let accountInfos = await db.Account.find({ lastNAIUpdated: { $lt: now - UPDATE_PERIOD } })
        let accounts = accountInfos.map(e => e.accountId)
        console.log('updating ', accounts.length, " accounts")
        //update all accounts
        //divide into batches
        let numBatch = Math.floor(accounts.length / NUM_ACCOUNT_PER_BATCH) + 1
        let functionCalls = []
        for (var i = 0; i < numBatch; i++) {
            let accountsForBatch = accounts.slice(i * NUM_ACCOUNT_PER_BATCH, (i + 1) * NUM_ACCOUNT_PER_BATCH)
            functionCalls.push(updateAccountList(accountsForBatch))
        }
        await Promise.all(functionCalls)

        console.log('waiting')
        await generalHelper.sleep(60 * 1000)
    }
}

start()