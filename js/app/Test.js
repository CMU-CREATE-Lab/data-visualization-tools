define(["Class", "QUnit", "LangExtensions"], function(Class, QUnit) {
  return Class({
    name: "Test",
    initialize: function () {
      QUnit.init();
      QUnit.start();

      test( "hello test", function() {
        ok( 1 == "1", "Passed!" );
      });
    }
  });
});
