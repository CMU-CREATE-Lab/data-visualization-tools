"use strict";

// Manage a zoomable pannable mosaic of level-of-detail tiles.

// Usage:
//
// This connects to your own tile class.  You'll need to provide these two functions
// to create and delete your tiles:
//
// createTile(TileIdx ti, bounds) where bounds = {min:{x:,y:},max:{x:,y:}}
// tile.delete()
//
// layer = new TileView({panoWidth:, panoHeight:, tileWidth:, tileHeight:, createTile:});
//
// When drawing a frame where the view has changed
//
// layer.setView(view, viewportWidth, viewportHeight);
//
// Ordered list of tiles to draw.  (Ordered for the case where high-res tiles can partially cover low-res tiles)
//
// layer.getTilesToDraw();

function TileView(settings) {
  this._panoWidth = settings.panoWidth;
  this._panoHeight = settings.panoHeight;
  this.tileWidth = settings.tileWidth;
  this.tileHeight = settings.tileHeight;
  console.assert(this.tileWidth && this.tileHeight && this._panoWidth && this._panoHeight);
  this._createTileCallback = settings.createTile;
  this._deleteTileCallback = settings.deleteTile;
  this._tiles = {};
  this._updateTileCallback = settings.updateTile;
  this._zoomlock = settings.zoomlock;
  this._timelapse = settings.timelapse;
  this._projection = settings.projection;

  // levelThreshold sets the quality of display by deciding what level of tile to show for a given level of zoom:
  //
  //  1.0: select a tile that's shown between 50% and 100% size  (never supersample)
  //  0.5: select a tile that's shown between 71% and 141% size
  //  0.0: select a tile that's shown between 100% and 200% size (never subsample)
  // -0.5: select a tile that's shown between 141% and 242% size (always supersample)
  // -1.0: select a tile that's shown between 200% and 400% size (always supersample)
  this.levelThreshold = -0.5;

  this._computeMaxLevel();
  this._readyList = [];
}

TileView.prototype.
resetDimensions = function (json) {
  this._panoWidth = json.width;
  this._panoHeight = json.height;
  this.tileWidth = json.video_width;
  this.tileHeight = json.video_height;
  this._destroy();
  this._tiles = {};
  this._computeMaxLevel();
}


TileView.prototype.
_computeMaxLevel = function() {
  // Compute max level #
  for (this._maxLevel = 0;
       (this.tileWidth << this._maxLevel) < this._panoWidth ||
       (this.tileHeight << this._maxLevel) < this._panoHeight;
       this._maxLevel++) {
  }
  if (this._panoWidth == 2097152 && this._panoHeight == 1881298 && this.tileWidth == 1424 && this.tileHeight == 800) {
    // v14 missing the highest resolution layer;  override _maxLevel to 11 instead of the correct 12
    // TODO: override this in the layer constructor, stop using the landsat layer as the coordinate system, and stop calling resetDimensions
    this._maxLevelOverride = 11;
  } else {
    this._maxLevelOverride = undefined;
  }
}

TileView.prototype.
getWidth = function () {
  return this._panoWidth;
}

TileView.prototype.
getHeight = function () {
  return this._panoHeight;
}

TileView.prototype.
toString = function() {
  var msg = 'TileView: ';
  msg += 'Size: ' + this._panoWidth + 'x' + this._panoHeight + ',  ';
  msg += 'Tile size: ' + this.tileWidth + 'x' + this.tileHeight + ',  ';
  msg += 'nlevels: ' + (this._maxLevel + 1);
  return msg;
}

TileView.prototype.
_tileGeometry = function(tileidx) {
  var levelScale = Math.pow(2, this._maxLevel - tileidx.l);

  var left = tileidx.c * this.tileWidth * levelScale;
  var right = left + this.tileWidth * levelScale;

  var top = tileidx.r * this.tileHeight * levelScale;
  var bottom = top + this.tileHeight * levelScale;

  var bbox = { min: {x: left, y: top}, max: {x: right, y: bottom} };

  if (this._projection) {
    var timelapseProjection = this._timelapse.getProjection();
    bbox.min = timelapseProjection.latlngToPoint(this._projection.pointToLatlng(bbox.min));
    bbox.max = timelapseProjection.latlngToPoint(this._projection.pointToLatlng(bbox.max));
  }

  return bbox;
};

