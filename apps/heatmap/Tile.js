// Object.keys is part of the standard
Object.values = function (obj) {
  var res = [];
  for (var key in obj) {
    res.push(obj[key]);
  }
  return res;
}
Object.items = function (obj) {
  var res = [];
  for (var key in obj) {
      res.push({key:key, value:obj[key]});
  }
  return res;
}

function log(x,base) {
  return Math.log(x)/Math.log(base);
}

/* Class code adapted from OpenLayers; Published under the 2-clause BSD license. See license.txt in the OpenLayers distribution. */
Class = function() {
  var len = arguments.length;
  var first_parent = arguments[0];
  var proto = arguments[len-1];

  var cls;
  if (typeof proto.initialize == "function") {
    cls = proto.initialize;
  } else {
    cls = function () {
      first_parent.prototype.initialize.apply(this, arguments);
    };
  }

  if (len > 1) {
    inherit.apply(
      null,
      [cls, first_parent].concat(
        Array.prototype.slice.call(arguments).slice(1, len-1),
        proto));
  } else {
    cls.prototype = proto;
  }
  return cls;
};

function inherit(cls, parent) {
  var F = function() {};
  F.prototype = parent.prototype;
  cls.prototype = new F();
  for (var i=2; i < arguments.length; i++) {
    var o = arguments[i];
    if (typeof o === "function") {
      o = o.prototype;
    }
    $.extend(cls.prototype, o);
  }
};

Bounds = Class({
  initialize: function (left, bottom, right, top) {
    this.left = left;
    this.bottom = bottom;
    this.right = right;
    this.top = top;
  },

  toBBOX: function () {
    return this.left + "," + this.bottom + "," + this.right + "," + this.top;
  }
});

Events = Class({
  initialize: function () {
    this.handlers = {};
  },
  on: function(args) {
    var events = this;
    for (var name in args) {
      if (name != 'scope') {
        if (!events.handlers[name]) events.handlers[name] = [];
        events.handlers[name].push({handler: args[name], scope: args.scope});
      }
    }
  },
  triggerEvent: function (event, data) {
    var events = this;
    if (events.handlers[event]) {
      events.handlers[event].map(function (handler) {
        handler.handler.call(handler.scope, data);
      });
    }
  }
});


Tile = Class({
  initialize: function(manager, bounds) {
    var tile = this;
    tile.manager = manager;
    tile.bounds = bounds;
    tile.header = {};
    tile.data = {};
    tile.rowcount = 0;
    tile.loaded = {};
    tile.loading_started = false;
    tile.events = new Events();
  },

  load: function() {
    var tile = this;

    if (tile.loading_started) return;
    tile.loading_started = true;

    loadTypedMatrix({
      url: tile.manager.source + "/" + tile.bounds.toBBOX() + ".bin",
      header: function (data) { tile.headerLoaded(data); },
      row: function (data) { tile.rowLoaded(data); },
      batch: function () { tile.batchLoaded(); },
      done: function () { tile.allLoaded(); },
      error: function (exception) { tile.errorLoading(exception); }
    });
  },

  headerLoaded: function (data) {
    var tile = this;

    tile.header = data;
    for (var name in tile.header.colsByName) {
      var col = tile.header.colsByName[name];
      tile.data[name] = new col.typespec.array(tile.header.length);
      tile.loaded[name] = {min: undefined, max: undefined};
    }

    tile.events.triggerEvent("header", data);
  },

  rowLoaded: function(data) {
    var tile = this;

    for (var name in tile.header.colsByName) {
      tile.data[name][tile.rowcount] = data[name];
      tile.loaded[name].min = tile.loaded[name].min == undefined ? data[name] : Math.min(tile.loaded[name].min, data[name]);
      tile.loaded[name].max = tile.loaded[name].max == undefined ? data[name] : Math.max(tile.loaded[name].max, data[name]);
    }

    tile.rowcount++;
    tile.events.triggerEvent("row", data);
  },

  batchLoaded: function () {
    var tile = this;

    tile.events.triggerEvent("batch");
  },

  allLoaded: function () {
    var tile = this;

    // We aren't getting any more, so if anyone's waiting they'd be
    // waiting forever if we didn't tell them...
    tile.header.length = tile.rowcount;
    tile.events.triggerEvent("all");
  },

  errorLoading: function (exception) {
    throw exception;
  }
});


