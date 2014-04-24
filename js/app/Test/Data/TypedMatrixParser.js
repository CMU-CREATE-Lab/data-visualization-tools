define(["Class", "QUnit", "Test/BaseTest", "Data/TypedMatrixParser", "Data/TypedMatrixGenerator"], function(Class, QUnit, BaseTest, TypedMatrixParser, TypedMatrixGenerator) {
  return Class(BaseTest, {
    name: "TypedMatrixParser",

    "Generate and parse": function (cb) {
      QUnit.expect(7);

      var cols = {foo: new Int32Array(3), bar: new Float32Array(3)};
      cols.foo[0] = 4;
      cols.foo[1] = 5;
      cols.foo[2] = 6;
      cols.bar[0] = 3.99;
      cols.bar[1] = 4.99;
      cols.bar[2] = 5.99;
      var g = new TypedMatrixGenerator({test: 4711, colsByName: {foo: {gazonk: 3}}}, cols);
      var data = g.asURI();
      QUnit.ok(true, "Generated data");

      var p = new TypedMatrixParser(data);
      var rowidx = 0;
      p.events.on({
        header: function (data) {
          QUnit.equal(data.test, 4711, "Support for extra header values");
          QUnit.equal(data.colsByName.foo.gazonk, 3, "Support for extra column attributes");
          QUnit.equal(data.colsByName.foo.max, 6, "Support for column min/max values");
        },
        row: function (data) {
          if (rowidx == 2) {
            QUnit.equal(data.foo, 6, "Integer column value");
            QUnit.equal(data.bar, 5.99, "Float column value");
          }
          rowidx++;
        },
        all: function () {
          QUnit.ok(true, "Parsed data");
          cb();
        }
      });

      p.load();
    }
  });
});
