"use strict";

function WebglTimeMachineLayer(glb, canvasLayer, rootUrl, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._rootUrl = rootUrl;
  this._mediaType = opt_options.mediaType || ".mp4";
  this._defaultUrl = opt_options.defaultUrl || rootUrl + '/default' + this._mediaType;
  this._numFrames = opt_options.numFrames || 32;
  this._fps = opt_options.fps || 10;
  this._greenScreen = opt_options.greenScreen || false;

  var r = canvasLayer.timelapse.getMetadata();

  // Use time machine specs from options, or from root time machine
  // Should we instead grab this from tm.json?
  var width = opt_options.width || r.width;
  var height = opt_options.height || r.height;
  var video_width = opt_options.video_width || r.video_width;
  var video_height = opt_options.video_height || r.video_height;


  var that = this;

  function createTile(ti, bounds) {
    var url = rootUrl + '/' + ti.l + '/' + (ti.r * 4) + '/' + (ti.c * 4) + that._mediaType;
    return new WebglVideoTile(glb, ti, bounds, url, that._defaultUrl, that._numFrames, that._fps, that._greenScreen);
  }

  this._tileView = new TileView({
      panoWidth: width,
      panoHeight: height,
      tileWidth: video_width,
      tileHeight: video_height,
      createTile: createTile,
      deleteTile: function(tile) {},
      updateTile: WebglVideoTile.update
    });

  this.destroy = function() {
    this._tileView._destroy();
  };
}

WebglTimeMachineLayer.prototype.getWidth = function() {
    return this._tileView.getWidth();
};

WebglTimeMachineLayer.prototype.getHeight = function() {
    return this._tileView.getHeight();
};

WebglTimeMachineLayer.prototype.draw = function(view, tileViewVisibility) {
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
      this._tileView.levelThreshold = 0;   // maybe try -0.25 or 0//
    }
    this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
    this._tileView.update(transform);
  }
};
