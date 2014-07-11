define(["app/Class", "lodash"], function(Class, _) {
  var Destination = Class({
    name: "Destination",
    initialize: function (args) {
      var self = this;
      _.extend(self, args);
    }
  });
  Destination.destinationClasses = {};
  return Destination;
});
