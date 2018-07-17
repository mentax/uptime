/**
 * Webhooks plugin
 *
 * Notifies all events (up, down, paused, restarted) by sending a
 * HTTP POST request to the given URL. The request will have a
 * JSON payload of data from the event
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./webhooks').init();
 *   }
 *
 * Example configuration
 *   webhooks:
 *     event:
 *       up:
 *         - 'http://localhost:8082'
 *         - 'http://www.example.com/do/something'
 *       down:
 *         - 'http://www.example.com/warn/somebody'
 *       paused:
 *       restarted:
 *     dashboardUrl: 'http://localhost:8082'
 */

var http = require('http');
var url = require('url');
var util = require('util');
var fs = require('fs');
var ejs = require('ejs');
var CheckEvent = require('../../models/checkEvent');

var matchPattern = '^/(.*?)/(g?i?m?y?)$';
var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');

exports.initWebApp = function(options) {
  
    
    var dashboard = options.dashboard;

    dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
        
        // handle 'enabled' variable
        // determines if values should be added to loggr
        var enabled = dirtyCheck.enabled;
        if (enabled && enabled == "on") {
            checkDocument.setPollerParam('enabled', true);
        }
        else {
            checkDocument.setPollerParam('enabled', false);
        }

        // handle 'match' variable
        var match = dirtyCheck.match;
        if (match) {
            if (match.indexOf('/') === 0) {
                throw new Error('Please leave off leading and trailing slashes ' + dirtyCheck.match);
            }
            match = '/' + match + '/';
            var matchParts = match.match(new RegExp(matchPattern));
            try {
                // check that the regexp doesn't crash
                new RegExp(matchParts[1], matchParts[2]);
            } catch (e) {
                throw new Error('Malformed regular expression ' + dirtyCheck.match);
            }
        }
        checkDocument.setPollerParam('match', dirtyCheck.match);

        // handles 'kind' variable
        var kind = dirtyCheck.kind;
        if (kind) {
            if (kind != "rtime" && kind != "number" && kind != "text")
                throw new Error("Value Kind is not valid " + dirtyCheck.kind);
            checkDocument.setPollerParam('kind', dirtyCheck.kind);
        }
    });

    // add html to edit screen
    dashboard.on('checkEdit', function(type, check, partial) {
        if (type !== 'http' && type !== 'https') return;
        partial.push(ejs.render(template, { check }));
    });


    var config = options.config;

    CheckEvent.on('afterInsert', function(checkEvent) {
return;
        var webhooks = config.webhooks;
        var hrefs = webhooks.event[checkEvent.message];

        if (!util.isArray(hrefs)) return;
        checkEvent.findCheck(function(err, check) {
            var payload = {};
            if (err) return console.error(err);

            console.log("IN WEBHOOK: " + checkEvent.message);
            
            var url = "http://post.loggr.net/1/logs/testlog/events?apikey=8aa2f78930aa4930b6f0657b7fe070e9&text=site%20up&tags=up"
            
            var req = http.request(url, function(res) {

            });
            req.on('error', function(e) {
              console.log('Problem with webhook request: ' + e.message);
            });
            req.end();
        });
    });
};

exports.initMonitor = function(options) {

    options.monitor.on('pollerPolled', function(check, time, res, details) {
        
        var value = 0;
        var kind = check.pollerParams && check.pollerParams.kind;
        if (!kind || kind == "")
            kind = "number";
        if (kind == "text" || kind == "number") {
            var checkPattern = check.pollerParams && check.pollerParams.match;
            if (checkPattern) {
                //console.log("CHECK REGEX: " + checkPattern);
                try {
                    var regex = new RegExp(checkPattern);
                    var result = res.body.match(regex);
                    var value = result[1];
                }
                catch (e) {
                    value = "ERROR: " + e;
                }
            }
            else {
                value = res.body;
                if (value.length > 150)
                    value = value.substring(0, 150);
            }

            if (kind == "number") {
                // strip non-numeric
                value = value.replace(/\D/g, '');
                if (value == "")
                    value = 0;
            }
        }
        else {
            value = time;
        }

        // save value
        details.value = {
            value: value
        };
        trace("LOGGR-METRIC: '" + check.name + "' KIND=" + kind + ", VALUE=[" + value + "]");

        // should we post to loggr?
        var enabled = check.pollerParams.enabled;
        if (!enabled)
            return;

        var post_data = "apikey=35bd8dfe9aeb4212acb629e26da8469b&value=" + value;
        var post_options = {
            host: 'post.loggr.net',
            port: '80',
            path: '/1/logs/loggr/metrics/' + check.name,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': post_data.length
            }
        };
        // Set up the request
        var post_req = http.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
		        if (trim(chunk) != "") {
                    console.log('Response: ' + chunk);
                }
            });
        });

        // post the data
        post_req.write(post_data);
        post_req.end();
    });

};

function trace(message) {
    console.log(timestamp() + color(message, "blue"));
}

function trim (str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

// ANSI color code outputs for strings
var ANSI_CODES = {
  "off": 0,
  "bold": 1,
  "italic": 3,
  "underline": 4,
  "blink": 5,
  "inverse": 7,
  "hidden": 8,
  "black": 30,
  "red": 31,
  "green": 32,
  "yellow": 33,
  "blue": 34,
  "magenta": 35,
  "cyan": 36,
  "white": 37,
  "black_bg": 40,
  "red_bg": 41,
  "green_bg": 42,
  "yellow_bg": 43,
  "blue_bg": 44,
  "magenta_bg": 45,
  "cyan_bg": 46,
  "white_bg": 47
};

function color(str, color) {
  if(!color) return str;
  var color_attrs = color.split("+");
  var ansi_str = "";
  for (var i=0, attr; attr = color_attrs[i]; i++) {
    ansi_str += "\033[" + ANSI_CODES[attr] + "m";
  }
  ansi_str += str + "\033[" + ANSI_CODES["off"] + "m";
  return ansi_str;
}

function timestamp() {
  return color(new Date().toLocaleTimeString(), 'cyan') + ' ';
}
