declare var Papa: any;
/// <reference path="../../js/papaparse.min.js"/>

declare var earcut: any;
/// <reference path="../../js/earcut.min.js"/>

/// <reference path="perf.js"/>

declare var d3: any;

import { gEarthTime } from './EarthTime'
import { Tile } from './Tile'
import { searchCountryList, COUNTRY_POLYGONS_RESOURCE } from './LayerFactory';
import { Resource, parseAndIndexGeojson } from './Resource';
import { EarthTimeCsvTable } from './EarthTimeCsvTable';
import { Workers } from './Workers';
import { TileIdx } from './TileIdx';
import { DrawOptions, DrawFunction } from './Layer';
import { WebGLVectorLayer2 } from './WebGLVectorLayer2';
import { Utils } from './Utils';

function drawsEveryFrame(func: DrawFunction) {
  func.drawEveryFrame = true;
}

export class WebGLVectorTile2 extends Tile {
  _layer: WebGLVectorLayer2;
  _url: string;
  _ready: boolean;
  externalGeojson: any;
  _noValue: any;
  _uncertainValue: any;
  _loadingSpinnerTimer: any;
  _wasPlayingBeforeDataLoad: boolean;
  _defaultColor: number[];
  _image: HTMLImageElement;
  geojsonData: any;
  scalingFunction: any;
  colorScalingFunction: any;
  static errorsAlreadyShown: any;
  static errorDialog: any;
  startTime: number;
  xhr: XMLHttpRequest;
  timings: number[];
  windData: any;
  windTexture: any;
  currentWindTexture: any;
  backgroundTexture: any;
  screenTexture: any;
  fadeOpacity: number;
  speedFactor: number;
  dropRate: number;
  dropRateBump: number;
  drawProgram: any;
  screenProgram: any;
  updateProgram: any;
  mapProgram: any;
  quadBuffer: any;
  framebuffer: any;
  numParticles: number;
  colorRampTexture: any;
  _sitc4r2Code: string;
  _exporters: any[];
  _importers: any[];
  _scale: number;
  buffers: {};
  worker: any;
  _maxPointValue: any;
  _minPointValue: any;
  _maxColorValue: any;
  _minColorValue: any;
  jsondata: any;
  _radius: any;
  _maxValue: number;
  _minValue: number;
  _timeVariableRegions: any;
  epochs: any;
  _triangleLists: any[];
  valuesWidth: number;
  nRegionsPerRow: number;
  valuesHeight: number;
  _valuesTexture: any;
  static _totalBtiTime: number;
  static _totalBtiCount: any;
  _texture: any;
  _pointCount: number;
  _data: Float32Array;
  _arrayBuffer: any;
  _arrayBuffers: any[];
  _indexBuffer: any;
  _deleted: boolean;
  static dotScale: number;
  tl: Float32Array;
  br: Float32Array;
  _spinnerNeeded: boolean;
  _population?: number;

  constructor(layer: WebGLVectorLayer2, tileidx: TileIdx, bounds: any, opt_options: { drawFunction?: any; externalGeojson?: any; noValue?: any; uncertainValue?: any; scalingFunction?: any; colorScalingFunction?: any; layerId?: any; }) {
    // This line must be first or bubble maps (and likely other things) break.
    // This does go against the rule of super being the first call of a constructor.
    gEarthTime.glb.gl.getExtension("OES_standard_derivatives");

    super(layer, tileidx, bounds, opt_options);

    this._layer = layer;
    this._url = tileidx.expandUrl(this._layer._tileUrl, this._layer);
    this._ready = false;


    var opt_options = opt_options || {};
    this.draw = opt_options.drawFunction || this._drawLines;
    this.externalGeojson = opt_options.externalGeojson;
    this._noValue = opt_options.noValue || 'xxx';
    this._uncertainValue = opt_options.uncertainValue || '. .';
    this._loadingSpinnerTimer = null;
    this._wasPlayingBeforeDataLoad = false;
    this._defaultColor = [0.1, 0.1, 0.5, 1.0];


    if (this._layer.imageSrc) {
      this._image = new Image();
      this._image.crossOrigin = "anonymous";
      this._image.src = this._layer.imageSrc;
      var that = this;
      this._image.onload = function () {
        that.loadDataFunction();
      };
    }
    else if (typeof (this.externalGeojson) != "undefined" && this.externalGeojson != "") {
      var that = this;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', that.externalGeojson);
      xhr.onload = function () {
        that.geojsonData = JSON.parse(this.responseText);
        that.loadDataFunction();
      };
      xhr.send();
    }
    else {
      this.loadDataFunction();
    }

    if (opt_options.scalingFunction) {
      this.scalingFunction = opt_options.scalingFunction;
    }

    if (opt_options.colorScalingFunction) {
      this.colorScalingFunction = opt_options.colorScalingFunction;
    }

    if (opt_options.layerId) {
      this._layer.layerId = opt_options.layerId;
    }
  }
  logPrefix() {
    return `${Utils.logPrefix()} WebGLVectorTile2`;
  }

