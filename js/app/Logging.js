define(["app/Class", "app/UrlValues", "stacktrace", "jQuery", "LogglyTracker"], function(Class, UrlValues, stacktrace, $, LogglyTracker) {
  print = function () {};
  if (typeof(console) != "undefined" && typeof(console.log) != "undefined") {
    print = console.log.bind(console);
  }
  Logging = Class({
    name: "Logging",
    store_time: true,
    store_stack: true,

    initialize: function (args) {
      var self = this;

      $.extend(self, args);
      self.rules = self.compileRules(self.destinations);
    },

    flattenRules: function (rules) {
      var self = this;
      Object.items(rules).map(function (item) {
        var path = item.key.split(".");
        var rule = {};
        for (i = 0; i < path.length - 1; i++) {
          var parentpath = path.slice(0, i).join(".");
          if (rules[parentpath] != undefined) {
            rules[parentpath] = $.extend({}, rule, rules[parentpath]);
          } else {
            rules[parentpath] = $.extend({}, rule);
          }
        }
      });
      return rules;
    },

    destinationsToRules: function(destinations) {
      var self = this;
      /* destinations[dstname].rules = [{path:..., include:true/false},...]
       * destinations[dstname].instance = new LogDestination();
       * rules[path][destination] = true/false
       */
      var rules = {};
      Object.items(destinations).map(function (item) {
        item.value.rules.map(function (rule) {
          if (rules[rule.path] == undefined) {
            rules[rule.path] = {};
          }
          rules[rule.path][item.key] = rule.include;
        });
      });
      return rules;
    },

    compileRules: function(destinations) {
      var self = this;

      rules = self.flattenRules(self.destinationsToRules(destinations));

      var ignore = self.ignore.bind(self);
      var rulefns = {"":ignore};
      Object.items(rules).map(function (ruleitem) {
        var path = ruleitem.key;
        var storefns = Object.items(
          ruleitem.value
        ).filter(function (dstitem) {
          return dstitem.value;
        }).map(function (dstitem) {
          return destinations[dstitem.key].instance.store.bind(destinations[dstitem.key].instance);
        });
        if (storefns.length > 0) {
          rulefns[path] = function (category, data) { self.store(storefns, category, data); }
        } else {
          rulefns[path] = ignore;
        }
      });

      return rulefns;
    },

    store: function(storefns, category, data) {
      var self = this;

      var entry = new Logging.Entry();
      entry.category = category;
      entry.data = data;
      if (self.store_time) entry.time = new Date();
      if (self.store_stack) entry.stack = stacktrace().slice(6);

      storefns.map(function (fn) { fn(entry); });
    },

    ignore: function() {},

    log: function(category, arg) {
      var self = this;

      /* Important: Keep the amount of work needed here to a bare
       * minimum, especially for the case when the filter is set to
       * ignore for the current category.
       */

      var rule = self.rules[category];
      if (!rule) {
        var categorylist = category.split(".");
        var i;
        var c;
        var filter;

        for (i = categorylist.length - 1; i >= 0; i--) {
          rule = self.rules[categorylist.slice(0, i).join(".")];
          if (rule) {
            for (i++; i <= categorylist.length; i++) {
              self.rules[categorylist.slice(0, i).join(".")] = rule;
            }
            break;
          }
        }
      }
      rule(category, arg);
    },

    logTiming: function (category, arg, cb) {
      var self = this;

      var start = new Date();
      cb(function () {
        var end = new Date();
        arg.timing = end - start;
        self.log(category, arg);
      });
    }
  });

  Logging.parseRules = function (rules) {
    if (rules == undefined) {
      return [];
    }
    rules = rules.split(",");
    return rules.map(function (item) {
      var exclude = item.indexOf("-") == 0;
      if (exclude) {
        item = item.substr(1);
      }
      if (item == "all") {
        item = "";
      }
      return {path:item, include:!exclude};
    });
  }

  Logging.Entry = Class({
    name: "Logging__Entry",
    initialize: function () {},

    toString: function () {
      var self = this;

      var res = "";
      if (self.time) res += self.time.rfcstring() + ": ";
      res += self.category + ": ";
      if (self.data) {
        if (self.data.msg) {
          res += self.data.msg;
        } else if (!self.data.hasOwnProperty("toString") && self.data.constructor === Object) {
          res += JSON.stringify(self.data);
        } else {
          res += self.data.toString.call(self.data);
        }
      }
      if (self.stack) res += " (" + self.stack[0] + ")";
      return res;
    }
  });


  Logging.LogDestination = Class({
    name: "LogDestination",
    initialize: function () {
    }
  });

  Logging.LogDestinationScreen = Class(Logging.LogDestination, {
    name: "LogDestinationScreen",

    store: function(entry) {
      print(entry.toString());
    }
  });

  Logging.LogDestinationStore = Class(Logging.LogDestination, {
    name: "LogDestinationStore",

    initialize: function () {
      var self = this;
      self.storage = [];
    },

    store: function(entry) {
      var self = this;
      self.storage.push(entry);
    },

    get: function (start, end) {
      var self = this;
      return self.storage.slice(start, end);
    },

    format: function () {
      var self = this;
      return self.get.apply(self, arguments).join("\n");
    }
  });

  Logging.LogDestinationLoggly = Class(Logging.LogDestination, {
    name: "LogDestinationLoggly",

    initialize: function (key) {
      var self = this;
      self.key = key;
      self.loggly = new LogglyTracker();
      self.loggly.push({'logglyKey': key});
    },

    store: function(entry) {
      var self = this;

      self.loggly.push(entry);
    }
  });

  var rules = Logging.parseRules(UrlValues.getParameter("log"));
  var destinations = {
    screen: {instance: new Logging.LogDestinationScreen(), rules:rules},
    store: {instance: new Logging.LogDestinationStore(), rules:rules}
  };

  var logglykey = UrlValues.getParameter("loggly-key")
  if (logglykey) {
    var logglyrules = Logging.parseRules(UrlValues.getParameter("loggly-rules"));
    destinations.loggly =  {instance: new Logging.LogDestinationLoggly(logglykey), rules:logglyrules};
  }

  Logging.default = new Logging({destinations: destinations});

  return Logging;
});
