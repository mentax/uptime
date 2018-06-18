/**
 * HipChat plugin for the uptime project - https://github.com/fzaninotto/uptime
 *
 * Thanks to:
 *  - DMathieu for the Campfire plugin - https://gist.github.com/dmathieu/5592418
 *  - xphyr for Pushover plugin - https://gist.github.com/xphyr/5994345
 *
 * This index.js files goes to a directory `plugins/hipchat` in your installation of uptime.
 *
 * Notifies all events (up, down, paused, restarted) to HipChat.
 *
 * This plugin has a dependency on `node-hipchat`.
 * Add this to the "dependencies" object in your `package.json` file :
 *
 *   "node-hipchat":    "0.4.4"
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/hipchat
 *
 * Example configuration:
 *
 *   hipchat:
 *     apiKey: 123456789012345678901234567890 # HipChat Admin API Key https://www.hipchat.com/admin/api
 *     tag:
 *       tag1: 123456  # tag name : HipChat room ID where send notification
 *       tag2: 987654  # tag name : HipChat room ID where send notification
 */
var CheckEvent = require('../../models/checkEvent');
var hipchat = require("node-hipchat");
var config = require('config').hipchat;

exports.initWebApp = function () {
	if (typeof config === 'undefined') {
		console.log('\x1b[33m%s\x1b[0m', 'Hipchat configuration missing, plugin not initialized.');
		return false;
	}
	var HC = new hipchat(config.apiKey);

	function message(roomId, name, event) {
		return {
			room_id: roomId,
			from: 'Uptime',
			message: 'The application ' + name + ' just went to status ' + event + '.',
			color: color(event)
		};
	}

	function color(event) {
		switch (event) {
			case 'up':
				return 'green';
			case 'down':
				return 'red';
			case 'paused':
				return 'gray';
			case 'restarted':
				return 'purple';
			default:
				return 'random';
		}
	}

	CheckEvent.on('afterInsert', function (checkEvent) {

		checkEvent.findCheck(function (err, check) {
			if (err) {
				return console.error('HipChat notifications' + err);
			}

			check.tags.forEach(function (tag) {
				var roomId = config.tag[tag];
				if (roomId) {
					HC.postMessage(message(roomId, check.name, checkEvent.message), function (data, err) {
						if (err) {
							return console.error('HipChat notifications' + JSON.stringify(error));
						}
						console.log('HipChat notifications' + JSON.stringify(data));
					})
				}
			});
		});
	});

	console.log('Enabled HipChat notifications');
};