  _showErrorOnce(msg: string | number) {
    var tileUrl = this._url;
    if (!WebGLVectorTile2.errorsAlreadyShown[msg]) {
      WebGLVectorTile2.errorsAlreadyShown[msg] = true;

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
        buttons: { Ok: function () { $(this).dialog("close"); } },
        open: function () { $(this).find(':link').blur(); }
      });
    }
  }
  _defaultDataLoaded() {
    // Default tile loaded function
  }
  _loadData() {
    var that = this;
    var float32Array: Float32Array;

    this.startTime = new Date().getTime();

    this.xhr = new XMLHttpRequest();
    this.xhr.open('GET', that._url);
    this.xhr.responseType = 'arraybuffer';

    this.timings = [new Date().getTime()];

    this.xhr.onreadystatechange = function (ev) {
      var readyState = that.xhr.readyState;
      if (readyState)
        that.timings[readyState] = new Date().getTime();
    };

    this.xhr.onload = function () {

      if (this.status >= 400) {
        //var msg = String.fromCharCode.apply(null, new Uint8Array(this.response));
        //msg = msg.replace(/<h.*?>.*?<\/h.*?>/, '');  // Remove first header, which is status code
        //console.log(msg);
        float32Array = new Float32Array([]);
      }
      else {
        float32Array = new Float32Array(this.response);
        //perf_receive(float32Array.length * 4, new Date().getTime() - that.startTime);
      }
      that.setDataFunction(float32Array);
      if (that._layer.layerId) {
        that.dataLoadedFunction(that._layer.layerId);
      }
    };
    this.xhr.onerror = function () {
      that.setDataFunction(new Float32Array([]));
    };

    this.xhr.onabort = function () {
      // Abort logic
    };
    this.xhr.send();
  }
  _loadGeojsonData() {
    var that = this;
    var data: string;

    this.xhr = new XMLHttpRequest();
    this.xhr.open('GET', that._url);

    this.xhr.onload = function () {
      if (this.status >= 400) {
        data = "";
      }
      else {
        data = JSON.parse(this.responseText);
      }
      that.setDataFunction(data, that._layer.setDataOptions);
    };
    this.xhr.onerror = function () {
      that.setDataFunction('');
    };
    this.xhr.send();
  }
  _setWindVectorsData(data: any) {
    console.log("_setWindVectorsData");
    var that = this;
    this.windData = data;

    var windImage = new Image();
    windImage.crossOrigin = "anonymous";
    this.windData.image = windImage;
    windImage.src = this._url.replace("json", "png");

    /*
    var emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    this.backgroundTexture = glb.createTexture(gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
    this.screenTexture = glb.createTexture(gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
    */
    this.resizeWindVectors();
    gEarthTime.timelapse.addResizeListener(function () { that.resizeWindVectors(); });

    windImage.onload = function () {
      that.windTexture = that.glb.createTexture(that.gl.LINEAR, that.windData.image);
      that.currentWindTexture = that.glb.createTexture(that.gl.LINEAR, that.windData.image);
      that.dataLoadedFunction(that._layer.layerId);
      that._ready = true;

    };


  }
  resizeWindVectors() {
    var gl = this.gl;

    var emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    this.backgroundTexture = this.glb.createTexture(gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
    this.screenTexture = this.glb.createTexture(gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);

  }
  _loadWindVectorsData() {
    console.log('_loadWindVectorsData');
    this.fadeOpacity = 0.996; // how fast the particle trails fade on each frame
    this.speedFactor = 0.25; // how fast the particles move
    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed

    var glb = this.glb;

    this.drawProgram = glb.programFromSources(
      WebGLVectorTile2Shaders.WindVectorsShaders_drawVertexShader, WebGLVectorTile2Shaders.WindVectorsShaders_drawFragmentShader);
    this.screenProgram = glb.programFromSources(
      WebGLVectorTile2Shaders.WindVectorsShaders_quadVertexShader, WebGLVectorTile2Shaders.WindVectorsShaders_screenFragmentShader);
    this.updateProgram = glb.programFromSources(
      WebGLVectorTile2Shaders.WindVectorsShaders_quadVertexShader, WebGLVectorTile2Shaders.WindVectorsShaders_updateFragmentShader);
    this.mapProgram = glb.programFromSources(
      WebGLVectorTile2Shaders.WindVectorsShaders_mapVertexShader, WebGLVectorTile2Shaders.WindVectorsShaders_mapFragmentShader);

    //this.quadBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
    this.quadBuffer = glb.createBuffer(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
    this.framebuffer = glb.gl.createFramebuffer();

    //this.numParticles = 16384;
    this.numParticles = 8192;


    var that = this;

    this.xhr = new XMLHttpRequest();
    this.xhr.open('GET', that._url);

    this.xhr.onload = function () {
      if (this.status >= 400) {
        that.setDataFunction('');
      }
      else {
        var data = JSON.parse(this.responseText);
        if (typeof data.defaultRampColors != "undefined") {
          defaultRampColors = data.defaultRampColors;
        }
        that.colorRampTexture = glb.createTexture(that.gl.LINEAR, getColorRamp(defaultRampColors), 16, 16);
        if (typeof data.defaultRampColors != "undefined") {
          defaultRampColors = data.defaultRampColors;
        }
        if (typeof data.numParticles != "undefined") {
          that.numParticles = data.numParticles;
        }
        that.setDataFunction(data);
      }
    };
    this.xhr.onerror = function () {
      that.setDataFunction('');
    };
    this.xhr.send();

  }
  _loadSitc4r2Data() {
    var parseQueryString = function (queryString: string) {
      var params = {}, queries: string | any[], temp: any[], i: number, l: number;
      // Split into key/value pairs
      queries = queryString.split("&");
      // Convert the array of strings into an object
      for (i = 0, l = queries.length; i < l; i++) {
        temp = queries[i].split('=');
        params[temp[0]] = temp[1];
      }
      return params;
    };

    var re = /([a-z0-9]{1,})\/([0-9]{4}).json/g;
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
      var qsa: any = parseQueryString(queryString);
      this._exporters = typeof qsa.exporters == "undefined" || qsa.exporters == "" ? [] : qsa.exporters.split(",");
      this._importers = typeof qsa.importers == "undefined" || qsa.importers == "" ? [] : qsa.importers.split(",");
      if (typeof qsa['scale'] != "undefined") {
        this._scale = parseFloat(qsa['scale']);
      }
    }

    this.buffers = {};
    var that = this;
    if (typeof this.worker == "undefined") {
      this.worker = new Worker('sitc4r2-worker.js');
      this.worker.onmessage = function (e: { data: { [x: string]: any; year: any; code: any; error: any; scale: any; }; }) {
        if (typeof e.data["year"] != "undefined") {
          var year = e.data.year;
          var code = e.data.code;
          if (!e.data.error) {
            var scale = e.data.scale;
            var array = e.data["array"];
            that._setSitc4r2BufferData(code, year, new Float32Array(array));
          }
          else {
            if (!that.buffers[code]) {
              that.buffers[code] = {};
            }
            that.buffers[code][year] = {};
          }
          that.buffers[code][year].ready = true;
        }
      };
    }
    this._ready = true;
    //var layerId = this._layer._tileView._layerDomId.split('-')[2];
    //this._layer.layerId = layerId;
    //this.dataLoadedFunction(layerId);

  }
  _loadBivalentBubbleMapDataFromCsv() {
    var that = this;
    var data: string;

    this._maxPointValue = null;
    this._minPointValue = null;

    this._maxColorValue = null;
    this._minColorValue = null;

    var proj = new org.gigapan.timelapse.MercatorProjection(
      -180, 85.05112877980659, 180, -85.05112877980659,
      256, 256);


    function scaleValues(fnc: (arg0: any) => any, arr: any[]) {
      var ret = [];
      arr.forEach(function (x: any[]) {
        var scaled = [];
        x.forEach(function (y: any) {
          scaled.push(fnc(y));
        });
        ret.push(scaled);
      });
      return ret;
    }

    function setMinMaxPointValue(arr: any[]) {
      arr.forEach(function (xx: number) {
        var x = Math.abs(xx);
        if (that._maxPointValue == null || that._maxPointValue < x) {
          that._maxPointValue = x;
        }
        if (that._minPointValue == null || that._minPointValue > x) {
          that._minPointValue = x;
        }
      });
    }

    function setMinMaxColorValue(arr: any[]) {
      arr.forEach(function (xx: number) {
        var x = Math.abs(xx);
        if (that._maxColorValue == null || that._maxColorValue < x) {
          that._maxColorValue = x;
        }
        if (that._minColorValue == null || that._minColorValue > x) {
          that._minColorValue = x;
        }
      });
    }

    function setRow(arr: string | any[]) {
      var ret = [];
      var lastValue = 0.0;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] != "") {
          ret.push(parseFloat(arr[i]));
          lastValue = parseFloat(arr[i]);
        }
        else {
          ret.push(lastValue);
        }
      }
      ret.push(lastValue);
      ret.push(lastValue);
      return ret;
    }

    function duplicateRow(offset: number, arr: any[]) {
      var dup = [];
      arr.slice(offset).forEach(function (x: any) {
        var x1 = x;
        dup.push(x1, x);
      });
      return dup.slice(1, -1);
    }

    function getCentroidFromCsvData(row: any[]) {
      var latlng = { lat: row[1], lng: row[2] };
      var xy = proj.latlngToPoint(latlng);
      return [xy.x, xy.y];
    }

    function getEpochs(offset: number, arr: string | any[]) {
      var ret = [];
      for (var i = offset; i < arr.length; i++) {
        var date = arr[i];

        var epoch = parseDateStr(date);
        if (isNaN(epoch as number)) {
          break;
        }
        ret.push(epoch);
      }
      ret.push(ret[ret.length - 1] + ret[ret.length - 1] - ret[ret.length - 2]);
      return ret;
    };

    this.xhr = new XMLHttpRequest();
    this.xhr.open('GET', that._url);
    this.xhr.onload = function () {
      if (this.status >= 400) {
        data = "";
      }
      else {
        var csvdata = this.responseText;
        that.jsondata = Papa.parse(csvdata, { header: false });
        var header = that.jsondata.data[0];
        var has_lat_lon = (
          header[1].substr(0, 3).toLowerCase() == 'lat' &&
          header[2].substr(0, 3).toLowerCase() == 'lon');
        var potential_packedColor_col = has_lat_lon ? 3 : 1;
        var has_packedColor = (header[potential_packedColor_col] && header[potential_packedColor_col].substr(0, 11).toLowerCase() == 'packedcolor');
        var first_data_col = has_packedColor ? (has_lat_lon ? 4 : 2) : (has_lat_lon ? 3 : 1);

        var epochs = duplicateRow(0, getEpochs(first_data_col, header));
        var pointValues = [];
        var colorValues = [];
        var centroids = [];
        for (var i = 1; i < that.jsondata.data.length; i += 2) {
          if (that.jsondata.data[i] == "") {
            break;
          }
          var pointRow = that.jsondata.data[i];
          var colorRow = that.jsondata.data[i + 1];
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
      that._layer.radius = radius; // set the radius for the layer
      that.colorScalingFunction = colorScalingFunction;

      var scaledPointValues = scaleValues(that._radius, pointValues);
      var scaledColorValues = scaleValues(that.colorScalingFunction, colorValues);
      var points = [];
      for (var i = 0; i < centroids.length; i++) {
        for (var j = 0; j < epochs.length; j += 2) {
          var point: any = {};
          point.centroid = centroids[i];
          point.pointVal1 = scaledPointValues[i][j];
          point.pointVal2 = scaledPointValues[i][j + 1];
          point.colorVal1 = scaledColorValues[i][j];
          point.colorVal2 = scaledColorValues[i][j + 1];
          point.epoch1 = epochs[j];
          point.epoch2 = epochs[j + 1];
          points.push(point);
        }
      }

      points.sort(function (a, b) {
        return Math.abs(b.pointVal2) - Math.abs(a.pointVal2);
      });

      var flatPoints = [];
      for (var i = 0; i < points.length; i++) {
        flatPoints.push(points[i].centroid[0]);
        flatPoints.push(points[i].centroid[1]);
        flatPoints.push(points[i].epoch1);
        flatPoints.push(points[i].pointVal1);
        flatPoints.push(points[i].colorVal1);
        flatPoints.push(points[i].epoch2);
        flatPoints.push(points[i].pointVal2);
        flatPoints.push(points[i].colorVal2);
        if (has_packedColor) {
          flatPoints.push(points[i]["packedColor"]);
        }
      }

      that.setDataFunction(new Float32Array(flatPoints));
      //that._setData([]);
      that.dataLoadedFunction(that._layer.layerId);
    };

    this.xhr.onerror = function () {
      that.setDataFunction('');
    };

    this.xhr.send();
  }
  _loadBubbleMapDataFromCsv() {
    var that = this;

    var proj = new org.gigapan.timelapse.MercatorProjection(
      -180, 85.05112877980659, 180, -85.05112877980659,
      256, 256);

    var data: string;
    var noValue = this._noValue;
    var uncertainValue = this._uncertainValue;

    this.xhr = new XMLHttpRequest();
    this.xhr.open('GET', that._url);

    this.xhr.onload = function () {
      if (this.status >= 400) {
        data = "";
      }
      else {
        var csvdata = this.responseText;
        that.jsondata = Papa.parse(csvdata, { header: false });
        var header = that.jsondata.data[0];
        var has_lat_lon = (
          header[1].substr(0, 3).toLowerCase() == 'lat' &&
          header[2].substr(0, 3).toLowerCase() == 'lon');
        var potential_packedColor_col = has_lat_lon ? 3 : 1;
        var has_packedColor = (header[potential_packedColor_col] && header[potential_packedColor_col].substr(0, 11).toLowerCase() == 'packedcolor');
        var first_data_col = has_packedColor ? (has_lat_lon ? 4 : 2) : (has_lat_lon ? 3 : 1);

        var epochs = [];
        var points = [];
        var maxValue = 0;
        var minValue = 1e6; //TODO Is this an ok value?

        function getValue(rawVal: any) {
          var val = rawVal;
          if (val == noValue || val == uncertainValue) {
            val = 0.0;
          }
          else {
            val = parseFloat(val);
          }
          return val;
        }

        function setMinMaxValue(val: number) {
          if (val > maxValue) {
            maxValue = val;
          }
          if (val < minValue) {
            minValue = val;
          }
        }

        for (var i = first_data_col; i < header.length; i++) {
          var date = header[i];

          var epoch = parseDateStr(date);
          if (isNaN(epoch as number)) {
            break;
          }
          epochs[i] = epoch;
        }

        for (var i = 1; i < that.jsondata.data.length; i++) {
          var country = that.jsondata.data[i];
          if (that.geojsonData == null) {
            // @ts-ignore
            that.geojsonData = COUNTRY_CENTROIDS; // TODO: load this as resource
          }
          var feature = searchCountryList(that.geojsonData, country[0]);
          var centroid = ["", ""];
          var packedColor = null;
          // Extract centroids
          if (has_lat_lon && country[1] != '') {
            var latlng = { lat: country[1], lng: country[2] };
            var xy = proj.latlngToPoint(latlng);
            centroid = [xy.x, xy.y];
            if (has_packedColor) {
              packedColor = country[3];
            }
          }
          else if (!feature.hasOwnProperty("geometry")) {
            console.log(`${that._layer.layerId}: Could not find geometry "${country[0]}"`);
            continue;
          }
          else if (!feature.properties.hasOwnProperty('webmercator')) {
            var latlng = { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] };
            var xy = proj.latlngToPoint(latlng);
            centroid = [xy.x, xy.y];
            if (has_packedColor) {
              packedColor = country[1];
            }
          }
          else {
            centroid = feature['properties']['webmercator'];
            if (has_packedColor) {
              packedColor = country[1];
            }
          }
          // For all non-empty centroids, build indexes
          if (centroid[0] != "" && centroid[1] != "") {
            var idx = [];
            // Get indexes of non-blank values
            for (var j = first_data_col; j < country.length; j++) {
              var val = country[j].replace(/,/g, "");
              if (val !== '') { 
                val = getValue(val);
                setMinMaxValue(Math.abs(val));
                var point: any = {
                  centroid: centroid,
                  epoch1: epochs[j],
                  val1: val
                };
                if (j < country.length - 1) {
                  var val2 = country[j+1].replace(/,/g, "");
                  if (val2 !== '') {
                    val2 = getValue(val2);
                    setMinMaxValue(Math.abs(val2));
                    point.epoch2 = epochs[j+1];
                    point.val2 = val2;
                  } else {
                    point.val2 = val;
                    point.epoch2 = epochs[j+1];
                  }
                } else {
                  var span = epochs[j] - epochs[j-1]; 
                  point.val2 = val;
                  point.epoch2 = point.epoch1 + span;                 
                }
                if (has_packedColor) {
                  point.packedColor = packedColor;
                }
                points.push(point);  
              } 
            }
          }
        }
        that._maxValue = maxValue;
        that._minValue = minValue;
        var radius = eval(that.scalingFunction);
        that._radius = radius;
        that._layer.radius = radius; // Set the radius for the layer
        for (var i = 0; i < points.length; i++) {
          points[i].val1 = radius(points[i].val1);
          points[i].val2 = radius(points[i].val2);
        }
      }

      points.sort(function (a, b) {
        return Math.abs(b.val2) - Math.abs(a.val2);
      });
      var flatPoints = [];
      for (var i = 0; i < points.length; i++) {
        flatPoints.push(points[i].centroid[0]);
        flatPoints.push(points[i].centroid[1]);
        flatPoints.push(points[i].epoch1);
        flatPoints.push(points[i].val1);
        flatPoints.push(points[i].epoch2);
        flatPoints.push(points[i].val2);
        if (has_packedColor) {
          flatPoints.push(points[i].packedColor);
        }
      }
      that.setDataFunction(new Float32Array(flatPoints));
      //that._setData([]);
      that.dataLoadedFunction(that._layer.layerId);
    };

    this.xhr.onerror = function () {
      that.setDataFunction('');
    };

    this.xhr.send();
  }
  // Creates index and stores in 'hash' field, toplevel
  findResource(fieldName: string, urlPattern: string, options: { format?: any; transform?: any; receiveData?: any; singleUse?: any; }) {
    var url = this._tileidx.expandUrl(urlPattern, this._layer);
    // If urlPattern contains {x} ... {z}, Resource is tile-specific and held in tile
    // Otherwise Resource is layer-specific and held and shared from TileView
    var tileSpecific = (url != urlPattern); // Is urlPattern different for different tiles?
    var container = tileSpecific ? this : this._tileview;

    if (!container[fieldName]) {
      // Consumer of resource data will make hold a (possibly further transformed) version.
      // If Resource is tile-specific, discard after sending to consumer by setting singleUse.
      // Copy options and plug in new value for singleUse.
      options = $.extend({}, options, { singleUse: tileSpecific });
      container[fieldName] = new Resource(url, options);
    }
    return container[fieldName];
  }
  /**
   * Request geometry and data, then call _buildChoroplethTile
   */
  _loadChoroplethMapDataFromCsv() {
    var resources = [];

    // Pre-bind nameKey to create transform(data, callback)
    var parseGeojson = parseAndIndexGeojson.bind(null, this._layer.nameKey);

    if (!this.externalGeojson) {
      resources[0] = COUNTRY_POLYGONS_RESOURCE;
    }
    else if (this.externalGeojson.endsWith('.bin')) {
      resources[0] = this.findResource('btiResource', this.externalGeojson, { format: 'uint32' });
    }
    else {
      resources[0] = this.findResource('geojsonResource', this.externalGeojson, { transform: parseGeojson });
    }

    function parseCsv(data: any, done: (arg0: EarthTimeCsvTable) => void) {
      done(new EarthTimeCsvTable(data));
    }

    resources[1] = this.findResource('dataResource', this._url, { transform: parseCsv });

    Resource.receiveDataListFromResourceList(resources, this._buildChoroplethTile.bind(this));
  }
  // Build choropleth tile using binary geometry (bti format)
  // This happens after _loadChoroplethMapDataFromCsv
  _buildChoroplethTileBti(data: any[]) {
    // Assumes data is of the following format
    // header row Country,      year_0, ..., year_N
    // data row   country_name, value_0,..., value_N
    // ...
    var timeVariableRegions = this._layer.setDataOptions && this._layer.setDataOptions.timeVariableRegions;
    this._timeVariableRegions = timeVariableRegions;
    var drawOptions = this._layer.drawOptions;

    var bti = data[0];
    var csv = data[1];

    if (bti && (!(bti instanceof Uint32Array) || bti[0] != 812217442)) { // magic 'BTI0'
      console.log('bti tile looks corrupt');
      bti = null;
    }

    if (!csv || !bti) {
      // Empty CSV or geojson, e.g. 404.  Leave tile blank.
      this._ready = true;
      return;
    }

    var beginTime = new Date().getTime();

    // Extract vertices
    var offset = 1;
    var len = bti[offset++] / 4;
    var vertices = new Float32Array(bti.buffer.slice(4 * offset, 4 * (offset + len)));
    offset += len;

    // Extract triangleCountPerRegion
    len = bti[offset++] / 4;
    var triangleCountPerRegion = new Uint32Array(bti.buffer.slice(4 * offset, 4 * (offset + len)));
    offset += len;
    var triangleOffsetPerRegion = new Uint32Array(len);
    {
      var triangleOffset = 0;
      for (var i = 0; i < len; i++) {
        triangleOffsetPerRegion[i] = triangleOffset;
        triangleOffset += triangleCountPerRegion[i];
      }
    }

    // Extract triangles
    len = bti[offset++] / 4;
    var triangles = new Uint32Array(bti.buffer.slice(4 * offset, 4 * (offset + len)));
    offset += len;

    // Extract json for region names
    var lenInBytes = bti[offset++];
    var regionNamesAscii = arrayBufferToString(bti.buffer.slice(4 * offset, lenInBytes + 4 * offset));
    var regionNames = JSON.parse(regionNamesAscii);

    len = Math.ceil(lenInBytes / 4); // round up to skip padding
    offset += len;

    if (offset != bti.length) {
      console.log('Unexpected bti length');
    }

    // Copy all triangles
    var minValue: any, maxValue: any;
    this.epochs = csv.epochs;

    var drawVertices = new Float32Array(65536 * 3); // x y idx
    var drawVerticesIdx = 0;

    var drawTriangles = new Uint16Array(65536 * 3); // a b c
    var drawTrianglesIdx = 0;

    this._triangleLists = [];

    function writeTrianglesFunc() {
      if (!drawVerticesIdx)
        return; // empty


      // This region won't fit in drawVertices.  Create WebGL buffer and start on next
      var triangleList = {};
      var indexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, drawTriangles.slice(0, drawTrianglesIdx), this.gl.STATIC_DRAW);

      var arrayBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, arrayBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, drawVertices.slice(0, drawVerticesIdx), this.gl.STATIC_DRAW);

      //console.log(this._tileidx.toString(), 'writing', drawTrianglesIdx / 3, 'triangles with', drawVerticesIdx / 3, 'vertices to list #' + this._triangleLists.length);
      this._triangleLists.push({ arrayBuffer: arrayBuffer, indexBuffer: indexBuffer, count: drawTrianglesIdx });

      drawTrianglesIdx = 0;
      drawVerticesIdx = 0;
    }
    var writeTriangles = writeTrianglesFunc.bind(this);

    for (var i = 0; i < regionNames.length; i++) {
      // Scan through triangle vertex indices to find index range
      var startVertexIdx = 1e30;
      var endVertexIdx = 0;
      for (var j = 3 * triangleOffsetPerRegion[i]; j < 3 * (triangleOffsetPerRegion[i] + triangleCountPerRegion[i]); j++) {
        startVertexIdx = Math.min(startVertexIdx, triangles[j]);
        endVertexIdx = Math.max(endVertexIdx, triangles[j]);
      }
      endVertexIdx++; // exclusive
      var vertexCount = endVertexIdx - startVertexIdx;
      console.assert(vertexCount < 65536);

      // Add region to drawVertices/drawTriangles
      if (drawVerticesIdx + vertexCount > 65535) {
        writeTriangles();
      }

      // Add triangles to drawTriangles
      for (var j = 3 * triangleOffsetPerRegion[i]; j < 3 * (triangleOffsetPerRegion[i] + triangleCountPerRegion[i]); j++) {
        // Convert tile vertexIndex to local 16-bit vertexIndex
        drawTriangles[drawTrianglesIdx++] = triangles[j] + drawVerticesIdx / 3 - startVertexIdx;
      }

      // Add region's vertices to drawVertices, adding regionIdx to each
      for (var j = startVertexIdx; j < endVertexIdx; j++) {
        drawVertices[drawVerticesIdx++] = vertices[j * 2];
        drawVertices[drawVerticesIdx++] = vertices[j * 2 + 1];
        drawVertices[drawVerticesIdx++] = i; // regionIdx
      }
    }
    writeTriangles();

    // Build texture from values
    // texture is 8-bit value (Y) and 8-bit alpha
    // When alpha is 0, nothing will be drawn
    // When alpha is 255, Y becomes index into colormap -- 0 is the min value, and 255 is the max
    // Gaps in data will be intepolated here, with interpolations plugged into texture
    // Ideally we'd make the texture regionNames.length x epochs.length
    // But a) each dimension needs to be a power of 2 and (b) maximum dimension is 4096 (2048 is 0.1% more compatible)
    // Tracts ~75K regions, ~10 timeslices.  750K < 4M (2K^2)
    this.valuesWidth = Math.min(2048, Math.pow(2, Math.ceil(Math.log2(regionNames.length * this.epochs.length))));
    this.nRegionsPerRow = Math.floor(this.valuesWidth / this.epochs.length);
    this.valuesHeight = Math.max(1, Math.pow(2, Math.ceil(Math.log2(regionNames.length / this.nRegionsPerRow))));

    //console.log(this._tileidx.toString(), 'Texture ' + this.valuesWidth + 'x' + this.valuesHeight + ' (efficiency ' +
    //	      Math.round(100 * regionNames.length * this.epochs.length / this.valuesWidth / this.valuesHeight) + '%)');
    //console.log(this._tileidx.toString(), regionNames.length, 'regions');
    var texture = new Uint8Array(this.valuesWidth * this.valuesHeight * 2); // greyscale plus alpha

    {
      var minValue = csv.minValue;
      var maxValue = csv.maxValue;
      var radius = eval(this.scalingFunction);
      this._radius = radius;
      this._layer.radius = radius; // Set the radius for the layer
    }

    var transferRegionData = function (regionName: string | number, firstCol: any, lastCol: number) {
      var csvRowNum = csv.region_name_to_row[regionName];
      if (!csvRowNum) {
        console.log('Choropleth tile', this._tileidx.toString(), 'missing csv row for', regionName);
        return;
      }
      var csvRow = csv.getInterpolatedRow(csvRowNum);

      for (var j = firstCol; j < lastCol; j++) {
        var val = csvRow[j + csv.first_data_col];
        if (!isNaN(val)) {
          var texVal = Math.max(0, Math.min(255, Math.floor(radius(val) * 256)));
          texture[(texRow * this.valuesWidth + texCol + j) * 2 + 0] = texVal;
          texture[(texRow * this.valuesWidth + texCol + j) * 2 + 1] = 255; // alpha
        }
      }
    }.bind(this);

    // Loop through regions in BTI
    for (var i = 0; i < regionNames.length; i++) {
      // timeVariableRegions==false
      var texRow = Math.floor(i / this.nRegionsPerRow);
      var texCol = (i % this.nRegionsPerRow) * this.epochs.length;

      if (timeVariableRegions) {
        // regionNames[i] is in form ID_YYYY1|ID_YYYY2|ID_YYYY3, e.g. G010_1840|G010_1850|G010_1860
        var regions = regionNames[i].split('|');
        for (var j = 0; j < regions.length; j++) {
          var region = regions[j];
          var split = region.split('_');
          var regionName = split[0];

          var col = csv.epoch2col[parseDateStr(split[1])];
          if (!col) {
            console.log('In tile', this._tileidx.toString(), 'could not find time for', split[1]);
            continue;
          }
          transferRegionData(regionName, col - csv.first_data_col, col - csv.first_data_col + 1);
        }
      }
      else {
        transferRegionData(regionNames[i], 0, this.epochs.length);
      }
    }

    // Create and initialize texture
    var gl = this.gl;
    this._valuesTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._valuesTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // It's much easier to not try to interpolate over time when regions vary over time
    var timeInterpolationFilter = timeVariableRegions ? gl.NEAREST : gl.LINEAR;

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, timeInterpolationFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, timeInterpolationFilter);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, this.valuesWidth, this.valuesHeight, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, texture);

    if (drawOptions?.colorMapColorsList) {
      this._loadTextureFromColorList(drawOptions.colorMapColorsList);
    } else {
      this._loadTexture();
    }
    this._ready = true;

    var totalTime = new Date().getTime() - beginTime;
    WebGLVectorTile2._totalBtiTime += totalTime;
    WebGLVectorTile2._totalBtiCount++;

    // TODO: should we only call this once after first tile loaded?
    this.dataLoadedFunction(this._layer.layerId);

    console.log('BTI tile ' + this._tileidx.toString() + ' loaded in ' + totalTime + 'ms (avg ' + Math.round(WebGLVectorTile2._totalBtiTime / WebGLVectorTile2._totalBtiCount) + 'ms over ' + WebGLVectorTile2._totalBtiCount + ' tiles)');

  }
  // This happens after _loadChoroplethMapDataFromCsv
  _buildChoroplethTile(data: any[]) {
    if (data[0] instanceof Uint32Array) {
      console.log('building choropleth tile from binary');
      return this._buildChoroplethTileBti(data);
    }
    console.log('building choropleth tile from geojson');

    // Assumes data is of the following format
    // header row Country,      year_0, ..., year_N
    // data row   country_name, value_0,..., value_N
    // ...
    var geojson = data[0];
    var csv = data[1];

    if (!csv || !geojson) {
      // Empty CSV or geojson, e.g. 404.  Leave tile blank.
      this._ready = true;
      return;
    }

    var points = [];
    var rawVerts = [];

    console.assert(geojson.hash); // geojson needs to be indexed
    var honorDataGaps = this._layer.setDataOptions && this._layer.setDataOptions.honorDataGaps;
    Workers.call(
      'WebGLVectorTile2Worker.js',
      'triangularizeAndJoin',
      {
        csv: csv,
        geojson: geojson,
        nameKey: this._layer.nameKey,
        honorDataGaps: honorDataGaps
      },
      function (this: WebGLVectorTile2, t: { verts: any; minValue: any; maxValue: any; }) {
        var verts = t.verts;
        var minValue = t.minValue;
        var maxValue = t.maxValue;
        this._maxValue = maxValue;
        this._minValue = minValue;
        var radius = eval(this.scalingFunction);
        this._radius = radius;
        this._layer.radius = radius;
        // radius must be evaluated before downcasting to Float32 because
        // there are scaling functions that depend on 64-bit precision
        for (var i = 0; i < verts.length; i += 6) {
          verts[i + 3] = radius(verts[i + 3]);
          verts[i + 5] = radius(verts[i + 5]);
        }

        verts = Float32Array.from(verts);

        this._layer.numAttributes = 6;
        this.setDataFunction(verts);
        this.dataLoadedFunction(this._layer.layerId);
        this._ready = true;
      }.bind(this));
  }
  _setSitc4r2BufferData(sitc4r2Code: string | number, year: string | number, data: string | any[] | Float32Array) {
    if (typeof this.buffers[sitc4r2Code] == "undefined") {
      this.buffers[sitc4r2Code] = {};
    }

    this.buffers[sitc4r2Code][year] = {
      "numAttributes": this._layer.numAttributes,
      "pointCount": 0,
      "buffer": null,
      "ready": false
    };
    var gl = this.gl;
    this.buffers[sitc4r2Code][year].pointCount = data.length / this._layer.numAttributes;
    if (this.buffers[sitc4r2Code][year].pointCount > 0) {
      this.buffers[sitc4r2Code][year].buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[sitc4r2Code][year].buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }

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
  _setPointData(data: { features: string | any[]; }) {
    // Assumes GeoJSON data
    var points = [];

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        var packedColor: number;
        if (typeof feature.properties.PackedColor != "undefined") {
          packedColor = feature.properties.PackedColor;
        }
        else {
          if (this._layer.color) {
            packedColor = this._layer.color[0] * 255 + this._layer.color[1] * 255 * 255.0 + this._layer.color[2] * 255 * 255.0 * 255.0;
          }
          else {
            packedColor = 255.0;
          }
        }
        if (feature.geometry.type != "MultiPoint") {
          var pixel = LngLatToPixelXY(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
          points.push(pixel[0], pixel[1], packedColor);
        }
        else {
          for (var j = 0; j < feature.geometry.coordinates.length; j++) {
            var coords = feature.geometry.coordinates[j];
            var pixel = LngLatToPixelXY(coords[0], coords[1]);
            points.push(pixel[0], pixel[1], packedColor);
          }
        }
      }
      this._setBufferData(new Float32Array(points));
      this.dataLoadedFunction(this._layer.layerId);
    }
  }

  _setMarkerData(data: { features: string | any[]; }) { 
    // Assumes GeoJSON data
    var points = [];

    let setDataOptions = this._layer.setDataOptions || {}; 
    var key = setDataOptions.key || undefined;
    var values = setDataOptions.values || undefined;
    var fills = setDataOptions.fills || [[218,218,218,1]];
    var strokes = setDataOptions.strokes || [[16,16,16,1]];
    
    
    if (typeof data.features != "undefined") {      
      for (var f = 0; f < data.features.length; f++) {

        let feature = data.features[f];

        let fill_rgba = fills[0];
        let stroke_rgba = strokes[0];
        if (key && feature.properties[key]) {
          let idx = values.indexOf(feature.properties[key]);
          fill_rgba = fills[idx];
          stroke_rgba = strokes[idx];
        }


        if (feature.geometry.type != "MultiPoint") {
          var pixel = LngLatToPixelXY(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
          points.push(
            pixel[0], 
            pixel[1], 
            fill_rgba[0],
            fill_rgba[1],
            fill_rgba[2],
            fill_rgba[3],
            stroke_rgba[0],
            stroke_rgba[1],
            stroke_rgba[2],
            stroke_rgba[3]
          );
        }
        else {
          for (var j = 0; j < feature.geometry.coordinates.length; j++) {
            var coords = feature.geometry.coordinates[j];
            var pixel = LngLatToPixelXY(coords[0], coords[1]);
            points.push(
              pixel[0], 
              pixel[1], 
              fill_rgba[0]/255,
              fill_rgba[1]/255,
              fill_rgba[2]/255,
              fill_rgba[3],
              stroke_rgba[0]/255,
              stroke_rgba[1]/255,
              stroke_rgba[2]/255,
              stroke_rgba[3]
            );
            }
        }
      }
      this._setBufferData(new Float32Array(points));
      this.dataLoadedFunction(this._layer.layerId);
    }
  }

  // not animated, only one glyph possible
  _setGlyphData(data: { features: string | any[]; }) {
    // Assumes GeoJSON data
    var points = [];

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        // assumes not multi point
        var pixel = LngLatToPixelXY(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        points.push(pixel[0], pixel[1]);
      }

      var glyphPath = this._layer.drawOptions.glyphPath || undefined;
      if (glyphPath) {
        // asychronously load img
        var image = new Image();
        var that = this;
        image.addEventListener('load', function () {
          that._image = image;
          that._setBufferData(new Float32Array(points));
        });
        image.crossOrigin = "anonymous";
        image.src = glyphPath;
        this.dataLoadedFunction(this._layer.layerId);
      }
      else {
        console.log("No glyph path");
        this._setBufferData(new Float32Array(points));
        this.dataLoadedFunction(this._layer.layerId);
      }
    }
  }
  // GeoJSON requires StartEpochTime, EndEpochTime, GlyphIndex fields
  // can use different sections of one glyph texture based on GlyphIndex
  _setAnimatedGlyphData(data: { features: string | any[]; }, setDataOptions: any) {
    // Assumes GeoJSON data
    var points = [];

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        // assumes not multi point
        var pixel = LngLatToPixelXY(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        var e0 = feature.properties.StartEpochTime;
        var e1 = feature.properties.EndEpochTime;
        var offset = feature.properties.GlyphIndex;
        points.push(pixel[0], pixel[1], e0, e1, offset);
      }

      var glyphPath = setDataOptions.glyphPath || undefined;
      if (glyphPath) {
        // asychronously load img
        var image = new Image();
        var that = this;
        image.addEventListener('load', function () {
          that._image = image;
          that._setBufferData(new Float32Array(points));
        });
        image.crossOrigin = "anonymous";
        image.src = glyphPath;
        this.dataLoadedFunction(this._layer.layerId);
      }
      else {
        console.log("No glyph path");
        this._setBufferData(new Float32Array(points));
        this.dataLoadedFunction(this._layer.layerId);
      }
    }
  }
  //triangles will be fixed size
  _setTriangleData(data: { features: string | any[]; }) {
    // Assumes GeoJSON data
    var points = [];

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        var packedColor: number;
        if (typeof feature.properties.PackedColor != "undefined") {
          packedColor = feature.properties.PackedColor;
        }
        else {
          if (this._layer.color) {
            packedColor = this._layer.color[0] * 255 + this._layer.color[1] * 255 * 255.0 + this._layer.color[2] * 255 * 255.0 * 255.0;
          }
          else {
            packedColor = 255.0;
          }
        }
        if (feature.geometry.type != "MultiPoint") {
          var p = LngLatToPixelXY(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
          var r = 0.01;
          var a = [p[0] - r / 2, p[1] + (r / 2 * Math.sqrt(3))];
          var b = [p[0] + r / 2, p[1] + (r / 2 * Math.sqrt(3))];
          points.push(p[0], p[1], packedColor);
          points.push(a[0], a[1], packedColor);
          points.push(b[0], b[1], packedColor);
        }
        else {
          for (var j = 0; j < feature.geometry.coordinates.length; j++) {
            var coords = feature.geometry.coordinates[j];
            var pixel = LngLatToPixelXY(coords[0], coords[1]);
            points.push(pixel[0], pixel[1], packedColor);
          }
        }
      }
      this._setBufferData(new Float32Array(points));
      this.dataLoadedFunction(this._layer.layerId);
    }
  }
  _setPolygonData(data: { features: string | any[]; }) {
    // Assumes GeoJSON data
    var verts = [];
    var rawVerts = [];

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        var packedColor: number;
        if (typeof feature.properties.PackedColor != "undefined") {
          packedColor = feature.properties.PackedColor;

        }
        else {
          if (this._layer.color) {
            let r = this._layer.color[0] <= 1.0 ? this._layer.color[0] * 255.0 : this._layer.color[0];
            let g = this._layer.color[1] <= 1.0 ? this._layer.color[1] * 255.0 : this._layer.color[1];
            let b = this._layer.color[2] <= 1.0 ? this._layer.color[2] * 255.0 : this._layer.color[2];
            packedColor =  r + g * 256.0 + b * 256.0 * 256.0;
          }
          else {
            packedColor = 255.0;
          }
        }
        if (typeof feature.geometry != "undefined" && typeof feature.geometry.coordinates != "undefined") {
          if (feature.geometry.type != "MultiPolygon") {
            var mydata = earcut.flatten(feature.geometry.coordinates);
            var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
            for (var i = 0; i < triangles.length; i++) {
              var pixel = LngLatToPixelXY(mydata.vertices[triangles[i] * mydata.dimensions], mydata.vertices[triangles[i] * mydata.dimensions + 1]);
              verts.push(pixel[0], pixel[1], packedColor);
            }
          }
          else {
            for (var j = 0; j < feature.geometry.coordinates.length; j++) {
              var mydata = earcut.flatten(feature.geometry.coordinates[j]);
              var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
              for (var i = 0; i < triangles.length; i++) {
                var pixel = LngLatToPixelXY(mydata.vertices[triangles[i] * mydata.dimensions], mydata.vertices[triangles[i] * mydata.dimensions + 1]);
                verts.push(pixel[0], pixel[1], packedColor);
              }
            }
          }
        }
      }
      this._setBufferData(new Float32Array(verts));
      this.dataLoadedFunction(this._layer.layerId);
    }
  }
  _setLineStringData(data: { [x: string]: any[]; }) {
    // Assumes GeoJSON data
    function processLineString(lineString: string | any[]) {
      var out = [];
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
        }
        else {
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
    this.dataLoadedFunction(this._layer.layerId);

  }
  _setExpandedLineStringData(data: { [x: string]: any[]; }) {
    // Assumes GeoJSON data
    function processLineString(lineString: string | any[]) {
      var out = [];
      for (var i = 0; i < lineString.length; i++) {
        var p = LngLatToPixelXY(lineString[i][0], lineString[i][1]);
        out.push(p);
      }
      return out;
    }
    var paths = [];
    var deltas = [];
    for (var i = 0; i < data["features"].length; i++) {
      var feature = data["features"][i];
      if (feature["geometry"]["type"] == "MultiLineString") {
        var old_idx = paths.length;
        for (var j = 0; j < feature["geometry"]["coordinates"].length; j++) {
          var path = [];
          path = path.concat(processLineString(feature["geometry"]["coordinates"][j]));
          paths.push(path);
        }
        var new_idx = paths.length;
        var total_points_length = 0;
        for (var ii = old_idx; ii < new_idx; ii++) {
          total_points_length += paths[ii].length;
        }
        var count = 0;
        for (var ii = old_idx; ii < new_idx; ii++) {
          var delta = [];
          for (var jj = 0; jj < paths[ii].length; jj++) {
            delta.push(count / (total_points_length - 1));
            count += 1;
          }
          deltas.push(delta);
        }
      }
      else {
        var path = [];
        path = path.concat(processLineString(feature["geometry"]["coordinates"]));
        paths.push(path);
        var delta = [];
        for (var jj = 0; jj < path.length; jj++) {
          delta.push(jj / (path.length - 1));
        }
        deltas.push(delta);
      }
    }
    var normalCollection = [];
    var miterCollection = [];
    var vertexCollection = [];
    var indexCollection = [];
    var textureCollection = [];


    var offset = 0;
    for (var i = 0; i < paths.length; i++) {
      var points = paths[i];
      var tags = GetNormals(points);
      var normals = tags.map(function (x) {
        return x[0];
      });
      var miters = tags.map(function (x) {
        return x[1];
      });
      //var count = (points.length - 1) * 6;
      normals = Duplicate(normals);
      miters = Duplicate(miters, true);
      var deltas_ = Duplicate(deltas[i]);
      var textureLocs = [];
      for (var j = 0; j < deltas_.length; j++) {
        textureLocs.push(deltas_[j]);
      }

      var positions = Duplicate(points);
      var indices = CreateIndices(points.length - 1, offset);
      normalCollection = normalCollection.concat(PackArray(normals));
      miterCollection = miterCollection.concat(PackArray(miters));
      vertexCollection = vertexCollection.concat(PackArray(positions));
      indexCollection = indexCollection.concat(indices);
      textureCollection = textureCollection.concat(textureLocs);
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


    if (typeof this._image !== "undefined") {
      this._texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this._texture);

      // Set the parameters so we can render any size image.
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

      // Upload the image into the texture.
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this._image);

      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    this._setBuffers([new Float32Array(vertexCollection),
    new Float32Array(normalCollection),
    new Float32Array(miterCollection),
    new Float32Array(textureCollection)],
      new Uint16Array(indexBuffer));
    this.dataLoadedFunction(this._layer.layerId);
  }

  _setIomIdpData(data: { features: any; }) {
    var maxValue = 905835.0;
    var radius = d3.scaleSqrt().domain([0, maxValue]).range([0, 60]);

    var features = data.features;
    var points = [];

    // Convert iso3 to numeric code
    function alpha2num(alpha: string) {
      if (alpha == 'IRQ')
        return 368;
      if (alpha == 'SYR')
        return 760;
      if (alpha == 'YEM')
        return 887;
      if (alpha == 'LBY')
        return 434;
      return -1;
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
          epoch2: epochs[j + 1],
          val2: idpValues[j + 1]
        };
        points.push(p);
        var p = {
          cc: alpha2num(iso3),
          type: 1,
          x: xy[0],
          y: xy[1],
          epoch1: epochs[j],
          val1: returnsValues[j],
          epoch2: epochs[j + 1],
          val2: returnsValues[j + 1]
        };
        points.push(p);
      }
    }
    points.sort(function (a, b) {
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

      this.program.setVertexAttrib.a_country(1, gl.FLOAT, false, 32, 0);
      this.program.setVertexAttrib.a_type(   1, gl.FLOAT, false, 32, 4);
      this.program.setVertexAttrib.a_coord(  2, gl.FLOAT, false, 32, 8);
      this.program.setVertexAttrib.a_epoch1( 1, gl.FLOAT, false, 32, 16);
      this.program.setVertexAttrib.a_val1(   1, gl.FLOAT, false, 32, 20);
      this.program.setVertexAttrib.a_epoch2( 1, gl.FLOAT, false, 32, 24);
      this.program.setVertexAttrib.a_val2(   1, gl.FLOAT, false, 32, 28);
    }
  }
  // Color Dotmap (not animated)  aWorldCoord[2]  aColor
  _setColorDotmapData(arrayBuffer: Float32Array) {
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
  _setColorDotmapDataFromBoxWithFormat(tileDataF32: { buffer: Iterable<number>; }, format: string) {
    // Create uint8 view on data.  Unfortunately we're called with Float32Array, which isn't correct for
    // this particular function
    var tile = this;
    this.timings[5] = new Date().getTime();

    var requestArgs: any = {
      tileDataF32: tileDataF32,
      dotmapColors: tile._layer.dotmapColors,
      tileidx: tile._tileidx,
      format: format
    };

    var workerName: string;
    if (format == 'box') {
      workerName = 'computeColorDotmapFromBox';
    }
    else if (format == 'tbox') {
      workerName = 'computeColorDotmapFromTbox';
      requestArgs.epochs = this._layer.epochs;
    }
    else {
      throw new Error('Unknown dotmap format ' + format);
    }

    Workers.call('WebGLVectorTile2Worker.js', workerName, requestArgs, function (response) {
      // Iterate through the raster, creating dots on the fly
      var gl = tile.gl;

      tile._pointCount = response.pointCount;
      tile._population = response.population;
      tile._ready = true;

      if (tile._pointCount > 0) {
        tile._data = response.data;
        tile._arrayBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tile._arrayBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, tile._data, gl.STATIC_DRAW);
      }
      tile.timings[6] = new Date().getTime();
      tile.displayTimings(format);
    });
  }
  displayTimings(type: any) {
    var msg = this._url.split('/').slice(-4).join('/');

    msg += ' ' + (this.timings[this.timings.length - 1] - this.timings[0]) + ' |';

    for (var i = 1; i < this.timings.length; i++) {
      if (!this.timings[i])
        this.timings[i] = this.timings[i - 1];
      var timing = this.timings[i] - this.timings[i - 1];
      msg += ' ' + (isNaN(timing) ? '-' : timing);

    }
  }
  // Color Dotmap (not animated)  aWorldCoord[2]  aColor
  _setColorDotmapDataFromBox(tileDataF32: any) {
    this._setColorDotmapDataFromBoxWithFormat(tileDataF32, 'box');
  }
  _setColorDotmapDataFromTbox(tileDataF32: any) {
    this._setColorDotmapDataFromBoxWithFormat(tileDataF32, 'tbox');
  }
  _setObesityData(data: { features: string | any[]; }) {
    function LatLongToPixelXY(latitude: number, longitude: number) {
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
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];

        var years = feature.properties.years;
        for (var ii = 0; ii < years.length; ii++) {
          if (feature.geometry.type != "MultiPolygon") {
            var mydata = earcut.flatten(feature.geometry.coordinates);
            var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
            for (var i = 0; i < triangles.length; i++) {
              var pixel = LatLongToPixelXY(mydata.vertices[triangles[i] * 2 + 1], mydata.vertices[triangles[i] * 2]);
              if (ii < years.length - 1) {
                verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii + 1].scaled_mean);
              }
              else {
                verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii].scaled_mean);
              }
            }
          }
          else {
            for (var j = 0; j < feature.geometry.coordinates.length; j++) {
              var mydata = earcut.flatten(feature.geometry.coordinates[j]);
              var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
              for (var i = 0; i < triangles.length; i++) {
                var pixel = LatLongToPixelXY(mydata.vertices[triangles[i] * 2 + 1], mydata.vertices[triangles[i] * 2]);
                if (ii < years.length - 1) {
                  verts.push(pixel.x, pixel.y, years[ii].year, years[ii].scaled_mean, years[ii + 1].scaled_mean);
                }
                else {
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

        this.program.setVertexAttrib.a_Vertex(2, gl.FLOAT, false, 20, 0);
        this.program.setVertexAttrib.a_Year(1, gl.FLOAT, false, 20, 8);
        this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 20, 12);
        this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 20, 16);

        this._texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this._texture);

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);

        this.dataLoadedFunction(this._layer.layerId);

      }
    }
  }
  _setVaccineConfidenceData(data: { features: string | any[]; }) {
    function LatLongToPixelXY(latitude: number, longitude: number) {
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
      'Q4': 0.47
    };

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        if (feature.geometry.type != "MultiPolygon") {
          var mydata = earcut.flatten(feature.geometry.coordinates);
          var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
          for (var i = 0; i < triangles.length; i++) {
            var pixel = LatLongToPixelXY(mydata.vertices[triangles[i] * 2 + 1], mydata.vertices[triangles[i] * 2]);
            verts.push(pixel.x, pixel.y);
            for (var ii = 0; ii < questions.length; ii++) {
              var q = questions[ii];
              verts.push((feature.properties[q][2] + feature.properties[q][3]) / minValues[q]);
            }
          }
        }
        else {
          for (var j = 0; j < feature.geometry.coordinates.length; j++) {
            var mydata = earcut.flatten(feature.geometry.coordinates[j]);
            var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
            for (var i = 0; i < triangles.length; i++) {
              var pixel = LatLongToPixelXY(mydata.vertices[triangles[i] * 2 + 1], mydata.vertices[triangles[i] * 2]);
              verts.push(pixel.x, pixel.y);
              for (var ii = 0; ii < questions.length; ii++) {
                var q = questions[ii];
                verts.push((feature.properties[q][2] + feature.properties[q][3]) / minValues[q]);
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

        this.program.setVertexAttrib.a_Vertex(2, gl.FLOAT, false, 24, 0);
        this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 24, 8);
        this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 24, 12);
        this.program.setVertexAttrib.a_Val3(1, gl.FLOAT, false, 24, 16);
        this.program.setVertexAttrib.a_Val4(1, gl.FLOAT, false, 24, 20);

        this._texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this._texture);

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
        this.dataLoadedFunction(this._layer.layerId);

      }
    }
  }
  _setTrajectoriesData(data: string | any[]) {
    console.log("_setTrajectoriesData");
    console.log(data);
    var points = [];
    for (var i = 0; i < data.length; i++) {
      var entry = data[i];
      var color = 255.0;
      for (var j = 0; j < entry["trajectory"].length - 1; j++) {
        var t0 = entry["trajectory"][j + 1];
        var t1 = entry["trajectory"][j];
        var p0 = LatLongToPixelXY(t0[2], t0[3]);
        var e0 = t0[1];
        var p1 = LatLongToPixelXY(t1[2], t1[3]);
        var e1 = t1[1];
        points.push(p0['x']);
        points.push(p0['y']);
        points.push(e0);
        points.push(p1['x']);
        points.push(p1['y']);
        points.push(e1);
        points.push(color);
      }
    }
    this._setBufferData(new Float32Array(points));
  }
  _setAnimatedPointsData(data: { features: string | any[]; }) {
    // Assumes GeoJSON data
    var points = [];

    if (typeof data.features != "undefined") {
      for (var f = 0; f < data.features.length; f++) {
        var feature = data.features[f];
        var packedColor = feature.properties.PackedColor;
        var pixel = LngLatToPixelXY(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        var e0 = feature.properties.StartEpochTime;
        var e1 = feature.properties.EndEpochTime;

        points.push(pixel[0], pixel[1], packedColor, e0, e1);
      }
      this._setBufferData(new Float32Array(points));
      this.dataLoadedFunction(this._layer.layerId);
    }
  }
  _loadTexture() {
    // Bind option image to texture
    if (typeof this._image !== "undefined") {
      this._texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this._texture);

      // Set the parameters so we can render any size image.
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

      // Upload the image into the texture.
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this._image);

      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }
  }
  _loadTextureFromColorList(colorList:any[], textureWidth?:number, textureHeight?:number) {
    var gl = this.gl;
    var width = textureWidth || 256;
    var height = textureHeight || 1;

    if (!colorList) {
      return;
    }

    if (Array.isArray(colorList)) {
      var colormap = [];

      // TODO: Move to utility class
      var hexToRgb = function(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
          return r + r + g + g + b + b;
        });
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
      };

      for (var i = 0; i < colorList.length; i++) {
        if (typeof(colorList[i]) === "string" && colorList[i].trim().indexOf("#") == 0) {
          // Assume hex and change to rgba
          var rgb = hexToRgb(colorList[i]);
          if (rgb) {
            colormap.push(rgb.concat([255]));
          } else {
            console.log("ERROR: Failed to parsse hex color in color map array.");
          }
        } else if (colorList[i].length == 3) {
          colormap.push(colorList[i].concat([255]));
        } else if (colorList[i].length == 4) {
          colormap.push(colorList[i]);
        } else {
          console.log("ERROR: Failed to parsse color map array. Invalid format detected.");
        }
      }

      var dataArray = new Uint8Array(width * height * 4);
      var offset = 0;

      for (var y = 0; y < height; y++) {
        for (var i = 0; i < colormap.length; i++){
          for (var j = 0; j < width/colormap.length; j++) {
            dataArray[(j+offset+(width*y))*4] = colormap[i][0];
            dataArray[(j+offset+(width*y))*4+1] = colormap[i][1];
            dataArray[(j+offset+(width*y))*4+2] = colormap[i][2];
            dataArray[(j+offset+(width*y))*4+3] = colormap[i][3];
          }
          offset = j+offset;
        }
        offset = 0;
      }
    } else {
      dataArray = getColorRamp(colorList);
    }

    this._texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, this._texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataArray);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  _setBufferData(data: Float32Array) {
    var gl = this.gl;
    var drawOptions = this._layer.drawOptions;
    this._pointCount = data.length / this._layer.numAttributes;
    this._ready = true;
    if (this._pointCount > 0) {
      this._data = data;
      this._arrayBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this._data, gl.STATIC_DRAW);
      if (drawOptions?.colorMapColorsList) {
        this._loadTextureFromColorList(drawOptions.colorMapColorsList);
      } else {
        this._loadTexture();
      }
    }
  }
  _setBuffers(buffers: string | any[], indices: string | any[] | Uint16Array) {
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
  isReady() {
    return this._ready;
  }
  delete() {
    this.unloadResources();
    this._deleted = true;
    if (!this.isReady()) {
      if (this.xhr != null) {
        this.xhr.abort();
      }
    }
  }
  _drawWdpa(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.lineWidth(2);
      gl.useProgram(this.program);

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.worldCoord(2, gl.FLOAT, false, 12, 0);
      this.program.setVertexAttrib.time(1, gl.FLOAT, false, 12, 8);

      var minTime = new Date('1800').getTime();
      gl.uniform1f(this.program.minTime, minTime);

      var maxTime = new Date('2100').getTime();
      gl.uniform1f(this.program.maxTime, maxTime);

      gl.drawArrays(gl.LINES, 0, this._pointCount);
      //perf_draw_lines(this._pointCount);
    }
  }
  _drawLines(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready && this._pointCount > 0) {
      gl.lineWidth(2);
      gl.useProgram(this.program);

      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.worldCoord(2, gl.FLOAT, false, 8, 0);

      gl.drawArrays(gl.LINES, 0, this._pointCount);
      //perf_draw_lines(this._pointCount);
    }
  }

  // Used by coral
  _drawPoints(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var maxTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);
      var color = drawOptions.color || this._defaultColor;

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      // Hack for image export for very large image
      if (gl.canvas.width >= 4000 || gl.canvas.height >= 4000) {
        pointSize += 2.0;
      }

      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.worldCoord(2, gl.FLOAT, false, 12, 0);
      this.program.setVertexAttrib.time(1, gl.FLOAT, false, 12, 8);

      gl.uniform1f(this.program.uPointSize, pointSize);
      gl.uniform1f(this.program.uMaxTime, maxTime * 1.);
      gl.uniform4fv(this.program.uColor, color);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawGtd(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.a_WorldCoord(2, gl.FLOAT, false, 16, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_Epoch(1, gl.FLOAT, false, 16, 8); // 8 byte offset
      this.program.setVertexAttrib.a_NCasualties(1, gl.FLOAT, false, 16, 12); // 8 byte offset

      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);

      gl.uniform1f(this.program.u_EpochTime, currentTime);

      var spanEpoch = 2.0 * 365 * 24 * 68 * 60;
      gl.uniform1f(this.program.u_Span, spanEpoch);


      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawUppsalaConflict(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.a_centroid(2, gl.FLOAT, false, 20, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_val(1, gl.FLOAT, false, 20, 8); // 8 byte offset
      this.program.setVertexAttrib.a_start_epoch(1, gl.FLOAT, false, 20, 12); // 8 byte offset
      this.program.setVertexAttrib.a_end_epoch(1, gl.FLOAT, false, 20, 16); // 8 byte offset

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_epoch, currentTime);

      gl.uniform1f(this.program.u_size, pointSize);

      var spanEpoch = 24.0 * 30 * 24 * 68 * 60;
      gl.uniform1f(this.program.u_span, spanEpoch);


      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  // Warning:  bubbleScaleRange will invalidate the standard numeric legend
  _drawBubbleMap(transform: Float32Array) {
    var bubbleScale = 1;
    var bubbleAlpha = 0.75;
    var drawOptions = this._layer.drawOptions;
    if (drawOptions && drawOptions.bubbleScaleRange) {
      bubbleScale = this.computeFromGmapsZoomLevel(drawOptions.bubbleScaleRange);
    }
    if (drawOptions && drawOptions.bubbleAlpha) {
      bubbleAlpha = drawOptions.bubbleAlpha;
    }

    var negativeColor = [1.0,0.0,0.0,1.0];
    if (drawOptions && drawOptions.negativeColor) {
      negativeColor = drawOptions.negativeColor;
      if (negativeColor.length == 3) {
        negativeColor.push(1.0);
      }
    }

    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var color = drawOptions.color || this._defaultColor;
      if (color.length == 3) {
        color.push(1.0);
      }
      // 1.0 == full circle, 2.0 == left half, 3.0 == right half
      var mode = gEarthTime.layerDB.pairedLayerModeById[this._layer.layerId] || drawOptions.mode || 1.0;

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.a_Centroid(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0);
      this.program.setVertexAttrib.a_Epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_Epoch2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);
      this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 20);

      if (this._layer.numAttributes == 7) {
        this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, this._layer.numAttributes * 4, 24);
      }

      gl.uniform4fv(this.program.u_Color, color);
      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);
      gl.uniform1f(this.program.u_Epoch, currentTime);
      gl.uniform1f(this.program.u_Size, 2.0 * window.devicePixelRatio * bubbleScale);
      gl.uniform1f(this.program.u_Mode, mode);
      gl.uniform1f(this.program.u_Alpha, bubbleAlpha);
      gl.uniform4fv(this.program.u_NegativeColor, negativeColor);

      if (this._texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this.program.u_Image, 0);
        gl.uniform1f(this.program.u_Min, this._radius(this._minValue));
        gl.uniform1f(this.program.u_Max, this._radius(this._maxValue));
      }
      if (drawOptions.color) {
        gl.uniform4fv(this.program.u_Color, drawOptions.color);
      }
      if (drawOptions.edgeSize) {
        gl.uniform1f(this.program.u_EdgeSize, drawOptions.edgeSize);
      }
      if (drawOptions.edgeColor) {
        gl.uniform4fv(this.program.u_EdgeColor, drawOptions.edgeColor);
      }

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawBivalentBubbleMap(transform: Float32Array) {
    var bubbleScale = 1;
    var drawOptions = this._layer.drawOptions;
    if (drawOptions && drawOptions.bubbleScaleRange) {
      bubbleScale = this.computeFromGmapsZoomLevel(drawOptions.bubbleScaleRange);
    }
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var color = drawOptions.color || this._defaultColor;
      if (color.length == 3) {
        color.push(1.0);
      }
      // 1.0 == full circle, 2.0 == left half, 3.0 == right half
      var mode = gEarthTime.layerDB.pairedLayerModeById[this._layer.layerId] || drawOptions.mode || 1.0;

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.a_Centroid(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0);
      this.program.setVertexAttrib.a_Epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_PointVal1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_ColorVal1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);
      this.program.setVertexAttrib.a_Epoch2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 20);
      this.program.setVertexAttrib.a_PointVal2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 24);
      this.program.setVertexAttrib.a_ColorVal2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 28);

      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);
      gl.uniform1f(this.program.u_Epoch, currentTime);
      gl.uniform1f(this.program.u_Size, 2.0 * window.devicePixelRatio * bubbleScale);

      if (this._texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this.program.u_Image, 0);
      }

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawStyledBubbleMap(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.a_coords(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_val1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_epoch2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);
      this.program.setVertexAttrib.a_val2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 20);
      this.program.setVertexAttrib.a_fill_rgba(4, gl.FLOAT, false, this._layer.numAttributes * 4, 24);
      this.program.setVertexAttrib.a_stroke_width(1, gl.FLOAT, false, this._layer.numAttributes * 4, 40);
      this.program.setVertexAttrib.a_stroke_rgba(4, gl.FLOAT, false, this._layer.numAttributes * 4, 44);

      gl.uniformMatrix4fv(this.program.u_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_epoch, currentTime);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }
  // This could implement binary search
  epochToInterpolatedFrameNum(epoch: number, frameEpochs: string | any[]) {
    for (var i = 0; i < this.epochs.length; i++) {
      if (epoch <= frameEpochs[i]) {
        if (i == 0)
          return 0; // at or before first frameEpoch
        var frac = (epoch - frameEpochs[i - 1]) / (frameEpochs[i] - frameEpochs[i - 1]);
        return i - 1 + frac;
      }
    }
    // after last frameEpoch
    return frameEpochs.length - 1;
  }

  _drawChoroplethMap(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready && this._texture) {
      var drawOptions = this._layer.drawOptions;
      // Only draw if we're ready and not an empty tile
      var dfactor = drawOptions.dfactor || gl.ONE;
      if (dfactor == "ONE_MINUS_SRC_ALPHA") {
        dfactor = gl.ONE_MINUS_SRC_ALPHA;
      }

      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, dfactor);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);
      var color = this._defaultColor; // default color not used
      if (drawOptions.color) {
        color = drawOptions.color;
        gl.uniform1i(this.program.u_useColorMap, 0);
      }
      else {
        gl.uniform1i(this.program.u_useColorMap, 1);
      }

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      // There sshouldn't be a pointSize with a choropleth, right???
      //pointSize *= Math.floor((gEarthTime.gmapsZoomLevel() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      //if (isNaN(pointSize)) {
      //  pointSize = 1.0;
      //}

      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);

      gl.uniform4fv(this.program.u_color, color);

      if (this._triangleLists) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this.program.u_Colormap, 0); // TEXTURE0

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._valuesTexture);
        gl.uniform1i(this.program.u_Values, 1); // TEXTURE1

        gl.uniform1f(this.program.u_NumRegionsPerRow, this.nRegionsPerRow);
        gl.uniform1f(this.program.u_NumEpochs, this.epochs.length);
        gl.uniform1f(this.program.u_ValuesWidth, this.valuesWidth);
        gl.uniform1f(this.program.u_ValuesHeight, this.valuesHeight);

        var frameNo = this.epochToInterpolatedFrameNum(currentTime, this.epochs);
        if (this._timeVariableRegions) {
          // timeVariableRegions don't fade;  switch right at beginning of next frame, instead of fading between frames
          frameNo = Math.floor(frameNo + 0.01);
        }
        gl.uniform1f(this.program.u_TimeIndex, frameNo);

        // drawElements uses indices to avoid duplicating vertices within regions
        for (var i = 0; i < this._triangleLists.length; i++) {
          gl.bindBuffer(gl.ARRAY_BUFFER, this._triangleLists[i].arrayBuffer);

          this.program.setVertexAttrib.a_Centroid(2, gl.FLOAT, false, 12, 0);
          this.program.setVertexAttrib.a_RegionIdx(1, gl.FLOAT, false, 12, 8);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._triangleLists[i].indexBuffer);
          gl.drawElements(gl.TRIANGLES, this._triangleLists[i].count, gl.UNSIGNED_SHORT, 0);
        }
      }
      else {
        gl.uniform1f(this.program.u_Epoch, currentTime);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this.program.u_Image, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

        this.program.setVertexAttrib.a_Centroid(2, gl.FLOAT, false, 24, 0);
        this.program.setVertexAttrib.a_Epoch1(1, gl.FLOAT, false, 24, 8);
        this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 24, 12);
        this.program.setVertexAttrib.a_Epoch2(1, gl.FLOAT, false, 24, 16);
        this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 24, 20);

        gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
      }

     // //perf_draw_triangles(this._pointCount);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);

    }
  }

  // THIS FUNCTION MUST BE CALLED EVERY FRAME
  // See drawsEveryFrame below
  _drawLodes(transform: Float32Array, options: { filter: boolean; distance: number; step: number; throttle: number; se01: any; se02: any; se03: any; }) {
    var gl = this.gl;

    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);
      var uDist = options.distance || 50000.;

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      gl.uniform1f(this.program.uTime, options.step ?? 0);
      gl.uniform1f(this.program.uSize, 2.0); // pointSize
      gl.uniform1f(this.program.uZoom, gEarthTime.timelapseZoom());
      gl.uniform1i(this.program.filterDist, options.filter ?? 0);
      gl.uniform1i(this.program.showSe01, options.se01 ?? true);
      gl.uniform1i(this.program.showSe02, options.se02 ?? true);
      gl.uniform1i(this.program.showSe03, options.se03 ?? true);

      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);
      gl.uniform1f(this.program.uDist, uDist * 1000);

      this.program.setVertexAttrib.centroid(4, gl.FLOAT, false, 24, 0);
      this.program.setVertexAttrib.aDist(1, gl.FLOAT, false, 24, 16);
      this.program.setVertexAttrib.aColor(1, gl.FLOAT, false, 24, 20);

      gl.drawArrays(gl.POINTS, 0, Math.floor(this._pointCount * (options.throttle ?? 1.0)));
      gl.disable(gl.BLEND);
    }
  }

  // range[0] for country (zoomLevel = 5)
  // range[1] for block-level (zoomLevel = 17)
  computeFromGmapsZoomLevel([countryVal, blockVal]: [number, number]) {
    var gmapsZoomLevel = gEarthTime.gmapsZoomLevel();
    var countryGmapsZoomLevel = 5;
    var blockGmapsZoomLevel = 17;

    return countryVal * Math.pow(blockVal / countryVal, (gmapsZoomLevel - countryGmapsZoomLevel) / (blockGmapsZoomLevel - countryGmapsZoomLevel));
  }

  computeDotSize(transform: Float32Array) {
    var drawOptions = this._layer.drawOptions;

    if (drawOptions && drawOptions.dotSizeRange && drawOptions.dotSizeRange.length == 2) {
      var dotSize = this.computeFromGmapsZoomLevel(drawOptions.dotSizeRange);
      return dotSize * WebGLVectorTile2.dotScale;
    }
    else {
      var pixelScale = -transform[5];

      // Start scaling pixels extra for tiles beyond level 10
      if (this._tileidx.l > 10) {
        pixelScale *= Math.pow(2, (this._tileidx.l - 10));
      }
      return Math.max(0.5, pixelScale * 38) * WebGLVectorTile2.dotScale;
    }
  }

  _drawColorDotmap(transform: Float32Array, {throttle}: {throttle: number}) {
    var gl = this.gl;
    if (this._ready) {
      var drawOptions = this._layer.drawOptions;
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // transform maps 0-256 input coords to the tile's pixel space on the screen.
      // But color dotmaps treat 0-256 input coords to map to the entire planet, not the current tile's extents.
      // Scale tileTransform so that it would map 0-256 input coords to the entire planet.
      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      gl.uniform1f(this.program.uSize, this.computeDotSize(transform));
      gl.uniform1f(this.program.uZoom, gEarthTime.gmapsZoomLevel());
      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      gl.enableVertexAttribArray(this.program.aWorldCoord);
      gl.vertexAttribPointer(this.program.aWorldCoord, 2, gl.FLOAT, false, 12, 0);

      gl.enableVertexAttribArray(this.program.aColor);
      gl.vertexAttribPointer(this.program.aColor, 1, gl.FLOAT, false, 12, 8);

      var npoints = Math.floor(this._pointCount * (throttle ?? 1.0));
      gl.drawArrays(gl.POINTS, 0, npoints);
      gl.disable(gl.BLEND);
    }
  }

  _drawColorDotmapTbox(transform: Float32Array, {throttle}: {throttle: number}) {
    var gl = this.gl;
    if (this._ready) {
      var drawOptions = this._layer.drawOptions;
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // transform maps 0-256 input coords to the tile's pixel space on the screen.
      // But color dotmaps treat 0-256 input coords to map to the entire planet, not the current tile's extents.
      // Scale tileTransform so that it would map 0-256 input coords to the entire planet.
      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      gl.uniform1f(this.program.uSize, this.computeDotSize(transform));

      gl.uniform1f(this.program.uZoom, gEarthTime.gmapsZoomLevel());

      var epoch = gEarthTime.currentEpochTime();
      gl.uniform1f(this.program.uEpoch, epoch);
      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      var stride = 5 * 4;
      this.program.setVertexAttrib.aWorldCoord(2, gl.FLOAT, false, stride, 0);
      this.program.setVertexAttrib.aColor(1, gl.FLOAT, false, stride, 8);
      this.program.setVertexAttrib.aStartEpoch(1, gl.FLOAT, false, stride, 12);
      this.program.setVertexAttrib.aEndEpoch(1, gl.FLOAT, false, stride, 16);

      var npoints = Math.floor(this._pointCount * (throttle ?? 1.0));
      gl.drawArrays(gl.POINTS, 0, npoints);
      gl.disable(gl.BLEND);
    }
  }

  _drawMonthlyRefugees(transform: Float32Array) {
    if (this._ready) {

      this.gl.useProgram(this.program);
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.DST_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions;

      var pointSize = drawOptions.pointSize || (1.0 * window.devicePixelRatio);;
      pointSize *= 4.0 * Math.pow(20 / 4, (gEarthTime.timelapseZoom() - 3) / (10 - 3));

      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }



      this.gl.uniform1f(this.program.uSize, pointSize);

      this.gl.uniform1f(this.program.uTotalTime, 1296000);

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
      this.gl.uniformMatrix4fv(this.program.uMapMatrix, false, tileTransform);

      this.gl.uniform1f(this.program.uEpoch, gEarthTime.currentEpochTime());

      this.program.setVertexAttrib.aStartPoint(2, this.gl.FLOAT, false, 40, 0);
      this.program.setVertexAttrib.aEndPoint(2, this.gl.FLOAT, false, 40, 8);
      this.program.setVertexAttrib.aMidPoint(2, this.gl.FLOAT, false, 40, 16);
      this.program.setVertexAttrib.aEpoch(1, this.gl.FLOAT, false, 40, 24);
      this.program.setVertexAttrib.aEndTime(1, this.gl.FLOAT, false, 40, 28);
      this.program.setVertexAttrib.aSpan(1, this.gl.FLOAT, false, 40, 32);
      this.program.setVertexAttrib.aTimeOffset(1, this.gl.FLOAT, false, 40, 36);

      this.gl.drawArrays(this.gl.POINTS, 0, this._pointCount);

      this.gl.disable(this.gl.BLEND);
    }
  }

  _drawAnnualRefugees(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      //gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions as {span:number};
      var pointSize = Math.floor(((20 - 5) * (gEarthTime.timelapseZoom() - 0) / (21 - 0)) + 5);
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }
      pointSize *= 2;
      gl.uniform1f(this.program.uSize, pointSize);

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
      gl.uniformMatrix4fv(this.program.uMapMatrix, false, tileTransform);

      gl.uniform1f(this.program.uEpoch, gEarthTime.currentEpochTime());

      gl.uniform1f(this.program.uSpan, drawOptions.span ?? 240 * 24 * 60 * 60); // default to 240 days

      this.program.setVertexAttrib.aStartPoint(2, gl.FLOAT, false, 28, 0);
      this.program.setVertexAttrib.aEndPoint(2, gl.FLOAT, false, 28, 8);
      this.program.setVertexAttrib.aMidPoint(2, gl.FLOAT, false, 28, 16);
      this.program.setVertexAttrib.aEpoch(1, gl.FLOAT, false, 28, 24);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_Image, 0);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);
    }
  }

  _drawPointFlow(transform: Float32Array, options: { [x: string]: number[]; }) {
    var gl = this.gl;
    if (this._ready) {

      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var pointSize = Math.floor(((20 - 5) * (gEarthTime.timelapseZoom() - 0) / (21 - 0)) + 5);
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      var start_color = [.94, .94, .94, 1.];
      var end_color = [.71, 0.09, 0.05, 1.0];
      var drawOptions = this._layer.drawOptions;
      if (Array.isArray(drawOptions['start_color'])) {
        if (drawOptions['start_color'].length == 3) {
          start_color.push(1.0);
        }
        if (drawOptions['start_color'].length == 4) {
          start_color = drawOptions['start_color'];
        }
        else {
          console.log("ERROR: unknown start_color array");
        }
      }

      if (Array.isArray(drawOptions['end_color'])) {
        if (drawOptions['end_color'].length == 3) {
          end_color.push(1.0);
        }
        if (drawOptions['end_color'].length == 4) {
          end_color = drawOptions['end_color'];
        }
        else {
          console.log("ERROR: unknown end_color array");
        }
      }

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_size, pointSize);
      gl.uniform1f(this.program.u_epoch, gEarthTime.currentEpochTime());
      gl.uniform4fv(this.program.u_start_color, start_color);
      gl.uniform4fv(this.program.u_end_color, end_color);

      this.program.setVertexAttrib.a_p0(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0);
      this.program.setVertexAttrib.a_p1(2, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_p2(2, gl.FLOAT, false, this._layer.numAttributes * 4, 16);
      this.program.setVertexAttrib.a_epoch0(1, gl.FLOAT, false, this._layer.numAttributes * 4, 24);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 28);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawHealthImpact(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions;
      var pointSize = Math.floor(((20 - 5) * (gEarthTime.timelapseZoom() - 0) / (21 - 0)) + 5);
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }
      gl.uniform1f(this.program.uSize, pointSize);

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);

      var year = new Date(gEarthTime.currentEpochTime() * 1000).getUTCFullYear();
      var showRcp = drawOptions.showRcp;

      // compute delta;
      var years = drawOptions.years;
      if (year > years[years.length - 1]) {
        year = years[years.length - 1];
      }

      if (year < years[0]) {
        year = years[0];
      }

      var delta = 1.0;
      var minYear: number;
      var maxYear: number;
      for (var i = 0; i < years.length; i++) {
        if (year >= years[i]) {
          minYear = years[i];
          if (i == years.length - 1) {
            maxYear = years[i];
          }
          else {
            maxYear = years[i + 1];
          }
        }
      }
      if (maxYear != minYear) {
        delta = (year - minYear) / (maxYear - minYear);
      }

      gl.uniform1f(this.program.u_Delta, delta);
      gl.uniform1f(this.program.u_Year, minYear);
      gl.uniform1f(this.program.u_ShowRcp2p6, showRcp[0]);
      gl.uniform1f(this.program.u_ShowRcp4p5, showRcp[1]);
      gl.uniform1f(this.program.u_ShowRcp6p0, showRcp[2]);
      gl.uniform1f(this.program.u_ShowRcp8p5, showRcp[3]);

      this.program.setVertexAttrib.a_Centroid(2, gl.FLOAT, false, 24, 0);
      this.program.setVertexAttrib.a_Year(1, gl.FLOAT, false, 24, 8);
      this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 24, 12);
      this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 24, 16);
      this.program.setVertexAttrib.a_Rcp(1, gl.FLOAT, false, 24, 20);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawViirs(transform: Float32Array, options: DrawOptions) {
    var gl = this.gl;
    var _minTime = new Date('2014-03-14').getTime();
    var _maxTime = new Date('2014-04-13').getTime();
    var _showTemp = false;
    var _minTemp = 400.;
    var _maxTemp = 3000.;
    var _first = 0;
    var _count = 100;

    var opts = options || {};
    var showTemp = opts.showTemp || _showTemp;
    var minTemp = opts.minTemp || _minTemp;
    var maxTemp = opts.maxTemp || _maxTemp;
    var pointSize = opts.pointSize || (2.0 * window.devicePixelRatio);
    var first = opts.first || _first;
    var count = opts.count || _count;

    var maxTime = gEarthTime.currentEpochTime();
    var minTime = maxTime - 28 * 24 * 60 * 60;

    var viirsIndex = {
      '201408': { 'count': 115909, 'first': 0 },
      '201409': { 'count': 213165, 'first': 115909 },
      '201410': { 'count': 232833, 'first': 329074 },
      '201411': { 'count': 146622, 'first': 561907 },
      '201412': { 'count': 151926, 'first': 708529 },
      '201501': { 'count': 192835, 'first': 860455 },
      '201502': { 'count': 150901, 'first': 1053290 },
      '201503': { 'count': 189347, 'first': 1204191 },
      '201504': { 'count': 175398, 'first': 1393538 },
      '201505': { 'count': 133021, 'first': 1568936 },
      '201506': { 'count': 116314, 'first': 1701957 },
      '201507': { 'count': 192662, 'first': 1818271 },
      '201508': { 'count': 289941, 'first': 2010933 },
      '201509': { 'count': 282792, 'first': 2300874 },
      '201510': { 'count': 286486, 'first': 2583666 },
      '201511': { 'count': 187366, 'first': 2870152 },
      '201512': { 'count': 183570, 'first': 3057518 },
      '201601': { 'count': 208576, 'first': 3241088 },
      '201602': { 'count': 179606, 'first': 3449664 },
      '201603': { 'count': 184595, 'first': 3629270 },
      '201604': { 'count': 185076, 'first': 3813865 },
      '201605': { 'count': 144875, 'first': 3998941 },
      '201606': { 'count': 126776, 'first': 4143816 },
      '201607': { 'count': 175568, 'first': 4270592 },
      '201608': { 'count': 236754, 'first': 4446160 },
      '201609': { 'count': 254754, 'first': 4682914 },
      '201610': { 'count': 174679, 'first': 4937668 },
      '201611': { 'count': 167121, 'first': 5112347 },
      '201612': { 'count': 183016, 'first': 5279468 },
      '201701': { 'count': 181133, 'first': 5462484 },
      '201702': { 'count': 158187, 'first': 5643617 },
      '201703': { 'count': 156410, 'first': 5801804 },
      '201704': { 'count': 170735, 'first': 5958214 },
      '201705': { 'count': 101733, 'first': 6128949 },
      '201706': { 'count': 132268, 'first': 6230682 },
      '201707': { 'count': 171562, 'first': 6362950 },
      '201708': { 'count': 299079, 'first': 6534512 },
      '201709': { 'count': 298956, 'first': 6833591 },
      '201710': { 'count': 53789, 'first': 7132547 }
    };

    var currentDate = new Date(gEarthTime.currentEpochTime() * 1000);
    var currentMonth = currentDate.getUTCMonth();
    var currentYear = currentDate.getUTCFullYear();
    var prevYear = currentYear;
    var prevMonth = currentMonth - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    var currentIdx = currentYear + ('0' + (currentMonth + 1)).slice(-2);
    var prevIdx = prevYear + ('0' + (prevMonth + 1)).slice(-2);
    first = prevIdx in viirsIndex ? viirsIndex[prevIdx]['first'] : 0;
    count = prevIdx in viirsIndex && currentIdx in viirsIndex ? viirsIndex[currentIdx]['count'] + viirsIndex[prevIdx]['count'] : 100;

    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1);
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      if (gl.canvas.width >= 4000 || gl.canvas.height >= 4000) {
        pointSize += 2.0;
      }

      gl.uniformMatrix4fv(this.program.mapMatrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.worldCoord(2, gl.FLOAT, false, 12, 0);
      this.program.setVertexAttrib.time(1, gl.FLOAT, false, 12, 8);

      gl.uniform1f(this.program.maxTime, maxTime);
      gl.uniform1f(this.program.minTime, minTime);
      gl.uniform1f(this.program.pointSize, pointSize);

      gl.drawArrays(gl.POINTS, first, count);
      gl.disable(gl.BLEND);
    }
  }

  _drawUrbanFragility(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var pointSize = Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1);
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniform1f(this.program.u_Size, pointSize);

      var tileTransform = new Float32Array(transform);
      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);
      gl.uniform1f(this.program.u_Delta, gEarthTime.timelapseCurrentTimeDelta());
      gl.uniform1f(this.program.u_Year, new Date(gEarthTime.currentEpochTime() * 1000).getUTCFullYear());

      this.program.setVertexAttrib.a_Centroid(2, gl.FLOAT, false, 20, 0);
      this.program.setVertexAttrib.a_Year(1, gl.FLOAT, false, 20, 8);
      this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 20, 12);
      this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 20, 16);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_Image, 0);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawObesity(transform: Float32Array) {
    //console.log(options);
    //console.log(this._pointCount);
    var gl = this.gl;
    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      var year = drawOptions.year || new Date(gEarthTime.currentEpochTime() * 1000).getUTCFullYear();
      var delta = drawOptions.delta;

      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);

      gl.uniform1f(this.program.u_Delta, delta);

      gl.uniform1f(this.program.u_Year, year);

      this.program.setVertexAttrib.a_Vertex(2, gl.FLOAT, false, 20, 0);
      this.program.setVertexAttrib.a_Year(1, gl.FLOAT, false, 20, 8);
      this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 20, 12);
      this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 20, 16);


      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_Image, 0);

      gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
     // //perf_draw_triangles(this._pointCount);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);

    }
  }

  _drawTimeSeriesPointData(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      //gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      var year = new Date(gEarthTime.currentEpochTime() * 1000).getUTCFullYear();
      var maxValue = drawOptions.maxValue || 100.0;

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_max_value, maxValue);

      gl.uniform1f(this.program.u_epoch, year);

      this.program.setVertexAttrib.a_centroid(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_val1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_epoch2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);
      this.program.setVertexAttrib.a_val2(1, gl.FLOAT, false, this._layer.numAttributes * 4, 20);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);

    }
  }

  _drawVaccineConfidence(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_MapMatrix, false, tileTransform);

      var val = drawOptions.question || 1.0;

      gl.uniform1f(this.program.u_Val, val);

      this.program.setVertexAttrib.a_Vertex(2, gl.FLOAT, false, 24, 0);
      this.program.setVertexAttrib.a_Val1(1, gl.FLOAT, false, 24, 8);
      this.program.setVertexAttrib.a_Val2(1, gl.FLOAT, false, 24, 12);
      this.program.setVertexAttrib.a_Val3(1, gl.FLOAT, false, 24, 16);
      this.program.setVertexAttrib.a_Val4(1, gl.FLOAT, false, 24, 20);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_Image, 0);

      gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
     // //perf_draw_triangles(this._pointCount);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.disable(gl.BLEND);

    }
  }

  _drawIomIdp(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);

      var showIrqIdps = typeof(drawOptions.showIrqIdps) != "undefined" ? drawOptions.showIrqIdps : 0.0;
      var showSyrIdps = typeof(drawOptions.showSyrIdps) != "undefined" ? drawOptions.showSyrIdps : 0.0;
      var showYemIdps = typeof(drawOptions.showYemIdps) != "undefined" ? drawOptions.showYemIdps : 0.0;
      var showLbyIdps = typeof(drawOptions.showLbyIdps) != "undefined" ? drawOptions.showLbyIdps : 0.0;
      var showIrqReturns = typeof(drawOptions.showIrqReturns) != "undefined" ? drawOptions.showIrqReturns : 0.0;
      var showSyrReturns = typeof(drawOptions.showSyrReturns) != "undefined" ? drawOptions.showSyrReturns : 0.0;
      var showYemReturns = typeof(drawOptions.showYemReturns) != "undefined" ? drawOptions.showYemReturns : 0.0;
      var showLbyReturns = typeof(drawOptions.showLbyReturns) != "undefined" ? drawOptions.showLbyReturns : 0.0;

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_point_size, drawOptions.pointSize);

      gl.uniform1f(this.program.u_epoch, gEarthTime.currentEpochTime());

      gl.uniform1f(this.program.u_show_irq_idps, showIrqIdps);

      gl.uniform1f(this.program.u_show_syr_idps, showSyrIdps);

      gl.uniform1f(this.program.u_show_yem_idps, showYemIdps);

      gl.uniform1f(this.program.u_show_lby_idps, showLbyIdps);

      gl.uniform1f(this.program.u_show_irq_returns, showIrqReturns);

      gl.uniform1f(this.program.u_show_syr_returns, showSyrReturns);

      gl.uniform1f(this.program.u_show_yem_returns, showYemReturns);

      gl.uniform1f(this.program.u_show_lby_returns, showLbyReturns);

      this.program.setVertexAttrib.a_country(1, gl.FLOAT, false, 32, 0);
      this.program.setVertexAttrib.a_type(1, gl.FLOAT, false, 32, 4);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, 32, 8);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, 32, 16);
      this.program.setVertexAttrib.a_val1(1, gl.FLOAT, false, 32, 20);
      this.program.setVertexAttrib.a_epoch2(1, gl.FLOAT, false, 32, 24);
      this.program.setVertexAttrib.a_val2(1, gl.FLOAT, false, 32, 28);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);

    }
  }

  _drawTsip(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, 20, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, 20, 8); // 8 byte offset
      this.program.setVertexAttrib.a_epoch(1, gl.FLOAT, false, 20, 12); // 8 byte offset
      this.program.setVertexAttrib.a_val(1, gl.FLOAT, false, 20, 16); // 8 byte offset

      gl.uniform1f(this.program.u_epoch, gEarthTime.currentEpochTime());
      gl.uniform1f(this.program.u_size, pointSize);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawPoint(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);

      var drawOptions = this._layer.drawOptions;
      var sfactor = gl.SRC_ALPHA;
      var dfactor = gl.ONE_MINUS_SRC_ALPHA;
      if (drawOptions.dfactor) {
        dfactor = gl[drawOptions.dfactor];
      }
      if (drawOptions.sfactor) {
        sfactor = gl[drawOptions.sfactor];
      }
      gl.blendFunc(sfactor, dfactor);

      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      var pointSize = 1.0;
      if (drawOptions.pointSize) {
        pointSize = drawOptions.pointSize;
      }
      if (drawOptions.pointSizeFnc) {
        var pointSizeFnc = new Function('return ' + drawOptions.pointSizeFnc)();
        pointSize *= pointSizeFnc(gEarthTime.gmapsZoomLevel());
      }

      var overridePackedColor = false;
      var color = this._layer.drawOptions.color;
      if (color) {
        overridePackedColor = true;
        if (color.length == 3) {
          color.push(1.0);
        }
      }

      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniform1f(this.program.u_size, pointSize);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, 12, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      var overridePackedColorLoc = gl.getUniformLocation(this.program, 'override_packed_color');
      gl.uniform1i(overridePackedColorLoc, overridePackedColor);

      if (overridePackedColor) {
        var colorLoc = gl.getUniformLocation(this.program, 'u_color');
        gl.uniform4fv(colorLoc, color);
      }

      // Attributes defined in a shader must be enabled
      var attributeLoc = gl.getAttribLocation(this.program, 'a_color');
      gl.enableVertexAttribArray(attributeLoc);
      gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 12, 8); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  // no animation
  _drawGlyph(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      // set up glsl program
      gl.useProgram(this.program);

      var drawOptions = this._layer.drawOptions;

      var pointSize = drawOptions.pointSize || 30.0;

      // blending
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_size, pointSize);

      // attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each

      //texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_texture, 0);
      // make sure we can render it even if it's not a power of 2
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // draw
      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  // animated
  _drawGlyphStartEpochEndEpoch(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      // set up glsl program
      gl.useProgram(this.program);

      var drawOptions = this._layer.drawOptions;

      var numGlyphs = drawOptions.numGlyphs || 1.0;
      var fadeDuration = drawOptions.fadeDuration || 36000.0;
      var pointSize = drawOptions.pointSize || 30.0;

      // blending
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      // uniforms
      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_fade_duration, fadeDuration); //10 hr
      gl.uniform1f(this.program.u_epoch, currentTime);
      gl.uniform1f(this.program.u_size, pointSize);
      gl.uniform1f(this.program.u_num_glyphs, numGlyphs);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_texture, 0);
      // make sure we can render it even if it's not a power of 2
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // attributes = 5
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each
      this.program.setVertexAttrib.a_epoch0(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_offset(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);

      // draw
      gl.drawArrays(gl.POINTS, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawPolygon(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);

      var drawOptions = this._layer.drawOptions;
      var sfactor = gl.SRC_ALPHA;
      var dfactor = gl.ONE;
      if (drawOptions.dfactor) {
        dfactor = gl[drawOptions.dfactor];
      }
      if (drawOptions.sfactor) {
        sfactor = gl[drawOptions.sfactor];
      }
      gl.blendFunc(sfactor, dfactor);

      let u_alpha = 1.0;
      if (this._layer.color && this._layer.color.length == 4) {
        u_alpha = this._layer.color[3];
      }

      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_alpha, u_alpha);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, 12, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, 12, 8); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.drawArrays(gl.TRIANGLES, 0, this._pointCount);
      //gl.drawElements(gl.TRIANGLES, 170840, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
    }
  }

  _drawLineString(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      var drawOptions = this._layer.drawOptions;
      var dfactor = drawOptions.dfactor || gl.ONE;
      if (dfactor == "ONE_MINUS_SRC_ALPHA") {
        dfactor = gl.ONE_MINUS_SRC_ALPHA;
      }

      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, dfactor);

      var tileTransform = new Float32Array(transform);
      var color = drawOptions.color || [1.0, 0.0, 0.0, 1.0];
      if (color.length == 3) {
        color.push(1.0);
      }

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform4fv(this.program.u_color, color);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, 8, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.drawArrays(gl.LINES, 0, this._pointCount);
      gl.disable(gl.BLEND);
    }
  }

  _drawLineStringEpoch(transform: Float32Array) {
    var gl = this.gl;
    if (typeof this.buffers == "undefined") {
      this.buffers = {};
    }

    var drawOptions = this._layer.drawOptions;
    var that = this;
    if (typeof this.worker == "undefined") {
      this.worker = new Worker('data-worker.js');
      this.worker.onmessage = function(e) {
        var key = e.data['key'];
        var array = new Float32Array(e.data['array']);
        that.buffers[key] = {
          "numAttributes": that._layer.numAttributes,
          "pointCount": array.length/that._layer.numAttributes,
          "buffer": gl.createBuffer(),
          "ready": false
        };
        gl.bindBuffer(gl.ARRAY_BUFFER, that.buffers[key]["buffer"]);
        gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
        that.buffers[key]["ready"] = true;
      }
    }


    // TODO: Set via options
    var minkey = '20200101';
    var maxkey = '20200531';

    var currentTime = gEarthTime.currentEpochTime();
    var yesterday = new Date(currentTime);
    yesterday.setDate(yesterday.getDate() - 1);

    var tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);

    var tomorrows = [];
    for (var i = 2; i < 8; i++) {
      var tomorrow = new Date(currentTime);
      tomorrow.setDate(tomorrow.getDate() + i);
      tomorrows.push(tomorrow);
    }
    // TODO: Pass this in via draw options
    var keyFn = function(currentTime) {
      var yyyy = currentTime.getUTCFullYear();
      var month = currentTime.getUTCMonth() + 1;
      var mm = month.toString();
      if (month < 10) {
        mm = '0' + mm;
      }
      var date = currentTime.getUTCDate();
      var dd = date.toString();
      if (date < 10) {
        dd = '0' + dd;
      }
      return yyyy + mm + dd;
    }

    var keys = [];
    var todayKey = keyFn(currentTime);
    var yesterdayKey = keyFn(yesterday)
    var tomorrowKey = keyFn(tomorrow);
    if (todayKey >= minkey && todayKey <= maxkey) {
      keys.push(todayKey);
    }
    if (yesterdayKey >= minkey && yesterdayKey <= maxkey) {
      keys.push(yesterdayKey);
    }
    if (tomorrowKey >= minkey && tomorrowKey <= maxkey) {
      keys.push(tomorrowKey);
    }
    // TODO: Set via draw options
    let regexp = 'yyyymmdd';
    let url_tmpl = 'https://tiles.earthtime.org/opensky_network_org/yyyymmdd.bin';

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (typeof this.buffers[key] == "undefined") {
        this.buffers[key] = {
          "numAttributes": this._layer.numAttributes,
          "pointCount": 8,
          "buffer":null,
          "ready": false
        };

        var message = {
          'regexp': regexp,
          'url_tmpl': url_tmpl,
          'key': key
        }
        this.worker.postMessage(message);
      }
    }


    for (var i = 0; i < tomorrows.length; i++) {
      var key = keyFn(tomorrows[i]);
      if (typeof this.buffers[key] == "undefined") {
        this.buffers[key] = {
          "numAttributes": this._layer.numAttributes,
          "pointCount": 8,
          "buffer":null,
          "ready": false
        };

        var message = {
          'regexp': regexp,
          'url_tmpl': url_tmpl,
          'key': key
        }
        this.worker.postMessage(message);
      }
    }

    //console.log(this.buffers);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (this.buffers[key]["ready"]) {
        var dfactor = drawOptions.dfactor || gl.ONE;
        if (dfactor == "ONE_MINUS_SRC_ALPHA") {
          dfactor = gl.ONE_MINUS_SRC_ALPHA;
        }

        gl.useProgram(this.program);
        gl.enable(gl.BLEND);
        gl.blendFunc( gl.SRC_ALPHA, dfactor );

        var tileTransform = new Float32Array(transform);
        var zoom = gEarthTime.gmapsZoomLevel();
        var currentTime = currentTime/1000.;
        var color = drawOptions.color || [1.0, 0.0, 0.0, 1.0];
        if (color.length == 3) {
          color.push(1.0);
        }

        scaleMatrix(tileTransform, Math.pow(2,this._tileidx.l)/256., Math.pow(2,this._tileidx.l)/256.);
        scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

        var matrixLoc = gl.getUniformLocation(this.program, 'u_map_matrix');
        gl.uniformMatrix4fv(matrixLoc, false, tileTransform);

        var colorLoc = gl.getUniformLocation(this.program, 'u_color');
        gl.uniform4fv(colorLoc, color);

        var colorLoc = gl.getUniformLocation(this.program, 'u_epoch');
        gl.uniform1f(colorLoc, currentTime);

        var foo = gl.getUniformLocation(this.program, 'u_span');
        var span = 60*60*24*1;
        gl.uniform1f(foo, span);

        //gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[key]["buffer"])
        var attributeLoc = gl.getAttribLocation(this.program, 'a_coord');
        gl.enableVertexAttribArray(attributeLoc);
        gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 12, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

        var attributeLoc = gl.getAttribLocation(this.program, 'a_epoch');
        gl.enableVertexAttribArray(attributeLoc);
        gl.vertexAttribPointer(attributeLoc, 1, gl.FLOAT, false, 12, 8); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

        gl.drawArrays(gl.LINES, 0, this.buffers[key]["pointCount"]);
        gl.disable(gl.BLEND);
      } else {
        gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      }
    }
  }

  _drawExpandedLineString(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      // We don't use pointSize for line strings, right???
      //pointSize *= Math.floor((gEarthTime.gmapsZoomLevel() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      //if (isNaN(pointSize)) {
      //  pointSize = 1.0;
      //}

      let u_thickness = 0.5;
      if (drawOptions.thickness) {
        let thickness = d3.scaleLinear().domain(drawOptions.thickness.domain).range(drawOptions.thickness.range);
        u_thickness = thickness(gEarthTime.gmapsZoomLevel());
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform3fv(this.program.u_color, [1., 0., 0.]);
      gl.uniform1f(this.program.u_thickness, u_thickness);
      gl.uniform1f(this.program.u_inner, .0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[0]);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, 8, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[1]);
      this.program.setVertexAttrib.a_normal(2, gl.FLOAT, false, 8, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[2]);
      this.program.setVertexAttrib.a_miter(1, gl.FLOAT, false, 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffers[3]);
      this.program.setVertexAttrib.a_texture_loc(1, gl.FLOAT, false, 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);

      //texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_texture, 0);
      // make sure we can render it even if it's not a power of 2
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.drawElements(gl.TRIANGLES, this._pointCount, gl.UNSIGNED_SHORT, 0);
      //gl.drawElements(gl.TRIANGLES, 170840, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
    }
  }

  _drawPointSizeColor(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_size, pointSize);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_size(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawPointSizeColorEpoch(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;

      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_size, pointSize);
      gl.uniform1f(this.program.u_epoch, currentTime);
      gl.uniform1f(this.program.u_epoch_range, drawOptions.epochRange ?? 365 * 24 * 60 * 60);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_size(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_epoch(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawPointColorStartEpochEndEpoch(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);

      var drawOptions = this._layer.drawOptions;
      //add function for interpreting functions?
      var dfactor = drawOptions.dfactor || gl.ONE;
      if (dfactor == "ONE_MINUS_SRC_ALPHA") {
        dfactor = gl.ONE_MINUS_SRC_ALPHA;
      }
      else { // if options exist but not covered here
        dfactor = gl.ONE;
      }
      gl.blendFunc(gl.SRC_ALPHA, dfactor);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
      gl.uniform1f(this.program.u_epoch, currentTime);
      gl.uniform1f(this.program.u_size, pointSize);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_epoch0(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawPointSizeColorStartEpochEndEpoch(transform: Float32Array) {
    var gl = this.gl;
    if (this._ready) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (13.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_epoch, currentTime);

      gl.uniform1f(this.program.u_size, pointSize);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.a_coord(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_size(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, this._layer.numAttributes * 4, 12);
      this.program.setVertexAttrib.a_epoch0(1, gl.FLOAT, false, this._layer.numAttributes * 4, 16);
      this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, this._layer.numAttributes * 4, 20);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawSitc4rcBuffer(code: string, year: string, transform: Iterable<number>, options: { setDataFnc: any;}) {
    var gl = this.gl;
    var buffer = this.buffers[code][year];
    if (!buffer.buffer)
      return;
    gl.useProgram(this.program);

    var drawOptions = this._layer.drawOptions;
    var tileTransform = new Float32Array(transform);
    var currentTime = gEarthTime.currentEpochTime();
    var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);
    var color = drawOptions.color || [1.0, 0.0, 0.0];

    scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
    scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

    pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (23.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
    if (isNaN(pointSize)) {
      pointSize = 1.0;
    }

    var setDataFnc = options.setDataFnc || 'setData';

    gl.enable(gl.BLEND);
    if (setDataFnc == "setData2") {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }

    gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
    gl.uniform1f(this.program.u_epoch, currentTime);
    gl.uniform1f(this.program.u_size, pointSize);
    gl.uniform3fv(this.program.u_end_color, color);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
    this.program.setVertexAttrib.a_p0(2, gl.FLOAT, false, buffer.numAttributes * 4, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
    this.program.setVertexAttrib.a_p2(2, gl.FLOAT, false, buffer.numAttributes * 4, 8);
    this.program.setVertexAttrib.a_p1(2, gl.FLOAT, false, buffer.numAttributes * 4, 16);
    this.program.setVertexAttrib.a_epoch0(1, gl.FLOAT, false, buffer.numAttributes * 4, 24);
    this.program.setVertexAttrib.a_epoch1(1, gl.FLOAT, false, buffer.numAttributes * 4, 28);

    if (setDataFnc == "setData2") {
      this.program.setVertexAttrib.a_alpha(1, gl.FLOAT, false, buffer.numAttributes * 4, 32);
    }

    if (this._texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this.program.u_Image, 0);
    }

    gl.drawArrays(gl.POINTS, 0, buffer.pointCount);

    gl.disable(gl.BLEND);
  }

  _initSitc4rcBuffer(code: string, year: string, setDataFnc: string) {
    this.buffers[code][year] = {
      "numAttributes": this._layer.numAttributes,
      "pointCount": 8,
      "buffer": null,
      "ready": false
    };
    var rootUrl = gEarthTime.rootTilePath;
    if (this._url.indexOf("http://") == 0 || this._url.indexOf("https://") == 0) {
      var re = /([a-z0-9]{1,})\/([0-9]{4}).json/g;
      var m = re.exec(this._url);
      rootUrl = this._url.replace(m[0], "").split("?")[0];
    }
    else {
      var re = /([a-z0-9]{1,})\/([0-9]{4}).json/g;
      var m = re.exec(this._url);
      rootUrl = this._url.replace(m[0], "").split("?")[0];
    }
    this.worker.postMessage({
      'year': year,
      'code': code,
      'exporters': this._exporters,
      'importers': this._importers,
      'scale': this._scale,
      'rootUrl': rootUrl,
      'setDataFnc': setDataFnc
    });
  }

  _drawSitc4r2(transform: Float32Array, options: { setDataFnc?: string; }) {
    if (this._ready) {
      var code = this._sitc4r2Code;
      var currentYear = new Date(gEarthTime.currentEpochTime() * 1000).getUTCFullYear();

      var drawOptions = this._layer.drawOptions;
      var setDataFnc = drawOptions.setDataFnc ?? 'setData';

      if (typeof this.buffers[code] == "undefined") {
        this.buffers[code] = {};
      }
      /* Init Buffers */
      if (typeof this.buffers[code][currentYear.toString()] == "undefined") {
        this._initSitc4rcBuffer(code, currentYear.toString(), setDataFnc);
      }
      if (typeof this.buffers[code][(currentYear + 1).toString()] == "undefined") {
        this._initSitc4rcBuffer(code, (currentYear + 1).toString(), setDataFnc);
      }
      /* Draw buffers */
      if (this.buffers[code][currentYear.toString()] && this.buffers[code][currentYear.toString()].ready) {
        this._drawSitc4rcBuffer(code, currentYear.toString(), transform, {setDataFnc: setDataFnc});
      }
      else {
        gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      }
      if (this.buffers[code][(currentYear + 1).toString()] && this.buffers[code][(currentYear + 1).toString()].ready) {
        this._drawSitc4rcBuffer(code, (currentYear + 1).toString(), transform, {setDataFnc: setDataFnc});
      }
      else {
        gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      }
    }
  }

  _drawSpCrude(transform: Float32Array) {
    var indices = {
      "crude_flows_index": [
        {'filename': '0-crude-flows.bin', 'max_epoch': 1362803764.439162, 'min_epoch': 1344196740.0},
        {'filename': '1-crude-flows.bin', 'max_epoch': 1368630850.6254642, 'min_epoch': 1356352440.0},
        {'filename': '2-crude-flows.bin', 'max_epoch': 1375477977.755611, 'min_epoch': 1363526454.6067417},
        {'filename': '3-crude-flows.bin', 'max_epoch': 1382008440.0, 'min_epoch': 1365473760.0},
        {'filename': '4-crude-flows.bin', 'max_epoch': 1392493649.7164462, 'min_epoch': 1371392040.0},
        {'filename': '5-crude-flows.bin', 'max_epoch': 1393598774.858223, 'min_epoch': 1382677171.011236},
        {'filename': '6-crude-flows.bin', 'max_epoch': 1399832731.587473, 'min_epoch': 1385223928.5822306},
        {'filename': '7-crude-flows.bin', 'max_epoch': 1406034129.6090713, 'min_epoch': 1392063240.0},
        {'filename': '8-crude-flows.bin', 'max_epoch': 1413160440.0, 'min_epoch': 1400939343.3707864},
        {'filename': '9-crude-flows.bin', 'max_epoch': 1418089195.8662152, 'min_epoch': 1404994380.0},
        {'filename': '10-crude-flows.bin', 'max_epoch': 1424125799.774436, 'min_epoch': 1413165780.0},
        {'filename': '11-crude-flows.bin', 'max_epoch': 1442046780.0, 'min_epoch': 1417092012.1348314},
        {'filename': '12-crude-flows.bin', 'max_epoch': 1437058019.1022444, 'min_epoch': 1421189963.6363637},
        {'filename': '13-crude-flows.bin', 'max_epoch': 1443465644.3032672, 'min_epoch': 1425812640.0},
        {'filename': '14-crude-flows.bin', 'max_epoch': 1448988823.6228287, 'min_epoch': 1436904887.2727273},
        {'filename': '15-crude-flows.bin', 'max_epoch': 1455260843.3774915, 'min_epoch': 1445261237.9165041},
        {'filename': '16-crude-flows.bin', 'max_epoch': 1463993410.909091, 'min_epoch': 1450881160.140802},
        {'filename': '17-crude-flows.bin', 'max_epoch': 1467755612.9371564, 'min_epoch': 1457289194.0186915},
        {'filename': '18-crude-flows.bin', 'max_epoch': 1474374616.3636363, 'min_epoch': 1463748721.8181818},
        {'filename': '19-crude-flows.bin', 'max_epoch': 1481250173.6283185, 'min_epoch': 1469280227.0160873},
        {'filename': '20-crude-flows.bin', 'max_epoch': 1487025440.549273, 'min_epoch': 1474853520.0},
        {'filename': '21-crude-flows.bin', 'max_epoch': 1492642858.041543, 'min_epoch': 1483774740.0},
        {'filename': '22-crude-flows.bin', 'max_epoch': 1503923820.0, 'min_epoch': 1482323820.0},
        {'filename': '23-crude-flows.bin', 'max_epoch': 1508006340.0, 'min_epoch': 1492941696.4485981},
        {'filename': '24-crude-flows.bin', 'max_epoch': 1509999715.9048486, 'min_epoch': 1497947778.504673}
      ],
      "crude_flows_index_Oceania": [
        {'max_epoch': 1.5083176e+09, 'filename': 'Oceania/0-crude-flows_Oceania.bin', 'min_epoch': 1.3435715e+09}
      ],
      "crude_flows_index_AG": [
        {'max_epoch': 1.3617048e+09, 'filename': 'AG/0-crude-flows_AG.bin', 'min_epoch': 1.3441967e+09}, {'max_epoch': 1.3771071e+09, 'filename': 'AG/1-crude-flows_AG.bin', 'min_epoch': 1.3594772e+09}, {'max_epoch': 1.3706697e+09, 'filename': 'AG/2-crude-flows_AG.bin', 'min_epoch': 1.3597724e+09}, {'max_epoch': 1.3761761e+09, 'filename': 'AG/3-crude-flows_AG.bin', 'min_epoch': 1.3693578e+09}, {'max_epoch': 1.3799291e+09, 'filename': 'AG/4-crude-flows_AG.bin', 'min_epoch': 1.3730234e+09}, {'max_epoch': 1.3835629e+09, 'filename': 'AG/5-crude-flows_AG.bin', 'min_epoch': 1.376452e+09}, {'max_epoch': 1.3884915e+09, 'filename': 'AG/6-crude-flows_AG.bin', 'min_epoch': 1.3797737e+09}, {'max_epoch': 1.3922216e+09, 'filename': 'AG/7-crude-flows_AG.bin', 'min_epoch': 1.3842066e+09}, {'max_epoch': 1.3967419e+09, 'filename': 'AG/8-crude-flows_AG.bin', 'min_epoch': 1.3880942e+09}, {'max_epoch': 1.4022243e+09, 'filename': 'AG/9-crude-flows_AG.bin', 'min_epoch': 1.3932987e+09}, {'max_epoch': 1.4059923e+09, 'filename': 'AG/10-crude-flows_AG.bin', 'min_epoch': 1.398294e+09}, {'max_epoch': 1.4106575e+09, 'filename': 'AG/11-crude-flows_AG.bin', 'min_epoch': 1.4030985e+09}, {'max_epoch': 1.4146995e+09, 'filename': 'AG/12-crude-flows_AG.bin', 'min_epoch': 1.408361e+09}, {'max_epoch': 1.4204237e+09, 'filename': 'AG/13-crude-flows_AG.bin', 'min_epoch': 1.4105153e+09}, {'max_epoch': 1.4244887e+09, 'filename': 'AG/14-crude-flows_AG.bin', 'min_epoch': 1.416967e+09}, {'max_epoch': 1.4297343e+09, 'filename': 'AG/15-crude-flows_AG.bin', 'min_epoch': 1.4202262e+09}, {'max_epoch': 1.4338424e+09, 'filename': 'AG/16-crude-flows_AG.bin', 'min_epoch': 1.4269531e+09}, {'max_epoch': 1.438222e+09, 'filename': 'AG/17-crude-flows_AG.bin', 'min_epoch': 1.4312159e+09}, {'max_epoch': 1.4429395e+09, 'filename': 'AG/18-crude-flows_AG.bin', 'min_epoch': 1.4354159e+09}, {'max_epoch': 1.4478618e+09, 'filename': 'AG/19-crude-flows_AG.bin', 'min_epoch': 1.4417828e+09}, {'max_epoch': 1.4529947e+09, 'filename': 'AG/20-crude-flows_AG.bin', 'min_epoch': 1.4457651e+09}, {'max_epoch': 1.458193e+09, 'filename': 'AG/21-crude-flows_AG.bin', 'min_epoch': 1.4514196e+09}, {'max_epoch': 1.4634623e+09, 'filename': 'AG/22-crude-flows_AG.bin', 'min_epoch': 1.4557041e+09}, {'max_epoch': 1.4669064e+09, 'filename': 'AG/23-crude-flows_AG.bin', 'min_epoch': 1.4613379e+09}, {'max_epoch': 1.4730853e+09, 'filename': 'AG/24-crude-flows_AG.bin', 'min_epoch': 1.4639675e+09}, {'max_epoch': 1.4782132e+09, 'filename': 'AG/25-crude-flows_AG.bin', 'min_epoch': 1.4703533e+09}, {'max_epoch': 1.480319e+09, 'filename': 'AG/26-crude-flows_AG.bin', 'min_epoch': 1.4711836e+09}, {'max_epoch': 1.4862049e+09, 'filename': 'AG/27-crude-flows_AG.bin', 'min_epoch': 1.47741e+09}, {'max_epoch': 1.4903073e+09, 'filename': 'AG/28-crude-flows_AG.bin', 'min_epoch': 1.4828404e+09}, {'max_epoch': 1.4943535e+09, 'filename': 'AG/29-crude-flows_AG.bin', 'min_epoch': 1.4861729e+09}, {'max_epoch': 1.4983288e+09, 'filename': 'AG/30-crude-flows_AG.bin', 'min_epoch': 1.4919392e+09}, {'max_epoch': 1.5031058e+09, 'filename': 'AG/31-crude-flows_AG.bin', 'min_epoch': 1.4967662e+09}, {'max_epoch': 1.5120396e+09, 'filename': 'AG/32-crude-flows_AG.bin', 'min_epoch': 1.5002131e+09}
      ],
      "crude_flows_index_WAF": [
        {'max_epoch': 1.3656445e+09, 'filename': 'WAF/0-crude-flows_WAF.bin', 'min_epoch': 1.3473725e+09}, {'max_epoch': 1.3747565e+09, 'filename': 'WAF/1-crude-flows_WAF.bin', 'min_epoch': 1.3650022e+09}, {'max_epoch': 1.3842788e+09, 'filename': 'WAF/2-crude-flows_WAF.bin', 'min_epoch': 1.3740604e+09}, {'max_epoch': 1.3929523e+09, 'filename': 'WAF/3-crude-flows_WAF.bin', 'min_epoch': 1.3833535e+09}, {'max_epoch': 1.4025202e+09, 'filename': 'WAF/4-crude-flows_WAF.bin', 'min_epoch': 1.3921147e+09}, {'max_epoch': 1.411857e+09, 'filename': 'WAF/5-crude-flows_WAF.bin', 'min_epoch': 1.4018527e+09}, {'max_epoch': 1.4214098e+09, 'filename': 'WAF/6-crude-flows_WAF.bin', 'min_epoch': 1.4116553e+09}, {'max_epoch': 1.4311532e+09, 'filename': 'WAF/7-crude-flows_WAF.bin', 'min_epoch': 1.4210131e+09}, {'max_epoch': 1.4404055e+09, 'filename': 'WAF/8-crude-flows_WAF.bin', 'min_epoch': 1.4305885e+09}, {'max_epoch': 1.4499501e+09, 'filename': 'WAF/9-crude-flows_WAF.bin', 'min_epoch': 1.4388869e+09}, {'max_epoch': 1.458926e+09, 'filename': 'WAF/10-crude-flows_WAF.bin', 'min_epoch': 1.4490766e+09}, {'max_epoch': 1.468358e+09, 'filename': 'WAF/11-crude-flows_WAF.bin', 'min_epoch': 1.458066e+09}, {'max_epoch': 1.4786161e+09, 'filename': 'WAF/12-crude-flows_WAF.bin', 'min_epoch': 1.4664877e+09}, {'max_epoch': 1.4881251e+09, 'filename': 'WAF/13-crude-flows_WAF.bin', 'min_epoch': 1.4772301e+09}, {'max_epoch': 1.4974886e+09, 'filename': 'WAF/14-crude-flows_WAF.bin', 'min_epoch': 1.4877286e+09}, {'max_epoch': 1.507764e+09, 'filename': 'WAF/15-crude-flows_WAF.bin', 'min_epoch': 1.496261e+09}, {'max_epoch': 1.511334e+09, 'filename': 'WAF/16-crude-flows_WAF.bin', 'min_epoch': 1.5044224e+09}
      ],
      "crude_flows_index_MedNAF": [
        {'max_epoch': 1.3762028e+09, 'filename': 'MedNAF/0-crude-flows_MedNAF.bin', 'min_epoch': 1.3501318e+09}, {'max_epoch': 1.4003267e+09, 'filename': 'MedNAF/1-crude-flows_MedNAF.bin', 'min_epoch': 1.3754286e+09}, {'max_epoch': 1.4250889e+09, 'filename': 'MedNAF/2-crude-flows_MedNAF.bin', 'min_epoch': 1.3960728e+09}, {'max_epoch': 1.4498509e+09, 'filename': 'MedNAF/3-crude-flows_MedNAF.bin', 'min_epoch': 1.4244504e+09}, {'max_epoch': 1.4743622e+09, 'filename': 'MedNAF/4-crude-flows_MedNAF.bin', 'min_epoch': 1.4464378e+09}, {'max_epoch': 1.4972628e+09, 'filename': 'MedNAF/5-crude-flows_MedNAF.bin', 'min_epoch': 1.4736177e+09}, {'max_epoch': 1.5095916e+09, 'filename': 'MedNAF/6-crude-flows_MedNAF.bin', 'min_epoch': 1.4953752e+09}
      ],
      "crude_flows_index_Urals": [
        {'max_epoch': 1.3944883e+09, 'filename': 'Urals/0-crude-flows_Urals.bin', 'min_epoch': 1.3512047e+09}, {'max_epoch': 1.435146e+09, 'filename': 'Urals/1-crude-flows_Urals.bin', 'min_epoch': 1.3944666e+09}, {'max_epoch': 1.47633e+09, 'filename': 'Urals/2-crude-flows_Urals.bin', 'min_epoch': 1.4350828e+09}, {'max_epoch': 1.5092532e+09, 'filename': 'Urals/3-crude-flows_Urals.bin', 'min_epoch': 1.4763123e+09}
      ],
      "crude_flows_index_USGC": [
        {'max_epoch': 1.5122628e+09, 'filename': 'USGC/0-crude-flows_USGC.bin', 'min_epoch': 1.3621992e+09}
      ],
      "crude_flows_index_LatAM": [
        {'max_epoch': 1.3680512e+09, 'filename': 'LatAM/0-crude-flows_LatAM.bin', 'min_epoch': 1.3474893e+09}, {'max_epoch': 1.3785563e+09, 'filename': 'LatAM/1-crude-flows_LatAM.bin', 'min_epoch': 1.3666175e+09}, {'max_epoch': 1.3898134e+09, 'filename': 'LatAM/2-crude-flows_LatAM.bin', 'min_epoch': 1.3767935e+09}, {'max_epoch': 1.4000607e+09, 'filename': 'LatAM/3-crude-flows_LatAM.bin', 'min_epoch': 1.3878431e+09}, {'max_epoch': 1.4103395e+09, 'filename': 'LatAM/4-crude-flows_LatAM.bin', 'min_epoch': 1.3986446e+09}, {'max_epoch': 1.4202254e+09, 'filename': 'LatAM/5-crude-flows_LatAM.bin', 'min_epoch': 1.408922e+09}, {'max_epoch': 1.43073e+09, 'filename': 'LatAM/6-crude-flows_LatAM.bin', 'min_epoch': 1.4186223e+09}, {'max_epoch': 1.4399827e+09, 'filename': 'LatAM/7-crude-flows_LatAM.bin', 'min_epoch': 1.4289676e+09}, {'max_epoch': 1.4490721e+09, 'filename': 'LatAM/8-crude-flows_LatAM.bin', 'min_epoch': 1.4386007e+09}, {'max_epoch': 1.4587574e+09, 'filename': 'LatAM/9-crude-flows_LatAM.bin', 'min_epoch': 1.4481128e+09}, {'max_epoch': 1.4689476e+09, 'filename': 'LatAM/10-crude-flows_LatAM.bin', 'min_epoch': 1.4563868e+09}, {'max_epoch': 1.4796142e+09, 'filename': 'LatAM/11-crude-flows_LatAM.bin', 'min_epoch': 1.4676618e+09}, {'max_epoch': 1.4914527e+09, 'filename': 'LatAM/12-crude-flows_LatAM.bin', 'min_epoch': 1.4776771e+09}, {'max_epoch': 1.5010688e+09, 'filename': 'LatAM/13-crude-flows_LatAM.bin', 'min_epoch': 1.4883502e+09}, {'max_epoch': 1.511766e+09, 'filename': 'LatAM/14-crude-flows_LatAM.bin', 'min_epoch': 1.498359e+09}
      ],
      "crude_flows_index_NS": [
        {'max_epoch': 1.4191127e+09, 'filename': 'NS/0-crude-flows_NS.bin', 'min_epoch': 1.3472122e+09}, {'max_epoch': 1.4766056e+09, 'filename': 'NS/1-crude-flows_NS.bin', 'min_epoch': 1.4182052e+09}, {'max_epoch': 1.5126084e+09, 'filename': 'NS/2-crude-flows_NS.bin', 'min_epoch': 1.4763096e+09}
      ]
    }

    var showIndex  = function(indicesKey, idx, epoch) {
      return indices[indicesKey][idx]['min_epoch'] < epoch && indices[indicesKey][idx]['max_epoch'] > epoch;
    }

    var gl = this.gl;
    var drawOptions = this._layer.drawOptions;
    var idx;
    var currentEpoch = gEarthTime.currentEpochTime();
    var indicesKey = drawOptions["indicesKey"];
    var that = this;
    if (typeof(this.worker) == "undefined") {
      this.worker = new Worker('ships-worker.js');
      this.worker.onmessage = function(e) {
        if (typeof e.data["idx"] != "undefined") {
          var idx = e.data.idx;
          var array = e.data["array"];
          var data = new Float32Array(array);
          that.buffers[idx].count = data.length / that.buffers[idx].numAttributes;
          that.buffers[idx].buffer = that.gl.createBuffer();
          that.gl.bindBuffer(that.gl.ARRAY_BUFFER, that.buffers[idx].buffer);
          gl.bufferData(that.gl.ARRAY_BUFFER, data, that.gl.STATIC_DRAW);
          that.buffers[idx].ready = true;
        }
      };
    }

    if (typeof(this.buffers) == "undefined") {
      this.buffers = {};
    }
    for (var i = 0; i < indices[indicesKey].length; i++) {
      if (showIndex(indicesKey, i, currentEpoch)) {
        if (typeof(this.buffers[i]) == "undefined") {
          this.buffers[i] = {
            "numAttributes": 7,
            "count": 0,
            "buffer": null,
            "ready": false
          };
          var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + indices[indicesKey][i]["filename"];
          this.worker.postMessage({'idx': i, 'url': dataUrl});
        }
        idx = i;
        var buffer = this.buffers[idx];
        if (buffer && buffer.ready) {
          gl.useProgram(this.program);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          var tileTransform = new Float32Array(transform);
          var currentTime = gEarthTime.currentEpochTime();
          var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);
          scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
          scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
          pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (23.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
          // Passing a NaN value to the shader with a large number of points is very bad
          if (isNaN(pointSize)) {
            pointSize = 1.0;
          }
          gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);
          gl.uniform1f(this.program.u_epoch, currentTime);
          gl.uniform1f(this.program.u_size, pointSize);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
          this.program.setVertexAttrib.a_coord_0(2, gl.FLOAT, false, buffer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
          this.program.setVertexAttrib.a_epoch_0(1, gl.FLOAT, false, buffer.numAttributes * 4, 8);
          this.program.setVertexAttrib.a_coord_1(2, gl.FLOAT, false, buffer.numAttributes * 4, 12); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
          this.program.setVertexAttrib.a_epoch_1(1, gl.FLOAT, false, buffer.numAttributes * 4, 20);
          this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, buffer.numAttributes * 4, 24);
          gl.drawArrays(gl.POINTS, 0, buffer.count);
          gl.disable(gl.BLEND);
        }
      }
    }
  }

  _drawVesselTracks(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (23.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }


      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_epoch, currentTime);

      gl.uniform1f(this.program.u_size, pointSize);

      this.program.setVertexAttrib.a_coord_0(2, gl.FLOAT, false, 7 * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_epoch_0(1, gl.FLOAT, false, 7 * 4, 8);
      this.program.setVertexAttrib.a_coord_1(2, gl.FLOAT, false, 7 * 4, 12); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_epoch_1(1, gl.FLOAT, false, 7 * 4, 20);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, 7 * 4, 24);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawParticles(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.enable(gl.BLEND);

      var drawOptions = this._layer.drawOptions;
      var sfactor = gl.SRC_ALPHA;
      var dfactor = gl.ONE;
      if (drawOptions.dfactor) {
        dfactor = gl[drawOptions.dfactor];
      }
      if (drawOptions.sfactor) {
        sfactor = gl[drawOptions.sfactor];
      }
      gl.blendFunc(sfactor, dfactor);

      var tileTransform = new Float32Array(transform);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      var pointSize = 1.0;
      if (drawOptions.pointSize) {
        pointSize = drawOptions.pointSize;
      }
      if (drawOptions.pointSizeFnc) {
        var pointSizeFnc = new Function('return ' + drawOptions.pointSizeFnc)();
        pointSize *= pointSizeFnc(gEarthTime.timelapseZoom());
      }

      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }


      var maxElevation = 90; // Default value
      if (drawOptions.maxElevation) {
        maxElevation = drawOptions.maxElevation;
      }

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      var currentTime = gEarthTime.currentEpochTime();
      var currentEpoch = currentTime;
      // epochOffset is in seconds since 1/1/1970.  Defaults to zero (no offset)
      if (drawOptions.epochOffset) {
        currentTime -= drawOptions.epochOffset;
      }
      // epochScale is in seconds.  1 (default) means units of seconds;  60 means units of minutes, etc
      if (drawOptions.epochScale) {
        currentTime /= drawOptions.epochScale;
      }
      gl.uniform1f(this.program.u_epoch, currentTime); // SCALED and OFFSET, if epochScale and/or epochOffset defined

      gl.uniform1f(this.program.u_size, pointSize);

      gl.uniform1f(this.program.u_max_elev, maxElevation);

      this.program.setVertexAttrib.a_coord_0(2, gl.FLOAT, false, 9 * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_elev_0(1, gl.FLOAT, false, 9 * 4, 8);
      this.program.setVertexAttrib.a_epoch_0(1, gl.FLOAT, false, 9 * 4, 12);
      this.program.setVertexAttrib.a_coord_1(2, gl.FLOAT, false, 9 * 4, 16); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_elev_1(1, gl.FLOAT, false, 9 * 4, 24);
      this.program.setVertexAttrib.a_epoch_1(1, gl.FLOAT, false, 9 * 4, 28);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, 9 * 4, 32);

      if (drawOptions.pointIndex) {
        var first = drawOptions.pointIndex[0].first;
        var count = drawOptions.pointIndex[0].count;
        for (var i = 0; i < drawOptions.pointIndex.length; i++) {
          var pointIndex = drawOptions.pointIndex[i];
          if (currentEpoch < pointIndex.epoch) {
            first = pointIndex.first;
            count = pointIndex.count;
            break;
          }
        }
        gl.drawArrays(gl.POINTS, first, count);
      } else {
        gl.drawArrays(gl.POINTS, 0, this._pointCount);
      }

      gl.disable(gl.BLEND);
    }
  }

  _drawAnimPoints(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      pointSize *= Math.floor((gEarthTime.timelapseZoom() + 1.0) / (23.0 - 1.0) * (12.0 - 1) + 1) * 0.5;
      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 1.0;
      }


      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_epoch, currentTime);

      gl.uniform1f(this.program.u_size, pointSize);

      this.program.setVertexAttrib.a_coord_0(2, gl.FLOAT, false, 7 * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_epoch_0(1, gl.FLOAT, false, 7 * 4, 8);
      this.program.setVertexAttrib.a_coord_1(2, gl.FLOAT, false, 7 * 4, 12); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_epoch_1(1, gl.FLOAT, false, 7 * 4, 20);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, 7 * 4, 24);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawVesselTrackLines(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      var drawOptions = this._layer.drawOptions;
      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();
      var pointSize = drawOptions.pointSize || (2.0 * window.devicePixelRatio);

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      gl.uniform1f(this.program.u_epoch, currentTime);

      this.program.setVertexAttrib.a_coord_0(2, gl.FLOAT, false, 5 * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_epoch_0(1, gl.FLOAT, false, 5 * 4, 8);
      this.program.setVertexAttrib.a_epoch_1(1, gl.FLOAT, false, 5 * 4, 12);
      this.program.setVertexAttrib.a_color(1, gl.FLOAT, false, 5 * 4, 16);

      gl.drawArrays(gl.LINES, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawBasicPoints(transform: Float32Array) {
    if (this._ready && this._pointCount > 0) {
      var gl = this.gl;
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var tileTransform = new Float32Array(transform);
      var drawOptions = this._layer.drawOptions;

      // Set u_size, if present
      if (this.program.u_size != undefined) {
        var pointSize = 1; // default
        if (typeof drawOptions.pointSize == 'number') {
          pointSize = drawOptions.pointSize;
        }
        else if (typeof drawOptions.pointSize == 'object') {
          var zoomScale = Math.log2(-transform[5]);
          var countryLevelZoomScale = -3;
          var blockLevelZoomScale = 9;
          var countryPointSizePixels = drawOptions.pointSize[0];
          var blockPointSizePixels = drawOptions.pointSize[1];

          pointSize = countryPointSizePixels * Math.pow(blockPointSizePixels / countryPointSizePixels, (zoomScale - countryLevelZoomScale) / (blockLevelZoomScale - countryLevelZoomScale));
        }
        pointSize *= WebGLVectorTile2.dotScale;
        gl.uniform1f(this.program.u_size, pointSize);
      }

      // Set u_epoch, if present
      if (this.program.u_epoch != undefined) {
        gl.uniform1f(this.program.u_epoch, gEarthTime.currentEpochTime());
      }

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      var attrib_offset = 0;
      var num_attributes = this._layer.numAttributes - 0;

      var candidate_attribs = [
        { name: 'a_coord', size: 2 },
        { name: 'a_color', size: 1 },
        { name: 'a_start_epoch', size: 1 },
        { name: 'a_end_epoch', size: 1 }
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
      gl.disable(gl.BLEND);
    };
  }

  // THIS DRAW FUNCTION MUST BE CALLED EVERY FRAME
  // See drawsEveryFrame below
  _drawWindVectors(transform: Float32Array) {
    if (this._ready) {
      //gl.disable(gl.DEPTH_TEST);
      //gl.disable(gl.STENCIL_TEST);
      this.glb.bindTexture(this.windTexture, 0);
      this.glb.bindTexture(this.particleStateTexture0, 1);

      //this.drawMap(transform);
      //bindTexture(gl, this.currentWindTexture, 0);
      var tileTransform = new Float32Array(transform);

      var drawOptions = this._layer.drawOptions;

      translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
      scaleMatrix(tileTransform,
        this._bounds.max.x - this._bounds.min.x,
        this._bounds.max.y - this._bounds.min.y);


      // TODO: Is this the best way?
      if (typeof drawOptions.bbox == "undefined") {
        var bbox = gEarthTime.timelapse.pixelBoundingBoxToLatLngBoundingBoxView(gEarthTime.timelapse.getBoundingBoxForCurrentView()).bbox;
        var ne = bbox.ne; // tr
        var sw = bbox.sw; // bl
        let tl = { lat: ne.lat, lng: ne.lng };
        let br = { lat: sw.lat, lng: sw.lng };
        drawOptions.bbox = { tl: tl, br: br };
      }

      var tl = LngLatToPixelXY(drawOptions.bbox.tl.lng, drawOptions.bbox.tl.lat);
      var br = LngLatToPixelXY(drawOptions.bbox.br.lng, drawOptions.bbox.br.lat);

      this.tl = new Float32Array([tl[0] / 256., tl[1] / 256.]);
      this.br = new Float32Array([br[0] / 256., br[1] / 256.]);

      //this.drawWindVectorsMap(tileTransform);
      this.drawWindVectorsScreen(tileTransform);
      this.updateWindVectorsParticles(tileTransform);

    }
  }

  particleStateTexture0(particleStateTexture0: any, arg1: number) {
    throw new Error("Method not implemented.");
  }

  drawWindVectorsScreen(transform: Float32Array) {
    var gl = this.gl;
    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    this.glb.bindFramebuffer(this.framebuffer, this.screenTexture);
    //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    this.drawWindVectorsTexture(this.backgroundTexture, this.fadeOpacity, transform);
    this.drawWindVectorsParticles(transform);

    this.glb.bindFramebuffer(null);
    // enable blending to support drawing on top of an existing background (e.g. a map)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.drawWindVectorsTexture(this.screenTexture, 1.0, transform);
    gl.disable(gl.BLEND);

    // save the current screen as the background for the next frame
    var temp = this.backgroundTexture;
    this.backgroundTexture = this.screenTexture;
    this.screenTexture = temp;
  }

  drawWindVectorsTexture(texture: any, opacity: number, transform: any) {
    var gl = this.gl;
    var program = this.screenProgram;
    //gl.useProgram(program.program);
    gl.useProgram(program);

    this.glb.bindAttribute(this.quadBuffer, program.a_pos, 2);
    this.glb.bindTexture(texture, 2);
    gl.uniform1i(program.u_screen, 2);
    gl.uniform1f(program.u_opacity, opacity);
    //gl.uniform2f(program.u_scale, transform.scale[0], transform.scale[1]);
    //gl.uniform2f(program.u_scale, 0.1, 0.9);
    //gl.uniform2f(program.u_translate, transform.translate[0], transform.translate[1]);
    //var matrixLoc = this.program.u_map_matrix;
    //gl.uniformMatrix4fv(program.u_transform, false, transform);
    gl.uniformMatrix4fv(program.u_transform, false, transform);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawWindVectorsParticles(transform: any) {
    var gl = this.gl;
    var program = this.drawProgram;
    gl.useProgram(program);

    this.glb.bindAttribute(this.particleIndexBuffer, program.a_index, 1);
    this.glb.bindTexture(this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    //gl.uniform2f(program.u_scale, transform.scale[0], transform.scale[1]);
    //gl.uniform2f(program.u_translate, transform.translate[0], transform.translate[1]);
    gl.uniformMatrix4fv(program.u_transform, false, transform);

    //console.log(transform.scale);
    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }

  particleIndexBuffer(particleIndexBuffer: any, a_index: any, arg2: number) {
    throw new Error("Method not implemented.");
  }

  particleStateResolution(u_particles_res: any, particleStateResolution: any) {
    throw new Error("Method not implemented.");
  }

  _numParticles(POINTS: any, arg1: number, _numParticles: any) {
    throw new Error("Method not implemented.");
  }

  updateWindVectorsParticles(transform: Float32Array) {
    var gl = this.gl;
    this.glb.bindFramebuffer(this.framebuffer, this.particleStateTexture1);
    var oldViewPort = gl.getParameter(gl.VIEWPORT);
    gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);
    var program = this.updateProgram;
    gl.useProgram(program);

    this.glb.bindAttribute(this.quadBuffer, program.a_pos, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_speed_factor, this.speedFactor);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
    //gl.uniform2f(program.u_scale, transform.scale[0], transform.scale[1]);
    //gl.uniform2f(program.u_translate, transform.translate[0], transform.translate[1]);
    gl.uniformMatrix4fv(program.u_transform, false, transform);
    //gl.uniform2f(program.u_topLeftBound, transform.topLeft[0], transform.topLeft[1]);
    //gl.uniform2f(program.u_bottomRightBound, transform.bottomRight[0], transform.bottomRight[1]);
    //console.log(this.tl, this.br);
    gl.uniform2f(program.u_topLeftBound, this.tl[0], this.tl[1]);
    gl.uniform2f(program.u_bottomRightBound, this.br[0], this.br[1]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.glb.bindFramebuffer(null);

    // swap the particle state textures so the new one becomes the current one
    var temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;

    gl.viewport(0, 0, oldViewPort[2], oldViewPort[3]);

  }

  particleStateTexture1(framebuffer: any, particleStateTexture1: any) {
    throw new Error("Method not implemented.");
  }

  drawWindVectorsMap(transform: any) {
    var gl = this.gl;
    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    this.glb.bindFramebuffer(this.framebuffer, this.currentWindTexture);
    //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    var gl = this.gl;
    var program = this.mapProgram;
    gl.useProgram(program);

    this.glb.bindAttribute(this.quadBuffer, program.a_pos, 2);
    //gl.uniform2f(program.u_scale, transform.scale[0], transform.scale[1]);
    //gl.uniform2f(program.u_translate, transform.translate[0], transform.translate[1]);
    gl.uniformMatrix4fv(program.u_transform, false, transform);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.glb.bindFramebuffer(null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

  }

  _drawQuiverPolarCoords(transform: Float32Array) {
    var gl = this.gl;

    if (this._ready && this._pointCount > 0) {
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      gl.enable(gl.BLEND);

      var drawOptions = this._layer.drawOptions;
      var sfactor = gl.SRC_ALPHA;
      var dfactor = gl.ONE_MINUS_SRC_ALPHA;
      if (drawOptions.dfactor) {
        dfactor = gl[drawOptions.dfactor];
      }
      if (drawOptions.sfactor) {
        sfactor = gl[drawOptions.sfactor];
      }
      gl.blendFunc(sfactor, dfactor);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      var pointSize = 128.0;
      if (drawOptions.pointSize) {
        pointSize = drawOptions.pointSize;
      }
      if (drawOptions.pointSizeFnc) {
        var pointSizeFnc = new Function('return ' + drawOptions.pointSizeFnc)();
        pointSize *= pointSizeFnc(gEarthTime.timelapseZoom());
      }

      // Passing a NaN value to the shader with a large number of points is very bad
      if (isNaN(pointSize)) {
        pointSize = 64.0;
      }

      //attribute vec4 a_position;
      //attribute vec2 a_epochs;
      //attribute vec2 a_rads;
      //attribute vec2 a_speed;
      //uniform float u_PointSize;
      //varying float v_PointSize;
      //varying float v_rad;
      //uniform float u_epoch;
      //uniform mat4 u_transform;

      gl.uniformMatrix4fv(this.program.u_transform, false, tileTransform);
      gl.uniform1f(this.program.u_epoch, currentTime);
      gl.uniform1f(this.program.u_PointSize, pointSize);


      this.program.setVertexAttrib.a_position(2, gl.FLOAT, false, 11 * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_epochs(2, gl.FLOAT, false, 11 * 4, 8);
      this.program.setVertexAttrib.a_rads(2, gl.FLOAT, false, 11 * 4, 16);
      this.program.setVertexAttrib.a_speed(2, gl.FLOAT, false,11 * 4, 24); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.a_rgb(3, gl.FLOAT, false, 11 * 4, 32);

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }

  _drawMarker(transform: Float32Array) {
    var gl = this.gl;
    var drawOptions = this._layer.drawOptions;
    
    if (this._ready) {
  
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      var tileTransform = new Float32Array(transform);
      var currentTime = gEarthTime.currentEpochTime();

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);

      gl.uniformMatrix4fv(this.program.ortho, false, tileTransform);

      var pointSize = 16.0;
      if (drawOptions.pointSize) {
        pointSize = drawOptions.pointSize;
      }
      gl.uniform1f(this.program.size, pointSize);

      var orientation = 0;
      if (drawOptions.orientation) {
        orientation = drawOptions.orientation;
      }
      gl.uniform1f(this.program.orientation, orientation);

      var linewidth = 1.0;
      if (drawOptions.linewidth) {
        linewidth = drawOptions.linewidth;
      }
      gl.uniform1f(this.program.linewidth, linewidth);

      var antialias = 1.0;
      if (drawOptions.antialias) {
        antialias = drawOptions.antialias;
      }
      gl.uniform1f(this.program.antialias, antialias);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);
      this.program.setVertexAttrib.position(2, gl.FLOAT, false, this._layer.numAttributes * 4, 0); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.fill(4, gl.FLOAT, false, this._layer.numAttributes * 4, 8); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
      this.program.setVertexAttrib.stroke(4, gl.FLOAT, false, this._layer.numAttributes * 4, 24); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)
//      this.program.setVertexAttrib.packedcolor(1, gl.FLOAT, false, this._layer.numAttributes * 4, 8); // tell webgl how buffer is laid out (lat, lon, time--4 bytes each)

      gl.drawArrays(gl.POINTS, 0, this._pointCount);

      gl.disable(gl.BLEND);
    }
  }


  // Update and draw tiles
  static updateTiles(tiles: WebGLVectorTile2[], transform: Float32Array, options: DrawOptions) {
    //console.log(options)
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i]._ready && tiles[i]._pointCount != 0) {
        tiles[i].draw(transform, options);
      }
    }
  }

  //////////////////////
  static basicDrawPoints(instance_options: { pointSize: number | any[]; }) {
    return function (this: WebGLVectorTile2, transform: Iterable<number>) {
      if (!this._ready)
        return;
      var gl = this.gl;
      gl.useProgram(this.program);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._arrayBuffer);

      var tileTransform = new Float32Array(transform);

      // Set u_size, if present
      if (this.program.u_size != undefined) {
        var pointSize = 1; // default
        if (typeof instance_options.pointSize == 'number') {
          pointSize = instance_options.pointSize;
        }
        else if (typeof instance_options.pointSize == 'object') {
          var zoomScale = Math.log2(-transform[5]);
          var countryLevelZoomScale = -3;
          var blockLevelZoomScale = 9;
          var countryPointSizePixels = instance_options.pointSize[0];
          var blockPointSizePixels = instance_options.pointSize[1];

          pointSize = countryPointSizePixels * Math.pow(blockPointSizePixels / countryPointSizePixels, (zoomScale - countryLevelZoomScale) / (blockLevelZoomScale - countryLevelZoomScale));
        }
        pointSize *= WebGLVectorTile2.dotScale;
        gl.uniform1f(this.program.u_size, pointSize);
      }

      // Set u_epoch, if present
      if (this.program.u_epoch != undefined) {
        gl.uniform1f(this.program.u_epoch, gEarthTime.currentEpochTime());
      }

      scaleMatrix(tileTransform, Math.pow(2, this._tileidx.l) / 256., Math.pow(2, this._tileidx.l) / 256.);
      scaleMatrix(tileTransform, this._bounds.max.x - this._bounds.min.x, this._bounds.max.y - this._bounds.min.y);
      gl.uniformMatrix4fv(this.program.u_map_matrix, false, tileTransform);

      var attrib_offset = 0;
      var num_attributes = this._layer.numAttributes - 0;

      var candidate_attribs = [
        { name: 'a_coord', size: 2 },
        { name: 'a_color', size: 1 },
        { name: 'a_start_epoch', size: 1 },
        { name: 'a_end_epoch', size: 1 }
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
      gl.disable(gl.BLEND);
    };
  }
}

WebGLVectorTile2.errorsAlreadyShown = {};
WebGLVectorTile2.errorDialog = null;

// Tweak dot sizes
WebGLVectorTile2.dotScale = 1;


function getColorRamp(colors: { [x: string]: string; 0?: string; 0.1?: string; 0.2?: string; 0.3?: string; 0.4?: string; 0.5?: string; 0.6?: string; 1?: string; }) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 1;

    var gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (var stop in colors) {
        gradient.addColorStop(+stop, colors[stop]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}
var defaultRampColors = {
    0.0: '#3288bd',
    0.1: '#66c2a5',
    0.2: '#abdda4',
    0.3: '#e6f598',
    0.4: '#fee08b',
    0.5: '#fdae61',
    0.6: '#f46d43',
    1.0: '#d53e4f'
};

function arrayBufferToString(ab: { byteLength: number; slice: (arg0: number, arg1: number) => Iterable<number>; }) {
  var chunks = [];
  var chunkLength = 100;
  for (var i = 0; i < ab.byteLength; i += chunkLength) {
    chunks.push(String.fromCharCode.apply(null,
					  new Uint8Array(ab.slice(i, i + chunkLength))));
  }
  var ret = chunks.join('');
  return ret;
}

WebGLVectorTile2._totalBtiTime = 0;
WebGLVectorTile2._totalBtiCount = 0;

var gtileData: any;

var prototypeAccessors: any = { numParticles: {} };

prototypeAccessors.numParticles.set = function (numParticles: number) {
    var gl = this.gl;

    // we create a square texture where each pixel will hold a particle position encoded as RGBA
    var particleRes = this.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
    this._numParticles = particleRes * particleRes;

    var particleState = new Uint8Array(this._numParticles * 4);
    for (var i = 0; i < particleState.length; i++) {
        particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions

    }
    // textures to hold the particle state for the current and the next frame
    this.particleStateTexture0 = this.glb.createTexture(gl.NEAREST, particleState, particleRes, particleRes);
    this.particleStateTexture1 = this.glb.createTexture(gl.NEAREST, particleState, particleRes, particleRes);

    var particleIndices = new Float32Array(this._numParticles);
    for (var i$1 = 0; i$1 < this._numParticles; i$1++) { particleIndices[i$1] = i$1; }
    this.particleIndexBuffer = this.glb.createBuffer(particleIndices);
};
prototypeAccessors.numParticles.get = function () {
    return this._numParticles;
};

Object.defineProperties( WebGLVectorTile2.prototype, prototypeAccessors );

// Declare drawing functions that must draw every frame
drawsEveryFrame(WebGLVectorTile2.prototype._drawWindVectors);
drawsEveryFrame(WebGLVectorTile2.prototype._drawLodes);

export var WebGLVectorTile2Shaders: {[name: string]: string} = {};

WebGLVectorTile2Shaders.vectorTileVertexShader = `
attribute vec4 worldCoord;
uniform mat4 mapMatrix;
void main() {
    gl_Position = mapMatrix * worldCoord;
}`;

WebGLVectorTile2Shaders.vectorPointTileVertexShader = `
attribute vec4 worldCoord;
attribute float time;
uniform float uMaxTime;
uniform float uPointSize;
uniform mat4 mapMatrix;
void main() {
  if (time > uMaxTime) {
    gl_Position = vec4(-1,-1,-1,-1);
  } else {
    gl_Position = mapMatrix * worldCoord;
  };
  gl_PointSize = uPointSize;
}`;

WebGLVectorTile2Shaders.vectorTileFragmentShader = `
void main() {
  gl_FragColor = vec4(1., .0, .65, 1.0);
}`;

WebGLVectorTile2Shaders.vectorPointTileFragmentShader = `
/*precision mediump float;*/
uniform vec4 uColor;
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = uColor * dist;
}`;

WebGLVectorTile2Shaders.lodesVertexShader = `
attribute vec4 centroid;
attribute float aDist;
attribute float aColor;
uniform bool filterDist;
uniform bool showSe01;
uniform bool showSe02;
uniform bool showSe03;
uniform float uDist;
uniform float uSize;
uniform float uTime;
uniform float uZoom;
uniform mat4 mapMatrix;
varying float vColor;
float fX(float x, float deltaX, float t) {
  return x + deltaX * t;
}
float fY(float y, float deltaY, float t) {
  return y + deltaY * t;
}
void main() {
  float fx = fX(centroid.z, centroid.x - centroid.z, uTime);
  float fy = fY(centroid.w, centroid.y - centroid.w, uTime);
  vec4 position = mapMatrix * vec4(fx, fy, 0, 1);
  if (filterDist && aDist >= uDist) {
    position = vec4(-1.,-1.,-1.,-1.);
  }
  if (!showSe01 && aColor == 16730905.) {
    position = vec4(-1.,-1.,-1.,-1.);
  }
  if (!showSe02 && aColor == 625172.) {
    position = vec4(-1.,-1.,-1.,-1.);
  }
  if (!showSe03 && aColor == 1973987.) {
    position = vec4(-1.,-1.,-1.,-1.);
  }
  gl_Position = position;
  gl_PointSize = uSize;
  vColor = aColor;
}`;

WebGLVectorTile2Shaders.lodesFragmentShader = `
/*precision lowp float;*/
varying float vColor;
vec4 setColor(vec4 color, float dist, float hardFraction) {
  return color * clamp((0.5 - dist) / (0.5 - 0.5 * hardFraction), 0., 1.);
}
vec3 unpackColor(float f) {
  vec3 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  return color / 256.0;
}
void main() {
  gl_FragColor = vec4(unpackColor(vColor),.75);
}`;

WebGLVectorTile2Shaders.colorDotmapVertexShader = `
attribute vec2 aWorldCoord;
attribute float aColor;
uniform float uZoom;
uniform float uSize;
uniform mat4 mapMatrix;
varying float vColor;
void main() {
  //gl_Position = mapMatrix * vec4(aWorldCoord.x, aWorldCoord.y, 0, 1);
  //gl_Position = vec4(300.0*(aWorldCoord.x+mapMatrix[3][0]), 300.0*(-aWorldCoord.y+mapMatrix[3][1]), 0.0, 300.0);
  gl_Position = vec4(aWorldCoord.x * mapMatrix[0][0] + mapMatrix[3][0], aWorldCoord.y * mapMatrix[1][1] + mapMatrix[3][1],0,1);
  gl_PointSize = uSize;
  //gl_PointSize = 0.5;
  vColor = aColor;
}`;

WebGLVectorTile2Shaders.colorDotmapVertexShaderTbox = `
  attribute vec2 aWorldCoord;
  attribute float aColor;
  attribute float aStartEpoch;
  attribute float aEndEpoch;
  uniform float uZoom;
  uniform float uSize;
  uniform mat4 mapMatrix;
  uniform float uEpoch;
  varying float vColor;
  void main() {
    if (aStartEpoch <= uEpoch && uEpoch < aEndEpoch) {
      /*gl_Position = vec4(aWorldCoord.x * mapMatrix[0][0] + mapMatrix[3][0], aWorldCoord.y * mapMatrix[1][1] + mapMatrix[3][1],0,1);*/
      gl_Position = vec4((aWorldCoord.x) * mapMatrix[0][0] + mapMatrix[3][0], (aWorldCoord.y) * mapMatrix[1][1] + mapMatrix[3][1],0,1);
      gl_PointSize = uSize;
      vColor = aColor;
    } else {
      gl_Position = vec4(-1,-1,-1,-1);
    }
  }`;

WebGLVectorTile2Shaders.colorDotmapFragmentShader = `
/*precision lowp float;*/
varying float vColor;
vec3 unpackColor(float f) {
  vec3 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  return color / 256.0;
}
void main() {
  gl_FragColor = vec4(unpackColor(vColor),1.0);
  //gl_FragColor = vec4(0.0,1.0,0.0,1.0);
}`;

WebGLVectorTile2Shaders.annualRefugeesFragmentShader = `
/*precision mediump float;*/
uniform sampler2D u_Image;
varying float v_Delta;
void main() {
    float dist = length(gl_PointCoord.xy - vec2(.5, .5));
    dist = 1. - (dist * 2.);
    dist = max(0., dist);
    gl_FragColor = vec4(1., 0., 0., 1.) * dist;
    vec4 color = texture2D(u_Image, vec2(v_Delta,v_Delta));
    gl_FragColor = vec4(color.r, color.g, color.b, 1.) * dist;
}`;

WebGLVectorTile2Shaders.annualRefugeesVertexShader = `
attribute vec4 aStartPoint;
attribute vec4 aEndPoint;
attribute vec4 aMidPoint;
attribute float aEpoch;
uniform float uSize;
uniform float uEpoch;
uniform float uSpan;
uniform mat4 uMapMatrix;
varying float v_Delta;
vec4 bezierCurve(float t, vec4 P0, vec4 P1, vec4 P2) {
  return (1.0-t)*(1.0-t)*P0 + 2.0*(1.0-t)*t*P1 + t*t*P2;
}
void main() {
  vec4 position;
  if (aEpoch < uEpoch) {
    position = vec4(-1,-1,-1,-1);
  } else if (aEpoch > uEpoch + uSpan) {
    position = vec4(-1,-1,-1,-1);
  } else {
    float t = (uEpoch - aEpoch)/uSpan;
    v_Delta = 1.0 - (aEpoch - uEpoch)/uSpan;
    vec4 pos = bezierCurve(1.0 + t, aStartPoint, aMidPoint, aEndPoint);
    position = uMapMatrix * vec4(pos.x, pos.y, 0, 1);
  }
  gl_Position = position;
  gl_PointSize = uSize * 4.0;
  gl_PointSize = 4.0;
}`;

WebGLVectorTile2Shaders.healthImpactVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Year;
attribute float a_Val1;
attribute float a_Val2;
attribute float a_Rcp;
uniform bool u_ShowRcp2p6;
uniform bool u_ShowRcp4p5;
uniform bool u_ShowRcp6p0;
uniform bool u_ShowRcp8p5;
uniform float u_Delta;
uniform float u_Size;
uniform float u_Year;
uniform mat4 u_MapMatrix;
varying float v_Val;
varying float v_Rcp;
void main() {
  vec4 position;
  if (a_Year != u_Year) {
    position = vec4(-1,-1,-1,-1);
  } else {
    if (u_ShowRcp2p6 && a_Rcp == 0.0) {
      position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
    } else if (u_ShowRcp4p5 && a_Rcp == 1.0) {
      position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
    } else if (u_ShowRcp6p0 && a_Rcp == 2.0) {
      position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
    }  else if (u_ShowRcp8p5 && a_Rcp == 3.0) {
      position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
    }
    else {
      position = vec4(-1,-1,-1,-1);
    }
  }
  gl_Position = position;
  float size = (a_Val2 - a_Val1) * u_Delta + a_Val1;
  v_Val = size;
  v_Rcp = a_Rcp;
  gl_PointSize = u_Size * abs(size);
  gl_PointSize = 2.0 * abs(size);
}`;

WebGLVectorTile2Shaders.healthImpactFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_Val;
varying float v_Rcp;
void main() {
    float dist = length(gl_PointCoord.xy - vec2(.5, .5));
    dist = 1. - (dist * 2.);
    dist = max(0., dist);
    float delta = fwidth(dist);
    float alpha = smoothstep(0.45-delta, 0.45, dist);
    vec4 circleColor = vec4(1.0,0.0,0.0,1.0);
    vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);
    float outerEdgeCenter = 0.5 - .01;
    float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);
    if (v_Val > 0.0) {
      if (v_Rcp == 0.0) {
        circleColor = vec4(0.0, 0.0, 1.0, .65) * alpha;
      } else if (v_Rcp == 1.0){
        circleColor = vec4(0.0078, 0.0, 0.8392, .65) * alpha;
      } else if (v_Rcp == 2.0) {
        circleColor = vec4(0.0078, 0.0, 0.6941, .65) * alpha;
      } else {
        circleColor = vec4(0., 0., .5451, .65) * alpha;
      }
    } else {
      if (v_Rcp == 0.0) {
        circleColor = vec4(1.0, 0.0, 0.0, .65) * alpha;
      } else if (v_Rcp == 1.0){
        circleColor = vec4(0.8392, 0.0, 0.0078, .65) * alpha;
      } else if (v_Rcp == 2.0) {
        circleColor = vec4(0.6941, 0.0, 0.0078, .65) * alpha;
      } else {
        circleColor = vec4(.5451, 0., 0., .65) * alpha;
      }
    }
    gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );
}`;

WebGLVectorTile2Shaders.viirsVertexShader = `
attribute vec4 worldCoord;
attribute float time;
uniform mat4 mapMatrix;
uniform float pointSize;
uniform float maxTime;
uniform float minTime;
void main() {
  if (time < minTime || time > maxTime) {
    gl_Position = vec4(-1,-1,-1,-1);
  } else {
    gl_Position = mapMatrix * worldCoord;
  };
  gl_PointSize = pointSize;
}`;

WebGLVectorTile2Shaders.viirsFragmentShader = `
/*precision mediump float;*/
void main() {
  vec3 color;
  color = vec3(.82, .22, .07);
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = vec4(color, 1.) * dist;
}`;

WebGLVectorTile2Shaders.wdpaVertexShader = `
attribute vec4 worldCoord;
attribute float time;
uniform mat4 mapMatrix;
uniform float maxTime;
uniform float minTime;
void main() {
  if (time < minTime || time > maxTime) {
    gl_Position = vec4(-1,-1,-1,-1);
  } else {
    gl_Position = mapMatrix * worldCoord;
  }
}`;

WebGLVectorTile2Shaders.wdpaFragmentShader = `
void main() {
  gl_FragColor = vec4(.0, 1., .15, 1.0);
}`;

WebGLVectorTile2Shaders.urbanFragilityVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Year;
attribute float a_Val1;
attribute float a_Val2;
uniform float u_Delta;
uniform float u_Size;
uniform float u_Year;
uniform mat4 u_MapMatrix;
varying float v_Val;

void main() {
  vec4 position;
  if (a_Year != u_Year) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  }
  gl_Position = position;
  float size = (a_Val2 - a_Val1) * u_Delta + a_Val1;
  v_Val = size;
  gl_PointSize = u_Size * exp(size);
}`;

WebGLVectorTile2Shaders.urbanFragilityFragmentShader = `
/*precision mediump float;*/
uniform sampler2D u_Image;
varying float v_Val;
float scale(float val) {
  float min = 1.;
  float max = 3.5;
  return (val - min)/(max -min);
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float alpha = smoothstep(0.3-dist, 0.3, dist);
  vec4 color = texture2D(u_Image, vec2(scale(v_Val),scale(v_Val)));
  gl_FragColor = vec4(color.r, color.g, color.b, .75) * alpha;
}`;

WebGLVectorTile2Shaders.monthlyRefugeesVertexShader = `
attribute vec4 aStartPoint;
attribute vec4 aEndPoint;
attribute vec4 aMidPoint;
attribute float aEpoch;
attribute float aEndTime;
attribute float aSpan;
attribute float aTimeOffset;
uniform float uSize;
uniform float uEpoch;
uniform mat4 uMapMatrix;
uniform float uTotalTime;
float Epsilon = 1e-10;
varying vec4 vColor;
vec4 bezierCurve(float t, vec4 P0, vec4 P1, vec4 P2) {
  return (1.0-t)*(1.0-t)*P0 + 2.0*(1.0-t)*t*P1 + t*t*P2;
}
vec3 HUEtoRGB(float H){
  float R = abs((H * 6.) - 3.) - 1.;
  float G = 2. - abs((H * 6.) - 2.);
  float B = 2. - abs((H * 6.) - 4.);
  return clamp(vec3(R,G,B), 0.0, 1.0);
}
vec3 HSLtoRGB(vec3 HSL){
  vec3 RGB = HUEtoRGB(HSL.x);
  float C = (1. - abs(2. * HSL.z - 1.)) * HSL.y;
  return (RGB - 0.5) * C + HSL.z;
}
vec3 RGBtoHCV(vec3 RGB){
  vec4 P = (RGB.g < RGB.b) ? vec4(RGB.bg, -1.0, 2.0/3.0) : vec4(RGB.gb, 0.0, -1.0/3.0);
  vec4 Q = (RGB.r < P.x) ? vec4(P.xyw, RGB.r) : vec4(RGB.r, P.yzx);
  float C = Q.x - min(Q.w, Q.y);
  float H = abs((Q.w - Q.y) / (6. * C + Epsilon) + Q.z);
  return vec3(H, C, Q.x);
}
vec3 RGBtoHSL(vec3 RGB){
  vec3 HCV = RGBtoHCV(RGB);
  float L = HCV.z - HCV.y * 0.5;
  float S = HCV.y / (1. - abs(L * 2. - 1.) + Epsilon);
  return vec3(HCV.x, S, L);
}
vec4 calcColor(float p, vec3 c){
  vec3 hsl = RGBtoHSL(c);
  return vec4(HSLtoRGB(vec3(hsl.x, hsl.y, p)), 1.);
}
void main() {
  vec4 position;
  if (uEpoch < aEpoch || (uEpoch > aEpoch + aSpan)) {
    position = vec4(-1,-1,-1,-1);
  } else {
    float t = (uEpoch - aEpoch)/aSpan + aTimeOffset;
    t = min(t, 1.);
    t = max(t,0.);
    vec4 pos = bezierCurve(t, aStartPoint, aMidPoint, aEndPoint);
    position = uMapMatrix * vec4(pos.x, pos.y, 0, 1);
    float luminance = clamp(1. - ((aEndTime - uEpoch)/uTotalTime), 0.45, 0.95);
    vColor = calcColor(luminance, vec3(1.,0.,0.));
  }
  gl_Position = position;
  gl_PointSize = uSize;
}`;

WebGLVectorTile2Shaders.monthlyRefugeesFragmentShader = `
/*precision mediump float;*/
varying vec4 vColor;
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = vColor * dist;
}`;

WebGLVectorTile2Shaders.gtdVertexShader = `
attribute vec4 a_WorldCoord;
attribute float a_Epoch;
attribute float a_NCasualties;
uniform float u_EpochTime;
uniform float u_Span;
uniform mat4 u_MapMatrix;
varying float v_Alpha;
void main() {
  if ( a_Epoch > u_EpochTime) {
    gl_Position = vec4(-1,-1,-1,-1);
  } else if (u_EpochTime - a_Epoch > u_Span) {
    gl_Position = vec4(-1,-1,-1,-1);
  }
  else {
    gl_Position = u_MapMatrix * a_WorldCoord;
  }
  v_Alpha = (u_EpochTime - a_Epoch) / u_Span;
  //gl_PointSize = 1.0 * a_NCasualties;
  float pointSize = 5.0;
  if (a_NCasualties > 5.0) {
    pointSize = a_NCasualties;
  } else {
    pointSize = 5.0;
  }
  gl_PointSize = max(10.0,300.0*smoothstep(5., 94., sqrt(pointSize)));
}`;

WebGLVectorTile2Shaders.gtdFragmentShader = `
/*precision mediump float;*/
varying float v_Alpha;
void main() {
  float r = 1.0 - v_Alpha;
  float dist = distance( vec2(0.5, 0.5), gl_PointCoord);
  dist = 1.0 - (dist * 2.0);
  dist = max(0.0, dist);
  gl_FragColor =  vec4(r, .0, .0, .85) * dist;
}`;

WebGLVectorTile2Shaders.uppsalaConflictVertexShader = `
attribute vec4 a_centroid;
attribute float a_start_epoch;
attribute float a_end_epoch;
attribute float a_val;
uniform float u_epoch;
uniform float u_span;
uniform float u_size;
uniform mat4 u_map_matrix;
varying float v_alpha;
void main() {
  if ( a_start_epoch > u_epoch) {
    gl_Position = vec4(-1,-1,-1,-1);
  } else if (u_epoch - a_end_epoch > u_span) {
    gl_Position = vec4(-1,-1,-1,-1);
  }
  else {
    gl_Position = u_map_matrix * a_centroid;
  }
  v_alpha = (u_epoch - a_end_epoch) / u_span;
  gl_PointSize = u_size * a_val;
}`;


WebGLVectorTile2Shaders.uppsalaConflictFragmentShader = `
/*precision mediump float;*/
varying float v_alpha;
void main() {
  float r = 1.0 - v_alpha;
  float dist = distance( vec2(0.5, 0.5), gl_PointCoord);
  dist = 1.0 - (dist * 2.0);
  dist = max(0.0, dist);
  gl_FragColor =  vec4(r, .0, .0, .85) * dist;
}`;

WebGLVectorTile2Shaders.hivVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Year;
attribute float a_Val1;
attribute float a_Val2;
uniform float u_Delta;
uniform float u_Size;
uniform float u_Year;
uniform mat4 u_MapMatrix;
varying float v_Val;

void main() {
  vec4 position;
  if (a_Year != u_Year) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  }
  gl_Position = position;
  float size = (a_Val2 - a_Val1) * u_Delta + a_Val1;
  v_Val = size;
  gl_PointSize = 100.0 * u_Size * abs(size);
}`;

WebGLVectorTile2Shaders.hivFragmentShader = `
/*precision mediump float;*/
uniform sampler2D u_Image;
varying float v_Val;
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float alpha = smoothstep(0.3-dist, 0.3, dist);
  vec4 color = texture2D(u_Image, vec2(v_Val,v_Val));
  gl_FragColor = vec4(color.r, color.g, color.b, .75) * alpha;
}`;

WebGLVectorTile2Shaders.obesityVertexShader = `
attribute vec4 a_Vertex;
attribute float a_Year;
attribute float a_Val1;
attribute float a_Val2;
uniform float u_Delta;
uniform float u_Size;
uniform float u_Year;
uniform mat4 u_MapMatrix;
varying float v_Val;
void main() {
  vec4 position;
  if (a_Year != u_Year) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_MapMatrix * vec4(a_Vertex.x, a_Vertex.y, 0, 1);
  }
  gl_Position = position;
  v_Val = (a_Val2 - a_Val1) * u_Delta + a_Val1;
}`;

WebGLVectorTile2Shaders.obesityFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_Image;
varying float v_Val;
void main() {
  vec4 color = texture2D(u_Image, vec2(v_Val,v_Val));
  gl_FragColor = vec4(color.r, color.g, color.b, 1.);
}`;

WebGLVectorTile2Shaders.vaccineConfidenceVertexShader = `
attribute vec4 a_Vertex;
attribute float a_Val1;
attribute float a_Val2;
attribute float a_Val3;
attribute float a_Val4;
uniform float u_Val;
uniform mat4 u_MapMatrix;
varying float v_Val;
void main() {
  vec4 position;
  position = u_MapMatrix * vec4(a_Vertex.x, a_Vertex.y, 0, 1);
  gl_Position = position;
  if (u_Val == 1.0) {
    v_Val = a_Val1;
  }
  if (u_Val == 2.0) {
    v_Val = a_Val2;
  }
  if (u_Val == 3.0) {
    v_Val = a_Val3;
  }
  if (u_Val == 4.0) {
    v_Val = a_Val4;
  }
}`;

WebGLVectorTile2Shaders.vaccineConfidenceFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_Image;
varying float v_Val;
void main() {
  vec4 color = texture2D(u_Image, vec2(v_Val,v_Val));
  gl_FragColor = vec4(color.r, color.g, color.b, 1.);
}`;

WebGLVectorTile2Shaders.bubbleMapVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Epoch1;
attribute float a_Val1;
attribute float a_Epoch2;
attribute float a_Val2;
uniform float u_Epoch;
uniform float u_Size;
uniform mat4 u_MapMatrix;
varying float v_Val;
varying float v_Size;
void main() {
  vec4 position;
  if (u_Epoch >= a_Epoch1 && u_Epoch < a_Epoch2) {
    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  } else {
    position = vec4(-1,-1,-1,-1);
  }
  gl_Position = position;
  float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);
  float size = (a_Val2 - a_Val1) * delta + a_Val1;
  v_Val = size;
  v_Size = abs(size);
  gl_PointSize = abs(u_Size * size);
}`;

WebGLVectorTile2Shaders.bubbleMapFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_Val;
uniform vec4 u_Color;
uniform vec4 u_NegativeColor;
uniform float u_Mode;
uniform float u_Alpha;
void main() {
    float dist = length(gl_PointCoord.xy - vec2(.5, .5));
    dist = 1. - (dist * 2.);
    dist = max(0., dist);
    float delta = fwidth(dist);
    float alpha = smoothstep(0.45-delta, 0.45, dist);
    if (u_Mode == 2.0) {
      if (gl_PointCoord.x > 0.5) {
        alpha = 0.0;
      }
    }
    if (u_Mode == 3.0) {
      if (gl_PointCoord.x < 0.5) {
        alpha = 0.0;
      }
    }
    vec4 circleColor = u_Color;
    if (v_Val < 0.0) { 
      circleColor = u_NegativeColor; 
    };
    vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);
    float outerEdgeCenter = 0.5 - .01;
    float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);
    gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*u_Alpha );
}`;

WebGLVectorTile2Shaders.bubbleMapFragmentShaderV2 = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_Val;
varying float v_Size;
uniform float u_EdgeSize;
uniform vec4 u_Color;
uniform vec4 u_EdgeColor;
uniform float u_Mode;
void main() {
  float distance = length(2.0 * gl_PointCoord - 1.0) * 2.0;
  if (distance > 1.0) {
    discard;
  }
  float sEdge = smoothstep(
    v_Size - u_EdgeSize - 2.0,
    v_Size - u_EdgeSize,
    distance * (v_Size + u_EdgeSize)
  );
  gl_FragColor = u_Color;
  gl_FragColor = (u_EdgeColor * sEdge) + ((1.0 - sEdge) * gl_FragColor);
  gl_FragColor.a = gl_FragColor.a * (1.0 - smoothstep(v_Size - 2.0, v_Size, distance * v_Size));
    if (u_Mode == 2.0) {
      if (gl_PointCoord.x > 0.5) {
        gl_FragColor.a = 0.0;
      }
    }
    if (u_Mode == 3.0) {
      if (gl_PointCoord.x < 0.5) {
        gl_FragColor.a = 0.0;
      }
    }
}`

WebGLVectorTile2Shaders.bubbleMapWithPackedColorVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Epoch1;
attribute float a_Val1;
attribute float a_Epoch2;
attribute float a_Val2;
attribute float a_color;
uniform float u_Epoch;
uniform float u_Size;
uniform mat4 u_MapMatrix;
varying float v_Val;
varying float v_color;
void main() {
  vec4 position;
  if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  }
  gl_Position = position;
  float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);
  float size = (a_Val2 - a_Val1) * delta + a_Val1;
  v_Val = size;
  gl_PointSize = abs(u_Size * size);
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.bubbleMapWithPackedColorFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_Val;
varying float v_color;
uniform vec4 u_Color;
uniform float u_Mode;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 256.0;
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float delta = fwidth(dist);
  float alpha = smoothstep(0.45-delta, 0.45, dist);
  if (u_Mode == 2.0) {
    if (gl_PointCoord.x > 0.5) {
      alpha = 0.0;
    }
  }
  if (u_Mode == 3.0) {
    if (gl_PointCoord.x < 0.5) {
      alpha = 0.0;
    }
  }
  vec4 circleColor = unpackColor(v_color);
  if (v_Val < 0.0) { circleColor[0] = 1.0; circleColor[1]=0.0; circleColor[2]=0.0; };
  vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);
  float outerEdgeCenter = 0.5 - .01;
  float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);
  gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );
}`;

WebGLVectorTile2Shaders.bubbleMapWithColorMapFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_Val;
uniform sampler2D u_Image;
uniform float u_Min;
uniform float u_Max;
uniform float u_Mode;
float scale(float v, float min, float max) {
  return (v - min)/(max - min);
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float delta = fwidth(dist);
  float alpha = smoothstep(0.45-delta, 0.45, dist);
  if (u_Mode == 2.0) {
    if (gl_PointCoord.x > 0.5) {
      alpha = 0.0;
    }
  }
  if (u_Mode == 3.0) {
    if (gl_PointCoord.x < 0.5) {
      alpha = 0.0;
    }
  }
  vec4 circleColor = texture2D(u_Image, vec2(scale(v_Val, u_Min, u_Max),scale(v_Val, u_Min, u_Max)));
  vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);
  float outerEdgeCenter = 0.5 - .01;
  float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);
  gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );
}`;

WebGLVectorTile2Shaders.bivalentBubbleMapWithColorMapVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Epoch1;
attribute float a_PointVal1;
attribute float a_ColorVal1;
attribute float a_Epoch2;
attribute float a_PointVal2;
attribute float a_ColorVal2;
uniform float u_Epoch;
uniform float u_Size;
uniform mat4 u_MapMatrix;
varying float v_PointVal;
varying float v_ColorVal;
void main() {
  vec4 position;
  if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  }
  gl_Position = position;
  float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);
  float size = (a_PointVal2 - a_PointVal1) * delta + a_PointVal1;
  v_PointVal = size;
  v_ColorVal = (a_ColorVal2 - a_ColorVal1) * delta + a_ColorVal1;
  gl_PointSize = abs(u_Size * size);
}`;

