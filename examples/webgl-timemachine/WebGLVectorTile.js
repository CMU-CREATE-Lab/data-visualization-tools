"use strict";

//
// Want to quadruple-buffer
// From time 1 to 1.999, display 1
//                       already have 2 in the hopper, nominally
//                       be capturing 3
//                       have a fourth fallow buffer to let pipelined chrome keep drawing

// Be capturing 3 means that at t=1, the first video just crossed 3.1,
//                   and that at t=1.999, the last video just crossed 3.1
// So we're aiming to run the videos at current display time plus 1.1 to 2.1
// Or maybe compress the range and go with say 1.6 to 2.1?  That lets us better use
// the flexibility of being able to capture the video across a range of times

function WebGLVectorTile(glb, tileidx, bounds, url) {
  this.glb = glb;
  this.gl = glb.gl;
  this._tileidx = tileidx;
  this._bounds = bounds;
  this._url = url;
  this._ready = false;
  this.program = glb.programFromSources(Glb.vectorTileVertexShader,
    Glb.vectorTileFragmentShader);
  this._load();
}

WebGLVectorTile.prototype
._load = function() {
  var that = this;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', that._url);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    var float32Array = new Float32Array(this.response);
    that._setData(float32Array);
  }
  // If tile 404's, replace with defaultUrl.  This lets us remove e.g. all the
  // sea tiles and replace with a single default tile.
  xhr.onerror = function() {
    that._setData(new Float32Array([]));
  }
  xhr.send();
}

WebGLVectorTile.prototype.
_setData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 3;

  this._data = arrayBuffer;
  this._arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

  var attributeLoc = gl.getAttribLocation(this.program, 'time');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 12, 8);

  this._ready = true;
}

WebGLVectorTile.prototype.
isReady = function() {
  return this._ready;
}

WebGLVectorTile.prototype.
delete = function() {
  //console.log('delete');
}

WebGLVectorTile.prototype.
draw = function(transform) {
  var gl = this.gl;
  var minTime = new Date('1800').getTime();
  var maxTime = new Date('2015').getTime();
  if (this._ready) {
    gl.lineWidth(2);
    gl.useProgram(this.program);

    var matrixLoc = gl.getUniformLocation(this.program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, transform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'time');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 12, 8);

    var timeLoc = gl.getUniformLocation(this.program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime*1.0);

    var timeLoc = gl.getUniformLocation(this.program, 'minTime');
    gl.uniform1f(timeLoc, minTime*1.0);

    gl.drawArrays(gl.LINES, 0, this._pointCount);
  }
}

// Update and draw tiles
WebGLVectorTile.update = function(tiles, transform) {
  for (var i = 0; i < tiles.length; i++) {
    tiles[i].draw(transform);
  }
}
