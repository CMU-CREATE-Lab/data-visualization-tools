define(["app/Class", "jQuery"], function(Class, $) {
  var Destination = Class({
    name: "Destination",
    initialize: function (args) {
      var self = this;
      $.extend(self, args);
    }
  });
  Destination.destinationClasses = {};
  return Destination;
});
