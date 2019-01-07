var CsvFileLayer = function CsvFileLayer() {
  this.layers = [];
  this.layerById = {};
  this.dataLoadedListeners = [];
  this.layersLoadedListeners = [];
  this.layersData = {};

  this.formatValue = function(value) {
    var absValue = Math.abs(value);
    var suffix = '';
    if (absValue < 1000) {
        value = value;
    }
    else if (absValue < 1000000) {
        value = value / 1000;
        suffix = "K";
    }
    else if (absValue < 1000000000 && (absValue / 1000000) != 1000) {
        value = value / 1000000;
        suffix = "M";
    }
    else if (absValue < 1000000000000 && (absValue / 1000000000) != 1000) {
        value = value / 1000000000;
        suffix = "G";
    }
    else if (absValue < 1000000000000000 && (absValue / 1000000000000) != 1000) {
        value = value / 1000000000000;
        suffix = "T";
    }
    else {
        value = value / 1000000000000000;
        suffix = "P";
    }

    var valueStr = value.toFixed(2);
    var find = '\\.?0+$';
    var re = new RegExp(find, 'g');
    valueStr = valueStr.replace(re, '') + suffix;
    return valueStr;
  }
}

CsvFileLayer.prototype.lookupFunctionFromTable = function (functionName, lookupTable) {
  if (functionName.trim() in lookupTable) {
    return lookupTable[functionName.trim()];
  } else {
    console.log("ERROR: CsvFileLayer.prototype.lookupFunctionFromTable");
    console.log("       " + functionName + " not in lookupTable");
    return undefined;
  }
}

CsvFileLayer.prototype.addExtrasContent = function addExtrasContent(layerDef) {
  var playbackRate = layerDef["Playback Rate"].trim() == '' ? 0 : layerDef["Playback Rate"].trim();
  var dataType = layerDef["Map Type"].split("-")[1];
  var dataFilePath = layerDef["URL"];
  var shareLinkIdentifier = layerDef["Share link identifier"].replace(/\W+/g, '_');
  var dataName = layerDef["Name"];
  var str = '<option data-playback-rate="' + playbackRate + '"';
  str += ' data-type="' + dataType + '"';
  str += ' data-file-path="' + dataFilePath +'"';
  str += ' data-name="' + shareLinkIdentifier + '"';
  str += '>' + dataName + '</option>';

  $('#extras-selector').append(str);

}


