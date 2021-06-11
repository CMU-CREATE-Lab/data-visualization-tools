/// <reference path="matrix.js"/>

import { Tile } from "./Tile";
import { WebGLMapLayer } from "./WebGLMapLayer";
import { TileIdx } from "./TileIdx";

export class WebGLMapTile extends Tile {
  _layer: WebGLMapLayer;
  _layerDomId: any;
  _loadingSpinnerTimer: any;
  _texture: any;
  _triangles: any;
  _image: HTMLImageElement;
  _ready: boolean;
  _width: number;
  _height: number;
  static activeTileCount: any;
  _spinnerNeeded: boolean;
  static verbose: boolean;
  static _frameOffsets: any;
  static _frameOffsetUsed: any;
  static videoId: number;
  private _imageUrl: any;
  constructor(layer: WebGLMapLayer, tileidx: TileIdx, bounds, opt_options) {
    super(layer, tileidx, bounds, opt_options);
    this._layer = layer;
    this._layerDomId = opt_options.layerDomId;

    this._loadingSpinnerTimer = null;

    this._texture = this._createTexture();

    this._triangles = this.glb.createBuffer(new Float32Array([0, 0,
      1, 0,
      0, 1,
      1, 1]));

    this._image = new Image();
    this._image.crossOrigin = "anonymous";
    var that = this;

    that._layer.nextFrameNeedsRedraw = true;

    this._image.onload = function () {
      that._handleLoadedTexture();
      that._layer.nextFrameNeedsRedraw = true;
    };

    // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
    // sea tiles and replace with a single default tile.
    this._image.addEventListener('error', function (event) {
      if (that._image) {
        if (that._image.src != that._layer.defaultUrl) {
          that._image.src = that._layer.defaultUrl;
        }
      }
    });

    this._image.onabort = function () {
      // Abort logic
    };

    this._imageUrl = tileidx.expandUrl(this._layer._tileUrl, this._layer)
    this._image.src = this._imageUrl;
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
    if (!this._image) {
      return;
    }
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._ready = true;
  }
  delete() {
    this.unloadResources();
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
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(this.program.uTransform, false, tileTransform);
      gl.uniform1f(this.program.uShowTile, showTile);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
      gl.vertexAttribPointer(this.program.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.program.aTextureCoord);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      if (this._layer.colormapTexture) {
        gl.uniform1i(this.program.uColormap, 2); // texture unit 2
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this._layer.colormapTexture);
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

      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      var cLoc = this.program.u_C;
      var seaLevelDegrees = this._layer.getCustomSliderCurrentTickValue() + 0.01;

      gl.uniform1f(cLoc, seaLevelDegrees);
      var uColor = color;
      gl.uniform4fv(this.program.u_Color, uColor);

      gl.uniformMatrix4fv(this.program.uTransform, false, tileTransform);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
      gl.vertexAttribPointer(this.program.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.enableVertexAttribArray(this.program.aTextureCoord);
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

      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      var cLoc = this.program.u_C;
      var seaLevelMeters = this._layer.getCustomSliderCurrentTickValue() + 0.01;

      gl.uniform1f(cLoc, seaLevelMeters / 256.0);
      var uColor = color;
      gl.uniform4fv(this.program.u_Color, uColor);

      gl.uniformMatrix4fv(this.program.uTransform, false, tileTransform);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
      gl.vertexAttribPointer(this.program.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.enableVertexAttribArray(this.program.aTextureCoord);
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
      var currentAlpha = options.currentAlpha || 0.95;
      var currentBValue = options.currentBValue;
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      //console.log(currentBValue);
      gl.uniform1f(this.program.u_b, currentBValue);

      gl.uniform1f(this.program.u_alpha, currentAlpha);

      gl.uniformMatrix4fv(this.program.uTransform, false, tileTransform);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
      gl.vertexAttribPointer(this.program.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.enableVertexAttribArray(this.program.aTextureCoord);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);
    }
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
  static updateTiles(tiles: WebGLMapTile[], transform: Float32Array, options: {}) {
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].draw(transform, options);
    }
  }
}

