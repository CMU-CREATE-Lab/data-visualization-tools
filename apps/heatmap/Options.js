Values = Class({
  initialize: function (defaults) {
    var values = this;

    values.defaults = defaults;
    values.values = {};
    values.events = new Events();
  },

  setValue: function(name, value) {
    var values = this;
    var old = values.values[name];
    values.values[name] = value;
    values.events.triggerEvent("set", {"name": name, "new": value, "old": old});
  },

  getValue: function(name) {
    var values = this;
    if (values.values[name] != undefined) {
      return values.values[name];
    } else {
      return values.defaults[name];
    }
  },

  incValue: function(name) {
    this.setValue(name, this.getValue(name) + 1);
  },

  decValue: function(name) {
    this.setValue(name, this.getValue(name) - 1);
  }
});

Parameters = Class(Values, {
  initialize: function (defaults, precisions) {
    var parameters = this;
    parameters.precisions = precisions;
    Values.prototype.initialize.call(parameters, defaults);    
  },

  setValue: function(name, value) {
    var parameters = this;
    var param = value;

    if (parameters.precision[name] != undefined) {
      param = Math.round(param * parameters.precision[name])/parameters.precision[name];
    }
    setParameter(name, param.toString());
    Values.prototype.setValue.call(this, name, value);
  },

  getValue: function(name) {
    var values = this;

    if (values.values[name] == undefined) {
      var param = getParameter(name);
      if (param != undefined) return param;
    }
    return Values.prototype.getValue.call(this, name);
  }
});
