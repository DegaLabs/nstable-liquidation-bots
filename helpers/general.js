const Helper = {
    sleep: async (time) => new Promise((resolve) => setTimeout(resolve, time)),
    now: () => {
        return Math.floor(Date.now() / 1000)
    }
}

module.exports = Helper