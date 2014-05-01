define(["app/Class", "QUnit", "app/LangExtensions"], function(Class, QUnit) {
  return Class({
    name: "BaseTest",
    initialize: function () {
      var self = this;

      QUnit.module(self.constructor.name);

      Object.keys(self.constructor.prototype).map(function (key) {
        if (key != "name" && key != "initialize"&& key != "toString") {
          QUnit.asyncTest(key, function () {
            self[key](function () { QUnit.start(); });
          });
        }
      });
    }
  });
});
