define(["app/Class", "app/Logging", "app/SubscribableDict", "app/UrlValues", "app/Data/DataManager", "app/Visualization/Animation/AnimationManager", "app/Visualization/UI", "async", "jQuery", "app/Json"], function(Class, Logging, SubscribableDict, UrlValues, DataManager, AnimationManager, UI, async, $, Json) {
  return Class({
    name: "Visualization",
    paramspec: {
      zoom: {default: 4, fromurl: UrlValues.intFromUrl, tourl: UrlValues.intToUrl, urlname: "zoom", type: "number"},
      lat: {default: 39.3, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 100000, urlname: "lat", type: "number"},
      lon: {default: -95.8, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 100000, urlname: "lon", type: "number"},
      length: {default: 80000, fromurl: UrlValues.intFromUrl, tourl: UrlValues.intToUrl, urlname: "length", type: "number"},
      offset: {default: 15, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 1000, urlname: "offset", type: "number"},
      time: {fromurl: UrlValues.dateFromUrl, tourl: UrlValues.dateToUrl, urlname: "time", type: Date},
      maxoffset: {default: 29, fromurl: UrlValues.floatFromUrl, tourl: UrlValues.floatToUrl, precision: 1000, urlname: "maxoffset", type: "number"},
      animations: {default: ["point"], fromurl: UrlValues.stringArrayFromUrl, tourl: UrlValues.stringArrayToUrl, urlname: "animations", type: Array},
      paused: {default: true, fromurl: UrlValues.boolFromUrl, tourl: UrlValues.boolToUrl, urlname: "paused", type: "boolean"},
      format: {urlname: "format", default: "tiledbin", type: "string"},
      source: {urlname: "source", type: "string"},
      nowebgl: {urlname: "nowebgl", type: "string"},
      logoimg: {urlname: "logoimg", type: "string"},
      logourl: {urlname: "logourl", type: "string"},

      logging: {default: {}, fromurl: UrlValues.jsonFromUrl, tourl: UrlValues.jsonToUrl, urlname: "logging", type: "object"},

      timeresolution: {default: 60*60*24*1000},

      // httpHeaders: {default: {"X-Client-Cache": "true"}}
    },

    initialize: function () {
      var self = this;

      self.state = new SubscribableDict(self.paramspec);
      self.urlhandler = new UrlValues(self.state, self.paramspec);

      self.state.events.on({
        logging: function () {
          Logging.default.setRules(self.state.getValue("logging"));
        }
      });
      Logging.default.setRules(self.state.getValue("logging"));

      self.data = new DataManager(self);

      var animations = self.state.getValue("animations").map(function (name) {
        return {type:name, args:{}};
      });

      self.animations = new AnimationManager(self);
      self.ui = new UI(self);

      async.series([
        self.data.init.bind(self.data),
        self.animations.init.bind(self.animations),
          self.ui.init.bind(self.ui),
          function (cb) {
            self.animations.load({animationSpecs:animations}, cb);
          }
      ]);
    },

    toJSON: function () {
      var self = this;
      return {
        state: self.state.values,
        animations: self.animations
      };
    },

    load: function (url, cb) {
      var self = this;

      self.workspaceUrl = url.split("?")[0];
      $.get(url, function (data) {
        data = Json.decode(data);
        for (var name in data.state) {
          self.state.setValue(name, data.state[name]);
        }
        self.animations.load(data.animations, cb);
      }, 'text');
    },

    save: function (cb) {
      var self = this;

      $.post(self.workspaceUrl, Json.encode(self, "  "), function (data) {
        data = Json.decode(data);
        cb(self.workspaceUrl + "?id=" + data.id);
      }, 'text');
    }
  });
});
