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
  this._load = opt_options.loadDataFunction || this._loadData;
  this.draw = opt_options.drawFunction || this._drawLines;
  this._fragmentShader = opt_options.fragmentShader || WebGLVectorTile2.vectorTileFragmentShader;
  this._vertexShader = opt_options.vertexShader || WebGLVectorTile2.vectorTileVertexShader;

  this.gl.getExtension("OES_standard_derivatives");

  this.program = glb.programFromSources(this._vertexShader, this._fragmentShader);

  if (opt_options.imageSrc) {
    this._image = new Image();
    this._image.src = opt_options.imageSrc;
    var that = this;
    this._image.onload = function() {
      that._load();
    }
  } else {
    this._load();
  }


}

WebGLVectorTile2.prototype._loadData = function() {
  var that = this;
  this.startTime = new Date().getTime();
  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);
  this.xhr.responseType = 'arraybuffer';
  var float32Array;
  this.xhr.onload = function() {
    if (this.status == 404) {
      float32Array = new Float32Array([]);
    } else {
      float32Array = new Float32Array(this.response);
      perf_receive(float32Array.length * 4, new Date().getTime() - that.startTime);
    }
    that._setData(float32Array);
  }
  this.xhr.onerror = function() {
    that._setData(new Float32Array([]));
  }
  this.xhr.send();
}

WebGLVectorTile2.prototype._loadGeojsonData = function() {
  var that = this;
  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);
  var data;
  this.xhr.onload = function() {
    if (this.status == 404) {
      data = "";
    } else {
      data = JSON.parse(this.responseText);
    }
    that._setData(data);
  }
  this.xhr.onerror = function() {
    that._setData('');
  }
  this.xhr.send();
}

// WDPA: worldCoord[2]  time
WebGLVectorTile2.prototype._setWdpaData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 3;
  if (this._pointCount > 0) {
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
}

// Global Terrorism Database: a_WorldCoord[2]  a_Epoch  a_NCasualties
WebGLVectorTile2.prototype._setGtdData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 4;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_WorldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 16, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Epoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 16, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_NCasualties');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 16, 12);

    this._ready = true;
  }
}

// Ebola: a_Centroid[2] a_Epoch1 a_Deaths1 a_Epoch2 a_Deaths2
WebGLVectorTile2.prototype._setEbolaData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 6;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Epoch1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Deaths1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Epoch2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Deaths2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    this._ready = true;
  }
}


// VIIRS fires: worldCoord[2] time temp
WebGLVectorTile2.prototype._setViirsData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 4;

  this._data = arrayBuffer;
  this._arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 16, 0);

  var timeLoc = gl.getAttribLocation(this.program, 'time');
  gl.enableVertexAttribArray(timeLoc);
  gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 16, 8);

  var tempLocation = gl.getAttribLocation(this.program, "temp");
  gl.enableVertexAttribArray(tempLocation);
  gl.vertexAttribPointer(tempLocation, 1, gl.FLOAT, false, 16, 12);

  this._ready = true;
}

// Coral Reef outlines worldCoord[2]
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

// USGS Wind Turbines worldCoord[2]  time
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

// LODES   centroid[4]  aDist  aColor
WebGLVectorTile2.prototype._setLodesData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 6;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 4, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'aDist');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'aColor');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    this._ready = true;
  }
}

// Color Dotmap (not animated)  aWorldCoord[2]  aColor
WebGLVectorTile2.prototype._setColorDotmapData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 3;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    this._ready = true;
  }
}

// Monthly Refugees aStartPoint[2] aEndPoint[2] aMidPoint[2] aEpoch aEndTime aSpan aTimeOffset
WebGLVectorTile2.prototype._setMonthlyRefugeesData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 10;

  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'aStartPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEndPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'aMidPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEpoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 24);


    var attributeLoc = gl.getAttribLocation(this.program, 'aEndTime');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 28);


    var attributeLoc = gl.getAttribLocation(this.program, 'aSpan');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 32);

    var attributeLoc = gl.getAttribLocation(this.program, 'aTimeOffset');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 36);

    this._ready = true;
  }
}

// Annual Refugees aStartPoint[2] aEndPoint[2] aMidPoint[2] aEpoch
WebGLVectorTile2.prototype._setAnnualRefugeesData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 7;

  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'aStartPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 28, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEndPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 28, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'aMidPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 28, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEpoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 28, 24);

    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this._ready = true;
  }
}

WebGLVectorTile2.prototype._setHealthImpactData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 6;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Year');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Rcp');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    this._ready = true;
  }
}

WebGLVectorTile2.prototype._setUrbanFragilityData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 5;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 20, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Year');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 16);

    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this._ready = true;
  }
}

