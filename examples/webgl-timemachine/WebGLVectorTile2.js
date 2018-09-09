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
  this._setData = opt_options.setDataFunction || this._setBufferData;
  this._load = opt_options.loadDataFunction || this._loadData;
  this._dataLoaded = opt_options.dataLoadedFunction || this._defaultDataLoaded;
  this.draw = opt_options.drawFunction || this._drawLines;
  this.fragmentShader = opt_options.fragmentShader || WebGLVectorTile2.vectorTileFragmentShader;
  this.vertexShader = opt_options.vertexShader || WebGLVectorTile2.vectorTileVertexShader;
  this.externalGeojson = opt_options.externalGeojson;
  this.nameKey = opt_options.nameKey;
  this.numAttributes = opt_options.numAttributes;
  this._noValue = opt_options.noValue || 'xxx';
  this._uncertainValue = opt_options.uncertainValue || '. .';
  this._layerDomId = opt_options.layerDomId;
  this._loadingSpinnerTimer = null;
  this._wasPlayingBeforeDataLoad = false;
  this.dotmapColors = opt_options.dotmapColors;

  this.gl.getExtension("OES_standard_derivatives");

  this.program = glb.programFromSources(this.vertexShader, this.fragmentShader);


  if (opt_options.imageSrc) {
    this._image = new Image();
    this._image.crossOrigin = "anonymous";
    this._image.src = opt_options.imageSrc;
    var that = this;
    this._image.onload = function() {
      if (typeof(that.externalGeojson) != "undefined" && that.externalGeojson != "") {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', that.externalGeojson);
        xhr.onload = function() {
          var t0 = performance.now();
          that.geojsonData = JSON.parse(this.responseText);
          if (typeof that.nameKey != "undefined") {

          var t1 = performance.now();
          console.log("Parsing GeoJSON took " + (t1 - t0) + "ms");
          var hash = {};
          var t0 = performance.now();
          for (var i = 0; i < that.geojsonData["features"].length; i++) {
            hash[that.geojsonData["features"][i]["properties"][that.nameKey]] = i;
          }
          var t1 = performance.now();
          console.log("Indexing GeoJSON took " + (t1 - t0) + "ms");
          that.geojsonData["hash"] = hash;
          }
          that._load();
        };
        xhr.send();
      } else {
        that.geojsonData = null;
        that._load();
      }
    }
  } else if (typeof(this.externalGeojson) != "undefined" && this.externalGeojson != "") {
    var that = this;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', that.externalGeojson);
    xhr.onload = function() {
      that.geojsonData = JSON.parse(this.responseText);
      //console.log(that.geojsonData);
      that._load();
    };
    xhr.send();
  } else {
    this._load();
  }

  if (opt_options.scalingFunction) {
    this.scalingFunction = opt_options.scalingFunction;
  }

  if (opt_options.colorScalingFunction) {
    this.colorScalingFunction = opt_options.colorScalingFunction;
  }

//  if (opt_options.geojsonData) {
//    this.geojsonData = opt_options.geojsonData;
//  }

  if (opt_options.layerId) {
    this.layerId = opt_options.layerId;
  }
}

WebGLVectorTile2.errorsAlreadyShown = {};
WebGLVectorTile2.errorDialog = null;

WebGLVectorTile2.prototype._showErrorOnce = function(msg) {
  var tileUrl = this._url;
  if (!WebGLVectorTile2.errorsAlreadyShown[msg]) {
    WebGLVectorTile2.errorsAlreadyShown[msg] = true;

    //console.log(tileUrl);
    //console.log(msg);

    if (!WebGLVectorTile2.errorDialog) {
      WebGLVectorTile2.errorDialog = $(document.createElement('div'));
    }
    WebGLVectorTile2.errorDialog.html(msg).attr('title', 'Layer error');
    WebGLVectorTile2.errorDialog.find('a').map(function () {
      if ($(this).attr('href').indexOf('//') == -1) {
        // Base links on tile URL, not page URL
        $(this).attr('href', tileUrl + $(this).attr('href'));
      }
      $(this).attr('target', '_blank');
    });
    WebGLVectorTile2.errorDialog.dialog({
      buttons : { Ok: function() { $(this).dialog("close") } },
      open: function() { $(this).find(':link').blur(); }
    });
  }
}

WebGLVectorTile2.prototype._defaultDataLoaded = function() {
  // Default tile loaded function
}

WebGLVectorTile2.prototype._loadData = function() {
  var that = this;
  var float32Array;

  this.startTime = new Date().getTime();

  this._handleLoading();

  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);
  this.xhr.responseType = 'arraybuffer';

  this.xhr.onload = function() {
    that._removeLoadingSpinner();

    if (this.status == 404) {
      float32Array = new Float32Array([]);
    } else if (this.status == 400) {
      var msg = String.fromCharCode.apply(null, new Uint8Array(this.response));
      msg = msg.replace(/<h.*?>.*?<\/h.*?>/, '');  // Remove first header, which is status code
      that._showErrorOnce(msg);
      float32Array = new Float32Array([]);
    } else {
      float32Array = new Float32Array(this.response);
      perf_receive(float32Array.length * 4, new Date().getTime() - that.startTime);
    }
    that._setData(float32Array);
    if (that.layerId) {
      that._dataLoaded(that.layerId);
    }
  }
  this.xhr.onerror = function() {
    that._removeLoadingSpinner();

    that._setData(new Float32Array([]));
  }

  this.xhr.onabort = function() {
    that._removeLoadingSpinner();
  }
  this.xhr.send();
}

WebGLVectorTile2.prototype._loadGeojsonData = function() {
  var that = this;
  var data;

  this._handleLoading();

  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);

  this.xhr.onload = function() {
    that._removeLoadingSpinner();

    if (this.status == 404) {
      data = "";
    } else {
      data = JSON.parse(this.responseText);
    }
    that._setData(data);
  }
  this.xhr.onerror = function() {
    that._removeLoadingSpinner();

    that._setData('');
  }
  this.xhr.send();
}

WebGLVectorTile2.prototype._loadSitc4r2Data = function () {
  var parseQueryString = function( queryString ) {
      var params = {}, queries, temp, i, l;
      // Split into key/value pairs
      queries = queryString.split("&");
      // Convert the array of strings into an object
      for ( i = 0, l = queries.length; i < l; i++ ) {
          temp = queries[i].split('=');
          params[temp[0]] = temp[1];
      }
      return params;
  };

  var re=/([0-9]{1,})\/([0-9]{4}).json/g;
  var myArray = re.exec(this._url);
  //console.log(this._url);
  this._sitc4r2Code = myArray[1].toString();

  var queryString = undefined;
  this._exporters = [];
  this._importers = [];
  this._scale = 10000.;

  var parts = this._url.split("?");
  if (parts.length > 1) {
    queryString = parts[1];
    var qsa = parseQueryString(queryString);
    this._exporters = typeof qsa['exporters'] == "undefined" || qsa['exporters'] == "" ? [] : qsa['exporters'].split(",");
    this._importers = typeof qsa['importers'] == "undefined"  || qsa['importers'] == "" ? [] : qsa['importers'].split(",");
    if (typeof qsa['scale'] != "undefined") {
      this._scale =  parseFloat(qsa['scale']);
    }
  }

  this.buffers = {};
  var that = this;
  if  (typeof this.worker == "undefined") {
    this.worker = new Worker('sitc4r2-worker.js');
    this.worker.onmessage = function(e) {
      if (typeof e.data["year"] != "undefined") {
        var year = e.data.year;
        var code = e.data.code;
        var scale = e.data.scale;
        var array = e.data["array"];
        that._setSitc4r2Buffer(code, year, new Float32Array(array));
      }
    };
  }
  this._ready = true;
  var layerId = this._layerDomId.split('-')[2];
  this.layerId = layerId;
  this._dataLoaded(layerId);

}

WebGLVectorTile2.prototype._loadBivalentBubbleMapDataFromCsv = function() {
  var that = this;
  var data;

  this._maxPointValue = null;
  this._minPointValue = null;

  this._maxColorValue = null;
  this._minColorValue = null;

  var proj = new org.gigapan.timelapse.MercatorProjection(
    -180, 85.05112877980659, 180, -85.05112877980659,
    256, 256);


  function scaleValues(fnc, arr) {
    var ret = [];
    arr.forEach(function(x) {
      var scaled = [];
      x.forEach(function(y) {
        scaled.push(fnc(y));
      });
      ret.push(scaled);
    });
    return ret;
  }

  function setMinMaxPointValue(arr) {
    arr.forEach(function(xx) {
      var x = Math.abs(xx);
      if (that._maxPointValue == null || that._maxPointValue < x) {
        that._maxPointValue = x;
      }
      if (that._minPointValue == null || that._minPointValue > x) {
        that._minPointValue = x;
      }
    });
  }

  function setMinMaxColorValue(arr) {
    arr.forEach(function(xx) {
      var x = Math.abs(xx);
      if (that._maxColorValue == null || that._maxColorValue < x) {
        that._maxColorValue = x;
      }
      if (that._minColorValue == null || that._minColorValue > x) {
        that._minColorValue = x;
      }
    });
  }

  function setRow(arr) {
    var ret = [];
    var lastValue = 0.0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] != "") {
        ret.push(parseFloat(arr[i]));
        lastValue = parseFloat(arr[i]);
      } else {
        ret.push(lastValue);
      }
    }
    ret.push(lastValue);
    ret.push(lastValue);
    return ret;
  }

  function duplicateRow(offset, arr) {
    var dup = [];
    arr.slice(offset).forEach(function(x) {
      var x1 = x;
      dup.push(x1,x);
    });
    return dup.slice(1,-1);
  }

  function getCentroidFromCsvData(row) {
    var latlng = {lat:row[1], lng:row[2]};
    var xy = proj.latlngToPoint(latlng);
    return [xy.x, xy.y];
  }

  function getEpochs(offset, arr) {
    var ret = [];
    for (var i = offset; i < arr.length; i++) {
      var date = arr[i];
      // Date can be YYYY or YYYYMM or YYYYMMDD or YYYYMMDDHHMM or YYYYMMDDHHMMSS
      var yyyymmddhhmmss_re = /(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?$/;
      var m = date.match(yyyymmddhhmmss_re);
      if (!m) {
        console.log('Cannot parse date ' + date);
        break;
      }
      var to_parse = m[1]; // YYYY
      if (m[2] !== undefined) {
        to_parse += '-' + m[2]; // MM
        if (m[3] != undefined) {
          to_parse += '-' + m[3]; // DD
          if (m[4] != undefined && m[5] != undefined) {
            to_parse += ' ' + m[4] + ':' + m[5]; // HH:MM
            if (m[6] != undefined) {
              to_parse += ':' + m[6]; // SS
            }
          }
        }
      }
      to_parse += ' GMT'
      ret.push(new Date(to_parse).getTime()/1000);
    }
    ret.push(ret[ret.length - 1] + ret[ret.length - 1] - ret[ret.length - 2]);
    return ret;
  };

  this._handleLoading();

  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);
  this.xhr.onload = function() {
    that._removeLoadingSpinner();

    if (this.status == 404) {
      data = "";
    } else {
      var csvdata = this.responseText;
      that.jsondata = Papa.parse(csvdata, {header: false});
      var header = that.jsondata.data[0];
      var has_lat_lon = (
        header[1].substr(0,3).toLowerCase() == 'lat' &&
        header[2].substr(0,3).toLowerCase() == 'lon');
      var has_packedColor = (header[3].substr(0,11).toLowerCase() == 'packedcolor');
      var first_data_col = has_packedColor ? 4 : (has_lat_lon ? 3 : 1);

      var epochs = duplicateRow(0, getEpochs(first_data_col, header));
      var pointValues = [];
      var colorValues = [];
      var centroids = [];
      for (var i = 1; i < that.jsondata.data.length; i+=2) {
        if (that.jsondata.data[i] == "") {
          break;
        }
        var pointRow = that.jsondata.data[i];
        var colorRow = that.jsondata.data[i+1];
        // Make sure that the rows Name values match
        if (pointRow[0] != colorRow[0]) {
          break;
        }
        // Extract centroids
        if (has_lat_lon && pointRow[1] != '') {
          var centroid = getCentroidFromCsvData(pointRow);
          centroids.push(centroid);
          pointRow = setRow(duplicateRow(first_data_col, pointRow));
          setMinMaxPointValue(pointRow);
          colorRow = setRow(duplicateRow(first_data_col, colorRow));
          setMinMaxColorValue(colorRow);
          pointValues.push(pointRow);
          colorValues.push(colorRow);
        }
      }
    }

    var radius = eval(that.scalingFunction);
    var colorScalingFunction = eval(that.colorScalingFunction);
    that._radius = radius;
    that.colorScalingFunction = colorScalingFunction;

    var scaledPointValues = scaleValues(that._radius, pointValues);
    var scaledColorValues = scaleValues(that.colorScalingFunction, colorValues);
    var points = [];
    for (var i = 0; i < centroids.length; i++) {
      for (var j = 0; j < epochs.length; j+= 2) {
        var point = {};
        point["centroid"] = centroids[i];
        point["pointVal1"] = scaledPointValues[i][j];
        point["pointVal2"] = scaledPointValues[i][j+1];
        point["colorVal1"] = scaledColorValues[i][j];
        point["colorVal2"] = scaledColorValues[i][j+1];
        point["epoch1"] = epochs[j];
        point["epoch2"] = epochs[j+1];
        points.push(point);
      }
    }

    points.sort(function (a, b) {
      return Math.abs(b["pointVal2"]) - Math.abs(a["pointVal2"]);
    });

    var flatPoints = [];
    for (var i =0 ; i < points.length; i++) {
      flatPoints.push(points[i]["centroid"][0]);
      flatPoints.push(points[i]["centroid"][1]);
      flatPoints.push(points[i]["epoch1"]);
      flatPoints.push(points[i]["pointVal1"]);
      flatPoints.push(points[i]["colorVal1"]);
      flatPoints.push(points[i]["epoch2"]);
      flatPoints.push(points[i]["pointVal2"]);
      flatPoints.push(points[i]["colorVal2"]);
      if (has_packedColor) {
        flatPoints.push(points[i]["packedColor"]);
      }
    }

    that._setData(new Float32Array(flatPoints));
    //that._setData([]);
    that._dataLoaded(that.layerId);
  }

  this.xhr.onerror = function() {
    that._removeLoadingSpinner();

    that._setData('');
  }

  this.xhr.send();
}


WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv = function() {
  var that = this;

  var proj = new org.gigapan.timelapse.MercatorProjection(
    -180, 85.05112877980659, 180, -85.05112877980659,
    256, 256);

  var data;
  var noValue = this._noValue;
  var uncertainValue = this._uncertainValue;

  this._handleLoading();

  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);

  this.xhr.onload = function() {
    that._removeLoadingSpinner();

    if (this.status == 404) {
      data = "";
    } else {
      var csvdata = this.responseText;
      that.jsondata = Papa.parse(csvdata, {header: false});
      var header = that.jsondata.data[0];
      var has_lat_lon = (
        header[1].substr(0,3).toLowerCase() == 'lat' &&
        header[2].substr(0,3).toLowerCase() == 'lon');
      var has_packedColor = (header[3] && header[3].substr(0,11).toLowerCase() == 'packedcolor');
      var first_data_col = has_packedColor ? 4 : (has_lat_lon ? 3 : 1);
      var epochs = [];
      var points = [];
      var maxValue = 0;
      var minValue = 1e6; //TODO Is this an ok value?

      function getValue(rawVal) {
        var val = rawVal;
        if (val == noValue || val == uncertainValue) {
          val = 0.0;
        } else {
          val = parseFloat(val);
        }
        return val;
      }

      function setMinMaxValue(val) {
        if (val > maxValue) {
          maxValue = val;
        }
        if (val < minValue) {
          minValue = val;
        }
      }

      for (var i = first_data_col; i < header.length; i++) {
        var date = header[i];
	      // Date can be YYYY or YYYYMM or YYYYMMDD or YYYYMMDDHHMM or YYYYMMDDHHMMSS
        var yyyymmddhhmmss_re = /(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?$/;
	      var m = date.match(yyyymmddhhmmss_re);
	      if (!m) {
	        console.log('Cannot parse date ' + date);
	        break;
	      }
	      var to_parse = m[1]; // YYYY
	      if (m[2] !== undefined) {
	        to_parse += '-' + m[2]; // MM
	        if (m[3] != undefined) {
	          to_parse += '-' + m[3]; // DD
	          if (m[4] != undefined && m[5] != undefined) {
	            to_parse += ' ' + m[4] + ':' + m[5]; // HH:MM
	            if (m[6] != undefined) {
		            to_parse += ':' + m[6]; // SS
	            }
	          }
	        }
	      }
	      to_parse += ' GMT'
	      epochs[i] = new Date(to_parse).getTime()/1000;
      }

      for (var i = 1; i < that.jsondata.data.length; i++) {
        var country = that.jsondata.data[i];
        if (that.geojsonData == null) {
          that.geojsonData = COUNTRY_CENTROIDS;
        }
        var feature = searchCountryList(that.geojsonData,country[0]);
        var centroid = ["",""];
        var packedColor = null;
        // Extract centroids
        if (has_lat_lon && country[1] != '') {
          var latlng = {lat:country[1], lng:country[2]};
          var xy = proj.latlngToPoint(latlng);
          centroid = [xy.x, xy.y];
          if (has_packedColor) {
            packedColor = country[3];
          }
        } else if (! feature.hasOwnProperty("geometry")) {
          console.log('ERROR: Could not find ' + country[0]);
          continue;
        } else if (!feature['properties'].hasOwnProperty('webmercator')) {
          var latlng = {lat:feature['geometry']['coordinates'][1], lng:feature['geometry']['coordinates'][0]};
          var xy = proj.latlngToPoint(latlng);
          centroid = [xy.x, xy.y];

        } else {
          centroid = feature['properties']['webmercator'];
        }
        // For all non-empty centroids, build indexes
        if (centroid[0] != "" && centroid[1] != "") {
          var idx = [];
          // Get indexes of non-blank values
          for (var j = first_data_col; j < country.length; j++) {
            country[j] = country[j].replace(/,/g , "");
            if (country[j] != "") {
              idx.push(j);
            }
          }
          for (var j = 0; j < idx.length - 1; j++) {
            var k = idx[j];
            var val = country[k];
            val = getValue(val);
            setMinMaxValue(Math.abs(val));
            var point = {
              "centroid": centroid,
              "epoch1": epochs[k],
              "val1": val
            };
            if (idx.length > 1) {
              var k = idx[j+1];
              var val = country[k];
              val = getValue(val);
              setMinMaxValue(Math.abs(val));
              point["epoch2"] = epochs[k];
              point["val2"] = val;
            } else {
              var k = idx[j];
              var val = country[k];
              val = getValue(val);
              setMinMaxValue(Math.abs(val));
              point["epoch2"] = epochs[k];
              point["val2"] = val;
            }
            if (has_packedColor) {
              point['packedColor'] = packedColor;
            }
            points.push(point);
          }
          if (idx.length > 1) {
            var k = idx[j];
            var val = country[k];
            val = getValue(val);
            setMinMaxValue(Math.abs(val));
            var span = epochs[k] - epochs[k-1];
            var point = {
              "centroid": centroid,
              "epoch1": epochs[k],
              "val1": val,
              "epoch2": epochs[k] + span,
              "val2": val
            };
            if (has_packedColor) {
              point['packedColor'] = packedColor;
            }
            points.push(point);
          }
        }
      }
      that._maxValue = maxValue;
      that._minValue = minValue;
      var radius = eval(that.scalingFunction);
      that._radius = radius;
      for (var i = 0; i < points.length; i++) {
        points[i]["val1"] = radius(points[i]["val1"]);
        points[i]["val2"] = radius(points[i]["val2"]);
      }
    }

    points.sort(function (a, b) {
      return Math.abs(b["val2"]) - Math.abs(a["val2"]);
    });
    var flatPoints = [];
    for (var i =0 ; i < points.length; i++) {
      flatPoints.push(points[i]["centroid"][0]);
      flatPoints.push(points[i]["centroid"][1]);
      flatPoints.push(points[i]["epoch1"]);
      flatPoints.push(points[i]["val1"]);
      flatPoints.push(points[i]["epoch2"]);
      flatPoints.push(points[i]["val2"]);
      if (has_packedColor) {
        flatPoints.push(points[i]["packedColor"]);
      }

    }
    that._setData(new Float32Array(flatPoints));
    //that._setData([]);
    that._dataLoaded(that.layerId);
  }

  this.xhr.onerror = function() {
    that._removeLoadingSpinner();

    that._setData('');
  }

  this.xhr.send();
}

WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv = function() {
  var that = this;

  function LatLongToPixelXY(latitude, longitude) {
    var pi_180 = Math.PI / 180.0;
    var pi_4 = Math.PI * 4;
    var sinLatitude = Math.sin(latitude * pi_180);
    var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (pi_4)) * 256;
    var pixelX = ((longitude + 180) / 360) * 256;
    var pixel = { x: pixelX, y: pixelY };
    return pixel;
  }

  this._handleLoading();

  this.xhr = new XMLHttpRequest();
  this.xhr.open('GET', that._url);

  var data;
  this.xhr.onload = function() {
    that._removeLoadingSpinner();

    if (this.status == 404) {
      data = "";
    } else {
      var csvdata = this.responseText;
      // Assumes data is of the following format
      // header row Country,      year_0, ..., year_N
      // data row   country_name, value_0,..., value_N
      // ...
      var t0 = performance.now();
      that.jsondata = Papa.parse(csvdata, {header: false});
      var t1 = performance.now();
      console.log("Parsed csv data in " + (t1 - t0) + "ms");

      var header = that.jsondata.data[0];
      var has_lat_lon = (
        header[1].substr(0,3).toLowerCase() == 'lat' &&
        header[2].substr(0,3).toLowerCase() == 'lon');
      var has_packedColor = (header[3] && header[3].substr(0,11).toLowerCase() == 'packedcolor');
      var first_data_col = has_packedColor ? 4 : (has_lat_lon ? 3 : 1);

      var epochs = [];
      var points = [];
      var maxValue = 0;
      var minValue = 1e6; //TODO Is this an ok value?
      var verts = [];
      var rawVerts = [];
      var t0 = performance.now();
      var totalSearchTime = 0;
      for (var i = first_data_col; i < header.length; i++) {
        var date = header[i];
        // Date can be YYYY or YYYYMM or YYYYMMDD or YYYYMMDDHHMM or YYYYMMDDHHMMSS
        var yyyymmddhhmmss_re = /(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?$/;
        var m = date.match(yyyymmddhhmmss_re);
        if (!m) {
          console.log('Cannot parse date ' + date);
          break;
        }
        var to_parse = m[1]; // YYYY
        if (m[2] !== undefined) {
          to_parse += '-' + m[2]; // MM
          if (m[3] != undefined) {
            to_parse += '-' + m[3]; // DD
            if (m[4] != undefined && m[5] != undefined) {
              to_parse += ' ' + m[4] + ':' + m[5]; // HH:MM
              if (m[6] != undefined) {
                to_parse += ':' + m[6]; // SS
              }
            }
          }
        }
        to_parse += ' GMT'
        epochs[i] = new Date(to_parse).getTime()/1000;
      }
      for (var ii = 1; ii < that.jsondata.data.length; ii++) {
        var country = that.jsondata.data[ii];
        if (that.geojsonData == null) {
          that.geojsonData = COUNTRY_POLYGONS;
        }
        var t3 = performance.now();
        var feature = searchCountryList(that.geojsonData,country[0], that.nameKey);
        var t4 = performance.now();
        totalSearchTime += (t4 - t3);
        if (typeof feature == "undefined") {
          //
          console.log("undefined feature");
        }
        else if (!feature.hasOwnProperty("geometry")) {
          //console.log('ERROR: Could not find ' + country[0]);
        } else {
          var idx = [];
          for (var j = first_data_col; j < country.length; j++) {
            country[j] = country[j].replace(/,/g , "");
            if (country[j] != "") {
              idx.push(j);
            }
          }
          for (var j = 0; j < idx.length; j++) {
            var id_current = idx[j];
            var id_next = idx[j+1];
            if (j == idx.length - 1) {
              id_next = id_current;
            }

            var epoch_1 = epochs[id_current];
            var val_1 = parseFloat(country[id_current]);
            if (val_1 > maxValue) {
              maxValue = val_1;
            }
            if (val_1 < minValue) {
              minValue = val_1;
            }
            var epoch_2 = epochs[id_next];
            if (j == idx.length - 1) {
              epoch_2 = epochs[id_current] + (epochs[id_current] - epochs[id_current - 1]);
            }

            var val_2 = parseFloat(country[id_next]);
            if (val_2 > maxValue) {
              maxValue = val_2;
            }
            if (val_2 < minValue) {
              minValue = val_2;
            }

            if (feature.geometry.type != "MultiPolygon") {
              var mydata = earcut.flatten(feature.geometry.coordinates);
              var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
              for (var i = 0; i < triangles.length; i++) {
                var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
                verts.push(pixel.x, pixel.y, epoch_1, val_1, epoch_2, val_2);
              }
            } else {
              for ( var jj = 0; jj < feature.geometry.coordinates.length; jj++) {
                var mydata = earcut.flatten(feature.geometry.coordinates[jj]);
                var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
                for (var i = 0; i < triangles.length; i++) {
                  var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
                  verts.push(pixel.x, pixel.y, epoch_1, val_1, epoch_2, val_2);
                }
              }
            }
          }
        }
      }
      console.log("Total time searching is " + totalSearchTime + "ms");
      var t1 = performance.now();
      console.log("Generated vertices data in " + (t1 - t0) + "ms");
      var t0 = performance.now();
      that._maxValue = maxValue;
      that._minValue = minValue;
      var radius = eval(that.scalingFunction);
      that._radius = radius;
      for (var i = 0; i < verts.length; i+=6) {
        verts[i+3] = radius(verts[i+3]);
        verts[i+5] = radius(verts[i+5]);
      }
      var t1 = performance.now();
      console.log("Scale data in " + (t1 - t0) + "ms");

      that._setData(new Float32Array(verts));
      that._dataLoaded(that.layerId);
    }
  }
  this.xhr.onerror = function() {
    that._removeLoadingSpinner();

    that._setData('');
  }
  this.xhr.send();
}

WebGLVectorTile2.prototype._setSitc4r2Buffer = function(sitc4r2Code, year, data) {
  if (typeof this.buffers[sitc4r2Code] == "undefined") {
    this.buffers[sitc4r2Code] = {};
  }

  this.buffers[sitc4r2Code][year] = {
    "numAttributes": this.numAttributes,
    "pointCount": 0,
    "buffer": null,
    "ready": false
  };
  var gl = this.gl;
  this.buffers[sitc4r2Code][year].pointCount = data.length / this.numAttributes;
  if (this.buffers[sitc4r2Code][year].pointCount > 0) {
    this.buffers[sitc4r2Code][year].buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[sitc4r2Code][year].buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    this.buffers[sitc4r2Code][year].ready = true;
  }
}

WebGLVectorTile2.prototype._setPolygonData = function(data) {
  // Assumes GeoJSON data
  var verts = [];
  var rawVerts = [];

  if (typeof data.features != "undefined") {
    for (var f = 0; f < data.features.length ; f++) {
      var feature = data.features[f];
      var packedColor = feature.properties.packed_color;
        if (feature.geometry.type != "MultiPolygon") {
          var mydata = earcut.flatten(feature.geometry.coordinates);
          var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
          for (var i = 0; i < triangles.length; i++) {
            var pixel = LngLatToPixelXY(mydata.vertices[triangles[i]*2], mydata.vertices[triangles[i]*2 + 1]);
            verts.push(pixel[0], pixel[1], packedColor);
          }
        } else {
          for ( var j = 0; j < feature.geometry.coordinates.length; j++) {
            var mydata = earcut.flatten(feature.geometry.coordinates[j]);
            var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
            for (var i = 0; i < triangles.length; i++) {
              var pixel = LngLatToPixelXY(mydata.vertices[triangles[i]*2], mydata.vertices[triangles[i]*2 + 1]);
              verts.push(pixel[0], pixel[1], packedColor);
            }
          }
        }

    }
    this._setBufferData(new Float32Array(verts));
    this._dataLoaded(this.layerId);
  }
}

WebGLVectorTile2.prototype._setLineStringData = function(data) {
  // Assumes GeoJSON data
  function processLineString(lineString) {
    var out =[];
    for (var i = 0; i < lineString.length; i++) {
      var p = LngLatToPixelXY(lineString[i][0], lineString[i][1]);
      out.push(p);
    }
    return out;
  }
  var paths = [];
  for (var i = 0; i < data["features"].length; i++) {
    var feature = data["features"][i];
    if (feature["geometry"]) {
      if (feature["geometry"]["type"] == "MultiLineString") {
        for (var j = 0; j < feature["geometry"]["coordinates"].length; j++) {
          var path = [];
          var path = path.concat(processLineString(feature["geometry"]["coordinates"][j]));
          paths.push(path);
        }
      } else {
        var path = [];
        path = path.concat(processLineString(feature["geometry"]["coordinates"]));
        paths.push(path);
      }
    }
  }
  var vertexCollection = [];
  for (var i = 0; i < paths.length; i++) {
    var points = paths[i];
    //var positions = Duplicate(points);
    var positions = [];
    for (var j = 0; j < points.length; j++) {
        positions.push(points[j], points[j]);
    }
    positions.shift();
    positions.pop();
    vertexCollection = vertexCollection.concat(PackArray(positions));
  }
  this._setBufferData(new Float32Array(vertexCollection));
  this._dataLoaded(this.layerId);

}

WebGLVectorTile2.prototype._setExpandedLineStringData = function(data) {
  // Assumes GeoJSON data
  function processLineString(lineString) {
    var out =[];
    for (var i = 0; i < lineString.length; i++) {
      var p = LngLatToPixelXY(lineString[i][0], lineString[i][1]);
      out.push(p);
    }
    return out;
  }
  var paths = [];
  for (var i = 0; i < data["features"].length; i++) {
    var path = [];
    var feature = data["features"][i];
    if (feature["geometry"]["type"] == "MultiLineString") {
      for (var j = 0; j < feature["geometry"]["coordinates"].length; j++) {
        path = path.concat(processLineString(feature["geometry"]["coordinates"][j]));
      }
    } else {
      path = path.concat(processLineString(feature["geometry"]["coordinates"]));
    }
    paths.push(path);
  }
  var normalCollection = [];
  var miterCollection = [];
  var vertexCollection = [];
  var indexCollection = [];

  var offset = 0;
  for (var i = 0; i < paths.length; i++) {
    var points = paths[i];
    var tags = GetNormals(points);
    var normals = tags.map(function(x) {
      return x[0];
    });
    var miters = tags.map(function(x) {
      return x[1];
    });
    var count = (points.length - 1) * 6;
    normals = Duplicate(normals);
    miters = Duplicate(miters, true);
    var positions = Duplicate(points);
    var indices = CreateIndices(points.length-1, offset);
    normalCollection = normalCollection.concat(PackArray(normals));
    miterCollection = miterCollection.concat(PackArray(miters));
    vertexCollection = vertexCollection.concat(PackArray(positions));
    indexCollection = indexCollection.concat(indices);
    offset += positions.length;
  }
  var idx = 0;
  var indexBuffer = [];
  for (var i = 0; i < indexCollection.length; i++) {
    for (var j = 0; j < indexCollection[i].length; j++) {
      indexBuffer[idx] = indexCollection[i][j];
      idx++;
    }
  }

  this._setBuffers([new Float32Array(vertexCollection),
                    new Float32Array(normalCollection),
                    new Float32Array(miterCollection)],
                    new Uint16Array(indexBuffer));

}


WebGLVectorTile2.prototype._setIomIdpData = function(data) {
  var maxValue = 905835.0;
  var radius = d3.scaleSqrt().domain([0, maxValue]).range([0, 60]);

  var features = data.features;
  var points = [];

  // Convert iso3 to numeric code
  function alpha2num(alpha) {
    if (alpha == 'IRQ')
      return 368
    if (alpha == 'SYR')
      return 760
    if (alpha == 'YEM')
      return 887
    if (alpha == 'LBY')
      return 434
    return -1
  }

  //points look like country_code,type,x,y,epoch_1,val_1,epoch_2,val_2
  for (var i = 0; i < features.length; i++) {
    var properties = features[i]['properties'];
    var xy = properties['xy'];
    var epochs = properties['epochs'];
    var idpValues = properties['idp_values'];
    var returnsValues = properties['returns_values'];
    var iso3 = properties['iso3'];

    for (var j = 0; j < epochs.length - 1; j++) {
      var p = {
        cc: alpha2num(iso3),
        type: 0,
        x: xy[0],
        y: xy[1],
        epoch1: epochs[j],
        val1: idpValues[j],
        epoch2: epochs[j+1],
        val2: idpValues[j+1]
      }
      points.push(p);
      var p = {
        cc: alpha2num(iso3),
        type: 1,
        x: xy[0],
        y: xy[1],
        epoch1: epochs[j],
        val1: returnsValues[j],
        epoch2: epochs[j+1],
        val2: returnsValues[j+1]
      }
      points.push(p);
   }
  }
  points.sort(function(a,b) {
    return b.val2 - a.val2;
  });
  var arr = [];
  for (var k = 0; k < points.length; k++) {
    arr.push(points[k].cc);
    arr.push(points[k].type);
    arr.push(points[k].x);
    arr.push(points[k].y);
    arr.push(points[k].epoch1);
    arr.push(radius(points[k].val1));
    arr.push(points[k].epoch2);
    arr.push(radius(points[k].val2));
  }

  var gl = this.gl;
  var arrayBuffer = new Float32Array(arr);
  this._pointCount = arrayBuffer.length / 8;
  this._ready = true;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_country')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_type')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 4);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 32, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch1')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_val1')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 20);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch2')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 24);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_val2')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 28);
  }
}

