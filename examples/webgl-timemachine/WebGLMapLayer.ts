/// <reference path="../../js/utils.js"/>

import { WebGLMapTile } from './WebGLMapTile'
import { Layer, LayerOptions } from './Layer';

export class WebGLMapLayer extends Layer {
  _tileUrl: string;
  fileExtension: any;
  constructor(glb: any, canvasLayer: any, tileUrl: string, layerOptions: LayerOptions) {
    super(layerOptions, WebGLMapTile);
    this._tileUrl = tileUrl.replace("{default}/", "");
    var splitToken = tileUrl.indexOf("{default}") > 0 ? "{default}" : "{z}";
    this.fileExtension = this.fileExtension || "png";
    this.defaultUrl = relUrlToAbsUrl(this.defaultUrl || `${tileUrl.split(splitToken)[0]}default.${this.fileExtension}`);
  }
  draw(view, opt_options) {
    this._drawHelper(view, opt_options);
  }
}