WebGLVectorTile2.prototype._setObesityData = function(data) {
  function LatLongToPixelXY(latitude, longitude) {
    var pi_180 = Math.PI / 180.0;
    var pi_4 = Math.PI * 4;
    var sinLatitude = Math.sin(latitude * pi_180);
    var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (pi_4)) * 256;
    var pixelX = ((longitude + 180) / 360) * 256;
    var pixel = { x: pixelX, y: pixelY };
    return pixel;
  }

  var gl = this.gl;

  var verts = [];
  var rawVerts = [];

  if (typeof data.features != "undefined") {
    for (var f = 0; f < data.features.length ; f++) {
      var feature = data.features[f];

      var years = feature.properties.years;
      for (var ii = 0; ii < years.length; ii++) {
        if (feature.geometry.type != "MultiPolygon") {
          var mydata = earcut.flatten(feature.geometry.coordinates);
          var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
          for (var i = 0; i < triangles.length; i++) {
            var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
            if (ii < years.length - 1) {
              verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii + 1].scaled_mean);
            } else {
              verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii].scaled_mean);
            }
          }
        } else {
          for ( var j = 0; j < feature.geometry.coordinates.length; j++) {
            var mydata = earcut.flatten(feature.geometry.coordinates[j]);
            var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
            for (var i = 0; i < triangles.length; i++) {
              var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
              if (ii < years.length - 1) {
                verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii + 1].scaled_mean);
              } else {
                verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii].scaled_mean);
              }
            }
          }
        }
      }
    }
    this._pointCount = verts.length / 5;
    if (this._pointCount > 0) {
      this._data = new Float32Array(verts);

      this.arrayBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Vertex');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 20, 0);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Year');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 8);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 12);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 16);

      this._texture = gl.createTexture();

      gl.bindTexture(gl.TEXTURE_2D, this._texture);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      // Upload the image into the texture.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);

      this._ready = true;
    }
  }
}

WebGLVectorTile2.prototype._setVaccineConfidenceData = function(data) {
  function LatLongToPixelXY(latitude, longitude) {
    var pi_180 = Math.PI / 180.0;
    var pi_4 = Math.PI * 4;
    var sinLatitude = Math.sin(latitude * pi_180);
    var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (pi_4)) * 256;
    var pixelX = ((longitude + 180) / 360) * 256;
    var pixel = { x: pixelX, y: pixelY };
    return pixel;
  }

  var gl = this.gl;

  var verts = [];
  var rawVerts = [];


  /*
    questions = ["Vaccines are important for children to have",
                 "Overall I think vaccines are safe",
                 "Overall I think vaccines are effective",
                 "Vaccines are compatible with my religious beliefs"]
    responses = ["Strongly agree",
                 "Tend to agree",
                 "Tend to disagree",
                 "Strongly disagree",
                 "Do not know"]
  */
  var questions = ['Q1', 'Q2', 'Q3', 'Q4'];
  var minValues = {
    'Q1': 0.16,
    'Q2': 0.41000000000000003,
    'Q3': 0.26,
    'Q4':0.47
  };

  if (typeof data.features != "undefined") {
    for (var f = 0; f < data.features.length ; f++) {
      var feature = data.features[f];
      if (feature.geometry.type != "MultiPolygon") {
        var mydata = earcut.flatten(feature.geometry.coordinates);
        var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
        for (var i = 0; i < triangles.length; i++) {
          var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
          verts.push(pixel.x, pixel.y);
          for (var ii = 0; ii < questions.length; ii++) {
            var q = questions[ii];
            verts.push((feature.properties[q][2] + feature.properties[q][3])/minValues[q]);
          }
        }
      } else {
        for (var j = 0; j < feature.geometry.coordinates.length; j++) {
          var mydata = earcut.flatten(feature.geometry.coordinates[j]);
          var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
          for (var i = 0; i < triangles.length; i++) {
            var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
            verts.push(pixel.x, pixel.y);
            for (var ii = 0; ii < questions.length; ii++) {
              var q = questions[ii];
              verts.push((feature.properties[q][2] + feature.properties[q][3])/minValues[q]);
            }
          }
        }
      }
    }

    this._pointCount = verts.length / 6;
    if (this._pointCount > 0) {
      this._data = new Float32Array(verts);

      this.arrayBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Vertex');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 24, 0);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 8);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 12);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Val3');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

      var attributeLoc = gl.getAttribLocation(this.program, 'a_Val4');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

      this._texture = gl.createTexture();

      gl.bindTexture(gl.TEXTURE_2D, this._texture);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      // Upload the image into the texture.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);

      this._ready = true;
    }
  }
}


WebGLVectorTile2.prototype.isReady = function() {
  return this._ready;
}

WebGLVectorTile2.prototype.delete = function() {
  if (!this.isReady()) {
    if (this.xhr != null) {
      this.xhr.abort();
    }
  }
 }

