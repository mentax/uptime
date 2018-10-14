/**
 * Basic Authentication plugin
 *
 * Add HTTP Basic Access Authentication to the dashboard and API applications
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry 
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/basicAuth
 *
 * Usage
 * -----
 * Restart the application, and both the API and the Dashboard applications 
 * become protected. The monitor correctly authenticates its own calls to the API.
 * 
 * Default credentials are admin:password.
 *
 * Configuration
 * -------------
 * Set the username and password in the configuration file, under the
 * basicAuth key:
 *
 *   // in config/production.yaml
 *   basicAuth:
 *     username: JohnDoe
 *     password: S3cR3t
 */
var express = require('express');

// from https://github.com/expressjs/express/issues/1991
/**
 * Simple basic auth middleware for use with Express 4.x.
 *
 * @example
 * app.use('/api-requiring-auth', utils.basicAuth('username', 'password'));
 *
 * @param   {string}   username Expected username
 * @param   {string}   password Expected password
 * @returns {function} Express 4 middleware requiring the given credentials
 */
basicAuth = function(username, password) {
  return function(req, res, next) {
    var user = basicAuth(req);

    if (!user || user.name !== username || user.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      return res.send(401);
    }

    next();
  };
};

exports.initWebApp = function(options) {
  var config = options.config.basicAuth;
  options.app.on('beforeFirstRoute', function(app, dashboardApp) {
    app.use(basicAuth(config.username, config.password));
  });
};

exports.initMonitor = function(options) {
  var config = options.config.basicAuth;
  options.monitor.addApiHttpOption('auth',  config.username + ':' + config.password);
};
