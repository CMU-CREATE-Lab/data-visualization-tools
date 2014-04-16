/* Class code adapted from OpenLayers; Published under the 2-clause BSD license. See license.txt in the OpenLayers distribution. */

define(['jQuery'], function($) {
  var inherit = function(cls, parent) {
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

  return function() {
    var len = arguments.length;
    var first_parent = arguments[0];
    var proto = arguments[len-1];

    var initialize;
    if (typeof proto.initialize == "function") {
      initialize = proto.initialize;
    } else {
      initialize = function () {
        first_parent.prototype.initialize.apply(this, arguments);
      };
    }

    if (len > 1) {
      inherit.apply(
        null,
        [initialize, first_parent].concat(
          Array.prototype.slice.call(arguments).slice(1, len-1),
          proto));
    } else {
      initialize.prototype = proto;
    }

    var cls = eval("(function " + (proto.name || "AnonymousClass") + "() { return initialize.apply(this, arguments); })");
    cls.prototype = initialize.prototype;

    return cls;
  };
});