WebGLVectorTile2.prototype._drawWdpa = function(transform, options) {
  var gl = this.gl;
  var minTime = options.minTime || new Date('1800').getTime();
  var maxTime = options.maxTime || new Date('2015').getTime();
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
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'time');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 12, 8);

    var timeLoc = gl.getUniformLocation(this.program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime);

    var timeLoc = gl.getUniformLocation(this.program, 'minTime');
    gl.uniform1f(timeLoc, minTime);

    gl.drawArrays(gl.LINES, 0, this._pointCount);
    perf_draw_lines(this._pointCount);
  }  
}

WebGLVectorTile2.prototype._drawLines = function(transform) {
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
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
    perf_draw_lines(this._pointCount);
  }
}

// Used by coral
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
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawGtd = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime/1000.;
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

    var attributeLoc = gl.getAttribLocation(this.program, 'a_WorldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 16, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 16, 8); // 8 byte offset

    var timeLocation = gl.getAttribLocation(this.program, "a_NCasualties");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 16, 12); // 8 byte offset

    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_EpochTime');
    gl.uniform1f(sliderTime, currentTime);

    var spanEpoch = 2.0*365*24*68*60;
    var span = gl.getUniformLocation(this.program, 'u_Span');
    gl.uniform1f(span, spanEpoch);


    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawEbola = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime.getTime()/1000.;
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

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 24, 0);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 8);

    var timeLocation = gl.getAttribLocation(this.program, "a_Deaths1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 12);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 16);

    var timeLocation = gl.getAttribLocation(this.program, "a_Deaths2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 20);

    var colorLoc = gl.getUniformLocation(this.program, 'u_Color');
    gl.uniform4fv(colorLoc, color);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Epoch');
    gl.uniform1f(sliderTime, currentTime);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Size');
    gl.uniform1f(sliderTime, pointSize);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawLodes = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable( gl.BLEND );
    gl.blendEquationSeparate( gl.FUNC_ADD, gl.FUNC_ADD );
    gl.blendFuncSeparate( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    var maxTime = options.currentTime/1000.;
    var pointSize = options.pointSize || (2.0 * window.devicePixelRatio);
    var filterDist = options.filter || false;
    var se01;
    var se02;
    var se03;
    var uDist = options.distance || 50000.;
    var step = 0.;
    var throttle = 1.0;
    if (typeof options.step != "undefined") {
        step = options.step
    }

    if (typeof options.throttle != "undefined") {
        throttle = options.throttle
    }

    if (typeof options.se01 != "undefined") {
      se01 = options.se01
    } else {
      se01 = true;
    }

    if (typeof options.se02 != "undefined") {
      se02 = options.se02
    } else {
      se02 = true;
    }

    if (typeof options.se03 != "undefined") {
      se03 = options.se03
    } else {
      se03 = true;
    }

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    //pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    pointSize = 2.0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);


    var uTime = gl.getUniformLocation(this.program, "uTime");
    gl.uniform1f(uTime, step);

    var sizeLoc = gl.getUniformLocation(this.program, 'uSize');
    gl.uniform1f(sizeLoc, pointSize);

    var zoomLoc = gl.getUniformLocation(this.program, 'uZoom');
    gl.uniform1f(zoomLoc, zoom);

    var filterDistLoc = gl.getUniformLocation(this.program, 'filterDist');
    gl.uniform1i(filterDistLoc, filterDist);

    var showSe01Loc = gl.getUniformLocation(this.program, 'showSe01');
    gl.uniform1i(showSe01Loc, se01);

    var showSe02Loc = gl.getUniformLocation(this.program, 'showSe02');
    gl.uniform1i(showSe02Loc, se02);

    var showSe03Loc = gl.getUniformLocation(this.program, 'showSe03');
    gl.uniform1i(showSe03Loc, se03);

    var matrixLoc = gl.getUniformLocation(this.program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var uDistLoc = gl.getUniformLocation(this.program, 'uDist');
    gl.uniform1f(uDistLoc, uDist*1000);

    var attributeLoc = gl.getAttribLocation(this.program, 'centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 4, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'aDist');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'aColor');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    gl.drawArrays(gl.POINTS, 0, Math.floor(this._pointCount*throttle));
    perf_draw_points(Math.floor(this._pointCount*throttle))
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawColorDotmap = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable( gl.BLEND );
    gl.blendEquationSeparate( gl.FUNC_ADD, gl.FUNC_ADD );
    gl.blendFuncSeparate( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var throttle = 1.0;
    if (typeof options.throttle != "undefined") {
        throttle = options.throttle
    }

    var pointSize = 2.0;
    gl.uniform1f(this.program.uSize, pointSize);

    gl.uniform1f(this.program.uZoom, zoom);

    gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

    gl.enableVertexAttribArray(this.program.aWorldCoord);
		gl.vertexAttribPointer(this.program.aWorldCoord, 4, gl.FLOAT, false, 12, 0);

    gl.enableVertexAttribArray(this.program.aColor);
    gl.vertexAttribPointer(this.program.aColor, 1, gl.FLOAT, false, 12, 8);

    gl.drawArrays(gl.POINTS, 0, Math.floor(this._pointCount*throttle));
    perf_draw_points(Math.floor(this._pointCount*throttle))
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawMonthlyRefugees = function(transform, options) {
  if (this._ready) {

    gl.useProgram(this.program);
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    var pointSize = options.pointSize || (1.0 * window.devicePixelRatio);;
    pointSize *= 4.0 * Math.pow(20 / 4, (options.zoom - 3) / (10 - 3));

    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var sizeLoc = gl.getUniformLocation(this.program, 'uSize');
    gl.uniform1f(sizeLoc, pointSize);

    var timeLoc = gl.getUniformLocation(this.program, 'uTotalTime');
    gl.uniform1f(timeLoc, 1296000);

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
    var matrixLoc = gl.getUniformLocation(this.program, 'uMapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var currentTime = options.currentTime;
    var epochLoc = gl.getUniformLocation(this.program, 'uEpoch');
    gl.uniform1f(epochLoc, currentTime/1000.);

    var attributeLoc = gl.getAttribLocation(this.program, 'aStartPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEndPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'aMidPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 40, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEpoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 24);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEndTime');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 28);

    var attributeLoc = gl.getAttribLocation(this.program, 'aSpan');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 32);

    var attributeLoc = gl.getAttribLocation(this.program, 'aTimeOffset');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 40, 36);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);

    gl.disable(gl.BLEND);
  }

}

WebGLVectorTile2.prototype._drawAnnualRefugees = function(transform, options) {
  var gl = this.gl;

  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable( gl.BLEND );
    //gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var subsampleAnnualRefugees = options.subsampleAnnualRefugees;
    var pointIdx = options.pointIdx || {};
    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    var pointSize = Math.floor( ((20-5) * (zoom - 0) / (21 - 0)) + 5 );
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }
    pointSize *= 2;
    var sizeLoc = gl.getUniformLocation(this.program, 'uSize');
    gl.uniform1f(sizeLoc, pointSize);

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
    var matrixLoc = gl.getUniformLocation(this.program, 'uMapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var currentTime = options.currentTime;
    var epochLoc = gl.getUniformLocation(this.program, 'uEpoch');
    gl.uniform1f(epochLoc, currentTime/1000.);

    var span = options.span;
    var spanLoc = gl.getUniformLocation(this.program, 'uSpan');
    gl.uniform1f(spanLoc, span/1000.);


    var attributeLoc = gl.getAttribLocation(this.program, 'aStartPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 28, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEndPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 28, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'aMidPoint');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 28, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'aEpoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 28, 24);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);

    if (subsampleAnnualRefugees) {
      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      perf_draw_points(this._pointCount);
    } else {
      var year = currentTime.getUTCFullYear();
      year = Math.min(year,2015);
      var count;
      if (year < 2001) {
        year = 2001;
      }
      if (year != 2015) {
        count = pointIdx[year]['count'] + pointIdx[year+1]['count'] * 0.75;
      } else {
        count = pointIdx[year]['count'];
      }
      gl.drawArrays(gl.POINTS, pointIdx[year]['start'], count);
      perf_draw_points(count);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
  }
}


WebGLVectorTile2.prototype._drawHealthImpact = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    var pointSize = Math.floor( ((20-5) * (zoom - 0) / (21 - 0)) + 5 );
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }
    var sizeLoc = gl.getUniformLocation(this.program, 'uSize');
    gl.uniform1f(sizeLoc, pointSize);

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var year = options.year;
    var delta = options.delta;
    var showRcp = options.showRcp;

    var deltaLoc = gl.getUniformLocation(this.program, 'u_Delta');
    gl.uniform1f(deltaLoc, delta);

    var epochLoc = gl.getUniformLocation(this.program, 'u_Year');
    gl.uniform1f(epochLoc, year);

    var rcpLoc = gl.getUniformLocation(this.program, 'u_ShowRcp2p6');
    gl.uniform1f(rcpLoc, showRcp[0]);

    var rcpLoc = gl.getUniformLocation(this.program, 'u_ShowRcp4p5');
    gl.uniform1f(rcpLoc, showRcp[1]);

    var rcpLoc = gl.getUniformLocation(this.program, 'u_ShowRcp6p0');
    gl.uniform1f(rcpLoc, showRcp[2]);

    var rcpLoc = gl.getUniformLocation(this.program, 'u_ShowRcp8p5');
    gl.uniform1f(rcpLoc, showRcp[3]);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Year');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Rcp');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);

    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawViirs = function(transform, options) {
  var gl = this.gl;
  var _minTime = new Date('2014-03-14').getTime();
  var _maxTime = new Date('2014-04-13').getTime();
  var _showTemp = false;
  var _minTemp = 400.;
  var _maxTemp = 3000.;

  var opts = options || {};
  var minTime = opts.minTime || _minTime;
  var maxTime = opts.maxTime || _maxTime;
  var showTemp = opts.showTemp || _showTemp;
  var minTemp = opts.minTemp || _minTemp;
  var maxTemp = opts.maxTemp || _maxTemp;
  var pointSize = opts.pointSize || (2.0 * window.devicePixelRatio);
  var zoom = options.zoom;

  if (options.currentTime) {
    maxTime = options.currentTime;
    minTime = maxTime - 30*24*60*60*1000;
  }

  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1);
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 16, 0);

    var timeLoc = gl.getAttribLocation(this.program, 'time');
    gl.enableVertexAttribArray(timeLoc);
    gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 16, 8);

    var tempLocation = gl.getAttribLocation(this.program, "temp");
    gl.enableVertexAttribArray(tempLocation);
    gl.vertexAttribPointer(tempLocation, 1, gl.FLOAT, false, 16, 12);

    var timeLoc = gl.getUniformLocation(this.program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime/1000.);

    var timeLoc = gl.getUniformLocation(this.program, 'minTime');
    gl.uniform1f(timeLoc, minTime/1000.);

    var showTempLoc = gl.getUniformLocation(this.program, 'showTemp');
    gl.uniform1f(showTempLoc, showTemp);

    var tempLoc = gl.getUniformLocation(this.program, 'minTemp');
    gl.uniform1f(tempLoc, minTemp*1.0);

    var tempLoc = gl.getUniformLocation(this.program, 'maxTemp');
    gl.uniform1f(tempLoc, maxTemp*1.0);

    var pointSizeLoc = gl.getUniformLocation(this.program, 'pointSize');
    gl.uniform1f(pointSizeLoc, pointSize);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawUrbanFragility = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var zoom = options.zoom;

    var pointSize;
    pointSize = Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1);
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var sizeLoc = gl.getUniformLocation(this.program, 'u_Size');
    gl.uniform1f(sizeLoc, pointSize);

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var year = options.year;
    var delta = options.delta;

    var deltaLoc = gl.getUniformLocation(this.program, 'u_Delta');
    gl.uniform1f(deltaLoc, delta);

    var epochLoc = gl.getUniformLocation(this.program, 'u_Year');
    gl.uniform1f(epochLoc, year);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 20, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Year');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 16);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);

    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawObesity = function(transform, options) {
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);

    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    var year = options.year;
    var delta = options.delta;

    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var deltaLoc = gl.getUniformLocation(this.program, 'u_Delta');
    gl.uniform1f(deltaLoc, delta);

    var epochLoc = gl.getUniformLocation(this.program, 'u_Year');
    gl.uniform1f(epochLoc, year);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Vertex');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 20, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Year');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 20, 16);


    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
    perf_draw_triangles(this._pointCount);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);

  }
}

