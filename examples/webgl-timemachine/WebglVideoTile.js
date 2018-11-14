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

function WebglVideoTile(glb, tileidx, bounds, url, defaultUrl, numFrames, fps, greenScreen, layer) {
  if (!WebglVideoTile._initted) {
    WebglVideoTile._init();
  }
  this.layer = layer;
  this._tileidx = tileidx;
  this.glb = glb;
  this.gl = glb.gl;
  this._lineProgram = glb.programFromSources(Glb.fixedSizePointVertexShader,
                                             Glb.solidColorFragmentShader);
  this._textureProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureFragmentShader);

  this._textureFaderProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureFragmentFaderShader);

  this._textureTintFaderProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureFragmentTintFaderShader);

  this._textureColormapFaderProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureColormapFragmentFaderShader);

  this._textureGreenScreenProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureGreenScreenFragmentShader);

  this._textureGreenScreenFaderProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureGreenScreenFragmentFaderShader);

  var inset = (bounds.max.x - bounds.min.x) * 0.005;
  this._insetRectangle = glb.createBuffer(new Float32Array([0.01, 0.01,
                                                            0.99, 0.01,
                                                            0.99, 0.99,
                                                            0.01, 0.99]));
  this._triangles = glb.createBuffer(new Float32Array([0, 0,
                                                       1, 0,
                                                       0, 1,
                                                       1, 1]));

  // Mobile uses TimeMachine canvas to render the videos
  if (org.gigapan.Util.isMobileDevice()) {
    this._video = {};
  } else {
    this._video = document.createElement('video');
    // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
    // sea tiles and replace with a single default tile.
    this._video.addEventListener('error', function(event) {
      if (self._video) {
        if (self._video.networkState == HTMLVideoElement.NETWORK_NO_SOURCE &&
            self._video.src != defaultUrl) {
          self._video.src = defaultUrl;
        }
      }
    });
  }
  this._video.crossOrigin = "anonymous";
  this._video.muted = true;
  this._video.playsinline = true;
  // The attribute should be all lowercase per the Apple docs, but apparently it needs to be camelcase.
  // Leaving both in just in case.
  this._video.playsInline = true;

  this._useGreenScreen = greenScreen;

  var self = this;

  this._video.src = url;
  this._pipeline = [];
  for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE; i++) {
    this._pipeline.push({
      texture: this._createTexture(),
      frameno: null,
    });
  }
  this._ready = false;
  // TODO: Are these hardcoded dimensions still being used?
  this._width = 1424;
  this._height = 800;
  this._bounds = bounds;
  // This min/max playback rate is specified by Chrome/FireFox and clamping to it has
  // become a requirement with latest browser updates or we suffer video playback glitches.
  this._minPlaybackRate = 0.0625;
  this._maxPlaybackRate = 16.0;
  this._frameOffsetIndex = WebglVideoTile.getUnusedFrameOffsetIndex();
  this._frameOffset = WebglVideoTile._frameOffsets[this._frameOffsetIndex];
  this._fps = fps;
  this._nframes = numFrames;
  this._id = WebglVideoTile.videoId++;
  this._seekingFrameCount = 0;
  WebglVideoTile.activeTileCount++;
}

WebglVideoTile._init = function() {
  WebglVideoTile._initted = true;

  $(document).keypress(function(e) {
      // ctrl-b toggles verbosity
      if (e.keyCode == 2) {
        WebglVideoTile.verbose = !WebglVideoTile.verbose;
        //console.log('WebglVideoTile verbose: ' + WebglVideoTile.verbose);
      }
    });
}

