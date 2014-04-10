define(["Class", "UrlValues", "stacktrace"], function(Class, UrlValues, stacktrace) {
  print = function () {};
  if (typeof(console) != "undefined" && typeof(console.log) != "undefined") {
    print = console.log.bind(console);
  }

  Logging = Class({
    store_time: true,
    store_stack: true,
    print: true,

    initialize: function (args) {
      var self = this;
      var ignore = self._ignore.bind(self);
      var store = self._store.bind(self);

      for (var key in args) {
        if (key == "filter") continue;
        self[key] = args[key];
      }

      self._filter = {};
      self._storage = [];

      self._filter[""] = ignore;
      if (filter) {
        args.filter.map(function (item) {
          self._filter[item] = store;
        });
      }
    },

    _format: function (arg) {
      var res = "";
      if (arg.time) res += arg.time.rfcstring() + ": ";
      res += arg.category + ": ";
      res += arg.msg;
      if (arg.stack) res += " (" + arg.stack[0] + ")";
      return res;
    },

    _store: function(arg) {
      var self = this;

      if (self.print) print(self._format(arg));
      self._storage.push(arg);
    },

    _ignore: function(arg) {},

    log: function(category, arg) {
      var self = this;

      arg.category = category;

      if (self.store_time) arg.time = new Date();
      if (self.store_stack) arg.stack = stacktrace().slice(4);
      if (self._filter[category]) return self._filter[category](arg);

      category = category.split(".");
      var i;
      var c;
      var filter;

      for (i = category.length - 1; i >= 0; i--) {
        filter = self._filter[category.slice(0, i).join(".")];
        if (filter) {
          for (i++; i <= category.length; i++) {
            self._filter[category.slice(0, i).join(".")] = filter;
          }
          break;
        }
      }
      filter(arg);
    },

    format: function (start, end) {
      var self = this;
      return self._storage.slice(start, end).map(self._format.bind(self)).join("\n");
    }
  });

  var filter = UrlValues.getParameter("log");
  if (filter) {
    filter = filter.split(",");
  } else {
    filter = [];
  }

  Logging.default = new Logging({filter:filter});

  return Logging;
});
