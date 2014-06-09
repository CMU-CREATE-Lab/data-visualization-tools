/*
  tm = new TiledBinFormat({url:"http://127.0.0.1:8000/tiles"});

  tm.events.on({
      "tile-error": function (data) { console.log("tile-error: " + data.exception + " @ " + data.tile.bounds.toBBOX()); },
      "batch": function (data) { console.log("batch: " + data.tile.bounds.toBBOX()); },
      "full-tile": function (data) { console.log("full-tile: " + data.tile.bounds.toBBOX()); },
      "all": function () { console.log("all"); }
  });
  tm.zoomTo(new Bounds(0, 0, 11.25, 11.25));
*/

define(["app/Class", "app/Data/Format", "app/Data/BaseTiledFormat", "app/Data/BinFormat"], function(Class, Format, BaseTiledFormat, BinFormat) {
  var TiledBinFormat = Class(BaseTiledFormat, {
    name: "TiledBinFormat",

    addContentToTile: function (tile) {
      var self = this;
      tile.content = new BinFormat({url:self.url + "/" + tile.bounds.toBBOX()});
      tile.content.setHeaders(self.headers);
    },

    toJSON: function () {
      return {
        type: self.name,
        args: {
          url: self.url
        }
      }
    }
  });
  Format.formatClasses.TiledBinFormat = TiledBinFormat;

  return TiledBinFormat;
});
