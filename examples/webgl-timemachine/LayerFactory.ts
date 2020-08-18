declare var Papa:any;
/// <reference path="../../js/papaparse.min.js"/>

import { Resource, parseAndIndexGeojson } from './Resource'
import { gEarthTime } from './EarthTime'
import { BubbleMapLegend, ChoroplethLegend, Legend } from './Legend'

import { WebGLMapLayer } from './WebGLMapLayer'
import { WebGLMapLayer2 } from './WebGLMapLayer2'
import { WebGLTimeMachineLayer } from './WebGLTimeMachineLayer'
import { WebGLVectorLayer2 } from './WebGLVectorLayer2'

import { WebGLMapTile, WebGLMapTileShaders } from './WebGLMapTile'
import { WebGLVectorTile2, WebGLVectorTile2Shaders } from './WebGLVectorTile2'

import { Timelines } from './Timelines';
import { LayerDef, LayerProxy } from './LayerProxy';
import { LayerOptions } from './Layer';
import { WebGLMapTile2, WebGLMapTile2Shaders } from './WebGLMapTile2';
import { ETMBLayer } from './ETMBLayer';


// Loaded from config-local.js
declare var EARTH_TIMELAPSE_CONFIG: { localCsvLayers: string[]; useCsvLayersLocally: any; remoteDataHosts: string[] };

var csvlayersLoadedPath: any;

