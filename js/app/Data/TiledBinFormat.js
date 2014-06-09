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

define(["app/Class", "app/Events", "app/Bounds", "app/Data/Format", "app/Data/Tile", "app/Data/Pack", "app/Logging", "jQuery", "app/LangExtensions"], function(Class, Events, Bounds, Format, Tile, Pack, Logging, $) {
  var TiledBinFormat = Class(Format, {
    name: "TiledBinFormat",
    initialize: function() {
      var self = this;
      self.tilesetHeader = {};
      /* Any tiles we have loaded that we still need (maybe because
       * they are wanted, or no wanted tile for that area has loaded
       * fully yet */
      self.tileCache = {};
      /* The tiles we really want to display. Might not all be loaded yet, or might have replacements... */
      self.wantedTiles = {};
      Format.prototype.initialize.apply(self, arguments);
    },

    tilesPerScreenX: 2,
    tilesPerScreenY: 2,

    world: new Bounds(-180, -90, 180, 90),

    setHeaders: function (headers) {
      var self = this;
      self.headers = headers || {};
    },

    load: function () {
      var self = this;
      if (self.error) {
        /* Rethrow error, to not confuse code that expects either an
         * error or a load event... */
        self.events.triggerEvent("error", self.error);
        return;
      }

      $.ajax({
        url: self.url + "/header",
        dataType: 'json',
        beforeSend: function(jqXHR, settings) {
          for (var key in self.headers) {
            var values = self.headers[key]
            if (typeof(values) == "string") values = [values];
            for (var i = 0; i < values.length; i++) {
              jqXHR.setRequestHeader(key, values[i]);
            }
          }
          return true;
        },
        success: function(data, textStatus, jqXHR) {
          self.tilesetHeader = data;

          if (data.colsByName) {
            Object.values(data.colsByName).map(function (col) {
              col.typespec = Pack.typemap.byname[col.type];
            });
          }

          self.mergeTiles();
          self.events.triggerEvent("header", data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          self.handleError({
            textStatus: textStatus,
            status: jqXHR.status,
            toString: function () {
              return "HTTP status for header: " + this.textStatus + "(" + this.status.toString() + ")";
            }
          });
        }
      });
      self.events.triggerEvent("load");
    },

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

      if (tilewidth > self.world.getWidth() || tileheight > self.world.getHeight()) {
        return undefined;
      } 

      var tileleft = tilewidth * Math.floor(bounds.left / tilewidth);
      var tilebottom = tileheight * Math.floor(bounds.bottom / tileheight);

      return new Bounds(tileleft, tilebottom, tileleft + tilewidth, tilebottom + tileheight);
    },

    zoomTo: function (bounds) {
      var self = this;
      if (self.error) {
        /* Retrow error, to not confuse code that expects either an
         * error or a load event... */
        self.events.triggerEvent("error", self.error);
        return;
      }

      var oldBounds = self.bounds;
      self.bounds = bounds;

      self.events.triggerEvent("load");

      var wantedTileBounds = self.tileBoundsForRegion(bounds);
      var wantedTiles = {};
      var oldWantedTiles = self.wantedTiles;
      wantedTileBounds.map(function (tilebounds) {
        var key = tilebounds.toBBOX();
        if (oldWantedTiles[key] != undefined) {
          wantedTiles[key] = oldWantedTiles[tilebounds.toBBOX()];
        } else {
          wantedTiles[key] = self.setUpTile(tilebounds);
        }
        wantedTiles[key].reference();
      });
      self.wantedTiles = wantedTiles;

      Logging.default.log("Data.TiledBinFormat.zoomTo", {
        oldBounds: oldBounds,
        newBounds: bounds,
        newWantedTiles: Object.keys(wantedTiles),
        oldWantedTiles: Object.keys(oldWantedTiles),
        toString: function () {
          var self = this;
          var newWantedTiles = this.newWantedTiles.filter(function (bbox) {
              return self.oldWantedTiles.indexOf(bbox) == -1
          }).join(", ");
          var oldWantedTiles = this.oldWantedTiles.filter(function (bbox) {
              return self.newWantedTiles.indexOf(bbox) == -1
          }).join(", ");
          var existing_wantedTiles = this.newWantedTiles.filter(function (bbox) {
              return self.oldWantedTiles.indexOf(bbox) != -1
          }).join(", ");
          var oldBounds = self.oldBounds != undefined ? self.oldBounds.toBBOX() : "undefined";
          var newBounds = self.newBounds != undefined ? self.newBounds.toBBOX() : "undefined";
          return oldBounds + " -> " + newBounds + ":\n  Added: " + newWantedTiles + "\n  Removed: " + oldWantedTiles + "\n  Kept: " + existing_wantedTiles + "\n";
        }
      });

      Object.items(oldWantedTiles).map(function (item) {
        item.value.dereference();
      });

      // Merge any already loaded tiles
      self.mergeTiles();

      wantedTileBounds.map(function (tilebounds) {
        self.wantedTiles[tilebounds.toBBOX()].load();
      });
    },

    setUpTile: function (tilebounds) {
      var self = this;
      var key = tilebounds.toBBOX();

      if (!self.tileCache[key]) {
        var tile = new Tile(self, tilebounds);
        tile.events.on({
          "batch": self.handleBatch.bind(self, tile),
          "all": self.handleFullTile.bind(self, tile),
          "error": self.handleTileError.bind(self, tile),
          "destroy": self.handleTileRemoval.bind(self, tile),
          scope: self
        });
        self.tileCache[key] = tile;
      }

      return self.tileCache[key];
    },

    handleTileRemoval: function (tile) {
      var self = this;
      delete self.tileCache[tile.bounds.toBBOX()];
    },

    handleBatch: function (tile) {
      var self = this;

      return;
    },

    handleFullTile: function (tile) {
      var self = this;

      self.mergeTile(tile);

      var e;
      e = {update: "full-tile", tile: tile};
      self.events.triggerEvent(e.update, e);

      var allDone = Object.values(self.tileCache
        ).map(function (tile) { return tile.allIsLoaded; }
        ).reduce(function (a, b) { return a && b; });

      if (allDone) {
        e = {update: "all", tile: tile};
        self.events.triggerEvent(e.update, e);
        self.events.triggerEvent("update", e);
      }

      self.events.triggerEvent("update", e);
    },

    handleTileError: function (tile, data) {
      var self = this;
      data.tile = tile;
      var bounds = self.extendTileBounds(tile.bounds);

      if (bounds) {
        var replacement = self.setUpTile(bounds);
        tile.replace(replacement);
        replacement.load();

        self.events.triggerEvent("tile-error", data);
      } else {
        self.handleError(data);
      }
    },

    handleError: function (originalEvent) {
      var self = this;
      self.error = {
        original: originalEvent,
        source: self.url,
        toString: function () {
          var self = this;
          return 'Could not load tileset ' + self.source + ' due to the following error: ' + self.original.toString();
        }
      };
      self.events.triggerEvent("error", self.error);
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

      function compareTiles(a, b) {
        if (a.value.compareRows(a.merged_rowcount, b.value, b.merged_rowcount) > 0) {
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
      $.extend(true, dst.header, self.tilesetHeader);

      if (tiles == undefined) {
        tiles = Object.values(self.tileCache).filter(function (tile) {
          return tile.allIsLoaded;
        });
      }

      tiles = tiles.map(function (tile) {
        return {value: tile, merged_rowcount: 0};
      });

      var coalesce = function(fn, val1, val2) {
        if (val1 == undefined) return val2;
        if (val2 == undefined) return val1;
        return fn(val1, val2);
      }

      // FIXME: Handle min/max values correctly here!!!!
      tiles.map(function (tile) {
        if (!tile.value.header) return;

        dst.header.length += tile.value.header.length;

        Object.items(tile.value.header.colsByName).map(function (item) {
          var dstval = dst.header.colsByName[item.key] || {};
          var srcval = item.value || {};

          var min = coalesce(Math.min, dstval.min, srcval.min);
          var max = coalesce(Math.max, dstval.max, srcval.max);
          $.extend(dstval || {}, srcval);
          dstval.min = min;
          dstval.max = max;

          dst.header.colsByName[item.key] = dstval;
        });
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

      self.header.length = dst.header.length;
      self.header.colsByName = dst.header.colsByName;
      self.data = dst.data;
      self.rowcount = dst.rowcount;
      self.seriescount = dst.seriescount;

      var end = new Date();
      Logging.default.log("Data.TiledBinFormat.mergeTiles", {start: start, end: end, toString: function () { return ((this.end - this.start) / 1000.0).toString(); }});
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
  TiledBinFormat.DataContainer = Class(Format, {name: "DataContainer"});
  Format.formatClasses.TiledBinFormat = TiledBinFormat;

  return TiledBinFormat;
});
