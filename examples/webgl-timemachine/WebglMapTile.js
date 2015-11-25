"use strict";

function WebglMapTile(glb, tileidx, bounds, url, defaultUrl) {
  if (!WebglMapTile._initted) {
    WebglMapTile._init();
  }
  this._tileidx = tileidx;
  this.glb = glb;
  this.gl = glb.gl;
  this._lineProgram = glb.programFromSources(Glb.fixedSizePointVertexShader,
                                             Glb.solidColorFragmentShader);
  this._textureProgram = glb.programFromSources(WebglMapTile.textureVertexShader,
                                                WebglMapTile.textureFragmentShader);
  this._texture = this._createTexture();

  var inset = (bounds.max.x - bounds.min.x) * 0.005;
  this._insetRectangle = glb.createBuffer(new Float32Array([0.01, 0.01,
                                                            0.99, 0.01,
                                                            0.99, 0.99,
                                                            0.01, 0.99]));
  this._triangles = glb.createBuffer(new Float32Array([0, 0,
                                                       1, 0,
                                                       0, 1,
                                                       1, 1]));

  this._image = new Image();
  this._image.crossOrigin = "anonymous";
  var that = this;
  this._image.onload = function() {
    that._handleLoadedTexture();
  }

  // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
  // sea tiles and replace with a single default tile.
  this._image.addEventListener('error', function(event) {
    if (that._image) {
      if (that._image.src != defaultUrl) {
        that._image.src = defaultUrl;
      }
    }
  });

  this._image.src = url;
  this._ready = false;
  this._width = 256;
  this._height = 256;
  this._bounds = bounds;
  this._id = WebglMapTile.videoId++;
  WebglMapTile.activeTileCount++;
}

WebglMapTile._init = function() {
  WebglMapTile._initted = true;

  $(document).keypress(function(e) {
      // ctrl-b toggles verbosity
      if (e.keyCode == 2) {
        WebglMapTile.verbose = !WebglMapTile.verbose;
        //console.log('WebglMapTile verbose: ' + WebglMapTile.verbose);
      }
    });
}

WebglMapTile.prototype._createTexture = function() {
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

WebglMapTile.prototype._handleLoadedTexture = function() {
    var before = performance.now();

    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    //console.time("gl.texImage2D");
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
    //console.timeEnd("gl.texImage2D");
    gl.bindTexture(gl.TEXTURE_2D, null);
    var elapsed = performance.now() - before;
    //console.log(this.toString() + ': copied the texture in ' + elapsed + ' ms');
    this._ready = true;
}

WebglMapTile.videoId = 0;
WebglMapTile.verbose = false;
WebglMapTile.activeTileCount = 0;
WebglMapTile._initted = false;

WebglMapTile.stats = function() {
  return ('WebglMapTile stats. Active tiles: ' + WebglMapTile.activeTileCount);
}

WebglMapTile.prototype.
delete = function() {
  // TODO: recycle texture
  this._image.src = '';
  this._image = null;
  WebglMapTile.activeTileCount--;
}

WebglMapTile.getUnusedFrameOffsetIndex = function() {
  for (var i = 0; i < WebglMapTile._frameOffsets.length; i++) {
    if (!WebglMapTile._frameOffsetUsed[i]) {
      WebglMapTile._frameOffsetUsed[i] = true;
      return i;
    }
  }
  throw new Error('Out of offsets because we have ' + WebglMapTile._frameOffsets.length + ' videos');
}

WebglMapTile.prototype.
toString = function() {
  return 'Tile ' + this._tileidx.toString() +
         ', ready: ' + this.isReady();
};

WebglMapTile.prototype.
isReady = function() {
  return this._ready;
};

WebglMapTile.r2 = function(x) {
  return Math.round(x * 100) / 100;
};

WebglMapTile.prototype.
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
      for (var i = 1; i < WebglMapTile.PIPELINE_SIZE - 1; i++) {
        if (this._pipeline[i].frameno == null) {
          this._captureFrame(actualVideoFrameDiscrete, i);
          break;
        }
      }
    }
  }
}

WebglMapTile.prototype.
_computeCapturePriority = function(displayFrameDiscrete, actualVideoFrame,
                                   actualVideoFrameDiscrete) {
  return 1;
}
// First phase of update
// Cleans up and advances pipelines
// Computes priority of capture
WebglMapTile.prototype.
updatePhase1 = function(displayFrame) {
  this._capturePriority = 0;
  var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);

  var r2 = WebglMapTile.r2;
  // Output stats every 5 seconds
  if (!WebglMapTile.lastStatsTime) {
    WebglMapTile.lastStatsTime = performance.now();
  } else if (performance.now() - WebglMapTile.lastStatsTime > 5000) {
    //console.log(WebglMapTile.stats());
    WebglMapTile.lastStatsTime = performance.now();
  }

  // Synchronize video playback

  // TODO(rsargent): don't hardcode access to global timelapse object

  var readyState = this._video.readyState;

  if (readyState == 0) {
    if (WebglMapTile.verbose) {
      console.log(this._id + ': loading');
    }
    return;
  }

  var actualVideoFrame = this._video.currentTime * this._fps;
  var actualVideoFrameDicrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

  this._flushUnneededFrames(displayFrameDiscrete);
  this._tryAdvancePipeline(displayFrameDiscrete);
  if (readyState > 1) {
    this._capturePriority = this._computeCapturePriority(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDicrete);
  }
}

