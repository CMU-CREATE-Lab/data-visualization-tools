define(["app/Class", "jQuery"], function(Class, $) {
  var Destination = Class({
    name: "LogDestination",
    initialize: function (args) {
      $.extend(self, args);
    }
  });
  Destination.destinationClasses = {};
  return Destination;
});
