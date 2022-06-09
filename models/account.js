const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Account = new Schema({
    accountId: { type: String, unique: true },
    lastNAIUpdated: Number
}, { timestamps: false, v: false })

module.exports = mongoose.model('Account', Account)
