"use strict";

// confusingly, nLevels is really max level #.  the actual number of levels is nLevels+1

// nLevels=0 means levels [0].  nLevels=1 means levels [0, 1]

import { Layer, LayerOptions } from './Layer'
import { WebGLVectorTile2, WebGLVectorTile2Shaders } from './WebGLVectorTile2'
import { LayerProxy } from './LayerProxy';

export class WebGLVectorLayer2 extends Layer {
  _tileUrl: string;
  epochs: any;

  constructor(layerProxy: LayerProxy, glb: any, canvasLayer: any, tileUrl: string, layerOptions: LayerOptions) {
    super(layerProxy, layerOptions, WebGLVectorTile2);
    this._tileUrl = tileUrl;

    // WebGLVectorLayer2 defaults
    this.fragmentShader = this.fragmentShader ?? WebGLVectorTile2Shaders.vectorTileFragmentShader;
    this.vertexShader = this.vertexShader ?? WebGLVectorTile2Shaders.vectorTileVertexShader;
    this.setDataFunction = this.setDataFunction ?? WebGLVectorTile2.prototype._setBufferData;
    this.loadDataFunction = this.loadDataFunction ?? WebGLVectorTile2.prototype._loadData;
    this.dataLoadedFunction = this.dataLoadedFunction ?? WebGLVectorTile2.prototype._defaultDataLoaded;

    // Hack to rewrite vertexShader for .bin choropleth tiles
    // TODO: make this less hacky
    if (this.vertexShader == WebGLVectorTile2Shaders.choroplethMapVertexShader &&
        this.externalGeojson &&
        this.externalGeojson.endsWith('.bin')) {
      this.vertexShader = WebGLVectorTile2Shaders.choroplethMapVertexShaderV2;
      this.fragmentShader = WebGLVectorTile2Shaders.choroplethMapFragmentShaderV2;
    }
  }

  draw(view, opt_options) {
    this._drawHelper(view, opt_options);
  }
}

