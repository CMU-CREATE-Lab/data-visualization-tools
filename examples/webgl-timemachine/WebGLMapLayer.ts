/// <reference path="../../js/utils.js"/>

import { WebGLMapTile, WebGLMapTileShaders } from './WebGLMapTile'
import { Layer, LayerOptions } from './Layer';
import { LayerProxy } from './LayerProxy';

export class WebGLMapLayer extends Layer {
  _tileUrl: string;
  fileExtension: any;
  defaultUrl: any;
  constructor(layerProxy: LayerProxy, glb: any, canvasLayer: any, tileUrl: string, layerOptions: LayerOptions) {
    super(layerProxy, layerOptions, WebGLMapTile);
    // Set default draw/shader/vertex function for raster map layers
    this.drawFunction ||= WebGLMapTile.prototype._draw;
    this.fragmentShader ||= WebGLMapTileShaders.textureFragmentShader;
    this.vertexShader ||= WebGLMapTileShaders.textureVertexShader;

    this._tileUrl = tileUrl.replace("{default}/", "");
    var splitToken = tileUrl.indexOf("{default}") > 0 ? "{default}" : "{z}";
    this.fileExtension = this.fileExtension || "png";
    this.defaultUrl = relUrlToAbsUrl(this.defaultUrl || `${tileUrl.split(splitToken)[0]}default.${this.fileExtension}`);
  }
  draw(view, opt_options) {
    this._drawHelper(view, opt_options);
  }
}
