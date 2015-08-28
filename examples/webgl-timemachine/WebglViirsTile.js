"use strict";

function WebglViirsTile(glb, url) {
  this.glb = glb;
  this.gl = glb.gl;
  this._url = url;
  this._ready = false;
  this._program = glb.programFromSources(WebglViirsTile.vertexShader,
    WebglViirsTile.fragmentShader);
  this._minTime = new Date('2014-03-14').getTime();
  this._maxTime = new Date('2014-04-13').getTime();
  this._showTemp = false;
  this._minTemp = 400.;
  this._maxTemp = 3000.;
  this._load();

}

WebglViirsTile.prototype._load = function() {
  console.log('_load');
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

WebglViirsTile.prototype._setData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 4; 

  this._data = arrayBuffer;
  this._arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this._program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 16, 0);

  var timeLoc = gl.getAttribLocation(this._program, 'time');
  gl.enableVertexAttribArray(timeLoc);
  gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 16, 8);

  var tempLocation = gl.getAttribLocation(this._program, "temp");
  gl.enableVertexAttribArray(tempLocation);
  gl.vertexAttribPointer(tempLocation, 1, gl.FLOAT, false, 16, 12);

  this._ready = true;
}


WebglViirsTile.prototype.isReady = function() {
  return this._ready;
}

WebglViirsTile.prototype.delete = function() {
  console.log('delete');
}

WebglViirsTile.prototype.draw = function(transform, opts) {
  var gl = this.gl;
  var opts = opts || {};
  var minTime = opts.minTime || this._minTime;
  var maxTime = opts.maxTime || this._maxTime;
  var showTemp = opts.showTemp || this._showTemp;
  var minTemp = opts.minTemp || this._minTemp;
  var maxTemp = opts.maxTemp || this._maxTemp;
  var pointSize = opts.pointSize || 4.;

  if (transform.currentDate) {
    maxTime = transform.currentDate;
    minTime = maxTime - 30*24*60*60*1000;
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

    var pointSize = Math.floor((transform.zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 4.;
    

    gl.vertexAttrib1f(gl.aPointSize, pointSize*1.0);

    var matrixLoc = gl.getUniformLocation(this._program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, mapMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this._program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 16, 0);

    var timeLoc = gl.getAttribLocation(this._program, 'time');
    gl.enableVertexAttribArray(timeLoc);
    gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 16, 8);

    var tempLocation = gl.getAttribLocation(this._program, "temp");
    gl.enableVertexAttribArray(tempLocation);
    gl.vertexAttribPointer(tempLocation, 1, gl.FLOAT, false, 16, 12);

    var timeLoc = gl.getUniformLocation(this._program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime*1.);

    var timeLoc = gl.getUniformLocation(this._program, 'minTime');
    gl.uniform1f(timeLoc, minTime*1.);

    var showTempLoc = gl.getUniformLocation(this._program, 'showTemp');
    gl.uniform1f(showTempLoc, showTemp);

    var tempLoc = gl.getUniformLocation(this._program, 'minTemp');
    gl.uniform1f(tempLoc, minTemp*1.0);

    var tempLoc = gl.getUniformLocation(this._program, 'maxTemp');
    gl.uniform1f(tempLoc, maxTemp*1.0);

    var pointSizeLoc = gl.getUniformLocation(this._program, 'pointSize');
    gl.uniform1f(pointSizeLoc, pointSize);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    gl.disable(gl.BLEND);

  }
}



WebglViirsTile.vertexShader =
  'attribute vec4 worldCoord;\n' + 
  'attribute float time;\n' + 
  'attribute float temp;\n' + 

  'uniform mat4 mapMatrix;\n' + 
  'uniform float pointSize;\n' + 
  'uniform float maxTime;\n' + 
  'uniform float minTime;\n' + 
  'uniform float minTemp;\n' + 
  'uniform float maxTemp;\n' + 

  'varying float vTemp;\n' + 

  'void main() {\n' + 
  '  if (time < minTime || time > maxTime || temp == 1810. || temp < minTemp || temp > maxTemp) {\n' + 
  '    gl_Position = vec4(-1,-1,-1,-1);\n' + 
  '  } else {\n' + 
  '    gl_Position = mapMatrix * worldCoord;\n' + 
  '  };\n' + 
  '  gl_PointSize = pointSize;\n' + 
  '  vTemp = temp;\n' + 
  '}';

WebglViirsTile.fragmentShader =
  'precision mediump float;\n' + 

  'uniform bool showTemp;\n' + 

  'varying float vTemp;\n' + 

  'void main() {\n' + 
  '  vec3 color;\n' + 
  '  vec3 purple = vec3(.4,.0, .8);\n' + 
  '  vec3 blue = vec3(.0, .0, .8);\n' + 
  '  vec3 green = vec3(.0, .8, .0);\n' + 
  '  vec3 yellow = vec3(1., 1., .0);\n' + 
  '  vec3 red = vec3(.8, .0, .0);\n' + 

  '  if (showTemp) {\n' + 
  '    if (vTemp > 400. && vTemp < 1000.) {\n' + 
  '      color = purple;\n' + 
  '    } else if (vTemp > 1000. && vTemp < 1200.) {\n' + 
  '      color = blue;\n' + 
  '    } else if (vTemp > 1200. && vTemp < 1400.) {\n' + 
  '      color = green;\n' + 
  '    } else if (vTemp > 1400. && vTemp < 1600.) {\n' + 
  '      color = yellow;\n' + 
  '    } else {\n' + 
  '      color = red;\n' + 
  '    }\n' + 
  '  } else {\n' + 
  '    color = vec3(.82, .22, .07);\n' + 
  '  }\n' + 

  '  float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' + 
  '  dist = 1. - (dist * 2.);\n' + 
  '  dist = max(0., dist);\n' + 

  '  gl_FragColor = vec4(color, 1.) * dist;\n' + 
  '}';
