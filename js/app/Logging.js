define(["Class", "UrlValues", "stacktrace"], function(Class, UrlValues, stacktrace) {
  print = function () {};
  if (typeof(console) != "undefined" && typeof(console.log) != "undefined") {
    print = console.log.bind(console);
  }

  Logging = Class({
    name: "Logging",
    store_time: true,
    store_stack: true,
    print: true,

    initialize: function (args) {
      var self = this;
      var ignore = self._ignore.bind(self);
      var store = self._store.bind(self);

      for (var key in args) {
        if (key == "include" || key == "exclude") continue;
        self[key] = args[key];
      }

      self._filter = {};
      self._storage = [];

      self._filter[""] = ignore;
      if (args.include) {
        args.include.map(function (item) {
          self._filter[item] = store;
        });
      }
      if (args.exclude) {
        args.exclude.map(function (item) {
          self._filter[item] = ignore;
        });
      }
    },

    _store: function(category, data) {
      var self = this;

      var entry = new Logging.Entry();
      entry.category = category;
      entry.data = data;
      if (self.store_time) entry.time = new Date();
      if (self.store_stack) entry.stack = stacktrace().slice(6);

      if (self.print) print(entry.toString());
      self._storage.push(entry);
    },

    _ignore: function() {},

    log: function(category, arg) {
      var self = this;

      /* Important: Keep the amount of work needed here to a bare
       * minimum, especially for the case when the filter is set to
       * ignore for the current category.
       */

      var filter = self._filter[category];
      if (!filter) {
        var categorylist = category.split(".");
        var i;
        var c;
        var filter;

        for (i = categorylist.length - 1; i >= 0; i--) {
          filter = self._filter[categorylist.slice(0, i).join(".")];
          if (filter) {
            for (i++; i <= categorylist.length; i++) {
              self._filter[categorylist.slice(0, i).join(".")] = filter;
            }
            break;
          }
        }
      }
      filter(category, arg);
    },

    format: function (start, end) {
      var self = this;
      return self._storage.slice(start, end).join("\n");
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
    }
  });

  var log = UrlValues.getParameter("log");
  if (log != undefined) {
    log = log.split(",");
  } else {
    log = [];
  }
  Logging.default = new Logging({
    include:log.filter(function (item) { return item.indexOf("-") != 0; }),
    exclude: log.filter(function (item) { return item.indexOf("-") == 0; }).map(function (item) { return item.substr(1); })
  });

  return Logging;
});
