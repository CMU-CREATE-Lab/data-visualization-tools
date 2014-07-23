define(["app/Class", "app/Events", "app/Data/TypedMatrixParser", "app/Data/Format"], function(Class, Events, TypedMatrixParser, Format) {
  var BinFormat = Class(TypedMatrixParser, Format, {
    name: "BinFormat",
    initialize: function() {
      var self = this;
     
      Format.prototype.initialize.apply(self, arguments);
      // Header and events will be overwritten, with the same values...
      TypedMatrixParser.prototype.initialize.call(self, self.url);
    },

    zoomTo: function () {
      var self = this;

      self.load();
    },

    headerLoaded: function (data) {
      var self = this;
      self.header = data;
      self.seriescount = self.header.series;
      for (var name in self.header.colsByName) {
        var col = self.header.colsByName[name];
        self.data[name] = new (eval(col.typespec.array))(self.header.length);
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
    },

    destroy: function () {
      var self = this;
      this.cancel();
    },

    toJSON: function () {
      return {
        type: self.name,
        args: {
          url: self.url
        }
      }
    }
  });
  Format.formatClasses.BinFormat = BinFormat;
  return BinFormat;
});
