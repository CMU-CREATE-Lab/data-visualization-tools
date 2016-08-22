"use strict";

function MonthlyRefugeesTile(glb, url) {
    this.glb = glb;
    this.gl = glb.gl;
    this._url = url;
    this._ready = false;
    this._program = glb.programFromSources(MonthlyRefugeesTile.vertexShader,
    MonthlyRefugeesTile.fragmentShader);
    this._minTime = new Date('2014-01-1').getTime();
    this._maxTime = new Date('2014-07-1').getTime();
    this._load();

}

MonthlyRefugeesTile.prototype._load = function() {
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

MonthlyRefugeesTile.prototype._setData = function(arrayBuffer) {
    var gl = this.gl;
    this._pointCount = arrayBuffer.length / 10; 

    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this._program, 'aStartPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 0);

    var attributeLoc = gl.getAttribLocation(this._program, 'aEndPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 8);

    var attributeLoc = gl.getAttribLocation(this._program, 'aMidPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 16);

    var attributeLoc = gl.getAttribLocation(this._program, 'aEpoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 24);


    var attributeLoc = gl.getAttribLocation(this._program, 'aEndTime');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 28);


    var attributeLoc = gl.getAttribLocation(this._program, 'aSpan');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 32);

    var attributeLoc = gl.getAttribLocation(this._program, 'aTimeOffset');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 36);

  this._ready = true;
}


MonthlyRefugeesTile.prototype.isReady = function() {
  return this._ready;
}

MonthlyRefugeesTile.prototype.delete = function() {
  //console.log('delete');
}

MonthlyRefugeesTile.prototype.draw = function(transform, opts) {
  var gl = this.gl;
  var opts = opts || {};
  // var minTime = opts.minTime || this._minTime;
  // var maxTime = opts.maxTime || this._maxTime;
  var pointSize = opts.pointSize || (1.0 * window.devicePixelRatio);

  // if (transform.currentDate) {
  //   maxTime = transform.currentDate;
  //   minTime = maxTime - 30*24*60*60*1000;
  // }
  if (this._ready) {
    gl.useProgram(this._program);
    gl.enable(gl.BLEND);
    // gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
    gl.blendFunc( gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

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

    pointSize *= 4.0 * Math.pow(20 / 4, (transform.zoom - 3) / (10 - 3));
    

    var sizeLoc = gl.getUniformLocation(this._program, 'uSize');
    gl.uniform1f(sizeLoc, pointSize);
      
    var timeLoc = gl.getUniformLocation(this._program, 'uTotalTime');
    gl.uniform1f(timeLoc, 1296000);

    var matrixLoc = gl.getUniformLocation(this._program, 'uMapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, mapMatrix);
      
    var epochLoc = gl.getUniformLocation(this._program, 'uEpoch');
    gl.uniform1f(epochLoc, transform.currentDate);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this._program, 'aStartPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 0);

    var attributeLoc = gl.getAttribLocation(this._program, 'aEndPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 8);

    var attributeLoc = gl.getAttribLocation(this._program, 'aMidPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 16);

    var attributeLoc = gl.getAttribLocation(this._program, 'aEpoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 24);

    var attributeLoc = gl.getAttribLocation(this._program, 'aEndTime');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 28);

    var attributeLoc = gl.getAttribLocation(this._program, 'aSpan');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 32);

    var attributeLoc = gl.getAttribLocation(this._program, 'aTimeOffset');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 36);
      
    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    gl.disable(gl.BLEND);

  }
}



MonthlyRefugeesTile.vertexShader =
    "attribute vec4 aStartPoint;\n" + 
    "attribute vec4 aEndPoint;\n" +  
    "attribute vec4 aMidPoint;\n" + 
    "attribute float aEpoch;\n" + 
    "attribute float aEndTime;\n" + 
    "attribute float aSpan;\n" + 
    "attribute float aTimeOffset;\n" + 

    "uniform float uSize;\n" + 
    "uniform float uEpoch;\n" + 
    "uniform mat4 uMapMatrix;\n" + 
    "uniform float uTotalTime;\n" + 

    "float Epsilon = 1e-10;\n" +  
    "varying vec4 vColor;\n" +  
      
    "vec4 bezierCurve(float t, vec4 P0, vec4 P1, vec4 P2) {\n" +
        "return (1.0-t)*(1.0-t)*P0 + 2.0*(1.0-t)*t*P1 + t*t*P2;\n" + 
    "}\n" + 

    "vec3 HUEtoRGB(float H){\n" +
        "float R = abs((H * 6.) - 3.) - 1.;\n" + 
        "float G = 2. - abs((H * 6.) - 2.);\n" + 
        "float B = 2. - abs((H * 6.) - 4.);\n" + 
        "return clamp(vec3(R,G,B), 0.0, 1.0);\n" + 
    "}\n" + 

    "vec3 HSLtoRGB(vec3 HSL){\n" +
        "vec3 RGB = HUEtoRGB(HSL.x);\n" + 
        "float C = (1. - abs(2. * HSL.z - 1.)) * HSL.y;\n" + 
        "return (RGB - 0.5) * C + HSL.z;\n" + 
    "}\n" + 
 
    "vec3 RGBtoHCV(vec3 RGB){\n" +
        "vec4 P = (RGB.g < RGB.b) ? vec4(RGB.bg, -1.0, 2.0/3.0) : vec4(RGB.gb, 0.0, -1.0/3.0);\n" + 
        "vec4 Q = (RGB.r < P.x) ? vec4(P.xyw, RGB.r) : vec4(RGB.r, P.yzx);\n" + 
        "float C = Q.x - min(Q.w, Q.y);\n" + 
        "float H = abs((Q.w - Q.y) / (6. * C + Epsilon) + Q.z);\n" + 
        "return vec3(H, C, Q.x);\n" + 
     "}\n" + 
    
     "vec3 RGBtoHSL(vec3 RGB){\n" +
        "vec3 HCV = RGBtoHCV(RGB);\n" + 
        "float L = HCV.z - HCV.y * 0.5;\n" + 
        "float S = HCV.y / (1. - abs(L * 2. - 1.) + Epsilon);\n" + 
        "return vec3(HCV.x, S, L);\n" + 
     "}\n" + 

    "vec4 calcColor(float p, vec3 c){\n" + 
        "vec3 hsl = RGBtoHSL(c);\n" +  
        "return vec4(HSLtoRGB(vec3(hsl.x, hsl.y, p)), 1.);\n" +  
    "}\n" + 

    "void main() {\n" +
        "vec4 position;\n" + 
        "if (uEpoch < aEpoch || (uEpoch > aEpoch + aSpan)) {\n" +
            "position = vec4(-1,-1,-1,-1);\n" + 
        "}else {\n" +
            "float t = (uEpoch - aEpoch)/aSpan + aTimeOffset;\n" + 
            "t = min(t, 1.);\n" + 
            "t = max(t,0.);\n" + 
            "vec4 pos = bezierCurve(t, aStartPoint, aMidPoint, aEndPoint);\n" + 
            "position = uMapMatrix * vec4(pos.x, pos.y, 0, 1);\n" + 
            "float luminance = clamp(1. - ((aEndTime - uEpoch)/uTotalTime), 0.45, 0.95);\n" + 
            "vColor = calcColor(luminance, vec3(1.,0.,0.));\n" + 
        "}\n" + 
        
        "gl_Position = position;\n" + 
        "gl_PointSize = uSize;\n" + 
    "}";

MonthlyRefugeesTile.fragmentShader =
    "precision mediump float;\n" + 
    "varying vec4 vColor;\n" + 
      
    "void main() {\n" +
        "float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n" + 
        "dist = 1. - (dist * 2.);\n" + 
        "dist = max(0., dist);\n" + 
        "gl_FragColor = vColor * dist;\n" + 
    "}";
