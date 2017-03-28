"use strict";

function WebglVectorLayer2(glb, canvasLayer, tileUrl, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._tileUrl = tileUrl;
  this._nLevels = 21;
  this._tileWidth = 256;
  this._tileHeight = 256;

  if (opt_options) {
    this.setOptions(opt_options);
  }

  var r = canvasLayer.timelapse.getMetadata();
  var that = this;

  this._tileView = new TileView({
      panoWidth: 256 * Math.pow(2, this._nLevels),
      panoHeight: 256 * Math.pow(2, this._nLevels),
      tileWidth: 256,
      tileHeight: 256,
      createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
      deleteTile: function(tile) {},
      updateTile: WebGLVectorTile2.update,
      zoomlock: 11
    });

  // TODO: experiment with this
  this._tileView.levelThreshold = 0;
}

WebglVectorLayer2.prototype.setOptions = function(options) {
  if (options.nLevels !== undefined) {
    this.setNLevels(options.nLevels);
  }

  if (options.tileWidth !== undefined) {
    this.setTileWidth(options.tileWidth);
  }

  if (options.tileHeight !== undefined) {
    this.setTileHeight(options.tileHeight);
  }

  if (options.setDataFunction != undefined) {
    this._setDataFunction = options.setDataFunction;
  }

  if (options.loadDataFunction != undefined) {
    this._loadDataFunction = options.loadDataFunction;
  }

  if (options.drawFunction != undefined) {
    this._drawFunction = options.drawFunction;
  }

  if (options.fragmentShader != undefined) {
    this._fragmentShader = options.fragmentShader;
  }

  if (options.vertexShader != undefined) {
    this._vertexShader = options.vertexShader;
  }

  if (options.imageSrc != undefined) {
    this._imageSrc = options.imageSrc;
  }

}


WebglVectorLayer2.prototype.setNLevels = function(nLevels) {
  this._nLevels = nLevels;
}

WebglVectorLayer2.prototype.setTileWidth = function(width) {
  this._tileWidth = width;
}

WebglVectorLayer2.prototype.setTileHeight = function(height) {
  this._tileHeight = height;
}

WebglVectorLayer2.prototype.getWidth = function() {
    return this._tileView.getWidth();
}

WebglVectorLayer2.prototype.getHeight = function() {
    return this._tileView.getHeight();
}

WebglVectorLayer2.prototype._createTile = function(ti, bounds) {
  var url = this._tileUrl.replace("{z}", ti.l).replace("{x}", ti.c).replace("{y}", ti.r);

  var opt_options = {}
  if (this._setDataFunction) {
    opt_options.setDataFunction = this._setDataFunction;
  }
  if (this._loadDataFunction) {
    opt_options.loadDataFunction = this._loadDataFunction;
  }
  if (this._drawFunction) {
    opt_options.drawFunction = this._drawFunction;
  }
  if (this._fragmentShader) {
    opt_options.fragmentShader = this._fragmentShader;
  }
  if (this._vertexShader) {
    opt_options.vertexShader = this._vertexShader;
  }
  if (this._imageSrc) {
    opt_options.imageSrc = this._imageSrc;
  }
  return new WebGLVectorTile2(glb, ti, bounds, url, opt_options);
}

WebglVectorLayer2.prototype.destroy = function() {
  this._tileView._destroy();
}

// viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
// TODO: Fix this for 900913 coords
WebglVectorLayer2.prototype.draw = function(view, opt_options) {
  var timelapse = this._canvasLayer.timelapse;
  var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
  var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;
  var options = {};
  if (typeof(opt_options) != "undefined") {
    options = opt_options;
  }

  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);
  translateMatrix(transform, width*0.5, height*0.5);
  scaleMatrix(transform, view.scale, view.scale);
  translateMatrix(transform, -view.x, -view.y);

  // TODO: Refactor how tile views are initialized and drawn
  this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
  this._tileView.update(transform, options);
}