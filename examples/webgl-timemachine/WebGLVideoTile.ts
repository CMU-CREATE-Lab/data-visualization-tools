"use strict";

//
// Want to quadruple-buffer
// From time 1 to 1.999, display 1
//                       already have 2 in the hopper, nominally
//                       be capturing 3
//                       have a fourth fallow buffer to let pipelined chrome keep drawing

// Be capturing 3 means that at t=1, the first video just crossed 3.1,
//                   and that at t=1.999, the last video just crossed 3.1
// So we're aiming to run the videos at current display time plus 1.1 to 2.1
// Or maybe compress the range and go with say 1.6 to 2.1?  That lets us better use
// the flexibility of being able to capture the video across a range of times

import { gEarthTime } from './EarthTime'
import { Tile } from './Tile'
import { WebGLTimeMachineLayer } from './WebGLTimeMachineLayer';

export class WebGLVideoTile extends Tile {
  static _initted: any;
  layer: any;
  _textureProgram: any;
  _textureFaderProgram: any;
  _textureTintFaderProgram: any;
  _textureColormapFaderProgram: any;
  _textureGreenScreenProgram: any;
  _textureGreenScreenFaderProgram: any;
  _triangles: any;
  _video: HTMLVideoElement;
  _useGreenScreen: any;
  _pipeline: any[];
  static PIPELINE_SIZE: number;
  _ready: boolean;
  _minPlaybackRate: number;
  _maxPlaybackRate: number;
  _frameOffsetIndex: number;
  _frameOffset: any;
  static _frameOffsets: any;
  _fps: any;
  _nframes: any;
  _id: number;
  static videoId: any;
  _seekingFrameCount: number;
  static activeTileCount: any;
  _videoPlayPromise: any;
  static _frameOffsetUsed: any;
  static verbose: boolean;
  _lastDisplayFrame: any;
  _missedFrameCount: any;
  //_capturePriority: number;
  _uAlpha: number;
  static totalSeekingFrameCount: any;
  static totalSeekCount: any;
  frameCount: any;
  static useFaderShader: any;
  static missedFrameCount: number;
  static textureFragmentGrayScaleFaderShader: string;
  static frameCount: number;
  isPaused: boolean;

