define(["app/Class", "app/Logging/Destination"], function(Class, Destination) {
  var print = function () {};
  if (typeof(console) != "undefined" && typeof(console.log) != "undefined") {
    print = console.log.bind(console);
  }

  var ScreenDestination = Class(Destination, {
    name: "ScreenDestination",

    store: function(entry) {
      print(entry.toString());
    }
  });
  Destination.destinationClasses.screen = ScreenDestination;

  return ScreenDestination;
});
