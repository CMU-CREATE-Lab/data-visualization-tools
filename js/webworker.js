(function () {
  var handler = function(e) {
    self.removeEventListener('message', handler, false);
    app = e.data;
    app.main = eval(app.main);
    self.importScripts("deps.js");
  };
  self.addEventListener('message', handler, false);
})()
