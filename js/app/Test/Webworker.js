define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Webworker"], function(Class, QUnit, BaseTest, Webworker) {
  return Class(BaseTest, {
    name: "Webworker",
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

    "Transfer datasets": function (cb) {
      QUnit.expect(2);

      var w = new Webworker({mainModule: "app/Test/WebworkerDatasetTest"});

      w.addDataset("mydata");
      // Request twice just to make sure the counter works...
      w.withDataset("mydata", function (dataset, cb) {
        w.withDataset("mydata", function (dataset, cb) {
          dataset.intarr = new Int32Array(4711);
          for (var i = 0; i < 4711; i++) dataset.intarr[i] = i + 5;
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
              QUnit.equal(dataset.intarr[0], 7, "Value got passed around properly");
              cb();
            }, cb);
          }
        }
      });
    },

    "Proxy objects": function (cb) {
      QUnit.expect(1);

      var w = new Webworker({mainModule: "app/Test/WebworkerProxyObjectTest"});

      w.events.on({
        'main-loaded': function (e) {
          e.main.call(
            'foo',
            function (err, obj) {

              obj.call(
                'bar',
                4711,
                function (err, a) {
                  QUnit.equal(a, 4713, "Value got passed around properly");
                  cb();
                }
              );
            }
          );
        }
      });
    },

    "Proxy object events": function (cb) {
      QUnit.expect(1);

      var w = new Webworker({mainModule: "app/Test/WebworkerProxyObjectEventsTest"});

      w.events.on({
        'main-loaded': function (e) {
          e.main.events.on({
            foo: function (e) {
               QUnit.equal(e.value, 4711, "Value got passed around properly");
               cb();
            }
          });
          e.main.call('foo', function () {});
        }
      });
    }
  });
});