// Second phase of update
// Captures frame, if desirable and time still left
// Adjusts time or requests seek to maintain video time sync
WebglMapTile.prototype.
updatePhase2 = function(displayFrame) {
  var r2 = WebglMapTile.r2;
  var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);
  var readyState = this._video.readyState;
  var isPaused = timelapse.isPaused();

  if (readyState == 0) {
    return;
  }

  var actualVideoFrame = this._video.currentTime * this._fps;
  var actualVideoFrameDicrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

  if (readyState > 1 && !redrawTakingTooLong()) {
    this._tryCaptureFrame(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDicrete, timelapse.isPaused());
  }
  this._checkForMissedFrame(displayFrameDiscrete);

  if (this._video.seeking) {
    this._seekingFrameCount++;
    if (WebglMapTile.verbose) {
      console.log(this._id + ': seeking for ' + this._seekingFrameCount + ' frames');
    }
    return false;
  }

  if (this._seekingFrameCount != 0) {
    WebglMapTile.totalSeekingFrameCount += this._seekingFrameCount;
    WebglMapTile.totalSeekCount++;
    this._seekingFrameCount = 0;
  }

  var nextNeededFrame = this._computeNextCaptureFrame(displayFrameDiscrete, isPaused);

  var webglFps = 60;
  // Imagine we're going to drop a frame.  Aim to be at the right place in 3 frames
  var future = (timelapse.getPlaybackRate() * this._fps / webglFps) * 3;

  // Desired video tile time leads display by frameOffset+1.3
  var targetVideoFrame = (displayFrame + this._frameOffset + 1.2) % this._nframes;

  var futureTargetVideoFrame = (targetVideoFrame + future) % this._nframes;

  // Slow down by up to half a frame to make sure to get the next requested frame
  futureTargetVideoFrame = Math.min(futureTargetVideoFrame,
                                    nextNeededFrame + 0.5);

  // Set speed so that in one webgl frame, we'll be exactly at the right time
  var speed = (futureTargetVideoFrame - actualVideoFrame) / future;
  if (speed < 0) speed = 0;
  if (speed > 5) speed = 5;
  if (speed > 0 && this._video.paused) {
    this._video.play();
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
    if (WebglMapTile.verbose) {
      console.log(this._id + ': onscreen=' + this._pipeline[0].frameno +
                  ', display=' + r2(displayFrame) +
                  ', nextNeededFrame=' + nextNeededFrame +
                  ', desired=' + r2(targetVideoFrame) +
                  ', offset=' + r2(this._frameOffset) +
                  ', actual=' + r2(actualVideoFrame) +
                  ', seeking to=' + r2(seekTime));
    }
  } else {
    this._video.playbackRate = speed;
    if (WebglMapTile.verbose) {
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

WebglMapTile.prototype.
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
  WebglTimeMachinePerf.instance.recordVideoFrameCapture(elapsed);
  if (WebglMapTile.verbose) {
    console.log(this._id + ': captured frame ' + captureFrameno +
                ' to pipeline[' + destIndex + '] in '
                + Math.round(elapsed) + ' ms ' +
                this._pipelineToString());
  }
  if (elapsed > 10) {
    //console.log(this._id + ': long capture time ' + Math.round(elapsed) + ' ms.  readyState was ' + readyState +
	       ', time was ' + currentTime);
  }

  //if (this._ready) {
  //  var advance = (this._pipeline[destIndex].frameno - this._pipeline[destIndex - 1].frameno + this._nframes) % this._nframes;
  //  WebglMapTile.frameCount += advance;
  //  if (advance != 1) {
  //    console.log(this._id + ': skipped ' + (advance - 1) + ' frames');
  //    WebglMapTile.missedFrameCount += (advance - 1);
  //    WebglTimeMachinePerf.instance.recordMissedFrames(advance - 1);
  //  }
  //}
}

WebglMapTile.prototype.
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
    gl.useProgram(this._textureProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.uniformMatrix4fv(this._textureProgram.uTransform, false, tileTransform);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
    gl.vertexAttribPointer(this._textureProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this._lineProgram.aTextureCoord);

    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
  }
};

// Update and draw tiles
// Assumes tiles is sorted low res to high res (by TileView)
WebglMapTile.update = function(tiles, transform) {
  if (si) return;
  WebglTimeMachinePerf.instance.startFrame();

  var canvas = document.getElementById('webgl');

  for (var i = 0; i < tiles.length; i++) {
    tiles[i].draw(transform);
  }

  WebglTimeMachinePerf.instance.endFrame();
}


WebglMapTile.textureVertexShader =
  'attribute vec2 aTextureCoord;\n' +
  'uniform mat4 uTransform;\n' +
  'varying vec2 vTextureCoord;\n' +

  'void main(void) {\n' +
  '  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);\n' +
  '  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);\n' +
  '}\n';


WebglMapTile.textureFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  gl_FragColor = vec4(textureColor.rgb, textureColor.a);\n' +
  '}\n';

// stopit:  set to true to disable update()
var si = false;
