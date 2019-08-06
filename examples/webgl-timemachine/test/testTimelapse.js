// To run the test, webgl-timemachine/index.html and type
//
// $.getScript('test/testTimelapse.js').fail(console.log)

// Promise polyfill
!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n():"function"==typeof define&&define.amd?define(n):n()}(0,function(){"use strict";function e(){}function n(e){if(!(this instanceof n))throw new TypeError("Promises must be constructed via new");if("function"!=typeof e)throw new TypeError("not a function");this._state=0,this._handled=!1,this._value=undefined,this._deferreds=[],f(e,this)}function t(e,t){for(;3===e._state;)e=e._value;0!==e._state?(e._handled=!0,n._immediateFn(function(){var n=1===e._state?t.onFulfilled:t.onRejected;if(null!==n){var i;try{i=n(e._value)}catch(f){return void r(t.promise,f)}o(t.promise,i)}else(1===e._state?o:r)(t.promise,e._value)})):e._deferreds.push(t)}function o(e,t){try{if(t===e)throw new TypeError("A promise cannot be resolved with itself.");if(t&&("object"==typeof t||"function"==typeof t)){var o=t.then;if(t instanceof n)return e._state=3,e._value=t,void i(e);if("function"==typeof o)return void f(function(e,n){return function(){e.apply(n,arguments)}}(o,t),e)}e._state=1,e._value=t,i(e)}catch(u){r(e,u)}}function r(e,n){e._state=2,e._value=n,i(e)}function i(e){2===e._state&&0===e._deferreds.length&&n._immediateFn(function(){e._handled||n._unhandledRejectionFn(e._value)});for(var o=0,r=e._deferreds.length;r>o;o++)t(e,e._deferreds[o]);e._deferreds=null}function f(e,n){var t=!1;try{e(function(e){t||(t=!0,o(n,e))},function(e){t||(t=!0,r(n,e))})}catch(i){if(t)return;t=!0,r(n,i)}}var u=setTimeout;n.prototype["catch"]=function(e){return this.then(null,e)},n.prototype.then=function(n,o){var r=new this.constructor(e);return t(this,new function(e,n,t){this.onFulfilled="function"==typeof e?e:null,this.onRejected="function"==typeof n?n:null,this.promise=t}(n,o,r)),r},n.prototype["finally"]=function(e){var n=this.constructor;return this.then(function(t){return n.resolve(e()).then(function(){return t})},function(t){return n.resolve(e()).then(function(){return n.reject(t)})})},n.all=function(e){return new n(function(n,t){function o(e,f){try{if(f&&("object"==typeof f||"function"==typeof f)){var u=f.then;if("function"==typeof u)return void u.call(f,function(n){o(e,n)},t)}r[e]=f,0==--i&&n(r)}catch(c){t(c)}}if(!e||"undefined"==typeof e.length)throw new TypeError("Promise.all accepts an array");var r=Array.prototype.slice.call(e);if(0===r.length)return n([]);for(var i=r.length,f=0;r.length>f;f++)o(f,r[f])})},n.resolve=function(e){return e&&"object"==typeof e&&e.constructor===n?e:new n(function(n){n(e)})},n.reject=function(e){return new n(function(n,t){t(e)})},n.race=function(e){return new n(function(n,t){for(var o=0,r=e.length;r>o;o++)e[o].then(n,t)})},n._immediateFn="function"==typeof setImmediate&&function(e){setImmediate(e)}||function(e){u(e,0)},n._unhandledRejectionFn=function(e){void 0!==console&&console&&console.warn("Possible Unhandled Promise Rejection:",e)};var c=function(){if("undefined"!=typeof self)return self;if("undefined"!=typeof window)return window;if(void 0!==c)return c;throw Error("unable to locate global object")}();c.Promise||(c.Promise=n)});
//  

function testEquals(a, b) {
  if (a == b) {
    console.log('  Success, ' + a + ' == ' + b);
  } else {
    var msg = '  TEST FAILURE: ' + a + ' != ' + b;
    console.log(msg);
    throw Error(msg);
  }
}

function testApproxEquals(a, b, epsilon) {
  if (Math.abs(a - b) <= epsilon) {
    console.log('  Success, ' + a + ' == ' + b + ' (+/-' + epsilon + ')');
  } else {
    var msg = '  TEST FAILURE: ' + a + ' != ' + b + ' (+/-' + epsilon + ')';
    console.log(msg);
    throw Error(msg);
  }
}

function promiseSleep(ms) {
  return new Promise(function(resolve) {setTimeout(resolve, ms);});
}

function waitForCompletelyDrawn(minimum_frameno) {
  if (!minimum_frameno) minimum_frameno = timelapse.frameno + 2;
  return new Promise(function(resolve, reject) {
    if (timelapse.lastFrameCompletelyDrawn && timelapse.frameno >= minimum_frameno) {
      resolve();
    } else {
      promiseSleep(50).then(function() {waitForCompletelyDrawn(minimum_frameno).then(resolve, reject)});
    }
  });
}

