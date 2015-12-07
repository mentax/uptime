/**
 * HipChat plugin for the uptime project - https://github.com/fzaninotto/uptime
 *
 * Thanks to:
 *  - DMathieu for the Campfire plugin - https://gist.github.com/dmathieu/5592418
 *  - xphyr for Pushover plugin - https://gist.github.com/xphyr/5994345
 *
 * This index.js files goes to a directory `plugins/victorops` in your installation of uptime.
 *
 * Notifies all events (up, down, paused, restarted) to HipChat.
 *
 * This plugin has a dependency on `node-hipchat`.
 * Add this to the "dependencies" object in your `package.json` file :
 *
 *   "node-spore":    "0.1.6"
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/victorops
 *
 * Example configuration:
 *
 *   victorops:
 *     endpoint: https://alert.victorops.com/integrations/generic/20131114/alert/1111111-1111-1111-1111-11111111/ # victorops rest endpoint
 */
var CheckEvent = require('../../models/checkEvent');
var spore = require('spore');
var fs         = require('fs');
var ejs        = require('ejs');
var async      = require('async');
var retry      = require('../helpers/retryProcedure');


exports.initWebApp = function(options) {

  console.log('Enabled VictorOps notifications');

  var config = options.config.victorops;
  var incident = spore.createClient({
    "base_url" : config.endpoint,
    "version" : "1.0",
    "methods" : {
      "create" : {
        "path" : "/:routeKey",
        "method" : "POST",
        "expected_status" : [200]
      }
    }
  });

	CheckEvent.on('afterInsert', function (checkEvent) {
		checkEvent.findCheck(function (err, check) {
      incidentDescriptionHandler = {
        down: function(check, checkEvent) {
          return {
            message_type:"CRITICAL",
            timestamp:checkEvent.timestamp,
            state_message:check.name + " failed",
            entity_id:check.name,
            url:check.url,
            cause: checkEvent.details
          };
        },
        up: function(check, checkEvent) {
          return {
            message_type:"RECOVERY",
            timestamp:checkEvent.timestamp,
            state_message:check.name + " came up again",
            url:check.url,
            entity_id:check.name
          };
        },
        paused: function(check, checkEvent) {
          return {
            message_type:"INFO",
            timestamp:checkEvent.timestamp,
            state_message:check.name + " was paused",
            url:check.url,
            entity_id:check.name
          };
        },
        restarted: function(check, checkEvent) {
          return {
            message_type:"INFO",
            timestamp:checkEvent.timestamp,
            state_message:check.name + " was restarted",
            url:check.url,
            entity_id:check.name
          };
        }
      };

      //declaring victorops call payload
      var incidentStatus = incidentDescriptionHandler[checkEvent.message](check, checkEvent);
      if (incidentStatus) {

        retry(function(cb){

          notifyVictorOps(incidentStatus, cb);

        });
      };

    });
	});

  //Call to victor ops with status change. Accepts a callback that receives a boolean information if the call was successful or not.
  function notifyVictorOps(incidentStatus, cb) {

    incident.create({
        routeKey: "none"
      },
      JSON.stringify(incidentStatus),
      function(err, result) {

        if(result && result.status === 200) {

          console.log('VictorOps: incident created');
          cb(true);
        }
        else {

          console.error('VictorOps: error creating incident: ' + JSON.stringify(result));
          cb(false);
        }
      });
  }
};
