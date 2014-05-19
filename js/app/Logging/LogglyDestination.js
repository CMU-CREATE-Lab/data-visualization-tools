define(["app/Class", "app/Logging/Destination", "LogglyTracker"], function(Class, Destination, LogglyTracker) {
  var LogglyDestination = Class(Destination, {
    name: "LogglyDestination",

    initialize: function () {
      var self = this;
      Destination.prototype.initialize.apply(self, arguments);
      self.loggly = new LogglyTracker();
      self.loggly.push({'logglyKey': self.key});
    },

    store: function(entry) {
      var self = this;
      self.loggly.push(entry);
    }
  });
  Destination.destinationClasses.loggly = LogglyDestination;

  return LogglyDestination;
});
