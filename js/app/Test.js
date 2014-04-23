define(["Class", "QUnit", "Test/Events", "Test/SubscribableDict", "Test/Logging"], function(Class, QUnit, Events, SubscribableDict, Logging) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.config.testTimeout = 10000;

      new Events();
      new SubscribableDict();
      new Logging();
    }
  });
});
