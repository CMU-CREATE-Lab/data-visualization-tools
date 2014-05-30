define(["app/Class", "app/Data/BinFormat"], function(Class, BinFormat) {
  return Class(BinFormat, {
    name: "Tile",
    initialize: function(manager, bounds) {
      var self = this;
      self.manager = manager;
      self.bounds = bounds;

      self.replacement = undefined;
      self.usage = 0;

      BinFormat.prototype.initialize.call(self, {url:self.manager.url + "/" + self.bounds.toBBOX()});
      self.setHeaders(self.manager.headers);
    },

    verify: function () {
      var self = this;
      var res = {
        real: {
          outside: 0,
          inside: 0
        },
        virtual: {
          outside: 0,
          inside: 0
        },
        total: self.rowcount
      };

      var namebyvirt = {false: 'real', true: 'virtual'};
      var namebyinout = {false: 'outside', true: 'inside'};

      for (var i = 0; i < self.rowcount; i++) {
        var virtname = namebyvirt[self.data.virtual && !!self.data.virtual[i]];
        var inoutname = namebyinout[self.bounds.contains(self.data.longitude[i], self.data.latitude[i])];
        res[virtname][inoutname]++;
      }
      return res;
    },

    replace: function (replacement) {
      if (replacement) {
        replacement.reference();
      }
      if (self.replacement) {
        self.replacement.dereference();
      }
      self.replacement = replacement;
    },

    reference: function () {
      self.usage++;
    },

    dereference: function () {
      self.usage--;
      if (self.usage <= 0) {
        self.destroy();
      }
    },

    destroy: function () {
      item.value.cancel();
      if (self.replacement) {
        self.replacement.dereference()
      }
      self.events.triggerEvent("destroy");
    },

    toString: function () {
      return self.bounds.toString();
    },

    toJSON: function () {
      return self.bounds;
    }

  });
});
