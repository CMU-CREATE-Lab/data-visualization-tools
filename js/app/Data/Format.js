define(["Class", "Events"], function(Class, Events) {
  var Format = Class({
    name: "Format",
    initialize: function() {
      var self = this;
      self.header = {length: 0, colsByName: {}};
      self.data = {};
      self.rowcount = 0;
      self.seriescount = 0;
      self.events = new Events("Data.Format");
    }
  });

  Format.formatClasses = {};

  return Format;
});