WebglVideoTile.prototype.
_createTexture = function() {
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

// Texture pipeline is 4 deep
// 0: currently being drawn
// 1: captured, waiting for drawn.  (Might still be captured if we're a little behind.)
// 2: currently being captured
// 3: might still be used by chrome from last frame

WebglVideoTile.PIPELINE_SIZE = 4;

WebglVideoTile.videoId = 0;
WebglVideoTile.totalSeekingFrameCount = 0;
WebglVideoTile.totalSeekCount = 0;
WebglVideoTile.verbose = false;
WebglVideoTile.frameCount = 0;
WebglVideoTile.missedFrameCount = 0;
WebglVideoTile.activeTileCount = 0;
WebglVideoTile._initted = false;

WebglVideoTile.useFaderShader = false;

WebglVideoTile.stats = function() {
  var r2 = WebglVideoTile.r2;
  return ('WebglVideoTile stats. Active tiles: ' + WebglVideoTile.activeTileCount +
          ', Number of seeks: ' + WebglVideoTile.totalSeekCount +
          ', Average seek duration: ' + r2(WebglVideoTile.averageSeekFrameCount()) + ' frames' +
          ', Missed frames: ' + r2(WebglVideoTile.missedFrameCount * 100 / WebglVideoTile.frameCount) + '%');
}

WebglVideoTile.averageSeekFrameCount = function() {
  return WebglVideoTile.totalSeekingFrameCount / WebglVideoTile.totalSeekCount;
}

WebglVideoTile.prototype.
delete = function() {
  // Mobile uses TimeMachine canvas to render the videos
  if (org.gigapan.Util.isMobileDevice()) return;

  // TODO: recycle texture
  if (this._videoPlayPromise !== undefined) {
    var that = this;
    this._videoPlayPromise.then(function (_) {
      if (!that._video) return;
      if (!that._video.paused) {
        that._video.pause();
      }
      that._video.src = '';
      that._video = null;
    }).catch(function (error) {
      console.log(error);
    });
  } else {
    if (!this._video.paused) {
      this._video.pause();
    }
    this._video.src = '';
    this._video = null;
  }
  WebglVideoTile._frameOffsetUsed[this._frameOffsetIndex] = false;
  this._frameOffsetIndex = null;
  WebglVideoTile.activeTileCount--;
}

WebglVideoTile.getUnusedFrameOffsetIndex = function() {
  for (var i = 0; i < WebglVideoTile._frameOffsets.length; i++) {
    if (!WebglVideoTile._frameOffsetUsed[i]) {
      WebglVideoTile._frameOffsetUsed[i] = true;
      return i;
    }
  }
  throw new Error('Out of offsets because we have ' + WebglVideoTile._frameOffsets.length + ' videos');
}

WebglVideoTile.prototype.
toString = function() {
  return 'Tile ' + this._tileidx.toString() +
         ', ready: ' + this.isReady() +
         ', seq: ' + this._frameOffsetIndex + ' (' + this._frameOffset + ')'
};

WebglVideoTile.prototype.
isReady = function() {
  return this._ready;
};

WebglVideoTile.r2 = function(x) {
  return Math.round(x * 100) / 100;
};

// We need the current frame, plus the next two future frames
WebglVideoTile.prototype.
_frameIsNeeded = function(frameno, displayFrameDiscrete) {
  var future = (frameno - displayFrameDiscrete + this._nframes) % this._nframes;
  return future <= 2;
}

// Flush any frames in the pipeline which aren't about to be used
WebglVideoTile.prototype.
_flushUnneededFrames = function(displayFrameDiscrete) {
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

  if (changed && WebglVideoTile.verbose) {
    console.log(this._id + ': flushed frames, now ' + this._pipelineToString() + ' ' + this._computeNextCaptureFrame(displayFrameDiscrete, timelapse.isPaused()));
  }
}

// Advance the pipeline if we're now display a frame that's at element 1
WebglVideoTile.prototype.
_tryAdvancePipeline = function(displayFrameDiscrete) {
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
    for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
      this._pipeline[i] = this._pipeline[i + 1];
    }
    this._pipeline[WebglVideoTile.PIPELINE_SIZE - 1] = tmp;
    this._ready = true;
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': Advancing pipeline, now ' + this._pipelineToString() + ' ' + this._computeNextCaptureFrame(displayFrameDiscrete, timelapse.isPaused()));
    }
  }
}

