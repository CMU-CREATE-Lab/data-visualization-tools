define(["app/Class", "app/Data/Format", "app/Data/BinFormat", "app/Data/TiledBinFormat"], function(Class, Format) {
  return Class({
    name: "DataManager",
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
