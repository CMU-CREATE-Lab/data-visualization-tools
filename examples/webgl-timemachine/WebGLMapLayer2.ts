// WebGLMapLayer2 is a modification of WebGLMapLayer which can load multiple data from multiple URLs per tile

import { WebGLMapTile2 } from './WebGLMapTile2'
import { Layer, LayerOptions } from './Layer'
import { LayerProxy } from './LayerProxy';

export class WebGLMapLayer2 extends Layer {
  fileExtension: any;
  _tileUrls: any[];
  constructor(layerProxy: LayerProxy, glb: any, canvasLayer: any, tileUrls: string | any[], layerOptions: LayerOptions) {
    super(layerProxy, layerOptions, WebGLMapTile2);
    this._tileUrls = [];
    for (var i = 0; i < tileUrls.length; i++) {
      this._tileUrls[i] = tileUrls[i].replace("{default}/", "");
    }
    var splitToken = tileUrls[0].indexOf("{default}") > 0 ? "{default}" : "{z}";
    this.defaultUrl = this.defaultUrl || tileUrls[0].split(splitToken)[0] + "default." + this.fileExtension;

    this.fileExtension = this.fileExtension || "png";
  }

  draw(view, opt_options) {
    var options = opt_options ?? {};
    if (view.alpha !== undefined) {
      options.alpha = view.alpha;
    }
    this._drawHelper(view, options);
  }
}
