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

function WebglVideoTile(glb, tileidx, bounds, url) {
  if (!WebglVideoTile._initted) {
    WebglVideoTile._init();
  }
  this._tileidx = tileidx;
  this.glb = glb;
  this.gl = glb.gl;
  this._lineProgram = glb.programFromSources(Glb.fixedSizePointVertexShader,
                                             Glb.solidColorFragmentShader);
  this._textureProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureFragmentShader);
                                                
  var inset = (bounds.max.x - bounds.min.x) * 0.005;
  this._insetRectangle = glb.createBuffer(new Float32Array([0.01, 0.01,
                                                            0.99, 0.01, 
                                                            0.99, 0.99, 
                                                            0.01, 0.99]));
  this._triangles = glb.createBuffer(new Float32Array([0, 0,
                                                       1, 0,
                                                       0, 1,
                                                       1, 1]));

  this._video = document.createElement('video');
  this._video.src = url;
  this._pipeline = [];
  for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE; i++) {
    this._pipeline.push({
      texture: this._createTexture(),
      frameno: null,
    });
  }
  this._ready = false;
  this._width = 1424;
  this._height = 800;
  this._bounds = bounds;
  this._frameOffsetIndex = WebglVideoTile.getUnusedFrameOffsetIndex();
  this._frameOffset = WebglVideoTile._frameOffsets[this._frameOffsetIndex];
  // TODO(rsargent): don't hardcode FPS and nframes
  this._fps = 10;
  this._nframes = 29;
  this._id = WebglVideoTile.videoId++;
  this._seekingFrameCount = 0;
  WebglVideoTile.activeTileCount++;
}