WebGLMapTile.videoId = 0;
WebGLMapTile.verbose = false;
WebGLMapTile.activeTileCount = 0;

export var WebGLMapTileShaders: {[name: string]: string} = {};

WebGLMapTileShaders.textureVertexShader = `
attribute vec2 aTextureCoord;
uniform mat4 uTransform;
varying vec2 vTextureCoord;
void main(void) {
  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);
  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);
}`;

WebGLMapTileShaders.textureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform bool uShowTile;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  if (uShowTile) {
    gl_FragColor = vec4(textureColor.rgb, textureColor.a);
  } else {
    gl_FragColor = vec4(textureColor.rgb, 0.);
  }
}`;

WebGLMapTileShaders.textureColormapFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uColormap;
uniform bool uShowTile;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 colormap = texture2D(uColormap, vec2(textureColor.r,textureColor.r));
  //if (uShowTile) {
    //gl_FragColor = vec4(textureColor.rgb, textureColor.a);
  //} else {
    gl_FragColor = vec4(colormap.rgb, textureColor.a);
  //}
}`;

WebGLMapTileShaders.seaLevelRiseTextureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float u_C;
uniform vec4 u_Color;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  if (textureColor.r == 0. && textureColor.g == 0. && textureColor.b == 0.) {
    gl_FragColor = vec4(u_Color.rgb, 1.);
  } else if (textureColor.r == textureColor.g && textureColor.b == textureColor.r) {
    gl_FragColor = vec4(textureColor.rgb, 0.);
  } else {
   float currentC = u_C*2.0 / 255.0;
   if (textureColor.b <= currentC) {
      gl_FragColor = vec4(u_Color.rgb, textureColor.a);
   }
   else {
      gl_FragColor = vec4(1.0,0.0,0.0, 0.0);
   }
  }
}`;

WebGLMapTileShaders.seaLevelRiseV2TextureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float u_C;
uniform vec4 u_Color;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  if (textureColor.r <= u_C) {
    gl_FragColor = vec4(u_Color.rgb, 1.);
  } else {
    gl_FragColor = vec4(0., 0., 0., 0.);
  }
}`;


// Temporary, for book
WebGLMapTileShaders.seaLevelRiseTintedTextureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float u_C;
uniform vec4 u_Color;
void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  if (textureColor.r == 0. && textureColor.g == 0. && textureColor.b == 0.) {
    gl_FragColor = vec4(u_Color.rgb, 0.);
  } else if (textureColor.r == textureColor.g && textureColor.b == textureColor.r) {
    gl_FragColor = vec4(textureColor.rgb, 0.);
  } else {
   float currentC = u_C*2.0 / 255.0;
   if (textureColor.b <= currentC) {
     //vec3 colorA = vec3(240.,248.,255.)/255.;
     //vec3 colorB = vec3(100.,149.,237.)/255.;
     vec3 colorA = vec3(65.,105.,225.)/255.;
     vec3 colorB = vec3(100.,149.,237.)/255.;
     float pct = textureColor.b / (8.0 / 255.0);
     gl_FragColor = vec4(mix(colorA, colorB, pct), 1.0);
   }
   else {
      gl_FragColor = vec4(textureColor.rgb, 0.0);
   }
  }
}`;

WebGLMapTileShaders.animatedTextureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D u_sampler;
uniform float u_b;
uniform float u_alpha;
void main(void) {
  vec4 textureColor = texture2D(u_sampler, vec2(vTextureCoord.s, vTextureCoord.t));
  if (textureColor.r == 0. && textureColor.g == 0. && textureColor.b == 0.) {
    gl_FragColor = vec4(1.0, 0., 0.,.0);
  }
  else if (textureColor.b >= u_b) {
    gl_FragColor = vec4(textureColor.rgb, 1.);
  } else {
    gl_FragColor = vec4(1.,0.,0.,0.);
  }
}`;
