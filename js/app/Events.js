define(["app/Class", "app/Logging"], function(Class, Logging) {
  return Class({
    name: "Events",
    initialize: function (category) {
      var self = this;
      self.handlers = {};
      self.category = category || "AnonymousEvents";
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
      Logging.default.log(self.category + "." + event, data);
      if (self.handlers[event]) {
        self.handlers[event].map(function (handler) {
          handler.handler.call(handler.scope, data);
        });
      }
    }
  });
});
