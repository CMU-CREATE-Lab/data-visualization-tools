// Base class for tiles

import { TileIdx } from './TileIdx'
import { TileView } from './TileView'
import { Resource } from './Resource'

export class Tile {
  _layer: any;
  _tileview: TileView;
  glb: any;
  gl: any;
  _tileidx: TileIdx;
  _bounds: any;
  constructor(layer, tileview: TileView, glb, tileidx: TileIdx, bounds) {
    this._layer = layer;
    this._tileview = tileview;
    this.glb = glb;
    this.gl = glb.gl;
    this._tileidx = tileidx;
    this._bounds = bounds;
  }
  // Handle fetching of resource that might be one-per-tile or one-per-layer
  // E.g. data for choropleth
  _fetchData(url: string, parse) {
  }
  unloadResources() {
    for (var property in this) {
      var val = this[property];
      if (val instanceof Resource) {
        //console.log('Unloading tile.' + property + ' from ' + this._tileidx.toString());
        val.unload();
      }
    }
  }
}

