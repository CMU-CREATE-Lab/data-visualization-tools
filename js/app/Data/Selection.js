define(["app/Class"], function(Class) {
  return Class({
    name: "Selection",

    initialize: function (sortcols) {
      var self = this;
      self.sortcols = sortcols;
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
    },

    clearRanges: function () {
      var self = this;
      self.header = {length: 0};
      self.data = {};
      self.sortcols.map(function (col) {
        self.data[col] = [];
      });
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
