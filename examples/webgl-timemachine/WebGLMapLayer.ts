/// <reference path="../../js/utils.js"/>

import { WebGLMapTile, WebGLMapTileShaders } from './WebGLMapTile'
import { Layer, LayerOptions } from './Layer';
import { LayerProxy } from './LayerProxy';
import { SeaLevelRise } from './SeaLevelRise';
import { gEarthTime } from './EarthTime';

export class WebGLMapLayer extends Layer {
  _tileUrl: string;
  fileExtension: any;
  defaultUrl: any;
  seaLevelRise: any;
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
  maxGmapsZoomLevel() {
    // nLevels is really the maximum tile level
    return this.nLevels;
  }

  _drawLayerSlr(opt_options) {
    if (!this.seaLevelRise) {
      let idx = `${this.layerId}-legend`;
      this.seaLevelRise = new SeaLevelRise(idx);      
    }  else {
      let currentKey = gEarthTime.timelapse.getCurrentCaptureTime();
      this.seaLevelRise.setTemperatureAndHeight(currentKey);
    }


    return opt_options;
  }

}
