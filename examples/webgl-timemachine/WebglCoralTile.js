"use strict";

function WebglCoralTile(glb, url) {
  this.glb = glb;
  this.gl = glb.gl;
  this._url = url;
  this._ready = false;
  this._program = glb.programFromSources(WebglCoralTile.vertexShader,
    WebglCoralTile.fragmentShader);
  this._minTime = new Date('1980-01-01').getTime();
  this._maxTime = new Date('2011-01-01').getTime();
  this._load();

}

WebglCoralTile.prototype._load = function() {
  //console.log('_load');
  var that = this;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', that._url);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    var float32Array = new Float32Array(this.response);
    that._setData(float32Array);
  }
  xhr.send();
}

WebglCoralTile.prototype._setData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 4; 

  this._data = arrayBuffer;
  this._arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this._program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

  var timeLoc = gl.getAttribLocation(this._program, 'time');
  gl.enableVertexAttribArray(timeLoc);
  gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 12, 8);

  this._ready = true;
}


WebglCoralTile.prototype.isReady = function() {
  return this._ready;
}

WebglCoralTile.prototype.delete = function() {
  //console.log('delete');
}

WebglCoralTile.prototype.draw = function(transform, opts) {
  var gl = this.gl;
  var opts = opts || {};
  var minTime = opts.minTime || this._minTime;
  var maxTime = opts.maxTime || this._maxTime;
  var pointSize = opts.pointSize || (2.0 * window.devicePixelRatio);

  if (transform.currentDate) {
    maxTime = transform.currentDate;
    //minTime = maxTime - 30*24*60*60*1000;
  }
  if (this._ready) {
    gl.useProgram(this._program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var w = glb.gl.canvas.width/window.devicePixelRatio;
    var h = glb.gl.canvas.height/window.devicePixelRatio;
    var pixelsToWebGLMatrix = new Float32Array(16);
    var mapMatrix = new Float32Array(16);

    pixelsToWebGLMatrix.set([2/w, 0,   0, 0,
                             0,  -2/h, 0, 0,
                             0,   0,   0, 0,
                            -1,   1,   0, 1]);

    mapMatrix.set(pixelsToWebGLMatrix)
    var scale = 1335834./256.;

    translateMatrix(mapMatrix, w*0.5, h*0.5);
    scaleMatrix(mapMatrix, transform.scale, transform.scale);
    translateMatrix(mapMatrix, -transform.x, -transform.y);
    scaleMatrix(mapMatrix, scale, scale);

    this.transform = mapMatrix;

    pointSize *= Math.floor((transform.zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1);
    

    gl.vertexAttrib1f(gl.aPointSize, pointSize*1.0);

    var matrixLoc = gl.getUniformLocation(this._program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, mapMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this._program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

    var timeLoc = gl.getAttribLocation(this._program, 'time');
    gl.enableVertexAttribArray(timeLoc);
    gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 12, 8);

    var timeLoc = gl.getUniformLocation(this._program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime*1./1000.);

    var timeLoc = gl.getUniformLocation(this._program, 'minTime');
    gl.uniform1f(timeLoc, minTime*1./1000.);

    var pointSizeLoc = gl.getUniformLocation(this._program, 'pointSize');
    gl.uniform1f(pointSizeLoc, pointSize*2.);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    gl.disable(gl.BLEND);

  }
}



WebglCoralTile.vertexShader =
  'attribute vec4 worldCoord;\n' + 
  'attribute float time;\n' + 

  'uniform mat4 mapMatrix;\n' + 
  'uniform float pointSize;\n' + 
  'uniform float maxTime;\n' + 
  'uniform float minTime;\n' + 

  'void main() {\n' + 
  '  if (time < minTime || time > maxTime) {\n' + 
  '    gl_Position = vec4(-1,-1,-1,-1);\n' + 
  '  } else {\n' + 
  '    gl_Position = mapMatrix * worldCoord;\n' + 
  '  };\n' + 
  '  gl_PointSize = pointSize;\n' + 
  '}';

WebglCoralTile.fragmentShader =
  'precision mediump float;\n' + 

 
  'void main() {\n' + 
  '  vec3 color = vec3(.82, .22, .07);\n' + 
  '  float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' + 
  '  dist = 1. - (dist * 2.);\n' + 
  '  dist = max(0., dist);\n' + 

  '  gl_FragColor = vec4(color, 1.) * dist;\n' + 
  '}';
