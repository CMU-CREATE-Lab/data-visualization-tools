define(["Class"], function(Class) {
  var UrlValues = Class({
    /*
      spec = {
        latitude: {fromurl: UrlValues.floatFromUrl, precision: 1000, tourl: UrlValues.floatToUrl, urlname: "lat"},
        paused: {fromurl: UrlValues.boolFromUrl, tourl: UrlValues.boolToUrl, urlname: "paused", trueval: "yes", falseval: "no"},
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

  UrlValues.intFromUrl = parseInt;
  UrlValues.intToUrl = function (value) { return value.toString(); };
  UrlValues.floatFromUrl = parseFloat;
  UrlValues.floatToUrl = function (value) {
    var spec = this;
    if (spec.precision != undefined) {
      value = Math.round(value * spec.precision)/spec.precision;
    }
    return value.toString();
  }
  UrlValues.boolFromUrl = function (value) {
    var spec = this;
    var trueval = spec.trueval || 'true';
    if (value == trueval) return true;
    return false;
  }
  UrlValues.boolToUrl = function (value) {
    var spec = this;
    if (value) {
      return spec.trueval || 'true';
    } else {
      return spec.falseval || 'false';
    }
  }
  UrlValues.stringArrayFromUrl = function (value) {
    var spec = this;
    if (value == "") return [];
    var sep = spec.sep || ",";
    return value.split(sep);
  }
  UrlValues.stringArrayToUrl = function (value) {
    var spec = this;
    var sep = spec.sep || ",";
    return value.join(sep);
  }

  return UrlValues;
});