CsvFileLayer.prototype.addLayer = function addLayer(layerDef) {
  // (someday) Use csv.createlab.org as translation gateway
  // url = 'http://csv.createlab.org/' + url.replace(/^https?:\/\//,'')

  var layerOptions = {
    tileWidth: 256,
    tileHeight: 256,
    loadDataFunction: WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv,
    dataLoadedFunction: this.dataLoadedFromCsv.bind(this),
    drawFunction: WebGLVectorTile2.prototype._drawBubbleMap,
    fragmentShader: WebGLVectorTile2.bubbleMapFragmentShader,
    vertexShader: WebGLVectorTile2.bubbleMapVertexShader,
    numAttributes: 6,
    layerDef: layerDef
  };

  layerOptions.layerId = layerDef["Share link identifier"].replace(/\W+/g, '_');
  layerOptions.category = layerDef["Category"];

  layerOptions.showGraph = layerDef["Show Graph"].toLowerCase() == 'true';
  layerOptions.mapType = layerDef["Map Type"] || "bubble";
  layerOptions.color = layerDef["Color"] ? JSON.parse(layerDef["Color"]) : null;

  layerOptions.legendContent = layerDef["Legend Content"];
  layerOptions.legendKey = layerDef["Legend Key"];

  var url;
  var useLocalData = false;
  var relativeLocalDataPath;
  if (EARTH_TIMELAPSE_CONFIG.localCsvLayers) {
    for (var i = 0; i < EARTH_TIMELAPSE_CONFIG.localCsvLayers.length; i++) {
      relativeLocalDataPath = EARTH_TIMELAPSE_CONFIG.localCsvLayers[i];
      var tmp = relativeLocalDataPath.split("/");
      // Remove file extension if present
      // Remove the z/x/y path if present
      var idFromRelativePath = tmp[tmp.length - 1].replace(/\.[^/.]+$/, "").replace(/\/{z}|\/{x}|\/{y}/g,"");
      if (layerOptions.layerId == idFromRelativePath) {
        useLocalData = true;
        break;
      }
    }
  }

  if (useLocalData) {
    url = tileUrl = getRootTilePath() + relativeLocalDataPath;
  } else {
    url = layerDef["URL"].replace("http://", "https://");
  }

  layerOptions.name = layerDef["Name"];
  layerOptions.credit = layerDef["Credits"];

  layerOptions.scalingFunction = layerDef["Scaling"] || 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])';
  layerOptions.colorScalingFunction = layerDef["Color Scaling"] || 'd3.scaleLinear().domain([minColorValue, maxColorValue]).range([0, 1])';

  layerOptions.externalGeojson = layerDef["External GeoJSON"];
  layerOptions.nameKey = layerDef["Name Key"]; // Optional GeoJSON property name with which to join features with first column of data
  var category_id = layerOptions.category ? "category-" + layerOptions.category.replace(/ /g,"-").toLowerCase() : "csvlayers_table";
  layerOptions.playbackRate = layerDef["Playback Rate"] || null;
  layerOptions.masterPlaybackRate = layerDef["Master Playback Rate"] || null;
  layerOptions.nLevels = layerDef["Number of Levels"] ? parseInt(layerDef["Number of Levels"]) : 0;
  layerOptions.imageSrc = layerDef["Colormap Src"] || null;

  function overrideDrawingFns() {
    if (layerDef["Draw Function"]) {
      layerOptions.drawFunction = eval(layerDef["Draw Function"]);
    }
    if (layerDef["Number of Attributes"]) {
      layerOptions.numAttributes = parseInt(layerDef["Number of Attributes"]);
    }
    if (layerDef["Vertex Shader"]) {
      layerOptions.vertexShader = eval(layerDef["Vertex Shader"]);
    }
    if (layerDef["Fragment Shader"]) {
      layerOptions.fragmentShader = eval(layerDef["Fragment Shader"]);
    }
  }

  // By default, most CSV layers draw at z=400.  Raster and choropleths by default will draw at z=200.
  layerOptions.z = 400;
  var WebglLayer = WebglVectorLayer2;

  if (layerOptions.mapType == 'raster') {
    layerOptions.z = 200;
    WebglLayer = WebglMapLayer;
    url = eval(url);
    layerOptions.fragmentShader = null;
    layerOptions.vertexShader = null;
    layerOptions.drawFunction = null;
    layerOptions.loadDataFunction = null;
  } else if (layerOptions.mapType == "choropleth") {
    layerOptions.imageSrc = layerOptions.imageSrc || "obesity-color-map.png";
    layerOptions.z = 200;
    layerOptions.loadDataFunction = WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv;
    layerOptions.drawFunction = WebGLVectorTile2.prototype._drawChoroplethMap;
    layerOptions.fragmentShader = WebGLVectorTile2.choroplethMapFragmentShader;
    layerOptions.vertexShader = WebGLVectorTile2.choroplethMapVertexShader;
  } else if (layerOptions.mapType == "point-flow") {
    layerOptions.loadDataFunction = WebGLVectorTile2.prototype._loadData;
    overrideDrawingFns();
  } else {
    if (layerDef["Load Data Function"]) {
      layerOptions.loadDataFunction = this.lookupFunctionFromTable(layerDef["Load Data Function"], LOAD_DATA_FUNCTION_LOOKUP_TABLE);
    }
    if (layerDef["Set Data Function"]) {
      layerOptions.setDataFunction = this.lookupFunctionFromTable(layerDef["Set Data Function"], SET_DATA_FUNCTION_LOOKUP_TABLE);
    }
    overrideDrawingFns();
  }

  var layer = new WebglLayer(glb, canvasLayer, url, layerOptions);
  layer.options = layer.options || {};
  if (layerOptions.color) {
    layer.options.color = layerOptions.color;
  }
  // Comparison-mode, left and right half-circles
  var re = /_paired/;
  var m = layerOptions.layerId.match(re)
  if (m) {
    layer.paired = true;
  } else {
    layer.paired = false;
  }

  this.layers.push(layer);
  this.layerById[layer.layerId] = layer;

  var id = 'show-csv-' + layerOptions.layerId;
  var row = '<tr class="csvlayer"><td><label name="' + layerOptions.layerId + '">';
  row += '<input type="checkbox" id="' + id + '">';
  row += layerOptions.name;
  row += '</label></td></tr>';

  // Default category
  if (category_id == "category-other") {
    category_id = "csvlayers_table";
  }
  if ($('#' + category_id).length == 0) {
    $(".map-layer-div #category-other").prev("h3").before("<h3>" + layerOptions.category + "</h3><table id='" + category_id + "'></table>");
  }

  $('#' + category_id).append(row);

  // Handle click event to turn on and off layer
  $('#' + id).on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      // Turn on layer
      layer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      // TODO: Should not force dark map for every csv layer
      if (visibleBaseMapLayer != "dark") {
        $("#layers-list #dark-base").click();
      }
      if (layer.mapType != "raster" &&
          (layer.layerDef["Start date"] == "" && layer.layerDef["End date"] == "") ||
          (layer.layerDef["Start date"] != "" && layer.layerDef["Start date"] != layer.layerDef["End date"])) {
        setActiveLayersWithTimeline(1);
        timelineType = "defaultUI";
        requestNewTimeline(layer.layerId + ".json", timelineType);
      }
      layer.visible = true;
      $("#" + layer.layerId + "-legend").show();
      if (layer.mapType == "choropleth") {
        showCountryLabelMapLayer = false;
      }
      if (layer.masterPlaybackRate && layer.playbackRate) {
        timelapse.setMasterPlaybackRate(layer.masterPlaybackRate);
        timelapse.setPlaybackRate(layer.playbackRate);
      }
    } else {
      $("#" + layer.layerId + "-legend").hide();
      if (layer.mapType != "raster") {
        setActiveLayersWithTimeline(-1);
        doSwitchToLandsat();
      }
      // Turn off layer
      layer.visible = false;
      // cacheLastUsedLayer is a global data struct from index.html
      cacheLastUsedLayer(layer);
      if (layer.mapType == "choropleth") {
        showCountryLabelMapLayer = false;
      }
      if (layer.masterPlaybackRate && layer.playbackRate) {
        timelapse.setMasterPlaybackRate(1);
        timelapse.setPlaybackRate(defaultPlaybackSpeed);
        //timelapse.setMaxScale(landsatMaxScale);
      }
    }
  }).prop('checked', layer.visible);

  return layer;
}


