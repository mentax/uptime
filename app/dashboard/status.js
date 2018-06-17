/**
 * Module dependencies.
 */
var express = require('express');
var errorHandler = require('express-error-handler');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var moment = require('moment');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var moduleInfo = require('../../package.json');

var app = module.exports = express();

// middleware
app.use(partials());
app.use(flash());
app.use(function locals(req, res, next) {
  res.locals.route = req.baseUrl;
  res.locals.addedCss = [];
  res.locals.renderCssTags = function (all) {
    if (all != undefined) {
      return all.map(function(css) {
        return '<link rel="stylesheet" href="' + req.baseUrl + '/stylesheets/' + css + '">';
      }).join('\n ');
    } else {
      return '';
    }
  };
  res.locals.moment = moment;
  next();
});
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

if (app.get('env') === 'development') {
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
}

if (app.get('env') === 'production') {
  app.use(errorHandler());
}

app.locals.version = moduleInfo.version

// Routes

app.get('/status', function(req, res, next) {
  res.send("OK");
});

app.get('/status/:tag', function(req, res, next) {
  Check.find({ tags: req.params.tag} ).sort({ isUp: 1, lastChanged: -1 }).exec(function(err, checks) {
    if (err) return next(err);
    res.render('status', { layout: "status_layout.ejs", info: req.flash('info'), checks: checks, tag: req.params.tag });
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
