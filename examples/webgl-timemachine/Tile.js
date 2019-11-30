"use strict";

// Base class for tiles

function Tile(layer, tileview, glb, tileidx, bounds) {
  this._layer = layer;
  this._tileview = tileview;
  this.glb = glb;
  this.gl = glb.gl;
  this._tileidx = tileidx;
  this._bounds = bounds;
}

// Handle fetching of resource that might be one-per-tile or one-per-layer
// E.g. data for choropleth

Tile.prototype._fetchData = function(url, parse) {
}

Tile.prototype.unloadResources = function() {
  for (var property in this) {
    if (this[property] instanceof Resource) {
      //console.log('Unloading tile.' + property + ' from ' + this._tileidx.toString());
      this[property].unload();
    }
  }
}