export class LayerDefinitionError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export class LayerFactory {
  layers: any[];
  layerById: {};
  dataLoadedListeners: any[];
  layersLoadedListeners: any[];
  layersData: any;
  formatValue: (value: any) => any;
  constructor() {
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

  lookupFunctionFromTable(functionName: string, lookupTable: { [x: string]: any; }) {
    if (functionName.trim() in lookupTable) {
      return lookupTable[functionName.trim()];
    } else {
      console.log("ERROR: CsvFileLayer.prototype.lookupFunctionFromTable");
      console.log("       " + functionName + " not in lookupTable");
      return undefined;
    }
  }

  addExtrasContent(layerDef: { [x: string]: string; }) {
    var playbackRate = layerDef["Playback Rate"].trim() == '' ? 1 : layerDef["Playback Rate"].trim();
    var dataType = layerDef["Map Type"].split("-")[1];
    var dataFilePath = layerDef["URL"];
    var shareLinkIdentifier = layerDef["Share link identifier"].replace(/\W+/g, '_');
    var dataName = layerDef["Name"];
    var extrasOptions: any = {};
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

  createLayer(layerProxy: LayerProxy, layerDef: LayerDef) {
    // (someday) Use csv.createlab.org as translation gateway
    // url = 'http://csv.createlab.org/' + url.replace(/^https?:\/\//,'')

    var layerOptions: LayerOptions = {
      tileWidth: 256,
      tileHeight: 256,
      loadDataFunction: WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv,
      dataLoadedFunction: this.dataLoadedFromCsv.bind(this),
      drawFunction: WebGLVectorTile2.prototype._drawBubbleMap,
      fragmentShader: WebGLVectorTile2Shaders.bubbleMapFragmentShader,
      vertexShader: WebGLVectorTile2Shaders.bubbleMapVertexShader,
      numAttributes: 6,
      layerDef: layerDef,
      layerId: layerDef["Share link identifier"].replace(/([^\w-])+/g, '_'),
      category: layerDef["Category"],
      timelineType: layerDef["Timeline Type"] || 'defaultUI',
      startDate: layerDef["Start date"],
      endDate: layerDef["End date"],
      step: layerDef["Step"] ? parseInt(layerDef["Step"]) : 1,
      showGraph: (layerDef["Show Graph"] || '').toLowerCase() == 'true',
      mapType: layerDef["Map Type"] || "bubble",
      color: layerDef["Color"] ? JSON.parse(layerDef["Color"]) : null,
      legendContent: layerDef["Legend Content"],
      legendKey: layerDef["Legend Key"],
      name: layerDef["Name"],
      credit: layerDef["Credits"],
      scalingFunction: layerDef["Scaling"] || 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])',
      colorScalingFunction: layerDef["Color Scaling"] || 'd3.scaleLinear().domain([minColorValue, maxColorValue]).range([0, 1])',
      externalGeojson: layerDef["External GeoJSON"],
      nameKey: layerDef["Name Key"], // Optional GeoJSON property name with which to join features with first column of data
      playbackRate: layerDef["Playback Rate"] || null,
      masterPlaybackRate: layerDef["Master Playback Rate"] || null,
      nLevels: layerDef["Number of Levels"] ? parseInt(layerDef["Number of Levels"]) : 0,
      imageSrc: layerDef["Colormap Src"] || null,
      // By default, most CSV layers draw at z=400.  Raster and choropleths by default will draw at z=200.  New raster base maps will draw at z=100.
      z: 400,
      avoidShowingChildAndParent: false,
      useTmJsonTimeTicks: false,
      maptype: null,
      levelThreshold: 0
    };

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


    if (typeof layerDef["Draw Options"] != "undefined" && layerDef["Draw Options"] != "") {
      layerOptions.drawOptions = JSON.parse(layerDef["Draw Options"]);
    }

    if (typeof layerDef["Set Data Options"] != "undefined" && layerDef["Set Data Options"] != "") {
      layerOptions.setDataOptions = JSON.parse(layerDef["Set Data Options"]);
    }

    var url = layerDef.URL ? layerDef.URL.replace("http://", "https://") : '';

    var useLocalData = false;
    var remoteDataHosts = EARTH_TIMELAPSE_CONFIG.remoteDataHosts || ["tiles.earthtime.org"];

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

    if (useLocalData) {
      for (var i = 0; i < remoteDataHosts.length; i++) {
        if (layerDef["URL"].indexOf(remoteDataHosts[i]) > 0) {
          url = layerDef["URL"].replace(/https*:\/\/tiles.earthtime.org/g, gEarthTime.rootTilePath);
        }
      }
    }

    var category_id = layerOptions.category ? "category-" + layerOptions.category.trim().replace(/ /g,"-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase() : "csvlayers_table";

    function overrideDrawingFns() {
      var drawFunction = layerDef["Draw Function"];
      if (drawFunction) {
        layerOptions.drawFunction = LayerFactory.getFunction(layerOptions.mapType, 'draw', drawFunction);
      }

      if (layerDef["Number of Attributes"]) {
        layerOptions.numAttributes = parseInt(layerDef["Number of Attributes"]);
      }

      var vertexShader = layerDef["Vertex Shader"];
      if (vertexShader) {
        layerOptions.vertexShader = LayerFactory.getShader(layerOptions.mapType, vertexShader, "Vertex");
      }

      var fragmentShader = layerDef["Fragment Shader"];
      if (fragmentShader) {
        layerOptions.fragmentShader = LayerFactory.getShader(layerOptions.mapType, fragmentShader, "Fragment");
      }
    }

    var WebGLLayer: any = WebGLVectorLayer2;

    if (layerOptions.mapType == 'raster') {
      if (layerOptions.category == "Base Maps") {
        layerOptions.z = 100;
      } else {
        layerOptions.z = 200;
      }
      WebGLLayer = WebGLMapLayer;
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
      WebGLLayer = WebGLMapLayer2;
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
      layerOptions.imageSrc = layerOptions.imageSrc || "https://tiles.earthtime.org/colormaps/obesity-color-map.png";
      layerOptions.z = 200;
      layerOptions.loadDataFunction = WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv;
      layerOptions.drawFunction = WebGLVectorTile2.prototype._drawChoroplethMap;
      layerOptions.fragmentShader = WebGLVectorTile2Shaders.choroplethMapFragmentShader;
      layerOptions.vertexShader = WebGLVectorTile2Shaders.choroplethMapVertexShader;
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
      WebGLLayer = WebGLTimeMachineLayer;
    } else if (layerOptions.mapType == "mapbox") {
      WebGLLayer = ETMBLayer;
    } else {
      if (layerDef["Load Data Function"]) {
        layerOptions.loadDataFunction = LayerFactory.getFunction(layerOptions.maptype, 'loadData', layerDef["Load Data Function"]);
      }
      if (layerDef["Set Data Function"]) {
        layerOptions.setDataFunction = LayerFactory.getFunction(layerOptions.mapType, 'setData', layerDef["Set Data Function"]);
      }
      overrideDrawingFns();
    }

    var layer = new WebGLLayer(layerProxy, gEarthTime.glb, gEarthTime.canvasLayer, url, layerOptions);
    layer.options = layer.options || {};
    if (layerOptions.color) {
      layer.options.color = layerOptions.color;
    }
    if (layerOptions.drawOptions) {
      let obj = layerOptions.drawOptions;
      for (const key in obj) {
        let value = obj[key];
        layer.options[key] = value;
      }
      layer.options.drawOptions = layerOptions.drawOptions;
    }

    if (layerOptions.setDataOptions) {
      let obj = layerOptions.setDataOptions;
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
    // if ($('#' + category_id).length == 0) {
    //   $(".map-layer-div #category-other").prev("h3").before("<h3>" + layerOptions.category + "</h3><table id='" + category_id + "'></table>");
    // }

    // $('#' + category_id).append(row);

    // // Handle click event to turn on and off layer
    // $('#' + id).on("click", function() {
    //   var $this = $(this);
    //   if ($this.prop('checked')) {

    //     //// TODO(pdille): These handle special cases with our hardcoded layers, that have now moved to the CSV sheet. Some or none of this may remain in the future.
    //     if (typeof(layer.options.layersPairedWith) !== "undefined") {
    //       var layerIds = layer.options.layersPairedWith;
    //       for (var i = 0; i < layerIds.length; i++) {
    //         var $pairdLayer = $("#layers-list label[name='" + layerIds[i] + "'] input");
    //         if (!$pairdLayer.prop("checked")) {
    //           $pairdLayer.trigger("click");
    //         }
    //       }
    //     }

    //     if (typeof(layer.options.layersMutuallyExclusiveWith) !== "undefined") {
    //       var layerIds = layer.options.layersMutuallyExclusiveWith;
    //       for (var i = 0; i < layerIds.length; i++) {
    //         var $mutuallyExclusiveLayer = $("#layers-list label[name='" + layerIds[i] + "'] input");
    //         if ($mutuallyExclusiveLayer.prop("checked")) {
    //           $mutuallyExclusiveLayer.trigger("click");
    //         }
    //       }
    //     }

    //     if (layer.options.isSoloLayer) {
    //       var $activeLayersNotIncludingClickedLayer = $("#layers-list").find("input[type=checkbox]:checked").not($(this));
    //       $activeLayersNotIncludingClickedLayer.trigger("click");
    //     }
    //     ////

    //     // Turn on layer
    //     if (layer.mapType != "timemachine") {
    //       layer.getTileView().handleTileLoading({layerDomId: $this[0].id});
    //     }
    //     var baseLayerIdentifier = layer.layerDef['Base layer'];
    //     // TODO: Legacy. For spreadsheets that don't have this column, we default to old behavior of always forcing dark map
    //     if (typeof(baseLayerIdentifier) === "undefined" || baseLayerIdentifier == "") {
    //       baseLayerIdentifier = "bdrk";
    //     }
    //     if (baseLayerIdentifier) {
    //       var $baseLayers = $("#category-base-layers");
    //       if ($baseLayers.find("label[name='" + baseLayerIdentifier + "']").length == 0) {
    //         var currentActiveBaseLayerId = $baseLayers.find(":checked").parent().attr("name")
    //         if (currentActiveBaseLayerId == "blsat") {
    //           setActiveLayersWithTimeline(-1);
    //         }
    //         activeEarthTimeLayers = activeEarthTimeLayers.filter(function (layerId) {
    //           return layerId !== currentActiveBaseLayerId;
    //         });
    //         $baseLayers.find("input").prop("checked", false);
    //       }
    //       if (baseLayerIdentifier != layer.layerId) {
    //         $("#layers-list label[name='" + baseLayerIdentifier + "'] input").trigger("click");
    //       }
    //       // Globals in index.html
    //       previousVisibleBaseMapLayer = visibleBaseMapLayer;
    //       visibleBaseMapLayer = baseLayerIdentifier;
    //     }
    //     var cachedLayerTimelinePath = layer.layerId + ".json";
    //     if (layer.hasTimeline) {
    //       setActiveLayersWithTimeline(1);
    //       if (layer.timelineType) {
    //         timelineType = layer.timelineType;
    //       } else {
    //         timelineType = "defaultUI";
    //       }
    //       if (!$.isEmptyObject(layer.customSliderInfo)) {
    //         cached_ajax[cachedLayerTimelinePath] = {"capture-times":  Object.keys(layer.customSliderInfo)};
    //         layerCustomSliderInfo = layer.customSliderInfo;
    //       }
    //     } else {
    //       timelineType = "none";
    //     }
    //     // A timeline type of none will still set internal capture times (if applicable) but will not render any timeline UI
    //     requestNewTimeline(cachedLayerTimelinePath, timelineType);
    //     layer.visible = true;
    //     $("#" + layer.layerId + "-legend").show();
    //     if (layer.mapType == "choropleth") {
    //       showCountryLabelMapLayer = false;
    //     } else if (layer.mapType == "timemachine") {
    //       // TODO:(pdille)
    //       if (layer.fps) {
    //         var v = timelapse.getVideoset();
    //         v.setFps(layer.fps);
    //       }
    //     }
    //     // TODO:(pdille)
    //     if (typeof(layer.options.doDwell) !== "undefined") {
    //       timelapse.setDoDwell(layer.options.doDwell);
    //     }
    //     // TODO:(pdille)
    //     if (layer.options.dwellTimes && typeof(layer.options.dwellTimes.startDwell) !== "undefined" && typeof(layer.options.dwellTimes.endDwell) !== "undefined") {
    //       timelapse.setDwellTimes(layer.options.dwellTimes.startDwell, layer.options.dwellTimes.endDwell);
    //     }
    //     // TODO:(pdille)
    //     if (typeof(layer.options.maxScale) !== "undefined") {
    //       timelapse.setMaxScale(layer.options.maxScale);
    //     }
    //     if (layer.masterPlaybackRate && layer.playbackRate) {
    //       timelapse.setMasterPlaybackRate(layer.masterPlaybackRate);
    //       timelapse.setPlaybackRate(layer.playbackRate);
    //     }
    //   } else {
    //     $("#" + layer.layerId + "-legend").hide();
    //     if (layer.hasTimeline) {
    //       setActiveLayersWithTimeline(-1);
    //     }
    //     var handleBaseLayerSwitch = false;
    //     var potentialBaseLayerSwitchId = previousVisibleBaseMapLayer;
    //     if (previousVisibleBaseMapLayer != visibleBaseMapLayer) {
    //       handleBaseLayerSwitch = true;
    //     }
    //     visibleBaseMapLayer = previousVisibleBaseMapLayer;
    //     if (handleBaseLayerSwitch) {
    //       $("#layers-list label[name='" + potentialBaseLayerSwitchId + "'] input").trigger("click");
    //     }
    //     // Turn off layer
    //     layer.visible = false;
    //     // cacheLastUsedLayer is a global data struct from index.html
    //     cacheLastUsedLayer(layer);
    //     if (layer.mapType == "choropleth") {
    //       showCountryLabelMapLayer = false;
    //     } else if (layer.mapType == "timemachine") {
    //       // TODO:(pdille)
    //       var v = timelapse.getVideoset();
    //       v.setFps(10);
    //     }
    //     // TODO:(pdille)
    //     if (typeof(layer.options.doDwell) !== "undefined") {
    //       timelapse.setDoDwell(true);
    //     }
    //     // TODO:(pdille)
    //     if (layer.options.dwellTimes && typeof(layer.options.dwellTimes.startDwell) !== "undefined" && typeof(layer.options.dwellTimes.endDwell) !== "undefined") {
    //       timelapse.setDwellTimes(1.5, 1.5);
    //     }
    //     // TODO:(pdille)
    //     if (typeof(layer.options.maxScale) !== "undefined") {
    //       timelapse.setMaxScale(landsatMaxScale);
    //     }
    //     // TODO:(pdille)
    //     if (typeof(layer.options.layersPairedWith) !== "undefined") {
    //       var layerIds = layer.options.layersPairedWith;
    //       for (var i = 0; i < layerIds.length; i++) {
    //         $pairdLayer = $("#layers-list label[name='" + layerIds[i] + "'] input");
    //         if ($pairdLayer.prop("checked")) {
    //           $pairdLayer.trigger("click");
    //         }
    //       }
    //     }
    //     if (layer.masterPlaybackRate && layer.playbackRate) {
    //       timelapse.setMasterPlaybackRate(1);
    //       timelapse.setPlaybackRate(defaultPlaybackSpeed);
    //     }
    //   }
    // }).prop('checked', layer.visible);

    return layer;
  }

  updateLayerData(layerId: string, newDataProperties: any, refreshData: any, refreshTimeline: any) {
    var layer = this.layerById[layerId];

    if (newDataProperties) {
      $.extend(true, layer, newDataProperties);
    }

    if (refreshData){
      layer.destroy(); //update tiles to use new data
    }

    if (refreshTimeline){
      Timelines.setTimeLine(layerId, layer.startDate, layer.endDate, layer.step);
      var cachedLayerTimelinePath = layer.layerId + ".json";
      //TODO determine timeline styling
      // @ts-ignore
      requestNewTimeline(cachedLayerTimelinePath, "defaultUI"); //update timeline to match new date range
    }
  }

  addDataLoadedListener(listener: any) {
    if (typeof(listener) === "function") {
      this.dataLoadedListeners.push(listener);
    }
  }

  removeDataLoadedListener(listener: any) {
    for (var i = 0; i < this.dataLoadedListeners.length; i++) {
      if (this.dataLoadedListeners[i] == listener) {
        this.dataLoadedListeners.splice(i, 1);
        break;
      }
    }
  }

  addLayersLoadedListener(listener: any) {
    if (typeof(listener) === "function") {
      this.layersLoadedListeners.push(listener);
    }
  }

  removeLayersLoadedListener(listener: any) {
    for (var i = 0; i < this.layersLoadedListeners.length; i++) {
      if (this.layersLoadedListeners[i] == listener) {
        this.layersLoadedListeners.splice(i, 1);
        break;
      }
    }
  }


  dataLoadedFromCsv(layerId: any) {
    for (var i = 0; i < this.dataLoadedListeners.length; i++) {
      this.dataLoadedListeners[i](layerId);
    }
  }

  loadLayersFromTsv(layerDefinitions: any) {
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
        var layer = this.createLayer(null, layerDef);
        if (layer.mapType == 'raster' || layer.mapType == 'timemachine') {
          //TODO: Raster and timemachine layers do not have the addDataLoadedListener callback
          this.setLegend(layer.layerId);
          $("#" + layer.layerId + "-legend").hide();
        }
        Timelines.setTimeLine(layer.layerId,
            layerDef["Start date"],
            layerDef["End date"],
            layerDef["Step"]);

      }
    }
    for (var i = 0; i < this.layersLoadedListeners.length; i++) {
      this.layersLoadedListeners[i]();
    }
  }