WebGLVectorTile2Shaders.bivalentBubbleMapWithColorMapFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_PointVal;
varying float v_ColorVal;
uniform sampler2D u_Image;
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float delta = fwidth(dist);
  float alpha = smoothstep(0.45-delta, 0.45, dist);
  vec4 circleColor = texture2D(u_Image, vec2(v_ColorVal,v_ColorVal));
  vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);
  float outerEdgeCenter = 0.5 - .01;
  float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);
  gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );
}`;

WebGLVectorTile2Shaders.bivalentBubbleMapWithColorMapFragmentShaderNoBorder = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_PointVal;
varying float v_ColorVal;
uniform sampler2D u_Image;
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float delta = fwidth(dist);
  float alpha = smoothstep(0.5-delta, 0.5, dist);
  vec4 circleColor = texture2D(u_Image, vec2(v_ColorVal,v_ColorVal));
  gl_FragColor = vec4( circleColor.rgb, alpha*.75 );
}`;

WebGLVectorTile2Shaders.styledBubbleMapVertexShader = `
attribute vec4 a_coords;
attribute float a_epoch1;
attribute float a_val1;
attribute float a_epoch2;
attribute float a_val2;
attribute vec4 a_fill_rgba;
attribute float a_stroke_width;
attribute vec4 a_stroke_rgba;

uniform float u_epoch;
uniform mat4 u_matrix;

varying float v_radius;
varying vec4 v_fill_rgba;
varying float v_stroke_width;
varying vec4 v_stroke_rgba;

void main() {
  vec4 position;
  if (a_epoch1 >= u_epoch || a_epoch2 < u_epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position =  u_matrix * a_coords;
  }
  gl_Position = position;
  float a = smoothstep(a_epoch1, a_epoch2, u_epoch);
  float value = mix(a_val1, a_val2, a);
  gl_PointSize = value;
  v_radius = value*0.5;
  v_fill_rgba = a_fill_rgba;
  v_stroke_width = a_stroke_width;
  v_stroke_rgba = a_stroke_rgba;
}
`;

