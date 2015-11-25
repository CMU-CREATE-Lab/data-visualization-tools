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

function WebglPointTile(glb, tileidx, bounds, url) {
  this.glb = glb;
  this.gl = glb.gl;
  this._tileidx = tileidx;
  this._bounds = bounds;
  this._url = url;
  this._ready = false;
  this._program = glb.programFromSources(WebglPointTile.vertexShader,
    WebglPointTile.fragmentShader);
  this._load();

}

WebglPointTile.prototype._load = function() {
  var that = this;
  var xhr = new XMLHttpRequest();
  var float32Array = null;
  xhr.open('GET', that._url);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    if (this.status != 404) { 
      float32Array = new Float32Array(this.response);
    }
    that._setData(float32Array);
  }
  xhr.send();
}

WebglPointTile.prototype._setData = function(arrayBuffer) {
  if (arrayBuffer) {

    var gl = this.gl;
    this._pointCount = arrayBuffer.length / 6;

    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this._program, 'centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 4, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this._program, 'aDist');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this._program, 'aColor');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);
  }
  this._ready = true;
}


WebglPointTile.prototype.isReady = function() {
  return this._ready;
}

WebglPointTile.prototype.delete = function() {
  //console.log('delete');
}

WebglPointTile.prototype.draw = function(transform, opts) {
  var gl = this.gl;
  var opts = opts || {};
  var step;
  var pointSize = opts.pointSize || 1.;
  var zoom = opts.zoom || 4.;
  var filter;
  var se01;
  var se02;
  var se03;
  var distance = opts.distance || 10000.;

  var tileTransform = new Float32Array(transform);

  scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);

  translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
  scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);


  this._transform = transform;
  this._tileTransform = tileTransform;
  if (opts.step == null) {
    step = 1.;
  } else {
    step = opts.step;
  }

  if (opts.filter) {
    var filter = opts.filter
  } else {
    filter = true;
  }

  if (opts.se01) {
    var se01 = opts.se01
  } else {
    se01 = true;
  }

  if (opts.se02) {
    var se02 = opts.se02
  } else {
    se02 = true;
  }

  if (opts.se03) {
    var se03 = opts.se03
  } else {
    se03 = true;
  }

  if (this._ready && this._data) {
    gl.useProgram(this._program);

    var aTime = gl.getAttribLocation(this._program, "aTime");
    gl.vertexAttrib1f(aTime, step);

    var sizeLoc = gl.getUniformLocation(this._program, 'uSize');
    gl.uniform1f(sizeLoc, pointSize);

    var zoomLoc = gl.getUniformLocation(this._program, 'uZoom');
    gl.uniform1f(zoomLoc, zoom);

    var filterDistLoc = gl.getUniformLocation(this._program, 'filterDist');
    gl.uniform1i(filterDistLoc, filter);

    var showSe01Loc = gl.getUniformLocation(this._program, 'showSe01');
    gl.uniform1i(showSe01Loc, se01);

    var showSe02Loc = gl.getUniformLocation(this._program, 'showSe02');
    gl.uniform1i(showSe02Loc, se02);

    var showSe03Loc = gl.getUniformLocation(this._program, 'showSe03');
    gl.uniform1i(showSe03Loc, se03);

    var matrixLoc = gl.getUniformLocation(this._program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var uDistLoc = gl.getUniformLocation(this._program, 'uDist');
    gl.uniform1f(uDistLoc, distance*1000);


    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this._program, 'centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 4, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this._program, 'aDist');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this._program, 'aColor');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
  }
}

// Update and draw tiles
WebglPointTile.update = function(tiles, transform, opts) {
  for (var i = 0; i < tiles.length; i++) {
    tiles[i].draw(transform, opts);
  }
}

WebglPointTile.vertexShader = 
    'attribute vec4 centroid;\n' +

    'attribute float aTime;\n' +
    'attribute float aDist;\n' +
    'attribute float aColor;\n' +

    'uniform bool filterDist;\n' +
    'uniform bool showSe01;\n' +
    'uniform bool showSe02;\n' +
    'uniform bool showSe03;\n' +

    'uniform float uDist;\n' +
    'uniform float uSize;\n' +
    'uniform float uZoom;\n' +
    'uniform mat4 mapMatrix;\n' +

    'varying float vColor;\n' +

    'float fX(float x, float deltaX, float t) {\n' +
    '  return x + deltaX * t;\n' +
    '}\n' +

    'float fY(float y, float deltaY, float t) {\n' +
    '  return y + deltaY * t;\n' +
    '}\n' +

    'void main() {\n' +
    '  float fx = fX(centroid.z, centroid.x - centroid.z, aTime);\n' +
    '  float fy = fY(centroid.w, centroid.y - centroid.w, aTime);\n' +

    '  vec4 position = mapMatrix * vec4(fx, fy, 0, 1);\n' +

    '  if (filterDist && aDist >= uDist) {\n' +
    '      position = vec4(-1.,-1.,-1.,-1.);\n' +
    '  }\n' +
    '  if (!showSe01 && aColor == 16730905.) {\n' +
    '    position = vec4(-1.,-1.,-1.,-1.);\n' +
    '  }\n' +
    '  if (!showSe02 && aColor == 625172.) {\n' +
    '    position = vec4(-1.,-1.,-1.,-1.);\n' +
    '  }\n' +
    '  if (!showSe03 && aColor == 1973987.) {\n' +
    '    position = vec4(-1.,-1.,-1.,-1.);\n' +
    '  }\n' +
    '  gl_Position = position;\n' +
    '  gl_PointSize = uSize;\n' +

    '  vColor = aColor;\n' +
    '}\n';

WebglPointTile.fragmentShader= 
    'precision lowp float;\n' +

    'varying float vColor;\n' +

    'vec4 setColor(vec4 color, float dist, float hardFraction) {\n' +
    '  return color * clamp((0.5 - dist) / (0.5 - 0.5 * hardFraction), 0., 1.);\n' +
    '}\n' +

    'vec3 unpackColor(float f) {\n' +
    '  vec3 color;\n' +
    '  color.b = floor(f / 256.0 / 256.0);\n' +
    '  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
    '  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
    '  return color / 256.0;\n' +
    '}\n' +

    'void main() {\n' +
    '  gl_FragColor = vec4(unpackColor(vColor),.45);\n' +
    '}\n';

