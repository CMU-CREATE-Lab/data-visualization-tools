define(["app/Class", "lodash"], function(Class, _) {
  var Json = Class({name: "Json"});

  Json.encode = function (data, indent) {
    return JSON.stringify(data, undefined, indent);
  };

    Json.decode = function (data, indent) {
        return JSON.parse(data, Json.reviver, indent);
  };

  Json.reviver = function (key, value) {
    if (value && value.__jsonclass__ && value.__jsonclass__.length > 0) {
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
      _.extend(res, value);

      return res;
    } else {
      return value;
    }
  };

  return Json;
});
