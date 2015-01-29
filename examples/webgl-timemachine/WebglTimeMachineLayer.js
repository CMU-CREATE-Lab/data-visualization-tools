"use strict";

function WebglTimeMachineLayer(glb, canvasLayer, rootUrl, vectorUrl) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._rootUrl = rootUrl;
  this._vectorUrl = vectorUrl;

  var r = canvasLayer.timelapse.getMetadata();

  function createTile(ti, bounds) {
    var url = rootUrl + '/' + ti.l + '/' + (ti.r * 4) + '/' + (ti.c * 4) + '.mp4';
    return new WebglVideoTile(glb, ti, bounds, url);
  }

  function createVectorTile(ti, bounds) {
    var url = vectorUrl + '/' + ti.l + '/' + (ti.r) + '/' + (ti.c) + '.bin';
    return new WebGLVectorTile(glb, ti, bounds, url);
  }

  this._tileView = new TileView({
      panoWidth: r.width,
      panoHeight: r.height,
      tileWidth: r.video_width,
      tileHeight: r.video_height,
      createTile: createTile,
      deleteTile: function(tile) {},
      updateTile: WebglVideoTile.update
    });

  this.destroy = function() {
    this._tileView._destroy();
  };

  this._vectorTileView = new TileView({
    panoWidth: r.width,
    panoHeight: r.height,
    tileWidth: 256,
    tileHeight: 256,
    createTile: createVectorTile,
    deleteTile: function(tile) {},
    updateTile: WebGLVectorTile.update,
    zoomlock: 8
  });
}

WebglTimeMachineLayer.prototype.
draw = function(view, tileViewVisibility) {
  var timelapse = this._canvasLayer.timelapse;
  var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
  var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;

  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);

  translateMatrix(transform, width*0.5, height*0.5);
  scaleMatrix(transform, view.scale, view.scale);
  translateMatrix(transform, -view.x, -view.y);

  // TODO: Refactor how tile views are initialized and drawn
  if (tileViewVisibility.videoTile) {
    // TODO: this needs further tweaking...
    if (timelapse.isMovingToWaypoint()) {
      // Moving to waypoint;  reduce level of detail
      this._tileView.levelThreshold = -1.5;
    } else {
      // Not moving to waypoint;  increase level of detail
      this._tileView.levelThreshold = -0.5;   // maybe try -0.25 or 0//
    }
    this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
    this._tileView.update(transform);
  }
  if (tileViewVisibility.vectorTile) {
    var bBox = timelapse.getBoundingBoxForCurrentView();
    var latLngBbox = timelapse.pixelBoundingBoxToLatLngBoundingBoxView(bBox).bbox;
    var ne = {lat: latLngBbox.sw.lat, lng: latLngBbox.ne.lng};
    var sw = {lat: latLngBbox.ne.lat, lng: latLngBbox.sw.lng};
    this._vectorTileView.setViewFromLatLng(view, {ne: ne, sw: sw}, width, height, this._canvasLayer.resolutionScale_);
    this._vectorTileView.update(transform);
  }
}