TileManager = Class({
  initialize: function(source) {
    var manager = this;
    manager.source = source;

    manager.tiles = {};

    manager.events = new Events();
  },

  tilesPerScreenX: 2,
  tilesPerScreenY: 2,
  sortcols: ['series', 'datetime'],

  world: {
    left: -180,
    right: 180,
    top: 90,
    bottom: -90
  },

  tileBoundsForRegion: function(bounds) {
    var manager = this;

    var width = bounds.right - bounds.left;
    var height = bounds.top - bounds.bottom;
    var worldwidth = manager.world.right - manager.world.left;
    var worldheight = manager.world.top - manager.world.bottom;

    var level = Math.ceil(Math.max(log(worldwidth / (width/manager.tilesPerScreenX), 2), log(worldheight / (height/manager.tilesPerScreenY), 2)));

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

  zoomTo: function (bounds) {
    manager = this;
    manager.bounds = bounds;

    var tiles = {};
    manager.tileBoundsForRegion(bounds).map(function (tilebounds) {
      if (manager.tiles[tilebounds.toBBOX()] != undefined) {
        tiles[tilebounds.toBBOX()] = manager.tiles[tilebounds.toBBOX()];
      } else {
        tiles[tilebounds.toBBOX()] = new Tile(manager, tilebounds);
        tiles[tilebounds.toBBOX()].events.on({
          "batch": manager.handleBatch,
          "all": manager.handleFullTile,
          scope: manager
        });
      }
    });
    manager.tiles = tiles;

    // Merge any already loaded tiles
    manager.mergeTiles();

    manager.tileBoundsForRegion(bounds).map(function (tilebounds) {
      tiles[tilebounds.toBBOX()].load();
    });
  },

  handleBatch: function () {
    var manager = this;

    manager.mergeTiles();
    manager.events.triggerEvent("batch");
  },

  handleFullTile: function () {
    var manager = this;

    manager.mergeTiles();

    var all_done = manager.tiles.map(function (tile) { return tile.header.length == tile.rowcount }).reduce(function (a, b) { return a && b; });

    if (all_done) {
      manager.events.triggerEvent("all");
    } else {
      manager.events.triggerEvent("full-tile");
    }
  },

  mergeTiles: function () {
    var manager = this;

    function compareTiles(a, b) {
      function compareTilesByCol(a, b, colidx) {
        if (colidx > manager.sortcols.length) return a;
        var col = manager.sortcols[colidx];
        if (a.value.data[col][a.merged_rowcount] < b.value.data[col][a.merged_rowcount]) {
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
        if (a.data == undefined || b.merged_rowcount >= b.value.rowcount) return a;
        if (b.data == undefined || a.merged_rowcount >= a.value.rowcount) return b;
        return compareTiles(a, b);
      });
      if (res.merged_rowcount >= res.value.rowcount) return undefined;
      res.merged_rowcount++;
      return res;
    }

    var tiles = Object.items(manager.tiles).map(function (tile) {
      tile.merged_rowcount = 0;
      return tile;
    });

    manager.header = {length: 0, colsByName: {}};
    tiles.map(function (tile) {
      if (!tile.header) return;

      manager.header.length += tile.header.length;
      manager.header.colsByName = $.extend(manager.header.colsByName, tile.header.colsByName);
    });

    manager.data = {};
    for (var name in manager.header.colsByName) {
      var col = manager.header.colsByName[name];
      manager.data[name] = new col.typespec.array(manager.header.length);
    }

    manager.rowcount = 0;
    var tile;
    while (tile = nextTile(tiles)) {
      for (var name in manager.data) {
        manager.data[name][manager.rowcount] = tile.value.data[name][tile.merged_rowcount-1];
      }
      manager.rowcount++;
    }
  }
});

tm = new TileManager("http://localhost/viirs/tiles");
tm.events.on({
    "batch": function (tile) { console.log("batch"); },
    "full-tile": function (tile) { console.log("full-tile"); },
    "all": function () { console.log("all"); }
});
