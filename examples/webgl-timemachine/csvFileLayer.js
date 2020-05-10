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
    str += ' data-muted="' + extrasOptions.muted + '"';
  }
  if (extrasOptions.controls) {
    str += ' data-controls="' + extrasOptions.controls + '"';
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
  layerOptions.step = layerDef["Step"] || 1;

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

  var url = layerDef["URL"].replace("http://", "https://");
  var useLocalData = false;

  // Change a *subset* of layer URLs to be local
  // Assumes the layer ID is being passed in to the localCsvLayers array
  if (EARTH_TIMELAPSE_CONFIG.localCsvLayers) {
    for (var i = 0; i < EARTH_TIMELAPSE_CONFIG.localCsvLayers.length; i++) {
      if (layerOptions.layerId == EARTH_TIMELAPSE_CONFIG.localCsvLayers[i]) {
        useLocalData = true;
        break;
      }
    }
  // Change *all* layer URLs (if they match a domain) to be local
  } else if (EARTH_TIMELAPSE_CONFIG.useCsvLayersLocally) {
    useLocalData = true;
  }

  // TODO: Right now we only handle local storage of data that was stored at tiles.earthtime.org
  if (useLocalData && layerDef["URL"].indexOf("tiles.earthtime.org") > 0) {
    url = layerDef["URL"].replace(/https*:\/\/tiles.earthtime.org/, getRootTilePath());
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
  } else if (layerOptions.mapType == 'raster2') {
    WebglLayer = WebglMapLayer2;
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
  } else if (layerOptions.mapType == "timemachine") {
    layerOptions.rootUrl = url;
    if (layerOptions.setDataOptions) {
      layerOptions.greenScreen = layerOptions.setDataOptions.useGreenScreen;
      layerOptions.useTmJsonTimeTicks = layerOptions.setDataOptions.useTmJsonTimeTicks;
    }
    layerOptions.loadDataFunction = null;
    layerOptions.drawFunction = null;
    layerOptions.fragmentShader = null;
    layerOptions.vertexShader = null;
    if (layerOptions.imageSrc) {
      layerOptions.colormap = layerOptions.imageSrc;
    }
    overrideDrawingFns();
    WebglLayer = WebglTimeMachineLayer;
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
    }
    layer.options.drawOptions = layerOptions.drawOptions;
  }

  if (layerOptions.setDataOptions) {
    var obj = layerOptions.setDataOptions;
    for (const key in obj) {
      let value = obj[key];
      layer.options[key] = value;
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

      //// TODO(pdille): These handle special cases with our hardcoded layers, that have now moved to the CSV sheet. Some or none of this may remain in the future.
      if (typeof(layer.options.layersPairedWith) !== "undefined") {
        var layerIds = layer.options.layersPairedWith;
        for (var i = 0; i < layerIds.length; i++) {
          var $pairdLayer = $("#layers-list label[name='" + layerIds[i] + "'] input");
          if (!$pairdLayer.prop("checked")) {
            $pairdLayer.trigger("click");
          }
        }
      }

      if (typeof(layer.options.layersMutuallyExclusiveWith) !== "undefined") {
        var layerIds = layer.options.layersMutuallyExclusiveWith;
        for (var i = 0; i < layerIds.length; i++) {
          var $mutuallyExclusiveLayer = $("#layers-list label[name='" + layerIds[i] + "'] input");
          if ($mutuallyExclusiveLayer.prop("checked")) {
            $mutuallyExclusiveLayer.trigger("click");
          }
        }
      }

      if (layer.options.isSoloLayer) {
        var $activeLayersNotIncludingClickedLayer = $("#layers-list").find("input[type=checkbox]:checked").not($(this));
        $activeLayersNotIncludingClickedLayer.trigger("click");
      }
      ////

      // Turn on layer
      if (layer.mapType != "timemachine") {
        layer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      }
      var baseLayerIdentifier = layer.layerDef['Base layer'];
      // TODO: Legacy. For spreadsheets that don't have this column, we default to old behavior of always forcing dark map
      if (typeof(baseLayerIdentifier) === "undefined" || baseLayerIdentifier == "") {
        baseLayerIdentifier = "bdrk";
      }
      if (baseLayerIdentifier) {
        var $baseLayers = $("#category-base-layers");
        if ($baseLayers.find("label[name='" + baseLayerIdentifier + "']").length == 0) {
          var currentActiveBaseLayerId = $baseLayers.find(":checked").parent().attr("name")
          if (currentActiveBaseLayerId == "blsat") {
            setActiveLayersWithTimeline(-1);
          }
          activeEarthTimeLayers = activeEarthTimeLayers.filter(function (layerId) {
            return layerId !== currentActiveBaseLayerId;
          });
          $baseLayers.find("input").prop("checked", false);
        }
        if (baseLayerIdentifier != layer.layerId) {
          $("#layers-list label[name='" + baseLayerIdentifier + "'] input").trigger("click");
        }
        // Globals in index.html
        previousVisibleBaseMapLayer = visibleBaseMapLayer;
        visibleBaseMapLayer = baseLayerIdentifier;
      }
      var cachedLayerTimelinePath = layer.layerId + ".json";
      if (layer.hasTimeline) {
        setActiveLayersWithTimeline(1);
        if (layer.options.timelineType) {
          timelineType = layer.options.timelineType;
        } else {
          timelineType = "defaultUI";
        }
        if (!$.isEmptyObject(layer.customSliderInfo)) {
          cached_ajax[cachedLayerTimelinePath] = {"capture-times":  Object.keys(layer.customSliderInfo)};
        }
      } else {
        timelineType = "none";
      }
      // A timeline type of none will still set internal capture times (if applicable) but will not render any timeline UI
      requestNewTimeline(cachedLayerTimelinePath, timelineType);
      layer.visible = true;
      $("#" + layer.layerId + "-legend").show();
      if (layer.mapType == "choropleth") {
        showCountryLabelMapLayer = false;
      } else if (layer.mapType == "timemachine") {
        // TODO:(pdille)
        if (layer.fps) {
          var v = timelapse.getVideoset();
          v.setFps(layer.fps);
        }
      }
      // TODO:(pdille)
      if (typeof(layer.options.doDwell) !== "undefined") {
        timelapse.setDoDwell(layer.options.doDwell);
      }
      // TODO:(pdille)
      if (layer.options.dwellTimes && typeof(layer.options.dwellTimes.startDwell) !== "undefined" && typeof(layer.options.dwellTimes.endDwell) !== "undefined") {
        timelapse.setDwellTimes(layer.options.dwellTimes.startDwell, layer.options.dwellTimes.endDwell);
      }
      // TODO:(pdille)
      if (typeof(layer.options.maxScale) !== "undefined") {
        timelapse.setMaxScale(layer.options.maxScale);
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
      var handleBaseLayerSwitch = false;
      var potentialBaseLayerSwitchId = previousVisibleBaseMapLayer;
      if (previousVisibleBaseMapLayer != visibleBaseMapLayer) {
        handleBaseLayerSwitch = true;
      }
      visibleBaseMapLayer = previousVisibleBaseMapLayer;
      if (handleBaseLayerSwitch) {
        $("#layers-list label[name='" + potentialBaseLayerSwitchId + "'] input").trigger("click");
      }
      // Turn off layer
      layer.visible = false;
      // cacheLastUsedLayer is a global data struct from index.html
      cacheLastUsedLayer(layer);
      if (layer.mapType == "choropleth") {
        showCountryLabelMapLayer = false;
      } else if (layer.mapType == "timemachine") {
        // TODO:(pdille)
        var v = timelapse.getVideoset();
        v.setFps(10);
      }
      // TODO:(pdille)
      if (typeof(layer.options.doDwell) !== "undefined") {
        timelapse.setDoDwell(true);
      }
      // TODO:(pdille)
      if (layer.options.dwellTimes && typeof(layer.options.dwellTimes.startDwell) !== "undefined" && typeof(layer.options.dwellTimes.endDwell) !== "undefined") {
        timelapse.setDwellTimes(1.5, 1.5);
      }
      // TODO:(pdille)
      if (typeof(layer.options.maxScale) !== "undefined") {
        timelapse.setMaxScale(landsatMaxScale);
      }
      // TODO:(pdille)
      if (typeof(layer.options.layersPairedWith) !== "undefined") {
        var layerIds = layer.options.layersPairedWith;
        for (var i = 0; i < layerIds.length; i++) {
          $pairdLayer = $("#layers-list label[name='" + layerIds[i] + "'] input");
          if ($pairdLayer.prop("checked")) {
            $pairdLayer.trigger("click");
          }
        }
      }
      if (layer.masterPlaybackRate && layer.playbackRate) {
        timelapse.setMasterPlaybackRate(1);
        timelapse.setPlaybackRate(defaultPlaybackSpeed);
      }
    }
  }).prop('checked', layer.visible);

  return layer;
}

