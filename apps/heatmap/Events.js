Events = Class({
  initialize: function () {
    this.handlers = {};
  },
  on: function(args) {
    var events = this;
    for (var name in args) {
      if (name != 'scope') {
        if (!events.handlers[name]) events.handlers[name] = [];
        events.handlers[name].push({handler: args[name], scope: args.scope});
      }
    }
  },
  triggerEvent: function (event, data) {
    var events = this;
    if (events.handlers[event]) {
      events.handlers[event].map(function (handler) {
        handler.handler.call(handler.scope, data);
      });
    }
  }
});
