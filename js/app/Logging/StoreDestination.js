define(["app/Class", "app/Logging/Destination"], function(Class, Destination) {
  var StoreDestination = Class(Destination, {
    name: "StoreDestination",

    initialize: function () {
      var self = this;
      self.storage = [];
      Destination.prototype.initialize.apply(self, arguments);
    },

    store: function(entry) {
      var self = this;
      self.storage.push(entry);
    },

    get: function (start, end) {
      var self = this;
      return self.storage.slice(start, end);
    },

    format: function () {
      var self = this;
      return self.get.apply(self, arguments).join("\n");
    }
  });
  Destination.destinationClasses.store = StoreDestination;

  return StoreDestination;
});
