"use strict";

function WebglMapTile(glb, tileidx, bounds, url, defaultUrl) {
  if (!WebglMapTile._initted) {
    WebglMapTile._init();
  }
  this._tileidx = tileidx;
  this.glb = glb;
  this.gl = glb.gl;
  this._textureProgram = glb.programFromSources(WebglMapTile.textureVertexShader,
                                                WebglMapTile.textureFragmentShader);
  this._texture = this._createTexture();

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

WebglMapTile.prototype.delete = function() {
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

WebglMapTile.prototype.toString = function() {
  return 'Tile ' + this._tileidx.toString() +
         ', ready: ' + this.isReady();
};

WebglMapTile.prototype.isReady = function() {
  return this._ready;
};

WebglMapTile.r2 = function(x) {
  return Math.round(x * 100) / 100;
};


WebglMapTile.prototype.draw = function(transform) {
  var gl = this.gl;
  var tileTransform = new Float32Array(transform);
  translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
  scaleMatrix(tileTransform,
              this._bounds.max.x - this._bounds.min.x,
              this._bounds.max.y - this._bounds.min.y);

  if (this._ready) {
    gl.useProgram(this._textureProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix4fv(this._textureProgram.uTransform, false, tileTransform);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
    gl.vertexAttribPointer(this._textureProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.enableVertexAttribArray(this._textureProgram.aTextureCoord);
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
