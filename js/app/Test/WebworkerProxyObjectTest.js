define(["app/Class"], function(Class) {
  var WorkerObj = Class({
    name: "WorkerObj",

    foo: function (a) {
      return a + 2;
    }
  });

  return Class({
    name: "WebworkerProxyObjectTest",

    initialize: function () {
      app.worker.events.triggerEvent('boot', {value: new WorkerObj()});
    }
  });
});
