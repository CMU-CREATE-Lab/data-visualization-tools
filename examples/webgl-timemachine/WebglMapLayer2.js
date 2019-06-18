"use strict";

// WebglMapLayer2 is a modification of WebglMapLayer which can load multiple data from multiple URLs per tile
// Currently only used for Animated Forest Loss/Gain

function WebglMapLayer2(glb, canvasLayer, tileUrls, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this.nLevels = 21;
  this.tileWidth = 256;
  this.tileHeight = 256;

  if (opt_options) {
    $.extend(this, opt_options);
  }

  this.fileExtension = this.fileExtension || "png";
  this.defaultUrl = this.defaultUrl || tileUrls[0].split("{default}")[0] + "default." + this.fileExtension;
  this._tileUrls = [];
  for (var i = 0; i < tileUrls.length; i++) {
    this._tileUrls[i] = tileUrls[i].replace("{default}/", "");
  }

  var that = this;

  this._tileView = new TileView({
    panoWidth: 256 * Math.pow(2, this.nLevels),
    panoHeight: 256 * Math.pow(2, this.nLevels),
    tileWidth: this.tileWidth,
    tileHeight: this.tileHeight,
    createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
    deleteTile: function(tile) {},
    updateTile: WebglMapTile2.update,
    timelapse: this._canvasLayer.timelapse,
    maxLevelOverride: this.maxLevelOverride
  });

  // TODO: experiment with this
  this._tileView.levelThreshold = opt_options.levelThreshold || 0;
}

WebglMapLayer2.prototype.
getWidth = function() {
    return this._tileView.getWidth();
}

WebglMapLayer2.prototype.
getHeight = function() {
    return this._tileView.getHeight();
}

WebglMapLayer2.prototype.
_createTile = function(ti, bounds) {
  var urls = [];
  for (var i = 0; i < this._tileUrls.length; i++) {
    urls[i] =   this._tileUrls[i].replace("{z}", ti.l).replace("{x}", ti.c).replace("{y}", ti.r);
  }
  return new WebglMapTile2(glb, ti, bounds, urls, this.defaultUrl);
}

WebglMapLayer2.prototype.
destroy = function() {
  this._tileView._destroy();
}

// viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
WebglMapLayer2.prototype.
draw = function(view) {
  var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
  var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;

  // Compute transform to be x:0-1, y:0-1
  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);
  translateMatrix(transform, width*0.5, height*0.5);

  // Modify transform to show view
  scaleMatrix(transform, view.scale, view.scale);
  translateMatrix(transform, -view.x, -view.y);

  // TODO: Refactor how tile views are initialized and drawn
  this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
  this._tileView.update(transform, {alpha: view.alpha});
}

WebglMapLayer2.prototype.getTileView = function() {
  return this._tileView;
};

WebglMapLayer2.prototype.getTiles = function() {
  return this._tileView._tiles;
};

WebglMapLayer2.prototype.abortLoading = function() {
  this._tileView._abort();
};
