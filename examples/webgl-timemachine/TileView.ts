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

/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>

import { TileIdx } from './TileIdx'
import { gEarthTime } from './EarthTime'

export class TileBbox {
  min: { x: number, y: number }
  max: { x: number, y: number }
};

export class TileView {
  _panoWidth: number;
  _panoHeight: number;
  tileWidth: number;
  tileHeight: number;
  _createTileCallback: any;
  _tiles: {};
  _updateTilesCallback;
  _zoomlock: any;
  _projection: any;
  _maxLevelOverride: any;
  _avoidShowingChildAndParent: any;
  resources: {};
  levelThreshold: number;
  _readyList: any[];
  _maxLevel: number;
  _viewportWidth: number;
  _viewportHeight: number;
  dataResource: any;
  _scale: any;
  _lastStatus: any;
  _layerDomId: any;
  constructor(settings: {
    panoWidth: number; panoHeight: number;
    tileWidth: number; tileHeight: number;
    createTile: any; updateTiles: any;
    deleteTile?: any;
    zoomlock?: any;
    projection?: any;
    maxLevelOverride: any;
    avoidShowingChildAndParent?: boolean;
    levelThreshold?: number;
  }) {
    this._panoWidth = settings.panoWidth;
    this._panoHeight = settings.panoHeight;
    this.tileWidth = settings.tileWidth;
    this.tileHeight = settings.tileHeight;
    console.assert(this.tileWidth && this.tileHeight && this._panoWidth && this._panoHeight);
    this._createTileCallback = settings.createTile;
    this._tiles = {};
    this._updateTilesCallback = settings.updateTiles;
    console.assert(typeof this._updateTilesCallback == 'function');
    if (settings.deleteTile) {
      this._deleteTile = settings.deleteTile;
    }
    this._zoomlock = settings.zoomlock;
    this._projection = settings.projection;
    this._maxLevelOverride = settings.maxLevelOverride;
    this._avoidShowingChildAndParent = settings.avoidShowingChildAndParent;
    this.resources = {};
    this.levelThreshold = settings.levelThreshold ?? 0;

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
  resetDimensions(json: { width: any; height: any; video_width: any; video_height: any; }) {
    this._panoWidth = json.width;
    this._panoHeight = json.height;
    this.tileWidth = json.video_width;
    this.tileHeight = json.video_height;
    this._discardTilesAndResources();
    this._tiles = {};
    this._computeMaxLevel();
  }
  _computeMaxLevel() {
    // Compute max level #
    for (this._maxLevel = 0; (this.tileWidth << this._maxLevel) < this._panoWidth ||
      (this.tileHeight << this._maxLevel) < this._panoHeight; this._maxLevel++) {
    }

    // TODO: Remove this after updating EarthTime layer definition now that we support setting it higher up the chain.
    if (this._panoWidth == 2097152 && this._panoHeight == 1881298 && this.tileWidth == 1424 && this.tileHeight == 800) {
      // 2016-v14 missing the highest resolution layer;  override _maxLevel to 11 instead of the correct 12
      this._maxLevelOverride = 11;
    }
  }
  getWidth() {
    return this._panoWidth;
  }
  getHeight() {
    return this._panoHeight;
  }
  toString() {
    var msg = 'TileView: ';
    msg += 'Size: ' + this._panoWidth + 'x' + this._panoHeight + ',  ';
    msg += 'Tile size: ' + this.tileWidth + 'x' + this.tileHeight + ',  ';
    msg += 'nlevels: ' + (this._maxLevel + 1);
    return msg;
  }

  _tileGeometry(tileidx: TileIdx): TileBbox {
    var levelScale = Math.pow(2, this._maxLevel - tileidx.l);

    var left = tileidx.c * this.tileWidth * levelScale;
    var right = left + this.tileWidth * levelScale;

    var top = tileidx.r * this.tileHeight * levelScale;
    var bottom = top + this.tileHeight * levelScale;

    var bbox = { min: { x: left, y: top }, max: { x: right, y: bottom } };

    if (this._projection) {
      var timelapseProjection = gEarthTime.timelapse.getProjection();
      bbox.min = timelapseProjection.latlngToPoint(this._projection.pointToLatlng(bbox.min));
      bbox.max = timelapseProjection.latlngToPoint(this._projection.pointToLatlng(bbox.max));
    }

    return bbox;
  }
  _scale2level(scale: number) {
    // Minimum level is 0, which has one tile
    // Maximum level is maxLevel, which is displayed 1:1 at scale=1
    var idealLevel = Math.log(scale) / Math.log(2) + this._maxLevel;
    var selectedLevel = Math.floor(idealLevel + this.levelThreshold);
    selectedLevel = Math.max(selectedLevel, 0);
    selectedLevel = Math.min(selectedLevel, this._maxLevel);
    return selectedLevel;
  }
  // Compute bounding box from current view
  _computeBoundingBox(view: { scale: number; x: number; y: number; }) {
    var halfWidth = .5 * this._viewportWidth / view.scale;
    var halfHeight = .5 * this._viewportHeight / view.scale;
    return {
      xmin: view.x - halfWidth,
      xmax: view.x + halfWidth,
      ymin: view.y - halfHeight,
      ymax: view.y + halfHeight
    };
  }
  _tileidxAt(level: number, x: number, y: number) {
    var ret = new TileIdx(
      level,
      Math.floor(x / (this.tileWidth << (this._maxLevel - level))),
      Math.floor(y / (this.tileHeight << (this._maxLevel - level))));
    return ret;
  }
  _tileidxCenter(ti: { l: number; c: number; r: number; }) {
    var levelShift = this._maxLevel - ti.l;
    return {
      x: (ti.c + .5) * (this.tileWidth << levelShift),
      y: (ti.r + .5) * (this.tileHeight << levelShift)
    };
  }
  _computeVisibleTileRange(view: any, level: number) {
    var bbox = this._computeBoundingBox(view);
    // if TileView has projection, calculate TileView pixel coords directly
    // from projection instead of requiring prescaling in draw
    if (this._projection) {
      var timelapseProjection = gEarthTime.timelapse.getProjection();
      var nw = timelapseProjection.pointToLatlng({ x: bbox.xmin, y: bbox.ymin });
      var nwPixel = this._projection.latlngToPoint(nw);
      var se = timelapseProjection.pointToLatlng({ x: bbox.xmax, y: bbox.ymax });
      var sePixel = this._projection.latlngToPoint(se);
      bbox.xmin = nwPixel.x;
      bbox.ymin = nwPixel.y;
      bbox.xmax = sePixel.x;
      bbox.ymax = sePixel.y;
    }
    var tilemin = this._tileidxAt(level, Math.max(0, bbox.xmin), Math.max(0, bbox.ymin));
    var tilemax = this._tileidxAt(level, Math.min(this._panoWidth - 1, bbox.xmax),
      Math.min(this._panoHeight - 1, bbox.ymax));
    var ret = { min: tilemin, max: tilemax };

    return ret;
  }
  _isTileVisible(view: any, tileidx: { l: any; r: number; c: number; }) {
    var visibleRange = this._computeVisibleTileRange(view, tileidx.l);
    return visibleRange.min.r <= tileidx.r && tileidx.r <= visibleRange.max.r &&
      visibleRange.min.c <= tileidx.c && tileidx.c <= visibleRange.max.c;
  }
  _addTileidx(tileidx: TileIdx) {
    if (!this._tiles[tileidx.key]) {
      this._tiles[tileidx.key] =
        this._createTileCallback(tileidx, this._tileGeometry(tileidx));
      this._tiles[tileidx.key].index = tileidx;
    }
    return this._tiles[tileidx.key];
  }
  _deleteTile(tile: { index: { key: string | number; }; delete: () => void; }) {
    if (this._tiles[tile.index.key]) {
      tile.delete();
      delete this._tiles[tile.index.key];
    }
  }
  // Discard tiles and layer resources
  _discardTilesAndResources() {
    var keys = Object.keys(this._tiles);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      this._deleteTile(this._tiles[key]);
      delete this._tiles[key];
    }

    if (this.dataResource) {
      keys = Object.keys(this.dataResource);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        delete this.dataResource[key];
      }
      delete this.dataResource;
    }
  }
  _abort() {
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
  tileInfo() {
    var ret = [];
    var tileidxs = Object.keys(this._tiles).sort();
    for (var i = 0; i < tileidxs.length; i++) {
      ret.push(tileidxs[i].toString());
    }
    return 'tileInfo: ' + ret.join(' ');
  }
  // Find first ancestor of tileidx that's ready
  _findReadyAncestor(tileidx: TileIdx) {
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
  _findFirstAncestorIn(tileidx: { parent: () => any; key: string; }, map: {}) {
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
  highestResolutionTileAt(xy: { x: any; y: any; }) {
    console.log('ZZZ highestResTileAt', xy);
    var tileKeys = Object.keys(this._tiles).sort();
    var maxLevel = this._tiles[tileKeys[tileKeys.length - 1]]._tileidx.l;
    console.log('ZZZ maxlevel is ', maxLevel);
    for (var level = maxLevel; level >= 0; level--) {
      var ti = this._tileidxAt(level, xy.x, xy.y);
      var tile = this._tiles[ti.key];
      if (tile && tile.isReady()) {
        console.log('ZZZ', ti, 'is ready');
        return tile;
      }
      console.log('ZZZ', ti, 'not present or not ready');
    }
    console.log('ZZZ could not find a tile');
    return null;
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
  setView(view: { scale: number; }, viewportWidth: number, viewportHeight: number, scale: any) {
    this._viewportWidth = viewportWidth;
    this._viewportHeight = viewportHeight;
    this._scale = scale; // canvas scale (1 for normal, 2 for retina, typically)

    var required = {};
    var added = {};

    // Require tiles in view from optimal level of detail
    var level = this._scale2level(view.scale * this._scale);
    if (level > this._maxLevelOverride)
      level = this._maxLevelOverride;
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
          gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
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
    if (currentLevel > this._maxLevelOverride)
      currentLevel = this._maxLevelOverride;
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

    var statusLines = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var tile = this._tiles[key];
      if (!required[key]) {
        this._deleteTile(this._tiles[key]);
        delete this._tiles[key];
      }
      else {
        var stat = '';
        if (added[key])
          stat += '+';
        if (!tile.isReady())
          stat += '(';
        stat += tile.index.toString();
        if (!tile.isReady())
          stat += ')';
        statusLines.push(stat);
      }
    }
    var status = statusLines.join(' ');
    if (!this._lastStatus || status.replace(/[\-\+]/g, '') != this._lastStatus.replace(/[\-\+]/g, '')) {
      this._lastStatus = status;
      //console.log(this._layerDomID, this._lastStatus, this);
    }
  }
  // Return ordered list of tiles to draw, from low-res to high res.  Draw in that order
  // so that high-res can cover low-res, for opaque tiles.
  update(transform: Float32Array, options: any) {

    var keys = Object.keys(this._tiles).sort();
    var tiles = [];
    for (var i = 0; i < keys.length; i++) {
      var tile = this._tiles[keys[i]];
      // if avoidShowingChildAndParent is set, only collect a tile for drawing if parent isn't being drawn
      if (!(this._avoidShowingChildAndParent && this._findReadyAncestor(tile.index))) {
        tiles.push(tile);
      }
    }
    this._updateTilesCallback(tiles, transform, options);
  }
  handleTileLoading(options: { layerDomId: any; }) {
    this._layerDomId = options.layerDomId;
  }
}

