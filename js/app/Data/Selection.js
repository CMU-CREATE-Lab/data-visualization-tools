define(["app/Class", "app/Events", "lodash"], function(Class, Events, _) {
  return Class({
    name: "Selection",

    sortcols: ["series"],

    initialize: function (args) {
      var self = this;
      self.events = new Events("Selection");
      // Yes, first set sortcols (if specified) then clear everything,
      // then set all data (if there is some)
      _.extend(self, args);
      self._clearRanges();
      _.extend(self, args);
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
    },

    toJSON: function () {
      var self = this;
      return {
        header: self.header,
        data: self.data,
        sortcols: self.sortcols
      };
    }
  });
});
