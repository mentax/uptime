var mongoose   = require('mongoose');
var config     = require('config');
var semver     = require('semver');

// configure mongodb
var connectWithRetry = function() {
  mongoose.connect(
    config.mongodb.connectionString || 'mongodb://' + config.mongodb.user + ':' + config.mongodb.password + '@' + config.mongodb.server +'/' + config.mongodb.database,
    { 
      auto_reconnect: true,
      poolSize: 100
    },
    function(err) {
      if (!err) {
        mongoose.connection.on('open', function (err) {
          mongoose.connection.on('error', function(err) {
            console.log("Mongo collection failed, trying to reconnect"); 
          });
          mongoose.connection.db.admin().serverStatus(function(err, data) {
            if (err) {
              if (err.name === "MongoError" && (err.errmsg === 'need to login' || err.errmsg === 'unauthorized') && !config.mongodb.connectionString) {
                console.log('Forcing MongoDB authentication');
                mongoose.connection.db.authenticate(config.mongodb.user, config.mongodb.password, function(err) {
                  if (!err) return;
                  console.error(err);
                  process.exit(1);
                });
                return;
              } else {
                console.error(err);
                process.exit(1);
              }
            }
            if (!semver.satisfies(data.version, '>=2.1.0')) {
              console.error('Error: Uptime requires MongoDB v2.1 minimum. The current MongoDB server uses only '+ data.version);
              process.exit(1);
            }
          });
        });
      }
    }
  ).catch(function (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to connect to mongo on startup - retrying in 5 sec');
    if (config.debug) {
      console.log(error)
    }
    setTimeout(connectWithRetry, 5000);
  });
};
connectWithRetry();

module.exports = mongoose;
