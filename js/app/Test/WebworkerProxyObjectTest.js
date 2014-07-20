define(["app/Class"], function(Class) {
  var WorkerObj = Class({
    name: "WorkerObj",

    bar: function (a, cb) {
      cb(null, a + 2);
    }
  });

  return Class({
    name: "WebworkerProxyObjectTest",

    foo: function (cb) {
      cb(null, new WorkerObj());
    },
  });
});
