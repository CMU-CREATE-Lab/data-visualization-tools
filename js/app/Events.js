/* Mimicing a very small subset of Events from Openlayers, with one
 * extension: You can listen on all events by registering a handler
 * for __all__. It will be called with the event name as a second
 * argument. */
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
    un: function(args) {
      var self = this;
      for (var name in args) {
        if (name != 'scope') {
          self.handlers[name] = self.handlers[name].filter(function (item) {
            return item.handler != args[name] || item.scope != args.scope
          });
          if (self.handlers[name].length == 0) delete self.handlers[name];
        }
      }
    },
    triggerEvent: function (event, data) {
      var self = this;
      Logging.default.log(self.category + "." + event, data);
      if (self.handlers[event]) {
        self.handlers[event].map(function (handler) {
          handler.handler.call(handler.scope, data, event);
        });
      }
      if (self.handlers.__all__) {
        self.handlers.__all__.map(function (handler) {
          handler.handler.call(handler.scope, data, event);
        });
      }
    }
  });
});