function setHashAndWait(hash) {
  return new Promise(function(resolve, reject) {
    document.location.hash = hash;
    timelapse.lastFrameCompletelyDrawn = false;
    // The extra sleep of 500 is a hack to help make sure the new captureTimes have loaded;  waiting for lastFrameCompletelyDrawn isn't enough
    // It would be good to have a reliable way of knowing when layer metadata has been loaded, or to prevent the layer from reporting lastFrameCompletelyDrawn if metadata isn't loaded.
    promiseSleep(500).then(waitForCompletelyDrawn).then(resolve, reject);
  });
}

function testShareDatePlaybackTime(shareDate, playbackTime) {
  testApproxEquals(timelapse.playbackTimeFromShareDate(shareDate), playbackTime, 1e-6);
}
    
function testShareDateCaptureTime(shareDate, captureDate) {
  timelapse.pause();
  timelapse.seek(timelapse.playbackTimeFromShareDate(shareDate));
  testEquals(timelapse.getCurrentCaptureTime(), captureDate);
}

  

function testSanitizedParseTimeGMT() {
  return new Promise(function(resolve, reject) {
    console.log('testSanitizedParseTimeGMT start');
    testEquals(timelapse.sanitizedParseTimeGMT('1971-01-01'), 365 * 86400000);
    testEquals(timelapse.sanitizedParseTimeGMT('1971-01-01 00:00:00'), 365 * 86400000);
    testEquals(timelapse.sanitizedParseTimeGMT('1971-01-01 00:00:03'), 365 * 86400000 + 3 * 1000);
    testEquals(timelapse.sanitizedParseTimeGMT('1971-01-01 00:04:00'), 365 * 86400000 + 4 * 60000);
    testEquals(timelapse.sanitizedParseTimeGMT('1971-01-01 05:00:00'), 365 * 86400000 + 5 * 3600000);
    testEquals(timelapse.sanitizedParseTimeGMT('1971-01-02'), 366 * 86400000);
    console.log('testSanitizedParseTimeGMT complete');
    resolve();
  });
}
    
function testTimeLandsat() {
  return new Promise(function(resolve, reject) {
    console.log('testTimeLandsat start');
    setHashAndWait('#l=blsat').then(function() {
      testShareDatePlaybackTime('19840101', 0);
      testShareDatePlaybackTime('19850101', 0.1);
      testShareDatePlaybackTime('19840102', 0.1 * 1/366);
      testShareDatePlaybackTime('19841231', 0.1 * 365/366);
      testShareDateCaptureTime('20140101', '2014');
      testShareDateCaptureTime('20140201', '2014');
      testShareDateCaptureTime('20140301', '2014');
      testShareDateCaptureTime('20140501', '2014');
      testShareDateCaptureTime('20140601', '2014');
      testShareDateCaptureTime('20140701', '2014');
      console.log('testTimeLandsat complete');
      resolve();
    });
  });
}

function testTimeViirs() {
  return new Promise(function(resolve, reject) {
    console.log('testTimeViirs start');
    setHashAndWait('#l=viirs').then(function() {
      testShareDateCaptureTime('20140923', '2014-09-23');
      testShareDateCaptureTime('20140924', '2014-09-24');
      testShareDateCaptureTime('20140925', '2014-09-25');
      testShareDateCaptureTime('20150101', '2015-01-01');
      testShareDateCaptureTime('20150601', '2015-06-01');
      testShareDateCaptureTime('20151231', '2015-12-31');
      console.log('testTimeViirs complete');
    });
  });
}

function testTimeH8() {
  return new Promise(function(resolve, reject) {
    console.log('testTimeH8 start');
    setHashAndWait('#l=h8_16').then(function() {
      testShareDatePlaybackTime('20151101', 0);
      testShareDatePlaybackTime('20151101000000', 0);
      testShareDatePlaybackTime('20151102', 142 / 12);
      testShareDatePlaybackTime('20151102000000', 142 / 12);
      testShareDatePlaybackTime('20151101001000', 1 / 12);
      testShareDatePlaybackTime('20151101002000', 2 / 12);
      testShareDatePlaybackTime('20151101003000', 3 / 12);
      testShareDateCaptureTime('20151101', '2015-11-01 00:00:00 UTC');
      testShareDateCaptureTime('20151101000000', '2015-11-01 00:00:00 UTC');
      testShareDateCaptureTime('20151105121000', '2015-11-05 12:10:00 UTC');
      testShareDateCaptureTime('20151110184000', '2015-11-10 18:40:00 UTC');
      console.log('testTimeH8 complete');
    });
  });
}

function testAll() {
  testSanitizedParseTimeGMT().then(
    testTimeLandsat
  ).then(
    testTimeH8
  ).then(
    testTimeViirs
  );
}

testAll();

      

      
      
      
      
    
    
