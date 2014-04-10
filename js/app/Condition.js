/* Async mechanism to wait for a condition to be true.
   Callbacks can wait to be executed once the condition is set to true.
   Once the condition is set it will always remain set, and any
   callbacks set to wait for it will be executed immediately.
*/
defined(["Class", "async"], function (Class, async) {
  return Class({
    initialize: function() {
      this.is_true = false;
      this.waiting = [];
    },
    set: function (cb) {
      this.is_true = true;
      async.series(this.waiting, cb);
    },
    wait: function (cb) {
      if (this.is_true) {
        cb(function () {});
      } else {
        this.waiting.push(cb);
      }
    }
  });
});