WebGLVectorTile2Shaders.styledBubbleMapFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/

varying float v_radius;
varying vec4 v_fill_rgba;
varying float v_stroke_width;
varying vec4 v_stroke_rgba;

float circle(vec2 st, float radius) {
  float dist = distance(st, vec2(0.50, 0.50));
  float delta = fwidth(dist);
  float alpha = smoothstep(radius-delta, radius+delta, dist);
  return 1.0 - alpha;
}

void main() {
  float stroke = v_stroke_width;
  float radius = v_radius;
  float alpha = circle(gl_PointCoord.xy, .5);
  vec4 o = v_stroke_rgba * alpha;
  alpha = circle(gl_PointCoord.xy, (radius-stroke)/radius * 0.5);
  vec4 i = v_fill_rgba * alpha;
  gl_FragColor = mix(o,i,alpha);
}
`;

WebGLVectorTile2Shaders.iomIdpVertexShader = `
attribute vec4 a_coord;
attribute float a_country;
attribute float a_type;
attribute float a_epoch1;
attribute float a_val1;
attribute float a_epoch2;
attribute float a_val2;
uniform mat4 u_map_matrix;
uniform float u_point_size;
uniform float u_epoch;
uniform bool u_show_irq_idps;
uniform bool u_show_syr_idps;
uniform bool u_show_yem_idps;
uniform bool u_show_lby_idps;
uniform bool u_show_irq_returns;
uniform bool u_show_syr_returns;
uniform bool u_show_yem_returns;
uniform bool u_show_lby_returns;
varying float v_type;
void main() {
  vec4 position;
  if (a_epoch1 > u_epoch || a_epoch2 <= u_epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_map_matrix * vec4(a_coord.x, a_coord.y, 0, 1);
  }
  //if (a_type == 0.0 && !u_show_idp) {
  //  position = vec4(-1,-1,-1,-1);
  //}
  //if (a_type == 1.0 && !u_show_returns) {
  //  position = vec4(-1,-1,-1,-1);
  //}
  if (a_country == 368.0) { /* Iraq */
    if (a_type == 0.0 && !u_show_irq_idps) {
      position = vec4(-1,-1,-1,-1);
    }
    if (a_type == 1.0 && !u_show_irq_returns) {
      position = vec4(-1,-1,-1,-1);
    }
  }
  if (a_country == 760.0) {
    if (a_type == 0.0 && !u_show_syr_idps) {
      position = vec4(-1,-1,-1,-1);
    }
    if (a_type == 1.0 && !u_show_syr_returns) {
      position = vec4(-1,-1,-1,-1);
    }
  }
  if (a_country == 887.0) {
    if (a_type == 0.0 && !u_show_yem_idps) {
      position = vec4(-1,-1,-1,-1);
    }
    if (a_type == 1.0 && !u_show_yem_returns) {
      position = vec4(-1,-1,-1,-1);
    }
  }
  if (a_country == 434.0) {
    if (a_type == 0.0 && !u_show_lby_idps) {
      position = vec4(-1,-1,-1,-1);
    }
    if (a_type == 1.0 && !u_show_lby_returns) {
      position = vec4(-1,-1,-1,-1);
    }
  }
  gl_Position = position;
  float delta = (u_epoch - a_epoch1)/(a_epoch2 - a_epoch1);
  float size = (a_val2 - a_val1) * delta + a_val1;
  gl_PointSize = u_point_size * size;
  v_type = a_type;
}`;

WebGLVectorTile2Shaders.iomIdpFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_type;
void main() {
  // set pixels in points to something that stands out
  //float dist = distance(gl_PointCoord.xy, vec2(0.5, 0.5));
  //float delta = fwidth(dist);
  //float alpha = smoothstep(0.45-delta, 0.45, dist);
  //gl_FragColor = vec4(.65, .07, .07, .75) * (1. - alpha);
  vec4 color = vec4(.65, .07, .07, .95);
  if (v_type == 1.0) {
    color = vec4(0.07, .07, .65, .95);
  }
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  float delta = fwidth(dist);
  float alpha = smoothstep(0.45-delta, 0.45, dist);
  vec4 circleColor = color; //vec4(.65, .07, .07, .95);
  vec4 outlineColor = vec4(1.0,1.0,1.0,1.0);
  float outerEdgeCenter = 0.5 - .01;
  float stroke = smoothstep(outerEdgeCenter - delta, outerEdgeCenter + delta, dist);
  gl_FragColor = vec4( mix(outlineColor.rgb, circleColor.rgb, stroke), alpha*.75 );
}`;

