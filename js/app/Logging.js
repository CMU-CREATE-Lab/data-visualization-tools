define(["app/Class", "app/UrlValues", "stacktrace", "lodash", "app/Logging/Destination", "app/Logging/ScreenDestination", "app/Logging/StoreDestination", "app/Logging/LogglyDestination", "app/Logging/ServerDestination"], function(Class, UrlValues, stacktrace, _, Destination) {
  Logging = Class({
    name: "Logging",
    store_time: true,
    store_stack: true,

    initialize: function (args) {
      var self = this;
      self.rules = {};
      _.extend(self, args);
      self.setRules(self.rules);
    },

    rulesToRuleTree: function(rules) {
      var self = this;
      /* rules[dstname].rules = [{path:..., include:true/false},...]
       * rules[path][destination] = true/false
       */
      var ruleTree = {};
      Object.items(rules).map(function (item) {
        var rules = item.value.rules;
        if (typeof(rules) == 'string') {
          rules = rules.split(",");
        }
        rules = rules || [];
        rules.map(function (rule) {
          if (typeof(rule) == 'string') {
            var exclude = rule.indexOf("-") == 0;
            if (exclude) {
              rule = rule.substr(1);
            }
            if (rule == "all") {
              rule = "";
            }
            rule = {path:rule, include:!exclude};
          }

          if (ruleTree[rule.path] == undefined) {
            ruleTree[rule.path] = {};
          }
          ruleTree[rule.path][item.key] = rule.include;
        });
      });
      return ruleTree;
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

    setRules: function(rules) {
      var self = this;

      self.rules = rules;

      self.destinations = {};
      for (var destination in rules) {
        self.destinations[destination] = new Destination.destinationClasses[destination](rules[destination].args);
      }

      var ruleTree = self.rulesToRuleTree(rules);

      var ignore = self.ignore.bind(self);

      self.compiledRules = {"":ignore};
      Object.items(ruleTree).map(function (ruleitem) {
        var path = ruleitem.key;
        var storefns = Object.items(
          ruleitem.value
        ).filter(function (dstitem) {
          return dstitem.value;
        }).map(function (dstitem) {
          return self.destinations[dstitem.key].store.bind(self.destinations[dstitem.key]);
        });
        if (storefns.length > 0) {
          self.compiledRules[path] = function (category, data) { self.store(storefns, category, data); }
        } else {
          self.compiledRules[path] = ignore;
        }
      });
    },

    log: function(category, arg) {
      var self = this;

      /* Important: Keep the amount of work needed here to a bare
       * minimum, especially for the case when the filter is set to
       * ignore for the current category.
       */

      var rule = self.compiledRules[category];
      if (!rule) {
        var categorylist = category.split(".");
        var i;
        var c;
        var filter;

        for (i = categorylist.length - 1; i >= 0; i--) {
          rule = self.compiledRules[categorylist.slice(0, i).join(".")];
          if (rule) {
            for (i++; i <= categorylist.length; i++) {
              self.compiledRules[categorylist.slice(0, i).join(".")] = rule;
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
    },

    toJSON: function () {
      var self = this;

      var res = _.clone(self);
      res.msg = self.toString();
      return res;
    }
  });

  Logging.default = new Logging({
    rules: {
      "screen": {"rules": ["Data.TypedMatrixParser.error", "Data.Format.error"]},
    }
  });

  return Logging;
});
