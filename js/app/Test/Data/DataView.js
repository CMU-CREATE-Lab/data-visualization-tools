define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Data/BinFormat", "app/Data/DataView"], function(Class, QUnit, BaseTest, BinFormat, DataView) {
  return Class(BaseTest, {
    name: "DataView",

    "Transform data": function (cb) {
      QUnit.expect(3);

      var p = new BinFormat({url:require.toUrl("app/Test/Data/foo.bin")});
      dv = new DataView(p, {columns: {
        fie: {type: "Float32", items: [
          {name: "fooitem", source: {foo: 1.0}},
          {name: "baritem", source: {bar: 1.0}},
          {name: "avg", source: {foo: 0.5, bar: 0.5}}]},
      }});
      dv.events.on({
        all: function () {
          QUnit.equal(dv.data.fie[dv.header.colsByName.fie.items.length * 2 + 0], 6, "First value matches");
          QUnit.equal(dv.data.fie[dv.header.colsByName.fie.items.length * 2 + 1], 10, "Other value matches");
          QUnit.equal(dv.data.fie[dv.header.colsByName.fie.items.length * 2 + 2], 8, "Average value matches");

          cb();
        }
      });

      p.load();
    },

    "Select rows": function (cb) {
      QUnit.expect(6);

      p = new BinFormat({url:require.toUrl("app/Test/Data/foo.bin")});
      p.sortcols = ['foo'];
      dv = new DataView(p, {columns: {
        foo: {type: "Int32", items: [{name: "foo", source: {foo: 1}}]},
        bar: {type: "Int32", items: [{name: "bar", source: {bar: 1}}]},
        selected: {type: "Int32", items: [{name: "selected", source: {selected: 1}}]}
        }});
      dv.events.on({
        all: function () {
          dv.selections.selected.addRange(p, 1, 1);

          QUnit.equal(dv.selections.selected.checkRow(p, 0), false, "Unselected row 0 is not selected according to checkRow()");
          QUnit.equal(dv.selections.selected.checkRow(p, 1), true, "Selected row 1 is selected according to checkRow()");
          QUnit.equal(dv.selections.selected.checkRow(p, 2), false, "Unselected row 2 is not selected according to checkRow()");

          dv.handleUpdate({update: "selection"});
        },
        selection: function () {
          QUnit.equal(dv.data.selected[dv.header.colsByName.selected.items.length * 0], 0, "Unselected row 0 is not selected in DataView");
          QUnit.equal(dv.data.selected[dv.header.colsByName.selected.items.length * 1], 1, "Selected row 1 is selected in DataView");
          QUnit.equal(dv.data.selected[dv.header.colsByName.selected.items.length * 2], 0, "Unselected row 1 is not selected in DataView");

          cb();
        }
      });

      p.load();
    }
  });
});
