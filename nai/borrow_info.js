const BigNumber = require('bignumber.js')
const Helper = {
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

        console.log('liquidated amount', ts/ms, borrowInfo.owner_id, borrowInfo.token_id)   
        let liquidated_nai = (p * (10000 - borrowInfo.liquidation_fee) / 10000) * ts/ms
        liquidated_nai = Math.floor(liquidated_nai)

        if (liquidated_nai < 50) {
            return '0'
        }

        console.log('liquidated nai', liquidated_nai)   
        return new BigNumber('1e18').multipliedBy(liquidated_nai).toFixed(0)
    }
}

module.exports = Helper