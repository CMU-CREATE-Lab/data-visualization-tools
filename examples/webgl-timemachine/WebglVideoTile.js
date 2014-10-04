"use strict";

function WebglVideoTile(tileidx) {
  this._tileidx = tileidx;
  this._readyAfter = performance.now() + Math.random() * 1000;
}

WebglVideoTile.prototype.
toString = function() {
  return 'Tile ' + this._tileidx.toString() + ', ready: ' + this.isReady();
};

WebglVideoTile.prototype.
isReady = function() {
  return performance.now() >= this._readyAfter;
};