  constructor(layer: WebGLTimeMachineLayer, tileidx, bounds: {min:{x:number, y:number}, max:{x:number, y:number}}, {url, defaultUrl, numFrames, fps, greenScreen}) {
    const NETWORK_NO_SOURCE = 3;
    super(layer, tileidx, bounds, {});
    if (!WebGLVideoTile._initted) {
      WebGLVideoTile._init();
    }
    this.layer = layer;
    this._tileidx = tileidx;
    this.glb = gEarthTime.glb;
    this.gl = this.glb.gl;

    // TODO: Only compile the necessary shader for the layer that was loaded.
    // Note: The shaders are cached once loaded, so calling what is below for each tile should not
    // be as horrible a performance hit as it may seem.
    this._textureProgram = this.glb.programFromSources(WebGLVideoTile.textureVertexShader,
      WebGLVideoTile.textureFragmentShader);

    this._textureFaderProgram = this.glb.programFromSources(WebGLVideoTile.textureVertexShader,
      WebGLVideoTile.textureFragmentFaderShader);

    this._textureTintFaderProgram = this.glb.programFromSources(WebGLVideoTile.textureVertexShader,
      WebGLVideoTile.textureFragmentTintFaderShader);

    this._textureColormapFaderProgram = this.glb.programFromSources(WebGLVideoTile.textureVertexShader,
      WebGLVideoTile.textureColormapFragmentFaderShader);

    this._textureGreenScreenProgram = this.glb.programFromSources(WebGLVideoTile.textureVertexShader,
      WebGLVideoTile.textureGreenScreenFragmentShader);

    this._textureGreenScreenFaderProgram = this.glb.programFromSources(WebGLVideoTile.textureVertexShader,
      WebGLVideoTile.textureGreenScreenFragmentFaderShader);

    // Create triangle strip of two triangles to cover the tile
    // If we're showing the entirety of a video frame, we'd go from 0 to 1 in X and Y both
    // If our video extends beyond the edge of our layer domain, e.g. the topmost video in a layer
    // that's not a perfect power of 2 times the video width, the time machine generator will generate
    // videos that have a black margin on the right and/or bottom which we need to suppress.

    // When tile bounds exceed layer bounds, reduce x/y extent from 1 proportionally.
    let xExtent = (Math.min(bounds.max.x, layer.width) - bounds.min.x) / (bounds.max.x - bounds.min.x);
    let yExtent = (Math.min(bounds.max.y, layer.height) - bounds.min.y) / (bounds.max.y - bounds.min.y);
    this._triangles = this.glb.createBuffer(new Float32Array([
      0, 0, // upper left first triangle
      xExtent, 0, // upper right first and second triangle
      0, yExtent, // lower left for first triangle and second triangle
      xExtent, yExtent // lower right for second triangle
    ]));

    // Mobile uses TimeMachine canvas to render the videos
    if (org.gigapan.Util.isMobileDevice()) {
      this._video = {} as HTMLVideoElement;
    }
    else {
      this._video = document.createElement('video');
      // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
      // sea tiles and replace with a single default tile.
      this._video.addEventListener('error', function (event) {
        if (self._video) {
          if (self._video.networkState == NETWORK_NO_SOURCE &&
            self._video.src != defaultUrl) {
            self._video.src = defaultUrl;
          }
        }
      });
    }
    this._video.crossOrigin = "anonymous";
    (this._video as any).disableRemotePlayback = true; // chromecast
    this._video.muted = true;
    (this._video as any).playsinline = true; // mobile safari
    // The attribute should be all lowercase per the Apple docs, but apparently it needs to be camelcase.
    // Leaving both in just in case.
    (this._video as any).playsInline = true;
    this._video.preload = 'auto';

    this._useGreenScreen = greenScreen;

    var self = this;

    this._video.src = url;
    this._pipeline = [];
    for (var i = 0; i < WebGLVideoTile.PIPELINE_SIZE; i++) {
      this._pipeline.push({
        texture: this._createTexture(),
        frameno: null,
      });
    }
    this._ready = false;
    this._bounds = bounds;
    // This min/max playback rate is specified by Chrome/FireFox and clamping to it has
    // become a requirement with latest browser updates or we suffer video playback glitches.
    this._minPlaybackRate = 0.0625;
    this._maxPlaybackRate = 16.0;
    this._frameOffsetIndex = WebGLVideoTile.getUnusedFrameOffsetIndex();
    this._frameOffset = WebGLVideoTile._frameOffsets[this._frameOffsetIndex];
    this._fps = fps;
    this._nframes = numFrames;
    this._id = WebGLVideoTile.videoId++;
    this._seekingFrameCount = 0;
    WebGLVideoTile.activeTileCount++;
  }
  static textureVertexShader: string;
  static textureFragmentShader: string;
  static textureFragmentFaderShader: string;
  static textureFragmentTintFaderShader: string;
  static textureColormapFragmentFaderShader: string;
  static textureGreenScreenFragmentShader: string;
  static textureGreenScreenFragmentFaderShader: string;

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

  delete() {
    // Mobile uses TimeMachine canvas to render the videos
    if (org.gigapan.Util.isMobileDevice())
      return;

    // TODO: recycle texture
    if (this._videoPlayPromise !== undefined) {
      var that = this;
      this._videoPlayPromise.then(function (_) {
        if (!that._video)
          return;
        if (!that._video.paused) {
          that._video.pause();
        }
        that._video.src = '';
        that._video = null;
      }).catch(function (error) {
        console.log(error);
      });
    }
    else {
      if (!this._video.paused) {
        this._video.pause();
      }
      this._video.src = '';
      this._video = null;
    }
    WebGLVideoTile._frameOffsetUsed[this._frameOffsetIndex] = false;
    this._frameOffsetIndex = null;
    WebGLVideoTile.activeTileCount--;
  }

  toString() {
    return 'Tile ' + this._tileidx.toString() +
      ', ready: ' + this.isReady() +
      ', seq: ' + this._frameOffsetIndex + ' (' + this._frameOffset + ')';
  }

  isReady() {
    return this._ready;
  }

  // We need the current frame, plus the next two future frames
  _frameIsNeeded(frameno, displayFrameDiscrete) {
    var future = (frameno - displayFrameDiscrete + this._nframes) % this._nframes;
    return future <= 2;
  }

