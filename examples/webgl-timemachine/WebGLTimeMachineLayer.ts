"use strict";

// tileRootUrl is the root of the video tiles (e.g. directory with a name like crf20-22fps-1424x800)
// rootUrl is the root of the time machine (where tm.json is located), one level above tileRootUrl

// Pass EITHER
// 1. options.rootUrl
// OR
// 2. options.tileRootUrl and various metadata (numFrames, fps, nLevels, video_width, video_height, width, height, optionally colormap, etc;  see index.html for examples)
//
// In option 1, metadata will be loaded from options.tileRootUrl/tm.json

import { TileView } from './TileView'
import { WebGLVideoTile } from './WebGLVideoTile'
import { Layer } from './Layer'
import { Timeline } from './Timeline';
import { gEarthTime } from './EarthTime';
import { Utils } from './Utils';

declare var EARTH_TIMELAPSE_CONFIG;

export class WebGLTimeMachineLayer extends Layer {
  _ready: boolean;
  _waitingForColormap: boolean;
  _colormap: any;
  image: HTMLImageElement;
  tileRootUrl: string;
  _waitingForMetadata: boolean;
  video_width: number;
  video_height: number;
  width: number;
  height: number;
  numFrames: number;
  nlevels: number;
  fps: number;
  mediaType: string;
  metadataLoadedCallback: (layer: WebGLTimeMachineLayer)=>void;
  metadataLoaded: boolean;
  captureTimes: string[];

  // Mapping form frames to epoch time is contained in one of two forms:
  // Option 1:
  //      epochTimes:  array of an epoch timestamp per frame.  Comes from json metadata
  // Option 2:
  //      startEpochTime and endEpochTime:  Comes from layer defintion, but only if json metadata is missing
  epochTimes?: number[];
  startEpochTime?: number;
  endEpochTime?: number;
  constructor(layerProxy, glb, canvasLayer, url, layerOptions) {
    super(layerProxy, layerOptions, WebGLVideoTile); //
    this.metadataLoaded = false;
    // We should never override drawTile for this layer
    this.drawFunction = WebGLVideoTile.prototype.drawTile;

    var that = this;
    this.glb = glb;
    this.gl = glb.gl;
    this._canvasLayer = canvasLayer;

    this._ready = false;

    if (layerOptions.colormap) {
      this._waitingForColormap = true;
      this._colormap = this._createTexture();
      this.image = new Image();
      this.image.crossOrigin = "anonymous";
      this.image.onload = this._handleLoadedColormap.bind(this);
      this.image.addEventListener('error', function (event) { console.log('ERROR:  cannot load colormap ' + that.image.src); });
      this.image.src = this.colormap;
    }

    this.layerId = layerOptions.layerId;

    if (this.rootUrl && !this.tileRootUrl) {
      this._waitingForMetadata = true;
      // Request metadata asynchronously from tm.json
      var tmPath = this.rootUrl + '/tm.json';
      $.ajax({
        url: tmPath,
        dataType: 'json',
        success: this.loadTm.bind(this)
      });
    } else if (!this.rootUrl && this.tileRootUrl) {
      // Assume we've been given all the metadata
      this.video_width = this.video_width || 1424;
      this.video_height = this.video_height || 800;
      console.assert(this.width && this.height && this.numFrames);
      this.loadMetadata();
    }
  }
  // Load metadata from tm.json
  loadTm(tm) {
    var datasets = tm.datasets;
    var dataset;
    for (var i = 0; i < datasets.length; i++) {
      if (datasets[i].name == '600p') {
        dataset = datasets[i];
        break;
      }
    }
    if (!dataset) {
      dataset = datasets[0];
    }
    this.captureTimes = tm['capture-times'];
    this.projectionBounds = tm['projection-bounds'];
    this.tileRootUrl = this.rootUrl + '/' + dataset.id;
    var rPath = this.tileRootUrl + '/r.json';
    $.ajax({
      url: rPath,
      dataType: 'json',
      success: this.loadR.bind(this)
    });
  }
  // Load metadata from r.json
  loadR(r) {
    this.nlevels = r.nlevels;
    this.numFrames = r.frames;
    this.fps = r.fps;
    this.video_height = r.video_height;
    this.video_width = r.video_width;
    this.width = r.width;
    this.height = r.height;
    this.loadMetadata();
  }
  maxGmapsZoomLevel() {
    if (!this.width) {
      return null;
    }
    let fullPixelWidth: number;
    if (this.projectionBounds) {
      let pixelsPerDegreeLng = this.width / (this.projectionBounds.east - this.projectionBounds.west);
      fullPixelWidth = 360 * pixelsPerDegreeLng;
    } else {
      // Assumes a layer without projection is scaled to the full width of the timelapse.js view
      fullPixelWidth = this.width;
    }
    // gmapsZoomLevelAtFullRes should be level 0 for 256, 1 for 512, 2 for 1024 ...
    let gmapsZoomLevelAtFullRes = Math.log2(fullPixelWidth/256);
    return gmapsZoomLevelAtFullRes;
  }
  isLoaded(): boolean { return this.metadataLoaded; }
  loadMetadata() {
    this.mediaType = this.mediaType || '.mp4';
    this.defaultUrl = this.defaultUrl || relUrlToAbsUrl(this.tileRootUrl + '/default' + this.mediaType);
    this.fps = this.fps || 10;

    var that = this;

    // Pull time range from layer definition
    let startDate = this.startDate;
    let endDate = this.endDate;

    let cachedCaptureTimes;
    if (!startDate && !endDate) {
      console.assert(this.captureTimes && this.captureTimes[0] && this.captureTimes[0] != "NULL", "No valid capture time range defined in tm.json or layer definition.");
      cachedCaptureTimes = this.captureTimes;
      startDate = this.captureTimes[0];
      endDate = this.captureTimes[this.captureTimes.length - 1];
    }

    this.timeline = new Timeline(this.timelineType,
      { startDate: startDate, endDate: endDate,
        step: this.step, masterPlaybackRate: this.masterPlaybackRate,
        playbackRate: this.playbackRate, cachedCaptureTimes: cachedCaptureTimes,
        fps: this.fps });

    if (cachedCaptureTimes) {
      this.epochTimes = [];
      for (let captureTime of cachedCaptureTimes) {
        this.epochTimes.push(gEarthTime.timelapse.sanitizedParseTimeEpoch(captureTime) / 1000);
      }
    } else {
      this.startEpochTime = parseDateStr(this.startDate, false) as number;
      this.endEpochTime = parseDateStr(this.endDate, false) as number;
    }

    function createTile(ti, bounds) {
      var url = that.tileRootUrl + '/' + ti.l + '/' + (ti.r * 4) + '/' + (ti.c * 4) + that.mediaType;
      var tile = new WebGLVideoTile(that, ti, bounds, {
        url:url,
        defaultUrl:that.defaultUrl,
        numFrames:that.numFrames,
        fps:that.fps,
        greenScreen:that.greenScreen
      });
      return tile;
    }

    this._tileView = new TileView({
      panoWidth: this.width,
      panoHeight: this.height,
      tileWidth: this.video_width,
      tileHeight: this.video_height,
      createTile: createTile,
      deleteTile: function (tile) { tile.delete() },
      updateTiles: this.updateTiles.bind(this),
      maxLevelOverride: this.maxLevelOverride
    });

    this.destroy = function () {
      this._tileView._discardTilesAndResources();
    };

    this._waitingForMetadata = false;
    if (this.metadataLoadedCallback) {
      this.metadataLoadedCallback(this);
    }
    this.metadataLoaded = true;
    this._updateReady();
  }
  _createTexture() {
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

  _handleLoadedColormap() {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this._colormap);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._waitingForColormap = false;

    this._updateReady();
  }

