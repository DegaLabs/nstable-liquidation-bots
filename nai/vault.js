const nearHelper = require('../helpers/near');
const config = require('config')
const accountConfig = nearHelper.getAccountConfig()
let liquidator = accountConfig.liquidator
const { transactions } = require("near-api-js");

let borrowHelper = require('./borrow_info')
let generalHelper = require('../helpers/general')
let db = require('../models')

const NUM_ACCOUNT_PER_BATCH = 50;
const UPDATE_PERIOD = 300;

async function checkOrLiquidate(b) {
    let l = await borrowHelper.computeNAIAmountForLiquidation(b)
    if (l != '0') {
        let account = await nearHelper.connectAccount(liquidator)
        await account.signAndSendTransaction({
            receiverId: nearHelper.vaultContract(),
            actions: [
                transactions.functionCall("liquidate", Buffer.from(JSON.stringify({ account_id: b.owner_id, collateral_token_id: b.token_id, nai_amount: `${l}` })), 100000000000000, "100000000000000000000000")
            ],
        })
    }
}

async function updateAccountsData(accountIds) {
    for (const accountId of accountIds) {
        let trial = 20
        while (true) {
            try {
                let borrowInfos = await nearHelper.callFunction("get_current_borrow_info", { account_id: accountId })
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
                    await checkOrLiquidate(b)
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

async function updateAccountIndex() {
    //update account list
    let setting = await db.Setting.findOne({})
    let lastNAIAccountIndex = 0
    if (setting) {
        lastNAIAccountIndex = setting.lastNAIAccountIndex ? setting.lastNAIAccountIndex : lastNAIAccountIndex
    }

    let trial = 20
    while (true) {
        try {
            let l = await nearHelper.callFunction("get_account_list", { from_index: lastNAIAccountIndex, limit: 500 })
            for (const acc of l) {
                await db.Account.updateOne(
                    { accountId: acc },
                    {
                        $set: { accountId: acc, lastNAIUpdated: 0 }
                    },
                    { upsert: true, new: true }
                )
            }
            lastNAIAccountIndex += l.length
            if (l.length < 500) break
        } catch (e) {
            console.log('error', e)
            await generalHelper.sleep(5 * 1000)
            trial--
            if (trial == 0) {
                break
            }
        }
    }

    await db.Setting.updateOne(
        {},
        {
            $set: { lastNAIAccountIndex: lastNAIAccountIndex }
        },
        { upsert: true, new: true }
    )
}

async function start() {
    while (true) {
        let now = generalHelper.now()
        await updateAccountIndex()

        let accountInfos = await db.Account.find({ lastNAIUpdated: { $lt: now - UPDATE_PERIOD } })
        let accounts = accountInfos.map(e => e.accountId)
        console.log('updating ', accounts.length, " accounts")
        //update all accounts
        //divide into batches
        let numBatch = Math.floor(accounts.length / NUM_ACCOUNT_PER_BATCH) + 1
        let functionCalls = []
        for (var i = 0; i < numBatch; i++) {
            let accountsForBatch = accounts.slice(i * NUM_ACCOUNT_PER_BATCH, (i + 1) * NUM_ACCOUNT_PER_BATCH)
            functionCalls.push(updateAccountsData(accountsForBatch))
        }

        await Promise.all(functionCalls)

        //checking if any accounts liquidable
        await db.NaiVault.find({})

        console.log('waiting')
        await generalHelper.sleep(300 * 1000)
    }
}

start()