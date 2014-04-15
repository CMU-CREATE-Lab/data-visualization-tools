define(["Class", "Values", "UrlValues", "Data/DataManager", "Visualization/Animation/AnimationManager", "Visualization/UI", "async"], function(Class, Values, UrlValues, DataManager, AnimationManager, UI, async) {
  return Class({
    paramspec: {
      zoom: {default: 4, fromurl: UrlValues.intFromUrl, tourl: UrlValues.intToUrl, urlname: "zoom"},
      lat: {default: 39.3, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 100000, urlname: "lat"},
      lon: {default: -95.8, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 100000, urlname: "lon"},
      length: {default: 80000, fromurl: UrlValues.intFromUrl, tourl: UrlValues.intToUrl, urlname: "length"},
      offset: {default: 15, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 1000, urlname: "offset"},
      time: {fromurl: UrlValues.dateFromUrl, tourl: UrlValues.dateToUrl, urlname: "time"},
      maxoffset: {default: 29, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 1000, urlname: "offset"},
      animations: {default: ["point"], fromurl: UrlValues.stringArrayFromUrl, tourl: UrlValues.stringArrayToUrl, urlname: "animations"},
      paused: {default: true, fromurl: UrlValues.boolFromUrl, tourl: UrlValues.boolToUrl, urlname: "paused"},
      format: {urlname: "format", default: "tiledbin"},
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

      self.state.getValue("format")

      self.data = new DataManager(self);
      self.animations = new AnimationManager(self);
      self.ui = new UI(self);

      async.series([
        self.data.init.bind(self.data),
        self.ui.init.bind(self.ui),
        self.animations.init.bind(self.animations)
      ]);
    }
  });
});
