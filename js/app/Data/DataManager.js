define(["app/Class", "jQuery", "app/Events", "app/Data/Format", "app/Data/TiledBinFormat", "app/Data/BinFormat", "app/Data/EmptyFormat", "app/Data/TiledEmptyFormat"], function(Class, $, Events, Format) {
  return Class({
    name: "DataManager",
    initialize: function (visualization) {
      var self = this;

      self.visualization = visualization;
      self.sources = {};
      self.events = new Events("Data.DataManager");
      self.header = {colsByName: {}};
    },

    init: function (cb) {
      var self = this;

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
          error: self.handleError.bind(self, source.source),
          "tile-error": self.handleTileError.bind(self, source.source),
          header: self.handleHeader.bind(self, source.source),
          load: self.handleLoad.bind(self, source.source),
          update: self.handleUpdate.bind(self, source.source),
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
      self.events.triggerEvent("add", self.sources[key]);
      return self.sources[key].source;
    },

    removeSource: function (source) {
      var self = this;
      var key = source.type + "|" + source.args.url;
      var source = self.sources[key];

      source.usage--;
      if (source.usage == 0) {
        delete self.sources[key];
        source.source.destroy();
      }
      self.updateHeader();
      self.events.triggerEvent("remove", source);
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
      Object.values(self.sources).map (function (source) {
        source.source.zoomTo(bounds);
      });
    },

    updateHeader: function () {
      var self = this;
      self.header = {colsByName: {}};

      Object.values(self.sources).map(function (source) {
        Object.items(source.source.header.colsByName).map(function (item) {
          if (!self.header.colsByName[item.key]) {
            self.header.colsByName[item.key] = $.extend({}, item.value);
          } else {
            self.header.colsByName[item.key].min = Math.min(
              self.header.colsByName[item.key].min, item.value.min);
            self.header.colsByName[item.key].max = Math.max(
              self.header.colsByName[item.key].max, item.value.max);
          }
        });
      });
    },

    handleError: function (source, error) {
      var self = this;
      error.source = source;
      self.events.triggerEvent("error", error);
    },

    handleTileError: function (source, error) {
      var self = this;
      error.source = source;
      self.events.triggerEvent("tile-error", error);
    },

    handleHeader: function (source, header) {
      var self = this;
      header.source = source;
      self.updateHeader();
      self.events.triggerEvent("header", header);
    },

    handleLoad: function (source) {
      var self = this;
      self.events.triggerEvent("header", {source: source});
    },

    handleUpdate: function (source, update) {
      var self = this;
      update.source = source;
      self.updateHeader();
      self.events.triggerEvent(update.update, update);
      self.events.triggerEvent("update", update);
    },
  });
});
