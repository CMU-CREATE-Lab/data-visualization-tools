"use strict";

function WebglMapLayer(glb, canvasLayer, tileUrl, nLevels) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._tileUrl = tileUrl;

  var that = this;

  this._tileView = new TileView({
      panoWidth: 256 * Math.pow(2, nLevels),
      panoHeight: 256 * Math.pow(2, nLevels),
      tileWidth: 256,
      tileHeight: 256,
      createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
      deleteTile: function(tile) {},
      updateTile: WebglMapTile.update
    });

  // TODO: experiment with this
  this._tileView.levelThreshold = 0;
}

WebglMapLayer.prototype.
getWidth = function() {
    return this._tileView.getWidth();
}

WebglMapLayer.prototype.
getHeight = function() {
    return this._tileView.getHeight();
}

WebglMapLayer.prototype.
_createTile = function(ti, bounds) {
  var url = this._tileUrl + '/' + ti.l + '/' + (ti.c) + '/' + (ti.r) + '.png';
  return new WebglMapTile(glb, ti, bounds, url);
}

WebglMapLayer.prototype.
destroy = function() {
  this._tileView._destroy();
}

// viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
WebglMapLayer.prototype.
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
  this._tileView.update(transform);
}
