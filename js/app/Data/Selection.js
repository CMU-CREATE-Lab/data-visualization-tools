define(["app/Class", "app/Events"], function(Class, Events) {
  return Class({
    name: "Selection",

    initialize: function (sortcols) {
      var self = this;
      self.sortcols = sortcols;
      self.events = new Events("Selection");
      self._clearRanges();
    },

    _clearRanges: function () {
      var self = this;
      self.header = {length: 0};
      self.data = {};
      self.sortcols.map(function (col) {
        self.data[col] = [];
      });
    },

    addRange: function(source, startidx, endidx, replace) {
      var self = this;
      var updated = false;
      if (replace && self.header.length != 0) {
        updated = true;
        self._clearRanges();
      }
      if (startidx != undefined && endidx != undefined) {
        updated = true;
        self.sortcols.map(function (col) {
          if (source.data[col] != undefined) {
            self.data[col].push(source.data[col][startidx]);
            self.data[col].push(source.data[col][endidx]);
          } else {
            self.data[col].push(undefined);
            self.data[col].push(undefined);
          }
        });
        self.header.length++;
      }
      if (updated) {
        self.events.triggerEvent("update", {update: "add", source:source, startidx:startidx, endidx:endidx});
      }
    },

    clearRanges: function () {
      var self = this;
      if (self.header.length == 0) return;
      self._clearRanges();
      self.events.triggerEvent("update", {update:"clear"});
    },

    checkRow: function (source, rowidx) {
      var self = this;
      for (var i = 0; i < self.header.length; i++) {
        var startcmp = source.compareRows(rowidx, self, i*2);
        var endcmp = source.compareRows(rowidx, self, i*2 + 1);

        if (startcmp >= 0 && endcmp <= 0) {
          return true;
        }
      }
      return false;
    }
  });
});
