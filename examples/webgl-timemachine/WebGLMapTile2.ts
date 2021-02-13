/// <reference path="matrix.js"/>

import { Tile } from "./Tile";
import { WebGLMapLayer2 } from './WebGLMapLayer2';
import { TileIdx } from './TileIdx';

export class WebGLMapTile2 extends Tile {
  static activeTileCount: number = 0;
  static verbose: boolean = false;
  static videoId: number = 0;

  _layer: WebGLMapLayer2;
  _texture0: any;
  _texture1: any;
  _triangles: any;
  _image0: HTMLImageElement;
  _image1: HTMLImageElement;
  _ready: boolean[];
  _width: number;
  _height: number;

  constructor(layer: WebGLMapLayer2, tileidx: TileIdx, bounds, opt_options) {
    super(layer, tileidx, bounds, opt_options);
    this._layer = layer;

    this._texture0 = this._createTexture();
    this._texture1 = this._createTexture();

    this._triangles = this.glb.createBuffer(new Float32Array([0, 0,
      1, 0,
      0, 1,
      1, 1]));

    this._image0 = new Image();
    this._image0.crossOrigin = "anonymous";

    this._image1 = new Image();
    this._image1.crossOrigin = "anonymous";

    var that = this;
    this._image0.onload = function () {
      that._handleLoadedTexture(that._image0, that._texture0, 0);
    };

    this._image1.onload = function () {
      that._handleLoadedTexture(that._image1, that._texture1, 1);
    };

    // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
    // sea tiles and replace with a single default tile.
    this._image0.addEventListener('error', function (event) {
      if (that._image0) {
        if (that._image0.src != that._layer.defaultUrl) {
          that._image0.src = that._layer.defaultUrl;
        }
      }
    });

    this._image1.addEventListener('error', function (event) {
      if (that._image1) {
        if (that._image1.src != that._layer.defaultUrl) {
          that._image1.src = that._layer.defaultUrl;
        }
      }
    });

    var urls = [];
    for (var i = 0; i < layer._tileUrls.length; i++) {
      urls[i] = tileidx.expandUrl(layer._tileUrls[i], layer);
    }

    this._image0.src = urls[0];
    this._image1.src = urls[1];
    this._ready = [false, false];
    this._width = 256;
    this._height = 256;
    this._bounds = bounds;
    WebGLMapTile2.activeTileCount++;
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
  _handleLoadedTexture(image, texture, index) {
    var gl = this.gl;

    if (!image) {
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this._ready[index] = true;
  }
  delete() {
    this.unloadResources();
    // TODO: recycle texture
    this._image0.src = '';
    this._image0 = null;
    this._image1.src = '';
    this._image1 = null;

    WebGLMapTile2.activeTileCount--;
  }
  toString() {
    return 'Tile ' + this._tileidx.toString() +
      ', ready: ' + this.isReady();
  }
  isReady() {
    return this._ready[0] && this._ready[1];
  }
  _draw(transform, options) {
    //console.log(options);
    var gl = this.gl;
    var tileTransform = new Float32Array(transform);
    translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
    scaleMatrix(tileTransform,
      this._bounds.max.x - this._bounds.min.x,
      this._bounds.max.y - this._bounds.min.y);

    if (this._ready[0] && this._ready[1]) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var uAlpha = options.alpha || 0.;

      if (options.alphaFnc) {
        var alphaFnc = new Function('return ' + options.alphaFnc)();
        uAlpha = alphaFnc(options.currentTime);
      }


      gl.uniform1f(this.program.uAlpha, uAlpha);


      gl.uniformMatrix4fv(this.program.uTransform, false, tileTransform);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
      gl.vertexAttribPointer(this.program.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

      /*    gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this._texture);
      */
      var imageLocation0 = this.program.uSampler0;
      var imageLocation1 = this.program.uSampler1;

      gl.uniform1i(imageLocation0, 0); // texture unit 0
      gl.uniform1i(imageLocation1, 1); // texture unit 0

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._texture1);

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
  static stats() {
    return ('WebGLMapTile2 stats. Active tiles: ' + WebGLMapTile2.activeTileCount);
  }
  // Update and draw tiles
  // Assumes tiles is sorted low res to high res (by TileView)
  static updateTiles(tiles: WebGLMapTile2[], transform: Float32Array, options: {}) {
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].draw(transform, options);
    }
  }
}

export var WebGLMapTile2Shaders: {[name: string]: string} = {};

WebGLMapTile2Shaders.textureVertexShader = `
attribute vec2 aTextureCoord;
uniform mat4 uTransform;
varying vec2 vTextureCoord;
void main(void) {
  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);
  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);
}`;


WebGLMapTile2Shaders.textureFragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler0;
uniform sampler2D uSampler1;
uniform float uAlpha;
void main(void) {
  vec4 textureColor0 = texture2D(uSampler0, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor1 = texture2D(uSampler1, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 color0 = vec4(0.,0.,0.,0);
  vec4 color1 = vec4(0.,0.,0.,0);
  if (textureColor0.g > 1. - uAlpha) {
    color0 = vec4(textureColor0.a, 0., 0., textureColor0.a);
  }
  if (textureColor1.b > 0.40) {
    color1 = vec4(0., 0., textureColor1.b * uAlpha, uAlpha);
  }
  gl_FragColor = color0 + color1;
}`;


// TODO: Does not seem to work correctly.
WebGLMapTile2Shaders.textureFragmentFaderShader = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler0;
uniform sampler2D uSampler1;
uniform sampler2D uColormap;
uniform float uAlpha;
void main(void) {
  vec4 textureColor1 = texture2D(uSampler0, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor2 = texture2D(uSampler1, vec2(vTextureCoord.s, vTextureCoord.t));
  vec4 textureColor = textureColor1 * (1.0 - uAlpha) + textureColor2 * uAlpha;
  vec4 colormap = texture2D(uColormap, vec2(textureColor.r,textureColor.r));
   gl_FragColor = vec4(colormap.rgb, textureColor.a);
}`;
