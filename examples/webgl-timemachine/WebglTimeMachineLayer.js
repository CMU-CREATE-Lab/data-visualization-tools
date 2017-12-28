"use strict";

function WebglTimeMachineLayer(glb, canvasLayer, rootUrl, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._rootUrl = rootUrl;
  this._mediaType = opt_options.mediaType || ".mp4";
  this._defaultUrl = relUrlToAbsUrl(opt_options.defaultUrl || rootUrl + '/default' + this._mediaType);
  this._numFrames = opt_options.numFrames || 32;
  this._fps = opt_options.fps || 10;
  this._greenScreen = opt_options.greenScreen || false;
  this._projection = opt_options.projection || null;

  this._ready = true;
  if (opt_options.colormap) {
    var that = this;
    this._ready = false;
    this._colormap = this._createTexture();
    this._image = new Image();
    this._image.crossOrigin = "anonymous";
    this._image.onload = function() { that._handleLoadedColormap(); };
    this._image.addEventListener('error', function(event) { console.log('ERROR:  cannot load colormap ' + that._image.src); });
    this._image.src = opt_options.colormap;
  }

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
    var tile = new WebglVideoTile(glb, ti, bounds, url, that._defaultUrl, that._numFrames, that._fps, that._greenScreen, that);
    tile.options = opt_options;
    return tile;
  }

  this._tileView = new TileView({
      panoWidth: width,
      panoHeight: height,
      tileWidth: video_width,
      tileHeight: video_height,
      createTile: createTile,
      deleteTile: function(tile) {},
      updateTile: WebglVideoTile.update,
      timelapse: this._canvasLayer.timelapse,
      projection: this._projection
  });

  this.destroy = function() {
    this._tileView._destroy();
  };
}

WebglTimeMachineLayer.prototype._createTexture = function() {
  var gl = this.gl;
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

WebglTimeMachineLayer.prototype._handleLoadedColormap = function() {
  gl.bindTexture(gl.TEXTURE_2D, this._colormap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
  gl.bindTexture(gl.TEXTURE_2D, null);
  this._ready = true;
}

WebglTimeMachineLayer.prototype.resetDimensions = function(json) {
    this._tileView.resetDimensions(json);
};

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
      this._tileView.levelThreshold = 0;
    }
    if (EARTH_TIMELAPSE_CONFIG.videoLevelThresholdModifier) {
      this._tileView.levelThreshold += EARTH_TIMELAPSE_CONFIG.videoLevelThresholdModifier;
    }
    this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
    this._tileView.update(transform);
  }
};