CsvFileLayer.prototype.addDataLoadedListener = function addDataLoadedListener(listener) {
  if (typeof(listener) === "function") {
    this.dataLoadedListeners.push(listener);
  }
};


CsvFileLayer.prototype.removeDataLoadedListener = function removeDataLoadedListener(listener) {
  for (var i = 0; i < this.dataLoadedListeners.length; i++) {
    if (this.dataLoadedListeners[i] == listener) {
      this.dataLoadedListeners.splice(i, 1);
      break;
    }
  }
};


CsvFileLayer.prototype.addLayersLoadedListener = function addLayersLoadedListener(listener) {
  if (typeof(listener) === "function") {
    this.layersLoadedListeners.push(listener);
  }
};


CsvFileLayer.prototype.removeLayersLoadedListener = function removeLayersLoadedListener(listener) {
  for (var i = 0; i < this.layersLoadedListeners.length; i++) {
    if (this.layersLoadedListeners[i] == listener) {
      this.layersLoadedListeners.splice(i, 1);
      break;
    }
  }
};


CsvFileLayer.prototype.dataLoadedFromCsv = function dataLoadedFromCsv(layerId) {
  for (var i = 0; i < this.dataLoadedListeners.length; i++) {
    this.dataLoadedListeners[i](layerId);
  }
};


CsvFileLayer.prototype.loadLayersFromTsv = function loadLayersFromTsv(layerDefinitions) {
  this.layersData = Papa.parse(layerDefinitions, {delimiter: "\t", header: true});

  for (var i =  0; i < this.layersData.data.length; i++) {
    var layerDef = this.layersData.data[i];
    // Trim whitespace for all fields
    for (var key in layerDef) {
      if (layerDef.hasOwnProperty(key)) layerDef[key] = layerDef[key].trim();
    }

    if (layerDef["Enabled"].toLowerCase() != "true") continue;

    if (layerDef["Map Type"].split("-")[0] == "extras") {
      this.addExtrasContent(layerDef);
    } else {
      var layer = this.addLayer(layerDef);
      if (layer.mapType == 'raster') {
        this.setLegend(layer.layerId);
      }
      this.setTimeLine(layer.layerId,
           layerDef["Start date"],
           layerDef["End date"],
           layerDef["Step"]);

    }
  }
  for (var i = 0; i < this.layersLoadedListeners.length; i++) {
    this.layersLoadedListeners[i]();
  }
};

