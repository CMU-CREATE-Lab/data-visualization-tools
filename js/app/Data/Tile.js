define(["app/Class", "app/Data/BinFormat", "app/Events"], function(Class, BinFormat, Events) {
  return Class({
    name: "Tile",
    initialize: function(manager, bounds) {
      var self = this;
      self.manager = manager;
      self.bounds = bounds;

      self.overlaps = [];
      self.replacement = undefined;
      self.usage = 0;

      self.events = new Events("Data.Tile");
      self.content = new BinFormat({url:self.manager.url + "/" + self.bounds.toBBOX()});
      self.content.setHeaders(self.manager.headers);

      self.findOverlaps();
    },

    verify: function () {
      var self = this;
      var content = self.content;

      var res = {
        real: {
          outside: 0,
          inside: 0
        },
        virtual: {
          outside: 0,
          inside: 0
        },
        total: content.rowcount
      };

      var namebyvirt = {false: 'real', true: 'virtual'};
      var namebyinout = {false: 'outside', true: 'inside'};

      for (var i = 0; i < content.rowcount; i++) {
        var virtname = namebyvirt[content.data.virtual && !!content.data.virtual[i]];
        var inoutname = namebyinout[self.bounds.contains(content.data.longitude[i], content.data.latitude[i])];
        res[virtname][inoutname]++;
      }
      return res;
    },

    findOverlaps: function () {
      var self = this;
      self.overlaps = Object.values(self.manager.tileCache).filter(function (tile) {
        return tile.bounds.intersectsBounds(self.bounds);
      });
      self.overlaps.map(function (tile) {
        tile.reference();
      });
    },

    removeOverlaps: function () {
      var self = this;
      self.overlaps.map(function (tile) {
        tile.dereference();
      });
      self.overlaps = [];
    },

    allLoaded: function () {
      var self = this;
      self.removeOverlaps();
      BinFormat.prototype.allLoaded.apply(self, arguments);
    },

    replace: function (replacement) {
      var self = this;
      if (replacement) {
        replacement.reference();
      }
      if (self.replacement) {
        self.replacement.dereference();
      }
      self.replacement = replacement;
    },

    reference: function () {
      var self = this;
      self.usage++;
    },

    dereference: function () {
      var self = this;
      self.usage--;
      if (self.usage <= 0) {
        self.destroy();
      }
    },

    destroy: function () {
      var self = this;
      self.cancel();
      self.removeOverlaps();
      if (self.replacement) {
        self.replacement.dereference();
      }
      self.events.triggerEvent("destroy");
    },

    toString: function () {
      var self = this;
      return self.bounds.toString();
    },

    toJSON: function () {
      var self = this;
      return self.bounds;
    }

  });
});
