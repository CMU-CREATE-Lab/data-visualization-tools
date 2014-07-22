define(["app/Class", "app/Events"], function(Class, Events) {
  return Class({
    name: "WebworkerProxyObjectEventsTest",

    initialize: function () {
      var self = this;

      self.events = new Events("WebworkerProxyObjectEventsTest.Events");
    },

    foo: function (cb) {
      var self = this;
      self.events.triggerEvent('foo', {value: 4711});
    },
  });
});