CsvFileLayer.prototype.loadLayers = function loadLayers(path) {
  if (path == csvlayersLoadedPath) return;
  csvlayersLoadedPath = path;
  var url = path;

  var that = this;

  // Clear out any csv layers that have already been loaded
  $("#csvlayers_table, .csvlayer").find("input:checked").trigger("click");
  $(".csvlayer").remove();
  $("#csvlayers_table").empty();
  that.layers = [];

  if (path.indexOf(".tsv") != -1) {
    // Load local version of the csv .tsv file
    $.ajax({
      url: path,
      dataType: "text",
      success: function(tsvdata) {
        that.loadLayersFromTsv(tsvdata);
      }
    });
    return;
  } else if (path.indexOf("http") != 0) {
    var docId = path.split('.')[0];
    var tabId = path.split('.')[1];
    url = 'https://docs.google.com/spreadsheets/d/' + docId + '/edit';
    if (tabId) {
      url += '#gid=' + tabId;
    }
  }
  org.gigapan.Util.gdocToJSON(url, function(tsvdata) {
    that.loadLayersFromTsv(tsvdata);
  });
};


CsvFileLayer.prototype.setDateStr = function setDateStr(yearStr, monthStr, dayStr, hourStr, minuteStr) {
  var out = '';
  if (typeof yearStr !== "undefined") {
    out += yearStr;
  } else {
    return null;
  }

  if (typeof monthStr !== "undefined") {
    out += '-' + monthStr;
  } else {
    return out;
  }

  if (typeof dayStr !== "undefined") {
    out += '-' + dayStr;
  } else {
    return out;
  }

  if (typeof hourStr !== "undefined") {
    out += ' ' + hourStr;
  } else {
    return out;
  }

  if (typeof minuteStr !== "undefined") {
    out += ':' + minuteStr;
    return out;
  } else {
    out += ':00';
    return out;
  }

}

CsvFileLayer.prototype.setTimeLine = function setTimeLine(identifier, startDate, endDate, step) {
  var captureTimes = [];

  var yyyymmddhhmm_re = /(\d{4})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/;
  var sm = startDate.match(yyyymmddhhmm_re);
  var em = endDate.match(yyyymmddhhmm_re);
  if (sm && em) { // both dates parsed
    var startYear = sm[1];
    var startMonth = sm[2];
    var startDay = sm[3];
    var startHour = sm[4];
    var startMinute = sm[5];
    var endYear = em[1];
    var endMonth = em[2];
    var endDay = em[3];
    var endHour = sm[4];
    var endMinute = sm[5];
    startYear = parseInt(startYear, 10);
    startMonth = parseInt(startMonth, 10);
    endYear = parseInt(endYear, 10);
    endMonth = parseInt(endMonth, 10);

    if (isNaN(startYear) || isNaN(endYear) || isNaN(startMonth) || isNaN(endMonth) ) {
      console.log('ERROR: CsvFileLayer.prototype.setTimeLine unable to parse startDate or endDate');
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    } else {
      if (typeof startDay != "undefined" && typeof endDay != "undefined") {
        function pad(n) {
          return (n < 10) ? ("0" + n) : n;
        }

        var mDateStr = this.setDateStr(startYear, startMonth, startDay, startHour, startMinute);
        var nDateStr = this.setDateStr(endYear, endMonth, endDay, endHour, endMinute);

        var m = new Date(mDateStr);
        var n = new Date(nDateStr);
        var tomorrow = m;
        //tomorrow.setDate(tomorrow.getDate() + 1);
        while (tomorrow.getTime() <= n.getTime()) {
          var captureTimeStr = tomorrow.getUTCFullYear() + '-' + pad((tomorrow.getUTCMonth() + 1).toString()) + '-' + pad(tomorrow.getUTCDate().toString());
          if (typeof startHour != "undefined") {
            captureTimeStr += ' ' + pad(tomorrow.getUTCHours());
            if (typeof startMinute != "undefined") {
              captureTimeStr += ':' + pad(tomorrow.getUTCMinutes());
            } else {
              captureTimeStr += ':' + '00';
            }
          }
          captureTimes.push(captureTimeStr);
          if (typeof startMinute != "undefined") {
            tomorrow.setUTCMinutes(tomorrow.getUTCMinutes() + parseInt(step));
          } else if (typeof startHour != "undefined") {
            tomorrow.setUTCHours(tomorrow.getUTCHours() + parseInt(step));
          } else {
            tomorrow.setUTCDate(tomorrow.getUTCDate() + parseInt(step));
          }
        }
      } else { // generate yyyy-mm
        function pad(n) {
          return (n < 10) ? ("0" + n) : n;
        }
        for (var i = startYear; i <= endYear; i++) {
          var beginMonth = 1;
          var stopMonth = 12;
          if (i == startYear) {
            beginMonth = startMonth;
          }
          if (i == endYear) {
            stopMonth = endMonth;
          }
          for (var j = beginMonth; j <= stopMonth; j++) {
            captureTimes.push(pad(i.toString()) + "-" + pad(j.toString()));
          }
        }
      }
    }
  } else  { // geenrate yyyy
    startDate = parseInt(startDate,10);
    endDate = parseInt(endDate,10);
    step = parseInt(step,10);
    if (isNaN(startDate) || isNaN(endDate) || isNaN(step) ) {
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    } else {
      for (var i = startDate; i < endDate + 1; i+=step) {
        captureTimes.push(i.toString());
      }
    }
  }
  cached_ajax[identifier + '.json'] = {"capture-times":  captureTimes};
};

