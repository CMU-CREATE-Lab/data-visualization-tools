"use strict";

function WebglPointLayer(glb, canvasLayer, tileUrl, opt_options) {
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

  var that = this;

  this._tileView = new TileView({
      panoWidth: 256 * Math.pow(2, this._nLevels),
      panoHeight: 256 * Math.pow(2, this._nLevels),
      tileWidth: this._tileWidth,
      tileHeight: this._tileHeight,
      createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
      deleteTile: function(tile) {},
      updateTile: WebglPointTile.update
    });

  // TODO: experiment with this
  this._tileView.levelThreshold = 0;
}

WebglPointLayer.prototype.setOptions = function(options) {
  console.log("Set Options");
  console.log(options);
  if (options.nLevels !== undefined) {
    this.setNLevels(options.animate);
  }

  if (options.tileWidth !== undefined) {
    this.setTileWidth(options.tileWidth);
  }

  if (options.tileHeight !== undefined) {
    this.setTileHeight(options.tileHeight);
  }
}

WebglPointLayer.prototype.setNLevels = function(nLevels) {
  this._nLevels = nLevels;
}

WebglPointLayer.prototype.setTileWidth = function(width) {
  this._tileWidth = width;
}

WebglPointLayer.prototype.setTileHeight = function(height) {
  this._tileHeight = height;
}

WebglPointLayer.prototype.getWidth = function() {
    return this._tileView.getWidth();
}

WebglPointLayer.prototype.getHeight = function() {
    return this._tileView.getHeight();
}

WebglPointLayer.prototype._createTile = function(ti, bounds) {
  var url = this._tileUrl + '/' + ti.l + '/' + (ti.c) + '/' + (ti.r) + '.bin';
  return new WebglPointTile(glb, ti, bounds, url);
}

WebglPointLayer.prototype.destroy = function() {
  this._tileView._destroy();
}

WebglPointLayer.prototype.draw = function(view, opts) {
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
  this._tileView.update(transform, opts);


}