WebglVideoTile.prototype.
_frameIsInPipeline = function(frameno) {
  for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
    if (this._pipeline[i].frameno == frameno) {
      return true;
    }
  }
  return false;
}

WebglVideoTile.prototype.
_tryCaptureFrame = function(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete, isPaused) {
  // Only try to capture if it's needed, if we're not currently showing (too late),
  // and if in the safe range of times to capture
  if ((isPaused || displayFrameDiscrete != actualVideoFrameDiscrete) &&
      this._frameIsNeeded(actualVideoFrameDiscrete, displayFrameDiscrete) &&
      !this._frameIsInPipeline(actualVideoFrameDiscrete) &&
      0.1 < (actualVideoFrame % 1.0) &&
      (actualVideoFrame % 1.0) < 0.9) {

    if (displayFrameDiscrete == actualVideoFrameDiscrete) {
      this._captureFrame(actualVideoFrameDiscrete, 0);
      this._ready = true;
    } else {
      for (var i = 1; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
        if (this._pipeline[i].frameno == null) {
          this._captureFrame(actualVideoFrameDiscrete, i);
          break;
        }
      }
    }
  }
}

WebglVideoTile.prototype.
_checkForMissedFrame = function(displayFrameDiscrete) {
  if (this._ready &&
      displayFrameDiscrete != this._lastDisplayFrame &&
      displayFrameDiscrete != this._pipeline[0].frameno) {
    //console.log(this._id + ': missed frame ' + displayFrameDiscrete +
    //            ', pipeline: ' + this._pipelineToString());
    //WebglTimeMachinePerf.instance.recordMissedFrames(1);
    this._missedFrameCount++;
  }
  this._lastDisplayFrame = displayFrameDiscrete;
}

// This should always return one of
// displayFrameDiscrete +1, +2, +3
WebglVideoTile.prototype.
_computeNextCaptureFrame = function(displayFrameDiscrete, isPaused) {
  // If paused and we don't have the current frame, that's the one we need
  if (isPaused && this._pipeline[0].frameno != displayFrameDiscrete) {
    return displayFrameDiscrete;
  }
  var lastFrame = null;
  for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
    if (this._pipeline[i].frameno != null) {
      lastFrame = this._pipeline[i].frameno;
    }
  }
  var future;
  if (lastFrame == null) {
    future = 2;
  } else {
    future = (lastFrame - displayFrameDiscrete + this._nframes) % this._nframes + 1;
    if (future < 1 || future > 3) {
      future = 2;
    }
  }
  return (displayFrameDiscrete + future) % this._nframes;
}

WebglVideoTile.prototype.
_computeCapturePriority = function(displayFrameDiscrete, actualVideoFrame,
                                   actualVideoFrameDiscrete) {
  return 1;
}

// First phase of update
// Cleans up and advances pipelines
// Computes priority of capture
WebglVideoTile.prototype.
updatePhase1 = function(displayFrame) {
  this._capturePriority = 0;
  var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);

  this._uAlpha = displayFrame - displayFrameDiscrete;

  var r2 = WebglVideoTile.r2;
  // Output stats every 5 seconds
  /*if (!WebglVideoTile.lastStatsTime) {
    WebglVideoTile.lastStatsTime = performance.now();
  } else if (performance.now() - WebglVideoTile.lastStatsTime > 5000) {
    console.log(WebglVideoTile.stats());
    WebglVideoTile.lastStatsTime = performance.now();
  }*/

  // Synchronize video playback

  // TODO(rsargent): don't hardcode access to global timelapse object

  var readyState = this._video.readyState;

  if (readyState == 0) {
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': loading');
    }
    return;
  }

  var actualVideoFrame = this._video.currentTime * this._fps;
  var actualVideoFrameDiscrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

  this._flushUnneededFrames(displayFrameDiscrete);
  this._tryAdvancePipeline(displayFrameDiscrete);
  if (readyState > 1) {
    this._capturePriority = this._computeCapturePriority(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete);
  }
}

