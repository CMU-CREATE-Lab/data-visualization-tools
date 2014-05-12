define(["app/Class", "app/Events"], function(Class, Events) {
  return Class({
    name: "Selection",

    initialize: function (sortcols) {
      var self = this;
      self.sortcols = sortcols;
      self.events = new Events("Selection");
      self.clearRanges();
    },

    addRange: function(source, startidx, endidx) {
      var self = this;
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
      self.events.triggerEvent("add", {source:source, startidx:startidx, endidx:endidx});
    },

    clearRanges: function () {
      var self = this;
      self.header = {length: 0};
      self.data = {};
      self.sortcols.map(function (col) {
        self.data[col] = [];
      });
      self.events.triggerEvent("clear", {});
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
