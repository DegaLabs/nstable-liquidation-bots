const mongoose = require('mongoose')
const Schema = mongoose.Schema

const NaiVault = new Schema({
    ownerId: { type: String, index: true },
    tokenId: { type: String, index: true },
    decimals: Number,
    deposited: String,
    borrowed: String,
    lastDeposit: String,
    lastBorrowed: String,
    currentCollateralRatio: Number,
    collateralRatio: Number,
    collateralTokenPrice: Number,
    collateralTokenPriceDecimal: Number,
    collateralValue: String,
    liquidationPrice: Number,
    maxBorrowable: String,
    liquidationFee: Number,
    dustLimit: String,
    lastUpdated: Number
}, { timestamps: false, v: false })

module.exports = mongoose.model('NaiVault', NaiVault)
