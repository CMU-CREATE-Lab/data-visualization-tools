define(["app/Class", "app/Logging/Destination", "app/Json", "jQuery"], function(Class, Destination, Json, $) {
  var ServerDestination = Class(Destination, {
    name: "ServerDestination",

    initialize: function () {
      var self = this;
      Destination.prototype.initialize.apply(self, arguments);
    },

    store: function(entry) {
      var self = this;
      $.post(self.url, Json.encode(entry, "  "), function (data) {}, 'text');
    }
  });
  Destination.destinationClasses.server = ServerDestination;

  return ServerDestination;
});
