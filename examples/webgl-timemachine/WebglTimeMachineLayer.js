"use strict";

function WebglTimeMachineLayer(glb, canvasLayer, rootUrl, vectorUrl) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._rootUrl = rootUrl;
  this._vectorUrl = vectorUrl;

  var r = {"fps":10.0,"frames":29,"height":1335834,"leader":0,"level_info":[{"cols":1,"rows":1},{"cols":1,"rows":4},{"cols":5,"rows":11},{"cols":12,"rows":24},{"cols":27,"rows":50},{"cols":56,"rows":102},{"cols":115,"rows":206},{"cols":232,"rows":415},{"cols":467,"rows":832},{"cols":936,"rows":1667},{"cols":1874,"rows":3337},{"cols":3750,"rows":6677}],"level_scale":2.0,"nlevels":12,"tile_height":200,"tile_width":356,"video_height":800,"video_width":1424,"width":1335834};

  function createTile(ti, bounds) {
    var url = rootUrl + '/' + ti.l + '/' + (ti.r * 4) + '/' + (ti.c * 4) + '.mp4';
    return new WebglVideoTile(glb, ti, bounds, url);
  }

  function createVectorTile(ti, bounds) {
    console.log('Creating tile ' + ti);
    console.log('Has bounds ' + bounds);
    var url = vectorUrl + '/' + ti.l + '/' + (ti.r) + '/' + (ti.c) + '.json';
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

  // TODO: don't hardcode global access to timelapse
  // TODO: this needs further tweaking...
  if (timelapse.isMovingToWaypoint()) {
    // Moving to waypoint;  reduce level of detail
    this._tileView.levelThreshold = -1.5;
  } else {
    // Not moving to waypoint;  increase level of detail
    this._tileView.levelThreshold = -0.5;   // maybe try -0.25 or 0//

  }
  var width = this._canvasLayer.canvas.width / this._canvasLayer.scale;
  var height = this._canvasLayer.canvas.height / this._canvasLayer.scale;
  this._tileView.setView(view, width, height, this._canvasLayer.scale);

  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);

  translateMatrix(transform, width*0.5, height*0.5);

  // Scale to current zoom (worldCoords * 2^zoom)
  scaleMatrix(transform,
              view.scale/* * this._canvasLayer.scale*/,
              view.scale/* * this._canvasLayer.scale*/);

  // translate to current view (vector from topLeft to 0,0)
  translateMatrix(transform, -view.x, -view.y);

  // video tiles always on
  this._tileView.update(transform);

  // vector tiles can be toggled
  if (tileViewVisibility.vectorTile) {
    var bBox = timelapse.getBoundingBoxForCurrentView();
    var latLngBbox = timelapse.pixelBoundingBoxToLatLngBoundingBoxView(bBox).bbox;
    var ne = {lat: latLngBbox.sw.lat, lng: latLngBbox.ne.lng};
    var sw = {lat: latLngBbox.ne.lat, lng: latLngBbox.sw.lng};
    this._vectorTileView.setViewFromLatLng(view, {ne: ne, sw: sw}, width, height, this._canvasLayer.scale);
    this._vectorTileView.update(transform);
  }
}
