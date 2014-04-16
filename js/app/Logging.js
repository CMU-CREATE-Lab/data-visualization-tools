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

    _format: function (arg) {
      var res = "";
      if (arg.time) res += arg.time.rfcstring() + ": ";
      res += arg.category + ": ";
      if (arg.msg) {
        res += arg.msg;
      } else {
        res += arg.toString.call(arg);
      }
      if (arg.stack) res += " (" + arg.stack[0] + ")";
      return res;
    },

    _store: function(category, arg) {
      var self = this;

      arg = arg || {};
      arg.category = category;

      if (self.store_time) arg.time = new Date();
      if (self.store_stack) arg.stack = stacktrace().slice(6);

      if (self.print) print(self._format(arg));
      self._storage.push(arg);
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
      return self._storage.slice(start, end).map(self._format.bind(self)).join("\n");
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
