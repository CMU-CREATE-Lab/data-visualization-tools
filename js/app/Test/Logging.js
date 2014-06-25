define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Logging"], function(Class, QUnit, BaseTest, Logging) {
  return Class(BaseTest, {
    name: "Logging",

    "Ignored log messages": function (cb) {
      QUnit.expect(1);

      var l = new Logging({rules: {store: {rules: []}}});
      l.log("Some.Category", {foo: 47.11});
      QUnit.equal(l.destinations.store.get().length, 0, "No messages logged");
      cb();
    },

    "Logged messages": function (cb) {
      QUnit.expect(4);

      var l = new Logging({rules: {store: {rules: ["foo.bar"]}}});
      l.log("foo.bar.fie.naja", {msg: "hello"});
      QUnit.equal(l.destinations.store.get().length, 1, "One message logged");
      QUnit.equal(l.destinations.store.get()[0].category, "foo.bar.fie.naja", "Full category logged");
      QUnit.ok(l.destinations.store.get()[0].time instanceof Date, "Current time logged");
      QUnit.equal(l.destinations.store.get()[0].data.msg, "hello", "Data is logged");
      cb();
    },

    "Ignored subcategories": function (cb) {
      QUnit.expect(1);

      var l = new Logging({rules: {store: {rules: ["foo.bar", "-foo.bar.fie"]}}});
      l.log("foo.bar.fie.naja", {msg: "hello"});
      QUnit.equal(l.destinations.store.get().length, 0, "No messages logged");
      cb();
    },

    "Ignored subcategories of all": function (cb) {
      QUnit.expect(1);

      var l = new Logging({rules: {store: {rules: ["all", "-Data.Format.row"]}}});
      l.log("Data.Format.header", {msg: "hello"});
      QUnit.equal(l.destinations.store.get().length, 1, "Messages outside ignored subset are logged");
      cb();
    },

    "Log message formatting": function (cb) {
      QUnit.expect(2);

      var l = new Logging({rules: {store: {rules: ["foo"]}}, store_time: false, store_stack: false});
      l.log("foo.1", {msg: "hello"});
      l.log("foo.2", {value: "something", toString: function () { return this.value + " else"; }});
      QUnit.equal(l.destinations.store.get()[0].toString(), "foo.1: hello", "Data with msg member formatted correctly");
      QUnit.equal(l.destinations.store.get()[1].toString(), "foo.2: something else", "Data with toString() formatted correctly");
      cb();
    }
  });
});
