/**
 * Module dependencies.
 */
var express    = require('express');
var errorHandler = require('express-error-handler');
var Check      = require('../../models/check');
var CheckEvent = require('../../models/checkEvent');

var app = module.exports = express();

// middleware
if (app.get('env') === 'development' || app.get('env') === 'test') {
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
}

if (app.get('env') === 'production') {
  app.use(errorHandler());
}


// up count
var upCount;
var refreshUpCount = function(callback) {
  var count = { up: 0, down: 0, paused: 0, total: 0 };
  Check
  .find()
  .select({ isUp: 1, isPaused: 1 })
  .exec(function(err, checks) {
    if (err) return callback(err);
    checks.forEach(function(check) {
      count.total++;
      if (check.isPaused) {
        count.paused++;
      } else if (check.isUp) {
        count.up++;
      } else {
        count.down++;
      }
    });
    upCount = count;
    callback();
  });
};

Check.on('afterInsert', function() { upCount = undefined; });
Check.on('afterRemove', function() { upCount = undefined; });
CheckEvent.on('afterInsert', function() { upCount = undefined; });

app.get('/checks/count', function(req, res, next) {
  if (typeof upCount !== 'undefined') {
    res.json(upCount);
  } else {
    refreshUpCount(function(err) {
      if (err) return next(err);
      res.json(upCount);
    });
  }
});

// Routes

require('./routes/check')(app);
require('./routes/tag')(app);
require('./routes/ping')(app);

// route list
app.get('/', function(req, res) {
  var routes = [];
  for (var verb in app.routes) {
    app.routes[verb].forEach(function(route) {
      routes.push({method: verb.toUpperCase() , path: app.route + route.path});
    });
  }
  res.json(routes);
});

app.get('/status', function(req, res, next) {
  res.send("OK");
});

if (!module.parent) {
  app.listen(3001);
  console.log('Express started on port 3001');
}