WebGLVectorTile2Shaders.choroplethMapVertexShader = `
attribute vec4 a_Centroid;
attribute float a_Epoch1;
attribute float a_Val1;
attribute float a_Epoch2;
attribute float a_Val2;
uniform float u_Epoch;
uniform mat4 u_MapMatrix;
varying float v_Val;
void main() {
  vec4 position;
  if (a_Epoch1 > u_Epoch || a_Epoch2 <= u_Epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  }
  gl_Position = position;
  float delta = (u_Epoch - a_Epoch1)/(a_Epoch2 - a_Epoch1);
  v_Val = (a_Val2 - a_Val1) * delta + a_Val1;
}`;

WebGLVectorTile2Shaders.choroplethMapFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_Image;
varying float v_Val;
uniform vec4 u_color;
uniform int u_useColorMap;
void main() {
  vec4 color;
  if (u_useColorMap == 1) {
    color = texture2D(u_Image, vec2(v_Val,0.));
  } else {
    color = color = u_color;
  }
  gl_FragColor = vec4(color.r, color.g, color.b, 1.);
}`;

WebGLVectorTile2Shaders.choroplethMapVertexShaderV2 = `
attribute vec2 a_Centroid;
attribute float a_RegionIdx;
uniform float u_NumRegionsPerRow;
uniform float u_NumEpochs;
uniform float u_ValuesWidth;
uniform float u_ValuesHeight;
uniform float u_TimeIndex;
uniform mat4 u_MapMatrix;
varying vec2 v_ValCoord;
void main() {
  vec4 position;
  position = u_MapMatrix * vec4(a_Centroid.x, a_Centroid.y, 0, 1);
  gl_Position = position;
  float row = floor((a_RegionIdx + 0.5) / u_NumRegionsPerRow);
  float col = a_RegionIdx - row * u_NumRegionsPerRow;
  v_ValCoord = vec2((col * u_NumEpochs + u_TimeIndex + 0.5) / u_ValuesWidth,
                    (row + 0.5) / u_ValuesHeight);
}`

WebGLVectorTile2Shaders.choroplethMapFragmentShaderV2 = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_Colormap;
uniform sampler2D u_Values;
varying vec2 v_ValCoord;
void main() {
  vec4 val = texture2D(u_Values, v_ValCoord); // luminance and alpha
  vec4 color = texture2D(u_Colormap, vec2(val.r, 0.));
  gl_FragColor = vec4(color.r, color.g, color.b, color.a * val.a); // transparent when colormap is, or val undefined
}`;

