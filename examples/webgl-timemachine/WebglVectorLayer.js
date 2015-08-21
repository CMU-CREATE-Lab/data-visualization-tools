"use strict";

function WebglVectorLayer(glb, canvasLayer, tileUrl, nLevels) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._tileUrl = tileUrl;

  var r = canvasLayer.timelapse.getMetadata();
  var that = this;

  this._tileView = new TileView({
      panoWidth: r.width,
      panoHeight: r.height,
      tileWidth: 256,
      tileHeight: 256,
      createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
      deleteTile: function(tile) {},
      updateTile: WebGLVectorTile.update,
      zoomlock: 11
    });

  // TODO: experiment with this
  this._tileView.levelThreshold = 0;
}

WebglVectorLayer.prototype.getWidth = function() {
    return this._tileView.getWidth();
}

WebglVectorLayer.prototype.getHeight = function() {
    return this._tileView.getHeight();
}

WebglVectorLayer.prototype._createTile = function(ti, bounds) {
  var url = this._tileUrl + '/' + ti.l + '/' + (ti.r) + '/' + (ti.c) + '.bin';
  return new WebGLVectorTile(glb, ti, bounds, url);
}

WebglVectorLayer.prototype.destroy = function() {
  this._tileView._destroy();
}

// viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
// TODO: Fix this for 900913 coords
WebglVectorLayer.prototype.draw = function(view) {
  var timelapse = this._canvasLayer.timelapse;
  var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
  var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;

  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);
  translateMatrix(transform, width*0.5, height*0.5);
  scaleMatrix(transform, view.scale, view.scale);
  translateMatrix(transform, -view.x, -view.y);


   var bBox = timelapse.getBoundingBoxForCurrentView();
   var latLngBbox = timelapse.pixelBoundingBoxToLatLngBoundingBoxView(bBox).bbox;
   var ne = {lat: latLngBbox.sw.lat, lng: latLngBbox.ne.lng};
   var sw = {lat: latLngBbox.ne.lat, lng: latLngBbox.sw.lng};
   this._tileView.setViewFromLatLng(view, {ne: ne, sw: sw}, width, height, this._canvasLayer.resolutionScale_);
    this._tileView.update(transform);

  // TODO: Refactor how tile views are initialized and drawn
  //this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
  //this._tileView.update(transform);
}