  // Flush any frames in the pipeline which aren't about to be used
  _flushUnneededFrames(displayFrameDiscrete) {
    var changed = false;

    // Erase element 2 of the pipeline, if unneeded
    if (this._pipeline[2].frameno != null &&
      !this._frameIsNeeded(this._pipeline[2].frameno, displayFrameDiscrete)) {
      this._pipeline[2].frameno = null;
      changed = true;
    }

    // Erase element 1 and swap 1 and 2, if 1 is unneeded
    if (this._pipeline[1].frameno != null &&
      !this._frameIsNeeded(this._pipeline[1].frameno, displayFrameDiscrete)) {
      this._pipeline[1].frameno = null;
      var tmp = this._pipeline[1];
      this._pipeline[1] = this._pipeline[2];
      this._pipeline[2] = tmp;
      changed = true;
    }

    if (changed && WebGLVideoTile.verbose) {
      console.log(this._id + ': flushed frames, now ' + this._pipelineToString() + ' ' + this._computeNextCaptureFrame(displayFrameDiscrete));
    }
  }

  // Advance the pipeline if we're now display a frame that's at element 1
  _tryAdvancePipeline(displayFrameDiscrete) {
    var advance = 0;
    for (var i = 1; i < 3; i++) {
      if (displayFrameDiscrete == this._pipeline[i].frameno) {
        advance = i;
        break;
      }
    }
    for (var n = 0; n < advance; n++) {
      var tmp = this._pipeline[0];
      tmp.frameno = null;
      for (var i = 0; i < WebGLVideoTile.PIPELINE_SIZE - 1; i++) {
        this._pipeline[i] = this._pipeline[i + 1];
      }
      this._pipeline[WebGLVideoTile.PIPELINE_SIZE - 1] = tmp;
      this._ready = true;
      if (WebGLVideoTile.verbose) {
        console.log(this._id + ': Advancing pipeline, now ' + this._pipelineToString() + ' ' + this._computeNextCaptureFrame(displayFrameDiscrete));
      }
    }
  }

  _frameIsInPipeline(frameno) {
    for (var i = 0; i < WebGLVideoTile.PIPELINE_SIZE - 1; i++) {
      if (this._pipeline[i].frameno == frameno) {
        return true;
      }
    }
    return false;
  }

  _tryCaptureFrame(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete) {
    // Only try to capture if it's needed, if we're not currently showing (too late),
    // and if in the safe range of times to capture
    if ((this.isPaused || displayFrameDiscrete != actualVideoFrameDiscrete) &&
      this._frameIsNeeded(actualVideoFrameDiscrete, displayFrameDiscrete) &&
      !this._frameIsInPipeline(actualVideoFrameDiscrete) &&
      0.1 < (actualVideoFrame % 1.0) &&
      (actualVideoFrame % 1.0) < 0.9) {

      if (displayFrameDiscrete == actualVideoFrameDiscrete) {
        this._captureFrame(actualVideoFrameDiscrete, 0);
        this._ready = true;
      }
      else {
        for (var i = 1; i < WebGLVideoTile.PIPELINE_SIZE - 1; i++) {
          if (this._pipeline[i].frameno == null) {
            this._captureFrame(actualVideoFrameDiscrete, i);
            break;
          }
        }
      }
    }
  }

  _checkForMissedFrame(displayFrameDiscrete) {
    if (this._ready &&
      displayFrameDiscrete != this._lastDisplayFrame &&
      displayFrameDiscrete != this._pipeline[0].frameno) {
      //console.log(this._id + ': missed frame ' + displayFrameDiscrete +
      //            ', pipeline: ' + this._pipelineToString());
      //WebGLTimeMachinePerf.instance.recordMissedFrames(1);
      this._missedFrameCount++;
    }
    this._lastDisplayFrame = displayFrameDiscrete;
  }

  // This should always return one of
  // displayFrameDiscrete +1, +2, +3
  _computeNextCaptureFrame(displayFrameDiscrete) {
    // If paused and we don't have the current frame, that's the one we need
    if (this.isPaused && this._pipeline[0].frameno != displayFrameDiscrete) {
      return displayFrameDiscrete;
    }
    var lastFrame = null;
    for (var i = 0; i < WebGLVideoTile.PIPELINE_SIZE - 1; i++) {
      if (this._pipeline[i].frameno != null) {
        lastFrame = this._pipeline[i].frameno;
      }
    }
    var future;
    if (lastFrame == null) {
      future = 2;
    }
    else {
      future = (lastFrame - displayFrameDiscrete + this._nframes) % this._nframes + 1;
      if (future < 1 || future > 3) {
        future = 2;
      }
    }
    return (displayFrameDiscrete + future) % this._nframes;
  }

