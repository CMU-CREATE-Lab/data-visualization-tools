"use strict";

function WebglVideoTile(glb, tileidx, bounds) {
  this._tileidx = tileidx;
  this.glb = glb;
  this.gl = glb.gl;
  this._program = glb.programFromSources(Glb.fixedSizePointVertexShader,
                                         Glb.solidColorFragmentShader);
  this._readyAfter = performance.now() + Math.random() * 1000;
  var inset = (bounds.max.x - bounds.min.x) * 0.005;
  this._rectangle = glb.createBuffer(new Float32Array(
    [bounds.min.x + inset, bounds.min.y + inset,
     bounds.max.x - inset, bounds.min.y + inset,
     bounds.max.x - inset, bounds.max.y - inset,
     bounds.min.x + inset, bounds.max.y - inset]));
}

WebglVideoTile.prototype.
toString = function() {
  return 'Tile ' + this._tileidx.toString() + ', ready: ' + this.isReady();
};

WebglVideoTile.prototype.
isReady = function() {
  return performance.now() >= this._readyAfter;
};

WebglVideoTile.prototype.
draw = function(transform) {
  this.gl.useProgram(this._program);
  //  this.gl.uniformMatrix4fv(this._program.uTransform, false,
  // new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]));
  this.gl.uniformMatrix4fv(this._program.uTransform, false, transform);
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._rectangle);
  this.gl.vertexAttribPointer(this._program.aWorldCoord, 2, this.gl.FLOAT, false, 0, 0);
  this.gl.enableVertexAttribArray(this._program.aWorldCoord);
  this.gl.drawArrays(this.gl.LINE_LOOP, 0, 4);
};