TileView.prototype.
_scale2level = function(scale)
{
  // Minimum level is 0, which has one tile
  // Maximum level is maxLevel, which is displayed 1:1 at scale=1
  var idealLevel = Math.log(scale) / Math.log(2) + this._maxLevel;
  var selectedLevel = Math.floor(idealLevel + this.levelThreshold);
  selectedLevel = Math.max(selectedLevel, 0);
  selectedLevel = Math.min(selectedLevel, this._maxLevel);
  return selectedLevel;
};

// Compute bounding box from current view
TileView.prototype.
_computeBoundingBox = function(view) {
  var halfWidth = .5 * this._viewportWidth / view.scale;
  var halfHeight = .5 * this._viewportHeight / view.scale;
  return {
    xmin: view.x - halfWidth,
    xmax: view.x + halfWidth,
    ymin: view.y - halfHeight,
    ymax: view.y + halfHeight
  };
};

TileView.prototype.
_tileidxAt = function(level, x, y) {
  var ret = new TileIdx(
    level,
    Math.floor(x / (this.tileWidth << (this._maxLevel - level))),
    Math.floor(y / (this.tileHeight << (this._maxLevel - level))));
  return ret;
};

TileView.prototype.
_tileidxCenter = function(ti) {
  var levelShift = this._maxLevel - ti.l;
  return {
    x: (ti.c + .5) * (this.tileWidth << levelShift),
    y: (ti.r + .5) * (this.tileHeight << levelShift)
  };
};

TileView.prototype.
_computeVisibleTileRange = function(view, level) {
  var bbox = this._computeBoundingBox(view);
  // if TileView has projection, calculate TileView pixel coords directly
  // from projection instead of requiring prescaling in draw
  if (this._projection) {
    var timelapseProjection = this._timelapse.getProjection();
    var nw = timelapseProjection.pointToLatlng({x: bbox.xmin, y: bbox.ymin});
    var nwPixel = this._projection.latlngToPoint(nw);
    var se = timelapseProjection.pointToLatlng({x: bbox.xmax, y: bbox.ymax});
    var sePixel = this._projection.latlngToPoint(se);
    bbox.xmin = nwPixel.x;
    bbox.ymin = nwPixel.y;
    bbox.xmax = sePixel.x;
    bbox.ymax = sePixel.y;
  }
  var tilemin = this._tileidxAt(level, Math.max(0, bbox.xmin), Math.max(0, bbox.ymin));
  var tilemax = this._tileidxAt(level, Math.min(this._panoWidth - 1, bbox.xmax),
                                Math.min(this._panoHeight - 1, bbox.ymax));
  var ret = {min: tilemin, max: tilemax}

  return ret;
}

TileView.prototype.
_isTileVisible = function(view, tileidx) {
  var visibleRange = this._computeVisibleTileRange(view, tileidx.l);
  return visibleRange.min.r <= tileidx.r && tileidx.r <= visibleRange.max.r &&
         visibleRange.min.c <= tileidx.c && tileidx.c <= visibleRange.max.c;
}

TileView.prototype.
_addTileidx = function(tileidx) {
  if (!this._tiles[tileidx.key]) {
    this._tiles[tileidx.key] =
      this._createTileCallback(tileidx, this._tileGeometry(tileidx));
    this._tiles[tileidx.key].index = tileidx;
  }
  return this._tiles[tileidx.key];
}

TileView.prototype.
_deleteTile = function(tile) {
  if (this._tiles[tile.index.key]) {
    tile.delete();
    delete this._tiles[tile.index.key];
  }
}

TileView.prototype.
_destroy = function() {
  var keys = Object.keys(this._tiles);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this._deleteTile(this._tiles[key]);
    delete this._tiles[key];
  }
}

TileView.prototype.
_abort = function() {
  var keys = Object.keys(this._tiles);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var tile = this._tiles[key];
    if (tile.xhr && tile.xhr.readyState < 4) {
      tile.xhr.abort();
      this._deleteTile(this._tiles[key]);
      delete this._tiles[key];
    }
  }
}

TileView.prototype.
tileInfo = function() {
  var ret = [];
  var tileidxs = Object.keys(this._tiles).sort();
  for (var i = 0; i < tileidxs.length; i++) {
    ret.push(tileidxs[i].toString());
  }
  return 'tileInfo: ' + ret.join(' ');
}

// Find first ancestor of tileidx that's ready, and mark it as required, for now
TileView.prototype.
_findReadyAncestor = function(tileidx) {
  while (true) {
    tileidx = tileidx.parent();
    if (tileidx == null) {
      return null;
    }
    if (this._tiles[tileidx.key] && this._tiles[tileidx.key].isReady()) {
      return tileidx;
    }
  }
}

