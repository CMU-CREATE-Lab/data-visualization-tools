define(["app/Class", "jQuery"], function(Class, $) {
  var Json = Class({name: "Json"});

  Json.encode = function (data) {
    return JSON.stringify(data);
  };

  Json.decode = function (data) {
    return JSON.parse(data, Json.reviver);
  };

  Json.reviver = function (key, value) {
    if (value.__jsonclass__ && value.__jsonclass__.length > 0) {
      var args = value.__jsonclass__;

      var constr = window;
      args[0].split('.').map(function (name) {
        constr = constr[name];
      });

      if (!constr.prototype.toJSON) {
        return value;
      }

      var arglist = [];
      for (var i = 1; i < args.length; i++) {
        arglist.push("args[" + i + "]");
      };
      arglist = arglist.join(", ");

      var res = eval("new constr(" + arglist + ")")
      $.extend(res, value);

      return res;
    } else {
      return value;
    }
  };

  return Json;
});
