var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var moment   = require('moment');
var async    = require('async');
var fs       = require('fs');
var Check    = require('./check');


exports.checks = function(filename, pollerCollection) {
	  fs.readFile(filename, function(err, data) {
	    if (err)
	      throw err;

	    var checks = JSON.parse(data);
	    checks.forEach(function(check) {
	      var query = (check._id ? { _id: check._id } : { url: check.url })
	      Check.findOne(query, function(err, existing) {
	        if (err) return next(err);
	        if (!existing) existing = new Check();

	        existing.populateFromDirtyCheck(check, pollerCollection)
	        //app.emit('populateFromDirtyCheck', check, existing, check.type);

	        existing.save(function(err) {
	          if (err) return next(err);
	          console.log("Saved check %s.", existing.url);
	        });
	      });
	    });
	  });
	};