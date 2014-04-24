define(["Class", "QUnit", "Test/Events", "Test/SubscribableDict", "Test/Logging", "Test/Data/TypedMatrixParser"], function(Class, QUnit, Events, SubscribableDict, Logging, TypedMatrixParser) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.config.testTimeout = 10000;

      new Events();
      new SubscribableDict();
      new Logging();
      new TypedMatrixParser();
    }
  });
});
