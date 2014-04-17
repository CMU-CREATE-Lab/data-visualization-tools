define(["Class", "QUnit", "LangExtensions"], function(Class, QUnit) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.config.testTimeout = 10000;

      QUnit.init();
      QUnit.start();


      QUnit.module("Events");

      QUnit.asyncTest("Scope and argument passing", function() {
        require(["Events"], function (Events) {
          QUnit.expect(3);

          var e = new Events("Test.Events");
          var myscope = {};
          var myarg = {};

          e.on({
            someEvent: function (arg) {
              QUnit.equal(this, myscope, "Scope isn't set to the provided scope");
              QUnit.equal(arg, myarg, "Argument isn't set to the provided argument");
              QUnit.ok(true, "Events triggered as they should");
              start();
            },
            scope: myscope
          });
          e.triggerEvent("someEvent", myarg);
        });
      });

      QUnit.asyncTest("Recursive events", function() {
        require(["Events"], function (Events) {
          QUnit.expect(1);

          var e = new Events("Test.Events");

          e.on({
            firstEvent: function (arg) {
              e.triggerEvent("secondEvent");
            },
            secondEvent: function (arg) {
              QUnit.ok(true, "Events triggered as they should");
              start();
            }
          });
          e.triggerEvent("firstEvent");
        });
      });

    }
  });
});
