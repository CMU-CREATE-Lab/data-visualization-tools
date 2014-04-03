Parameters = Class(Values, {
  /*
    spec = {
      latitude: {fromurl: Parameters.floatFromUrl, precision: 1000, tourl: Parameters.floatToUrl, urlname: "lat"},
      paused: {fromurl: Parameters.boolFromUrl, tourl: Parameters.boolToUrl, urlname: "paused", trueval: "yes", falseval: "no"},
      source: {urlname: "source"}, // String value, no tourl/fromurl needed
      other: {default: 4711} // Ignored as there is no urlname
    }
  */
  initialize: function (values, spec) {
    var self = this;
    self.values = values;
    self.spec = spec;
    self.values.events.on({set: self.updateUrl, scope: self});

    self.updateValues();
  },

  updateUrl: function (e) {
    var self = this;
    var spec = self.spec[e.name];

    if (spec == undefined || spec.urlname == undefined) return;

    var val = e.new;
    if (spec.tourl) val = spec.tourl.call(spec, val);
    if (val != undefined) val = val.toString();
    setParameter(spec.urlname, val);
  },

  updateValues: function () {
    var self = this;

    Object.items(self.spec).map(function (spec) {
      var paramname = spec.key; spec = spec.value;
      if (spec.urlname == undefined) return;
      var value = getParameter(spec.urlname);
      if (value == undefined) {
        value = spec.default;
      } else if (spec.fromurl) {
        value = spec.fromurl.call(spec, value);
      }
      self.values.setValue(paramname, value);
    });
  }
});

Parameters.intFromUrl = parseInt;
Parameters.intToUrl = function (value) { return value.toString(); };
Parameters.floatFromUrl = parseFloat;
Parameters.floatToUrl = function (value) {
  var spec = this;
  if (spec.precision != undefined) {
    value = Math.round(value * spec.precision)/spec.precision;
  }
  return value.toString();
}
Parameters.boolFromUrl = function (value) {
  var spec = this;
  var trueval = spec.trueval || 'true';
  if (value == trueval) return true;
  return false;
}
Parameters.boolToUrl = function (value) {
  var spec = this;
  if (value) {
    return spec.trueval || 'true';
  } else {
    return spec.falseval || 'false';
  }
}
Parameters.stringArrayFromUrl = function (value) {
  var spec = this;
  var sep = spec.sep || ",";
  return value.split(sep);
}
Parameters.stringArrayToUrl = function (value) {
  var spec = this;
  var sep = spec.sep || ",";
  return value.join(sep);
}