// Second phase of update
// Captures frame, if desirable and time still left
// Adjusts time or requests seek to maintain video time sync
WebglVideoTile.prototype.
updatePhase2 = function(displayFrame) {
  var r2 = WebglVideoTile.r2;
  var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);
  var readyState = this._video.readyState;
  var isPaused = timelapse.isPaused();

  // TODO: Hack for frames with fixed year or range of Landsat years to be shown.
  // Any layer where we set a fixed frame (or range of frames) needs to set isPaused or no new tiles are brought in until you pause.
  if (typeof showUrbanFragilityLayer != "undefined" && showUrbanFragilityLayer) {
    isPaused = true;
  }

  if (typeof showAnnualRefugeesLayer != "undefined" && showAnnualRefugeesLayer) {
    isPaused = true;
  }

  if (typeof showViirsLayer != "undefined" && showViirsLayer) {
    isPaused = true;
  }

  if (typeof showDrillingLayer != "undefined" && showDrillingLayer) {
    isPaused = true;
  }

  if (typeof showSeaLevelRiseLayer != "undefined" && showSeaLevelRiseLayer) {
    isPaused = true;
  }

  if (readyState == 0) {
    return;
  }

  var actualVideoFrame = this._video.currentTime * this._fps;
  var actualVideoFrameDiscrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

  if (readyState > 1 && !redrawTakingTooLong()) {
    this._tryCaptureFrame(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete, isPaused);
  }
  this._checkForMissedFrame(displayFrameDiscrete);

  if (this._video.seeking) {
    this._seekingFrameCount++;
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': seeking for ' + this._seekingFrameCount + ' frames');
    }
    return false;
  }

  if (this._seekingFrameCount != 0) {
    WebglVideoTile.totalSeekingFrameCount += this._seekingFrameCount;
    WebglVideoTile.totalSeekCount++;
    this._seekingFrameCount = 0;
  }

  var nextNeededFrame = this._computeNextCaptureFrame(displayFrameDiscrete, isPaused);

  var webglFps = 60;
  // Imagine we're going to drop a frame.  Aim to be at the right place in 3 frames
  var future = (timelapse.getPlaybackRate() * this._fps / webglFps) * 3;

  // Desired video tile time leads display by frameOffset+1.3
  var targetVideoFrame = (displayFrame + this._frameOffset + 1.2) % this._nframes;

  var futureTargetVideoFrame = (targetVideoFrame + future) % this._nframes;

  if (isPaused && nextNeededFrame == displayFrameDiscrete) {
    // Paused and we need the current frame
    futureTargetVideoFrame = displayFrameDiscrete + 0.5;
  } else {
    // Slow down by up to half a frame to make sure to get the next requested frame
    futureTargetVideoFrame = Math.min(futureTargetVideoFrame,
                                      nextNeededFrame + 0.5);
  }
  // Set speed so that in one webgl frame, we'll be exactly at the right time
  var speed = (futureTargetVideoFrame - actualVideoFrame) / future;

  if (isNaN(speed)) speed = 0.5;
  if (speed < 0) speed = 0;
  if (speed > 5) speed = 5;
  if (speed > 0 && this._video.paused) {
    this._videoPlayPromise = this._video.play();
  } else if (speed == 0 && !this._video.paused) {
    this._video.pause();
  }

  var futureFrameError = futureTargetVideoFrame - (actualVideoFrame + speed * (this._fps / webglFps));

  if (futureFrameError < -5 ||
      futureFrameError > 5 ||
      (isPaused && futureFrameError < -0.3)) {
    // If we need to go back any or forward a lot, seek instead of changing speed
    var seekTime = nextNeededFrame + 0.5;
    this._video.currentTime = (nextNeededFrame + 0.5) / this._fps;
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': onscreen=' + this._pipeline[0].frameno +
                  ', display=' + r2(displayFrame) +
                  ', nextNeededFrame=' + nextNeededFrame +
                  ', desired=' + r2(targetVideoFrame) +
                  ', offset=' + r2(this._frameOffset) +
                  ', actual=' + r2(actualVideoFrame) +
                  ', seeking to=' + r2(seekTime));
    }
  } else {
    this._video.playbackRate = Math.min(Math.max(speed, this._minPlaybackRate), this._maxPlaybackRate);
    if (WebglVideoTile.verbose) {
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
}

WebglVideoTile.prototype.
_pipelineToString = function() {
  var str = '[';
  for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE; i++) {
    if (i) str += ', ';
    str += this._pipeline[i].frameno;
  }
  str += ']'
  return str;
}

