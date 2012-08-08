module.exports = {
    server: {
        port: process.env.PORT
    },

    mongodb: {
        connectionString: process.env.MONGOHQ_URL
    },

    monitor: {
            apiUrl: process.env.API_URL
    },

    autoStartMonitor: false
};