WebglVideoTile._init = function() {
  WebglVideoTile._initted = true;

  $(document).keypress(function(e) {
      if (e.keyCode == 118) {
        WebglVideoTile.verbose = !WebglVideoTile.verbose;
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
  // TODO: recycle texture
  this._video.pause();
  this._video.src = '';
  this._video = null;
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
    console.log(this._id + ': flushed frames, now ' + this._pipelineToString() + ' ' + this._computeNextNeededFrame(displayFrameDiscrete));
  }
}

// Advance the pipeline if we're now display a frame that's at element 1
WebglVideoTile.prototype.
_tryAdvancePipeline = function(displayFrameDiscrete) {
  if (displayFrameDiscrete == this._pipeline[1].frameno) {
    var tmp = this._pipeline[0];
    tmp.frameno = null;
    for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
      this._pipeline[i] = this._pipeline[i + 1];
    }
    this._pipeline[WebglVideoTile.PIPELINE_SIZE - 1] = tmp;
    this._ready = true;
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': Advancing pipeline, now ' + this._pipelineToString() + ' ' + this._computeNextNeededFrame(displayFrameDiscrete));
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
_tryCaptureFrame = function(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDiscrete) {
  // Don't capture the currently-displayed frameno, unless we've already advertised ourself as 'ready'
  if (displayFrameDiscrete == actualVideoFrameDiscrete && !this._ready) {
    return;
  }
    
  // Only try to capture if it's needed, if we're not currently showing (too late),
  // and if in the safe range of times to capture
  if (displayFrameDiscrete != actualVideoFrameDiscrete &&
      this._frameIsNeeded(actualVideoFrameDiscrete, displayFrameDiscrete) &&
      !this._frameIsInPipeline(actualVideoFrameDiscrete) &&
      0.1 < (actualVideoFrame % 1.0) &&
      (actualVideoFrame % 1.0) < 0.9) {
    
    for (var i = 1; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
      if (this._pipeline[i].frameno == null) {
        this._captureFrame(actualVideoFrameDiscrete, i);
        break;
      }
    }
  }
}

WebglVideoTile.prototype.
_checkForMissedFrame = function(displayFrameDiscrete) {
  if (this._ready && 
      displayFrameDiscrete != this._lastDisplayFrame &&
      displayFrameDiscrete != this._pipeline[0].frameno) {
    console.log(this._id + ': missed frame');
    WebglTimemachinePerf.instance.recordMissedFrames(1);
    this._missedFrameCount++;
  }
  this._lastDisplayFrame = displayFrameDiscrete;
}

WebglVideoTile.prototype.
_computeNextNeededFrame = function(displayFrameDiscrete) {
  var lastFrame = null;
  for (var i = 0; i < WebglVideoTile.PIPELINE_SIZE - 1; i++) {
    if (this._pipeline[i].frameno != null) {
      lastFrame = this._pipeline[i].frameno;
    }
  }
  if (lastFrame != null) {
    return (lastFrame + 1) % this._nframes;
  } else {
    return (displayFrameDiscrete + 2) % this._nframes;
  }
}

WebglVideoTile.prototype.
update = function() {
  var r2 = WebglVideoTile.r2;
  // Output stats every 5 seconds
  if (!WebglVideoTile.lastStatsTime) {
    WebglVideoTile.lastStatsTime = performance.now();
  } else if (performance.now() - WebglVideoTile.lastStatsTime > 5000) {
    console.log(WebglVideoTile.stats());
    WebglVideoTile.lastStatsTime = performance.now();
  }

  // Synchronize video playback

  var webglFps = 60;
  // TODO(rsargent): don't hardcode access to global timelapse object

  var readyState = this._video.readyState;

  if (readyState == 0) {
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': loading');
    }
    return false;
  }

  // Frame being displayed on screen
  var displayFrame = timelapse.getVideoset().getCurrentTime() * this._fps;
  var displayFrameDiscrete = Math.min(Math.floor(displayFrame), this._nframes - 1);

  var displayFps = timelapse.getPlaybackRate() * this._fps;
  
  // Desired video tile time leads display by frameOffset+1
  var targetVideoFrame = (displayFrame + this._frameOffset + 1.3) % this._nframes;
  
  var actualVideoFrame = this._video.currentTime * this._fps;
  var actualVideoFrameDicrete = Math.min(Math.floor(actualVideoFrame), this._nframes - 1);

  this._flushUnneededFrames(displayFrameDiscrete);
  this._tryAdvancePipeline(displayFrameDiscrete);
  if (readyState > 1) {
    this._tryCaptureFrame(displayFrameDiscrete, actualVideoFrame, actualVideoFrameDicrete);
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

  var nextNeededFrame = this._computeNextNeededFrame(displayFrameDiscrete);

  // Imagine we're going to drop a frame.  Aim to be at the right place in 3 frames
  var future = (displayFps / webglFps) * 3;
  
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
  
  if (futureFrameError < -5 || futureFrameError > 5) {
    // If we need to go back any or forward a lot, seek instead of changing speed
    var seekTime = nextNeededFrame + 0.5;
    this._video.currentTime = (nextNeededFrame + 0.5) / this._fps;
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': display=' + r2(displayFrame) + ', desired=' + r2(targetVideoFrame) + 
                  ', offset=' + r2(this._frameOffset) +
                  ', actual=' + r2(actualVideoFrame) + ', seeking to=' + r2(seekTime));
    }
  } else {
    this._video.playbackRate = speed;
    if (WebglVideoTile.verbose) {
      console.log(this._id + ': display=' + r2(displayFrame) + ', desired=' + r2(targetVideoFrame) + 
                  ', offset=' + r2(this._frameOffset) +
                  ', actual=' + r2(actualVideoFrame) + ', setting speed=' + r2(speed) +
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
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this._video);
  gl.bindTexture(gl.TEXTURE_2D, null);
  var elapsed = performance.now() - before;
  WebglTimemachinePerf.instance.recordVideoFrameCapture(elapsed);
  if (WebglVideoTile.verbose) {
    console.log(this._id + ': captured frame ' + captureFrameno + 
                ' to pipeline[' + destIndex + '] in ' 
                + Math.round(elapsed) + ' ms ' +
                this._pipelineToString());
  }
  if (elapsed > 10) {
    console.log(this._id + ': long capture time ' + Math.round(elapsed) + ' ms.  readyState was ' + readyState +
	       ', time was ' + currentTime);
  }

  //if (this._ready) {
  //  var advance = (this._pipeline[destIndex].frameno - this._pipeline[destIndex - 1].frameno + this._nframes) % this._nframes;
  //  WebglVideoTile.frameCount += advance;
  //  if (advance != 1) {
  //    console.log(this._id + ': skipped ' + (advance - 1) + ' frames');
  //    WebglVideoTile.missedFrameCount += (advance - 1);
  //    WebglTimemachinePerf.instance.recordMissedFrames(advance - 1);
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
              
  // Draw rectangle
  gl.useProgram(this._lineProgram);
  gl.uniformMatrix4fv(this._lineProgram.uTransform, false, tileTransform);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._insetRectangle);
  gl.vertexAttribPointer(this._lineProgram.aWorldCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(this._lineProgram.aWorldCoord);
  gl.drawArrays(gl.LINE_LOOP, 0, 4);

  // Draw video
  if (this._ready) {
    gl.useProgram(this._textureProgram);
    gl.uniformMatrix4fv(this._textureProgram.uTransform, false, tileTransform);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
    gl.vertexAttribPointer(this._textureProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this._lineProgram.aTextureCoord);

    gl.bindTexture(gl.TEXTURE_2D, this._pipeline[0].texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
};

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

WebglVideoTile.computeFrameOffsets(3, 4);

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