  /*_computeCapturePriority(displayFrameDiscrete, actualVideoFrame,
    actualVideoFrameDiscrete) {
    return 1;
  }*/

  // First phase of update
  // Cleans up and advances pipelines
  // Computes priority of capture
  updatePhase1(displayFrame: number, fps: number) {
    //this._capturePriority = 0;
    var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);

    this._uAlpha = displayFrame - displayFrameDiscrete;

    // If fps is zero, or below the minimum supportable animation speed, swith to "paused" mode, which pauses underlying video elements and instead issues seeks
    this.isPaused = fps / this._fps < this._minPlaybackRate;

    // Output stats every 5 seconds
    /*if (!WebGLVideoTile.lastStatsTime) {
      WebGLVideoTile.lastStatsTime = performance.now();
    } else if (performance.now() - WebGLVideoTile.lastStatsTime > 5000) {
      console.log(WebGLVideoTile.stats());
      WebGLVideoTile.lastStatsTime = performance.now();
    }*/
    // Synchronize video playback
    var readyState = this._video.readyState;

    if (readyState == 0) {
      if (WebGLVideoTile.verbose) {
        console.log(this._id + ': loading');
      }
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      return;
    }

    var actualVideoFrame = this._video.currentTime * this._fps;
    var actualVideoFrameDiscrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

