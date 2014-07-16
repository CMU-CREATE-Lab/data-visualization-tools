define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Webworker"], function(Class, QUnit, BaseTest, Webworker) {
  return Class(BaseTest, {
    name: "Webworker",

    "Send events to/from worker": function (cb) {
      QUnit.expect(2);

      var w = new Webworker({main: "" +
        "(function () {" +
        "  app.worker.events.on({" +
        "    msg: function (e) {" +
        "      if (e.received) {" +
        "        app.worker.events.triggerEvent('msg', {value:e.value + 1});" +
        "      }" +
        "    }" +
        "  });" +
        "  app.worker.events.triggerEvent('boot', {});" +
        "})"
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
            QUnit.equal(e.value, 4712, "Value got passed around properly");
            cb();
          }
        }
      });
    }
  });
});
