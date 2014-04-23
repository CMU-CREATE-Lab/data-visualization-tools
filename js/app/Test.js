define(["Class", "QUnit", "Test/Events", "Test/SubscribableDict"], function(Class, QUnit, Events, SubscribableDict) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.config.testTimeout = 10000;

      new Events();
      new SubscribableDict();
    }
  });
});