WebGLVectorTile2.prototype._drawVaccineConfidence = function(transform, options) {
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);

    translateMatrix(tileTransform, (this._bounds.max.x - this._bounds.min.x)/256., (this._bounds.max.y - this._bounds.min.y)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var val = options.question || 1.0;

    var valLoc = gl.getUniformLocation(this.program, 'u_Val');
    gl.uniform1f(valLoc, val);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Vertex');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 24, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val3');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Val4');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 24, 20);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
    perf_draw_triangles(this._pointCount);
    gl.bindTexture(gl.TEXTURE_2D, null);
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

WebGLVectorTile2.lodesVertexShader =
  'attribute vec4 centroid;\n' +
  'attribute float aDist;\n' +
  'attribute float aColor;\n' +
  'uniform bool filterDist;\n' +
  'uniform bool showSe01;\n' +
  'uniform bool showSe02;\n' +
  'uniform bool showSe03;\n' +
  'uniform float uDist;\n' +
  'uniform float uSize;\n' +
  'uniform float uTime;\n' +
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
  '  float fx = fX(centroid.z, centroid.x - centroid.z, uTime);\n' +
  '  float fy = fY(centroid.w, centroid.y - centroid.w, uTime);\n' +
  '  vec4 position = mapMatrix * vec4(fx, fy, 0, 1);\n' +
  '  if (filterDist && aDist >= uDist) {\n' +
  '    position = vec4(-1.,-1.,-1.,-1.);\n' +
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

