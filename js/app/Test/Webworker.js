define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Webworker"], function(Class, QUnit, BaseTest, Webworker) {
  return Class(BaseTest, {
    name: "Webworker",

/*
    "Send events to/from worker": function (cb) {
      QUnit.expect(2);

      var w = new Webworker({mainModule: "app/Test/WebworkerEventsTest"});

      w.events.on({
        boot: function (e) {
          w.events.triggerEvent("msg", {value:4711});
        },
        msg: function (e) {
          if (!e.received) {
            QUnit.ok(true, "Message sent");
            return;
          } else {
            QUnit.equal(e.value, 4712, "Value got passed around properly");
            cb();
          }
        }
      });
    },
*/
    "Transfer datasets": function (cb) {
      QUnit.expect(2);

      var w = new Webworker({mainModule: "app/Test/WebworkerDatasetTest"});

      w.addDataset("mydata");
      /* Request twice just to make sure the counter works... */
      w.withDataset("mydata", function (dataset, cb) {
        w.withDataset("mydata", function (dataset, cb) {
          var intarr = new Int32Array(4711);
          dataset.intarr = intarr.buffer;
          for (var i = 0; i < 4711; i++) intarr[i] = i + 5;
          cb();
        }, cb);
      });

      w.events.on({
        boot: function (e) {
          w.events.triggerEvent("msg", {value:4711});
        },
        msg: function (e) {
          if (!e.received) {
            QUnit.ok(true, "Message sent");
            return;
          } else {
            w.withDataset("mydata", function (dataset, cb) {
              QUnit.equal(new Int32Array(dataset.intarr)[0], 7, "Value got passed around properly");
              cb();
            }, cb);
          }
        }
      });
    }
  });
});