WebglVideoTile.prototype.
_captureFrame = function(captureFrameno, destIndex) {
  this.frameCount++;
  this._pipeline[destIndex].frameno = captureFrameno;
  var gl = this.gl;
  var readyState = this._video.readyState;
  var currentTime = this._video.currentTime;
  var before = performance.now();

  gl.bindTexture(gl.TEXTURE_2D, this._pipeline[destIndex].texture);

  //console.time("gl.texImage2D");
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._video);
  //console.timeEnd("gl.texImage2D");
  gl.bindTexture(gl.TEXTURE_2D, null);
  var elapsed = performance.now() - before;
  //WebglTimeMachinePerf.instance.recordVideoFrameCapture(elapsed);
  if (WebglVideoTile.verbose) {
    console.log(this._id + ': captured frame ' + captureFrameno +
                ' to pipeline[' + destIndex + '] in '
                + Math.round(elapsed) + ' ms ' +
                this._pipelineToString());
  }
  if (elapsed > 10) {
    //console.log(this._id + ': long capture time ' + Math.round(elapsed) + ' ms.  readyState was ' + readyState +
	  //     ', time was ' + currentTime);
  }

  //if (this._ready) {
  //  var advance = (this._pipeline[destIndex].frameno - this._pipeline[destIndex - 1].frameno + this._nframes) % this._nframes;
  //  WebglVideoTile.frameCount += advance;
  //  if (advance != 1) {
  //    console.log(this._id + ': skipped ' + (advance - 1) + ' frames');
  //    WebglVideoTile.missedFrameCount += (advance - 1);
  //    WebglTimeMachinePerf.instance.recordMissedFrames(advance - 1);
  //  }
  //}
}

