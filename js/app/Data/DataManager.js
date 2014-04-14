define(["Class", "Data/Format", "Data/BinFormat", "Data/TiledBinFormat"], function(Class, Format) {
  return Class({
    initialize: function (visualization) {
      var self = this;

      self.visualization = visualization;
    },

    init: function (cb) {
      var self = this;

      self.formatClass = Format.formatClasses[
        self.visualization.state.getValue("format")];

      self.format = new self.formatClass(self.visualization.state.getValue("source"));

      cb();
    }
  });
});
