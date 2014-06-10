define(["app/Class", "app/Events", "app/Data/Format"], function(Class, Events, Format) {
  var EmptyFormat = Class(Format, {
    name: "EmptyFormat",

    headerTime: 1000,
    contentTime: 1000,

    initialize: function() {
      var self = this;
      self.loading_started = false;
     
      Format.prototype.initialize.apply(self, arguments);
    },

    zoomTo: function () {
      var self = this;

      self.load();
    },

    load: function() {
      var self = this;

      if (self.loading_started) return;
      self.loading_started = true;

      if (self.headerTime !== false) {
        if (self.headerTime) {
          setTimeout(self.headerLoaded.bind(self), self.headerTime);
        } else {
          self.headerLoaded();
        }
      }
    },

    headerLoaded: function () {
      var self = this;
      self.events.triggerEvent("header", self.header);
      if (self.contentTime !== false) {
        if (self.contentTime) {
          setTimeout(self.allLoaded.bind(self), self.contentTime);
        } else {
          self.allLoaded();
        }
      }
    },

    allLoaded: function () {
      var self = this;

      var e = {update: "all", timing: self.loadEndTime - self.loadStartTime};
      self.events.triggerEvent("all", e);
      self.events.triggerEvent("update", e);
    },

    toJSON: function () {
      return {
        type: self.name,
      }
    }
  });
  Format.formatClasses.EmptyFormat = EmptyFormat;
  return EmptyFormat;
});
