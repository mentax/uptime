/**
 * Module dependencies.
 */

var Check      = require('../../../models/check');
var CheckEvent = require('../../../models/checkEvent');
var Ping       = require('../../../models/ping');

/**
 * Check Routes
 */
module.exports = function(app) {

  // support 'check' and 'page' arguments in query string
  app.get('/pings', function(req, res, next) {
    var query = {};
    if (req.query.check) {
      query.check = req.query.check;
    }
    Ping
    .find(query)
    .sort({ timestamp: -1 })
    .limit(50)
    .skip((req.param('page', 1) - 1) * 50)
    .exec(function(err, pings) {
      if (err) return next(err);
      res.json(pings);
    });
  });

  app.get('/pings/events', function(req, res, next) {
    var query = { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };

    if (req.query.tag) {
      query.tags = [req.query.tag];
    }

    CheckEvent
    .find(query)
    .sort({ timestamp: -1 })
    .select({ tags: 0 })
    .limit(100)
    .exec(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

  app.post('/pings', function(req, res) {
    Check.findById(req.body.checkId, function(err1, check) {
      if (err1) {
        return res.send(err1.message, 500);
      }
      if (!check) {
        return res.send('Error: No existing check with id ' + req.body.checkId, 403);
      }
      if (!check.needsPoll) {
        return res.send('Error: This check was already polled. No ping was created', 403);
      }

      var status = req.body.status === 'true';

      Ping.createForCheck({
        status,
        statusCode:req.body.statusCode,
        timestamp: req.body.timestamp,
        time: req.body.time,
        check,
        monitorName: req.body.name,
        error: req.body.error, 
        errorCode: req.body.errorCode, 
        details: req.body.details,
        callback: function(err2, ping) {
          if (err2) {
            return res.status(500).send(err2.message);
          }
          res.json(ping);
        }
      });
    });
  });

};