  loadLayers(path: any) {
    if (path == csvlayersLoadedPath) return;
    csvlayersLoadedPath = path;

    var that = this;

    // Clear out any csv layers that have already been loaded
    $("#csvlayers_table, .csvlayer").find("input:checked").trigger("click");
    $(".csvlayer").remove();
    $("#csvlayers_table").empty();
    that.layers = [];

    org.gigapan.Util.loadTsvData(path, that.loadLayersFromTsv, that);
  }

  // Find first tile with _radius and return _radius
  getRadius(layer) {
    var tiles = layer._tileView._tiles;

    for (var key in tiles) {
      if ('_radius' in tiles[key]) {
        return tiles[key]._radius;
      }
    }
    return null;
  }

  setLegend(id: string) {
    var layer: { legendContent: string; mapType: string; name: string; credit: string; legendKey: any; color: any[]; imageSrc: any; };
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
              var rgba = layer.color.map(function(x: number) {
                return Math.floor(x * 255.);
              });
            } else {
              let rgba = [15,15,15];
            }
            opts.keys.push({'color': 'rgb('+ rgba[0] +',' + rgba[1] +',' + rgba[2] + ')', 'str': layer.legendKey});
          }
          var legend = new BubbleMapLegend(opts);
        } else {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          var str = div + layer.legendContent;
          let opts = {
            'id' : id,
            'str': str
          }
          var legend = new BubbleMapLegend(opts);
        }
      } else if (layer.mapType == 'choropleth') { // Assume choropleth
        if (layer.legendContent == 'auto') {
          var radius = this.getRadius(layer);
          let opts = {
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
          let legend = new ChoroplethLegend(opts);
        } else {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          var str = div + layer.legendContent;
          let opts = {
            'id' : id,
            'str': str
          }
          let legend = new ChoroplethLegend(opts);
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
        let opts = {
          'id' : id,
          'str': str
        }
        let legend = new Legend(id, str);
      }
      $('#legend-content table tr:last').after(legend.toString());
      let isLayerActive = (gEarthTime.layerDB.visibleLayers.map(layer => layer.id)).indexOf(id) >= 0;
      if (layer.mapType != 'raster' && isLayerActive) {
        $("#" + id + "-legend").show();
      }
    }
  }

  static getShader(mapType: string, name: string, type: string): string {
    // Backwards compatibility
    name = name.replace('Webgl', 'WebGL').replace('WindVectorsShaders.', 'WindVectorsShaders_')
    if (mapType == 'raster') {
      var prefix = 'WebGLMapTile.';
      var parent: any = WebGLMapTileShaders;
    } else if (mapType == 'raster2') {
      var prefix = 'WebGLMapTile2.';
      var parent: any = WebGLMapTile2Shaders;
    } else {
      var prefix = 'WebGLVectorTile2.';
      parent = WebGLVectorTile2Shaders;
    }
    if (!name.startsWith(prefix)) {
      throw new LayerDefinitionError(`Shader for layer type ${mapType} must begin with ${prefix}`);
    }

    var suffix = name.slice(prefix.length);

    if (mapType == 'raster') {
      var valid = suffix.endsWith(type + 'Shader');
    } else {
      valid = suffix.includes('Shader');
    }
    if (!valid) {
      throw new LayerDefinitionError(`${suffix} is invalid name for ${type} shader`);
    }

    if (!parent[suffix]) {
      throw new LayerDefinitionError(`Cannot find shader function "${name}"`);
    }
    return parent[suffix];
  }

  static getFunction(mapType: string, funcType: string, name: string): (...any) => any {
    let valid: boolean;
    name = name.replace('Webgl', 'WebGL').trim();
    if (mapType == 'raster') {
      var prefix = 'WebGLMapTile.prototype.';
      var parent: any = WebGLMapTile.prototype;
    } else if (mapType == 'raster2') {
      var prefix = 'WebGLMapTile2.prototype.';
      var parent: any = WebGLMapTile2.prototype;
    } else {
      var prefix = 'WebGLVectorTile2.prototype.';
      parent = WebGLVectorTile2.prototype;
    }

    if (!name.startsWith(prefix)) {
      throw new LayerDefinitionError(`Function for layer type ${mapType} must begin with ${prefix}`);
    }
    var suffix = name.slice(prefix.length);

    if (funcType == 'draw') {
      var re = /^_draw\w*$/;
    } else if (funcType == 'setData') {
      var re = /^_set\w*Data\w*$/;
    } else if (funcType == 'loadData') {
      var re = /^_load\w*Data\w*$/;
    } else {
      throw Error(`unknown funcType ${funcType}`);
    }

    if (!re.test(suffix)) {
      throw new LayerDefinitionError(`${suffix} is not a valid ${funcType} function name`);
    }
    if (!parent[suffix]) {
      throw new LayerDefinitionError(`Cannot find ${funcType} function "${name}"`);
    }
    return parent[suffix];
  }
}

// TODO: don't load country polygons until first use, by switching everything to use
// COUNTRY_POLYGONS_RESOURCE, and removing the receiveData clause below

var COUNTRY_POLYGONS: any;
export var COUNTRY_POLYGONS_RESOURCE =
    new Resource("country_polygons.geojson",
     {
       transform: parseAndIndexGeojson.bind(null, 'names'),
       receiveData: function(data: any) {
         COUNTRY_POLYGONS = data;
       }
     });

export function searchCountryList(feature_collection: { [x: string]: any[]; }, name: string | number, name_key: string | number = undefined) {
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
