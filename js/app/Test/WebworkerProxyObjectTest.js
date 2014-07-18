define(["app/Class"], function(Class) {
  var WorkerObj = Class({
    name: "WorkerObj",

    bar: function (a) {
      return a + 2;
    }
  });

  return Class({
    name: "WebworkerProxyObjectTest",

    foo: function () {
      return new WorkerObj();
    },
  });
});
