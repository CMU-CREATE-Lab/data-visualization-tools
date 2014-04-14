define(["Class", "Events", "Data/TypedMatrixFormat"], function(Class, Events, TypedMatrixFormat) {
  return Class(TypedMatrixFormat, {
    initialize: function(manager, bounds) {
      var self = this;
      self.manager = manager;
      self.bounds = bounds;
      self.data = {};
      self.rowcount = 0;
      self.loaded = {};
      self.loading_started = false;
     
      TypedMatrixFormat.prototype.initialize.call(self, self.manager.source + "/" + self.bounds.toBBOX());
    },

    load: function() {
      var self = this;

      if (self.loading_started) return;
      self.loading_started = true;
  
      TypedMatrixFormat.prototype.load.call(self);
    },

    headerLoaded: function (data) {
      var self = this;

      self.header = data;
      for (var name in self.header.colsByName) {
        var col = self.header.colsByName[name];
        self.data[name] = new col.typespec.array(self.header.length);
        self.loaded[name] = {min: undefined, max: undefined};
      }

      TypedMatrixFormat.prototype.headerLoaded.call(self, data);
    },

    rowLoaded: function(data) {
      var self = this;

      for (var name in self.header.colsByName) {
        self.data[name][self.rowcount] = data[name];
        self.loaded[name].min = self.loaded[name].min == undefined ? data[name] : Math.min(self.loaded[name].min, data[name]);
        self.loaded[name].max = self.loaded[name].max == undefined ? data[name] : Math.max(self.loaded[name].max, data[name]);
      }

      self.rowcount++;
      TypedMatrixFormat.prototype.rowLoaded.call(self, data);
    },

    allLoaded: function () {
      var self = this;

      // We aren't getting any more, so if anyone's waiting they'd be
      // waiting forever if we didn't tell them...
      self.header.length = self.rowcount;
      TypedMatrixFormat.prototype.allLoaded.call(self);
    }
  });
});
