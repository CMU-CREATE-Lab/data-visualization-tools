define(["app/Class", "QUnit", "app/Test/BaseTest", "app/SubscribableDict"], function(Class, QUnit, BaseTest, SubscribableDict) {
  return Class(BaseTest, {
    name: "SubscribableDict",

    "Set and get value": function (cb) {
      QUnit.expect(1);

      var d = new SubscribableDict();
      d.setValue("foo", 4711);
      QUnit.equal(d.getValue("foo"), 4711);
      cb();
    },

    "Subscribing to a change": function (cb) {
      QUnit.expect(6);

      var d = new SubscribableDict();

      d.events.on({
        foo: function (arg) {
          QUnit.equal(arg.name, "foo", "Named event:  Name of value is the same as name of event");
          QUnit.equal(arg.old, undefined, "Named event: Old value is unset");
          QUnit.equal(arg.new, 4711, "Named event: Old value is unset");
        },
        set: function (arg) {
          QUnit.equal(arg.name, "foo", "Generic event: Name of value is foo");
          QUnit.equal(arg.old, undefined, "Generic event: Old value is unset");
          QUnit.equal(arg.new, 4711, "Generic event: Old value is unset");
          cb();
        }
      });

      d.setValue("foo", 4711);
    },

    "Default values": function (cb) {
      QUnit.expect(3);

      var d = new SubscribableDict({
        foo: {default: 4711}
      });

      QUnit.equal(d.getValue("foo"), 4711, "Original value is default value");

      d.setValue("foo", 13);
      QUnit.equal(d.getValue("foo"), 13, "Value can be set");

      d.setValue("foo", undefined);
      QUnit.equal(d.getValue("foo"), 4711, "Value can be reset to the default value");

      cb();
    },

    "Validation": function (cb) {
      QUnit.expect(5);

      var TestType = Class({ name: "TestType" });
      var OtherType = Class({ name: "OtherType" });

      var d = new SubscribableDict({
        anumber: {type: "number"},
        astring: {type: "string"},
        atesttype: {type: TestType},
        restrictednumber: {type: "number", lower: 3, validate: function (value) {
          if (value < this.lower) {
            throw "Value too low";
          }
        }}
      });
        
      d.setValue("anumber", 47.11);
      d.setValue("astring", "Some text");
      d.setValue("atesttype", new TestType());
      d.setValue("restrictednumber", 4);
      d.setValue("anumber", undefined);

      try {
        d.setValue("anumber", "this is not a number");
      } catch (e) {
        QUnit.ok(true, "Setting a non-number for a number attribute throws an exception");
      }
      try {
        d.setValue("astring", 13);
      } catch (e) {
        QUnit.ok(true, "Setting a number for a string attribute throws an exception");
      }
      try {
        d.setValue("atesttype", 13);
      } catch (e) {
        QUnit.ok(true, "Setting a number instead of an instance throws an exception");
      }
      try {
        d.setValue("atesttype", new OtherType());
      } catch (e) {
        QUnit.ok(true, "Setting an instance of the wrong class throws an exception");
      }
      try {
        d.setValue("restrictednumber", -2);
      } catch (e) {
        QUnit.ok(true, "Validators are run");
      }

      cb();
    }

  });
});
