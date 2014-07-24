define(["app/Class", "app/Bounds", "lodash", "app/Events", "app/Data/Format", "app/Data/DataView", "app/Data/TiledBinFormat", "app/Data/BinFormat", "app/Data/EmptyFormat", "app/Data/TiledEmptyFormat"], function(Class, Bounds, _, Events, Format, DataView) {
  return Class({
    name: "DataManager",
    initialize: function () {
      var self = this;

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
          error: self.handleError.bind(self, source),
          "tile-error": self.handleTileError.bind(self, source),
          "info-error": self.handleInfoError.bind(self, source),
          header: self.handleHeader.bind(self, source.source),
          load: self.handleLoad.bind(self, source.source),
          update: self.handleUpdate.bind(self, source.source),
        });
      }
      self.sources[key].usage++;
      self.events.triggerEvent("add", self.sources[key]);
      return self.sources[key].source;
    },

    setHeaders: function (headers, cb) {
      var self = this;
      for (var key in self.sources) {
        self.sources[key].source.setHeaders(headers);
      }
    },

    removeSource: function (source) {
      var self = this;
      var key = source.type + "|" + source.args.url;
      source = self.sources[key];

      source.usage--;
      if (source.usage == 0) {
        delete self.sources[key];
        source.source.destroy();
      }
      self.updateHeader();
      self.events.triggerEvent("remove", source);
    },

    listSources: function (cb) {
      var self = this;
      cb(Object.values(self.sources).map(function (source) { return source.spec; }));
    },

    listSourceTypes: function (cb) {
      var self = this;
      cb(Object.keys(Format.formatClasses));
    },

    createView: function(view, cb) {
      var self = this;
      cb(null, new DataView(
        self.addSource(view.source),
        {
          columns: view.columns,
          selections: view.selections,
        }
      ));
    },

    zoomTo: function (bounds) {
      var self = this;
      if (bounds.length > 0) bounds = new Bounds(bounds);
        console.log("zoomTo(" + bounds.toBBOX() + ") for " + Object.keys(self.sources).join(", "));
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
            self.header.colsByName[item.key] = _.clone(item.value);
          } else {
            self.header.colsByName[item.key].min = Math.min(
              self.header.colsByName[item.key].min, item.value.min);
            self.header.colsByName[item.key].max = Math.max(
              self.header.colsByName[item.key].max, item.value.max);
          }
        });
      });
      self.events.triggerEvent("header", self.header);
    },

    handleError: function (source, error) {
      var self = this;
      error.source = source.source;
      self.events.triggerEvent("error", error);
      self.removeSource(source.spec);
    },

    handleTileError: function (source, error) {
      var self = this;
      error.source = source;
      self.events.triggerEvent("tile-error", error);
    },

    handleInfoError: function (source, error) {
      var self = this;
      error.source = source;
      self.events.triggerEvent("error", error);
    },

    handleHeader: function (source, header) {
      var self = this;
      header.source = source;
      self.updateHeader();
    },

    handleLoad: function (source) {
      var self = this;
      self.events.triggerEvent("load", {source: source});
    },

    handleUpdate: function (source, update) {
      var self = this;
      update = _.clone(update);
      update.source = source;
      self.updateHeader();
      if (update.update == "all") {
        var allDone = Object.values(self.sources
          ).map(function (source) { return source.source.allIsLoaded || source.source.error; }
          ).reduce(function (a, b) { return a && b; });
        if (!allDone) {
          update.update = 'all-source';
        }
      }
      self.events.triggerEvent(update.update, update);
      self.events.triggerEvent("update", update);
    },

    useHeader: function (fn) {
      var self = this;
      fn(self.header, function () {});
    }
  });
});
