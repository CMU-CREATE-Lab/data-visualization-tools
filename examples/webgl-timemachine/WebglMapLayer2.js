"use strict";

function WebglMapLayer2(glb, canvasLayer, tileUrls, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._fileExtension = opt_options.fileExtension || "png";
  this._defaultUrl = opt_options.defaultUrl || tileUrls[0].split("{default}")[0] + "default." + this._fileExtension;
  this._tileUrls = [];
  for (var i = 0; i < tileUrls.length; i++) {
    this._tileUrls[i] = tileUrls[i].replace("{default}/", "");
  }
  this._nLevels = 21;
  this._tileWidth = 256;
  this._tileHeight = 256;

  if (opt_options) {
    this.setOptions(opt_options);
  }

  var that = this;

  this._tileView = new TileView({
    panoWidth: 256 * Math.pow(2, this._nLevels),
    panoHeight: 256 * Math.pow(2, this._nLevels),
    tileWidth: this._tileWidth,
    tileHeight: this._tileHeight,
    createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
    deleteTile: function(tile) {},
    updateTile: WebglMapTile2.update
  });

  // TODO: experiment with this
  this._tileView.levelThreshold = opt_options.levelThreshold || 0;
}


WebglMapLayer2.prototype.setOptions = function(options) {
  if (options.nLevels !== undefined) {
    this.setNLevels(options.nLevels);
  }

  if (options.tileWidth !== undefined) {
    this.setTileWidth(options.tileWidth);
  }

  if (options.tileHeight !== undefined) {
    this.setTileHeight(options.tileHeight);
  }

}

WebglMapLayer2.prototype.setNLevels = function(nLevels) {
  this._nLevels = nLevels;
}

WebglMapLayer2.prototype.setTileWidth = function(width) {
  this._tileWidth = width;
}

WebglMapLayer2.prototype.setTileHeight = function(height) {
  this._tileHeight = height;
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
  return new WebglMapTile2(glb, ti, bounds, urls, this._defaultUrl);
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
