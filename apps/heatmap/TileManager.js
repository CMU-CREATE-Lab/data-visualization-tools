TileManager = Class({
  initialize: function(source) {
    var self = this;
    self.source = source;

    self.tiles = {};
    self.header = {length: 0, colsByName: {}};
    self.data = {};

    self.events = new Events();
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

    var level = Math.ceil(Math.max(log(worldwidth / (width/self.tilesPerScreenX), 2), log(worldheight / (height/self.tilesPerScreenY), 2)));

    var tilewidth = worldwidth / Math.pow(2, level);
    var tileheight = worldheight / Math.pow(2, level);
    
    var tileleft = tilewidth * Math.floor(bounds.left / tilewidth);
    var tileright = tilewidth * Math.ceil(bounds.right / tilewidth);
    var tilebottom = tileheight * Math.floor(bounds.bottom / tileheight);
    var tiletop = tileheight * Math.ceil(bounds.top / tileheight);

    var tilesx = (tileright - tileleft) / tilewidth;
    var tilesy = (tiletop - tilebottom) / tileheight;

    console.log({
      width: width,
      height: height,
      worldwidth: worldwidth,
      worldheight: worldheight,

      level: level,

      tilewidth: tilewidth,
      tileheight: tileheight,

      tileleft: tileleft,
      tileright: tileright,
      tilebottom: tilebottom,
      tiletop: tiletop,

      tilesx: tilesx,
      tilesy: tilesy
    });

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
    self.bounds = bounds;

    var tiles = {};
    self.tileBoundsForRegion(bounds).map(function (tilebounds) {
      if (self.tiles[tilebounds.toBBOX()] != undefined) {
        tiles[tilebounds.toBBOX()] = self.tiles[tilebounds.toBBOX()];
      } else {
        tiles[tilebounds.toBBOX()] = self.setUpTile(tilebounds);
      }
    });
    self.tiles = tiles;

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

    self.mergeTiles();
    self.events.triggerEvent("batch", {"tile": tile});
  },

  handleFullTile: function (tile) {
    var self = this;

    self.mergeTiles();

    var all_done = self.getTiles(
      ).map(function (tile) { return tile.value.header.length == tile.value.rowcount }
      ).reduce(function (a, b) { return a && b; });

    if (all_done) {
      self.events.triggerEvent("all");
    } else {
      self.events.triggerEvent("full-tile", {"tile": tile});
    }
  },

  handleTileError: function (data, tile) {
    var self = this;

    tile.replacement = self.setUpTile(self.extendTileBounds(tile.bounds));
    tile.replacement.load();

    data.tile = tile;
    self.events.triggerEvent("tile-error", data);
  },

  getTiles: function () {
    return Object.items(self.tiles).map(function (tile) {
      while (tile.value.replacement != undefined) tile.value = tile.value.replacement;
      return tile;
    });
  },

  mergeTiles: function () {
    var self = this;

    function compareTiles(a, b) {
      function compareTilesByCol(a, b, colidx) {
        if (colidx > self.sortcols.length) return a;
        var col = self.sortcols[colidx];
        if (a.value.data[col] == undefined || b.value.data[col] == undefined) {
          // Ignore any sort columns we don't have...
          return compareTilesByCol(a, b, colidx + 1);
        } else if (a.value.data[col][a.merged_rowcount] < b.value.data[col][a.merged_rowcount]) {
          return a;
        } else if (a.value.data[col][a.merged_rowcount] > b.value.data[col][a.merged_rowcount]) {
          return b;
        } else {
          return compareTilesByCol(a, b, colidx + 1);
        }
      }

      return compareTilesByCol(a, b, 0);
    }

    function nextTile(tiles) {
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

    var tiles = self.getTiles().map(function (tile) {
      tile.merged_rowcount = 0;
      return tile;
    });

    self.header = {length: 0, colsByName: {}};
    tiles.map(function (tile) {
      if (!tile.value.header) return;

      self.header.length += tile.value.header.length;
      self.header.colsByName = $.extend(self.header.colsByName, tile.value.header.colsByName);
    });

    self.data = {};
    for (var name in self.header.colsByName) {
      var col = self.header.colsByName[name];
      self.data[name] = new col.typespec.array(self.header.length);
    }

    self.rowcount = 0;
    var tile;
    while (tile = nextTile(tiles)) {
      for (var name in self.data) {
        if (tile.value.data[name] == undefined) {
          self.data[name][self.rowcount] = NaN;
        } else {
          self.data[name][self.rowcount] = tile.value.data[name][tile.merged_rowcount-1];
        }
      }
      self.rowcount++;
    }

    var end = new Date();
    console.log("Merge: " + ((end - start) / 1000.0).toString());

  }
});

/*
tm = new TileManager("http://localhost/viirs/tiles");
tm.events.on({
    "tile-error": function (data) { console.log("tile-error: " + data.exception + " @ " + data.tile.bounds.toBBOX()); },
    "batch": function (data) { console.log("batch: " + data.tile.bounds.toBBOX()); },
    "full-tile": function (data) { console.log("full-tile: " + data.tile.bounds.toBBOX()); },
    "all": function () { console.log("all"); }
});
//tm.zoomTo(new Bounds(0, 0, 11.25, 11.25));
tm.zoomTo(new Bounds(-6, 0, 6, 11.25));
*/
