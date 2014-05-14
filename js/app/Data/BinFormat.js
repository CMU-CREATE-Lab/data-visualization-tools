define(["app/Class", "app/Events", "app/Data/TypedMatrixParser", "app/Data/Format"], function(Class, Events, TypedMatrixParser, Format) {
  var BinFormat = Class(TypedMatrixParser, Format, {
    name: "BinFormat",
    initialize: function(source) {
      var self = this;
      self.source = source;
      self.loading_started = false;
     
      Format.prototype.initialize.apply(self, arguments);
      // Header and events will be overwritten, with the same values...
      TypedMatrixParser.prototype.initialize.apply(self, arguments);
    },

    zoomTo: function () {
      var self = this;

      self.load();
    },

    load: function() {
      var self = this;

      if (self.loading_started) return;
      self.loading_started = true;
  
      TypedMatrixParser.prototype.load.call(self);
    },

    headerLoaded: function (data) {
      var self = this;
      self.header = data;
      self.seriescount = self.header.series;
      for (var name in self.header.colsByName) {
        var col = self.header.colsByName[name];
        self.data[name] = new col.typespec.array(self.header.length);
      }

      TypedMatrixParser.prototype.headerLoaded.call(self, data);
    },

    rowLoaded: function(data) {
      var self = this;

      for (var name in self.header.colsByName) {
        self.data[name][self.rowcount] = data[name];
        self.header.colsByName[name].min = self.header.colsByName[name].min == undefined ? data[name] : Math.min(self.header.colsByName[name].min, data[name]);
        self.header.colsByName[name].max = self.header.colsByName[name].max == undefined ? data[name] : Math.max(self.header.colsByName[name].max, data[name]);
      }

      self.rowcount++;
      TypedMatrixParser.prototype.rowLoaded.call(self, data);
    },

    allLoaded: function () {
      var self = this;

      // We aren't getting any more, so if anyone's waiting they'd be
      // waiting forever if we didn't tell them...
      self.header.length = self.rowcount;
      TypedMatrixParser.prototype.allLoaded.call(self);
    }
  });
  Format.formatClasses.bin = BinFormat;
  return BinFormat;
});
