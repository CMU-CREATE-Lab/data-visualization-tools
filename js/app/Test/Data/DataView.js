define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Data/BinFormat", "app/Data/DataView"], function(Class, QUnit, BaseTest, BinFormat, DataView) {
  return Class(BaseTest, {
    name: "DataView",

    "Transform data": function (cb) {
      QUnit.expect(3);

      var p = new BinFormat(require.toUrl("app/Test/Data/foo.bin"));
      dv = new DataView(p, {
        fie: {type: "Float32", items: [
          {name: "fooitem", source: {foo: 1.0}},
          {name: "baritem", source: {bar: 1.0}},
          {name: "avg", source: {foo: 0.5, bar: 0.5}}]},
      });
      dv.events.on({
        all: function () {
          QUnit.equal(dv.data.fie[dv.header.colsByName.fie.items.length * 2 + 0], 6, "First value matches");
          QUnit.equal(dv.data.fie[dv.header.colsByName.fie.items.length * 2 + 1], 10, "Other value matches");
          QUnit.equal(dv.data.fie[dv.header.colsByName.fie.items.length * 2 + 2], 8, "Average value matches");

          cb();
        }
      });

      p.load();
    }
  });
});
