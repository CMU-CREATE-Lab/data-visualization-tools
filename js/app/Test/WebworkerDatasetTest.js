define(["app/Class"], function(Class) {
  return Class({
    name: "WebworkerDatasetTest",

    initialize: function () {
      app.worker.events.on({
        msg: function (e) {
          if (e.received) {
            app.worker.withDataset("mydata", function (dataset, cb) {
              new Int32Array(dataset.intarr)[0] += 2;
              app.worker.events.triggerEvent('msg', {value:e.value + 1});
              cb();
            });
          }
        }
      });
      app.worker.events.triggerEvent('boot', {});
    }
  });
});
