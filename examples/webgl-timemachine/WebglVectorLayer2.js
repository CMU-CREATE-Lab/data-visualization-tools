"use strict";

// confusingly, nLevels is really max level #.  the actual number of levels is nLevels+1

// nLevels=0 means levels [0].  nLevels=1 means levels [0, 1]

function WebglVectorLayer2(glb, canvasLayer, tileUrl, opt_options) {
  this.glb = glb;
  this.gl = glb.gl;
  this._canvasLayer = canvasLayer;
  this._tileUrl = tileUrl;
  this.nLevels = 21;
  this.tileWidth = 256;
  this.tileHeight = 256;

  if (opt_options) {
    $.extend(this, opt_options);
  }

  var r = canvasLayer.timelapse.getMetadata();
  var that = this;

  this._tileView = new TileView({
      panoWidth: 256 * Math.pow(2, this.nLevels),
      panoHeight: 256 * Math.pow(2, this.nLevels),
      tileWidth: 256,
      tileHeight: 256,
      createTile: function(ti, bounds) { return that._createTile(ti, bounds); },
      deleteTile: function(tile) {},
      updateTile: WebGLVectorTile2.update,
      zoomlock: 11,
      timelapse: this._canvasLayer.timelapse
  });

  // TODO: experiment with this
  this._tileView.levelThreshold = 0;
}

WebglVectorLayer2.prototype.getWidth = function() {
    return this._tileView.getWidth();
};

WebglVectorLayer2.prototype.getHeight = function() {
    return this._tileView.getHeight();
};

WebglVectorLayer2.prototype._createTile = function(ti, bounds) {
  var url = this._tileUrl.replace("{z}", ti.l).replace("{x}", ti.c).replace("{y}", ti.r);
  url = url.replace("{yflip}", Math.pow(2,ti.l)-1-ti.r);

  // Consider not copying these layer-scope settings to individual tiles and instead
  // accessing from the layer?
  var opt_options = {};
  if (this.setDataFunction) {
    opt_options.setDataFunction = this.setDataFunction;
  }
  if (this.loadDataFunction) {
    opt_options.loadDataFunction = this.loadDataFunction;
  }
  if (this.dataLoadedFunction) {
    opt_options.dataLoadedFunction = this.dataLoadedFunction;
  }
  if (this.drawFunction) {
    opt_options.drawFunction = this.drawFunction;
  }
  if (this.fragmentShader) {
    opt_options.fragmentShader = this.fragmentShader;
  }
  if (this.vertexShader) {
    opt_options.vertexShader = this.vertexShader;
  }
  if (this.imageSrc) {
    opt_options.imageSrc = this.imageSrc;
  }
  if (this.scalingFunction) {
    opt_options.scalingFunction = this.scalingFunction;
  }
  if (this.colorScalingFunction) {
    opt_options.colorScalingFunction = this.colorScalingFunction;
  }
  if (this.externalGeojson) {
    opt_options.externalGeojson = this.externalGeojson;
  }
  if (this.nameKey) {
    opt_options.nameKey = this.nameKey;
  }
  if (this.layerId) {
    opt_options.layerId = this.layerId;
  }
  if (this.numAttributes) {
    opt_options.numAttributes = this.numAttributes;
  }
  if (this._tileView) {
    opt_options.layerDomId = this._tileView._layerDomId;
  }
  if (this.color) {
    opt_options.color = this.color;    
  }  
  if (this.drawOptions) {
    opt_options.drawOptions = this.drawOptions;    
  }  
  if (this.setDataOptions) {
    opt_options.setDataOptions = this.setDataOptions;    
  }  

  opt_options.dotmapColors = this.dotmapColors;
  return new WebGLVectorTile2(glb, ti, bounds, url, opt_options);
};

WebglVectorLayer2.prototype.destroy = function() {
  this._tileView._destroy();
};

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
};

WebglVectorLayer2.prototype.getTileView = function() {
  return this._tileView;
};

WebglVectorLayer2.prototype.getTiles = function() {
  return this._tileView._tiles;
};

WebglVectorLayer2.prototype.abortLoading = function() {
  this._tileView._abort();
};
