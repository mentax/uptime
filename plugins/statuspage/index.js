/**
 * StatusPage plugin for the uptime project - https://github.com/fzaninotto/uptime
 * *
 * This index.js file goes to a directory `plugins/statuspage` in your installation of uptime.
 *
 * Notifies all events (up, down) to StatusPage.
 *
 * To enable the plugin, add the following line to the plugins section of your config default.yml file
 * plugins:
 *  - ./plugins/statuspage
 *
 * Example configuration:
 *
 *   statuspage:
 *     endpoint: https://api.statuspage.io/v1/pages
 *     pageid: page_id
 *     apiKey: 588ff11a49722aef041f74005d657647
 *
 * Example curl to get all components: curl https://api.statuspage.io/v1/pages/2jzl9rbhcvzm/components.json -H 'Authorization: OAuth fa10491960d2fa26cfd823fae332026a2a4df19996505a119677874ab3e30a83'
 */
var CheckEvent = require('../../models/checkEvent');
var spore      = require('spore');
var fs         = require('fs');
var ejs        = require('ejs');
var async      = require('async');
var retry      = require('../helpers/retryProcedure');
var config = require('config').statuspage;

var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');


exports.initWebApp = function(options) {
  if (typeof config === 'undefined') {
    console.log('\x1b[33m%s\x1b[0m', 'StatusPage configuration missing, plugin not initialized.');
		return false;
	}

  var status = spore.createClient({
    'base_url' : config.endpoint,
    'methods' : {
      'availability' : {
        'path' : '/' + config.pageid + '/components/:serviceId'+'.json',
        'method' : 'PATCH',
        'headers' : {'Authorization': 'OAuth '+config.apiKey,
                      'Content-Type': 'application/x-www-form-urlencoded'}
      }
    }
  });

  var dashboard = options.dashboard;
  //responsible for persistance
  dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
    checkDocument.setPollerParam('statusPageId', dirtyCheck.statusPageId);
  });

  //responsible to display check edit page with our view and a proper value
  dashboard.on('checkEdit', function(type, check, partial) {
    check.setPollerParam('statusPageId', check.getPollerParam('statusPageId'));
    partial.push(ejs.render(template, {
      check
    }));
  });

  CheckEvent.on('afterInsert', function (checkEvent) {
    checkEvent.findCheck(function (err, check) {
      componentStatusHandler = {
        down: function(check, checkEvent) {
          return 'component[status]=major_outage';
        },
        up: function(check, checkEvent) {
          return 'component[status]=operational';
        }
      };

      //we should react only on up and down message, and only if check has a status id provided
      var statusId = check.getPollerParam('statusPageId');
      if (!statusId) return;

      //declaring status message required by Status Page api
      var statusChange = componentStatusHandler[checkEvent.message](check, checkEvent);

      //firing call to statuspage
      if (checkEvent.message === 'up' || checkEvent.message === 'down'){

        retry(function(cb){

          notifyStatusPage(statusId, statusChange, cb);

        });
      }

    });
  });

  //Call to statuspage with status change. Accepts a callback that receives a boolean information if the call was successful or not.
  function notifyStatusPage(statusId, statusChange, cb){

    status.availability(
      {
        serviceId: statusId
      },
      statusChange,
      function(err, result) {

        if(result && result.status === 200) {

          console.log('StatusPage: component ' + statusId + ' status changed');
          cb(true);
        }
        else {

          console.error('StatusPage: error changing component ' + statusId + ' status. Response: ' + JSON.stringify(result));
          cb(false);
        }
      }
    );
  }

  console.log('Enabled StatusPage notifications');
};
