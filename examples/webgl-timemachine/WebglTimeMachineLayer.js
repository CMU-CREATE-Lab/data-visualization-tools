"use strict";

function WebglTimeMachineLayer(glb, canvasLayer, rootUrl) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._rootUrl = rootUrl;

  var r = {"fps":10.0,"frames":29,"height":1335834,"leader":0,"level_info":[{"cols":1,"rows":1},{"cols":1,"rows":4},{"cols":5,"rows":11},{"cols":12,"rows":24},{"cols":27,"rows":50},{"cols":56,"rows":102},{"cols":115,"rows":206},{"cols":232,"rows":415},{"cols":467,"rows":832},{"cols":936,"rows":1667},{"cols":1874,"rows":3337},{"cols":3750,"rows":6677}],"level_scale":2.0,"nlevels":12,"tile_height":200,"tile_width":356,"video_height":800,"video_width":1424,"width":1335834};
  
  function createTile(ti, bounds) {
    var url = rootUrl + '/' + ti.l + '/' + (ti.r * 4) + '/' + (ti.c * 4) + '.mp4';
    return new WebglVideoTile(glb, ti, bounds, url);
  }
  
  this._tileView = new TileView({
      panoWidth: r.width,
      panoHeight: r.height,
      tileWidth: r.video_width,
      tileHeight: r.video_height,
      createTile: createTile,
      deleteTile: function(tile) {}
    });

  this.destroy = function() {
    this._tileView._destroy();
  };

}

WebglTimeMachineLayer.prototype.
draw = function(view) {
  // TODO: don't hardcode global access to timelapse
  // TODO: this needs further tweaking...
  if (timelapse.isMovingToWaypoint()) {
    // Moving to waypoint;  reduce level of detail
    this._tileView.levelThreshold = -1.5;
  } else {
    // Not moving to waypoint;  increase level of detail
    this._tileView.levelThreshold = -0.5;   // maybe try -0.25 or 0
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

  this._tileView.update(transform);
}

