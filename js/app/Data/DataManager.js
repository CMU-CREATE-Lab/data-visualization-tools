define(["app/Class", "jQuery", "app/Data/Format", "app/Data/BinFormat", "app/Data/TiledBinFormat"], function(Class, $, Format) {
  return Class({
    name: "DataManager",
    initialize: function (visualization) {
      var self = this;

      self.visualization = visualization;
      self.sources = {};
    },

    init: function (cb) {
      var self = this;

      self.format = self.addSource({
        type: self.visualization.state.getValue("format"),
        args: {
          url: self.visualization.state.getValue("source")
        }
      });

      cb();
    },

    addSource: function (source) {
      var self = this;

      var key = source.type + "|" + source.args.url;
      if (!self.sources[key]) {
        source = {spec:source};
        self.sources[key] = source;
        source.usage = 0;

        var formatClass = Format.formatClasses[source.spec.type];

        source.source = new formatClass(source.spec.args);
        source.source.events.on({
          header: function () {
            for (var key in source.source.header.options) {
              self.visualization.state.setValue(key, source.source.header.options[key]);
            }
          }
        });
        self.visualization.state.events.on({
          httpHeaders: function () {
            source.source.setHeaders(self.visualization.state.getValue("httpHeaders"));
          }
        });
        source.source.setHeaders(self.visualization.state.getValue("httpHeaders"));
        source.source.load();
      }
      self.sources[key].usage++;
      return self.sources[key].source;
    },

    removeSource: function (source) {
      var self = this;
      var key = source.type + "|" + source.args.url;

      self.sources[key].usage--;
      if (self.sources[key].usage == 0) {
        var source = self.sources[key];
        delete self.sources[key];
        source.destroy();
      }
    },

    listSources: function () {
      var self = this;
      return Object.values(self.sources).map(function (source) { return source.spec; });
    },

    listSourceTypes: function () {
      var self = this;
      return Object.keys(Format.formatClasses);
    },

    zoomTo: function (bounds) {
      var self = this;
      self.format.zoomTo(bounds);
    }
  });
});
