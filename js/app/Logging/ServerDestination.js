define(["app/Class", "app/Logging/Destination", "app/Json"], function(Class, Destination, Json) {
  var ServerDestination = Class(Destination, {
    name: "ServerDestination",

    initialize: function () {
      var self = this;
      Destination.prototype.initialize.apply(self, arguments);
    },

    store: function(entry) {
      var self = this;

      var request = new XMLHttpRequest();
      request.open('POST', url, true);
      request.send(son.encode(entry, "  "));
    }
  });
  Destination.destinationClasses.server = ServerDestination;

  return ServerDestination;
});