    this._flushUnneededFrames(displayFrameDiscrete);
    this._tryAdvancePipeline(displayFrameDiscrete);
    /*if (readyState > 1) {
      this._capturePriority = this._computeCapturePriority(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete);
    }*/
  }
  // Second phase of update
  // Captures frame, if desirable and time still left
  // Adjusts time or requests seek to maintain video time sync
  updatePhase2(displayFrame: number, fps: number) {
    var r2 = WebGLVideoTile.r2;
    var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);
    var readyState = this._video.readyState;

    if (readyState == 0) {
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      return;
    }

    if (this._video.seeking) {
      this._seekingFrameCount++;
      if (WebGLVideoTile.verbose) {
        console.log(this._id + ': seeking for ' + this._seekingFrameCount + ' frames');
      }
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      return;
    }

    if (this._seekingFrameCount != 0) {
      WebGLVideoTile.totalSeekingFrameCount += this._seekingFrameCount;
      WebGLVideoTile.totalSeekCount++;
      this._seekingFrameCount = 0;
    }

    // If paused, carefully seek and advertise whether we successfully got the correct frame or not,
    // and return to caller
    if (this.isPaused) {
      //console.log('isPaused dude', timelapse.isDoingLoopingDwell());
      var videoTime = (displayFrameDiscrete + 0.25) / this._fps;
      var epsilon = .02 / this._fps; // 2% of a frame
      if (!this._video.paused) {
        //console.log('Paused so pausing source');
        this._video.pause();
      }
      if (Math.abs(this._video.currentTime - videoTime) > epsilon) {
        //console.log('Wrong spot (' + this._video.currentTime + ' so seeking source to ' + videoTime);
        this._video.currentTime = videoTime;
        gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      }
      else if (this._pipeline[0].frameno != displayFrameDiscrete ||
        Math.abs(this._pipeline[0].texture.before - videoTime) > epsilon ||
        Math.abs(this._pipeline[0].texture.after - videoTime) > epsilon) {
        //console.log('Need the frame, grabbing ' + videoTime);
        this._captureFrame(displayFrameDiscrete, 0);
        this._ready = true;
      }
      else {
        // We're currently displaying the correct frame
      }
      return;
    }
    //console.log('not Paused', timelapse.isDoingLoopingDwell());
    // Not paused case
    // Try to adapt video playback speed to sync up, or seek source video when too far out of sync
    var actualVideoFrame = this._video.currentTime * this._fps;
    var actualVideoFrameDiscrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

    if (readyState > 1 && !gEarthTime.redrawTakingTooLong()) {
      this._tryCaptureFrame(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete);
    }
    this._checkForMissedFrame(displayFrameDiscrete);

    var nextNeededFrame = this._computeNextCaptureFrame(displayFrameDiscrete);

    var webglFps = 60;
    // Imagine we're going to drop a frame.  Aim to be at the right place in 3 frames
    var future = (fps / webglFps) * 3;

    // Desired video tile time leads display by frameOffset+1.3
    var targetVideoFrame = (displayFrame + this._frameOffset + 1.2) % this._nframes;

    var futureTargetVideoFrame = (targetVideoFrame + future) % this._nframes;

    // Slow down by up to half a frame to make sure to get the next requested frame
    futureTargetVideoFrame = Math.min(futureTargetVideoFrame,
      nextNeededFrame + 0.5);

    // Set speed so that in one webgl frame, we'll be exactly at the right time
    var speed = (futureTargetVideoFrame - actualVideoFrame) / future;

    if (isNaN(speed))
      speed = 0.5;
    if (speed < 0)
      speed = 0;
    if (speed > 5)
      speed = 5;
    if (speed > 0 && this._video.paused) {
      this._videoPlayPromise = this._video.play();
    }
    else if (speed == 0 && !this._video.paused) {
      this._video.pause();
    }

    var futureFrameError = futureTargetVideoFrame - (actualVideoFrame + speed * (this._fps / webglFps));

    if (futureFrameError < -5 ||
      futureFrameError > 5 ||
      (this.isPaused && futureFrameError < -0.3)) {
      // If we need to go back any or forward a lot, seek instead of changing speed
      var seekTime = nextNeededFrame + 0.5;
      this._video.currentTime = (nextNeededFrame + 0.5) / this._fps;
      if (WebGLVideoTile.verbose) {
        console.log(this._id + ': onscreen=' + this._pipeline[0].frameno +
          ', display=' + r2(displayFrame) +
          ', nextNeededFrame=' + nextNeededFrame +
          ', desired=' + r2(targetVideoFrame) +
          ', offset=' + r2(this._frameOffset) +
          ', actual=' + r2(actualVideoFrame) +
          ', seeking to=' + r2(seekTime));
      }
    }
    else {
      this._video.playbackRate = Math.min(Math.max(speed, this._minPlaybackRate), this._maxPlaybackRate);
      if (WebGLVideoTile.verbose) {
        console.log(this._id + ': onscreen=' + this._pipeline[0].frameno +
          ', display=' + r2(displayFrame) +
          ', nextNeededFrame=' + nextNeededFrame +
          ', desired=' + r2(targetVideoFrame) +
          ', offset=' + r2(this._frameOffset) +
          ', actual=' + r2(actualVideoFrame) +
          ', setting speed=' + r2(speed) +
          ', future target=' + r2(futureTargetVideoFrame) +
          ', future error=' + r2(futureFrameError));
      }
    }
    if (!this._ready) {
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
    }
  }
  _pipelineToString() {
    var str = '[';
    for (var i = 0; i < WebGLVideoTile.PIPELINE_SIZE; i++) {
      if (i)
        str += ', ';
      str += this._pipeline[i].frameno;
    }
    str += ']';
    return str;
  }
  _captureFrame(captureFrameno, destIndex) {
    this.frameCount++;
    this._pipeline[destIndex].frameno = captureFrameno;
    var gl = this.gl;
    var readyState = this._video.readyState;
    var currentTime = this._video.currentTime;
    var before = performance.now();

    this._pipeline[destIndex].texture.ready = readyState;
    this._pipeline[destIndex].texture.before = currentTime;
    this._pipeline[destIndex].texture.rate = this._video.playbackRate;

    gl.bindTexture(gl.TEXTURE_2D, this._pipeline[destIndex].texture);

    //console.time("gl.texImage2D");
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._video);
    //console.timeEnd("gl.texImage2D");
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._pipeline[destIndex].texture.after = this._video.currentTime;
    var elapsed = performance.now() - before;
    //WebGLTimeMachinePerf.instance.recordVideoFrameCapture(elapsed);
    if (WebGLVideoTile.verbose) {
      console.log(this._id + ': captured frame ' + captureFrameno +
        ' to pipeline[' + destIndex + '] in '
        + Math.round(elapsed) + ' ms ' +
        this._pipelineToString());
    }
    //if (elapsed > 10) {
    //console.log(this._id + ': long capture time ' + Math.round(elapsed) + ' ms.  readyState was ' + readyState +
    //     ', time was ' + currentTime);
    //}
    //if (this._ready) {
    //  var advance = (this._pipeline[destIndex].frameno - this._pipeline[destIndex - 1].frameno + this._nframes) % this._nframes;
    //  WebGLVideoTile.frameCount += advance;
    //  if (advance != 1) {
    //    console.log(this._id + ': skipped ' + (advance - 1) + ' frames');
    //    WebGLVideoTile.missedFrameCount += (advance - 1);
    //    WebGLTimeMachinePerf.instance.recordMissedFrames(advance - 1);
    //  }
    //}
  }
  drawTile(transform) {
    var gl = this.gl;
    var tileTransform = new Float32Array(transform);
    translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
    scaleMatrix(tileTransform,
      this._bounds.max.x - this._bounds.min.x,
      this._bounds.max.y - this._bounds.min.y);

    // Draw video
    if (this._ready) {
      var activeProgram;

      if (WebGLVideoTile.useFaderShader) {
        if (this.layer._program == "textureTintFaderProgram") {
          activeProgram = this._textureTintFaderProgram;
        }
        else if (this.layer._colormap) {
          activeProgram = this._textureColormapFaderProgram;
        }
        else if (this._useGreenScreen) {
          activeProgram = this._textureGreenScreenFaderProgram;
        }
        else {
          activeProgram = this._textureFaderProgram;
        }

        gl.useProgram(activeProgram);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniform1f(activeProgram.uAlpha, this._uAlpha);

        var u_image0Location = activeProgram.uSampler;
        var u_image1Location = activeProgram.uSampler2;

        gl.uniform1i(u_image0Location, 0); // texture unit 0
        gl.uniform1i(u_image1Location, 1); // texture unit 1

        if (this.layer._colormap) {
          gl.uniform1i(activeProgram.uColormap, 2); // texture unit 2
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, this.layer._colormap);
        }

        gl.uniformMatrix4fv(activeProgram.uTransform, false, tileTransform);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
        gl.enableVertexAttribArray(activeProgram.aTextureCoord);
        gl.vertexAttribPointer(activeProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._pipeline[0].texture);

        gl.activeTexture(gl.TEXTURE1);

        var numTimelapseFrames = this._nframes;
        // TODO -- why is there a texture still in pipeline[1] that isn't usable when the timelapse is paused?
        if (this._pipeline[1].texture &&
          this._pipeline[1].frameno < numTimelapseFrames &&
          this._pipeline[1].frameno > this._pipeline[0].frameno &&
          !this.isPaused) {
          gl.bindTexture(gl.TEXTURE_2D, this._pipeline[1].texture);
        }
        else {
          gl.bindTexture(gl.TEXTURE_2D, this._pipeline[0].texture);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.disable(gl.BLEND);
      }
      else {
        if (this._useGreenScreen) {
          activeProgram = this._textureGreenScreenProgram;
        }
        else {
          activeProgram = this._textureProgram;
        }
        gl.useProgram(activeProgram);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(activeProgram.uTransform, false, tileTransform);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
        gl.vertexAttribPointer(activeProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(activeProgram.aTextureCoord);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._pipeline[0].texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.disable(gl.BLEND);
      }
    }
  }
  static _init() {
    WebGLVideoTile._initted = true;

    $(document).keypress(function (e) {
      // ctrl-b toggles verbosity
      if (e.keyCode == 2) {
        WebGLVideoTile.verbose = !WebGLVideoTile.verbose;
        //console.log('WebGLVideoTile verbose: ' + WebGLVideoTile.verbose);
      }
    });
  }
  static stats() {
    var r2 = WebGLVideoTile.r2;
    return ('WebGLVideoTile stats. Active tiles: ' + WebGLVideoTile.activeTileCount +
      ', Number of seeks: ' + WebGLVideoTile.totalSeekCount +
      ', Average seek duration: ' + r2(WebGLVideoTile.averageSeekFrameCount()) + ' frames' +
      ', Missed frames: ' + r2(WebGLVideoTile.missedFrameCount * 100 / WebGLVideoTile.frameCount) + '%');
  }
  static averageSeekFrameCount() {
    return WebGLVideoTile.totalSeekingFrameCount / WebGLVideoTile.totalSeekCount;
  }
  static getUnusedFrameOffsetIndex() {
    for (var i = 0; i < WebGLVideoTile._frameOffsets.length; i++) {
      if (!WebGLVideoTile._frameOffsetUsed[i]) {
        WebGLVideoTile._frameOffsetUsed[i] = true;
        return i;
      }
    }
    throw new Error('Out of offsets because we have ' + WebGLVideoTile._frameOffsets.length + ' videos');
  }
  static r2(x) {
    return Math.round(x * 100) / 100;
  }

  // Phases = 60 / videoFPS
  // Subbits is log2 of the max number of videos per phase
  static computeFrameOffsets(phases, subbits) {
    WebGLVideoTile._frameOffsets = [];
    var subphases = 1 << subbits;
    for (var s = 0; s < subphases; s++) {
      // Arrange subphases across [0, 1) such that locations for any length contiguous subset starting at the first subphase
      // will be sparse.
      // E.g. for 3 subbits, [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875]
      var sfrac = 0;
      for (var b = 0; b < subbits; b++) {
        sfrac += ((s >> b) & 1) << (subbits - b - 1);
      }
      for (var p = 0; p < phases; p++) {
        // Compress phases into 0.5 - 1 range
        WebGLVideoTile._frameOffsets.push(0.5 + 0.5 * (p + sfrac / subphases) / phases);
      }
    }
    WebGLVideoTile._frameOffsetUsed = [];
    for (var i = 0; i < WebGLVideoTile._frameOffsets; i++) {
      WebGLVideoTile._frameOffsetUsed.push(false);
    }
  }
}


