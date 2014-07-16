/* Usage:
 *
 * w = new Worker("/viirs/js/webworker.js")
 * w.postMessage({useDojo: false, main:"(function () { require(['app/Class'], function (Class) { console.log('hello'); }); })"})
 */
(function () {
  var handler = function(e) {
    self.removeEventListener('message', handler, false);
    app = e.data;
    app.worker = self;
    if (app.main) app.main = eval(app.main);
    self.importScripts("deps.js");
  };
  self.addEventListener('message', handler, false);
})()
