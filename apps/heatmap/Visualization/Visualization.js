define(["Class", "Values", "UrlValues", "Data/TileManager", "Visualization/AnimationManager", "Visualization/UI"], function(Class, Values, UrlValues, TileManager, AnimationManager, UI) {
  return Class({
    paramspec: {
      zoom: {default: 4, fromurl: UrlValues.intFromUrl, tourl: UrlValues.intToUrl, urlname: "zoom"},
      lat: {default: 39.3, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 100000, urlname: "lat"},
      lon: {default: -95.8, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 100000, urlname: "lon"},
      length: {default: 80000, fromurl: UrlValues.intFromUrl, tourl: UrlValues.intToUrl, urlname: "length"},
      offset: {default: 15, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 1000, urlname: "offset"},
      maxoffset: {default: 29, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 1000, urlname: "offset"},
      animations: {default: ["point"], fromurl: UrlValues.stringArrayFromUrl, tourl: UrlValues.stringArrayToUrl, urlname: "animations"},
      paused: {default: true, fromurl: UrlValues.boolFromUrl, tourl: UrlValues.boolToUrl, urlname: "paused"},
      source: {urlname: "source"},
      nowebgl: {urlname: "nowebgl"},
      logoimg: {urlname: "logoimg"},
      logourl: {urlname: "logourl"},

      timeresolution: {default: 60*60*24}
    },

    initialize: function () {
      var self = this;

      self.state = new Values(self.paramspec);
      self.urlhandler = new UrlValues(self.state, self.paramspec);

      self.tiles = new TileManager(self.state.getValue("source"));
      self.animations = new AnimationManager(self);
      self.ui = new UI(self);

      async.series([
        // self.tiles.init.bind(self.tiles),
        self.ui.init.bind(self.ui),
        self.animations.init.bind(self.animations)
      ]);
    }
  });
});
