const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Setting = new Schema({
    lastNAIAccountIndex: { type: Number},
}, { timestamps: false, v: false })

module.exports = mongoose.model('Setting', Setting)
