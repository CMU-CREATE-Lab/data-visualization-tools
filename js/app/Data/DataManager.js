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
      self.format.events.on({
        header: function () {
          for (var key in self.format.header.options) {
            self.visualization.state.setValue(key, self.format.header.options[key]);
          }
        }
      });
      self.visualization.state.events.on({
        httpHeaders: function () {
          self.format.setHeaders(self.visualization.state.getValue("httpHeaders"));
        }
      });
      self.format.setHeaders(self.visualization.state.getValue("httpHeaders"));
      self.format.load();

      cb();
    },

    zoomTo: function (bounds) {
      var self = this;
      self.format.zoomTo(bounds);
    }
  });
});
