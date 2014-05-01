define(["app/Class", "app/Data/BinFormat"], function(Class, BinFormat) {
  return Class(BinFormat, {
    name: "Tile",
    initialize: function(manager, bounds) {
      var self = this;
      self.manager = manager;
      self.bounds = bounds;

      BinFormat.prototype.initialize.call(self, self.manager.source + "/" + self.bounds.toBBOX());
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
    }
  });
});
