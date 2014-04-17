define(["Class", "QUnit", "LangExtensions"], function(Class, QUnit) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.config.testTimeout = 10000;

      QUnit.init();
      QUnit.start();


      QUnit.module("Events");

      require(["Events"], function (Events) {
        QUnit.asyncTest("Scope and argument passing", function() {
          QUnit.expect(2);

          var e = new Events("Test.Events");
          var myscope = {};
          var myarg = {};

          e.on({
            someEvent: function (arg) {
              QUnit.equal(this, myscope, "Scope is set to the provided scope");
              QUnit.equal(arg, myarg, "Argument is set to the provided argument");
              start();
            },
            scope: myscope
          });
          e.triggerEvent("someEvent", myarg);
        });

        QUnit.asyncTest("Recursive events", function() {
          QUnit.expect(2);

          var e = new Events("Test.Events");

          e.on({
            firstEvent: function (arg) {
              QUnit.ok(true, "First event triggered");
              e.triggerEvent("secondEvent");
            },
            secondEvent: function (arg) {
              QUnit.ok(true, "Second event triggered");
              start();
            }
          });
          e.triggerEvent("firstEvent");
        });
      });

    }
  });
});