WebGLVectorTile2.lodesFragmentShader =
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
  '  gl_FragColor = vec4(unpackColor(vColor),.75);\n' +
  '}\n';

WebGLVectorTile2.colorDotmapVertexShader =
  'attribute vec2 aWorldCoord;\n' +
  'attribute float aColor;\n' +
  'uniform float uZoom;\n' +
  'uniform float uSize;\n' +
  'uniform mat4 mapMatrix;\n' +
  'varying float vColor;\n' +
  'void main() {\n' +
  '  //gl_Position = mapMatrix * vec4(aWorldCoord.x, aWorldCoord.y, 0, 1);\n' +
  '  //gl_Position = vec4(300.0*(aWorldCoord.x+mapMatrix[3][0]), 300.0*(-aWorldCoord.y+mapMatrix[3][1]), 0.0, 300.0);\n' +
  '  gl_Position = vec4(aWorldCoord.x * mapMatrix[0][0] + mapMatrix[3][0], aWorldCoord.y * mapMatrix[1][1] + mapMatrix[3][1],0,1);\n' +
  '  //gl_PointSize = uSize;\n' +
  '  gl_PointSize = 1.5;\n' +
  '  vColor = aColor;\n' +
  '}\n';

WebGLVectorTile2.colorDotmapFragmentShader =
  'precision lowp float;\n' +
  'varying float vColor;\n' +
  'vec3 unpackColor(float f) {\n' +
  '  vec3 color;\n' +
  '  color.b = floor(f / 256.0 / 256.0);\n' +
  '  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
  '  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
  '  return color / 256.0;\n' +
  '}\n' +
  'void main() {\n' +
  '  gl_FragColor = vec4(unpackColor(vColor),1.0);\n' +
  '  //gl_FragColor = vec4(0.0,1.0,0.0,1.0);\n' +
  '}\n';

