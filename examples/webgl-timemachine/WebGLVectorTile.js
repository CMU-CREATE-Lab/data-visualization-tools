function WebGLVectorTile(url, glb) {
    this.url = url;
    this.ready = false;
    this.program = glb.programFromSources(Glb.vectorTileVertexShader,
                                               Glb.vectorTileFragmentShader);
    this.load();
}

WebGLVectorTile.prototype.load = function() {
  var that = this;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', that.url);
  xhr.onload = function() {
    that.json = JSON.parse(this.responseText);
    that.setData();
  }
  xhr.send();
}

WebGLVectorTile.prototype.setData = function() {
  var pointCount = 0;
  var points = [];
  var dates = [];

  function multiLineString(coordinates, date) {
    for (var j = 0; j < coordinates.length; j++) {
      var line = coordinates[j];
      lineString(line, date);
    }
  }

  function lineString(coordinates, date)  {
    if (date == 0) {
      date = 1984;
    }

    for (var j = 0; j < coordinates.length; j++) {
      var point = coordinates[j];
      var pixel = LatLongToPixelXY(point[1], point[0]);
      var scale = 1335834 / 256;
      points.push(pixel.x*scale);
      pointCount++;
      points.push(pixel.y*scale);
      pointCount++;
      dates.push(Date.parse(date));
      if (j != 0 && j != coordinates.length - 1) {
        points.push(pixel.x*scale);
        pointCount++;
        points.push(pixel.y*scale);
        pointCount++;
        dates.push(Date.parse(date));
      }
    }

  }

  for (var i = 0; i < this.json.features.length; i++) {
    var properties = this.json.features[i].properties;
    var geometry = this.json.features[i].geometry;

    // FIXME: Handle IDL correctly
    if (properties.gid != 34014 && properties.gid != 33963) {
      if (geometry.type == "LineString") {
        lineString(geometry.coordinates, properties.status_yr);
      }
      if (geometry.type == "MultiLineString") {
        multiLineString(geometry.coordinates, properties.status_yr);
      }
    }
  }

  this.data = new Float32Array(pointCount);
  for (var i = 0; i < pointCount; i++) {
    this.data[i] = points[i];
  }
  this.pointCount = pointCount / 2;

  this.timeData = new Float32Array(this.pointCount);
  for (var i = 0; i < this.pointCount; i++) {
    this.timeData[i] = dates[i];
  }

  this.arrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 0, 0);


  this.timeArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.timeArrayBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this.timeData, gl.STATIC_DRAW);

  var attributeLoc = gl.getAttribLocation(this.program, 'time');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 0, 0);


  this.ready = true;
}

WebGLVectorTile.prototype.draw = function(transform, maxTime, minTime) {
  if (this.ready) {
    gl.useProgram(this.program);

    var matrixLoc = gl.getUniformLocation(this.program, 'mapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, transform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'worldCoord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.timeArrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'time');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 0, 0);

    var timeLoc = gl.getUniformLocation(this.program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime*1.0);

    var timeLoc = gl.getUniformLocation(this.program, 'minTime');
    gl.uniform1f(timeLoc, minTime*1.0);

    gl.drawArrays(gl.LINES, 0, this.pointCount);
  }
}



function VectorTileIdx(l, c, r) {
  this.l = l;
  this.c = c;
  this.r = r;
  this.key = ('00' + l).substr(-3) + ('00000' + r).substr(-6) + ('00000' + c).substr(-6);
}

VectorTileIdx.prototype.parent = function() {
  if (this.l > 0) {
    return new TileIdx(this.l - 1, this.c >> 1, this.r >> 1);
  } else {
    return null;
  }
};

VectorTileIdx.prototype.toString = function() {
  return this.l + ',' + this.c + ',' + this.r;
}

function VectorTileView(settings) {
  this._panoWidth = settings.panoWidth;
  this._panoHeight = settings.panoHeight;
  this._tileWidth = settings.tileWidth;
  this._tileHeight = settings.tileHeight;
  this.glb = settings.glb;

  this.levelThreshold = 1.;

  // Compute max level #
  for (this._maxLevel = 1;
       (this._tileWidth << this._maxLevel) < this._panoWidth ||
       (this._tileHeight << this._maxLevel) < this._panoHeight;
       this._maxLevel++) {
  }
  console.log(this.toString());
}

VectorTileView.prototype._scale2level = function(scale) {
  // Minimum level is 0, which has one tile
  // Maximum level is maxLevel, which is displayed 1:1 at scale=1
  var idealLevel = Math.log(scale) / Math.log(2) + this._maxLevel;
  var selectedLevel = Math.floor(idealLevel + this.levelThreshold);
  selectedLevel = Math.max(selectedLevel, 0);
  selectedLevel = Math.min(selectedLevel, this._maxLevel);
  return selectedLevel;
};

