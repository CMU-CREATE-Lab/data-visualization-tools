define(["Class", "Events", "Logging"], function(Class, Events, Logging) {
  return Class({
    name: "SubscribableDict",
    /*
      spec = {
        zoom: {default: 3},
        latitude: {default: 10.47}
      }
    */
    initialize: function (spec) {
      var values = this;

      values.spec = spec;
      values.values = {};
      values.events = new Events("SubscribableDict");
    },

    setValue: function(name, value) {
      var values = this;
      var old = values.values[name];
      values.values[name] = value;
      var event = {
        "name": name,
        "new": value,
        "old": old,
        toString: function () {
          var o = this.old != undefined ? this.old.toString() : "undefined";
          var n = this.new != undefined ? this.new.toString() : "undefined";
          return this.name + " = " + o + " -> " + n;
        }
      };
      values.events.triggerEvent(name, event);
      values.events.triggerEvent("set", event);
    },

    getValue: function(name) {
      var values = this;
      if (values.values[name] != undefined) {
        return values.values[name];
      } else {
        return values.spec[name] && values.spec[name].default;
      }
    },

    incValue: function(name) {
      this.setValue(name, this.getValue(name) + 1);
    },

    decValue: function(name) {
      this.setValue(name, this.getValue(name) - 1);
    }
  });
});