  _updateReady() {
    this._ready = !(this._waitingForColormap || this._waitingForMetadata);
  }

  resetDimensions(json) {
    this._tileView.resetDimensions(json);
  }

  draw(view) {
    if (!this._ready) {
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      return;
    }
    var timelapse = this._canvasLayer.timelapse;
    var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
    var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;

    var transform = new Float32Array([2 / width, 0, 0, 0, 0, -2 / height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    translateMatrix(transform, width * 0.5, height * 0.5);
    scaleMatrix(transform, view.scale, view.scale);
    translateMatrix(transform, -view.x, -view.y);

    // TODO: this needs further tweaking...
    if (timelapse.isMovingToWaypoint()) {
      // Moving to waypoint;  reduce level of detail
      this._tileView.levelThreshold = -1.5;
    }
    else {
      // Not moving to waypoint;  increase level of detail
      this._tileView.levelThreshold = 0;
    }
    if (EARTH_TIMELAPSE_CONFIG.videoLevelThresholdModifier) {
      this._tileView.levelThreshold += EARTH_TIMELAPSE_CONFIG.videoLevelThresholdModifier;
    }
    this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
    this._tileView.update(transform, {});
  }

  computeDisplayFrameAndRate(): {frame: number, fps: number} {
    let {epochTime, rate} = gEarthTime.currentEpochTimeAndRate();
    let ret = {frame: 0, fps: 0};

    if (this.epochTimes) {
      ret.frame = Utils.findInterpolatedIndexFromSortedArray(epochTime, this.epochTimes);
      if (rate > 0 && ret.frame > 0 && ret.frame < this.epochTimes.length - 1) {
        var frameDurationSeconds = this.epochTimes[Math.ceil(ret.frame)] - this.epochTimes[Math.floor(ret.frame)];
        ret.fps = rate / frameDurationSeconds;
      }
    } else {
      ret.frame = this.numFrames * (epochTime - this.startEpochTime) / (this.endEpochTime - this.startEpochTime);
      if (ret.frame <= 0) {
        ret.fps = 0;
        ret.frame = 0;
      } else if (ret.frame >= this.numFrames - 1) {
        ret.fps = 0;
        ret.frame = this.numFrames - 1;
      } else {
        ret.fps = this.numFrames * rate / (this.endEpochTime - this.startEpochTime);
      }
    }
    return ret;
  }
  // Update and draw tiles
  updateTiles(tiles: WebGLVideoTile[], transform) {
    if (org.gigapan.Util.isMobileDevice())
      return;
    if (tiles.length == 0)
      return;

    //WebGLTimeMachinePerf.instance.startFrame();
    let {frame, fps} = this.computeDisplayFrameAndRate();

    for (var i = 0; i < tiles.length; i++) {
      tiles[i].updatePhase1(frame, fps);
    }

    // TODO(rsargent): draw tiles low to high-res, or clip and don't draw the overlapping portions
    // of the low-res tiles
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].updatePhase2(frame, fps);
      tiles[i].draw(transform, {});
    }
    //WebGLTimeMachinePerf.instance.endFrame();
  }

  info(): string {
    let ret = [super.info()];
    ret.push(`  _ready: ${this._ready}`);
    ret.push(`  _waitingForMetadata: ${this._waitingForMetadata}`);
    ret.push(`  _waitingForColormap: ${this._waitingForColormap}`);
    return ret.join('\n');
  }
}

