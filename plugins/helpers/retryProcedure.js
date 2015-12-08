var async = require('async');

/**
 * This function defines how many times a given operation is performed and with what delay. It is set to 3 times with increasing 10sec delay.
 * @param {function} [notify3rdParty] - Function that asynchronously performs a while loop to make a proper call to a 3rd party service. It receives a callback function that must be passed inside your function for asynchronous operation.
 */
function retryProcedure(notify3rdParty){

  var success = false;
  var counter = 0;
  var time = 0;

  async.whilst(
    function () { return counter < 3; },
    function (cb){

      counter++;
      //console.log('Attempt number: ' + counter);
      setTimeout(function() {

        notify3rdParty(function(result) {

          success = result;
          if (success) return;

          time+=10000;

          cb();
        });
      }, time);
    },
    function (err) { err && console.log(err); }
  );
}

module.exports = retryProcedure;
