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

function WebGLVectorTile2(glb, tileidx, bounds, url, opt_options) {

  this.glb = glb;
  this.gl = glb.gl;
  this._tileidx = tileidx;
  this._bounds = bounds;
  this._url = url;
  this._ready = false;

  var opt_options = opt_options || {};
  this._setData = opt_options.setDataFunction || this._setCoralReefData;
  this.draw = opt_options.drawFunction || this._drawLines;
  this._fragmentShader = opt_options.fragmentShader || WebGLVectorTile2.vectorTileFragmentShader;
  this._vertexShader = opt_options.vertexShader || WebGLVectorTile2.vectorTileVertexShader;

  this.program = glb.programFromSources(this._vertexShader, this._fragmentShader);
  this._load();

}

WebGLVectorTile2.prototype._load = function() {
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


WebGLVectorTile2.prototype._setCoralReefData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 2;

  this._data = arrayBuffer;
  this._arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 8, 0);

  this._ready = true;
}

WebGLVectorTile2.prototype._setUsgsWindTurbineData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 3;

  this._data = arrayBuffer;
  this._arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

  var timeLoc = gl.getAttribLocation(this.program, 'time');
  gl.enableVertexAttribArray(timeLoc);
  gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 12, 8);

  this._ready = true;
}


WebGLVectorTile2.prototype.isReady = function() {
  return this._ready;
}

WebGLVectorTile2.prototype.delete = function() {
  //console.log('delete');
}


WebGLVectorTile2.prototype._drawLines = function(transform) {
  var gl = this.gl;
  if (this._ready) {
    gl.lineWidth(2);
    gl.useProgram(this.program);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);

    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

  
    var matrixLoc = gl.getUniformLocation(this.program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 8, 0);

    gl.drawArrays(gl.LINES, 0, this._pointCount);
  }
}

WebGLVectorTile2.prototype._drawPoints = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var maxTime = options.currentTime/1000.;
    var pointSize = options.pointSize || (2.0 * window.devicePixelRatio);
    var color = options.color || [.1, .1, .5, 1.0]; 

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);

    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);
    var pointSizeLoc = gl.getUniformLocation(this.program, 'uPointSize');
    gl.uniform1f(pointSizeLoc, pointSize);

    var timeLoc = gl.getAttribLocation(this.program, 'time');
    gl.enableVertexAttribArray(timeLoc);
    gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 12, 8);

    var timeLoc = gl.getUniformLocation(this.program, 'uMaxTime');
    gl.uniform1f(timeLoc, maxTime*1.);

    var uColor =  color;
    var colorLoc = gl.getUniformLocation(this.program, 'uColor');
    gl.uniform4fv(colorLoc, uColor);


    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    gl.disable(gl.BLEND);
  }
}


// Update and draw tiles
WebGLVectorTile2.update = function(tiles, transform, options) {
  for (var i = 0; i < tiles.length; i++) {
    tiles[i].draw(transform, options);
  }
}


WebGLVectorTile2.vectorTileVertexShader =
'attribute vec4 worldCoord;\n' +

'uniform mat4 mapMatrix;\n' +

'void main() {\n' +
'    gl_Position = mapMatrix * worldCoord;\n' +
'}';

WebGLVectorTile2.vectorPointTileVertexShader =
'attribute vec4 worldCoord;\n' +
'attribute float time;\n' + 

'uniform float uMaxTime;\n' + 
'uniform float uPointSize;\n' +
'uniform mat4 mapMatrix;\n' +

'void main() {\n' +
'  if (time > uMaxTime) {\n' + 
'    gl_Position = vec4(-1,-1,-1,-1);\n' + 
'  } else {\n' + 
'    gl_Position = mapMatrix * worldCoord;\n' + 
'  };\n' + 
'  gl_PointSize = uPointSize;\n' +
'}';

WebGLVectorTile2.vectorTileFragmentShader =
'void main() {\n' +
'  gl_FragColor = vec4(1., .0, .65, 1.0);\n' +
'}\n';

WebGLVectorTile2.vectorPointTileFragmentShader =
'precision mediump float;\n' +
'uniform vec4 uColor;\n' + 
'void main() {\n' +
'  float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' + 
'  dist = 1. - (dist * 2.);\n' + 
'  dist = max(0., dist);\n' + 
'  gl_FragColor = uColor * dist;\n' + 
'}\n';