WebGLVectorTile2Shaders.timeSeriesPointDataVertexShader = `
//WebGLVectorTile2.timeSeriesPointDataVertexShader
attribute vec4 a_centroid;
attribute float a_epoch1;
attribute float a_val1;
attribute float a_epoch2;
attribute float a_val2;
uniform float u_max_value;
uniform float u_epoch;
uniform mat4 u_map_matrix;
varying float v_val;
varying float v_val1;

void main() {
  vec4 position;
  if (a_epoch1 > u_epoch || a_epoch2 <= u_epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    position = u_map_matrix * vec4(a_centroid.x, a_centroid.y, 0, 1);
  }
  gl_Position = position;
  float delta = (u_epoch - a_epoch1)/(a_epoch2 - a_epoch1);
  v_val = (a_val2 - a_val1) * delta + a_val1;
  v_val1 = a_val1;
  if (a_val1 > 0.) {
    gl_PointSize = 140. * smoothstep(10.0, u_max_value, sqrt(v_val)) + 10.;
  } else {
    gl_PointSize = 100.;
  }
}`;

WebGLVectorTile2Shaders.timeSeriesPointDataFragmentShader = `
//WebGLVectorTile2.timeSeriesPointDataFragmentShader
/*precision mediump float;*/
varying float v_val;
varying float v_val1;

void main() {
  vec3 color;
  color = vec3(212./255., 212./255., 212./255.);
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = vec4(color, 1.) * dist;
}`;