// Color Dotmap (not animated)  aWorldCoord[2]  aColor
WebGLVectorTile2.prototype._setColorDotmapData = function(arrayBuffer) {
  var gl = this.gl;
  this._pointCount = arrayBuffer.length / 3;
  this._ready = true;
  if (this._pointCount > 0) {
    this._data = arrayBuffer;
    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);
  }
}

var gtileData;

// Color Dotmap (not animated)  aWorldCoord[2]  aColor
WebGLVectorTile2.prototype._setColorDotmapDataFromBox = function(tileDataF32) {
  // Create uint8 view on data.  Unfortunately we're called with Float32Array, which isn't correct for
  // this particular function
  
  var tileData = new Uint8Array(tileDataF32.buffer);
  // Iterate through the raster, creating dots on the fly
  
  var gl = this.gl;
  gtileData = tileData;

  this._pointCount = tileData.reduce(function(a,b) { return a+b;})
  this._ready = true;

  if (this._pointCount > 0) {
    this._data = new Float32Array(this._pointCount * 3);
    var input_idx = 0;
    var output_idx = 0;
    var numColors = this.dotmapColors.length;
    var tileDim = 256;
    console.assert(numColors == tileData.length / (tileDim * tileDim));

    // Find location of tile
    var projectedTileSize = 256 / 2 ** this._tileidx.l; // 256 for level 0, 128 for level 1 ...
    var projectedXMin = projectedTileSize * this._tileidx.c;
    var projectedYMin = projectedTileSize * this._tileidx.r;

    // Loop through the rasters, creating points within each box
    for (var c = 0; c < numColors; c++) {
      for (var y = 0; y < tileDim; y++) {
	for (var x = 0; x < tileDim; x++) {
	  for (var p = 0; p < tileData[input_idx]; p++) {
	    this._data[output_idx * 3 + 0] = projectedXMin + (x + Math.random()) * projectedTileSize / 256;
	    this._data[output_idx * 3 + 1] = projectedYMin + (y + Math.random()) * projectedTileSize / 256;
	    this._data[output_idx * 3 + 2] = this.dotmapColors[c];
	    output_idx++;
	  }
	  input_idx++;
	}
      }
    }
    console.assert(input_idx == tileData.length);
    console.assert(output_idx == this._data.length / 3);

    // Randomly permute the order of points
    for (var i = this._pointCount - 1; i >= 1; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp;
      tmp = this._data[i * 3 + 0]; this._data[i * 3 + 0] = this._data[j * 3 + 0]; this._data[j * 3 + 0] = tmp;
      tmp = this._data[i * 3 + 1]; this._data[i * 3 + 1] = this._data[j * 3 + 1]; this._data[j * 3 + 1] = tmp;
      tmp = this._data[i * 3 + 2]; this._data[i * 3 + 2] = this._data[j * 3 + 2]; this._data[j * 3 + 2] = tmp;
    }

    this._arrayBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);
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
    this._ready = true;
    if (this._pointCount > 0) {
      this._data = new Float32Array(verts);

      this._arrayBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
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
    this._ready = true;
    if (this._pointCount > 0) {
      this._data = new Float32Array(verts);

      this._arrayBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
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
    }
  }
}

WebGLVectorTile2.prototype._setBufferData  = function(data) {
    var gl = this.gl;
    this._pointCount = data.length / this.numAttributes;
    this._ready = true;
    if (this._pointCount > 0) {
      this._data = data;
      this._arrayBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);

      // Bind option image to texture
      if (typeof this._image !== "undefined") {
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
      }
    }
}

WebGLVectorTile2.prototype._setBuffers  = function(buffers, indices) {
  var gl = this.gl;
  this._pointCount = indices.length;
  //console.log(this._pointCount);
  this._arrayBuffers = [];
  this._ready = true;
  if (this._pointCount > 0) {
    for (var i = 0; i < buffers.length; i++) {
      this._arrayBuffers[i] = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, buffers[i], gl.STATIC_DRAW);
    }
    this._indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
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

WebGLVectorTile2.prototype._drawUppsalaConflict = function(transform, options) {
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
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 20, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var timeLocation = gl.getAttribLocation(this.program, "a_val");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 20, 8); // 8 byte offset

    var timeLocation = gl.getAttribLocation(this.program, "a_start_epoch");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 20, 12); // 8 byte offset

    var timeLocation = gl.getAttribLocation(this.program, "a_end_epoch");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 20, 16); // 8 byte offset

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(sliderTime, currentTime);

    var sliderTime = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(sliderTime, pointSize);

    var spanEpoch = 24.0*30*24*68*60;
    var span = gl.getUniformLocation(this.program, 'u_span');
    gl.uniform1f(span, spanEpoch);


    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawBubbleMap = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime.getTime()/1000.;
    var pointSize = options.pointSize || (2.0 * window.devicePixelRatio);
    var color = options.color || [.1, .1, .5, 1.0];
    if (color.length == 3) {
      color.push(1.0);
    }
    var mode = options.mode || 1.0; // 1.0 == full circle, 2.0 == left half, 3.0 == right half

    //console.log(currentTime);

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 8);

    var timeLocation = gl.getAttribLocation(this.program, "a_Val1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 12);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 16);

    var timeLocation = gl.getAttribLocation(this.program, "a_Val2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 20);

    if (this.numAttributes == 7) {
      var timeLocation = gl.getAttribLocation(this.program, "a_color");
      gl.enableVertexAttribArray(timeLocation);
      gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 24);
    }

    var colorLoc = gl.getUniformLocation(this.program, 'u_Color');
    gl.uniform4fv(colorLoc, color);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Epoch');
    gl.uniform1f(sliderTime, currentTime);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Size');
    gl.uniform1f(sliderTime, 2.0 * window.devicePixelRatio);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Mode');
    gl.uniform1f(sliderTime, mode);

    if (this._texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);

      var colorLoc = gl.getUniformLocation(this.program, 'u_Min');
      gl.uniform1f(colorLoc, this._radius(this._minValue));

      var colorLoc = gl.getUniformLocation(this.program, 'u_Max');
      gl.uniform1f(colorLoc, this._radius(this._maxValue));


    }


    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawBivalentBubbleMap = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime.getTime()/1000.;
    var pointSize = options.pointSize || (2.0 * window.devicePixelRatio);
    var color = options.color || [.1, .1, .5, 1.0];
    if (color.length == 3) {
      color.push(1.0);
    }
    var mode = options.mode || 1.0; // 1.0 == full circle, 2.0 == left half, 3.0 == right half

    //console.log(currentTime);

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_Centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 8);

    var timeLocation = gl.getAttribLocation(this.program, "a_PointVal1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 12);

    var timeLocation = gl.getAttribLocation(this.program, "a_ColorVal1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 16);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 20);

    var timeLocation = gl.getAttribLocation(this.program, "a_PointVal2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 24);

    var timeLocation = gl.getAttribLocation(this.program, "a_ColorVal2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, this.numAttributes * 4, 28);


    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Epoch');
    gl.uniform1f(sliderTime, currentTime);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Size');
    gl.uniform1f(sliderTime, 2.0 * window.devicePixelRatio);

    if (this._texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);
    }


    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawChoroplethMap = function(transform, options) {
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

    var timeLocation = gl.getAttribLocation(this.program, "a_Val1");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 12);

    var timeLocation = gl.getAttribLocation(this.program, "a_Epoch2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 16);

    var timeLocation = gl.getAttribLocation(this.program, "a_Val2");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 24, 20);

    var colorLoc = gl.getUniformLocation(this.program, 'u_Color');
    gl.uniform4fv(colorLoc, color);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_MapMatrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Epoch');
    gl.uniform1f(sliderTime, currentTime);

    var sliderTime = gl.getUniformLocation(this.program, 'u_Size');
    gl.uniform1f(sliderTime, 2.0);


    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_Image"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
    perf_draw_triangles(this._pointCount);
    gl.bindTexture(gl.TEXTURE_2D, null);
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

    var pixelScale = - transform[5];
    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    // Start scaling pixels extra for tiles beyond level 10
    if (this._tileidx.l > 10) {
      pixelScale *= 2 ** (this._tileidx.l - 10);
    }

    // transform maps 0-256 input coords to the tile's pixel space on the screen.
    // But color dotmaps treat 0-256 input coords to map to the entire planet, not the current tile's extents.
    // Scale tileTransform so that it would map 0-256 input coords to the entire planet.
    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var throttle = 1.0;
    if (typeof options.throttle != "undefined") {
        throttle = options.throttle
    }

    // Beyond a certain zoom level, increase dot size
    var pointSize = Math.max(0.5, pixelScale * 38);
    gl.uniform1f(this.program.uSize, pointSize);

    gl.uniform1f(this.program.uZoom, zoom);

    gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

    gl.enableVertexAttribArray(this.program.aWorldCoord);
    gl.vertexAttribPointer(this.program.aWorldCoord, 2, gl.FLOAT, false, 12, 0);

    gl.enableVertexAttribArray(this.program.aColor);
    gl.vertexAttribPointer(this.program.aColor, 1, gl.FLOAT, false, 12, 8);

    var npoints = Math.floor(this._pointCount*throttle);
    gl.drawArrays(gl.POINTS, 0, npoints);
    perf_draw_points(npoints);
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

WebGLVectorTile2.prototype._drawPointFlow = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {

    gl.useProgram(this.program);
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var zoom = options.zoom || (2.0 * window.devicePixelRatio);
    var pointSize = Math.floor( ((20-5) * (zoom - 0) / (21 - 0)) + 5 );
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }
    var sizeLoc = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(sizeLoc, pointSize);

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var currentTime = options.currentTime;
    var epochLoc = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(epochLoc, currentTime/1000.);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_p0');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_p1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_p2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch0');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 24);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 28);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
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
  var _first = 0;
  var _count = 100;

  var opts = options || {};
  var minTime = opts.minTime || _minTime;
  var maxTime = opts.maxTime || _maxTime;
  var showTemp = opts.showTemp || _showTemp;
  var minTemp = opts.minTemp || _minTemp;
  var maxTemp = opts.maxTemp || _maxTemp;
  var pointSize = opts.pointSize || (2.0 * window.devicePixelRatio);
  var zoom = options.zoom;
  var first = opts.first || _first;
  var count = opts.count || _count;

  if (options.currentTime) {
    maxTime = options.currentTime;
    minTime = maxTime - 28*24*60*60*1000;
  }

  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
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
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0);

    var timeLoc = gl.getAttribLocation(this.program, 'time');
    gl.enableVertexAttribArray(timeLoc);
    gl.vertexAttribPointer(timeLoc, 1, gl.FLOAT, false, 12, 8);

    var timeLoc = gl.getUniformLocation(this.program, 'maxTime');
    gl.uniform1f(timeLoc, maxTime/1000.);

    var timeLoc = gl.getUniformLocation(this.program, 'minTime');
    gl.uniform1f(timeLoc, minTime/1000.);

    var pointSizeLoc = gl.getUniformLocation(this.program, 'pointSize');
    gl.uniform1f(pointSizeLoc, pointSize);

    gl.drawArrays(gl.POINTS, first, count);
    perf_draw_points(count);
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
  //console.log(options);
  //console.log(this._pointCount);
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
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