CsvFileLayer.prototype.setLegend = function setLegend(id) {
  var layer;
  for (var i = 0; i < this.layers.length; i++) {
    if (this.layers[i].layerId == id) {
      layer = this.layers[i];
      break;
    }
  }
  if (typeof layer != 'undefined') {
    if (layer.mapType == 'bubble') {
      if (layer.legendContent == 'auto') {
        var radius = layer['_tileView']['_tiles']['000000000000000']['_radius'];
        var opts = {
          'id' : id,
          'title': layer.name,
          'credit': layer.credit,
          'keys': [],
          'circles': [{'value': this.formatValue(radius.invert(50.0)), 'radius': '25.0'},{'value': this.formatValue(radius.invert(80.0)), 'radius': '40.0'},{'value': this.formatValue(radius.invert(100.0)), 'radius': '50.0'}]
        };
        if (layer.legendKey) {
          var rgba = layer.color.map(function(x) {
            return Math.floor(x * 255.);
          });
          opts.keys.push({'color': 'rgb('+ rgba[0] +',' + rgba[1] +',' + rgba[2] + ')', 'str': layer.legendKey});
        }
        var legend = new BubbleMapLegend(opts);
        $('#legend-content table tr:last').after(legend.toString());
        $("#" + id + "-legend").show();
      } else {
        var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
        var str = div + layer.legendContent;
        var opts = {
          'id' : id,
          'str': str
        }
        var legend = new BubbleMapLegend(opts);
        $('#legend-content table tr:last').after(legend.toString());
        $("#" + id + "-legend").show();

      }

    } else if (layer.mapType == 'choropleth') { // Assume choropleth
      if (layer.legendContent == 'auto') {
        var radius = this.layers[i]['_tileView']['_tiles']['000000000000000']['_radius'];
        var opts = {
            'id': id,
            'title': layer.name,
            'credit': layer.credit,
            'keys': [],
            'colors': ["#ffffff", "#fff18e", "#ffdc5b", "#ffc539", "#ffad21", "#ff920c", "#ff7500", "#ff5000", "#ff0000"],
            'values': [this.formatValue(radius.invert(0)), this.formatValue(radius.invert(0.5)), this.formatValue(radius.invert(1))],
            'colorMap': layer.imageSrc
        }
        if (layer.legendKey) {
          opts.keys.push({'str': layer.legendKey});
        }

        var legend = new ChoroplethLegend(opts)
        $('#legend-content table tr:last').after(legend.toString());
        $("#" + id + "-legend").show();
      } else {
        var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
        var str = div + layer.legendContent;
        var opts = {
          'id' : id,
          'str': str
        }
        var legend = new ChoroplethLegend(opts);
        $('#legend-content table tr:last').after(legend.toString());
        $("#" + id + "-legend").show();

      }
    } else {
        var str = '';
        if (layer.legendContent == '') {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          str = div;
        } else {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          str = div + layer.legendContent;
        }
        var opts = {
          'id' : id,
          'str': str
        }
        var legend = new Legend(id, str);
        $('#legend-content table tr:last').after(legend.toString());
        if (layer.mapType != 'raster') {
          $("#" + id + "-legend").show();
        }
    }
  }
}

