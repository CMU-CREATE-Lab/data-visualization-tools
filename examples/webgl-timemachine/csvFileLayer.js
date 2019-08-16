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
  var playbackRate = layerDef["Playback Rate"].trim() == '' ? 1 : layerDef["Playback Rate"].trim();
  var dataType = layerDef["Map Type"].split("-")[1];
  var dataFilePath = layerDef["URL"];
  var shareLinkIdentifier = layerDef["Share link identifier"].replace(/\W+/g, '_');
  var dataName = layerDef["Name"];
  var extrasOptions = {};
  if (typeof layerDef["Extras Options"] != "undefined" && layerDef["Extras Options"] != "") {
    extrasOptions = JSON.parse(layerDef["Extras Options"]);
  }

  var str = '<option data-playback-rate="' + playbackRate + '"';
  str += ' data-type="' + dataType + '"';
  str += ' data-file-path="' + dataFilePath +'"';
  str += ' data-name="' + shareLinkIdentifier + '"';
  if (extrasOptions.loop) {
    str += ' data-loop="' + extrasOptions.loop + '"';
  }
  if (extrasOptions.muted) {
    str += ' data-muted="' + extrasOptions.mute + '"';
  }
  if (extrasOptions['object-fit']) {
    str += ' data-objectfit="' + extrasOptions['object-fit'] + '"';
  }
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

  layerOptions.customSliderInfo = {};
  if (layerDef["Custom slider ticks"]) {
    try {
      var rawCustomSliderInfo = JSON.parse(layerDef["Custom slider ticks"].trim());
      for (var i = 0; i < rawCustomSliderInfo.length; i++) {
        layerOptions.customSliderInfo[rawCustomSliderInfo[i][0]] = rawCustomSliderInfo[i][1];
      }
    } catch(e) {
      console.log("ERROR: Cannot parse 'Custom slider ticks'. Is valid json being used there?");
    }
  }

  if (layerDef["Start date"] != "" && layerDef["Start date"] != layerDef["End date"] || !$.isEmptyObject(layerOptions.customSliderInfo)) {
    layerOptions.hasTimeline = true;
  } else {
    layerOptions.hasTimeline = false;
  }
  layerOptions.startDate = layerDef["Start date"];
  layerOptions.endDate = layerDef["End date"];

  layerOptions.showGraph = layerDef["Show Graph"].toLowerCase() == 'true';
  layerOptions.mapType = layerDef["Map Type"] || "bubble";
  layerOptions.color = layerDef["Color"] ? JSON.parse(layerDef["Color"]) : null;

  layerOptions.legendContent = layerDef["Legend Content"];
  layerOptions.legendKey = layerDef["Legend Key"];

  if (typeof layerDef["Draw Options"] != "undefined" && layerDef["Draw Options"] != "") {
    layerOptions.drawOptions = JSON.parse(layerDef["Draw Options"]);
  }

  if (typeof layerDef["Set Data Options"] != "undefined" && layerDef["Set Data Options"] != "") {
    layerOptions.setDataOptions = JSON.parse(layerDef["Set Data Options"]);
  }

  var url;
  var useLocalData = false;
  var relativeLocalDataPath;

  // TODO: Maybe deprecate this?
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

  if (EARTH_TIMELAPSE_CONFIG.useCsvLayersLocally) {
    // TODO: Right now we only handle local storage of data that was stored at tiles.earthtime.org
    if (layerDef["URL"].indexOf("tiles.earthtime.org") > 0) {
      relativeLocalDataPath = layerDef["URL"].replace(/https*:\/\/tiles.earthtime.org/, '').replace('("', '');
      useLocalData = true;
    }
  }

  if (useLocalData) {
    url = tileUrl = getRootTilePath() + relativeLocalDataPath;
    if (layerDef["Map Type"] == "raster") {
      url = tileUrl = '("' + url;
    }
  } else {
    url = layerDef["URL"].replace("http://", "https://");
  }

  layerOptions.name = layerDef["Name"];
  layerOptions.credit = layerDef["Credits"];

  layerOptions.scalingFunction = layerDef["Scaling"] || 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])';
  layerOptions.colorScalingFunction = layerDef["Color Scaling"] || 'd3.scaleLinear().domain([minColorValue, maxColorValue]).range([0, 1])';

  layerOptions.externalGeojson = layerDef["External GeoJSON"];
  layerOptions.nameKey = layerDef["Name Key"]; // Optional GeoJSON property name with which to join features with first column of data
  var category_id = layerOptions.category ? "category-" + layerOptions.category.trim().replace(/ /g,"-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase() : "csvlayers_table";
  layerOptions.playbackRate = layerDef["Playback Rate"] || null;
  layerOptions.masterPlaybackRate = layerDef["Master Playback Rate"] || null;
  layerOptions.nLevels = layerDef["Number of Levels"] ? parseInt(layerDef["Number of Levels"]) : 0;
  layerOptions.imageSrc = layerDef["Colormap Src"] || null;

  function isValidDrawFunction(name) {
    if (layerOptions.mapType == 'raster') {
      return /^WebglMapTile\.prototype\._draw\w*$/.test(name);
    }
    return true;
  }

  function isValidShader(name, type) {
    if (layerOptions.mapType == 'raster') {
      return /^WebglMapTile.\w+$/.test(name) && name.endsWith(type + 'Shader');
    }
    return true;
  }

  function overrideDrawingFns() {
    var drawFunction = layerDef["Draw Function"];
    if (drawFunction) {
      if (isValidDrawFunction(drawFunction)) {
        layerOptions.drawFunction = eval(drawFunction);
      } else {
        console.log(drawFunction + " is not a valid Draw Function for layer type " + layerOptions.mapType);
      }
    }

    if (layerDef["Number of Attributes"]) {
      layerOptions.numAttributes = parseInt(layerDef["Number of Attributes"]);
    }

    var vertexShader = layerDef["Vertex Shader"];
    if (vertexShader) {
      if (isValidShader(vertexShader, "Vertex")) {
        layerOptions.vertexShader = eval(vertexShader);
      } else {
        console.log(vertexShader + " is not a valid Vertex Shader for layer type " + layerOptions.mapType);
      }
    }

    var fragmentShader = layerDef["Fragment Shader"];
    if (fragmentShader) {
      if (isValidShader(fragmentShader, "Fragment")) {
        layerOptions.fragmentShader = eval(fragmentShader);
      } else {
        console.log(fragmentShader + " is not a valid Fragment Shader for layer type " + layerOptions.mapType);
      }
    }
  }

  // By default, most CSV layers draw at z=400.  Raster and choropleths by default will draw at z=200.  New raster base maps will draw at z=100.
  layerOptions.z = 400;
  var WebglLayer = WebglVectorLayer2;

  if (layerOptions.mapType == 'raster') {
    if (layerOptions.category == "Base Maps") {
      layerOptions.z = 100;
    } else {
      layerOptions.z = 200;
    }
    WebglLayer = WebglMapLayer;
    url = eval(url);
    layerOptions.loadDataFunction = null;
    layerOptions.drawFunction = null;
    layerOptions.fragmentShader = null;
    layerOptions.vertexShader = null;
    if (layerOptions.imageSrc) {
      layerOptions.colormap = layerOptions.imageSrc;
    }
    overrideDrawingFns();
  } else if (layerOptions.mapType == "choropleth") {
    layerOptions.avoidShowingChildAndParent = true;
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
  if (layerOptions.drawOptions) {
    var obj = layerOptions.drawOptions;
    for (const key in obj) {
      let value = obj[key];
      layer.options[key] = value;
      //optional check for properties from prototype chain
      if (obj.hasOwnProperty(key)) {
        //no a property from prototype chain
      }else{
        //property from protytpe chain
      }
    }
    layer.options.drawOptions = layerOptions.drawOptions;
  }

  if (layerOptions.setDataOptions) {
    var obj = layerOptions.setDataOptions;
    for (const key in obj) {
      let value = obj[key];
      layer.options[key] = value;
      //optional check for properties from prototype chain
      if (obj.hasOwnProperty(key)) {
        //no a property from prototype chain
      }else{
        //property from protytpe chain
      }
    }
    layer.options.setDataOptions = layerOptions.setDataOptions;
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
      var baseLayerIdentifier = layer.layerDef['Base layer'];
      // TODO: Legacy. For spreadsheets that don't have this column, we default to old behavior of always forcing dark map
      if (typeof(baseLayerIdentifier) === "undefined") {
        baseLayerIdentifier = "bdrk";
      }
      if (baseLayerIdentifier) {
        $("#layers-list label[name='" + baseLayerIdentifier + "'] input").trigger("click");
      }
      var cachedLayerTimelinePath = layer.layerId + ".json";
      if (layer.hasTimeline) {
        setActiveLayersWithTimeline(1);
        if (!$.isEmptyObject(layer.customSliderInfo)) {
          // TODO: Allow spreadsheet to specify type of timeline. For now, assume same timeline type as Landsat (customUI)
          timelineType = "customUI";
          cached_ajax[cachedLayerTimelinePath] = {"capture-times":  Object.keys(layer.customSliderInfo)};
        } else {
          timelineType = "defaultUI";
        }
        layerCustomSliderInfo = layer.customSliderInfo;
      } else {
        timelineType = "none";
      }
      // A timeline type of none will still set internal capture times (if applicable) but will not render any timeline UI
      requestNewTimeline(cachedLayerTimelinePath, timelineType);
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
      if (layer.hasTimeline) {
        setActiveLayersWithTimeline(-1);
      }
      if (activeEarthTimeLayers.length == 1 && activeEarthTimeLayers.indexOf("blsat") == 0) {
        doSwitchToLandsat();
      }
      // Turn off layer
      layer.visible = false;
      // cacheLastUsedLayer is a global data struct from index.html
      cacheLastUsedLayer(layer);
      layerCustomSliderInfo = null;
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

CsvFileLayer.prototype.updateLayerData = function updateLayerData(layerId, newStartDate, newEndDate, newStep, refreshData, refreshTimeline) {
  var layer = this.layerById[layerId];
  newStartDate = newStartDate || layer.layerDef["Start date"]
  newEndDate = newEndDate || layer.layerDef["End date"]
  newStep = newStep || layer.layerDef["Step"]

  if (refreshData){
    layer.startDate = newStartDate;
    layer.endDate = newEndDate;

    layer.destroy(); //update tiles to use new data
  }

  if(refreshTimeline){
    //assume input dates are in GMT, force timeline to display "local" time
    // newStartDate = DateRangePicker.prototype.fixForLocalTimeline(newStartDate);
    // newEndDate = DateRangePicker.prototype.fixForLocalTimeline(newEndDate);

    this.setTimeLine(layerId, newStartDate, newEndDate, newStep);
    var cachedLayerTimelinePath = layer.layerId + ".json";
    //TODO determine timeline styling
    requestNewTimeline(cachedLayerTimelinePath, "defaultUI"); //update timeline to match new date range
  }
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

// Takes in UTC time, returns ISO string date format
CsvFileLayer.prototype.setDateStr = function setDateStr(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
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
    out += 'T' + hourStr;
  } else {
    return out + 'Z';
  }

  if (typeof minuteStr !== "undefined") {
    out += ':' + minuteStr;
  } else {
    out += ':00';
    return out + 'Z';
  }

  if (typeof secondStr !== "undefined") {
    out += ':' + secondStr;
    return out;
  } else {
    out += ':00';
    return out + 'Z';
  }
}

CsvFileLayer.prototype.setTimeLine = function setTimeLine(identifier, startDate, endDate, step) {
  var captureTimes = [];

  var yyyymmddhhmm_re = /(\d{4})(\d{2})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/;
  var sm = startDate.match(yyyymmddhhmm_re);
  var em = endDate.match(yyyymmddhhmm_re);
  var stepSize = parseInt(step) || 1;
  if (sm && em) { // both dates parsed
    var startYear = sm[1];
    var startMonth = sm[2];
    var startDay = sm[3];
    var startHour = sm[4];
    var startMinute = sm[5];
    var startSecond = sm[6];

    var endYear = em[1];
    var endMonth = em[2];
    var endDay = em[3];
    var endHour = em[4];
    var endMinute = em[5];
    var endSecond = em[6];

    function pad(n) {
      return (n < 10) ? ("0" + n) : n;
    }

    var startYearInt = parseInt(startYear, 10);
    var startMonthInt = parseInt(startMonth, 10);
    var endYearInt = parseInt(endYear, 10);
    var endMonthInt = parseInt(endMonth, 10);

    if (isNaN(startYearInt) || isNaN(startMonthInt) || isNaN(endYearInt) || isNaN(endMonthInt) ) {
    // if (isNaN(startYear) || isNaN(endYear) || isNaN(startMonth) || isNaN(endMonth) ) {
      console.log('ERROR: CsvFileLayer.prototype.setTimeLine unable to parse startDate or endDate');
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    } else {
      if (typeof startDay != "undefined" && typeof endDay != "undefined") {
        // console.log(startYear, startMonth, startDay, startHour, startMinute, startSecond);
        var mDateStr = this.setDateStr(startYear, startMonth, startDay, startHour, startMinute, startSecond);
        var nDateStr = this.setDateStr(endYear, endMonth, endDay, endHour, endMinute, endSecond);
        var m = new Date(mDateStr);
        var n = new Date(nDateStr);
        var tomorrow = m;
        //tomorrow.setDate(tomorrow.getDate() + 1);
        while (tomorrow.getTime() <= n.getTime()) {
          var captureTimeStr = tomorrow.getFullYear() + '-' + pad((tomorrow.getMonth() + 1).toString()) + '-' + pad(tomorrow.getDate().toString());
          if (typeof startHour != "undefined") {
            captureTimeStr += ' ' + pad(tomorrow.getHours());
            if (typeof startMinute != "undefined") {
              captureTimeStr += ':' + pad(tomorrow.getMinutes());
              if (typeof startSecond != "undefined") {
                captureTimeStr += ':' + pad(tomorrow.getSeconds());
              }
            } else {
              captureTimeStr += ':' + '00';
            }
          }
          //TODO add timezone to timeline display w/o affecting share link
          if (typeof(Intl) != "undefined") {
            var timezoneStr = Intl.DateTimeFormat().resolvedOptions().timeZone;
            captureTimeStr += timezoneStr ? (" " + timezoneStr.replace("_"," ")) : "";
          }

          captureTimes.push(captureTimeStr);
          if (typeof startSecond != "undefined") {
            tomorrow.setSeconds(tomorrow.getSeconds() + stepSize);
          } else if (typeof startMinute != "undefined") {
            tomorrow.setMinutes(tomorrow.getMinutes() + stepSize);
          } else if (typeof startHour != "undefined") {
            tomorrow.setHours(tomorrow.getHours() + stepSize);
          } else {
            tomorrow.setDate(tomorrow.getDate() + stepSize);
          }
        }
      } else { // generate yyyy-mm
        for (var i = startYearInt; i <= endYearInt; i++) {
          var beginMonth = 1;
          var stopMonth = 12;
          if (i == startYearInt) {
            beginMonth = startMonth;
          }
          if (i == endYearInt) {
            stopMonth = endMonth;
          }
          for (var j = beginMonth; j <= stopMonth; j++) {
            captureTimes.push(pad(i.toString()) + "-" + pad(j.toString()));
          }
        }
      }
    }
  } else  { // generate yyyy
    var stepSize = parseInt(step,10) || 1;
    if (isNaN(startYearInt) || isNaN(endYearInt) || isNaN(stepSize) ) {
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    } else {
      for (var i = startYearInt; i < endYearInt + 1; i+=stepSize) {
        captureTimes.push(i.toString());
      }
    }
  }
  cached_ajax[identifier + '.json'] = {"capture-times":  captureTimes};
};

// Find first tile with _radius and return _radius
CsvFileLayer.prototype.getRadius = function(layer) {
  var tiles = layer._tileView._tiles;

  for (var key in tiles) {
    if ('_radius' in tiles[key]) {
      return tiles[key]._radius;
    }
  }
  return null;
}

CsvFileLayer.prototype.setLegend = function setLegend(id) {
  var layer;
  for (var i = 0; i < this.layers.length; i++) {
    if (this.layers[i].layerId == id) {
      layer = this.layers[i];
      break;
    }
  }
  if (typeof layer != 'undefined') {
    if (layer.legendContent.toLowerCase() == 'none') {
      return;
    }
    if (layer.mapType == 'bubble') {
      if (layer.legendContent == 'auto') {
        var radius = this.getRadius(layer);
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
        var radius = this.getRadius(layer);
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

// TODO: don't load country polygons until first use, by switching everything to use
// COUNTRY_POLYGONS_RESOURCE, and removing the receiveData clause below

var COUNTRY_POLYGONS;
var COUNTRY_POLYGONS_RESOURCE =
    new Resource("country_polygons.geojson",
     {
       transform: parseAndIndexGeojson.bind(null, 'names'),
       receiveData: function(data) {
         COUNTRY_POLYGONS = data;
       }
     });

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
  "WebGLVectorTile2.prototype._setWindVectorsData": WebGLVectorTile2.prototype._setWindVectorsData,
  "WebGLVectorTile2.prototype._setTrajectoriesData": WebGLVectorTile2.prototype._setTrajectoriesData,
  "WebGLVectorTile2.prototype._setAnimatedPointsData": WebGLVectorTile2.prototype._setAnimatedPointsData,
  "WebGLVectorTile2.prototype._setTriangleData": WebGLVectorTile2.prototype._setTriangleData,
  "WebGLVectorTile2.prototype._setGlyphData": WebGLVectorTile2.prototype._setGlyphData,
  "WebGLVectorTile2.prototype._setAnimatedGlyphData": WebGLVectorTile2.prototype._setAnimatedGlyphData
}
