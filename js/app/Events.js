define(["Class"], function(Class) {
  return Class({
    initialize: function () {
      var self = this;
      self.handlers = {};
    },
    on: function(args) {
      var self = this;
      for (var name in args) {
        if (name != 'scope') {
          if (!self.handlers[name]) self.handlers[name] = [];
          self.handlers[name].push({handler: args[name], scope: args.scope});
        }
      }
    },
    triggerEvent: function (event, data) {
      var self = this;
      if (self.handlers[event]) {
        self.handlers[event].map(function (handler) {
          handler.handler.call(handler.scope, data);
        });
      }
    }
  });
});
