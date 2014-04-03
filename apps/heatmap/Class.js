/* Class code adapted from OpenLayers; Published under the 2-clause BSD license. See license.txt in the OpenLayers distribution. */
Class = function() {
  var len = arguments.length;
  var first_parent = arguments[0];
  var proto = arguments[len-1];

  var cls;
  if (typeof proto.initialize == "function") {
    cls = proto.initialize;
  } else {
    cls = function () {
      first_parent.prototype.initialize.apply(this, arguments);
    };
  }

  if (len > 1) {
    inherit.apply(
      null,
      [cls, first_parent].concat(
        Array.prototype.slice.call(arguments).slice(1, len-1),
        proto));
  } else {
    cls.prototype = proto;
  }
  return cls;
};

function inherit(cls, parent) {
  var F = function() {};
  F.prototype = parent.prototype;
  cls.prototype = new F();
  for (var i=2; i < arguments.length; i++) {
    var o = arguments[i];
    if (typeof o === "function") {
      o = o.prototype;
    }
    $.extend(cls.prototype, o);
  }
};