WebGLVectorTile2.annualRefugeesFragmentShader =
'      precision mediump float;\n' +
'      uniform sampler2D u_Image;\n' +
'      varying float v_Delta;\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          gl_FragColor = vec4(1., 0., 0., 1.) * dist;\n' +
'          vec4 color = texture2D(u_Image, vec2(v_Delta,v_Delta));\n' +
'          gl_FragColor = vec4(color.r, color.g, color.b, 1.) * dist;\n' +
'      }\n';

WebGLVectorTile2.annualRefugeesVertexShader =
'      attribute vec4 aStartPoint;\n' +
'      attribute vec4 aEndPoint;\n' +
'      attribute vec4 aMidPoint;\n' +
'      attribute float aEpoch;\n' +
'      uniform float uSize;\n' +
'      uniform float uEpoch;\n' +
'      uniform float uSpan;\n' +
'      uniform mat4 uMapMatrix;\n' +
'      varying float v_Delta;\n' +
'      vec4 bezierCurve(float t, vec4 P0, vec4 P1, vec4 P2) {\n' +
'        return (1.0-t)*(1.0-t)*P0 + 2.0*(1.0-t)*t*P1 + t*t*P2;\n' +
'      }\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (aEpoch < uEpoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else if (aEpoch > uEpoch + uSpan) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          float t = (uEpoch - aEpoch)/uSpan;\n' +
'          v_Delta = 1.0 - (aEpoch - uEpoch)/uSpan;\n' +
'          vec4 pos = bezierCurve(1.0 + t, aStartPoint, aMidPoint, aEndPoint);\n' +
'          position = uMapMatrix * vec4(pos.x, pos.y, 0, 1);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        gl_PointSize = uSize * 4.0;\n' +
'        gl_PointSize = 4.0;\n' +
'      }\n';

WebGLVectorTile2.healthImpactVertexShader =
'      attribute vec4 a_Centroid;\n' +
'      attribute float a_Year;\n' +
'      attribute float a_Val1;\n' +
'      attribute float a_Val2;\n' +
'      attribute float a_Rcp;\n' +
'      uniform bool u_ShowRcp2p6;\n' +
'      uniform bool u_ShowRcp4p5;\n' +
'      uniform bool u_ShowRcp6p0;\n' +
'      uniform bool u_ShowRcp8p5;\n' +
'      uniform float u_Delta;\n' +
'      uniform float u_Size;\n' +
'      uniform float u_Year;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_Val;\n' +
'      varying float v_Rcp;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_Year != u_Year) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          if (u_ShowRcp2p6 && a_Rcp == 0.0) {\n' +
'            position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'          } else if (u_ShowRcp4p5 && a_Rcp == 1.0) {\n' +
'            position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'          } else if (u_ShowRcp6p0 && a_Rcp == 2.0) {\n' +
'            position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'          }  else if (u_ShowRcp8p5 && a_Rcp == 3.0) {\n' +
'            position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'          }\n' +
'          else {\n' +
'            position = vec4(-1,-1,-1,-1);\n' +
'          }\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        float size = (a_Val2 - a_Val1) * u_Delta + a_Val1;\n' +
'        v_Val = size;\n' +
'        v_Rcp = a_Rcp;\n' +
'        gl_PointSize = u_Size * abs(size);\n' +
'        gl_PointSize = 2.0 * abs(size);\n' +
'      }\n';

