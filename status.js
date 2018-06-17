/*
 * Monitor remote server uptime.
 */

var http       = require('http');
var url        = require('url');
var express    = require('express');
var errorHandler = require('express-error-handler');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var methodOverride = require('method-override');
var cookieSession = require('cookie-session');
var config     = require('config');
var socketIo   = require('socket.io');
var stdio      = require('stdio');
var fs         = require('fs');
var monitor    = require('./lib/monitor');
var analyzer   = require('./lib/analyzer');
var Seed       = require('./models/seed');
var CheckEvent = require('./models/checkEvent');
var Ping       = require('./models/ping');
var PollerCollection = require('./lib/pollers/pollerCollection');
var apiApp     = require('./app/api/app');
var dashboardApp = require('./app/dashboard/status');

// database

var mongoose   = require('./bootstrap');

var a = analyzer.createAnalyzer(config.analyzer);
a.start();

// web front

var app = module.exports = express();
var server = http.createServer(app);

// the following middlewares are only necessary for the mounted 'dashboard' app, 
// but express needs it on the parent app (?) and it therefore pollutes the api
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method
    delete req.body._method
    return method
  }
}))
app.use(cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4'));
app.use(cookieSession({
  key:    'uptime',
  secret: 'FZ5HEE5YHD3E566756234C45BY4DSFZ4',
  proxy:  true,
  cookie: { maxAge: 60 * 60 * 1000 }
}));
app.set('pollerCollection', new PollerCollection());

// load plugins (may add their own routes and middlewares)
config.plugins.forEach(function(pluginName) {
  var plugin = require(pluginName);
  if (typeof plugin.initWebApp !== 'function') return;
  console.log('loading plugin %s on app', pluginName);
  plugin.initWebApp({
    app:       app,
    api:       apiApp,       // mounted into app, but required for events
    dashboard: dashboardApp, // mounted into app, but required for events
    io:        io,
    config:    config,
    mongoose:  mongoose
  });
});

app.emit('beforeFirstRoute', app, apiApp);

if (app.get('env') === 'development') {
  if (config.verbose) mongoose.set('debug', true);
  app.use(express.static(__dirname + '/public'));
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
}

if (app.get('env') === 'production') {
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(errorHandler());
}

// Routes
app.emit('beforeApiRoutes', app, apiApp);
app.use('/api', apiApp);

app.emit('beforeDashboardRoutes', app, dashboardApp);
app.use('/dashboard', dashboardApp);
app.get('/', function(req, res) {
  res.redirect('/dashboard/status');
});

app.get('/favicon.ico', function(req, res) {
  res.redirect(301, '/dashboard/favicon.ico');
});

app.emit('afterLastRoute', app);

// Sockets
var io = socketIo.listen(server);

if (app.get('env') === 'production') {
  io.enable('browser client etag');
  // io.set('log level', 1);
}

if (app.get('env') === 'development') {
  // if (!config.verbose) io.set('log level', 1);
}

CheckEvent.on('afterInsert', function(event) {
  io.sockets.emit('CheckEvent', event.toJSON());
});

io.sockets.on('connection', function(socket) {
  socket.on('set check', function(check) {
    socket.set('check', check);
  });
  Ping.on('afterInsert', function(ping) {
    socket.get('check', function(err, check) {
      if (ping.check == check) {
        socket.emit('ping', ping);
      }
    });
  });
});

// old way to load plugins, kept for BC
fs.exists('./plugins/index.js', function(exists) {
  if (exists) {
    var pluginIndex = require('./plugins');
    var initFunction = pluginIndex.init || pluginIndex.initWebApp;
    if (typeof initFunction === 'function') {
      initFunction({
        app:       app,
        api:       apiApp,       // mounted into app, but required for events
        dashboard: dashboardApp, // mounted into app, but required for events
        io:        io,
        config:    config,
        mongoose:  mongoose
      });
    }
  }
});

module.exports = app;

var monitorInstance;

if (!module.parent) {
  var ops = stdio.getopt({
    'checks': {key: 'c', args: 1, description: 'Check seed file'}
  });

  if (ops.checks) {
    Seed.checks(ops.checks, app.get('pollerCollection'));
  }

  var serverUrl = url.parse(config.url);
  var port;
  if (config.server && config.server.port) {
    console.error('Warning: The server port setting is deprecated, please use the url setting instead');
    port = config.server.port;
  } else {
    port = serverUrl.port;
    if (port === null) {
      port = 1337;
    }
  }
  var port = process.env.PORT || port;
  var host = process.env.HOST || serverUrl.hostname;
  server.listen(port, function(){
    console.log("Express server listening on host %s, port %d in %s mode", host, port, app.settings.env);
  });
  server.on('error', function(e) {
    if (monitorInstance) {
      monitorInstance.stop();
      process.exit(1);
    }
  });
}

// monitor
if (config.autoStartMonitor) {
  monitorInstance = require('./monitor');
}