var COUNTRY_POLYGONS = null;
var xhr = new XMLHttpRequest();
xhr.open('GET', "country_polygons.geojson");
xhr.onload = function() {
    COUNTRY_POLYGONS = JSON.parse(this.responseText);
}
xhr.send();


function searchCountryList(feature_collection, name, name_key) {
  if (typeof feature_collection["hash"] !== "undefined") {
    return feature_collection["features"][feature_collection["hash"][name]];
  }
  for (var i = 0; i < feature_collection['features'].length; i++) {
    var feature = feature_collection['features'][i];
    if (typeof name_key != "undefined") {
        if (name == feature["properties"][name_key]) {
          return feature;
        }
    } else {
      var names = feature['properties']['names'];
      if (typeof names == "undefined") {
        if (name == feature["properties"]["GEOID10"]) {
          return feature;
        }
      } else {
        for (var j = 0; j < names.length; j++) {
          if (name == names[j]) {
            //return feature['properties']['webmercator'];
            return feature;
          }
        }
      }
    }
  }
  return {};
};

const LOAD_DATA_FUNCTION_LOOKUP_TABLE = {
  "WebGLVectorTile2.prototype._loadData": WebGLVectorTile2.prototype._loadData,
  "WebGLVectorTile2.prototype._loadGeojsonData": WebGLVectorTile2.prototype._loadGeojsonData,
  "WebGLVectorTile2.prototype._loadSitc4r2Data": WebGLVectorTile2.prototype._loadSitc4r2Data,
  "WebGLVectorTile.prototype._loadSitc4r2Data": WebGLVectorTile2.prototype._loadSitc4r2Data, // Supporting typos 4evah
  "WebGLVectorTile2.prototype._loadCarbonPriceRiskDataFromCsv": WebGLVectorTile2.prototype._loadCarbonPriceRiskDataFromCsv,
  "WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv": WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv,
  "WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv": WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv,
  "WebGLVectorTile2.prototype._loadBivalentBubbleMapDataFromCsv": WebGLVectorTile2.prototype._loadBivalentBubbleMapDataFromCsv,
  "WebGLVectorTile2.prototype._loadBivalentBubbleMapDataFromCsv": WebGLVectorTile2.prototype._loadBivalentBubbleMapDataFromCsv,
  "WebGLVectorTile2.prototype._loadWindVectorsData": WebGLVectorTile2.prototype._loadWindVectorsData
};

const SET_DATA_FUNCTION_LOOKUP_TABLE = {
  "WebGLVectorTile2.prototype._setSitc4r2Buffer": WebGLVectorTile2.prototype._setSitc4r2Buffer,
  "WebGLVectorTile2.prototype._setPolygonData": WebGLVectorTile2.prototype._setPolygonData,
  "WebGLVectorTile2.prototype._setPointData": WebGLVectorTile2.prototype._setPointData,
  "WebGLVectorTile2.prototype._setLineStringData": WebGLVectorTile2.prototype._setLineStringData,
  "WebGLVectorTile2.prototype._setExpandedLineStringData": WebGLVectorTile2.prototype._setExpandedLineStringData,
  "WebGLVectorTile2.prototype._setIomIdpData": WebGLVectorTile2.prototype._setIomIdpData,
  "WebGLVectorTile2.prototype._setColorDotmapData": WebGLVectorTile2.prototype._setColorDotmapData,
  "WebGLVectorTile2.prototype._setObesityData": WebGLVectorTile2.prototype._setObesityData,
  "WebGLVectorTile2.prototype._setVaccineConfidenceData": WebGLVectorTile2.prototype._setVaccineConfidenceData,
  "WebGLVectorTile2.prototype._setBufferData": WebGLVectorTile2.prototype._setBufferData,
  "WebGLVectorTile2.prototype._setBuffers": WebGLVectorTile2.prototype._setBuffers,
  "WebGLVectorTile2.prototype._setWindVectorsData": WebGLVectorTile2.prototype._setWindVectorsData
}
