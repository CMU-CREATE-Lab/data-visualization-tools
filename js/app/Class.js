/* Class code adapted from OpenLayers; Published under the 2-clause
 * BSD license. See license.txt in the OpenLayers distribution.
 *
 * The API is the same as for OpenLayers, with the added feature that
 * the class can be named using e.g.
 *
 * cls = Class({name: "SomeClassName"});
 *
 * This will be visible in cls.toString(), cls.name and in most
 * debuggers when looking at both the class itself and instances.
 */

define(['lodash'], function(_) {
  var inherit = function(cls, parent) {
    var F = function() {};
    F.prototype = parent.prototype;
    cls.prototype = new F();
    for (var i=2; i < arguments.length; i++) {
      var o = arguments[i];
      if (typeof o === "function") {
        o = o.prototype;
      }
      _.extend(cls.prototype, o);
    }
  };

  return function() {
    var len = arguments.length;
    var first_parent = arguments[0];
    var proto = arguments[len-1];
    var name = proto.name || "AnonymousClass";

    var initialize;
    if (typeof proto.initialize == "function") {
      initialize = proto.initialize;
    } else {
      initialize = function () {
        first_parent.prototype && first_parent.prototype.initialize.apply(this, arguments);
      };
    }

    if (len > 1) {
      inherit.apply(
        null,
        [initialize, first_parent].concat(
          Array.prototype.slice.call(arguments).slice(1, len-1),
          proto));
    } else {
      if (!proto.hasOwnProperty("toString")) {
        proto.toString = function () {
          return "[object " + name + "]";
        }
      }
      initialize.prototype = proto;
    }

    var cls = eval("(function " + name + "() { this.constructor = cls; return initialize.apply(this, arguments); })");
    cls.prototype = initialize.prototype;

    return cls;
  };
});