// Texture pipeline is 4 deep
// 0: currently being drawn
// 1: captured, waiting for drawn.  (Might still be captured if we're a little behind.)
// 2: currently being captured
// 3: might still be used by chrome from last frame

WebGLVideoTile.PIPELINE_SIZE = 4;

WebGLVideoTile.videoId = 0;
WebGLVideoTile.totalSeekingFrameCount = 0;
WebGLVideoTile.totalSeekCount = 0;
WebGLVideoTile.verbose = false;
WebGLVideoTile.frameCount = 0;
WebGLVideoTile.missedFrameCount = 0;
WebGLVideoTile.activeTileCount = 0;
WebGLVideoTile._initted = false;

WebGLVideoTile.useFaderShader = false;

// 3x2^4 = 48 available offsets
// 3x2^5 = 96 available offsets
WebGLVideoTile.computeFrameOffsets(3, 5);

WebGLVideoTile.textureVertexShader = `
attribute vec2 aTextureCoord;
uniform mat4 uTransform;
varying vec2 vTextureCoord;
void main(void) {
  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);
  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);
}`;

WebGLVideoTile.textureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  gl_FragColor = vec4(textureColor.rgb, 1);
}`;

WebGLVideoTile.textureFragmentFaderShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform float uAlpha;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));
  gl_FragColor = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;
}`;


