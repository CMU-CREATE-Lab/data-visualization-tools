"use strict";

function WebglMapLayer(glb, canvasLayer, tileUrl, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._fileExtension = opt_options.fileExtension || "png";
  this._defaultUrl = relUrlToAbsUrl(opt_options.defaultUrl || tileUrl.split("{default}")[0] + "default." + this._fileExtension);
  this._tileUrl = tileUrl.replace("{default}/", "");
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
    updateTile: WebglMapTile.update
  });

  // TODO: experiment with this
  this._tileView.levelThreshold = opt_options.levelThreshold || 0;
}


WebglMapLayer.prototype.setOptions = function(options) {
  if (options.nLevels !== undefined) {
    this.setNLevels(options.nLevels);
  }

  if (options.tileWidth !== undefined) {
    this.setTileWidth(options.tileWidth);
  }

  if (options.tileHeight !== undefined) {
    this.setTileHeight(options.tileHeight);
  }
  if (options.fragmentShader != undefined) {
    this._fragmentShader = options.fragmentShader;
  }

  if (options.vertexShader != undefined) {
    this._vertexShader = options.vertexShader;
  }

  if (options.drawFunction != undefined) {
    this._drawFunction = options.drawFunction;
  }

}

WebglMapLayer.prototype.setNLevels = function(nLevels) {
  this._nLevels = nLevels;
}

WebglMapLayer.prototype.setTileWidth = function(width) {
  this._tileWidth = width;
}

WebglMapLayer.prototype.setTileHeight = function(height) {
  this._tileHeight = height;
}

WebglMapLayer.prototype.
getWidth = function() {
    return this._tileView.getWidth();
}

WebglMapLayer.prototype.
getHeight = function() {
    return this._tileView.getHeight();
}

WebglMapLayer.prototype._createTile = function(ti, bounds) {
  var opt_options = {};

  if (this._drawFunction) {
    opt_options.drawFunction = this._drawFunction;
  }

  if (this._fragmentShader) {
    opt_options.fragmentShader = this._fragmentShader;
  }
  if (this._vertexShader) {
    opt_options.vertexShader = this._vertexShader;
  }

  var url = this._tileUrl.replace("{z}", ti.l).replace("{x}", ti.c).replace("{y}", ti.r);
  return new WebglMapTile(glb, ti, bounds, url, this._defaultUrl, opt_options);
}

WebglMapLayer.prototype.
destroy = function() {
  this._tileView._destroy();
}

// viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
WebglMapLayer.prototype.draw = function(view, opt_options) {
  var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
  var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;
  var options = {};
  if (typeof(opt_options) != "undefined") {
    options = opt_options;
  }
  // Compute transform to be x:0-1, y:0-1
  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);
  translateMatrix(transform, width*0.5, height*0.5);

  // Modify transform to show view
  scaleMatrix(transform, view.scale, view.scale);
  translateMatrix(transform, -view.x, -view.y);

  // TODO: Refactor how tile views are initialized and drawn
  this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
  this._tileView.update(transform, options);
}
