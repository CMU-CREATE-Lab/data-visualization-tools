define(["Class", "Events", "Logging"], function(Class, Events, Logging) {
  return Class({
    name: "SubscribableDict",
    /*
      spec = {
        zoom: {default: 3},
        latitude: {default: 10.47}
      }
    */
    initialize: function(spec) {
      var self = this;

      self.spec = spec;
      self.values = {};
      self.events = new Events("SubscribableDict");
    },

    validateValue: function(name, spec, value) {
      var self = this;
      if (!spec || value == undefined) return;
      if (spec.type) {
        if (typeof spec.type == "string") {
          if (typeof value != spec.type) {
            throw "Value " + value.toString() + " for " + name + " is not of type " + spec.type;
          }
        } else {
          if (!(typeof value == "object" && value instanceof spec.type)) {
            throw "Value " + value.toString() + " for " + name + " is not an instance of " + spec.type.name;
          }
        }
      }
      if (spec.validate) {
        spec.validate(value)
      }
    },

    setValue: function(name, value) {
      var self = this;
      self.spec && self.validateValue(name, self.spec[name], value);
      var old = self.values[name];
      self.values[name] = value;
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
      self.events.triggerEvent(name, event);
      self.events.triggerEvent("set", event);
    },

    getValue: function(name) {
      var self = this;
      if (self.values[name] != undefined) {
        return self.values[name];
      } else {
        return self.spec[name] && self.spec[name].default;
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