WebglVideoTile.prototype.
draw = function(transform) {
  var gl = this.gl;
  var tileTransform = new Float32Array(transform);
  translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
  scaleMatrix(tileTransform,
              this._bounds.max.x - this._bounds.min.x,
              this._bounds.max.y - this._bounds.min.y);

  var drawRectangle = false;

  if (drawRectangle) {
    // Draw rectangle
    gl.useProgram(this._lineProgram);
    gl.uniformMatrix4fv(this._lineProgram.uTransform, false, tileTransform);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._insetRectangle);
    gl.vertexAttribPointer(this._lineProgram.aWorldCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this._lineProgram.aWorldCoord);
    gl.drawArrays(gl.LINE_LOOP, 0, 4);
  }

  // Draw video
  if (this._ready) {
    var activeProgram;

    if (WebglVideoTile.useFaderShader) {
      if (this.layer._program == "textureTintFaderProgram") {
        activeProgram = this._textureTintFaderProgram;
      } else if (this.layer._colormap) {
        activeProgram = this._textureColormapFaderProgram;
      } else if (this._useGreenScreen) {
        activeProgram = this._textureGreenScreenFaderProgram;
      } else {
        activeProgram = this._textureFaderProgram;
      }

      gl.useProgram(activeProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

      var alphaLocation = gl.getUniformLocation(activeProgram, "uAlpha");
      gl.uniform1f(alphaLocation, this._uAlpha);

      var u_image0Location = gl.getUniformLocation(activeProgram, "uSampler");
      var u_image1Location = gl.getUniformLocation(activeProgram, "uSampler2");

      gl.uniform1i(u_image0Location, 0);  // texture unit 0
      gl.uniform1i(u_image1Location, 1);  // texture unit 1

      if (this.layer._colormap) {
        gl.uniform1i(gl.getUniformLocation(activeProgram, "uColormap"), 2); // texture unit 2
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

      var isPaused = timelapse.isPaused();

      if (typeof showUrbanFragilityLayer != "undefined" && showUrbanFragilityLayer) {
        isPaused = true;
      }

      if (typeof showAnnualRefugeesLayer != "undefined" && showAnnualRefugeesLayer) {
        isPaused = true;
      }

      if (typeof showViirsLayer != "undefined" && showViirsLayer) {
        isPaused = true;
      }

      if (typeof showDrillingLayer != "undefined" && showDrillingLayer) {
        isPaused = true;
      }

      if (typeof showSeaLevelRiseLayer != "undefined" && showSeaLevelRiseLayer) {
        isPaused = true;
      }

      var numTimelapseFrames = this._nframes;
      // TODO -- why is there a texture still in pipeline[1] that isn't usable when the timelapse is paused?
      if (this._pipeline[1].texture &&
          this._pipeline[1].frameno < numTimelapseFrames &&
          this._pipeline[1].frameno > this._pipeline[0].frameno &&
          !isPaused) {
        gl.bindTexture(gl.TEXTURE_2D, this._pipeline[1].texture);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, this._pipeline[0].texture);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);
    } else {
      if (this._useGreenScreen) {
        activeProgram = this._textureGreenScreenProgram;
      } else {
        activeProgram = this._textureProgram;
      }
      gl.useProgram(activeProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

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
};

// Update and draw tiles
WebglVideoTile.update = function(tiles, transform) {
  if (si || tiles.length == 0) return;
  //WebglTimeMachinePerf.instance.startFrame();

  var canvas = document.getElementById('webgl');

  var fps = tiles[0]._fps

  var displayFrame = timelapse.getVideoset().getCurrentTime() * fps;

  var numTimelapseFrames = tiles[0]._nframes;

  // A layer may start at a different year than when Landsat starts. Tweak accordingly.
  var appliedOffset = false;
  if (tiles[0].options.startYear) {
    var layerStartYear = tiles[0].options.startYear;
    var timelineStartDate = timelapse.getCaptureTimes()[0];
    // Assumes YYYY
    if (timelineStartDate.length == 4) {
      var timelineStartYear = parseInt(timelineStartDate);
      var yearOffset = timelineStartYear - layerStartYear;
      if (yearOffset > 0) {
        displayFrame = Math.min(numTimelapseFrames, displayFrame + yearOffset);
        appliedOffset = true;
      }
    // Assumes YYYY-MM-DD
    } else if (timelineStartDate.length == 10) {
      var yearString = timelapse.getCurrentCaptureTime().substring(0,4);
      var year = parseInt(yearString);
      if (year > 0) {
        displayFrame = Math.max(0, year - layerStartYear);
        appliedOffset = true;
      }
    }
  }

  if (!appliedOffset) {
    // TODO: Hack for future facing layers that require the last year of Landsat
    if (typeof showSeaLevelRiseLayer != "undefined" && showSeaLevelRiseLayer) {
      displayFrame = numTimelapseFrames - 1;
    }
  }

  for (var i = 0; i < tiles.length; i++) {
    tiles[i].updatePhase1(displayFrame);  // Frame being displayed on screen
  }

  // TODO(rsargent): draw tiles low to high-res, or clip and don't draw the overlapping portions
  // of the low-res tiles
  for (var i = 0; i < tiles.length; i++) {
    tiles[i].updatePhase2(displayFrame);  // Frame being displayed on screen
    tiles[i].draw(transform);
  }
  //WebglTimeMachinePerf.instance.endFrame();
}


// Phases = 60 / videoFPS
// Subbits is log2 of the max number of videos per phase

WebglVideoTile.computeFrameOffsets = function(phases, subbits) {
  WebglVideoTile._frameOffsets = [];
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
      WebglVideoTile._frameOffsets.push(0.5 + 0.5 * (p + sfrac / subphases) / phases);
    }
  }
  WebglVideoTile._frameOffsetUsed = []
  for (var i = 0; i < WebglVideoTile._frameOffsets; i++) {
    WebglVideoTile._frameOffsetUsed.push(false);
  }
}

// 3x2^4 = 48 available offsets
// 3x2^5 = 96 available offsets
WebglVideoTile.computeFrameOffsets(3, 5);

WebglVideoTile.textureVertexShader =
  'attribute vec2 aTextureCoord;\n' +
  'uniform mat4 uTransform;\n' +
  'varying vec2 vTextureCoord;\n' +

  'void main(void) {\n' +
  '  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);\n' +
  '  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);\n' +
  '}\n';

WebglVideoTile.textureFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  gl_FragColor = vec4(textureColor.rgb, 1);\n' +
  '}\n';

WebglVideoTile.textureFragmentFaderShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform sampler2D uSampler2;\n' +
  'uniform float uAlpha;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)); \n' +
  '  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  gl_FragColor = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;\n' +
  '}\n';


WebglVideoTile.textureFragmentGrayScaleFaderShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform sampler2D uSampler2;\n' +
  'uniform float uAlpha;\n' +
  'vec4 to_grayscale(vec4 color) {\n' +
  '  float avg = (color.r + color.g + color.b) / 3.0;\n' +
  '  return vec4(avg, avg, avg, 1.0);\n' +
  '}\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)); \n' +
  '  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  gl_FragColor = to_grayscale(textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha);\n' +
  '}\n';

WebglVideoTile.textureFragmentTintFaderShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform sampler2D uSampler2;\n' +
  'uniform sampler2D uColormap;\n' +
  'uniform float uAlpha;\n' +
  'vec4 to_grayscale(vec4 color) {\n' +
  '  float avg = (color.r + color.g + color.b) / 3.0;\n' +
  '  return vec4(avg, avg, avg, 1.0);\n' +
  '}\n' +
  'vec4 tint(vec4 grayscale, vec4 color) {\n' +
  '  return vec4(grayscale * color);\n' +
  '}\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)); \n' +
  '  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  //vec4 color = vec4(0.0,0.0,0.8039, 1.0);\n' + 
  '  vec4 color = vec4(0.,0.0,0.44, 1.);\n' + 
  '  //gl_FragColor = tint(to_grayscale(textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha), color);\n' +
  '  vec4 mixed = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;\n' +
  '  gl_FragColor = texture2D(uColormap, vec2(mixed.g, 0.0));\n' +
  '}\n';

WebglVideoTile.textureColormapFragmentFaderShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform sampler2D uSampler2;\n' +
  'uniform sampler2D uColormap;\n' +
  'uniform float uAlpha;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)); \n' +
  '  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  vec4 mixed = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;\n' +
  '  gl_FragColor = texture2D(uColormap, vec2(mixed.g, 0.0));\n' +
  '}\n';

WebglVideoTile.textureGreenScreenFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  if (textureColor.r < .5) { \n' +
  '    gl_FragColor = vec4(textureColor.rgb, textureColor.r);\n' +
  '  } else { \n' +
  '    gl_FragColor = vec4(textureColor.rgb, 1.);\n' +
  '  }\n' +
  '}\n';

WebglVideoTile.textureGreenScreenFragmentFaderShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform sampler2D uSampler2;\n' +
  'uniform float uAlpha;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)); \n' +
  '  vec4 textureColor2 = texture2D(uSampler2, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  vec4 fragColor = textureColor * (1.0 - uAlpha) + textureColor2 * uAlpha;\n' +
  '  if (fragColor.r + fragColor.g + fragColor.b < .5) { \n' +
  '    gl_FragColor = vec4(fragColor.rgb, (fragColor.r + fragColor.g + fragColor.b)/.5);\n' +
  '  } else { \n' +
  '    gl_FragColor = fragColor;\n' +
  '  }\n' +
  '}\n';


// stopit:  set to true to disable update()
var si = false;
