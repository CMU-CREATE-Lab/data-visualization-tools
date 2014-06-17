define(["app/Class", "app/Events", "jQuery"], function(Class, Events, $) {
  var Format = Class({
    name: "Format",
    initialize: function(args) {
      var self = this;
      self.header = {length: 0, colsByName: {}};
      self.data = {};
      self.rowcount = 0;
      self.seriescount = 0;
      self.loadingStarted = false;
      self.allIsLoaded = false;
      self.events = new Events("Data.Format");
      self.events.on({
        all: function () { self.allIsLoaded = true; },
        load: function () { self.allIsLoaded = false; },
        error: function (exception) { self.error = exception; }
      });
      if (args) $.extend(self, args);
    },

    load: function () {
      var self = this;
      if (self.loadingStarted) return;
      self.loadingStarted = true;
      self._load();
    },

    setHeaders: function (headers) {
      var self = this;
      self.headers = headers || {};
    },

    destroy: function () {},

    sortcols: ['series', 'datetime'],

    compareRows: function(rowdix, other, otheridx) {
      var self = this;

      function compareTilesByCol(colidx) {
        if (colidx > self.sortcols.length) return 0;
        var col = self.sortcols[colidx];
        if (self.data[col] == undefined || other.data[col] == undefined) {
          // Ignore any sort columns we don't have...
          return compareTilesByCol(colidx + 1);
        } else if (self.data[col][rowdix] < other.data[col][otheridx]) {
          return -1;
        } else if (self.data[col][rowdix] > other.data[col][otheridx]) {
          return 1;
        } else {
          return compareTilesByCol(colidx + 1);
        }
      }
      return compareTilesByCol(0);
    }
  });

  Format.formatClasses = {};

  return Format;
});