WebGLVectorTile2.healthImpactFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      varying float v_Val;\n' +
'      varying float v_Rcp;\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          vec4 circleColor = vec4(1.0,0.0,0.0,1.0);\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          if (v_Val > 0.0) {\n' +
'            if (v_Rcp == 0.0) {\n' +
'              circleColor = vec4(0.0, 0.0, 1.0, .65) * alpha;\n' +
'            } else if (v_Rcp == 1.0){\n' +
'              circleColor = vec4(0.0078, 0.0, 0.8392, .65) * alpha;\n' +
'            } else if (v_Rcp == 2.0) {\n' +
'              circleColor = vec4(0.0078, 0.0, 0.6941, .65) * alpha;\n' +
'            } else {\n' +
'              circleColor = vec4(0., 0., .5451, .65) * alpha;\n' +
'            }\n' +
'          } else {\n' +
'            if (v_Rcp == 0.0) {\n' +
'              circleColor = vec4(1.0, 0.0, 0.0, .65) * alpha;\n' +
'            } else if (v_Rcp == 1.0){\n' +
'              circleColor = vec4(0.8392, 0.0, 0.0078, .65) * alpha;\n' +
'            } else if (v_Rcp == 2.0) {\n' +
'              circleColor = vec4(0.6941, 0.0, 0.0078, .65) * alpha;\n' +
'            } else {\n' +
'              circleColor = vec4(.5451, 0., 0., .65) * alpha;\n' +
'            }\n' +
'          }\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +
'      }';

WebGLVectorTile2.viirsVertexShader =
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

WebGLVectorTile2.viirsFragmentShader =
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

WebGLVectorTile2.wdpaVertexShader =
'attribute vec4 worldCoord;\n' +
'attribute float time;\n' +

'uniform mat4 mapMatrix;\n' +
'uniform float maxTime;\n' +
'uniform float minTime;\n' +

'void main() {\n' +
'  if (time < minTime || time > maxTime) {\n' +
'    gl_Position = vec4(-1,-1,-1,-1);\n' +
'  } else {\n' +
'    gl_Position = mapMatrix * worldCoord;\n' +
'  }\n' +
'}';

WebGLVectorTile2.wdpaFragmentShader =
'void main() {\n' +
'  gl_FragColor = vec4(.0, 1., .15, 1.0);\n' +
'}\n';

WebGLVectorTile2.urbanFragilityVertexShader =
'attribute vec4 a_Centroid;\n' +
'attribute float a_Year;\n' +
'attribute float a_Val1;\n' +
'attribute float a_Val2;\n' +
'uniform float u_Delta;\n' +
'uniform float u_Size;\n' +
'uniform float u_Year;\n' +
'uniform mat4 u_MapMatrix;\n' +
'varying float v_Val;\n' +
'\n' +
'void main() {\n' +
'  vec4 position;\n' +
'  if (a_Year != u_Year) {\n' +
'    position = vec4(-1,-1,-1,-1);\n' +
'  } else {\n' +
'    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'  }\n' +
'  gl_Position = position;\n' +
'  float size = (a_Val2 - a_Val1) * u_Delta + a_Val1;\n' +
'  v_Val = size;\n' +
'  gl_PointSize = u_Size * exp(size);\n' +
'}\n';

WebGLVectorTile2.urbanFragilityFragmentShader =
'precision mediump float;\n' +
'uniform sampler2D u_Image;\n' +
'varying float v_Val;\n' +
'float scale(float val) {\n' +
'  float min = 1.;\n' +
'  float max = 3.5;\n' +
'  return (val - min)/(max -min);\n' +
'}\n' +
'void main() {\n' +
'  float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'  dist = 1. - (dist * 2.);\n' +
'  dist = max(0., dist);\n' +
'  float alpha = smoothstep(0.3-dist, 0.3, dist);\n' +
'  vec4 color = texture2D(u_Image, vec2(scale(v_Val),scale(v_Val)));\n' +
'  gl_FragColor = vec4(color.r, color.g, color.b, .75) * alpha;\n' +
'}\n';

WebGLVectorTile2.monthlyRefugeesVertexShader =
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

WebGLVectorTile2.monthlyRefugeesFragmentShader =
    "precision mediump float;\n" +
    "varying vec4 vColor;\n" +

    "void main() {\n" +
        "float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n" +
        "dist = 1. - (dist * 2.);\n" +
        "dist = max(0., dist);\n" +
        "gl_FragColor = vColor * dist;\n" +
    "}";

