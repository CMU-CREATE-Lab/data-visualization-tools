define(["app/Class", "QUnit", "app/Test/Events", "app/Test/SubscribableDict", "app/Test/Logging", "app/Test/Data/TypedMatrixParser"], function(Class, QUnit, Events, SubscribableDict, Logging, TypedMatrixParser) {
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