CsvFileLayer.prototype.updateLayerData = function updateLayerData(layerId, newDataProperties, refreshData, refreshTimeline) {
  var layer = this.layerById[layerId];

  if (newDataProperties) {
    $.extend(true, layer, newDataProperties);
  }

  if (refreshData){
    layer.destroy(); //update tiles to use new data
  }

  if (refreshTimeline){
    timelines.setTimeLine(layerId, layer.startDate, layer.endDate, layer.step);
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
      if (layer.mapType == 'raster' || layer.mapType == 'timemachine') {
        //TODO: Raster and timemachine layers do not have the addDataLoadedListener callback
        this.setLegend(layer.layerId);
        $("#" + layer.layerId + "-legend").hide();
      }
      timelines.setTimeLine(layer.layerId,
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

  var that = this;

  // Clear out any csv layers that have already been loaded
  $("#csvlayers_table, .csvlayer").find("input:checked").trigger("click");
  $(".csvlayer").remove();
  $("#csvlayers_table").empty();
  that.layers = [];

  org.gigapan.Util.loadTsvData(path, that.loadLayersFromTsv, that);
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
          if (layer.color) {
            var rgba = layer.color.map(function(x) {
              return Math.floor(x * 255.);
            });
          } else {
            var rgba = [15,15,15];
          }
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
      //if (layer.mapType != 'raster') {
        $("#" + id + "-legend").show();
      //}
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
