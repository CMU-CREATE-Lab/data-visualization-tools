// WebGLMapLayer2 is a modification of WebGLMapLayer which can load multiple data from multiple URLs per tile

import { WebGLMapTile2, WebGLMapTile2Shaders } from './WebGLMapTile2'
import { Layer, LayerOptions } from './Layer'
import { LayerProxy } from './LayerProxy';
import { gEarthTime } from './EarthTime';

export class WebGLMapLayer2 extends Layer {
  _tileUrls: any[];
  fileExtension: any;
  defaultUrl: any;
  constructor(layerProxy: LayerProxy, glb: any, canvasLayer: any, tileUrls: string | any[], layerOptions: LayerOptions) {
    super(layerProxy, layerOptions, WebGLMapTile2);
    // Set default draw/shader/vertex function for animated raster map layers
    this.drawFunction ||= WebGLMapTile2.prototype._draw;
    this.fragmentShader ||= WebGLMapTile2Shaders.textureFragmentShader;
    this.vertexShader ||= WebGLMapTile2Shaders.textureVertexShader;

    this._tileUrls = [];
    for (var i = 0; i < tileUrls.length; i++) {
      this._tileUrls[i] = tileUrls[i].replace("{default}/", "");
    }
    var splitToken = tileUrls[0].indexOf("{default}") > 0 ? "{default}" : "{z}";
    this.fileExtension = this.fileExtension || "png";
    this.defaultUrl = relUrlToAbsUrl(this.defaultUrl || `${tileUrls[0].split(splitToken)[0]}default.${this.fileExtension}`);
  }

  draw(view, opt_options) {
    var options = opt_options ?? {};

    // Assumes all of these layer types have an alpha fade over time. Currently only Forest/Loss animated is used by this class.
    if (typeof(view.alpha) === "undefined") {
      var beginDate = Number(gEarthTime.timelapse.getCaptureTimes()[0]);
      var endDate = Number(gEarthTime.timelapse.getCaptureTimes()[gEarthTime.timelapse.getCaptureTimes().length - 1]);
      var currentDate = Number(gEarthTime.timelapse.getCaptureTimeByTime(gEarthTime.timelapse.getCurrentTime()));
      var ratio = (currentDate - beginDate) / (endDate - beginDate);
      view.alpha = ratio;
    }
    options.alpha = view.alpha;
    this._drawHelper(view, options);
  }

  maxGmapsZoomLevel() {
    // nLevels is really the maximum tile level
    return this.nLevels;
  }
}
