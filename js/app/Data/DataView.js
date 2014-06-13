define(["app/Class", "app/Data/Format", "app/Data/Selection", "app/Data/Pack", "jQuery"], function(Class, Format, Selection, Pack, $) {
  return Class(Format, {
    name: "DataView",

    /* This specification can be overridden by a parameter to the
     * constructor.
     *
     * After initialization, self.header.colsByName will contain this
     * information, plus:
     *
     * For each column = self.header.colsByNam.COLUMNNAME:
     *   column.typespec = Pack.typemap.byname[column.type]
     *   For each item index i:
     *     column.items[i].index = i
     *     column.itemsByName[column.items[i].name] = column.items[i]
     */

    columns: {
      points: {type: "Int32", items: [
        {name: "latitude", source: {latitude: 1.0}},
        {name: "longitude", source: {longitude: 1.0}}]},
      color: {type: "Int32", items: [
        {name: "red", source: {_: 1.0}},
        {name: "green", source: {_: 1.0}},
        {name: "blue", source: {_: 0.0}}]},
      magnitude: {type: "Int32", items: [
        {name: "magnitude", source: {_: 1.0}}]}
    },

    transforms: {
    },

    initialize: function (source, args) {
      var self = this;

      Format.prototype.initialize.call(self)
      self.source = source;

      if (args) $.extend(self, args);

      self.selections = {};

      self.source.events.on({
        update: self.handleUpdate,
        error: self.handleError,
        scope: self
      });

      Object.items(self.columns).map(function (item) {
        var value = $.extend(true, {}, item.value);
        value.name = item.key;
        self.addCol(value);
      });

      if (args.selections) {
        Object.items(args.selections).map(function (item) {
          self.addSelectionCategory(item.key, item.value);
        });
      } else {
        self.addSelectionCategory("selected");
        self.addSelectionCategory("hover");
      }
    },

    addSelectionCategory: function (name, args) {
      var self = this;
      args = $.extend({}, args || {});
      if (!args.sortcols) args.sortcols = self.source.sortcols.slice(0, 1);
      self.selections[name] = new Selection(args);
      self.selections[name].events.on({
        update: function (e) {
          e = $.extend({}, e);
          e.category = name;
          e.update = "selection-" + e.update;
          self.handleUpdate(e);
        }
      });
    },

    handleUpdate: function (update) {
      var self = this;
      self.header.length = self.source.header.length;
      self.seriescount = self.source.seriescount;

      Object.keys(self.header.colsByName).map(self.updateCol.bind(self));

      self.events.triggerEvent(update.update, update);
      self.events.triggerEvent("update", update);
    },

    handleError: function (error) {
      var self = this;
      self.events.triggerEvent("error", error);
    },

    updateCol: function (colname) {
      var self = this;
      var spec = self.header.colsByName[colname];
      if (   !self.data[colname]
          || self.data[colname].length != self.source.header.length * spec.items.length) {
        self.data[colname] = new spec.typespec.array(self.source.header.length * spec.items.length);
      }

      for (var rowidx = 0; rowidx < self.source.header.length; rowidx++) {
        for (var item = 0; item < spec.items.length; item++) {
          var source = spec.items[item].source;
          var res = source._ || 0; 
          for (var key in source) {
            if (key != '_') {
              if (self.selections[key]) {
                res += source[key] * (self.selections[key].checkRow(self.source, rowidx) ? 1.0 : 0.0);
              } else {
                if (self.source.data[key]) {
                  res += source[key] * self.source.data[key][rowidx];
                }
              }
            }
          }
          self.data[colname][rowidx * spec.items.length + item] = res;
        }
        if (spec.transform) {
          self.transforms[spec.transform].call(spec, self.data[colname], rowidx * spec.items.length);
        }
      }
    },

    _changeCol: function(update, spec) {
      var self = this;
      spec = $.extend({}, spec);
      spec.itemsByName = {};
      for (var i = 0; i < spec.items.length; i++) {
        spec.items[i].index = i;
        spec.itemsByName[spec.items[i].name] = spec.items[i];
      }
      spec.typespec = Pack.typemap.byname[spec.type];

      self.header.colsByName[spec.name] = spec;

      self.updateCol(spec.name);

      var e = {update: update, name: spec.name};
      self.events.triggerEvent(e.update, e);
      self.events.triggerEvent('update', e);
    },

    addCol: function(spec) {
      var self = this;
      self._changeCol("add-col", spec);
    },

    changeCol: function(spec) {
      var self = this;
      self._changeCol("change-col", spec);
    },

    removeCol: function(name) {
      delete self.header.colsByName[name];
      delete self.data[name];

      var e = {update: 'remove-col', name: spec.name};
      self.events.triggerEvent(e.update, e);
      self.events.triggerEvent('update', e);
    },

    getAvailableColumns: function () {
      var self = this;

      return Object.keys(self.source.header.colsByName).concat(
        Object.keys(self.selections));
    },

    toJSON: function () {
      var self = this;
      var cols = $.extend(true, {}, self.header.colsByName);
      for (var name in cols) {
        delete cols[name].itemsByName;
        delete cols[name].typespec;
        cols[name].items.map(function (item) {
          delete item.index;
        });
      }
      return {
        columns: cols,
        selections: self.selections
      };
    }
  });
});