VectorTileView.prototype._computeBoundingBox = function(view) {
  var halfWidth = .5 * this._viewportWidth / view.scale;
  var halfHeight = .5 * this._viewportHeight / view.scale;
  return {
    xmin: view.x - halfWidth,
    xmax: view.x + halfWidth,
    ymin: view.y - halfHeight,
    ymax: view.y + halfHeight
  };
};


VectorTileView.prototype._tileidxAt = function(level, x, y) {
  var ret = new VectorTileIdx(
    level,
    Math.floor(x / (this._tileWidth << (this._maxLevel - level))),
    Math.floor(y / (this._tileHeight << (this._maxLevel - level))));
  return ret;
};

VectorTileView.prototype._tileidxCenter = function(ti) {
  var levelShift = this._maxLevel - ti.l;
  return {
    x: (ti.c + .5) * (this._tileWidth << levelShift),
    y: (ti.r + .5) * (this._tileHeight << levelShift)
  };
};

VectorTileView.prototype._computeVisibleTileRange = function(view, level) {
  var bbox = this._computeBoundingBox(view);
  var tilemin = this._tileidxAt(level, Math.max(0, bbox.xmin), Math.max(0, bbox.ymin));
  var tilemax = this._tileidxAt(level, Math.min(this._panoWidth - 1, bbox.xmax),
                                Math.min(this._panoHeight - 1, bbox.ymax));
  return {min: tilemin, max: tilemax}
}

VectorTileView.prototype.setView = function(view, viewportWidth, viewportHeight, scale) {

  function loc2Tiles (loc, zoom){
    return [(Math.floor((loc.lng+180)/360*Math.pow(2,zoom))), (Math.floor((1-Math.log(Math.tan(loc.lat*Math.PI/180) + 1/Math.cos(loc.lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)))];
  }

  this._viewportWidth = viewportWidth;
  this._viewportHeight = viewportHeight;
  this._scale = scale; // canvas scale (1 for normal, 2 for retina, typically)

  // Require tiles in view from optimal level of detail
  var level = this._scale2level(view.scale * this._scale);
  var visibleRange = this._computeVisibleTileRange(view, level);

  var bBox = timelapse.getBoundingBoxForCurrentView();
  var latLngBbox = timelapse.pixelBoundingBoxToLatLngBoundingBoxView(bBox).bbox;

  var ne = {lat: latLngBbox.sw.lat, lng: latLngBbox.ne.lng};
  var sw = {lat: latLngBbox.ne.lat, lng: latLngBbox.sw.lng};

  var zoom = level;

  if (zoom > zoomlock) {
    zoom = zoomlock;
  }
  
  var bottomLeft = loc2Tiles(ne, zoom);
  var topRight = loc2Tiles(sw, zoom);

  for(var row = bottomLeft[0]; row <= topRight[0]; row++){
    for(var col = topRight[1]; col <= bottomLeft[1]; col++){
      var url = tilebase + zoom + '/'+row+'/' + col + '.json';
      if (typeof tilecache[url] == 'undefined') {
        tilecache[url] = new WebGLVectorTile(url, this.glb);
      }
      currenttiles.push(tilecache[url]);
    }
  }
}

VectorTileView.prototype.draw = function(view, canvasLayer) {
  var width = canvasLayer.canvas.width / canvasLayer.scale;
  var height = canvasLayer.canvas.height / canvasLayer.scale;

  var transform = new Float32Array([2/width,0,0,0, 0,-2/height,0,0, 0,0,0,0, -1,1,0,1]);

  translateMatrix(transform, width*0.5, height*0.5);

  // Scale to current zoom (worldCoords * 2^zoom)
  scaleMatrix(transform,
              view.scale/* * this._canvasLayer.scale*/,
              view.scale/* * this._canvasLayer.scale*/);

  // translate to current view (vector from topLeft to 0,0)
  translateMatrix(transform, -view.x, -view.y);

  var length = currenttiles.length;
  for (var i = 0; i < length; i++) {
    var tile = currenttiles.pop();
    var minDate = new Date('1800').getTime();
    var maxDate = new Date('2015').getTime();
    if (animateWdpa) {
      maxDate = new Date(timelapse.getCurrentCaptureTime());
    }
    tile.draw(transform, maxDate, minDate);
  }

}

var tilecache = {};
var currenttiles = [];

var zoomlock = 8;
var tilebase = 'wdpaline-year/';

var vectorTileView;

var showWdpa = false;
var animateWdpa = false;

function initVectorLayersCheckBoxes() {
  var $showWdpa = $("#show-wdpa");
  $showWdpa.on("click", function() {
    var $this = $(this);
    if ($this.is(':checked')) {
      showWdpa = true;
    } else {
      showWdpa = false;
    }
  });
  var $animateWdpa = $("#animate-wdpa");
  $animateWdpa.on("click", function() {
    var $this = $(this);
    if ($this.is(':checked')) {
      animateWdpa = true;
    } else {
      animateWdpa = false;
    }
  });
}
