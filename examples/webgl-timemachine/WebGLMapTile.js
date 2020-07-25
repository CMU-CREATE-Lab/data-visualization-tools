"use strict";

export class WebGLMapTile {
  constructor(glb, tileidx, bounds, url, defaultUrl, opt_options) {
    if (!WebGLMapTile._initted) {
      WebGLMapTile._init();
    }
    this._tileidx = tileidx;
    this.glb = glb;
    this.gl = glb.gl;

    var opt_options = opt_options || {};
    this.fragmentShader = opt_options.fragmentShader || WebGLMapTile.textureFragmentShader;
    this.vertexShader = opt_options.vertexShader || WebGLMapTile.textureVertexShader;
    this.draw = opt_options.drawFunction || this._draw;
    this._layerDomId = opt_options.layerDomId;
    this.colormap = opt_options.colormap || null;

    this._loadingSpinnerTimer = null;

    this._textureProgram = glb.programFromSources(this.vertexShader,
      this.fragmentShader);
    this._texture = this._createTexture();

    this._triangles = glb.createBuffer(new Float32Array([0, 0,
      1, 0,
      0, 1,
      1, 1]));

    this._setupLoadingSpinner();

    this._image = new Image();
    this._image.crossOrigin = "anonymous";
    var that = this;

    this._image.onload = function () {
      that._removeLoadingSpinner();
      that._handleLoadedTexture();
    };

    // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
    // sea tiles and replace with a single default tile.
    this._image.addEventListener('error', function (event) {
      that._removeLoadingSpinner();
      if (that._image) {
        if (that._image.src != defaultUrl) {
          that._image.src = defaultUrl;
        }
      }
    });

    this._image.onabort = function () {
      that._removeLoadingSpinner();
    };

    this._image.src = url;
    this._ready = false;
    this._width = 256;
    this._height = 256;
    this._bounds = bounds;
    WebGLMapTile.activeTileCount++;
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
  _handleLoadedTexture() {
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
  delete() {
    // TODO: recycle texture
    this._image.src = '';
    this._image = null;
    WebGLMapTile.activeTileCount--;
  }
  toString() {
    return 'Tile ' + this._tileidx.toString() +
      ', ready: ' + this.isReady();
  }
  isReady() {
    return this._ready;
  }
  _draw(transform, opts) {
    var opts = opts || {};
    var showTile = true;
    if (opts.showTile === false) {
      showTile = false;
    }
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
      gl.uniform1f(this._textureProgram.uShowTile, showTile);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
      gl.vertexAttribPointer(this._textureProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this._textureProgram.aTextureCoord);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      if (this.colormap) {
        gl.uniform1i(gl.getUniformLocation(this._textureProgram, "uColormap"), 2); // texture unit 2
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.colormap);
      }


      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);
    }
  }
  _drawSeaLevelRise(transform, options) {
    var gl = this.gl;
    var tileTransform = new Float32Array(transform);
    translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
    scaleMatrix(tileTransform,
      this._bounds.max.x - this._bounds.min.x,
      this._bounds.max.y - this._bounds.min.y);

    if (this._ready /*&& this._tileidx.l > 3*/) { // TODO: Get tiles w level > 3 that arent empty
      var color = options.color || [0., 0., 0., 1.0];

      gl.useProgram(this._textureProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      var cLoc = gl.getUniformLocation(this._textureProgram, 'u_C');
      gl.uniform1f(cLoc, options.currentC);
      var uColor = color;
      var colorLoc = gl.getUniformLocation(this._textureProgram, 'u_Color');
      gl.uniform4fv(colorLoc, uColor);

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
  }
  _drawSeaLevelRiseV2(transform, options) {
    var gl = this.gl;
    var tileTransform = new Float32Array(transform);
    translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
    scaleMatrix(tileTransform,
      this._bounds.max.x - this._bounds.min.x,
      this._bounds.max.y - this._bounds.min.y);

    if (this._ready /*&& this._tileidx.l > 3*/) { // TODO: Get tiles w level > 3 that arent empty
      var color = options.color || [0., 0., 0., 1.0];

      gl.useProgram(this._textureProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      var cLoc = gl.getUniformLocation(this._textureProgram, 'u_C');
      var seaLevelMeters = getCustomSliderCurrentTickValue() + 0.01;
      gl.uniform1f(cLoc, seaLevelMeters / 256.0);
      var uColor = color;
      var colorLoc = gl.getUniformLocation(this._textureProgram, 'u_Color');
      gl.uniform4fv(colorLoc, uColor);

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
  }
  _drawAnimatedTexture(transform, options) {
    var gl = this.gl;
    var tileTransform = new Float32Array(transform);
    translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
    scaleMatrix(tileTransform,
      this._bounds.max.x - this._bounds.min.x,
      this._bounds.max.y - this._bounds.min.y);

    if (this._ready /*&& this._tileidx.l > 3*/) { // TODO: Get tiles w level > 3 that arent empty
      var color = options.color || [0., 0., 0., 1.0];

      var currentAlpha = options.currentAlpha || 0.95;
      var currentBValue = options.currentBValue;
      gl.useProgram(this._textureProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      //console.log(currentBValue);
      var cLoc = gl.getUniformLocation(this._textureProgram, 'u_b');
      gl.uniform1f(cLoc, currentBValue);

      var cLoc = gl.getUniformLocation(this._textureProgram, 'u_alpha');
      gl.uniform1f(cLoc, currentAlpha);

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
  }
  _setupLoadingSpinner() {
    var that = this;
    clearTimeout(this._loadingSpinnerTimer);
    this._spinnerNeeded = true;
    // Wait 300ms to prevent small datasets from flashing up a spinner.
    this._loadingSpinnerTimer = setTimeout(function () {
      if (!that._spinnerNeeded) {
        return;
      }
      that._removeLoadingSpinner();
      var $loadingSpinner = $("<td class='loading-layer-spinner-small' data-loading-layer='" + that._layerDomId + "'></td>");
      $(".map-layer-div input#" + that._layerDomId).closest("td").after($loadingSpinner);
    }, 300);
  }
  _removeLoadingSpinner() {
    this._spinnerNeeded = false;
    clearTimeout(this._loadingSpinnerTimer);
    var $loadingSpinner = $('.loading-layer-spinner-small[data-loading-layer="' + this._layerDomId + '"]');
    $loadingSpinner.remove();
  }
  static _init() {
    WebGLMapTile._initted = true;

    $(document).keypress(function (e) {
      // ctrl-b toggles verbosity
      if (e.keyCode == 2) {
        WebGLMapTile.verbose = !WebGLMapTile.verbose;
        //console.log('WebGLMapTile verbose: ' + WebGLMapTile.verbose);
      }
    });
  }
  static stats() {
    return ('WebGLMapTile stats. Active tiles: ' + WebGLMapTile.activeTileCount);
  }
  static getUnusedFrameOffsetIndex() {
    for (var i = 0; i < WebGLMapTile._frameOffsets.length; i++) {
      if (!WebGLMapTile._frameOffsetUsed[i]) {
        WebGLMapTile._frameOffsetUsed[i] = true;
        return i;
      }
    }
    throw new Error('Out of offsets because we have ' + WebGLMapTile._frameOffsets.length + ' videos');
  }
  static r2(x) {
    return Math.round(x * 100) / 100;
  }
  // Update and draw tiles
  // Assumes tiles is sorted low res to high res (by TileView)
  static update(tiles, transform, options) {
    if (si)
      return;
    //WebGLTimeMachinePerf.instance.startFrame();
    var canvas = document.getElementById('webgl');

    for (var i = 0; i < tiles.length; i++) {
      tiles[i].draw(transform, options);
    }

    //WebGLTimeMachinePerf.instance.endFrame();
  }
}




WebGLMapTile.videoId = 0;
WebGLMapTile.verbose = false;
WebGLMapTile.activeTileCount = 0;
WebGLMapTile._initted = false;
















WebGLMapTile.textureVertexShader =
  'attribute vec2 aTextureCoord;\n' +
  'uniform mat4 uTransform;\n' +
  'varying vec2 vTextureCoord;\n' +

  'void main(void) {\n' +
  '  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);\n' +
  '  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);\n' +
  '}\n';


WebGLMapTile.textureFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform bool uShowTile;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  if (uShowTile) {\n' +
  '    gl_FragColor = vec4(textureColor.rgb, textureColor.a);\n' +
  '  } else {\n' +
  '    gl_FragColor = vec4(textureColor.rgb, 0.);\n' +
  '  }\n' +
  '}\n';


WebGLMapTile.textureColormapFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform sampler2D uColormap;\n' +
  'uniform bool uShowTile;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  vec4 colormap = texture2D(uColormap, vec2(textureColor.r,textureColor.r));\n' + 
  '  //if (uShowTile) {\n' +
  '    //gl_FragColor = vec4(textureColor.rgb, textureColor.a);\n' +
  '  //} else {\n' +
  '    gl_FragColor = vec4(colormap.rgb, textureColor.a);\n' +
  '  //}\n' +
  '}\n';

WebGLMapTile.seaLevelRiseTextureFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform float u_C;\n' +
  'uniform vec4 u_Color;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  if (textureColor.r == 0. && textureColor.g == 0. && textureColor.b == 0.) {\n' +
  '    gl_FragColor = vec4(u_Color.rgb, 1.);\n' +
  '  } else if (textureColor.r == textureColor.g && textureColor.b == textureColor.r) {\n' +
  '    gl_FragColor = vec4(textureColor.rgb, 0.);\n' +
  '  } else {\n' +
  '   float currentC = u_C*2.0 / 255.0;\n' +
  '   if (textureColor.b <= currentC) {\n' +
  '      gl_FragColor = vec4(u_Color.rgb, textureColor.a);\n'+
  '   }\n'+
  '   else {\n' +
  '      gl_FragColor = vec4(1.0,0.0,0.0, 0.0);\n'+
  '   }\n'+

  '  }\n' +
  '}\n';

WebGLMapTile.seaLevelRiseV2TextureFragmentShader = [
  'precision mediump float;',
  'varying vec2 vTextureCoord;',
  'uniform sampler2D uSampler;',
  'uniform float u_C;',
  'uniform vec4 u_Color;',
  'void main(void) {',
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));',
  '  if (textureColor.r <= u_C) {',
  '    gl_FragColor = vec4(u_Color.rgb, 1.);',
  '  } else {',
  '    gl_FragColor = vec4(0., 0., 0., 0.);',
  '  }',
  '}'
].join("\n");

// Temporary, for book
WebGLMapTile.seaLevelRiseTintedTextureFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'uniform float u_C;\n' +
  'uniform vec4 u_Color;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  if (textureColor.r == 0. && textureColor.g == 0. && textureColor.b == 0.) {\n' +
  '    gl_FragColor = vec4(u_Color.rgb, 0.);\n' +
  '  } else if (textureColor.r == textureColor.g && textureColor.b == textureColor.r) {\n' +
  '    gl_FragColor = vec4(textureColor.rgb, 0.);\n' +
  '  } else {\n' +
  '   float currentC = u_C*2.0 / 255.0;\n' +
  '   if (textureColor.b <= currentC) {\n' +
  '     //vec3 colorA = vec3(240.,248.,255.)/255.;\n' +
  '     //vec3 colorB = vec3(100.,149.,237.)/255.;\n' +
  '     vec3 colorA = vec3(65.,105.,225.)/255.;\n' +
  '     vec3 colorB = vec3(100.,149.,237.)/255.;\n' +
  '     float pct = textureColor.b / (8.0 / 255.0);\n' +
  '     gl_FragColor = vec4(mix(colorA, colorB, pct), 1.0);\n'+
  '   }\n'+
  '   else {\n' +
  '      gl_FragColor = vec4(textureColor.rgb, 0.0);\n'+
  '   }\n'+

  '  }\n' +
  '}\n';

WebGLMapTile.animatedTextureFragmentShader =
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D u_sampler;\n' +
  'uniform float u_b;\n' +
  'uniform float u_alpha;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(u_sampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  if (textureColor.r == 0. && textureColor.g == 0. && textureColor.b == 0.) {\n' +
  '    gl_FragColor = vec4(1.0, 0., 0.,.0);\n' +
  '  }\n' +
  '  else if (textureColor.b >= u_b) { \n' +
  '    gl_FragColor = vec4(textureColor.rgb, 1.);\n' +
  '  } else {\n' +
  '    gl_FragColor = vec4(1.,0.,0.,0.);\n' +
  '  }\n' +
  '}\n';

// stopit:  set to true to disable update()
var si = false;
