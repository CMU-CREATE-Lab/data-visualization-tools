define(["app/Class", "app/Data/Format", "app/Data/Pack", "jQuery"], function(Class, Format, Pack, $) {
  return Class(Format, {
    name: "DataView",
    colsByName: {
      points: {type: "Int32", items: [
        {name: "latitude", source: {latitude: 1.0}},
        {name: "longitude", source: {longitude: 1.0}}]},
      color: {type: "Int32", items: [
        {name: "red", source: {magnitude: 1.0}},
        {name: "green", source: {magnitude: -1.0}},
        {name: "blue", source: {_: 0.0}}]},
      magnitude: {type: "Int32", items: [
        {name: "magnitude", source: {magnitude: 1.0}}]}
    },

    initialize: function (source, colsByName) {
      var self = this;

      Format.prototype.initialize.call(self)
      self.source = source;

      self.source.events.on({
        update: self.handleUpdate,
        error: self.handleError,
        scope: self
      });

      Object.items(colsByName || self.colsByName).map(function (item) {
        item.value.name = item.key;
        self.addCol(item.value);
      });
    },

    handleUpdate: function (update) {
      var self = this;
      self.header.length = source.header.length;
      self.seriescount = source.seriescount;

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
          || self.data[colname].length != self.source.length * spec.items.length) {
        self.data[colname] = new spec.typespec.array(self.source.length * spec.items.length);
      }

      for (var row = 0; row < self.source.length; row++) {
        for (var item = 0; item < spec.items.length; item++) {
          var source = spec.items[item].source;
          var res = source._ || 0; 
          for (var key in source) {
            if (key != '_') {
              res += source[key] * self.source.data[colname][row];
            }
          }
          self.data[colname][row * spec.items.length + item] = res;
        }
      }
    },

    _changeCol: function(update, spec) {
      var self = this;
      spec = $.extend({}, spec);
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
    }
  });
});