WebGLVectorTile2Shaders.tsipVertexShader = `
attribute vec2 a_coord;
attribute float a_color;
attribute float a_epoch;
attribute float a_val;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
varying float v_color;

void main() {
    vec4 position;
    if (a_epoch > u_epoch) {
        position = vec4(-1,-1,-1,-1);
        //position = u_map_matrix * vec4(a_coord, 0, 1);
    } else {
        position = u_map_matrix * vec4(a_coord, 0, 1);
    }
    gl_Position = position;
    gl_PointSize = u_size * a_val;
    v_color = a_color;
}`;

WebGLVectorTile2Shaders.tsipFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 255.0;
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(0.5, 0.5));
  dist = 1.0 - (dist * 2.);
  dist = max(0.0, dist);
  gl_FragColor =  unpackColor(v_color) * dist;
}`;

WebGLVectorTile2Shaders.pointFlowAccelVertexShader = `
attribute vec4 a_p0;
attribute vec4 a_p1;
attribute vec4 a_p2;
attribute float a_epoch0;
attribute float a_epoch1;
uniform float u_epoch;
uniform float u_size;
uniform mat4 u_map_matrix;
varying float v_t;

vec4 bezier(float t, vec4 p0, vec4 p1, vec4 p2) {
  return (1.0-t)*(1.0-t)*p0 + 2.0*(1.0-t)*t*p1 + t*t*p2;
}

void main() {
  vec4 position;
  if (a_epoch0 > u_epoch || a_epoch1 < u_epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    float t = 1.0 - (a_epoch1 - u_epoch)/(a_epoch1 - a_epoch0);
    // s-curve -- constant acceleration for first half then constant deceleration
    t = 2.0 * (t < 0.5 ? t * t : 0.5 - (1.0-t)*(1.0-t));
    v_t = t;
    position = u_map_matrix * bezier(t, a_p0, a_p1, a_p2);
  }
  gl_Position = position;
  gl_PointSize = u_size;
}`;

WebGLVectorTile2Shaders.pointFlowVertexShader = `
//WebGLVectorTile2.pointFlowVertexShader
attribute vec4 a_p0;
attribute vec4 a_p1;
attribute vec4 a_p2;
attribute float a_epoch0;
attribute float a_epoch1;
uniform float u_epoch;
uniform float u_size;
uniform mat4 u_map_matrix;
varying float v_t;
vec4 bezier(float t, vec4 p0, vec4 p1, vec4 p2) {
  return (1.0-t)*(1.0-t)*p0 + 2.0*(1.0-t)*t*p1 + t*t*p2;
}
void main() {
  vec4 position;
  if (a_epoch0 > u_epoch || a_epoch1 < u_epoch) {
    position = vec4(-1,-1,-1,-1);
  } else {
    float t = 1.0 - (a_epoch1 - u_epoch)/(a_epoch1 - a_epoch0);
  v_t = t;
    position = u_map_matrix * bezier(t, a_p0, a_p1, a_p2);
  }
  gl_Position = position;
  gl_PointSize = u_size;
}`;

WebGLVectorTile2Shaders.pointFlowFragmentShader = `
/*precision mediump float;*/
varying float v_t;
uniform vec4 u_start_color;
uniform vec4 u_end_color;
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  //vec4 colorStart = vec4(.94,.94,.94,1.0);
  //vec4 colorEnd = vec4(.71,0.09,0.05,1.0);
  vec4 colorStart = u_start_color;
  vec4 colorEnd = u_end_color;
  gl_FragColor = mix(colorStart, colorEnd, v_t) * dist;
}`;

WebGLVectorTile2Shaders.pointVertexShader = `
attribute vec4 a_coord;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_size;
varying float v_color;
void main() {
    vec4 position;
    position = u_map_matrix * a_coord;
    gl_Position = position;
    gl_PointSize = u_size;
    v_color = a_color;
}`;

WebGLVectorTile2Shaders.pointFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
uniform vec4 u_color;
uniform bool override_packed_color;
vec4 unpackColor(float f) {
    vec4 color;
    color.b = floor(f / 256.0 / 256.0);
    color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
    color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
    color.a = 256.;
    return color / 256.0;
  }
void main() {
  //float dist = length(gl_PointCoord.xy - vec2(.5,.5));
  //float alpha = (dist > .5) ? .0 : 1.;
  float r = 0.0, delta = 0.0, alpha = 1.0;
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  r = dot(cxy, cxy);
  delta = fwidth(r);
  alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
  if (override_packed_color) {
    gl_FragColor = u_color;
  } else {
    gl_FragColor = unpackColor(v_color);
  }
  gl_FragColor = gl_FragColor * alpha;
}`;

//SMELL PGH
WebGLVectorTile2Shaders.glyphVertexShader = `
attribute vec4 a_coord;
uniform mat4 u_map_matrix;
uniform float u_size;
void main() {
  vec4 position;
  position = u_map_matrix * a_coord;
  gl_Position = position;
  gl_PointSize = u_size;
}`;

WebGLVectorTile2Shaders.glyphFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_texture;
void main() {
  gl_FragColor = texture2D(u_texture, vec2(gl_PointCoord.x, gl_PointCoord.y));
}`;

WebGLVectorTile2Shaders.glyphStartEpochEndEpochVertexShader = `
attribute vec4 a_coord;
attribute float a_epoch0;
attribute float a_epoch1;
attribute float a_offset;
uniform mat4 u_map_matrix;
uniform float u_size;
uniform float u_epoch;
varying float v_offset;
void main() {
  vec4 position;
  if (u_epoch < a_epoch0) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else if (a_epoch1 < u_epoch){
      position = u_map_matrix * a_coord;
  } else{
      position = u_map_matrix * a_coord;
  }
  gl_Position = position;
  gl_PointSize = u_size;
  v_offset = a_offset;
}`;

WebGLVectorTile2Shaders.glyphStartEpochEndEpochFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_texture;
uniform float u_num_glyphs;
varying float v_offset;
void main() {
  vec2 texcoords = vec2((gl_PointCoord.x + v_offset) / u_num_glyphs, gl_PointCoord.y);
  gl_FragColor = texture2D(u_texture, texcoords);
}`;

WebGLVectorTile2Shaders.FadeGlyphStartEpochEndEpochVertexShader = `
attribute vec4 a_coord;
attribute float a_epoch0;
attribute float a_epoch1;
attribute float a_offset;
uniform mat4 u_map_matrix;
uniform float u_fade_duration;
uniform float u_size;
uniform float u_epoch;
varying float v_offset;
varying float v_dim;
void main() {
  vec4 position;
  //float fade_duration = 36000.0; //10hr
  float min_alpha = 0.0;
  if (u_epoch < a_epoch0) {
      position = vec4(-1.,-1.,-1.,-1.);
  } else if(a_epoch1 < u_epoch){
      position = u_map_matrix * a_coord;
  v_dim = max(min_alpha, 1.0 - ((u_epoch - a_epoch1)/u_fade_duration));
  } else{
      position = u_map_matrix * a_coord;
      v_dim = 1.0;
  }
  gl_Position = position;
  gl_PointSize = u_size;
  v_offset = a_offset;
}`;

WebGLVectorTile2Shaders.FadeGlyphStartEpochEndEpochFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
uniform sampler2D u_texture;
uniform float u_num_glyphs;
varying float v_offset;
varying float v_dim;
void main() {
  vec2 texcoords = vec2((gl_PointCoord.x + v_offset) / u_num_glyphs, gl_PointCoord.y);
  vec4 tex = texture2D(u_texture, texcoords);
  gl_FragColor = vec4(tex.rgb, v_dim * tex.a);
}`;

WebGLVectorTile2Shaders.polygonVertexShader = `
attribute vec4 a_coord;
attribute float a_color;
uniform mat4 u_map_matrix;
varying float v_color;
void main() {
    vec4 position;
    position = u_map_matrix * a_coord;
    gl_Position = position;
    v_color = a_color;
}`;

WebGLVectorTile2Shaders.polygonFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
uniform float u_alpha;
vec3 unpackColor(float f) {
  vec3 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  return color/255.;
}
void main() {
  gl_FragColor = vec4(unpackColor(v_color), u_alpha);
}`;

WebGLVectorTile2Shaders.lineStringVertexShader = `
attribute vec2 a_coord;
uniform mat4 u_map_matrix;
void main() {
  gl_Position = u_map_matrix * vec4(a_coord, 0., 1.);
}`;


WebGLVectorTile2Shaders.lineStringFragmentShader = `
/*precision mediump float;*/
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}`;

WebGLVectorTile2Shaders.lineStringEpochVertexShader = `
attribute vec2 a_coord;
attribute float a_epoch;
uniform float u_epoch;
uniform float u_span;
uniform mat4 u_map_matrix;
varying float v_t;
float linearEasing(float t) {
    //return t;
    return 1.0;
}
void main() {
    vec4 position;
    if (a_epoch + u_span <= u_epoch || a_epoch > u_epoch) {
        position = vec4(-1.,-1.,-1.,-1.);
    } else {
        position = u_map_matrix * vec4(a_coord, 0.0, 1.0);
        float t = (u_epoch - a_epoch)/((a_epoch + u_span) - a_epoch);
        v_t = linearEasing(t);
    }
    gl_Position = position;
}`;

WebGLVectorTile2Shaders.lineStringEpochFragmentShader = `
/*precision mediump float;*/
uniform vec4 u_color;
varying float v_t;
void main() {
  gl_FragColor = vec4(u_color.rgb, u_color.a * v_t);
}`;

WebGLVectorTile2Shaders.expandedLineStringVertexShader = `
attribute vec2 a_coord;
attribute vec2 a_normal;
attribute float a_miter;
attribute float a_texture_loc;
uniform mat4 u_map_matrix;
uniform float u_thickness;
varying float v_edge;
varying float v_texture_loc;
void main() {
  v_edge = sign(a_miter);
  vec2 position = a_coord + vec2(a_normal * u_thickness/2.0 * a_miter);
  v_texture_loc = a_texture_loc;
  gl_Position = u_map_matrix * vec4(position, 0., 1.);
}`;


WebGLVectorTile2Shaders.expandedLineStringFragmentShader = `
/*precision mediump float;*/
uniform vec3 u_color;
uniform float u_inner;
varying float v_edge;
varying float v_texture_loc;
uniform sampler2D u_texture;
void main() {
  float v = 1.0 - abs(v_edge);
  v = smoothstep(0.65, 0.7, v*u_inner);
  vec4 c = texture2D(u_texture, vec2(v_texture_loc, 0));
  gl_FragColor = mix(c, vec4(0.0), v);
  //gl_FragColor = texture2D(u_texture, vec2(v_texture_loc, 0));
}`;

