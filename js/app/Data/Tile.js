define(["Class", "Data/BinFormat"], function(Class, BinFormat) {
  return Class(BinFormat, {
    name: "Tile",
    initialize: function(manager, bounds) {
      var self = this;
      self.manager = manager;
      self.bounds = bounds;

      BinFormat.prototype.initialize.call(self, self.manager.source + "/" + self.bounds.toBBOX());
    }
  });
});