WebGLVectorTile2.gtdVertexShader =
"        attribute vec4 a_WorldCoord;\n" +
"        attribute float a_Epoch;\n" +
"        attribute float a_NCasualties;\n" +
"        uniform float u_EpochTime;\n" +
"        uniform float u_Span;\n" +
"        uniform mat4 u_MapMatrix;\n" +
"        varying float v_Alpha;\n" +
"        void main() {\n" +
"          if ( a_Epoch > u_EpochTime) {\n" +
"            gl_Position = vec4(-1,-1,-1,-1);\n" +
"          } else if (u_EpochTime - a_Epoch > u_Span) {\n" +
"            gl_Position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"          else {\n" +
"            gl_Position = u_MapMatrix * a_WorldCoord;\n" +
"          }\n" +
"          v_Alpha = (u_EpochTime - a_Epoch) / u_Span;\n" +
"          gl_PointSize = 1.0 * a_NCasualties;\n" +
"        }\n";

WebGLVectorTile2.gtdFragmentShader =
"        precision mediump float;\n" +
"        varying float v_Alpha;\n" +
"        void main() {\n" +
"          float r = 1.0 - v_Alpha;\n" +
"          float dist = distance( vec2(0.5, 0.5), gl_PointCoord);\n" +
"          dist = 1.0 - (dist * 2.0);\n" +
"          dist = max(0.0, dist);\n" +
"          gl_FragColor =  vec4(r, .0, .0, .85) * dist;\n" +
"        }\n";


WebGLVectorTile2.hivVertexShader =
'attribute vec4 a_Centroid;\n' +
'attribute float a_Year;\n' +
'attribute float a_Val1;\n' +
'attribute float a_Val2;\n' +
'uniform float u_Delta;\n' +
'uniform float u_Size;\n' +
'uniform float u_Year;\n' +
'uniform mat4 u_MapMatrix;\n' +
'varying float v_Val;\n' +
'\n' +
'void main() {\n' +
'  vec4 position;\n' +
'  if (a_Year != u_Year) {\n' +
'    position = vec4(-1,-1,-1,-1);\n' +
'  } else {\n' +
'    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'  }\n' +
'  gl_Position = position;\n' +
'  float size = (a_Val2 - a_Val1) * u_Delta + a_Val1;\n' +
'  v_Val = size;\n' +
'  gl_PointSize = 100.0 * u_Size * abs(size);\n' +
'}\n';

WebGLVectorTile2.hivFragmentShader =
'precision mediump float;\n' +
'uniform sampler2D u_Image;\n' +
'varying float v_Val;\n' +
'void main() {\n' +
'  float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'  dist = 1. - (dist * 2.);\n' +
'  dist = max(0., dist);\n' +
'  float alpha = smoothstep(0.3-dist, 0.3, dist);\n' +
'  vec4 color = texture2D(u_Image, vec2(v_Val,v_Val));\n' +
'  gl_FragColor = vec4(color.r, color.g, color.b, .75) * alpha;\n' +
'}\n';

WebGLVectorTile2.obesityVertexShader =
'      attribute vec4 a_Vertex;\n' +
'      attribute float a_Year;\n' +
'      attribute float a_Val1;\n' +
'      attribute float a_Val2;\n' +
'      uniform float u_Delta;\n' +
'      uniform float u_Size;\n' +
'      uniform float u_Year;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_Year != u_Year) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          position = u_MapMatrix * vec4(a_Vertex.x, a_Vertex.y, 0, 1);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        v_Val = (a_Val2 - a_Val1) * u_Delta + a_Val1;\n' +
'      }\n';

WebGLVectorTile2.obesityFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      uniform sampler2D u_Image;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 color = texture2D(u_Image, vec2(v_Val,v_Val));\n' +
'        gl_FragColor = vec4(color.r, color.g, color.b, 1.);\n' +
'      }\n';

WebGLVectorTile2.vaccineConfidenceVertexShader =
'      attribute vec4 a_Vertex;\n' +
'      attribute float a_Val1;\n' +
'      attribute float a_Val2;\n' +
'      attribute float a_Val3;\n' +
'      attribute float a_Val4;\n' +
'      uniform float u_Val;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        position = u_MapMatrix * vec4(a_Vertex.x, a_Vertex.y, 0, 1);\n' +
'        gl_Position = position;\n' +
'        if (u_Val == 1.0) {\n' +
'          v_Val = a_Val1;\n' +
'        }\n' +
'        if (u_Val == 2.0) {\n' +
'          v_Val = a_Val2;\n' +
'        }\n' +
'        if (u_Val == 3.0) {\n' +
'          v_Val = a_Val3;\n' +
'        }\n' +
'        if (u_Val == 4.0) {\n' +
'          v_Val = a_Val4;\n' +
'        }\n' +
'      }\n';

WebGLVectorTile2.vaccineConfidenceFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      uniform sampler2D u_Image;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 color = texture2D(u_Image, vec2(v_Val,v_Val));\n' +
'        gl_FragColor = vec4(color.r, color.g, color.b, 1.);\n' +
'      }\n';

WebGLVectorTile2.ebolaVertexShader =
'      attribute vec4 a_Centroid;\n' +
'      attribute float a_Epoch1;\n' +
'      attribute float a_Deaths1;\n' +
'      attribute float a_Epoch2;\n' +
'      attribute float a_Deaths2;\n' +
'      uniform float u_Epoch;\n' +
'      uniform float u_Size;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'        }\n' +
'          //position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +

'        gl_Position = position;\n' +
'        float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);\n' +
'        float size = (a_Deaths2 - a_Deaths1) * delta + a_Deaths1;\n' +
'        gl_PointSize = u_Size * size;\n' +
'      }\n';

WebGLVectorTile2.ebolaFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      varying float v_Val;\n' +
'      uniform vec4 u_Color;\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          vec4 circleColor = u_Color;\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +
'      }';
