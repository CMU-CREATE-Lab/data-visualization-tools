/*
  tm = new TileManager("http://127.0.0.1:8000/tiles");

  tm.events.on({
      "tile-error": function (data) { console.log("tile-error: " + data.exception + " @ " + data.tile.bounds.toBBOX()); },
      "batch": function (data) { console.log("batch: " + data.tile.bounds.toBBOX()); },
      "full-tile": function (data) { console.log("full-tile: " + data.tile.bounds.toBBOX()); },
      "all": function () { console.log("all"); }
  });
  tm.zoomTo(new Bounds(0, 0, 11.25, 11.25));
*/

define(["Class", "Events", "Bounds", "Data/Format", "Data/Tile", "Logging", "jQuery", "LangExtensions"], function(Class, Events, Bounds, Format, Tile, Logging, $) {
  var TiledBinFormat = Class(Format, {
    name: "TiledBinFormat",
    initialize: function(source) {
      var self = this;
      self.source = source;
      self.tiles = {};
      Format.prototype.initialize.apply(self, arguments);
    },

    tilesPerScreenX: 2,
    tilesPerScreenY: 2,
    sortcols: ['series', 'datetime'],

    world: new Bounds(-180, -90, 180, 90),



    tileBoundsForRegion: function(bounds) {
      /* Returns a list of tile bounds covering a region. */

      var self = this;

      var width = bounds.getWidth();
      var height = bounds.getHeight();
      var worldwidth = self.world.getWidth();
      var worldheight = self.world.getHeight();

      var level = Math.ceil(Math.max(
        Math.log(worldwidth / (width/self.tilesPerScreenX), 2),
        Math.log(worldheight / (height/self.tilesPerScreenY), 2)));

      var tilewidth = worldwidth / Math.pow(2, level);
      var tileheight = worldheight / Math.pow(2, level);

      var tileleft = tilewidth * Math.floor(bounds.left / tilewidth);
      var tileright = tilewidth * Math.ceil(bounds.right / tilewidth);
      var tilebottom = tileheight * Math.floor(bounds.bottom / tileheight);
      var tiletop = tileheight * Math.ceil(bounds.top / tileheight);

      var tilesx = (tileright - tileleft) / tilewidth;
      var tilesy = (tiletop - tilebottom) / tileheight;

      Logging.default.log(
        "Data.TiledBinFormat.tileBoundsForRegion",
        {
          width: width,
          height: height,
          worldwidth: worldwidth,
          worldheight: worldheight,

          tilesPerScreenX: self.tilesPerScreenX,
          tilesPerScreenY: self.tilesPerScreenY,

          level: level,

          tilewidth: tilewidth,
          tileheight: tileheight,

          tileleft: tileleft,
          tileright: tileright,
          tilebottom: tilebottom,
          tiletop: tiletop,

          tilesx: tilesx,
          tilesy: tilesy,

          toString: function () {
            return "\n" + Object.items(this
              ).filter(function (item) { return item.key != "toString" && item.key != "stack"; }
              ).map(function (item) { return "  " + item.key + "=" + item.value.toString(); }
              ).join("\n") + "\n";
          }
        }
      );

      res = [];
      for (var x = 0; x < tilesx; x++) {
        for (var y = 0; y < tilesy; y++) {
          res.push(new Bounds(tileleft + x * tilewidth, tilebottom + y * tileheight, tileleft + (x+1) * tilewidth, tilebottom + (y+1) * tileheight));
        }
      }

      return res;
    },

    extendTileBounds: function (bounds) {
     /* Returns the first larger tile bounds enclosing the tile bounds
      * sent in. Note: Parameter bounds must be for a tile, as returned
      * by a previous call to tileBoundsForRegion or
      * extendTileBounds. */

      var self = this;

      var tilewidth = bounds.getWidth() * 2;
      var tileheight = bounds.getHeight() * 2;

      var tileleft = tilewidth * Math.floor(bounds.left / tilewidth);
      var tilebottom = tileheight * Math.floor(bounds.bottom / tileheight);

      return new Bounds(tileleft, tilebottom, tileleft + tilewidth, tilebottom + tileheight);
    },

    zoomTo: function (bounds) {
      self = this;
      var old_bounds = self.bounds;
      self.bounds = bounds;

      self.events.triggerEvent("load");

      var tiles = {};
      var old_tiles = self.tiles;
      self.tileBoundsForRegion(bounds).map(function (tilebounds) {
        if (old_tiles[tilebounds.toBBOX()] != undefined) {
          tiles[tilebounds.toBBOX()] = old_tiles[tilebounds.toBBOX()];
        } else {
          tiles[tilebounds.toBBOX()] = self.setUpTile(tilebounds);
        }
      });
      self.tiles = tiles;

      Logging.default.log("Data.TiledBinFormat.zoomTo", {
        old_bounds: old_bounds,
        new_bounds: bounds,
        new_tiles: Object.keys(tiles),
        old_tiles: Object.keys(old_tiles),
        toString: function () {
          var self = this;
          var new_tiles = this.new_tiles.filter(function (bbox) {
              return self.old_tiles.indexOf(bbox) == -1
          }).join(", ");
          var old_tiles = this.old_tiles.filter(function (bbox) {
              return self.new_tiles.indexOf(bbox) == -1
          }).join(", ");
          var existing_tiles = this.new_tiles.filter(function (bbox) {
              return self.old_tiles.indexOf(bbox) != -1
          }).join(", ");
          var old_bounds = self.old_bounds != undefined ? self.old_bounds.toBBOX() : "undefined";
          var new_bounds = self.new_bounds != undefined ? self.new_bounds.toBBOX() : "undefined";
          return old_bounds + " -> " + new_bounds + ":\n  Added: " + new_tiles + "\n  Removed: " + old_tiles + "\n  Kept: " + existing_tiles + "\n";
        }
      });

      // Cancel the loading of any tiles we aren't gonna use any more that are still loading...
      Object.items(old_tiles).map(function (item) {
        if (tiles[item.key] == undefined) {
          item.value.cancel();
        }
      });

      // Merge any already loaded tiles
      self.mergeTiles();

      self.tileBoundsForRegion(bounds).map(function (tilebounds) {
        tiles[tilebounds.toBBOX()].load();
      });
    },

    setUpTile: function (tilebounds) {
      var self = this;
      var tile = new Tile(self, tilebounds);
      tile.events.on({
        "batch": function () { self.handleBatch(tile); },
        "all": function () { self.handleFullTile(tile); },
        "error": function (data) { self.handleTileError(data, tile); },
        scope: self
      });
      return tile;
    },

    handleBatch: function (tile) {
      var self = this;

      return;
    },

    handleFullTile: function (tile) {
      var self = this;

      self.mergeTile(tile);

      var all_done = self.getTiles(
        ).map(function (tile) { return tile.header && tile.header.length == tile.rowcount }
        ).reduce(function (a, b) { return a && b; });

      var e;
      if (all_done) {
        e = {update: "all"};
      } else {
        e = {update: "full-tile", tile: tile};
      }
      self.events.triggerEvent(e.update, e);
      self.events.triggerEvent("update", e);
    },

    handleTileError: function (data, tile) {
      var self = this;

      tile.replacement = self.setUpTile(self.extendTileBounds(tile.bounds));
      tile.replacement.load();

      data.tile = tile;
      self.events.triggerEvent("tile-error", data);
    },

    getTiles: function () {
      return Object.values(self.tiles).map(function (tile) {
        while (tile.replacement != undefined) tile = tile.replacement;
        return tile;
      });
    },

    mergeTile: function (tile) {
      var self = this;
      // A TiledBinFormat instance can be treated as a tile itself, as
      // it's a subclass of Format. This way, we can merge one more
      // tile without revisiting all the other already loaded tiles.
      self.mergeTiles([self, tile]);
    },

    mergeTiles: function (tiles) {
      var self = this;

      function compareTileData(a, aidx, b, bidx) {
        function compareTilesByCol(colidx) {
          if (colidx > self.sortcols.length) return 0;
          var col = self.sortcols[colidx];
          if (a.value.data[col] == undefined || b.value.data[col] == undefined) {
            // Ignore any sort columns we don't have...
            return compareTilesByCol(colidx + 1);
          } else if (a.value.data[col][aidx] < b.value.data[col][bidx]) {
            return -1;
          } else if (a.value.data[col][aidx] > b.value.data[col][bidx]) {
            return 1;
          } else {
            return compareTilesByCol(colidx + 1);
          }
        }
        return compareTilesByCol(0);
      }

      function compareTiles(a, b) {
        if (compareTileData(a, a.merged_rowcount, b, b.merged_rowcount) > 0) {
          return b;
        } else {
          return a;
        }
      }

      function nextTile(tiles) {
        if (!tiles.length) return undefined;
        res = tiles.reduce(function (a, b) {
          if (a.value.data == undefined || b.merged_rowcount >= b.value.rowcount) return a;
          if (b.value.data == undefined || a.merged_rowcount >= a.value.rowcount) return b;
          return compareTiles(a, b);
        });
        if (res.merged_rowcount >= res.value.rowcount) return undefined;
        res.merged_rowcount++;
        return res;
      }

      var start = new Date();

      dst = new TiledBinFormat.DataContainer();

      if (tiles == undefined) {
        tiles = self.getTiles();
      }

      tiles = tiles.map(function (tile) {
        return {value: tile, merged_rowcount: 0};
      });

      // FIXME: Handle min/max values correctly here!!!!
      tiles.map(function (tile) {
        if (!tile.value.header) return;

        dst.header.length += tile.value.header.length;
        dst.header.colsByName = $.extend(dst.header.colsByName, tile.value.header.colsByName);
      });

      for (var name in dst.header.colsByName) {
        var col = dst.header.colsByName[name];
        dst.data[name] = new col.typespec.array(dst.header.length);
      }

      var lastSeries = function () {}; // Magic unique value
      var tile;
      while (tile = nextTile(tiles)) {
        for (var name in dst.data) {
          if (tile.value.data[name] == undefined) {
            dst.data[name][dst.rowcount] = NaN;
          } else {
            dst.data[name][dst.rowcount] = tile.value.data[name][tile.merged_rowcount-1];
          }
        }
        dst.rowcount++;
        if (tile.value.data.series[tile.merged_rowcount-1] != lastSeries) {
          dst.seriescount++;
          lastSeries = tile.value.data.series;
        }
      }

      self.header = dst.header;
      self.data = dst.data;
      self.rowcount = dst.rowcount;
      self.seriescount = dst.seriescount;

      var end = new Date();
      Logging.default.log("Data.TiledBinFormat.mergeTiles", {start: start, end: end, toString: function () { return ((this.end - this.start) / 1000.0).toString(); }});
    }
  });
  TiledBinFormat.DataContainer = Class(Format, {});
  Format.formatClasses.tiledbin = TiledBinFormat;

  return TiledBinFormat;
});
