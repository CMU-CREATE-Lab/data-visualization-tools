/*
  tm = new BaseTiledFormat({url:"http://127.0.0.1:8000/tiles"});

  tm.events.on({
      "tile-error": function (data) { console.log("tile-error: " + data.exception + " @ " + data.tile.bounds.toBBOX()); },
      "batch": function (data) { console.log("batch: " + data.tile.bounds.toBBOX()); },
      "full-tile": function (data) { console.log("full-tile: " + data.tile.bounds.toBBOX()); },
      "all": function () { console.log("all"); }
  });
  tm.zoomTo(new Bounds(0, 0, 11.25, 11.25));
*/

define(["app/Class", "app/Events", "app/Bounds", "app/Data/Format", "app/Data/Tile", "app/Data/Pack", "app/Logging", "app/Data/Ajax", "lodash", "app/LangExtensions"], function(Class, Events, Bounds, Format, Tile, Pack, Logging, Ajax, _) {
  var BaseTiledFormat = Class(Format, {
    name: "BaseTiledFormat",
    initialize: function() {
      var self = this;
      self.tilesetHeader = {};
      /* Any tiles we have loaded that we still need (maybe because
       * they are wanted, or no wanted tile for that area has loaded
       * fully yet */
      self.tileCache = {};
      /* The tiles we really want to display. Might not all be loaded yet, or might have replacements... */
      self.wantedTiles = {};
      self.tileIdxCounter = 0;
      Format.prototype.initialize.apply(self, arguments);
    },

    tilesPerScreenX: 2,
    tilesPerScreenY: 2,

    world: new Bounds(-180, -90, 180, 90),

    setHeaders: function (headers) {
      var self = this;
      self.headers = headers || {};
    },

    _load: function () {
      var self = this;
      if (self.error) {
        /* Rethrow error, to not confuse code that expects either an
         * error or a load event... */
        self.events.triggerEvent("error", self.error);
        return;
      }

      if (typeof XMLHttpRequest != "undefined") {
        var url = self.url + "/header";
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        Ajax.setHeaders(request, self.headers);
        request.onreadystatechange = function() {
          if (request.readyState === 4) {
            if (Ajax.isSuccess(request, url)) {
              var data = JSON.parse(request.responseText);

              self.tilesetHeader = data;

              if (data.colsByName) {
                Object.values(data.colsByName).map(function (col) {
                  col.typespec = Pack.typemap.byname[col.type];
                });
              }

              self.mergeTiles();
              self.events.triggerEvent("header", data);
            } else {
              self.handleError(Ajax.makeError(request, url, "header"));
            }
          }
        };
        request.send(null);
      } else {
        self.handleError({
          toString: function () {
            return "XMLHttpRequest not supported";
          }
        });
      }
      self.events.triggerEvent("load");
    },

    getSelectionInfo: function(selection, cb) {
      var self = this;

      var data = {};
      for (var key in selection.data) {
        data[key] = selection.data[key][0];
      }

      var url = self.url + "/series";
      var request = new XMLHttpRequest();
      request.open('POST', url, true);
      Ajax.setHeaders(request, self.headers);
      request.onreadystatechange = function() {
        if (request.readyState === 4) {
          if (Ajax.isSuccess(request, url)) {
            var data = JSON.parse(request.responseText);
            cb(null, data);
          } else {
            var e = Ajax.makeError(request, url, "selection information from ");
            e.source = self;
            self.events.triggerEvent("info-error", e);
          }
        }
      };
      request.send(JSON.stringify(data));
    },

    tileParamsForRegion: function(bounds) {
      var self = this;
      var origBounds = bounds;
      bounds = bounds.unwrapDateLine(self.world);

      var res = {
        bounds: origBounds,
        unwrappedBounds: bounds,
        width: bounds.getWidth(),
        height: bounds.getHeight(),
        worldwidth: self.world.getWidth(),
        worldheight: self.world.getHeight(),

        toString: function () {
          return "\n" + Object.items(this
            ).filter(function (item) { return item.key != "toString" && item.key != "stack"; }
            ).map(function (item) { return "  " + item.key + "=" + item.value.toString(); }
            ).join("\n") + "\n";
        }
      };

      res.level = Math.ceil(Math.max(
        Math.log(res.worldwidth / (res.width/self.tilesPerScreenX), 2),
        Math.log(res.worldheight / (res.height/self.tilesPerScreenY), 2)));

      res.tilewidth = res.worldwidth / Math.pow(2, res.level);
      res.tileheight = res.worldheight / Math.pow(2, res.level);

      res.tileleft = res.tilewidth * Math.floor(bounds.left / res.tilewidth);
      res.tileright = res.tilewidth * Math.ceil(bounds.right / res.tilewidth);
      res.tilebottom = res.tileheight * Math.floor(bounds.bottom / res.tileheight);
      res.tiletop = res.tileheight * Math.ceil(bounds.top / res.tileheight);

      res.tilesx = (res.tileright - res.tileleft) / res.tilewidth;
      res.tilesy = (res.tiletop - res.tilebottom) / res.tileheight;

      return res;
    },

    tileBoundsForRegion: function(bounds) {
      /* Returns a list of tile bounds covering a region. */

      var self = this;

      var params = self.tileParamsForRegion(bounds);
      Logging.default.log("Data.BaseTiledFormat.tileBoundsForRegion", params);

      res = [];
      for (var x = 0; x < params.tilesx; x++) {
        for (var y = 0; y < params.tilesy; y++) {
          res.push(new Bounds(
            params.tileleft + x * params.tilewidth,
            params.tilebottom + y * params.tileheight,
            params.tileleft + (x+1) * params.tilewidth,
            params.tilebottom + (y+1) * params.tileheight
          ).rewrapDateLine(self.world));
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

      var wantedTileBounds = self.tileBoundsForRegion(bounds);
      var wantedTiles = {};
      var oldWantedTiles = self.wantedTiles;
      var anyNewTiles = false;
      wantedTileBounds.map(function (tilebounds) {
        var key = tilebounds.toBBOX();
        if (oldWantedTiles[key] != undefined) {
          wantedTiles[key] = oldWantedTiles[tilebounds.toBBOX()];
        } else {
          wantedTiles[key] = self.setUpTile(tilebounds);
          anyNewTiles = true;
        }
        wantedTiles[key].reference();
      });
      self.wantedTiles = wantedTiles;

      Logging.default.log("Data.BaseTiledFormat.zoomTo", {
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
          var existingWantedTiles = this.newWantedTiles.filter(function (bbox) {
              return self.oldWantedTiles.indexOf(bbox) != -1
          }).join(", ");
          var oldBounds = self.oldBounds != undefined ? self.oldBounds.toBBOX() : "undefined";
          var newBounds = self.newBounds != undefined ? self.newBounds.toBBOX() : "undefined";
          return oldBounds + " -> " + newBounds + ":\n  Added: " + newWantedTiles + "\n  Removed: " + oldWantedTiles + "\n  Kept: " + existingWantedTiles + "\n";
        }
      });

      if (anyNewTiles) {
        self.events.triggerEvent("load");
      }

      Object.items(oldWantedTiles).map(function (item) {
        item.value.dereference();
      });

      wantedTileBounds.map(function (tilebounds) {
        setTimeout(function () {
          self.wantedTiles[tilebounds.toBBOX()].load();
        }, 0);
      });
    },

/*
    getTileContent: function (tile) {
      var self = this;
      return undefined;
    },
*/

    setUpTile: function (tilebounds) {
      var self = this;
      var key = tilebounds.toBBOX();

      if (!self.tileCache[key]) {
        var tile = new Tile(self, tilebounds);

        tile.idx = self.tileIdxCounter++;
        tile.setContent(self.getTileContent(tile));
        tile.findOverlaps();

        tile.content.events.on({
          "batch": self.handleBatch.bind(self, tile),
          "all": self.handleFullTile.bind(self, tile),
          "error": self.handleTileError.bind(self, tile),
          scope: self
        });
        tile.events.on({
          "destroy": self.handleTileRemoval.bind(self, tile),
          scope: self
        });
        self.tileCache[key] = tile;
      }

      return self.tileCache[key];
    },

    handleTileRemoval: function (tile) {
      var self = this;
      var idx = tile.idx;
      self.rowcount = 0;
      self.seriescount = 0;
      var lastSeries = function () {}; // Magic unique value
      for (var src = 0; src < self.header.length; src++) {
        if (self.data.tile[src] != idx) {
          for (var key in self.data) {
            self.data[key][self.rowcount] = self.data[key][src];
          }
          self.data.tile[self.rowcount] = self.data.tile[src];
          if (!self.data.series) {
            self.seriescount++;
          } else if (self.data.series[self.rowcount] != lastSeries) {
            self.seriescount++;
            lastSeries = self.data.series[self.rowcount];
          }
          self.rowcount++;
        }
      }
      self.header.length = self.rowcount;
      delete self.tileCache[tile.bounds.toBBOX()];
      e = {update: "tile-removal", tile: tile};
      self.events.triggerEvent(e.update, e);
      self.events.triggerEvent("update", e);
    },

    handleBatch: function (tile) {
      var self = this;

      return;
    },

    getLoadingTiles: function () {
      var self = this;
      return Object.values(
        self.tileCache
      ).filter(function (tile) {
        return !tile.content.allIsLoaded && !tile.content.error;
      });
    },

    getErrorTiles: function () {
      var self = this;
      return Object.values(
        self.tileCache
      ).filter(function (tile) {
        return tile.content.error;
      });
    },

    getDoneTiles: function () {
      var self = this;
      return Object.values(
        self.tileCache
      ).filter(function (tile) {
        return tile.content.allIsLoaded;
      });
    },

    printTree: function (maxdepth) {
      var self = this;

      var printed = {};

      var printTree = function (indent, depth, tile) {
        depth = depth || 0;

        var key = tile.bounds.toBBOX();

        var again = printed[key] || false;
        printed[key] = true;
        var loaded = tile.content.allIsLoaded ? ", loaded" : "";
        var wanted = self.wantedTiles[key] ? ", wanted" : "";
        var error = tile.content.error ? ", error" : "";
        var res = indent + key + "(Idx: " + tile.idx.toString() + ", Usage: " + tile.usage.toString() + loaded + error + wanted + ")";
        if (maxdepth != undefined && depth > maxdepth) {
          res += " ...\n";
        } else {
          res += "\n";

          if (tile.replacement) {
            res += indent + "  Replaced by:\n";
            res += printTree(indent + "    ", depth+1, tile.replacement);
          }

          if (tile.overlaps.length) {
            res += indent + "  Overlaps:\n";
            tile.overlaps.map(function (overlap) {
              res += printTree(indent + "    ", depth+1, overlap);
            });
          }
        }

        return res;
      }

      var res = "";
      res += 'Wanted tiles:\n'
        res += Object.values(self.wantedTiles).map(printTree.bind(self, "  ", 0)).join("\n");
      res += 'Forgotten tiles:\n'

      res += Object.values(self.tileCache).filter(function (tile) {
        return !printed[tile.bounds.toBBOX()];
      }).map(
        printTree.bind(self, "  ", 0)
      ).join("\n");

      return res;
    },

    handleAllDone: function (tile) {
      var self = this;
      var allDone = Object.values(self.tileCache
        ).map(function (tile) { return tile.content.allIsLoaded || tile.content.error; }
        ).reduce(function (a, b) { return a && b; });

      if (allDone) {
        var e = {update: "all", tile: tile};
        self.events.triggerEvent(e.update, e);
        self.events.triggerEvent("update", e);
      }
    },

    handleFullTile: function (tile) {
      var self = this;

      self.mergeTile(tile);

      var e;
      e = {update: "full-tile", tile: tile};
      self.events.triggerEvent(e.update, e);
      self.events.triggerEvent("update", e);
      self.handleAllDone(tile);
    },

    handleTileError: function (tile, data) {
      var self = this;
      data.tile = tile;
      var bounds = self.extendTileBounds(tile.bounds);

      if (bounds) {
        var replacement = self.setUpTile(bounds);
        tile.replace(replacement);
        replacement.content.load();

        self.events.triggerEvent("tile-error", data);
      } else {
        self.handleError(data);
      }

      self.handleAllDone();
    },

    handleError: function (originalEvent) {
      var self = this;
      self.error = {
        original: originalEvent,
        source: self,
        toString: function () {
          var self = this;
          return 'Could not load tileset ' + self.source + ' due to the following error: ' + self.original.toString();
        }
      };
      self.events.triggerEvent("error", self.error);
    },

    mergeTile: function (tile) {
      var self = this;
      // A BaseTiledFormat instance can be treated as a tile itself, as
      // it's a subclass of Format. This way, we can merge one more
      // tile without revisiting all the other already loaded tiles.
      self.mergeTiles([{content:self}, tile]);
    },

    mergeTiles: function (tiles) {
      var self = this;

      function compareTiles(a, b) {
        if (a.value.content.compareRows(a.merged_rowcount, b.value.content, b.merged_rowcount) > 0) {
          return b;
        } else {
          return a;
        }
      }

      function nextTile(tiles) {
        if (!tiles.length) return undefined;
        res = tiles.reduce(function (a, b) {
          if (a.value.content.data == undefined || b.merged_rowcount >= b.value.content.rowcount) return a;
          if (b.value.content.data == undefined || a.merged_rowcount >= a.value.content.rowcount) return b;
          return compareTiles(a, b);
        });
        if (res.merged_rowcount >= res.value.content.rowcount) return undefined;
        res.merged_rowcount++;
        return res;
      }

      var start = new Date();

      dst = new BaseTiledFormat.DataContainer();
      _.merge(dst.header, self.tilesetHeader);

      if (tiles == undefined) {
        tiles = Object.values(self.tileCache).filter(function (tile) {
          return tile.content.allIsLoaded;
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

      tiles.map(function (tile) {
        if (!tile.value.content.header) return;

        dst.header.length += tile.value.content.header.length;

        Object.items(tile.value.content.header.colsByName).map(function (item) {
          var dstval = dst.header.colsByName[item.key] || {};
          var srcval = item.value || {};

          var min = coalesce(Math.min, dstval.min, srcval.min);
          var max = coalesce(Math.max, dstval.max, srcval.max);
          _.extend(dstval, srcval);
          dstval.min = min;
          dstval.max = max;

          dst.header.colsByName[item.key] = dstval;
        });
      });

      for (var name in dst.header.colsByName) {
        var col = dst.header.colsByName[name];
        dst.data[name] = new (eval(col.typespec.array))(dst.header.length);
      }
      dst.data.tile = new Int32Array(dst.header.length);

      var lastSeries = function () {}; // Magic unique value
      var tile;
      while (tile = nextTile(tiles)) {
        for (var name in dst.data) {
          if (tile.value.content.data[name] == undefined) {
            dst.data[name][dst.rowcount] = NaN;
          } else {
            dst.data[name][dst.rowcount] = tile.value.content.data[name][tile.merged_rowcount-1];
          }
        }
        if (tile.value.idx != undefined) {
          dst.data.tile[dst.rowcount] = tile.value.idx;
        } else {
          dst.data.tile[dst.rowcount] = tile.value.content.data.tile[tile.merged_rowcount-1];
        }
        if (!dst.data.series) {
          dst.seriescount++;
        } else if (dst.data.series[dst.rowcount] != lastSeries) {
          dst.seriescount++;
          lastSeries = dst.data.series[dst.rowcount];
        }
        dst.rowcount++;
      }

      self.header.length = dst.header.length;
      self.header.colsByName = dst.header.colsByName;
      self.data = dst.data;
      self.rowcount = dst.rowcount;
      self.seriescount = dst.seriescount;

      var end = new Date();
      Logging.default.log("Data.BaseTiledFormat.mergeTiles", {start: start, end: end, toString: function () { return ((this.end - this.start) / 1000.0).toString(); }});
    },

    toString: function () {
      var self = this;
      return self.name;
    },

    toJSON: function () {
      return {
        type: self.name
      }
    }
  });
  BaseTiledFormat.DataContainer = Class(Format, {name: "DataContainer"});

  return BaseTiledFormat;
});