WebGLVectorTile2.prototype._drawTimeSeriesPointData = function(transform, options) {
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    //gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    var year = options.year;
    var maxValue = options.maxValue || 100.0;

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var maxValueLoc = gl.getUniformLocation(this.program, 'u_max_value');
    gl.uniform1f(maxValueLoc, maxValue);

    var epochLoc = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(epochLoc, year);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_centroid');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_val1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_val2');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 20);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    gl.disable(gl.BLEND);

  }
}

WebGLVectorTile2.prototype._drawVaccineConfidence = function(transform, options) {
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
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


WebGLVectorTile2.prototype._drawIomIdp = function(transform, options) {
  var gl = this.gl;
  if (this._ready && this._pointCount > 0) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var tileTransform = new Float32Array(transform);


    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_point_size');
    gl.uniform1f(uniformLoc, options.pointSize);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(uniformLoc, options.epoch);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_irq_idps');
    gl.uniform1f(uniformLoc, options.showIrqIdps);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_syr_idps');
    gl.uniform1f(uniformLoc, options.showSyrIdps);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_yem_idps');
    gl.uniform1f(uniformLoc, options.showYemIdps);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_lby_idps');
    gl.uniform1f(uniformLoc, options.showLbyIdps);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_irq_returns');
    gl.uniform1f(uniformLoc, options.showIrqReturns);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_syr_returns');
    gl.uniform1f(uniformLoc, options.showSyrReturns);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_yem_returns');
    gl.uniform1f(uniformLoc, options.showYemReturns);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_show_lby_returns');
    gl.uniform1f(uniformLoc, options.showLbyReturns);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_country')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 0);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_type')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 4);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 32, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch1')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 16);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_val1')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 20);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch2')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 24);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_val2')
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 32, 28);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    gl.disable(gl.BLEND);

  }

}

WebGLVectorTile2.prototype._drawTsip = function(transform, options) {
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
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 20, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var timeLocation = gl.getAttribLocation(this.program, "a_color");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 20, 8); // 8 byte offset

    var timeLocation = gl.getAttribLocation(this.program, "a_epoch");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 20, 12); // 8 byte offset

    var timeLocation = gl.getAttribLocation(this.program, "a_val");
    gl.enableVertexAttribArray(timeLocation);
    gl.vertexAttribPointer(timeLocation, 1, gl.FLOAT, false, 20, 16); // 8 byte offset

    var sliderTime = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(sliderTime, currentTime);

    var sliderTime = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(sliderTime, pointSize);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawPolygon = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime/1000.;
    var color = options.color || [1.0, 0.0, 0.0, 1.0];

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var attributeLoc = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 12, 8); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
    //gl.drawElements(gl.TRIANGLES, 170840, gl.UNSIGNED_SHORT, 0);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawLineString = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime/1000.;
    var color = options.color || [1.0, 0.0, 0.0, 1.0];

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var colorLoc = gl.getUniformLocation(this.program, 'u_color');
    gl.uniform4fv(colorLoc, color);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 8, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    gl.drawArrays(gl.LINES, 0, this._pointCount);
    //gl.drawElements(gl.TRIANGLES, 170840, gl.UNSIGNED_SHORT, 0);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}


WebGLVectorTile2.prototype._drawExpandedLineString = function(transform, options) {
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
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);
    var colorLoc = gl.getUniformLocation(this.program, 'u_color');
    gl.uniform3fv(colorLoc, [1.,0.,0.]);
    var thicknessLoc = gl.getUniformLocation(this.program, 'u_thickness');
    gl.uniform1f(thicknessLoc, .5);
    var innerLoc = gl.getUniformLocation(this.program, 'u_inner');
    gl.uniform1f(innerLoc, .0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[0]);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 8, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[1]);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_normal');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 8, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[2]);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_miter');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);

    gl.drawElements(gl.TRIANGLES, this._pointCount, gl.UNSIGNED_SHORT, 0);
    //gl.drawElements(gl.TRIANGLES, 170840, gl.UNSIGNED_SHORT, 0);
    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}


WebGLVectorTile2.prototype._drawPointSizeColor = function(transform, options) {
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
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(uniformLoc, pointSize);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var attributeLoc = gl.getAttribLocation(this.program, 'a_size');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 12);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);

    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawPointSizeColorEpoch = function(transform, options) {
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
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var epochRange = options.epochRange || 365*24*60*60;
    
    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(uniformLoc, pointSize);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(uniformLoc, currentTime);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_epoch_range');
    gl.uniform1f(uniformLoc, epochRange);


    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var attributeLoc = gl.getAttribLocation(this.program, 'a_size');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 16);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);

    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.prototype._drawPointColorStartEpochEndEpoch = function(transform, options) {
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
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(sliderTime, currentTime);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(uniformLoc, pointSize);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, this.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var attributeLoc = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch0');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 12);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, this.numAttributes * 4, 16);

    gl.drawArrays(gl.POINTS, 0, this._pointCount);

    perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}


WebGLVectorTile2.prototype._drawSitc4rcBuffer = function (code, year, transform, options) {
  var gl = this.gl;
  var buffer = this.buffers[code][year];
  gl.useProgram(this.program);
  gl.enable(gl.BLEND);
  gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

  var tileTransform = new Float32Array(transform);
  var zoom = options.zoom;
  var currentTime = options.currentTime/1000.;
  var pointSize = options.pointSize || (2.0 * window.devicePixelRatio);
  var color = options.color || [1.0, 0.0, 0.0];

  scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
  scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

  pointSize *= Math.floor((zoom + 1.0) / (23.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
  if (isNaN(pointSize)) {
    pointSize = 1.0;
  }

  var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
  gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

  var sliderTime = gl.getUniformLocation(this.program, 'u_epoch');
  gl.uniform1f(sliderTime, currentTime);

  var uniformLoc = gl.getUniformLocation(this.program, 'u_size');
  gl.uniform1f(uniformLoc, pointSize);

  var uniformLoc = gl.getUniformLocation(this.program, 'u_end_color');
  gl.uniform3fv(uniformLoc, color);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
  var attributeLoc = gl.getAttribLocation(this.program, 'a_p0');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, buffer.numAttributes * 4, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
  var attributeLoc = gl.getAttribLocation(this.program, 'a_p2');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, buffer.numAttributes * 4, 8);

  var attributeLoc = gl.getAttribLocation(this.program, 'a_p1');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, buffer.numAttributes * 4, 16);

  var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch0');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, buffer.numAttributes * 4, 24);

  var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch1');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, buffer.numAttributes * 4, 28);

  gl.drawArrays(gl.POINTS, 0, buffer.pointCount);

  gl.disable(gl.BLEND);

}

WebGLVectorTile2.prototype._initSitc4rcBuffer = function(code, year) {
  this.buffers[code][year] = {
    "numAttributes": this.numAttributes,
    "pointCount": 8,
    "buffer":null,
    "ready": false
  }
  this.worker.postMessage({'year': year, 'code': code, 'exporters': this._exporters, "importers": this._importers, "scale": this._scale, "rootUrl": window.rootTilePath});
}

WebGLVectorTile2.prototype._drawSitc4r2 = function(transform, options) {
  var gl = this.gl;
  if (this._ready) {
    var code = this._sitc4r2Code;
    var currentTime = options.currentTime;
    var currentYear = new Date(currentTime).getUTCFullYear();
    var start = new Date(currentYear + '-01-01');
    var end = new Date(currentYear + '-12-31');
    var t = 1.0 - (end.getTime() - currentTime) / (end.getTime() - start.getTime());
    if (typeof this.buffers[code] == "undefined") {
      this.buffers[code] = {}
    }
    /* Init Buffers */
    if (typeof this.buffers[code][currentYear.toString()] == "undefined") {
      this._initSitc4rcBuffer(code, currentYear.toString());
    }
    if (typeof this.buffers[code][(currentYear+1).toString()] == "undefined" && currentYear >= 2000) {
      this._initSitc4rcBuffer(code, (currentYear+1).toString());
    }
    /* Draw buffers */
    if (this.buffers[code][currentYear.toString()] && this.buffers[code][currentYear.toString()].ready ) {
      this._drawSitc4rcBuffer(code, currentYear.toString(), transform, options);
    } else {
      timelapse.lastFrameCompletelyDrawn = false;
    }
    if (this.buffers[code][(currentYear+1).toString()] && this.buffers[code][(currentYear+1).toString()].ready ) {
      this._drawSitc4rcBuffer(code, (currentYear+1).toString(), transform, options);
    } else {
      timelapse.lastFrameCompletelyDrawn = false;
    }
  }
}

WebGLVectorTile2.prototype._drawSpCrude = function(transform, options) {
  var gl = this.gl;
    var buffers = options.buffers;
    var idx  = options.idx;
    var buffer = buffers[idx];

  if (buffer && buffer.ready) {
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    var tileTransform = new Float32Array(transform);
    var zoom = options.zoom;
    var currentTime = options.currentTime/1000.;
    var pointSize = options.pointSize || (2.0 * window.devicePixelRatio);
    var color = options.color || [.1, .1, .5, 1.0];

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((zoom + 1.0) / (23.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    // Passing a NaN value to the shader with a large number of points is very bad
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }


    var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

    var sliderTime = gl.getUniformLocation(this.program, 'u_epoch');
    gl.uniform1f(sliderTime, currentTime);

    var uniformLoc = gl.getUniformLocation(this.program, 'u_size');
    gl.uniform1f(uniformLoc, pointSize);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord_0');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, buffer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch_0');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, buffer.numAttributes * 4, 8);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_coord_1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, buffer.numAttributes * 4, 12); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

    var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch_1');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, buffer.numAttributes * 4, 20);

    var attributeLoc = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, buffer.numAttributes * 4, 24);


    gl.drawArrays(gl.POINTS, 0, buffer.count);

    //perf_draw_points(this._pointCount);
    gl.disable(gl.BLEND);
  }
}


// Update and draw tiles
WebGLVectorTile2.update = function(tiles, transform, options) {
  for (var i = 0; i < tiles.length; i++) {
    if (tiles[i]._ready && tiles[i]._pointCount != 0) {
      tiles[i].draw(transform, options);
    }
  }
}

