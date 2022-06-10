const { connect, transactions, keyStores } = require("near-api-js");
const fs = require("fs");
const path = require("path");
const homedir = require("os").homedir();
const config = require("config")
const CREDENTIALS_DIR = ".near-credentials";

let credentialsPath = path.join(homedir, CREDENTIALS_DIR);
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);

const NEAR = {
    getNearModule: async () => {
        let networkConfig = NEAR.getConfig()
        return await connect({ ...networkConfig, keyStore });
    },
    connectAccount: async (accountId) => {
        let near = await NEAR.getNearModule();
        return await near.account(accountId);
    },
    getConfig: () => {
        let network = NEAR.getNetwork()
        return {
            keyStore,
            networkId: network,
            nodeUrl: `https://rpc.${network}.near.org`,
        };
    },
    getNetwork: () => {
        return config.network
    },
    accountViewFunction: async (methodName, args, account) => {
        return await account.viewFunction(NEAR.vaultContract(), methodName, args);
    },
    vaultContract: () => {
        return config[config.network].vaultContract
    },
    callFunction: async (methodName, args) => {
        let account = await NEAR.connectAccount(config.accountToConnect)
        let ret = await NEAR.accountViewFunction(methodName, args, account)
        return ret
    }
}

module.exports = NEAR
