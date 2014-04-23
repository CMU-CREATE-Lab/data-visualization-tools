define(["Class", "QUnit", "Test/BaseTest", "Events"], function(Class, QUnit, BaseTest, Events) {
  return Class(BaseTest, {
    name: "Events",

    "Scope and argument passing": function (cb) {
      QUnit.expect(2);

      var e = new Events("Test.Events");
      var myscope = {};
      var myarg = {};

      e.on({
        someEvent: function (arg) {
          QUnit.equal(this, myscope, "Scope is set to the provided scope");
          QUnit.equal(arg, myarg, "Argument is set to the provided argument");
          cb();
        },
        scope: myscope
      });
      e.triggerEvent("someEvent", myarg);
    },

    "Recursive events": function (cb) {
      QUnit.expect(2);

      var e = new Events("Test.Events");

      e.on({
        firstEvent: function (arg) {
          QUnit.ok(true, "First event triggered");
          e.triggerEvent("secondEvent");
        },
        secondEvent: function (arg) {
          QUnit.ok(true, "Second event triggered");
          cb();
        }
      });
      e.triggerEvent("firstEvent");
    }

  });
});
