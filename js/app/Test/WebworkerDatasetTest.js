define(["app/Class"], function(Class) {
  return Class({
    name: "WebworkerDatasetTest",

    initialize: function () {
      app.worker.events.on({
        msg: function (e) {
          if (e.received) {
            app.worker.withDataset("mydata", function (dataset, cb) {
              dataset.intarr[0] += 2;
              app.worker.events.triggerEvent('msg', {});
              cb();
            });
          }
        }
      });
      app.worker.events.triggerEvent('boot', {});
    }
  });
});
