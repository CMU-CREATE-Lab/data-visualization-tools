define(
  [
    "app/Class",
    "QUnit",
    "app/Test/Events",
    "app/Test/SubscribableDict",
    "app/Test/Logging",
    "app/Test/Data/TypedMatrixParser",
    "app/Test/Data/BinFormat",
    "app/Test/Data/TiledEmptyFormat",
    "app/Test/Data/DataView"
  ], function(
    Class,
    QUnit,
    Events,
    SubscribableDict,
    Logging,
    TypedMatrixParser,
    BinFormat,
    TiledEmptyFormat,
    DataView
  ) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.config.testTimeout = 10000;

      new Events();
      new SubscribableDict();
      new Logging();
      new TypedMatrixParser();
      new BinFormat();
      new TiledEmptyFormat();
      new DataView();
    }
  });
});
