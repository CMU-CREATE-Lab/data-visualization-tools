define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Data/BinFormat"], function(Class, QUnit, BaseTest, BinFormat) {
  return Class(BaseTest, {
    name: "BinFormat",

    "Load data": function (cb) {
      QUnit.expect(5);

      var p = new BinFormat({url:require.toUrl("app/Test/Data/foo.bin")});
      p.events.on({
        all: function () {
          QUnit.equal(p.header.test, 4711, "Support for extra header values");
          QUnit.equal(p.header.colsByName.foo.gazonk, 3, "Support for extra column attributes");
          QUnit.equal(p.header.colsByName.foo.max, 6, "Support for column min/max values");
          QUnit.equal(p.data.foo[2], 6, "First value matches");
          QUnit.equal(p.data.bar[2], 10, "Other value matches");
          cb();
        }
      });

      p.load();
    }
  });
});
