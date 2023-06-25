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

import { TimelineType } from './Timeline';
import { Timelines } from './Timelines';
import { LayerDef, LayerProxy } from './LayerProxy';
import { Layer, LayerOptions } from './Layer';
import { WebGLMapTile2, WebGLMapTile2Shaders } from './WebGLMapTile2';
import { ETMBLayer } from './ETMBLayer';
import { Utils } from './Utils';
import { MediaLayer } from './MediaLayer';


// Loaded from config-local.js
declare var EARTH_TIMELAPSE_CONFIG: { localCsvLayers: string[]; useCsvLayersLocally: any; remoteDataHosts: string[] };


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

  logPrefix() {
    return `${Utils.logPrefix()} LayerFactory`
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

  async createLayer(layerProxy: LayerProxy, layerDef: LayerDef) {
    if (layerDef?.type == 'dotmap') {
      return await this.createDotmapLayer(layerProxy, layerDef);
    }

    var mapType = layerDef["Map Type"] || "bubble"

    // Determine draw order for all layers other than type=='dotmap'
    var drawOrder = 400; // default
    if (layerDef["Draw Order"]) {
      drawOrder = parseInt(layerDef["Draw Order"]);
    } else if (layerDef["Category"] == 'Base Maps') {
      drawOrder = 100;
    } else if (mapType == 'raster' || mapType == 'raster2' || mapType == 'timemachine') {
      drawOrder = 200;
    } else if (mapType == 'choropleth') {
      drawOrder = 400;
    } else if (mapType == 'point') {
      drawOrder = 575;
    } else if (mapType == 'bubble' || mapType == 'bivalent bubble' || mapType == 'vector') {
      drawOrder = 600;
    }

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
      timelineType: (layerDef["Timeline Type"] as TimelineType) || 'defaultUI',
      startDate: layerDef["Start date"],
      endDate: layerDef["End date"],
      step: layerDef["Step"] ? parseInt(layerDef["Step"]) : 1,
      showGraph: (layerDef["Show Graph"] || '').toLowerCase() == 'true',
      mapType: mapType,
      color: layerDef["Color"]?.trim() ? JSON.parse(layerDef["Color"]) : null,
      legendContent: layerDef["Legend Content"] || "",
      legendKey: layerDef["Legend Key"],
      name: layerDef["Name"],
      credit: layerDef["Credits"],
      scalingFunction: layerDef["Scaling"] || 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])',
      colorScalingFunction: layerDef["Color Scaling"] || 'd3.scaleLinear().domain([minColorValue, maxColorValue]).range([0, 1])',
      externalGeojson: layerDef["External GeoJSON"],
      nameKey: layerDef["Name Key"], // Optional GeoJSON property name with which to join features with first column of data
      playbackRate: parseFloat(layerDef["Playback Rate"]) || null,
      masterPlaybackRate: parseFloat(layerDef["Master Playback Rate"]) || null,
      nLevels: layerDef["Number of Levels"] ? parseInt(layerDef["Number of Levels"]) : 0,
      imageSrc: layerDef["Colormap Src"] || null,
      // By default, most CSV layers draw at z=400.  Raster and choropleths by default will draw at z=200.  New raster base maps will draw at z=100.
      drawOrder: drawOrder,
      avoidShowingChildAndParent: false,
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

    if (layerDef["Legend Content"] == "none") {
      layerOptions.hasLegend = false;
    } else {
      layerOptions.hasLegend = true;
    }

    if (layerDef["Layer Constraints"]?.trim()) {
      layerOptions.layerConstraints = JSON.parse(layerDef["Layer Constraints"]);
    }

    if (layerDef["Draw Options"]?.trim()) {
      layerOptions.drawOptions = JSON.parse(layerDef["Draw Options"]);
    }

    if (layerDef["Set Data Options"]?.trim()) {
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
        if (layerDef["URL"] && layerDef["URL"].indexOf(remoteDataHosts[i]) >= 0) {
          var replace = "";
          if (remoteDataHosts[i].indexOf("http") != 0) {
            replace += "https*:\/\/";
          }
          replace += remoteDataHosts[i];
          var re = new RegExp(replace, "g");
          url = layerDef["URL"].replace(re, gEarthTime.rootTilePath);
        }
      }
    }

    //var category_id = layerOptions.category ? "category-" + layerOptions.category.trim().replace(/ /g,"-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase() : "csvlayers_table";

    function overrideDrawingFns() {
      var drawFunction = layerDef["Draw Function"];
      if (drawFunction) {
        layerOptions.drawFunction = LayerFactory.getFunction(layerOptions.mapType, 'draw', drawFunction);
        // Support for WebGLVectorTile2.basicDrawPoints({'pointSize': ...})
        if (layerOptions.drawFunction == WebGLVectorTile2.prototype._drawBasicPoints) {
          const regex = /{pointSize:(.*)}/;
          const found = regex.exec(drawFunction);
          if (found && found.length == 2) {
            layerOptions.drawOptions = {'pointSize': JSON.parse(found[1])};
          }
        }
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
    } else if (layerOptions.mapType.split("-")[0] == "extras") {
      WebGLLayer = MediaLayer;
    } else {
      if (layerDef["Load Data Function"]) {
        layerOptions.loadDataFunction = LayerFactory.getFunction(layerOptions.mapType, 'loadData', layerDef["Load Data Function"]);
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
      if (layerOptions.drawOptions['drawLayerFunction']){
        layer.drawLayerFunction = LayerFactory.getFunction(layerOptions.mapType, 'drawLayerFunction', layerOptions.drawOptions['drawLayerFunction']);
      }
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

    // var id = 'show-csv-' + layerOptions.layerId;
    // var row = '<tr class="csvlayer"><td><label name="' + layerOptions.layerId + '">';
    // row += '<input type="checkbox" id="' + id + '">';
    // row += layerOptions.name;
    // row += '</label></td></tr>';

    // Default category
    // if (category_id == "category-other") {
    //   category_id = "csvlayers_table";
    // }
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

  parse_and_encode_webgl_color(colorspec: string) {
    console.assert(colorspec.length == 7);
    var r = parseInt(colorspec.substr(1,2),16);
    var g = parseInt(colorspec.substr(3,2),16);
    var b = parseInt(colorspec.substr(5,2),16);
    return r + g * 256 + b * 65536;
  }

  async createDotmapLayer(layerProxy: LayerProxy, layerDef: LayerDef) {
    var layerOptions: any = {
      // In reality the tiles are served as 512x512, but by claiming 256x256 we load an
      // extra level of detail, and the additional resolution looks nicer, at least on a retina display...
      layerId: layerProxy.id,
      nLevels: 14,
      credit: layerDef['Credits'],
      name: layerDef['Name'],
      tileWidth: 256,
      tileHeight: 256,
      drawOrder: 550
    };

    if (layerDef['Draw Options']?.trim()) {
      try {
        layerOptions.drawOptions = JSON.parse(layerDef['Draw Options']);
      } catch (e) {
        console.log(`${this.logPrefix} Cannot parse Draw Options from dotmap layer ${layerProxy.id}`)
      }
    }

    if (layerDef['AnimationLayers']) {
      return await this.createAnimatedDotmapLayer(layerProxy, layerDef, layerOptions);
    } else {
      return this.createStaticDotmapLayer(layerProxy, layerDef, layerOptions);
    }
  }

  createDotmapLegend(layer: Layer, columnDefs) {
    var legendHTML = `<div style="font-size: 17px">${layer.name}`;
    if (layer.credit) legendHTML += `<span class="credit">(${layer.credit})</span>`;
    legendHTML += '</div>';

    legendHTML += '<div id="colors" style="float: left; padding-right:8px">';
    for (let columnDef of columnDefs) {
      legendHTML += '<div style="float: left; padding-right:8px">';
      legendHTML += `<div style="background-color:${columnDef.color}; width: 12px; height: 12px; float: left; margin-top: 2px; margin-left: 8px;"></div>`;
      legendHTML += `&nbsp;${columnDef.name}</div>`;
    }
    legendHTML += '</div>';
    legendHTML += '</tr>';
    layer.legend = new Legend(layer.layerId, legendHTML);
    layer.hasLegend = true;
  }

  createStaticDotmapLayer(layerProxy: LayerProxy, layerDef: LayerDef, layerOptions: LayerOptions) {
    var tileUrl = `${gEarthTime.dotmapsServerHost}/tilesv2/${layerProxy.id}/{z}/{x}/{y}.box`;
    layerOptions.date = layerDef['Date'];

    layerOptions.setDataFunction = WebGLVectorTile2.prototype._setColorDotmapDataFromBox;
    layerOptions.drawFunction = WebGLVectorTile2.prototype._drawColorDotmap;
    layerOptions.drawLayerFunction = WebGLVectorLayer2.prototype._drawLayerColorDotmap;
    layerOptions.fragmentShader = WebGLVectorTile2Shaders.colorDotmapFragmentShader;
    layerOptions.vertexShader = WebGLVectorTile2Shaders.colorDotmapVertexShader;
    layerOptions.dotmapColors = [];
    layerOptions.dotmapColumnDefs = [] as {name: string, color: string}[];

    for (var c = 1; true; c++) {
      let name = layerDef['PopName' + c];
      if (!name) break;
      let color = layerDef[`Color${c}`];
      layerOptions.dotmapColors.push(this.parse_and_encode_webgl_color(color));
      layerOptions.dotmapColumnDefs.push({name: name, color: color});
    }

    var layer = new WebGLVectorLayer2(layerProxy, gEarthTime.glb, gEarthTime.canvasLayer, tileUrl, layerOptions);
    this.createDotmapLegend(layer, layer.dotmapColumnDefs);
    return layer;
  }

  // Animated dotmap, composed of multiple layers
  async createAnimatedDotmapLayer(layerProxy: LayerProxy, layerDef: LayerDef, layerOptions) {
    var tileUrl = `${gEarthTime.dotmapsServerHost}/tilesv2/${layerProxy.id}/{z}/{x}/{y}.tbox`;

    // Fetch constituent static layers in parallel

    var animationLayerIds = layerDef['AnimationLayers'].replace(/\s/g, '').split('|');
    var animationLayerPromises = [] as Promise<Layer>[];
    for (const id of animationLayerIds) {
      animationLayerPromises.push(gEarthTime.layerDB.getLayer(id).getLayerAsync());
    }
    var animationLayers = await Promise.all(animationLayerPromises);

    // Confirm all layers have the same colors in the same order
    // Collect epoch times for each layer
    var firstLayer = animationLayers[0];

    layerOptions.timelineType = 'defaultUI'
    layerOptions.startDate = animationLayers[0].date;
    layerOptions.endDate = animationLayers[animationLayers.length - 1].date;
    layerOptions.step = 1;
    layerOptions.hasTimeline = true;

    layerOptions.epochs = [];
    for (const checkLayer of animationLayers) {
      var epoch = parseDateStr(checkLayer.date) as number;
      if (isNaN(epoch)) {
        throw `While building ${layerProxy.id}, component ${checkLayer.layerId} is missing parsable Date`;
      }
      layerOptions.epochs.push(epoch);
      if (JSON.stringify(checkLayer.dotmapColors) != JSON.stringify(firstLayer.dotmapColors)) {
        throw `While building ${layerProxy.id}, component layers ${firstLayer.layerId} and ${checkLayer.layerId} must have matching color lists`;
      }
    }

    layerOptions.setDataFunction = WebGLVectorTile2.prototype._setColorDotmapDataFromTbox;
    layerOptions.drawFunction = WebGLVectorTile2.prototype._drawColorDotmapTbox;
    layerOptions.drawLayerFunction = WebGLVectorLayer2.prototype._drawLayerColorDotmap;
    layerOptions.fragmentShader = WebGLVectorTile2Shaders.colorDotmapFragmentShader;
    layerOptions.vertexShader = WebGLVectorTile2Shaders.colorDotmapVertexShaderTbox;

    layerOptions.dotmapColors = firstLayer.dotmapColors;
    var layer = new WebGLVectorLayer2(layerProxy, gEarthTime.glb, gEarthTime.canvasLayer, tileUrl, layerOptions);
    this.createDotmapLegend(layer, firstLayer.dotmapColumnDefs);
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

  // Find first tile with _radius and return _radius
  getRadius(layer) {
    return layer?.radius;
    // Looks like _tiles are no longer accesible
    /*
    var tiles = layer._tileView._tiles;

    for (var key in tiles) {
      if ('_radius' in tiles[key]) {
        return tiles[key]._radius;
      }
    }
    return null;
    */
  }

  handleLayerConstraints(layerProxies: LayerProxy[], setByUser: boolean) {
    let layerDB = gEarthTime.layerDB;
    let newLayersDict = {} as {[key:string]: LayerProxy};
    let layersToTurnOffDict = {} as {[key:string]: LayerProxy};
    let baseLayersToTurnOffDict = {} as {[key:string]: LayerProxy};
    let baseLayersCategoryName = "Base Layers";
    let foundSoloLayer = false;
    let foundExtrasLayer = false;
    let lastPrioritizedBaseLayer: LayerProxy;
    let collectionHasLayerThatIsAlsoItsPairedBaseLayer = false;

    for (let i = layerProxies.length - 1; i >= 0; i--) {
      let layerProxy = layerProxies[i];
      let layerProxyId = layerProxy.id;
      let layer = layerDB.getLayer(layerProxyId);

      // A layer can have a base layer paired with it in the database. However,
      // we don't want this paired layer to show when coming from a share link.
      let hasPairedBaseLayerAndSetByUser = !!layerProxy.baseLayer && setByUser;
      let hasPairedBaseLayerThatIsItself = layerProxy.baseLayer == layerProxyId;
      if (!collectionHasLayerThatIsAlsoItsPairedBaseLayer) {
        collectionHasLayerThatIsAlsoItsPairedBaseLayer = hasPairedBaseLayerThatIsItself;
      }
      if (hasPairedBaseLayerAndSetByUser || collectionHasLayerThatIsAlsoItsPairedBaseLayer) {
        // If we want any layer to act as a base layer.
        if (collectionHasLayerThatIsAlsoItsPairedBaseLayer) {
          lastPrioritizedBaseLayer = layerProxy;
        } else {
          let newLayerProxy = layerDB.getLayer(layerProxy.baseLayer);
          if (newLayerProxy) {
            layerProxies.splice(i, 0, newLayerProxy);
            i = i + 1;
          }
        }
      }

      // Base Layers are radio buttons and thus only one can be up at a time.
      // For legacy purposes though, some base layers have higher precedence.
      if (layerProxy.category == baseLayersCategoryName) {
        if (!hasPairedBaseLayerThatIsItself) {
          baseLayersToTurnOffDict[layerProxyId] = layerProxy;
        }
        if (lastPrioritizedBaseLayer && (setByUser || layerProxy.drawOrder <= lastPrioritizedBaseLayer.drawOrder)) {
          continue;
        } else if (lastPrioritizedBaseLayer && layerProxy.drawOrder > lastPrioritizedBaseLayer.drawOrder) {
          layersToTurnOffDict[lastPrioritizedBaseLayer.id] = lastPrioritizedBaseLayer;
          lastPrioritizedBaseLayer = layerProxy;
        } else {
          lastPrioritizedBaseLayer = layerProxy;
        }
      }

      let layerConstraints = layerProxy.getLayerConstraints();
      if (layerConstraints) {
        if (layerConstraints.isSoloLayer) {
          newLayersDict = {};
          newLayersDict[layerProxyId] = layer;
          foundSoloLayer = true;
          break;
        } else if (Array.isArray(layerConstraints.layersPairedWith)) {
          layerConstraints.layersPairedWith.forEach(layerId => {
            newLayersDict[layerId] = layerDB.getLayer(layerId);
          });
        } else if (Array.isArray(layerConstraints.layersMutuallyExclusiveWith)) {
          layerConstraints.layersMutuallyExclusiveWith.forEach(layerId => {
            layersToTurnOffDict[layerId] = layerDB.getLayer(layerId);
          });
          // We are looping in reverse order. So once we find a layer that has constraints, we remove any others
          // that it is mutually exclusive with (e.g. one that was previously on)
          layerProxies = layerProxies.filter(lp => !layerConstraints.layersMutuallyExclusiveWith.includes(lp.id));
        }
      }

      // Only one layer of type "extras" can be on at once
      if (layerProxyId.indexOf("extras_") == 0) {
        if (!foundExtrasLayer) {
          foundExtrasLayer = true;
        } else {
          layersToTurnOffDict[layerProxyId] = layer;
        }
      }

      newLayersDict[layerProxyId] = layer;
    }

    if (Object.keys(baseLayersToTurnOffDict).length && collectionHasLayerThatIsAlsoItsPairedBaseLayer) {
      Object.assign(layersToTurnOffDict, baseLayersToTurnOffDict);
    }

    // Ensure we always have a base layer up
    if (!lastPrioritizedBaseLayer && !foundSoloLayer) {
      let foundPreviousBaseLayer = false;
      // Look at previous layers that were up and use the base layer from there
      let previousVisibleLayers = layerDB._loadedCache.prevVisibleLayers;
      // If we only had one layer previously up, then this means we only had a base layer up.
      // We need to look at the new set of layers to be turned on and their pre-paired base layers.
      if (previousVisibleLayers.length == 1) {
        for (let i = 0; i < layerProxies.length; i++) {
          let baseLayerProxy = layerDB.getLayer(layerProxies[i].baseLayer);
          if (!lastPrioritizedBaseLayer || baseLayerProxy.drawOrder > lastPrioritizedBaseLayer.drawOrder) {
            lastPrioritizedBaseLayer = baseLayerProxy;
            foundPreviousBaseLayer = true;
          }
        }
      } else {
        // More than one layer previously up, find which one was a base layer.
        for (let i = previousVisibleLayers.length - 1; i >= 0; i--) {
          let layerProxy = previousVisibleLayers[i];
          if (layerProxy.category == baseLayersCategoryName) {
            lastPrioritizedBaseLayer = layerProxy;
            foundPreviousBaseLayer = true;
            break;
          }
        }
      }
      // If for some reason we never had a base layer up, default to Landsat
      if (!foundPreviousBaseLayer && !foundSoloLayer) {
        newLayersDict['blsat'] = layerDB.getLayer('blsat');
      } else {
        newLayersDict[lastPrioritizedBaseLayer.id] = lastPrioritizedBaseLayer;
      }
    }

    let layersIdsToTurnOff = Object.keys(layersToTurnOffDict);
    let newLayers = []
    for (const [layerId, layerProxy] of Object.entries(newLayersDict)) {
      // If this layer is not one of the layers to turn off, add to list.
      if (layersIdsToTurnOff.indexOf(layerId) == -1) {
        if (layerProxy) {
          // Add to beginning, since we previously looped through the layerProxies in reverse order.
          // This way we preserve the correct draw order.
          newLayers.unshift(layerProxy);
        }
      }
    }

    // Set credits for base layers (bottom center of viewport)
    $("#baseLayerCreditContainer").show();
    $("#baselayerCreditText").text("");
    for (let i = newLayers.length - 1; i >= 0; i--) {
      let layerProxy:LayerProxy = newLayers[i];
      if (layerProxy.category != baseLayersCategoryName && layerProxy.layerConstraints.isFullExtent) {
        $("#baseLayerCreditContainer").hide();
        break;
      }
      if (layerProxy.category == baseLayersCategoryName || layerProxy.layerConstraints.isSoloLayer) {
        $("#baselayerCreditText").text(layerProxy.credits);
        break;
      }
    }

    return newLayers;
  }

  clearNonVisibleLayerLegends() {
    let layerDB = gEarthTime.layerDB;
    let visibleLayers = layerDB.visibleLayers;
    let layerProxyLegendsToHide = layerDB._loadedCache.prevVisibleLayers.filter(layerProxy => !visibleLayers.includes(layerProxy));
    layerProxyLegendsToHide.forEach(function(layerProxy) {
      let layer = layerProxy.layer;
      if (layer && layer.hasLegend) {
        layer.legendVisible = false;
      }
    });
    let layerIds = visibleLayers.map(layer => layer.id);
    let layerIdsSelector = layerIds.map(function(id) { return `#${id}-legend`; }).join(', ');
    $("#legend-content table tr").not(layerIdsSelector).remove();
  }

  handleLayerMenuUI() {
    let layerDB = gEarthTime.layerDB;
    let $layerListContainer = $(".map-layer-div");
    let $clearLayerBtn = $(".clearLayers");
    let newVisibleLayerIds = layerDB.visibleLayerIds();
    let previousVisibleLayerIds = layerDB._loadedCache.prevVisibleLayers.map(layerProxy => layerProxy.id);
    let layersIdsToTurnOff = previousVisibleLayerIds.filter(layerId => !newVisibleLayerIds.includes(layerId));
    let layersIdsToTurnOn = newVisibleLayerIds.filter(layerId => !previousVisibleLayerIds.includes(layerId));
    let $layerElmsToTurnOff = $();
    let $layerElmsToTurnOn = $();

    // Remove checkmarks from layers in Data Library that were active at the time of new layer(s) being set but not still active now.
    if (layersIdsToTurnOff.length) {
      let layerSelectors = '#' + layersIdsToTurnOff.join(', #');
      $layerElmsToTurnOff = $layerListContainer.find(layerSelectors);
      $layerElmsToTurnOff.prop("checked", false);

      for (let layerId of layersIdsToTurnOff) {
        let layerProxy = layerDB.getLayer(layerId);
        // TODO: Should probably do this somewhere else.
        // TODO: Would be good to have a way to see if the layer is actually loading.
        // Right now, isLoading() *always* returns true for all layers except timemachines.
        // That said, abortLoading() will only cancel if the xhr request is in progress, so we are not unecessarily aborting here.
        if (layerProxy.layer) {
          layerProxy.layer.abortLoading();
        }
      }
    }

    // Add checkmarks to layers in Data Library corresponding to what layers are newly visible and not already previously checked.
    if (layersIdsToTurnOn.length) {
      let layerSelectors = '#' + layersIdsToTurnOn.join(', #');
      $layerElmsToTurnOn = $layerListContainer.find(layerSelectors);
      $layerElmsToTurnOn.not(":checked").prop("checked", true);
    }

    // Is LODES being turned on/off?
    if (layersIdsToTurnOn.includes("lodes") || layersIdsToTurnOff.includes("lodes")) {
      let lodesLayer = layerDB.getLayer("lodes");
      // @ts-ignore
      lodesLayer.layer.lodes.lodesGui.toggle();
    }

    // Show/hide the clear active layers button.
    // Don't show it if only a base layer is up.
    if (newVisibleLayerIds.length <= 1) {
      $clearLayerBtn.hide();
    } else {
      $clearLayerBtn.show();
    }

    // Show black dot indicator in a category with active layers, exlcuding the base layers category.
    let layerElemCategoryIds =  $layerElmsToTurnOff.add($layerElmsToTurnOn).map((idx, layerElm) => $(layerElm).prop("name")).toArray()
    layerElemCategoryIds = layerElemCategoryIds.filter((data, idx) => {
      return layerElemCategoryIds.indexOf(data) === idx && data !== "category-base-layers";
    })
    layerElemCategoryIds.forEach(function(categoryId) {
      let $layerCategory = $("#" + categoryId);
      let numLayersActiveInCurrentCategory = $layerCategory.find("input:checked").length;
      let $layerCategoryHeader = $layerCategory.prev();
      if (numLayersActiveInCurrentCategory > 0) {
        $layerCategoryHeader.append("<span class='ui-icon ui-icon-bullet active-layers-in-category'>");
      } else {
        $layerCategoryHeader.find(".active-layers-in-category").remove();
      }
    })

  }

  handleVisibleLayersUIStateChange() {
    // Clear out layer legends for layers no longer visible
    this.clearNonVisibleLayerLegends();
    // Handle the UI changes for a layer turning on and off (like input checkboxes)
    this.handleLayerMenuUI();
    // We need to trigger the change event (index.ts) on the inputs for the layer list container.
    $(".map-layer-div").find("input:first").trigger("change");
  }

  firstAvailableTileTexture(layer) {
    var tiles = layer.getTiles();
    for (var key in tiles) {
      if ('_texture' in tiles[key]) {
        return tiles[key]._texture;
      }
    }
    return null;
  }

  setLegend(id: string) {
    let layer: Layer;
    let legend;
    let visibleLayers = gEarthTime.layerDB.visibleLayers;
    for (var i = 0; i < visibleLayers.length; i++) {
      if (visibleLayers[i].id == id) {
        layer = visibleLayers[i].layer;
        break;
      }
    }

    if (layer) {
      if (layer.legendContent?.toLowerCase() == 'none') {
        return;
      }
      if (layer.legend) {
        legend = layer.legend;
      } else if (layer.mapType == 'bubble') {
        if (layer.legendContent == 'auto') {
          var radius = this.getRadius(layer);
          if (!radius || !radius.hasOwnProperty('invert')) {
            return;
          }
          var opts = {
            'id' : id,
            'title': layer.name,
            'credit': layer.credit,
            'keys': [],
            'circles': [{'value': this.formatValue(radius.invert(50.0)), 'radius': '25.0'},{'value': this.formatValue(radius.invert(80.0)), 'radius': '40.0'},{'value': this.formatValue(radius.invert(100.0)), 'radius': '50.0'}]
          };
          if (layer.legendKey) {
            if (layer.color) {
              var rgba:number[] = layer.color.map(function(x: number) {
                return Math.floor(x * 255.);
              });
            } else {
              var rgba:number[] = [15,15,15];
            }
            opts.keys.push({'color': 'rgb('+ rgba[0] +',' + rgba[1] +',' + rgba[2] + ')', 'str': layer.legendKey});
          }
          legend = new BubbleMapLegend(opts);
        } else {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          var str = div + layer.legendContent;
          let opts = {
            'id' : id,
            'str': str
          }
          legend = new BubbleMapLegend(opts);
        }
      } else if (layer.mapType == 'choropleth') { // Assume choropleth
        if (layer.legendContent == 'auto') {
          var radius = this.getRadius(layer);
          var gl = gEarthTime.glb.gl;
          var drawOptions = layer.drawOptions;
          var values = [];
          var colors:any[];
          var colorMap;

          var colorList = drawOptions?.colorMapColorsList;
          var colorMapLegendLabels = drawOptions?.colorMapLegendLabels;

          if (colorList && colorMapLegendLabels) {
            for (var i = 0; i < colorMapLegendLabels.length; i++) {
              var value = colorMapLegendLabels[i];
              if (typeof(value) == "number") {
                value = this.formatValue(value);
              }
              values.push(value);
            }
            // If discrete colors
            if (Array.isArray(colorList)) {
              colorMap = null;
              colors = drawOptions.colorMapColorsList;
            } else { // Is gradient, pull texture info
              // Default size of our colormaps
              var width = 256;
              var height = 1;

              // Create a framebuffer backed by the texture
              var framebuffer = gl.createFramebuffer();
              gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
              gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.firstAvailableTileTexture(layer), 0);

              // Read the contents of the framebuffer
              var data = new Uint8Array(width * height * 4);
              gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

              gl.deleteFramebuffer(framebuffer);

              // Create a 2D canvas to store the result
              var canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              var context = canvas.getContext('2d');

              // Copy the pixels to a 2D canvas
              var imageData = context.createImageData(width, height);
              imageData.data.set(data);
              context.putImageData(imageData, 0, 0);

              colorMap = canvas.toDataURL();
            }
          } else if (radius && typeof(radius.invert) == "function") {
            values = [this.formatValue(radius.invert(0)), this.formatValue(radius.invert(0.5)), this.formatValue(radius.invert(1))];
            // TODO: Do we need these default values? Do they correspond to default values used in the actual visual?
            colors = ["#ffffff", "#fff18e", "#ffdc5b", "#ffc539", "#ffad21", "#ff920c", "#ff7500", "#ff5000", "#ff0000"];
            colorMap = layer.imageSrc;
          } else {
            return;
          }

          let opts = {
            'id': id,
            'title': layer.name,
            'credit': layer.credit,
            'keys': [],
            'colors': colors,
            'values': values,
            'colorMap': colorMap
          }
          if (layer.legendKey) {
            opts.keys.push({'str': layer.legendKey});
          }
          legend = new ChoroplethLegend(opts);
        } else {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          var str = div + layer.legendContent;
          let opts = {
            'id' : id,
            'str': str
          }
          legend = new ChoroplethLegend(opts);
        }
      } else {
        var str = '';
        if (layer.legendContent) {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          str = div + layer.legendContent;
        } else {
          var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> ('+ layer.credit +')</span></div>';
          str = div;
        }
        legend = new Legend(id, str);
      }
      if (!layer.legendVisible) {
        layer.legendVisible = true;
        let $legendContainer = $("#layers-legend");
        $legendContainer.show().find("table").first().append(legend.toString());
        // Fit auto legends to its content
        if ((legend instanceof BubbleMapLegend || legend instanceof ChoroplethLegend) && legend.keys.length > 0) {
          let $svgContainer = $(`#legend-content #${legend.id}-legend .svg-legend`);
          let $svgTextElms = $svgContainer.find("text");
          // TODO: For some reason the thumbnail server ends up failing to render, with no text elements being found.
          // They should exist though, so perhaps it is a race condition of adding content to the DOM and then querying
          // for it right after? Adding this check fixes that error. There doesn't appear to be any problem with the API call
          // for the legend HTML or viewing the layer normally in the browser.
          if ($svgTextElms.length) {
            // Bubble maps will have a circle preceding the legend key text
            let extraPadding = legend instanceof BubbleMapLegend ? 32 : 0;
            let newWidth = Math.max(legend.width, Math.round($svgTextElms[0].getBBox().width + extraPadding));
            $svgContainer[0].setAttribute("width", newWidth.toString());
          }
        }
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

    var suffix = name.slice(prefix.length).trim();

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
    name = name.replace('Webgl', 'WebGL').trim();
    name = name.replace('WebGLVectorTile.', 'WebGLVectorTile2.');
    if (mapType == 'raster') {
      var prefix = 'WebGLMapTile.prototype.';
      var parent: any = WebGLMapTile.prototype;
      if (funcType == "drawLayerFunction") {
        prefix = "WebGLMapLayer.prototype.";
        parent = WebGLMapLayer.prototype;
      }
    } else if (mapType == 'raster2') {
      var prefix = 'WebGLMapTile2.prototype.';
      var parent: any = WebGLMapTile2.prototype;
    } else if (mapType == 'vector' && funcType == "drawLayerFunction") {
      var prefix = 'WebGLVectorLayer2.prototype.';
      var parent: any = WebGLVectorLayer2.prototype;
    } else if (mapType == 'point' && funcType == 'draw' && name.split('(')[0] == 'WebGLVectorTile2.basicDrawPoints') {
      var prefix = 'WebGLVectorTile2.prototype.';
      var parent: any = WebGLVectorTile2.prototype;
      name = 'WebGLVectorTile2.prototype._drawBasicPoints';
    } else {
      var prefix = 'WebGLVectorTile2.prototype.';
      var parent: any = WebGLVectorTile2.prototype;
    }

    if (!name.startsWith(prefix)) {
      throw new LayerDefinitionError(`Function ${name} for layer type ${mapType} must begin with ${prefix}`);
    }
    var suffix = name.slice(prefix.length);
    if (funcType == 'draw') {
      var re = /^_draw\w*$/;
    } else if (funcType == 'setData') {
      var re = /^_set\w*Data\w*$/;
    } else if (funcType == 'loadData') {
      var re = /^_load\w*Data\w*$/;
    } else if (funcType == 'drawLayerFunction') {
      var re = /^_drawLayer\w*$/;
    } else {
      throw Error(`unknown funcType ${funcType}`);
    }

    if (!re.test(suffix)) {
      throw new LayerDefinitionError(`${suffix} is not a valid ${funcType} function name`);
    }
    if (!parent[suffix]) {
      if (funcType == 'setData' && suffix == '_setSitc4r2Data') {
        suffix = '_setBufferData';
      } else {
        throw new LayerDefinitionError(`Cannot find ${funcType} function "${name}"`);
      }
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