/* x,y,size,color,epoch */
WebGLVectorTile2Shaders.PointSizeColorEpochVertexShader = `
attribute vec4 a_coord;
attribute float a_size;
attribute float a_color;
attribute float a_epoch;
uniform mat4 u_map_matrix;
uniform float u_size;
uniform float u_epoch;
uniform float u_epoch_range;
varying float v_color;
void main() {
  vec4 position;
  if (a_epoch > u_epoch + u_epoch_range || a_epoch < u_epoch) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else {
    position = u_map_matrix * a_coord;
  }
  gl_Position = position;
  gl_PointSize = u_size*a_size;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.PointSizeColorVertexShader = `
attribute vec4 a_coord;
attribute float a_size;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_size;
varying float v_color;
void main() {
  vec4 position;
  position = u_map_matrix * a_coord;
  gl_Position = position;
  gl_PointSize = u_size*a_size;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.PointColorFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 256.0;
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = unpackColor(v_color) * dist;
}`;

WebGLVectorTile2Shaders.PointColorStartEpochEndEpochVertexShader = `
attribute vec4 a_coord;
attribute float a_color;
attribute float a_epoch0;
attribute float a_epoch1;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
varying float v_color;
void main() {
  vec4 position;
  if (a_epoch0 > u_epoch || a_epoch1 < u_epoch) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else {
    position = u_map_matrix * a_coord;
  }
  gl_Position = position;
  gl_PointSize = u_size*2.0;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.PointColorStartEpochEndEpochFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 255.0;
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = unpackColor(v_color) * dist;
}`;

WebGLVectorTile2Shaders.PointSolidColorStartEpochEndEpochFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 255.0;
}
void main() {
  float r = 0.0, delta = 0.0, alpha = 1.0;
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  r = dot(cxy, cxy);
  delta = fwidth(r);
  alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
  gl_FragColor = unpackColor(v_color) * alpha;
}`;

// gradually decreases alpha once time has passed epoch1
WebGLVectorTile2Shaders.FadePointColorStartEpochEndEpochVertexShader = `
attribute vec4 a_coord;
attribute float a_color;
attribute float a_epoch0;
attribute float a_epoch1;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
varying float v_color;
varying float v_dim;
void main() {
    vec4 position;
    float fade_duration = 3600.0; //1hr
    float min_alpha = 0.3;
    if (u_epoch < a_epoch0) {
        position = vec4(-1.,-1.,-1.,-1.);
        v_dim = 0.0;
    } else if(a_epoch1 < u_epoch){
       position = u_map_matrix * a_coord;
   	//v_dim = min_alpha;
   	v_dim = max(min_alpha, 1.0 - ((u_epoch - a_epoch1)/fade_duration));
    } else {
        position = u_map_matrix * a_coord;
        v_dim = 1.0;
    }
    gl_Position = position;
    gl_PointSize = u_size*2.0;
    v_color = a_color;
}`;

//unpackColor func alters alpha according to vertex shader
WebGLVectorTile2Shaders.FadePointColorStartEpochEndEpochFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
varying float v_dim;
vec4 unpackColor(float f, float dim) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color = color / 256.0;
  color.a = dim;
  return color;
}
void main() {
  float r = 0.0, delta = 0.0, alpha = 1.0;
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  r = dot(cxy, cxy);
  delta = fwidth(r);
  alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
  gl_FragColor = unpackColor(v_color, v_dim) * alpha;
}`;

WebGLVectorTile2Shaders.PointSizeColorStartEpochEndEpochVertexShader = `
attribute vec4 a_coord;
attribute float a_size;
attribute float a_color;
attribute float a_epoch0;
attribute float a_epoch1;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
varying float v_color;
void main() {
  vec4 position;
  if (a_epoch0 > u_epoch || a_epoch1 < u_epoch) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else {
    position = u_map_matrix * a_coord;
  }
  gl_Position = position;
  gl_PointSize = u_size*a_size;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.PointSizeColorStartEpochEndEpochFragmentShader = `
#extension GL_OES_standard_derivatives : enable
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 256.0;
}
void main() {
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = unpackColor(v_color) * dist;
}`;

//borrowed from spCrudeVertexShader
WebGLVectorTile2Shaders.AnimPointsVertexShader = `
attribute vec4 a_coord_0;
attribute float a_epoch_0;
attribute vec4 a_coord_1;
attribute float a_epoch_1;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
varying float v_color;
void main() {
  vec4 position;
  if (a_epoch_0 > u_epoch || a_epoch_1 < u_epoch) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else {
    float t = (u_epoch - a_epoch_0)/(a_epoch_1 - a_epoch_0);
    position = u_map_matrix * ((a_coord_1 - a_coord_0) * t + a_coord_0);
  }
  gl_Position = position;
  gl_PointSize = u_size*8.;
  v_color = a_color;
}`;


WebGLVectorTile2Shaders.spCrudeVertexShader = `
attribute vec4 a_coord_0;
attribute float a_epoch_0;
attribute vec4 a_coord_1;
attribute float a_epoch_1;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
varying float v_color;
void main() {
  vec4 position;
  if (a_epoch_0 > u_epoch || a_epoch_1 < u_epoch) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else {
    float t = (u_epoch - a_epoch_0)/(a_epoch_1 - a_epoch_0);
    position = u_map_matrix * ((a_coord_1 - a_coord_0) * t + a_coord_0);
  }
  gl_Position = position;
  gl_PointSize = u_size*8.;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.spCrudeFragmentShader = `
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 256.0;
}
void main() {
  //gl_FragColor = unpackColor(v_color);
  float dist = length(gl_PointCoord.xy - vec2(.5, .5));
  dist = 1. - (dist * 2.);
  dist = max(0., dist);
  gl_FragColor = unpackColor(v_color) * dist;
}`;

WebGLVectorTile2Shaders.particleVertexShader = `
attribute vec4 a_coord_0;
attribute float a_elev_0;
attribute float a_epoch_0;
attribute vec4 a_coord_1;
attribute float a_elev_1;
attribute float a_epoch_1;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
uniform float u_max_elev;
varying float v_color;
void main() {
  vec4 position;
  if (a_epoch_0 > u_epoch || a_epoch_1 < u_epoch) {
    position = vec4(-1.,-1.,-1.,-1.);
  } else {
    float t = (u_epoch - a_epoch_0)/(a_epoch_1 - a_epoch_0);
    float current_elev = (a_elev_1 - a_elev_0) * t + a_elev_0;
    if (current_elev > u_max_elev) {
      position = vec4(-1.,-1.,-1.,-1.);
    } else {
      position = u_map_matrix * ((a_coord_1 - a_coord_0) * t + a_coord_0);
    }
  }
  gl_Position = position;
  gl_PointSize = u_size;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.particleFragmentShader = `
/*precision mediump float;*/
varying float v_color;
vec4 unpackColor(float f) {
  vec4 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  color.a = 255.;
  return color / 256.0;
}
void main() {
  gl_FragColor = unpackColor(v_color);
}`;

WebGLVectorTile2Shaders.lineTrackVertexShader = `
attribute vec4 a_coord_0;
attribute float a_epoch_0;
attribute float a_epoch_1;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_epoch;
varying float v_color;
varying float v_alpha;
void main() {
  gl_Position = u_map_matrix * a_coord_0;
  v_alpha = smoothstep(a_epoch_0, a_epoch_1, u_epoch);
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.lineTrackFragmentShader = `
/*precision mediump float;*/
varying float v_color;
varying float v_alpha;
vec4 unpackColor(float f) {
    vec4 color;
    color.b = floor(f / 255.0 / 255.0);
    color.g = floor((f - color.b * 255.0 * 255.0) / 255.0);
    color.r = floor(f - color.b * 255.0 * 255.0 - color.g * 255.0);
    color.a = 255.;
    return color / 255.0;
  }
void main() {
  gl_FragColor = vec4(unpackColor(v_color).rgb, v_alpha);
}`;

WebGLVectorTile2Shaders.sitc4r2VertexShader = `
attribute vec4 a_p0;
attribute vec4 a_p2;
attribute vec4 a_p1;
attribute float a_epoch0;
attribute float a_epoch1;
uniform float u_epoch;
uniform mat4 u_map_matrix;
varying float v_t;
vec2 bezier(float t, vec2 p0, vec2 p1, vec2 p2) {
  return (1.0-t)*(1.0-t)*p0 + 2.0*(1.0-t)*t*p1 + t*t*p2;
}
void main() {
  vec4 position = vec4(-1,-1,-1,-1);
  if (a_epoch0 <= u_epoch && u_epoch <= a_epoch1) {
    float t = (u_epoch - a_epoch0)/(a_epoch1 - a_epoch0);
    vec2 pos = bezier(t, a_p0.xy, a_p1.xy, a_p2.xy);
    position = u_map_matrix * vec4(pos.x, pos.y, 0.0, 1.0);
    v_t = t;
  }
  gl_Position = position;
  gl_PointSize = 1.0;
}`;

WebGLVectorTile2Shaders.sitc4r2FragmentShader = `
/*precision mediump float;*/
varying float v_t;
uniform vec3 u_end_color;
void main() {
  vec4 colorStart = vec4(.94,.76,.61,1.0);
  vec4 colorEnd = vec4(u_end_color,1.0);
  gl_FragColor = mix(colorStart, colorEnd, v_t);
}`;

WebGLVectorTile2Shaders.sitc4r2WithAlphaAndColorMapVertexShader = `
attribute vec4 a_p0;
attribute vec4 a_p2;
attribute vec4 a_p1;
attribute float a_epoch0;
attribute float a_epoch1;
attribute float a_alpha;
uniform float u_epoch;
uniform mat4 u_map_matrix;
varying float v_t;
varying float v_alpha;
vec2 bezier(float t, vec2 p0, vec2 p1, vec2 p2) {
  return (1.0-t)*(1.0-t)*p0 + 2.0*(1.0-t)*t*p1 + t*t*p2;
}
void main() {
  vec4 position = vec4(-1,-1,-1,-1);
  if (a_epoch0 <= u_epoch && u_epoch <= a_epoch1) {
    float t = (u_epoch - a_epoch0)/(a_epoch1 - a_epoch0);
    vec2 pos = bezier(t, a_p0.xy, a_p1.xy, a_p2.xy);
    position = u_map_matrix * vec4(pos.x, pos.y, 0.0, 1.0);
    v_t = t;
  }
  gl_Position = position;
  gl_PointSize = 1.0;
  v_alpha = a_alpha;
}`;

WebGLVectorTile2Shaders.sitc4r2WithAlphaAndColorMapFragmentShader = `
/*precision mediump float;*/
varying float v_t;
varying float v_alpha;
uniform vec3 u_end_color;
uniform sampler2D u_Image;
void main() {
  vec4 colorStart = vec4(.94,.76,.61,v_alpha);
  vec4 colorEnd = vec4(u_end_color,v_alpha);
  vec4 color = texture2D(u_Image, vec2(v_t,0.));
  gl_FragColor = mix(colorStart, colorEnd, v_t);
  gl_FragColor = vec4(color.rgb, v_alpha);
}`

WebGLVectorTile2Shaders.basicVertexColorStartEpochEndEpochShader = `
attribute vec2 a_coord;
attribute float a_color;
attribute float a_start_epoch; /* inclusive */
attribute float a_end_epoch; /* exclusive */
uniform float u_size;
uniform mat4 u_map_matrix;
uniform float u_epoch;
varying float v_color;
void main() {
  if (a_start_epoch <= u_epoch && u_epoch < a_end_epoch) {
    gl_Position = vec4(a_coord.x * u_map_matrix[0][0] + u_map_matrix[3][0], a_coord.y * u_map_matrix[1][1] + u_map_matrix[3][1],0,1);
  } else {
    gl_Position = vec4(-1,-1,-1,-1);
  }
  gl_PointSize = u_size;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.basicVertexColorShader = `
attribute vec2 a_coord;
attribute float a_color;
uniform float u_size;
uniform mat4 u_map_matrix;
varying float v_color;
void main() {
  gl_Position = vec4(a_coord.x * u_map_matrix[0][0] + u_map_matrix[3][0], a_coord.y * u_map_matrix[1][1] + u_map_matrix[3][1],0,1);
  gl_PointSize = u_size;
  v_color = a_color;
}`;

WebGLVectorTile2Shaders.basicSquareFragmentShader = `
/*precision lowp float;*/
varying float v_color;
vec3 unpackColor(float f) {
  vec3 color;
  color.b = floor(f / 256.0 / 256.0);
  color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
  color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
  return color / 256.0;
}
void main() {
  gl_FragColor = vec4(unpackColor(v_color),1.0);
}`;


WebGLVectorTile2Shaders.WindVectorsShaders_drawVertexShader = `
/*precision mediump float;*/
attribute float a_index;
uniform sampler2D u_particles;
uniform float u_particles_res;
//uniform vec2 u_scale;
//uniform vec2 u_translate;
uniform mat4 u_transform;
varying vec2 v_particle_pos;
void main() {
    vec4 color = texture2D(u_particles, vec2(fract(a_index / u_particles_res), floor(a_index / u_particles_res) / u_particles_res));
    // decode current particle position from the pixel's RGBA value
    v_particle_pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
    gl_PointSize = 1.;
    //vec2 pos = vec2(u_scale.x*(v_particle_pos.x + u_translate.x), u_scale.y*(v_particle_pos.y + u_translate.y));
    gl_Position = u_transform * vec4(v_particle_pos.x, v_particle_pos.y, 0., 1.);
    //gl_Position = vec4(2.0 * pos.x - 1.0, 1.0 - 2.0 * pos.y, 0, 1);
    //gl_Position = vec4(2.0 * v_particle_pos.x - 1.0,
    //                   1.0 - 2.0 * v_particle_pos.y,
    //                   0, 1);
}`

WebGLVectorTile2Shaders.WindVectorsShaders_drawFragmentShader = `
/*precision mediump float;*/
uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;
varying vec2 v_particle_pos;
void main() {
    vec2 velocity = mix(u_wind_min, u_wind_max, texture2D(u_wind, v_particle_pos).rg);
    float speed_t = length(velocity) / length(u_wind_max);
    // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(
                        fract(16.0 * speed_t),
                        floor(16.0 * speed_t) / 16.0);
    gl_FragColor = texture2D(u_color_ramp, ramp_pos);
}`;

WebGLVectorTile2Shaders.WindVectorsShaders_quadVertexShader = `
/*precision mediump float;*/
attribute vec2 a_pos;
varying vec2 v_tex_pos;
//uniform vec2 u_scale;
//uniform vec2 u_translate;
void main() {
  v_tex_pos = a_pos;
  gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);
}`;


WebGLVectorTile2Shaders.WindVectorsShaders_screenFragmentShader = `
/*precision mediump float;*/
uniform sampler2D u_screen;
uniform float u_opacity;
varying vec2 v_tex_pos;
void main() {
    vec4 color = texture2D(u_screen, 1.0 - v_tex_pos);
    // a hack to guarantee opacity fade out even with a value close to 1.0
    gl_FragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);
    vec4 rgba = vec4(floor(255.0 * color * u_opacity) / 255.0);
    gl_FragColor = vec4(rgba);
    //gl_FragColor = vec4(192./256.,192./256.,192./256.,rgba.a);
}`;

WebGLVectorTile2Shaders.WindVectorsShaders_updateFragmentShader = `
/*precision highp float;*/
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec2 u_topLeftBound;
uniform vec2 u_bottomRightBound;
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;
varying vec2 v_tex_pos;
// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
        return fract(sin(t) * (rand_constants.z + t));
    }
    // wind speed lookup; use manual bilinear filtering based on 4 adjacent pixels for smooth interpolation
    vec2 lookup_wind(const vec2 uv) {
        // return texture2D(u_wind, uv).rg; // lower-res hardware filtering
        vec2 px = 1.0 / u_wind_res;
        vec2 vc = (floor(uv * u_wind_res)) * px;
        vec2 f = fract(uv * u_wind_res);
        vec2 tl = texture2D(u_wind, vc).rg;
        vec2 tr = texture2D(u_wind, vc + vec2(px.x, 0)).rg;
        vec2 bl = texture2D(u_wind, vc + vec2(0, px.y)).rg;
        vec2 br = texture2D(u_wind, vc + px).rg;
        return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
    }
    void main() {
        vec4 color = texture2D(u_particles, v_tex_pos);
        vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a); // decode particle position from pixel RGBA\n
        vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
        float speed_t = length(velocity) / length(u_wind_max);
        // take EPSG:4236 distortion into account for calculating where the particle moved
        float distortion = cos(radians(pos.y * 180.0 - 90.0));
        distortion = 1.0;
        vec2 offset = vec2(velocity.x / distortion, -velocity.y) * 0.0001 * u_speed_factor;
        // update particle position, wrapping around the date line
        pos = fract(1.0 + pos + offset);
        // a random seed to use for the particle drop
        vec2 seed = (pos + v_tex_pos) * u_rand_seed;
        // drop rate is a chance a particle will restart at random position, to avoid degeneration
        float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;
        //vec2 u_topLeftBound = vec2(0.1, 0.2); vec2 u_bottomRightBound = vec2(0.2, 0.4);
        vec2 in_bounds2 = step(u_topLeftBound, pos) * step(pos, u_bottomRightBound);
// out_of_bounds is 0 or 1
        float out_of_bounds = 1.0 - in_bounds2.x * in_bounds2.y;
// drop if 1.0 - drop_rate < rand(seed), or if out_of_bounds
        float drop = step(1.0 - drop_rate, rand(seed) + out_of_bounds);
        vec2 random_pos = mix(u_topLeftBound, u_bottomRightBound, vec2(rand(seed + 1.3), rand(seed + 2.1)));
        pos = mix(pos, random_pos, drop);
        // encode the new particle position back into RGBA
        gl_FragColor = vec4(fract(pos * 255.0), floor(pos * 255.0) / 255.0);
    }`

WebGLVectorTile2Shaders.WindVectorsShaders_mapVertexShader = `
attribute vec2 a_pos;
uniform mat4 u_transform;
varying vec2 v_tex_pos;
void main(void) {
  v_tex_pos = vec2(a_pos.x, a_pos.y);
  //gl_Position = vec4(2.0 * pos.x - 1.0, 1.0 - 2.0 * pos.y, 0, 1);
  gl_Position = u_transform * vec4(a_pos.x, a_pos.y, 0., 1.);
}`;

WebGLVectorTile2Shaders.WindVectorsShaders_mapFragmentShader = `
/*precision mediump float;*/
varying vec2 v_tex_pos;
uniform sampler2D u_wind;
void main(void) {
  vec4 textureColor = texture2D(u_wind, vec2(v_tex_pos.s, v_tex_pos.t));
  gl_FragColor = vec4(textureColor.rgb, 1.0);
}`;


WebGLVectorTile2Shaders.QuiverPolarCoordsVertexShader = `
attribute vec4 a_position;
attribute vec2 a_epochs;
attribute vec2 a_rads;
attribute vec2 a_speed;
attribute vec3 a_rgb;
uniform float u_PointSize;
varying float v_PointSize;
varying float v_rad;
varying float v_speed;
varying vec3 v_rgb;
uniform float u_epoch;
uniform mat4 u_transform;
void main() {
    vec4 position;
    float scale = 1.0;
    if (u_epoch < a_epochs.x || u_epoch > a_epochs.y) {
        position = vec4(-1.,-1.,-1.,-1.);
    } else {
        position = a_position;
        float a = smoothstep(a_epochs.x, a_epochs.y, u_epoch);
        vec2 u = a_speed[0] * vec2(cos(a_rads[0]), sin(a_rads[0]));
        vec2 v = a_speed[1] * vec2(cos(a_rads[1]), sin(a_rads[1]));
        vec2 uv = a * (v - u) + u;
        v_rad = atan(uv.y,uv.x);
        v_speed = sqrt(pow(uv.x,2.) + pow(uv.y,2.));
        v_rgb = a_rgb;
    }
    gl_Position = u_transform * position;
    v_PointSize  =  u_PointSize;
    gl_PointSize = u_PointSize;
}
`;

WebGLVectorTile2Shaders.QuiverPolarCoordsFragmentShader = `
/*precision mediump float;*/
varying float v_PointSize;
varying float v_rad;
varying float v_speed;
uniform float u_time;
varying vec3  v_rgb;
// 2D vector field visualization by Morgan McGuire, @morgan3d, http://casual-effects.com
const float PI = 3.1415927;

// How sharp should the arrow head be? Used
const float ARROW_HEAD_ANGLE = 45.0 * PI / 180.0;

// Used for ARROW_LINE_STYLE
const float ARROW_SHAFT_THICKNESS = 6.0;

float arrowHeadLength(float arrowTileSize) {
    return arrowTileSize / 6.0;
}
// Computes the center pixel of the tile containing pixel pos
vec2 arrowTileCenterCoord(vec2 pos, float arrowTileSize) {
    return (floor(pos / arrowTileSize) + 0.5) * arrowTileSize;
}

// v = field sampled at tileCenterCoord(p), scaled by the length
// desired in pixels for arrows
// Returns 1.0 where there is an arrow pixel.
float arrow(vec2 p, vec2 v, float arrowTileSize) {
    // Make everything relative to the center, which may be fractional
    p -= arrowTileCenterCoord(p, arrowTileSize);

    float mag_v = length(v), mag_p = length(p);

    if (mag_v > 0.0) {
        // Non-zero velocity case
        vec2 dir_p = p / mag_p, dir_v = v / mag_v;

        // We can't draw arrows larger than the tile radius, so clamp magnitude.
        // Enforce a minimum length to help see direction
        mag_v = clamp(mag_v, 5.0, arrowTileSize / 2.0);

        // Arrow tip location
        v = dir_v * mag_v;

        // Define a 2D implicit surface so that the arrow is antialiased.
        // In each line, the left expression defines a shape and the right controls
        // how quickly it fades in or out.

        float dist;
        // Signed distance from a line segment based on https://www.shadertoy.com/view/ls2GWG by
        // Matthias Reitinger, @mreitinger

        // Line arrow style
        dist =
            max(
                // Shaft
                ARROW_SHAFT_THICKNESS / 4.0 -
                    max(abs(dot(p, vec2(dir_v.y, -dir_v.x))), // Width
                        abs(dot(p, dir_v)) - mag_v + arrowHeadLength(arrowTileSize) / 2.0), // Length

                // Arrow head
                min(0.0, dot(v - p, dir_v) - cos(ARROW_HEAD_ANGLE / 2.0) * length(v - p)) * 2.0 + // Front sides
                min(0.0, dot(p, dir_v) + arrowHeadLength(arrowTileSize) - mag_v)); // Back

        return clamp(1.0 + dist, 0.0, 1.0);
    } else {
        // Center of the pixel is always on the arrow
        return max(0.0, 1.2 - mag_p);
    }
}

void main() {
    vec2 p = gl_PointCoord.xy;
    p = v_PointSize*p;
    float rad = v_rad - PI/2.0;
    float x = v_PointSize * cos(rad) * 0.5 * v_speed;
    float y = v_PointSize * sin(rad) * 0.5 * v_speed;
    float d = arrow(p, vec2(x, y), v_PointSize);
    gl_FragColor = vec4(vec3(d)*v_rgb,d);
}
`;

WebGLVectorTile2Shaders.particleAltFadeVertexShader = `
attribute vec4 a_coord_0;
attribute float a_elev_0;
attribute float a_epoch_0;
attribute vec4 a_coord_1;
attribute float a_elev_1;
attribute float a_epoch_1;
attribute float a_color;
uniform mat4 u_map_matrix;
uniform float u_epoch;
uniform float u_size;
uniform float u_max_elev;
varying vec4 v_color;
vec4 unpackColor(float f) {
    vec4 color;
    color.b = floor(f / 256.0 / 256.0);
    color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
    color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
    color.a = 255.;
    return color / 256.0;
}
void main() {
    vec4 position;
    v_color = unpackColor(a_color);
    if (a_epoch_0 >= u_epoch || a_epoch_1 < u_epoch) {
        position = vec4(-1.,-1.,-1.,-1.);
    } else {
        float t = (u_epoch - a_epoch_0)/(a_epoch_1 - a_epoch_0);
        float min_elev = u_max_elev * 0.4;
        float current_elev = (a_elev_1 - a_elev_0) * t + a_elev_0;
        position = u_map_matrix * ((a_coord_1 - a_coord_0) * t + a_coord_0);
        v_color.a = min(max((u_max_elev-current_elev)/(u_max_elev-min_elev), 0.), 1.);
    }
    gl_Position = position;
    gl_PointSize = u_size;
}
`;

WebGLVectorTile2Shaders.particleAltFadeFragmentShader = `
/*precision mediump float;*/
varying vec4 v_color;
void main() {
  gl_FragColor = v_color;
}
`;

WebGLVectorTile2Shaders.markerVertexShader = `
const float SQRT_2 = 1.4142135623730951;
uniform mat4 ortho;
uniform float size, orientation, linewidth, antialias;
attribute vec3 position;
attribute vec4 fill;
attribute vec4 stroke;
varying vec2 rotation;
varying float v_size;
varying vec4 fg_color, bg_color;
void main (void) {
  rotation = vec2(cos(orientation), sin(orientation));
  gl_Position = ortho * vec4(position, 1.0);
  v_size = SQRT_2 * size + 2.0*(linewidth + 1.5*antialias);
  gl_PointSize = v_size;
  fg_color = vec4(stroke.xyz/255.,stroke.w);
  bg_color = vec4(fill.xyz/255.,fill.w);
}
`;

WebGLVectorTile2Shaders.markerFragmentShader = `
const float PI = 3.14159265358979323846264;
const float SQRT_2 = 1.4142135623730951;
uniform float size, linewidth, antialias;
varying vec4 fg_color, bg_color;
varying vec2 rotation;
varying float v_size;

vec4 stroke(float distance, // Signed distance to line
            float linewidth, // Stroke line width
            float antialias, // Stroke antialiased area
            vec4 stroke) // Stroke color
{
  float t = linewidth / 2.0 - antialias;
  float signed_distance = distance;
  float border_distance = abs(signed_distance) - t;
  float alpha = border_distance / antialias;
  alpha = exp(-alpha * alpha);
  if( border_distance < 0.0 )
    return stroke;
  else
    return vec4(stroke.rgb, stroke.a * alpha);
}

vec4 filled(float distance, // Signed distance to line
            float linewidth, // Stroke line width
            float antialias, // Stroke antialiased area
            vec4 fill) // Fill color
{
  float t = linewidth / 2.0 - antialias;
  float signed_distance = distance;
  float border_distance = abs(signed_distance) - t;
  float alpha = border_distance / antialias;
  alpha = exp(-alpha * alpha);
  if( border_distance < 0.0 )
    return fill;
  else if( signed_distance < 0.0 )
    return fill;
  else
    return vec4(fill.rgb, alpha * fill.a);
}

vec4 outline(float distance, // Signed distance to line
             float linewidth, // Stroke line width
             float antialias, // Stroke antialiased area
             vec4 stroke, // Stroke color
             vec4 fill)   // Fill color 
             {
  float t = linewidth / 2.0 - antialias;
  float signed_distance = distance;
  float border_distance = abs(signed_distance) - t;
  float alpha = border_distance / antialias;
  alpha = exp(-alpha * alpha);
  if( border_distance < 0.0 )
    return stroke;
  else if( signed_distance < 0.0 )
    return mix(fill, stroke, sqrt(alpha));
  else
    return vec4(stroke.rgb, stroke.a * alpha);
}

float diamond(vec2 P, float size)
{
float x = SQRT_2/2.0 * (P.x - P.y);
float y = SQRT_2/2.0 * (P.x + P.y);
return max(abs(x), abs(y)) - size/(2.0*SQRT_2);
}

void main() {
  vec2 P = gl_PointCoord.xy - vec2(0.5,0.5);
  P = vec2(rotation.x*P.x - rotation.y*P.y,
  rotation.y*P.x + rotation.x*P.y);
//  float distance = marker(P*v_size, size);
  float distance = diamond(P*v_size, size);
  gl_FragColor = outline(distance, linewidth, antialias, fg_color, bg_color);
}
`;