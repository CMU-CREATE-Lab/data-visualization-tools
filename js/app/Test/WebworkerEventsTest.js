define(["app/Class"], function(Class) {
  return Class({
    name: "WebworkerEventsTest",

    initialize: function () {
      app.worker.events.on({
        msg: function (e) {
         if (e.received) {
           app.worker.events.triggerEvent('msg', {value:e.value + 1});
         }
        }
      });
      app.worker.events.triggerEvent('boot', {});
    }
  });
});