WebGLVideoTile.textureFragmentGrayScaleFaderShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform float uAlpha;
vec4 to_grayscale(vec4 color) {
  float avg = (color.r + color.g + color.b) / 3.0;
  return vec4(avg, avg, avg, 1.0);
}
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));
  gl_FragColor = to_grayscale(textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha);
}`;

WebGLVideoTile.textureFragmentTintFaderShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform sampler2D uColormap;
uniform float uAlpha;
vec4 to_grayscale(vec4 color) {
  float avg = (color.r + color.g + color.b) / 3.0;
  return vec4(avg, avg, avg, 1.0);
}
vec4 tint(vec4 grayscale, vec4 color) {
  return vec4(grayscale * color);
}
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));
  //vec4 color = vec4(0.0,0.0,0.8039, 1.0);
  vec4 color = vec4(0.,0.0,0.44, 1.);
  //gl_FragColor = tint(to_grayscale(textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha), color);
  vec4 mixed = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;
  gl_FragColor = texture2D(uColormap, vec2(mixed.g, 0.0));
}`;

WebGLVideoTile.textureColormapFragmentFaderShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform sampler2D uColormap;
uniform float uAlpha;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 mixed = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;
  gl_FragColor = texture2D(uColormap, vec2(mixed.g, 0.0));
}`;

WebGLVideoTile.textureGreenScreenFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  if (textureColor.r < .5) {
    gl_FragColor = vec4(textureColor.rgb, textureColor.r);
  } else {
    gl_FragColor = vec4(textureColor.rgb, 1.);
  }
}`;

WebGLVideoTile.textureGreenScreenFragmentFaderShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform float uAlpha;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 fragColor = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;
  if (fragColor.r + fragColor.g + fragColor.b < .5) {
    gl_FragColor = vec4(fragColor.rgb, (fragColor.r + fragColor.g + fragColor.b)/.5);
  } else {
    gl_FragColor = fragColor;
  }
}`;