// Find first ancestor in keys
TileView.prototype.
_findFirstAncestorIn = function(tileidx, map) {
  while (true) {
    tileidx = tileidx.parent();
    if (tileidx == null) {
      return null;
    }
    if (tileidx.key in map) {
      return tileidx;
    }
  }
}

// Record drawable videos
// +1,1,1 -2,2,2 +(3,3,3) ^4,4,4 lower higher
// Need prev drawable videos, all videos
// Need new drawable videos, all videos
// Video status:
//
// Added +(x)
// Not ready (x)
// Newly ready ^x
// Ready x
// Removed;  not ready -(x)  ready (x)

// view is {x: xCenterInPanoCoords, y: yCenterInPanoCoords, scale: panoCoordOverPixelCoord}
// viewportWidth and viewportHeight are in pixels

TileView.prototype.
setView = function(view, viewportWidth, viewportHeight, scale) {
  this._viewportWidth = viewportWidth;
  this._viewportHeight = viewportHeight;
  this._scale = scale; // canvas scale (1 for normal, 2 for retina, typically)

  var required = {};
  var added = {};

  // Require tiles in view from optimal level of detail
  var level = this._scale2level(view.scale * this._scale);
  if (level > this._maxLevelOverride) level = this._maxLevelOverride;
  var visibleRange = this._computeVisibleTileRange(view, level);

  for (var r = visibleRange.min.r; r <= visibleRange.max.r; r++) {
    for (var c = visibleRange.min.c; c <= visibleRange.max.c; c++) {
      var ti = new TileIdx(level, c, r);
      if (!(ti.key in this._tiles)) {
        this._tiles[ti.key] = this._addTileidx(ti);
        added[ti.key] = true;
      }
      required[ti.key] = true;
      // If tile isn't ready, hold onto its first ready ancestor
      if (!this._tiles[ti.key].isReady()) {
        this._timelapse.lastFrameCompletelyDrawn = false;
        var ancestor = this._findReadyAncestor(ti);
        if (ancestor != null) {
          required[ancestor.key] = true;
        }
      }
    }
  }


  // Hold onto higher-resolution tiles that are visible, and don't overlap ready tiles

  // Sort ready, higher-level tiles according to level
  var highLevelTileidxs = [];
  var currentLevel = this._scale2level(view.scale);
  if (currentLevel > this._maxLevelOverride) currentLevel = this._maxLevelOverride;
  for (var key in this._tiles) {
    var tileidx = this._tiles[key].index;
    if (tileidx.l > currentLevel) {
      if (this._isTileVisible(view, tileidx)) {
        if (this._tiles[tileidx.key].isReady()) {
          highLevelTileidxs.push(tileidx);
        }
      }
    }
  }
  highLevelTileidxs = highLevelTileidxs.sort();

  for (var i = 0; i < highLevelTileidxs.length; i++) {
    var tileidx = highLevelTileidxs[i];
    var ancestoridx = this._findFirstAncestorIn(tileidx, required);
    if (ancestoridx != null && !this._tiles[ancestoridx.key].isReady()) {
      required[tileidx.key] = true;
    }
  }

  // Compute status, and delete unnecessary tiles

  var keys = Object.keys(this._tiles).sort();

  var status = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var tile = this._tiles[key];
    if (!required[key]) {
      this._deleteTile(this._tiles[key]);
      delete this._tiles[key];
    } else {
      var stat = '';
      if (added[key]) stat += '+';
      if (!tile.isReady()) stat += '(';
      stat += tile.index.toString();
      if (!tile.isReady()) stat += ')';
      status.push(stat);
    }
  }
  status = status.join(' ');
  if (!this._lastStatus || status.replace(/[\-\+]/g,'') != this._lastStatus.replace(/[\-\+]/g,'')) {
    this._lastStatus = status;
  }
};

// Return ordered list of tiles to draw, from low-res to high res.  Draw in that order
// so that high-res can cover low-res, for opaque tiles.
TileView.prototype.
update = function(transform, options) {

  var keys = Object.keys(this._tiles).sort();
  var tiles = [];
  for (var i = 0; i < keys.length; i++) {
    tiles.push(this._tiles[keys[i]]);
  }
  this._updateTileCallback(tiles, transform, options);
}

TileView.prototype.handleTileLoading = function(options) {
  this._layerDomId = options.layerDomId;
}