WebGLVectorTile2.prototype._handleLoading = function() {
  var that = this;
  clearTimeout(this._loadingSpinnerTimer);
  this._spinnerNeeded = true;
  // Wait 300ms to prevent small datasets from flashing up a spinner.
  this._loadingSpinnerTimer = setTimeout(function() {
    if (!that._spinnerNeeded) {
      return;
    }
    that._removeLoadingSpinner();
    if (!timelapse.isPaused() || timelapse.isDoingLoopingDwell()) {
      that._wasPlayingBeforeDataLoad = true;
      timelapse.handlePlayPause();
    }
    var $loadingSpinner = $("<td class='loading-layer-spinner-small' data-loading-layer='" + that._layerDomId + "'></td>");
    $(".map-layer-div input#" + that._layerDomId).closest("td").after($loadingSpinner);
    timelapse.showSpinner("timeMachine");
  }, 300);
}

WebGLVectorTile2.prototype._removeLoadingSpinner = function() {
  this._spinnerNeeded = false;
  clearTimeout(this._loadingSpinnerTimer);
  if (this._wasPlayingBeforeDataLoad) {
    this._wasPlayingBeforeDataLoad = null;
    timelapse.play();
  }
  var $loadingSpinner = $('.loading-layer-spinner-small[data-loading-layer="' + this._layerDomId + '"]');
  $loadingSpinner.remove();
  if ($(".loading-layer-spinner-small").length == 0) {
    timelapse.hideSpinner("timeMachine");
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
  '  gl_PointSize = uSize;\n' +
  '  //gl_PointSize = 0.5;\n' +
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

WebGLVectorTile2.viirsFragmentShader =
  'precision mediump float;\n' +
  'void main() {\n' +
  '  vec3 color;\n' +
  '  color = vec3(.82, .22, .07);\n' +

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
"          //gl_PointSize = 1.0 * a_NCasualties;\n" +
'          float pointSize = 5.0;\n' +
'          if (a_NCasualties > 5.0) {\n' +
'            pointSize = a_NCasualties;\n' +
'          } else {\n' +
'            pointSize = 5.0;\n' +
'          }\n' +
'          gl_PointSize = max(10.0,300.0*smoothstep(5., 94., sqrt(pointSize)));\n' +
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

WebGLVectorTile2.uppsalaConflictVertexShader =
"        attribute vec4 a_centroid;\n" +
"        attribute float a_start_epoch;\n" +
"        attribute float a_end_epoch;\n" +
"        attribute float a_val;\n" +
"        uniform float u_epoch;\n" +
"        uniform float u_span;\n" +
"        uniform float u_size;\n" +
"        uniform mat4 u_map_matrix;\n" +
"        varying float v_alpha;\n" +
"        void main() {\n" +
"          if ( a_start_epoch > u_epoch) {\n" +
"            gl_Position = vec4(-1,-1,-1,-1);\n" +
"          } else if (u_epoch - a_end_epoch > u_span) {\n" +
"            gl_Position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"          else {\n" +
"            gl_Position = u_map_matrix * a_centroid;\n" +
"          }\n" +
"          v_alpha = (u_epoch - a_end_epoch) / u_span;\n" +
"          gl_PointSize = u_size * a_val;\n" +
"        }\n";


WebGLVectorTile2.uppsalaConflictFragmentShader =
"        precision mediump float;\n" +
"        varying float v_alpha;\n" +
"        void main() {\n" +
"          float r = 1.0 - v_alpha;\n" +
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

WebGLVectorTile2.bubbleMapVertexShader =
'      attribute vec4 a_Centroid;\n' +
'      attribute float a_Epoch1;\n' +
'      attribute float a_Val1;\n' +
'      attribute float a_Epoch2;\n' +
'      attribute float a_Val2;\n' +
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
'        gl_Position = position;\n' +
'        float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);\n' +
'        float size = (a_Val2 - a_Val1) * delta + a_Val1;\n' +
'        v_Val = size;\n' +
'        gl_PointSize = abs(u_Size * size);\n' +
'      }\n';

WebGLVectorTile2.bubbleMapFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      varying float v_Val;\n' +
'      uniform vec4 u_Color;\n' +
'      uniform float u_Mode;\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          if (u_Mode == 2.0) {\n' +
'            if (gl_PointCoord.x > 0.5) {\n' +
'              alpha = 0.0;\n' +
'            }\n' +
'          }\n' +
'          if (u_Mode == 3.0) {\n' +
'            if (gl_PointCoord.x < 0.5) {\n' +
'              alpha = 0.0;\n' +
'            }\n' +
'          }\n' +
'          vec4 circleColor = u_Color;\n' +
'          if (v_Val < 0.0) { circleColor[0] = 1.0; circleColor[1]=0.0; circleColor[2]=0.0; };\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +
'      }';


WebGLVectorTile2.bubbleMapWithPackedColorVertexShader =
'      attribute vec4 a_Centroid;\n' +
'      attribute float a_Epoch1;\n' +
'      attribute float a_Val1;\n' +
'      attribute float a_Epoch2;\n' +
'      attribute float a_Val2;\n' +
'      attribute float a_color;\n' +
'      uniform float u_Epoch;\n' +
'      uniform float u_Size;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_Val;\n' +
'      varying float v_color;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);\n' +
'        float size = (a_Val2 - a_Val1) * delta + a_Val1;\n' +
'        v_Val = size;\n' +
'        gl_PointSize = abs(u_Size * size);\n' +
'        v_color = a_color;\n' +
'      }\n';

WebGLVectorTile2.bubbleMapWithPackedColorFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      varying float v_Val;\n' +
'      varying float v_color;\n' +
'      uniform vec4 u_Color;\n' +
'      uniform float u_Mode;\n' +
'  vec4 unpackColor(float f) {\n' +
'      vec4 color;\n' +
'      color.b = floor(f / 256.0 / 256.0);\n' +
'      color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
'      color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
'      color.a = 255.;\n' +
'      return color / 256.0;\n' +
'    }\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          if (u_Mode == 2.0) {\n' +
'            if (gl_PointCoord.x > 0.5) {\n' +
'              alpha = 0.0;\n' +
'            }\n' +
'          }\n' +
'          if (u_Mode == 3.0) {\n' +
'            if (gl_PointCoord.x < 0.5) {\n' +
'              alpha = 0.0;\n' +
'            }\n' +
'          }\n' +
'          vec4 circleColor = unpackColor(v_color);\n' +
'          if (v_Val < 0.0) { circleColor[0] = 1.0; circleColor[1]=0.0; circleColor[2]=0.0; };\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +
'      }';

WebGLVectorTile2.bubbleMapWithColorMapFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      varying float v_Val;\n' +
'      uniform sampler2D u_Image;\n' +
'      uniform float u_Min;\n' +
'      uniform float u_Max;\n' +
'      uniform float u_Mode;\n' +
'      float scale(float v, float min, float max) {\n' +
'          return (v - min)/(max - min);\n' +
'      }\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          if (u_Mode == 2.0) {\n' +
'            if (gl_PointCoord.x > 0.5) {\n' +
'              alpha = 0.0;\n' +
'            }\n' +
'          }\n' +
'          if (u_Mode == 3.0) {\n' +
'            if (gl_PointCoord.x < 0.5) {\n' +
'              alpha = 0.0;\n' +
'            }\n' +
'          }\n' +
'          vec4 circleColor = texture2D(u_Image, vec2(scale(v_Val, u_Min, u_Max),scale(v_Val, u_Min, u_Max)));\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +
'      }';

WebGLVectorTile2.bivalentBubbleMapWithColorMapVertexShader =
'      attribute vec4 a_Centroid;\n' +
'      attribute float a_Epoch1;\n' +
'      attribute float a_PointVal1;\n' +
'      attribute float a_ColorVal1;\n' +
'      attribute float a_Epoch2;\n' +
'      attribute float a_PointVal2;\n' +
'      attribute float a_ColorVal2;\n' +
'      uniform float u_Epoch;\n' +
'      uniform float u_Size;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_PointVal;\n' +
'      varying float v_ColorVal;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);\n' +
'        float size = (a_PointVal2 - a_PointVal1) * delta + a_PointVal1;\n' +
'        v_PointVal = size;\n' +
'        v_ColorVal = (a_ColorVal2 - a_ColorVal1) * delta + a_ColorVal1;\n' +
'        gl_PointSize = abs(u_Size * size);\n' +
'      }\n';

WebGLVectorTile2.bivalentBubbleMapWithColorMapFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      varying float v_PointVal;\n' +
'      varying float v_ColorVal;\n' +
'      uniform sampler2D u_Image;\n' +
'      void main() {\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          vec4 circleColor = texture2D(u_Image, vec2(v_ColorVal,v_ColorVal));\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +
'      }';

WebGLVectorTile2.iomIdpVertexShader = "" +
"attribute vec4 a_coord;\n" +
"attribute float a_country;\n" +
"attribute float a_type;\n" +
"attribute float a_epoch1;\n" +
"attribute float a_val1;\n" +
"attribute float a_epoch2;\n" +
"attribute float a_val2;\n" +
"uniform mat4 u_map_matrix;\n" +
"uniform float u_point_size;\n" +
"uniform float u_epoch;\n" +
"uniform bool u_show_irq_idps;\n" +
"uniform bool u_show_syr_idps;\n" +
"uniform bool u_show_yem_idps;\n" +
"uniform bool u_show_lby_idps;\n" +
"uniform bool u_show_irq_returns;\n" +
"uniform bool u_show_syr_returns;\n" +
"uniform bool u_show_yem_returns;\n" +
"uniform bool u_show_lby_returns;\n" +
"varying float v_type;\n" +
"void main() {\n" +
"  vec4 position;\n" +
"        if (a_epoch1 > u_epoch || a_epoch2 <= u_epoch) {\n" +
"          position = vec4(-1,-1,-1,-1);\n" +
"        } else {\n" +
"          position = u_map_matrix * vec4(a_coord.x, a_coord.y, 0, 1);\n" +
"        }\n" +
"        //if (a_type == 0.0 && !u_show_idp) {\n" +
"        //  position = vec4(-1,-1,-1,-1);\n" +
"        //}\n" +
"        //if (a_type == 1.0 && !u_show_returns) {\n" +
"        //  position = vec4(-1,-1,-1,-1);\n" +
"        //}\n" +
"        if (a_country == 368.0) { \n" + // Iraq
"          if (a_type == 0.0 && !u_show_irq_idps) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"          if (a_type == 1.0 && !u_show_irq_returns) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"        }\n" +
"        if (a_country == 760.0) {\n" +
"          if (a_type == 0.0 && !u_show_syr_idps) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"          if (a_type == 1.0 && !u_show_syr_returns) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"        }\n" +
"        if (a_country == 887.0) {\n" +
"          if (a_type == 0.0 && !u_show_yem_idps) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"          if (a_type == 1.0 && !u_show_yem_returns) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"        }\n" +
"        if (a_country == 434.0) {\n" +
"          if (a_type == 0.0 && !u_show_lby_idps) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"          if (a_type == 1.0 && !u_show_lby_returns) {\n" +
"            position = vec4(-1,-1,-1,-1);\n" +
"          }\n" +
"        }\n" +
"  gl_Position = position;\n" +
"  float delta = (u_epoch - a_epoch1)/(a_epoch2 - a_epoch1);\n" +
"  float size = (a_val2 - a_val1) * delta + a_val1;\n" +
"  gl_PointSize = u_point_size * size;\n" +
"  v_type = a_type;\n" +
"}";

WebGLVectorTile2.iomIdpFragmentShader = "" +
"#extension GL_OES_standard_derivatives : enable\n" +
"precision mediump float;\n" +
"varying float v_type;\n" +
"void main() {\n" +
"  // set pixels in points to something that stands out\n" +
"  //float dist = distance(gl_PointCoord.xy, vec2(0.5, 0.5));\n" +
"  //float delta = fwidth(dist);\n" +
"  //float alpha = smoothstep(0.45-delta, 0.45, dist);\n" +
"  //gl_FragColor = vec4(.65, .07, .07, .75) * (1. - alpha);\n" +
'  vec4 color = vec4(.65, .07, .07, .95);\n' +
'  if (v_type == 1.0) {\n' +
'    color = vec4(0.07, .07, .65, .95);\n' +
'  }\n' +
'          float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'          dist = 1. - (dist * 2.);\n' +
'          dist = max(0., dist);\n' +
'          float delta = fwidth(dist);\n' +
'          float alpha = smoothstep(0.45-delta, 0.45, dist);\n' +
'          vec4 circleColor = color; //vec4(.65, .07, .07, .95);\n' +
'          vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);\n' +
'          float outerEdgeCenter = 0.5 - .01;\n' +
'          float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);\n' +
'          gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );\n' +

"}";

WebGLVectorTile2.choroplethMapVertexShader =
'      attribute vec4 a_Centroid;\n' +
'      attribute float a_Epoch1;\n' +
'      attribute float a_Val1;\n' +
'      attribute float a_Epoch2;\n' +
'      attribute float a_Val2;\n' +
'      uniform float u_Epoch;\n' +
'      uniform mat4 u_MapMatrix;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);\n' +
'        v_Val = (a_Val2 - a_Val1) * delta + a_Val1;\n' +
'      }\n';

WebGLVectorTile2.choroplethMapFragmentShader =
'      #extension GL_OES_standard_derivatives : enable\n' +
'      precision mediump float;\n' +
'      uniform sampler2D u_Image;\n' +
'      varying float v_Val;\n' +
'      void main() {\n' +
'        vec4 color = texture2D(u_Image, vec2(v_Val,0.));\n' +
'        gl_FragColor = vec4(color.r, color.g, color.b, 1.);\n' +
'        //gl_FragColor = vec4(1.0, 0.0, 0.0, 1.);\n' +
'      }\n';


WebGLVectorTile2.timeSeriesPointDataVertexShader =
'      //WebGLVectorTile2.timeSeriesPointDataVertexShader\n' +
'      attribute vec4 a_centroid;\n' +
'      attribute float a_epoch1;\n' +
'      attribute float a_val1;\n' +
'      attribute float a_epoch2;\n' +
'      attribute float a_val2;\n' +
'      uniform float u_max_value;\n' +
'      uniform float u_epoch;\n' +
'      uniform mat4 u_map_matrix;\n' +
'      varying float v_val;\n' +
'      varying float v_val1;\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_epoch1 > u_epoch || a_epoch2 <= u_epoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          position = u_map_matrix * vec4(a_centroid.x, a_centroid.y, 0, 1);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        float delta = (u_epoch - a_epoch1)/(a_epoch2 - a_epoch1);\n' +
'        v_val = (a_val2 - a_val1) * delta + a_val1;\n' +
'        v_val1 = a_val1;\n' +
'        if (a_val1 > 0.) {\n'+
'          gl_PointSize = 140. * smoothstep(10.0, u_max_value, sqrt(v_val)) + 10.;\n' +
'        } else {\n' +
'          gl_PointSize = 100.;\n' +
'        }\n' +
'      }\n';

WebGLVectorTile2.timeSeriesPointDataFragmentShader =
'      //WebGLVectorTile2.timeSeriesPointDataFragmentShader\n' +
  'precision mediump float;\n' +
  'varying float v_val;\n' +
  'varying float v_val1;\n' +
  'void main() {\n' +
  '  vec3 color;\n' +
  '  color = vec3(212./255., 212./255., 212./255.);\n' +
  '  float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
  '  dist = 1. - (dist * 2.);\n' +
  '  dist = max(0., dist);\n' +

  '  gl_FragColor = vec4(color, 1.) * dist;\n' +
  '}';

WebGLVectorTile2.tsipVertexShader =
  'attribute vec2 a_coord;\n' +
  'attribute float a_color;\n' +
  'attribute float a_epoch;\n' +
  'attribute float a_val;\n' +
  'uniform mat4 u_map_matrix;\n' +
  'uniform float u_epoch;\n' +
  'uniform float u_size;\n' +
  'varying float v_color;\n' +
  'void main() {\n' +
  '    vec4 position;\n' +
  '    if (a_epoch > u_epoch) {\n' +
  '        position = vec4(-1,-1,-1,-1);\n' +
  '        //position = u_map_matrix * vec4(a_coord, 0, 1);\n' +
  '    } else {\n' +
  '        position = u_map_matrix * vec4(a_coord, 0, 1);\n' +
  '    }\n' +
  '    gl_Position = position;\n' +
  '    gl_PointSize = u_size * a_val;\n' +
  '    v_color = a_color;\n' +
  '}\n';

WebGLVectorTile2.tsipFragmentShader =
'#extension GL_OES_standard_derivatives : enable\n' +
'precision mediump float;\n' +
'varying float v_color;\n' +
'  vec4 unpackColor(float f) {\n' +
'      vec4 color;\n' +
'      color.b = floor(f / 256.0 / 256.0);\n' +
'      color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
'      color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
'      color.a = 255.;\n' +
'      return color / 255.0;\n' +
'    }\n' +
'void main() {\n' +
'  float dist = length(gl_PointCoord.xy - vec2(0.5, 0.5));\n' +
'  dist = 1.0 - (dist * 2.);\n' +
'  dist = max(0.0, dist);\n' +
'  gl_FragColor =  unpackColor(v_color) * dist;\n' +
'}';

WebGLVectorTile2.pointFlowVertexShader =
'      //WebGLVectorTile2.pointFlowVertexShader\n' +
'      attribute vec4 a_p0;\n' +
'      attribute vec4 a_p1;\n' +
'      attribute vec4 a_p2;\n' +
'      attribute float a_epoch0;\n' +
'      attribute float a_epoch1;\n' +
'      uniform float u_epoch;\n' +
'      uniform float u_size;\n' +
'      uniform mat4 u_map_matrix;\n' +
'      varying float v_t\n;' +
'      vec4 bezier(float t, vec4 p0, vec4 p1, vec4 p2) {\n' +
'        return (1.0-t)*(1.0-t)*p0 + 2.0*(1.0-t)*t*p1 + t*t*p2;\n' +
'      }\n' +
'      void main() {\n' +
'        vec4 position;\n' +
'        if (a_epoch0 > u_epoch || a_epoch1 < u_epoch) {\n' +
'          position = vec4(-1,-1,-1,-1);\n' +
'        } else {\n' +
'          float t = 1.0 - (a_epoch1 - u_epoch)/(a_epoch1 - a_epoch0);\n' +
'        v_t = t;\n' +
'          position = u_map_matrix * bezier(t, a_p0, a_p1, a_p2);\n' +
'        }\n' +
'        gl_Position = position;\n' +
'        gl_PointSize = u_size;\n' +
'      }\n';

WebGLVectorTile2.pointFlowFragmentShader =
  'precision mediump float;\n' +
'  varying float v_t;\n' +
'  void main() {\n' +
'    float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'    dist = 1. - (dist * 2.);\n' +
'    dist = max(0., dist);\n' +
'    vec4 colorStart = vec4(.94,.94,.94,1.0);\n' +
'    vec4 colorEnd = vec4(.71,0.09,0.05,1.0);\n' +
'    gl_FragColor = mix(colorStart, colorEnd, v_t) * dist;\n' +
'  }\n';


WebGLVectorTile2.polygonVertexShader =
'attribute vec4 a_coord;\n' +
'attribute float a_color;\n' +
'uniform mat4 u_map_matrix;\n' +
'varying float v_color;\n' +
'void main() {\n' +
'    vec4 position;\n' +
'    position = u_map_matrix * a_coord;\n' +
'    gl_Position = position;\n' +
'    v_color = a_color;\n' +
'}\n';

WebGLVectorTile2.polygonFragmentShader =
'#extension GL_OES_standard_derivatives : enable\n' +
'  precision mediump float;\n' +
'  varying float v_color;\n' +
'  vec4 unpackColor(float f) {\n' +
'      vec4 color;\n' +
'      color.b = floor(f / 256.0 / 256.0);\n' +
'      color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
'      color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
'      color.a = 255.;\n' +
'      return color / 256.0;\n' +
'    }\n' +
'  void main() {\n' +
'    gl_FragColor = unpackColor(v_color);\n' +
'  }\n';


WebGLVectorTile2.lineStringVertexShader =
'attribute vec2 a_coord;\n' +
'uniform mat4 u_map_matrix;\n' +
'void main() {\n' +
'    gl_Position = u_map_matrix * vec4(a_coord, 0., 1.);\n' +
'}';


WebGLVectorTile2.lineStringFragmentShader =
'precision mediump float;\n' +
'uniform vec4 u_color;\n' +
'void main() {\n' +
'  gl_FragColor = u_color;\n' +
'}\n';

WebGLVectorTile2.expandedLineStringVertexShader =
'attribute vec2 a_coord;\n' +
'attribute vec2 a_normal;\n' +
'attribute float a_miter;\n' +
'uniform mat4 u_map_matrix;\n' +
'uniform float u_thickness;\n' +
'varying float v_edge;\n' +
'void main() {\n' +
'    v_edge = sign(a_miter);\n' +
'    vec2 position = a_coord + vec2(a_normal * u_thickness/2.0 * a_miter);\n' +
'    gl_Position = u_map_matrix * vec4(position, 0., 1.);\n' +
'    gl_PointSize = 25.0;\n' +
'}\n';


WebGLVectorTile2.expandedLineStringFragmentShader =
'  precision mediump float;\n' +
'  uniform vec3 u_color;\n' +
'  uniform float u_inner;\n' +
'  varying float v_edge;\n' +
'  void main() {\n' +
'    float v = 1.0 - abs(v_edge);\n' +
'    v = smoothstep(0.65, 0.7, v*u_inner); \n' +
'    gl_FragColor = mix(vec4(u_color, 1.0), vec4(0.0), v);\n' +
'  }\n';


/* x,y,size,color,epoch */
WebGLVectorTile2.PointSizeColorEpochVertexShader =
'attribute vec4 a_coord;\n' +
'attribute float a_size;\n' +
'attribute float a_color;\n' +
'attribute float a_epoch;\n' +
'uniform mat4 u_map_matrix;\n' +
'uniform float u_size;\n' +
'uniform float u_epoch;\n' +
'uniform float u_epoch_range;\n' +
'varying float v_color;\n' +
'void main() {\n' +
'    vec4 position;\n' +
'    if (a_epoch > u_epoch + u_epoch_range || a_epoch < u_epoch) {\n' +
'        position = vec4(-1.,-1.,-1.,-1.);\n' +
'    } else {\n' +
'        position = u_map_matrix * a_coord;\n' +
'    }\n' +
'    gl_Position = position;\n' +
'    gl_PointSize = u_size*a_size;\n' +
'    v_color = a_color;\n' +
'}\n';

WebGLVectorTile2.PointSizeColorVertexShader =
'attribute vec4 a_coord;\n' +
'attribute float a_size;\n' +
'attribute float a_color;\n' +
'uniform mat4 u_map_matrix;\n' +
'uniform float u_size;\n' +
'varying float v_color;\n' +
'void main() {\n' +
'    vec4 position;\n' +
'    position = u_map_matrix * a_coord;\n' +
'    gl_Position = position;\n' +
'    gl_PointSize = u_size*a_size;\n' +
'    v_color = a_color;\n' +
'}\n';


WebGLVectorTile2.PointColorFragmentShader =
'#extension GL_OES_standard_derivatives : enable\n' +
'  precision mediump float;\n' +
'  varying float v_color;\n' +
'  vec4 unpackColor(float f) {\n' +
'      vec4 color;\n' +
'      color.b = floor(f / 256.0 / 256.0);\n' +
'      color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
'      color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
'      color.a = 255.;\n' +
'      return color / 256.0;\n' +
'    }\n' +
'  void main() {\n' +
'    float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'    dist = 1. - (dist * 2.);\n' +
'    dist = max(0., dist);\n' +
'    gl_FragColor = unpackColor(v_color) * dist;\n' +
'  }\n';

WebGLVectorTile2.PointColorStartEpochEndEpochVertexShader =
'attribute vec4 a_coord;\n' +
'attribute float a_color;\n' +
'attribute float a_epoch0;\n' +
'attribute float a_epoch1;\n' +
'uniform mat4 u_map_matrix;\n' +
'uniform float u_epoch;\n' +
'uniform float u_size;\n' +
'varying float v_color;\n' +
'void main() {\n' +
'    vec4 position;\n' +
'    if (a_epoch0 > u_epoch || a_epoch1 < u_epoch) {\n' +
'        position = vec4(-1.,-1.,-1.,-1.);\n' +
'    } else {\n' +
'        position = u_map_matrix * a_coord;\n' +
'    }\n' +
'    gl_Position = position;\n' +
'    gl_PointSize = u_size*2.0;\n' +
'    v_color = a_color;\n' +
'}\n';

WebGLVectorTile2.PointColorStartEpochEndEpochFragmentShader =
'#extension GL_OES_standard_derivatives : enable\n' +
'  precision mediump float;\n' +
'  varying float v_color;\n' +
'  vec4 unpackColor(float f) {\n' +
'      vec4 color;\n' +
'      color.b = floor(f / 256.0 / 256.0);\n' +
'      color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
'      color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
'      color.a = 255.;\n' +
'      return color / 256.0;\n' +
'    }\n' +
'  void main() {\n' +
'    float dist = length(gl_PointCoord.xy - vec2(.5, .5));\n' +
'    dist = 1. - (dist * 2.);\n' +
'    dist = max(0., dist);\n' +
'    gl_FragColor = unpackColor(v_color) * dist;\n' +
'  }\n';


WebGLVectorTile2.spCrudeVertexShader =
'attribute vec4 a_coord_0;\n' +
'attribute float a_epoch_0;\n' +
'attribute vec4 a_coord_1;\n' +
'attribute float a_epoch_1;\n' +
'attribute float a_color;\n' +
'uniform mat4 u_map_matrix;\n' +
'uniform float u_epoch;\n' +
'uniform float u_size;\n' +
'varying float v_color;\n' +
'void main() {\n' +
'    vec4 position;\n' +
'    if (a_epoch_0 > u_epoch || a_epoch_1 < u_epoch) {\n' +
'        position = vec4(-1.,-1.,-1.,-1.);\n' +
'    } else {\n' +
'          float t = (u_epoch - a_epoch_0)/(a_epoch_1 - a_epoch_0);\n' +
'          position = u_map_matrix * ((a_coord_1 - a_coord_0) * t + a_coord_0);\n' +
'    }\n' +
'    gl_Position = position;\n' +
'    gl_PointSize = u_size*3.;\n' +
'    v_color = a_color;\n' +
'}\n';

WebGLVectorTile2.spCrudeFragmentShader =
'  precision mediump float;\n' +
'  varying float v_color;\n' +
'  vec4 unpackColor(float f) {\n' +
'      vec4 color;\n' +
'      color.b = floor(f / 256.0 / 256.0);\n' +
'      color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
'      color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
'      color.a = 255.;\n' +
'      return color / 256.0;\n' +
'    }\n' +
'  void main() {\n' +
'    gl_FragColor = unpackColor(v_color);\n' +
'  }\n';

WebGLVectorTile2.sitc4r2VertexShader = '' +
'  attribute vec4 a_p0;\n' +
'  attribute vec4 a_p2;\n' +
'  attribute vec4 a_p1;\n' +
'  attribute float a_epoch0;\n' +
'  attribute float a_epoch1;\n' +
'  uniform float u_epoch;\n' +
'  uniform mat4 u_map_matrix;\n' +
'  varying float v_t;\n' +
'  vec2 bezier(float t, vec2 p0, vec2 p1, vec2 p2) {\n' +
'    return (1.0-t)*(1.0-t)*p0 + 2.0*(1.0-t)*t*p1 + t*t*p2;\n' +
'  }\n' +
'  void main() {\n' +
'    vec4 position = vec4(-1,-1,-1,-1);\n' +
'    if (a_epoch0 <= u_epoch && u_epoch <= a_epoch1) {\n' +
'      float t = (u_epoch - a_epoch0)/(a_epoch1 - a_epoch0);\n' +
'      vec2 pos = bezier(t, a_p0.xy, a_p1.xy, a_p2.xy);\n' +
'      position = u_map_matrix * vec4(pos.x, pos.y, 0.0, 1.0);\n' +
'      v_t = t;\n' +
'    }\n' +
'    gl_Position = position;\n' +
'    gl_PointSize = 1.0;\n' +
'  }\n';

WebGLVectorTile2.sitc4r2FragmentShader = '' +
'  precision mediump float;\n' +
'  varying float v_t;\n' +
'  uniform vec3 u_end_color;\n' +
'  void main() {\n' +
'    vec4 colorStart = vec4(.94,.76,.61,1.0);\n' +
'    vec4 colorEnd = vec4(u_end_color,1.0);\n' +
'    gl_FragColor = mix(colorStart, colorEnd, v_t);\n' +
'  }\n';

//////////////////////

WebGLVectorTile2.basicDrawPoints = function(instance_options) {
  return function(transform, options) {
    if (!this._ready) return;
    var gl = this.gl;
    gl.useProgram(this.program);
    gl.enable( gl.BLEND );
    gl.blendEquationSeparate( gl.FUNC_ADD, gl.FUNC_ADD );
    gl.blendFuncSeparate( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

    gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

    var tileTransform = new Float32Array(transform);

    // Set u_size, if present
    if (this.program.u_size != undefined) {
      var pointSize = 1; // default
      if (typeof instance_options.pointSize == 'number') {
	pointSize = instance_options.pointSize;
      } else if (typeof instance_options.pointSize == 'object') {
	var zoomScale = Math.log2(-transform[5]);
	var countryLevelZoomScale = -3;
	var blockLevelZoomScale = 9;
	var countryPointSizePixels = instance_options.pointSize[0];
	var blockPointSizePixels = instance_options.pointSize[1];

	pointSize = countryPointSizePixels * Math.pow(blockPointSizePixels / countryPointSizePixels, (zoomScale - countryLevelZoomScale) / (blockLevelZoomScale - countryLevelZoomScale));
	gl.uniform1f(this.program.u_size, pointSize);
      }
    }

    // Set u_epoch, if present
    if (this.program.u_epoch != undefined) {
      gl.uniform1f(this.program.u_epoch, options.currentTime/1000.);
    }

    scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
    gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

    var attrib_offset = 0;
    var num_attributes = this.numAttributes - 0;

    var candidate_attribs = [
      {name: 'a_coord', size: 2},
      {name: 'a_color', size: 1},
      {name: 'a_start_epoch', size: 1},
      {name: 'a_end_epoch', size: 1}
    ];

    for (var i = 0; i < candidate_attribs.length; i++) {
      var attrib_name = candidate_attribs[i].name;
      var attrib_size = candidate_attribs[i].size;
      if (this.program[attrib_name] != undefined) {
	gl.enableVertexAttribArray(this.program[attrib_name]);
	gl.vertexAttribPointer(this.program[attrib_name], attrib_size, gl.FLOAT, false, num_attributes * 4, attrib_offset);
	attrib_offset += attrib_size * 4;
      }
    }

    console.assert(num_attributes == attrib_offset / 4);

    var npoints = Math.floor(this._pointCount);
    gl.drawArrays(gl.POINTS, 0, npoints);
    perf_draw_points(npoints);
    gl.disable(gl.BLEND);
  }
}

WebGLVectorTile2.basicVertexColorStartEpochEndEpochShader =
  'attribute vec2 a_coord;\n' +
  'attribute float a_color;\n' +
  'attribute float a_start_epoch; /* inclusive */\n' +
  'attribute float a_end_epoch; /* exclusive */\n' +
  'uniform float u_size;\n' +
  'uniform mat4 u_map_matrix;\n' +
  'uniform float u_epoch;\n' +
  'varying float v_color;\n' +
  'void main() {\n' +
  '  if (a_start_epoch <= u_epoch && u_epoch < a_end_epoch) {\n' +
  '    gl_Position = vec4(a_coord.x * u_map_matrix[0][0] + u_map_matrix[3][0], a_coord.y * u_map_matrix[1][1] + u_map_matrix[3][1],0,1);\n' +
  '  } else {\n' +
  '    gl_Position = vec4(-1,-1,-1,-1);\n' +
  '  }\n' +
  '  gl_PointSize = u_size;\n' +
  '  v_color = a_color;\n' +
  '}\n';

WebGLVectorTile2.basicVertexColorShader =
  'attribute vec2 a_coord;\n' +
  'attribute float a_color;\n' +
  'uniform float u_size;\n' +
  'uniform mat4 u_map_matrix;\n' +
  'varying float v_color;\n' +
  'void main() {\n' +
  '  gl_Position = vec4(a_coord.x * u_map_matrix[0][0] + u_map_matrix[3][0], a_coord.y * u_map_matrix[1][1] + u_map_matrix[3][1],0,1);\n' +
  '  gl_PointSize = u_size;\n' +
  '  v_color = a_color;\n' +
  '}\n';

WebGLVectorTile2.basicSquareFragmentShader =
  'precision lowp float;\n' +
  'varying float v_color;\n' +
  'vec3 unpackColor(float f) {\n' +
  '  vec3 color;\n' +
  '  color.b = floor(f / 256.0 / 256.0);\n' +
  '  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);\n' +
  '  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);\n' +
  '  return color / 256.0;\n' +
  '}\n' +
  'void main() {\n' +
  '  gl_FragColor = vec4(unpackColor(v_color),1.0);\n' +
  '}\n';

