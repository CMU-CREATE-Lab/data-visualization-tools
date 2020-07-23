/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>
/// <reference path="WebGLVectorTile2.js"/>

import { LayerDB } from './LayerDB';
import { Utils } from './Utils';
import { gEarthTime } from './EarthTime';

declare var EARTH_TIMELAPSE_CONFIG;

export class LayerOptions {
  id: string
  name: string
  category: string
  nLevels?: number
  credit?: string
  drawOptions?: object
  tileWidth?: number
  tileHeight?: number
  date?: string
  loadDataFunction?: () => any
  setDataFunction?: () => any
  drawFunction?: () => any
  numAttributes?: number
  fragmentShader?: string
  layerDef: {[key: string]: string}
  vertexShader?: string
  dotmapColors?: number[]
  epochs?: number[]
  z?: number
  colormap?: string
  avoidShowingChildAndParent?: boolean
  rootUrl?: string
  greenScreen?: boolean
  useTmJsonTimeTicks?: boolean

  customSliderInfo?: {[key: string]: any}
  timelineType?: string
  hasTimeline?: boolean
  startDate?: string
  endDate?: string
  step?: number

  showGraph?: boolean
  mapType?: string
  color?: any
  legendContent?: string
  legendKey?: string
  setDataOptions?: {[key: string]: any}
  scalingFunction?: string
  colorScalingFunction?: string
  externalGeojson?: string
  nameKey?: string
  playbackRate?: string
  masterPlaybackRate?: string
  imageSrc?: string
  paired?: boolean
}

export interface DrawOptions {
  gmapsZoomLevel?: number;
  throttle?: number;
  epoch?: number;
  pointSize?: number;
  currentBValue?: number;
  zoom?: number
  currentTime?: Date
  span?: number
  subsampleAnnualRefugees?: boolean
  pointIdx?: any
  currentC?: number
  color?: [number, number, number, number]
  idx?: number
  buffers?: any
}

interface Timelapse {
  [key: string]: any;
}

export interface LayerDef {
  'Start date'?: string,
  'End date'?: string
}

export class LayerProxy extends LayerOptions {
  database: LayerDB;
  _visible: boolean;
  showGraph: boolean;
  _tileView?: any; // TODO(LayerDB): add the _tileView
  _loadingPromise: Promise<void>;
  _loaded: boolean
  options: any; // TODO: consider moving things out of options and using setDataOptions, drawOptions
  layer: any;

  constructor(id: string, database: LayerDB) {
    console.assert(LayerProxy.isValidId(id));
    super();
    this.id = id;
    this.database = database;
  }

  isVisible(): boolean {
    return this._visible;
  }

  log(arg1, ...args) {
    Utils.timelog(`Layer ${this.id}: ${arg1}`, ...args);
  }

  requestLoad() {
    if (!this._loaded && !this._loadingPromise) {
      this._loadingPromise = this._load();
    }
  }

  async _load() {
    //ret.catalog = 
    let url = `${this.database.apiUrl}layer-catalogs/${this.database.databaseId.file_id_gid()}/layers/${this.id}`
    this.log(`Fetching ${url}`)
    let layerDef: LayerDef = await (await Utils.fetchWithRetry(url)).json();
    this.layer = this.database.layerFactory.createLayer(layerDef);
    this.log(`Loaded, layer=`, this.layer);
    this._loaded = true;
    //this.loadFromLayerDef(layerDef);
  }

  // Signal layer didn't completely draw by returning false, or settings timelapse.lastFrameCompletelyDrawn false
  draw(view, options) {
    if (this._loaded) {
      this.layer.draw(view, options);
      return undefined;
    } else {
      this.requestLoad();
      return false;
    }
  }


  // TODO(LayerDB) make sure that when time range changes, the timeline updates
  updateData(newDataProperties, refreshData, isLast) {
    if (newDataProperties) {
      $.extend(true, this, newDataProperties);
    }
    if (refreshData) {
      // TODO(LayerDB): destroy the tiles here
      //this.destroy(); //update tiles to use new data
    }
    // if (refreshTimeline) {
    //   timelines.setTimeLine(layer.id, layer.startDate, layer.endDate, layer.step);
    //   var cachedLayerTimelinePath = layer.id + ".json";
    //   //TODO determine timeline styling
    //   requestNewTimeline(cachedLayerTimelinePath, "defaultUI"); //update timeline to match new date range
    // }
  }

  // Valid share link ID is composed of A-Z, a-z, 0-9, underscore, dash
  static isValidId(id: string) {
    return !!id.match(/^[\w-]+$/);
  }

  static formatValue(value: number) {
    for (var suffix of ['', 'K', 'M', 'G', 'T', 'P']) {
      if (suffix == 'P' || Math.abs(value) < 1000) break;
      value /= 1000;
    }
    // Round to 2 digits, remove trailing zeros, and add suffix
    return value.toFixed(2).replace(/\.?0+$/, '') + suffix;
  }

  static loadDataFunctions = [
    "_loadBivalentBubbleMapDataFromCsv",
    "_loadBubbleMapDataFromCsv",
    "_loadCarbonPriceRiskDataFromCsv",
    "_loadChoroplethMapDataFromCsv",
    "_loadData",
    "_loadGeojsonData",
    "_loadSitc4r2Data",
    "_loadWindVectorsData"
  ];

  static setDataFunctions = [
    "_setAnimatedGlyphData",
    "_setAnimatedPointsData",
    "_setBufferData",
    "_setBuffers",
    "_setColorDotmapData",
    "_setExpandedLineStringData",
    "_setGlyphData",
    "_setIomIdpData",
    "_setLineStringData",
    "_setObesityData",
    "_setPointData",
    "_setPolygonData",
    "_setSitc4r2Buffer",
    "_setTrajectoriesData",
    "_setTriangleData",
    "_setVaccineConfidenceData",
    "_setWindVectorsData"
  ]  

  // loadFromLayerDef(layerDef): void {
  //   var layerOptions: LayerOptions = {
  //     id: layerDef["Share link identifier"].replace(/([^\w-])+/g, '_'),
  //     name: layerDef["Name"],
  //     category: layerDef["Category"],
  //     tileWidth: 256,
  //     tileHeight: 256,
  //     loadDataFunction: WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv,
  //     drawFunction: WebGLVectorTile2.prototype._drawBubbleMap,
  //     fragmentShader: WebGLVectorTile2.bubbleMapFragmentShader,
  //     vertexShader: WebGLVectorTile2.bubbleMapVertexShader,
  //     numAttributes: 6,
  //     layerDef: layerDef
  //   };
  //   layerOptions.customSliderInfo = {};
  //   if (layerDef["Custom slider ticks"]) {
  //     try {
  //       var rawCustomSliderInfo = JSON.parse(layerDef["Custom slider ticks"].trim());
  //       for (var i = 0; i < rawCustomSliderInfo.length; i++) {
  //         layerOptions.customSliderInfo[rawCustomSliderInfo[i][0]] = rawCustomSliderInfo[i][1];
  //       }
  //     }
  //     catch (e) {
  //       console.log("ERROR: Cannot parse 'Custom slider ticks'. Is valid json being used there?");
  //     }
  //   }
  //   layerOptions.timelineType = layerDef["Timeline Type"];
  //   if (layerDef["Start date"] != "" && layerDef["Start date"] != layerDef["End date"] || !$.isEmptyObject(layerOptions.customSliderInfo)) {
  //     layerOptions.hasTimeline = true;
  //   }
  //   else {
  //     layerOptions.hasTimeline = false;
  //   }
  //   layerOptions.startDate = layerDef["Start date"];
  //   layerOptions.endDate = layerDef["End date"];
  //   layerOptions.step = layerDef["Step"] || 1;
  //   layerOptions.showGraph = (layerDef["Show Graph"] || '').toLowerCase() == 'true';
  //   layerOptions.mapType = layerDef["Map Type"] || "bubble";
  //   layerOptions.color = layerDef["Color"] ? JSON.parse(layerDef["Color"]) : null;
  //   layerOptions.legendContent = layerDef["Legend Content"];
  //   layerOptions.legendKey = layerDef["Legend Key"];
  //   if (typeof layerDef["Draw Options"] != "undefined" && layerDef["Draw Options"] != "") {
  //     layerOptions.drawOptions = JSON.parse(layerDef["Draw Options"]);
  //   }
  //   if (typeof layerDef["Set Data Options"] != "undefined" && layerDef["Set Data Options"] != "") {
  //     layerOptions.setDataOptions = JSON.parse(layerDef["Set Data Options"]);
  //   }
  //   var url = layerDef["URL"].replace("http://", "https://");
  //   var useLocalData = false;
  //   // Change a *subset* of layer URLs to be local
  //   // Assumes the layer ID is being passed in to the localCsvLayers array
  //   if (EARTH_TIMELAPSE_CONFIG.localCsvLayers) {
  //     for (var i = 0; i < EARTH_TIMELAPSE_CONFIG.localCsvLayers.length; i++) {
  //       if (layerOptions.id == EARTH_TIMELAPSE_CONFIG.localCsvLayers[i]) {
  //         useLocalData = true;
  //         break;
  //       }
  //     }
  //     // Change *all* layer URLs (if they match a domain) to be local
  //   }
  //   else if (EARTH_TIMELAPSE_CONFIG.useCsvLayersLocally) {
  //     useLocalData = true;
  //   }
  //   // TODO: Right now we only handle local storage of data that was stored at tiles.earthtime.org
  //   if (useLocalData && layerDef["URL"].indexOf("tiles.earthtime.org") > 0) {
  //     url = layerDef["URL"].replace(/https*:\/\/tiles.earthtime.org/, gEarthTime.rootTilePath);
  //   }
  //   layerOptions.credit = layerDef["Credits"];
  //   // TODO(LayerDB): check these
  //   layerOptions.scalingFunction = layerDef["Scaling"] || 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])';
  //   layerOptions.colorScalingFunction = layerDef["Color Scaling"] || 'd3.scaleLinear().domain([minColorValue, maxColorValue]).range([0, 1])';
  //   layerOptions.externalGeojson = layerDef["External GeoJSON"];
  //   layerOptions.nameKey = layerDef["Name Key"]; // Optional GeoJSON property name with which to join features with first column of data
  //   var category_id = layerOptions.category ? "category-" + layerOptions.category.trim().replace(/ /g, "-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase() : "csvlayers_table";
  //   layerOptions.playbackRate = layerDef["Playback Rate"] || null;
  //   layerOptions.masterPlaybackRate = layerDef["Master Playback Rate"] || null;
  //   layerOptions.nLevels = layerDef["Number of Levels"] ? parseInt(layerDef["Number of Levels"]) : 0;
  //   layerOptions.imageSrc = layerDef["Colormap Src"] || null;
  //   // By default, most CSV layers draw at z=400.  Raster and choropleths by default will draw at z=200.  New raster base maps will draw at z=100.
  //   layerOptions.z = 400;
  //   var layerClass: any = WebGLVectorLayer2;
  //   if (layerOptions.mapType == 'raster') {
  //     if (layerOptions.category == "Base Maps") {
  //       layerOptions.z = 100;
  //     }
  //     else {
  //       layerOptions.z = 200;
  //     }
  //     layerClass = WebGLMapLayer;
  //     var url = eval(url);
  //     layerOptions.loadDataFunction = null;
  //     layerOptions.drawFunction = null;
  //     layerOptions.fragmentShader = null;
  //     layerOptions.vertexShader = null;
  //     if (layerOptions.imageSrc) {
  //       layerOptions.colormap = layerOptions.imageSrc;
  //     }
  //     LayerProxy.overrideDrawingFns(layerOptions, layerDef);
  //   }
  //   else if (layerOptions.mapType == 'raster2') {
  //     layerClass = WebGLMapLayer2;
  //     url = eval(url);
  //     layerOptions.loadDataFunction = null;
  //     layerOptions.drawFunction = null;
  //     layerOptions.fragmentShader = null;
  //     layerOptions.vertexShader = null;
  //     if (layerOptions.imageSrc) {
  //       layerOptions.colormap = layerOptions.imageSrc;
  //     }
  //     LayerProxy.overrideDrawingFns(layerOptions, layerDef);
  //   }
  //   else if (layerOptions.mapType == "choropleth") {
  //     layerOptions.avoidShowingChildAndParent = true;
  //     layerOptions.imageSrc = layerOptions.imageSrc || "obesity-color-map.png";
  //     layerOptions.z = 200;
  //     layerOptions.loadDataFunction = WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv;
  //     layerOptions.drawFunction = WebGLVectorTile2.prototype._drawChoroplethMap;
  //     layerOptions.fragmentShader = WebGLVectorTile2.choroplethMapFragmentShader;
  //     layerOptions.vertexShader = WebGLVectorTile2.choroplethMapVertexShader;
  //   }
  //   else if (layerOptions.mapType == "point-flow") {
  //     layerOptions.loadDataFunction = WebGLVectorTile2.prototype._loadData;
  //     LayerProxy.overrideDrawingFns(layerOptions, layerDef);
  //   }
  //   else if (layerOptions.mapType == "timemachine") {
  //     layerOptions.rootUrl = url;
  //     if (layerOptions.setDataOptions) {
  //       layerOptions.greenScreen = layerOptions.setDataOptions.useGreenScreen;
  //       layerOptions.useTmJsonTimeTicks = layerOptions.setDataOptions.useTmJsonTimeTicks;
  //     }
  //     layerOptions.loadDataFunction = null;
  //     layerOptions.drawFunction = null;
  //     layerOptions.fragmentShader = null;
  //     layerOptions.vertexShader = null;
  //     if (layerOptions.imageSrc) {
  //       layerOptions.colormap = layerOptions.imageSrc;
  //     }
  //     layerClass = WebGLTimeMachineLayer;
  //     LayerProxy.overrideDrawingFns(layerOptions, layerDef);
  //   }
  //   else {
  //     if (layerDef["Load Data Function"]) {
  //       layerOptions.loadDataFunction = LayerProxy.getFunction(layerOptions.mapType, 'loadData', layerDef["Load Data Function"]);
  //     }
  //     if (layerDef["Set Data Function"]) {
  //       layerOptions.loadDataFunction = LayerProxy.getFunction(layerOptions.mapType, 'setData', layerDef["Set Data Function"]);
  //     }
  //     LayerProxy.overrideDrawingFns(layerOptions, layerDef);
  //   }

  //   // Extend the current layer
  //   $.extend(true, this, layerOptions);

  //   //var layer = new layerClass(glb, canvasLayer, url, layerOptions);
  //   this.options = this.options || {};
  //   if (layerOptions.color) {
  //     this.options.color = layerOptions.color;
  //   }
  //   if (layerOptions.drawOptions) {
  //     let obj = layerOptions.drawOptions;
  //     for (const key in obj) {
  //       let value = obj[key];
  //       this.options[key] = value;
  //     }
  //     this.options.drawOptions = layerOptions.drawOptions;
  //   }
  //   if (layerOptions.setDataOptions) {
  //     let obj = layerOptions.setDataOptions;
  //     for (const key in obj) {
  //       let value = obj[key];
  //       this.options[key] = value;
  //     }
  //     this.options.setDataOptions = layerOptions.setDataOptions;
  //   }
  //   // Comparison-mode, left and right half-circles
  //   var re = /_paired/;
  //   var m = layerOptions.id.match(re);
  //   if (m) {
  //     this.paired = true;
  //   }
  //   else {
  //     this.paired = false;
  //   }
  //   this._loaded = true;
  // }

  // static overrideDrawingFns(layerOptions: LayerOptions, layerDef: LayerDef) {
  //   var drawFunction = layerDef["Draw Function"];
  //   if (drawFunction) {
  //     layerOptions.drawFunction = LayerProxy.getFunction(layerOptions.mapType, 'draw', drawFunction);
  //   }
  //   if (layerDef["Number of Attributes"]) {
  //     layerOptions.numAttributes = parseInt(layerDef["Number of Attributes"]);
  //   }

  //   var vertexShader = layerDef["Vertex Shader"];
  //   if (vertexShader) {
  //     layerOptions.vertexShader = LayerProxy.getShader(layerOptions.mapType, vertexShader, "Vertex");
  //   }
    
  //   var fragmentShader = layerDef["Fragment Shader"];
  //   if (fragmentShader) {
  //     layerOptions.fragmentShader = LayerProxy.getShader(layerOptions.mapType, fragmentShader, "Fragment");
  //   }
  // }

  todoPortMe() { // TODO(rsargent)

    // addExtrasContent(layerDef) {
    //   var playbackRate = layerDef["Playback Rate"].trim() == '' ? 1 : layerDef["Playback Rate"].trim();
    //   var dataType = layerDef["Map Type"].split("-")[1];
    //   var dataFilePath = layerDef["URL"];
    //   var shareLinkIdentifier = layerDef["Share link identifier"].replace(/\W+/g, '_');
    //   var dataName = layerDef["Name"];
    //   var extrasOptions = {};
    //   if (typeof layerDef["Extras Options"] != "undefined" && layerDef["Extras Options"] != "") {
    //     extrasOptions = JSON.parse(layerDef["Extras Options"]);
    //   }
    //   var str = '<option data-playback-rate="' + playbackRate + '"';
    //   str += ' data-type="' + dataType + '"';
    //   str += ' data-file-path="' + dataFilePath + '"';
    //   str += ' data-name="' + shareLinkIdentifier + '"';
    //   if (extrasOptions.loop) {
    //     str += ' data-loop="' + extrasOptions.loop + '"';
    //   }
    //   if (extrasOptions.muted) {
    //     str += ' data-muted="' + extrasOptions.muted + '"';
    //   }
    //   if (extrasOptions.controls) {
    //     str += ' data-controls="' + extrasOptions.controls + '"';
    //   }
    //   if (extrasOptions['object-fit']) {
    //     str += ' data-objectfit="' + extrasOptions['object-fit'] + '"';
    //   }
    //   str += '>' + dataName + '</option>';
    //   $('#extras-selector').append(str);
    // }


    // addDataLoadedListener(listener) {
    //   if (typeof (listener) === "function") {
    //     this.dataLoadedListeners.push(listener);
    //   }
    // }
    // removeDataLoadedListener(listener) {
    //   for (var i = 0; i < this.dataLoadedListeners.length; i++) {
    //     if (this.dataLoadedListeners[i] == listener) {
    //       this.dataLoadedListeners.splice(i, 1);
    //       break;
    //     }
    //   }
    // }

    //   // Find first tile with _radius and return _radius
    //   getRadius(layer) {
    //     var tiles = layer._tileView._tiles;
    //     for (var key in tiles) {
    //       if ('_radius' in tiles[key]) {
    //         return tiles[key]._radius;
    //       }
    //     }
    //     return null;
    //   }
    //   setLegend(id) {
    //     var layer;
    //     for (var i = 0; i < this.layers.length; i++) {
    //       if (this.layers[i].layerId == id) {
    //         layer = this.layers[i];
    //         break;
    //       }
    //     }
    //     if (typeof layer != 'undefined') {
    //       if (layer.legendContent.toLowerCase() == 'none') {
    //         return;
    //       }
    //       if (layer.mapType == 'bubble') {
    //         if (layer.legendContent == 'auto') {
    //           var radius = this.getRadius(layer);
    //           var opts = {
    //             'id': id,
    //             'title': layer.name,
    //             'credit': layer.credit,
    //             'keys': [],
    //             'circles': [{ 'value': this.formatValue(radius.invert(50.0)), 'radius': '25.0' }, { 'value': this.formatValue(radius.invert(80.0)), 'radius': '40.0' }, { 'value': this.formatValue(radius.invert(100.0)), 'radius': '50.0' }]
    //           };
    //           if (layer.legendKey) {
    //             if (layer.color) {
    //               var rgba = layer.color.map(function(x) {
    //                 return Math.floor(x * 255.);
    //               });
    //             }
    //             else {
    //               var rgba = [15, 15, 15];
    //             }
    //             opts.keys.push({ 'color': 'rgb(' + rgba[0] + ',' + rgba[1] + ',' + rgba[2] + ')', 'str': layer.legendKey });
    //           }
    //           var legend = new BubbleMapLegend(opts);
    //           $('#legend-content table tr:last').after(legend.toString());
    //           $("#" + id + "-legend").show();
    //         }
    //         else {
    //           var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> (' + layer.credit + ')</span></div>';
    //           var str = div + layer.legendContent;
    //           var opts = {
    //             'id': id,
    //             'str': str
    //           };
    //           var legend = new BubbleMapLegend(opts);
    //           $('#legend-content table tr:last').after(legend.toString());
    //           $("#" + id + "-legend").show();
    //         }
    //       }
    //       else if (layer.mapType == 'choropleth') { // Assume choropleth
    //         if (layer.legendContent == 'auto') {
    //           var radius = this.getRadius(layer);
    //           var opts = {
    //             'id': id,
    //             'title': layer.name,
    //             'credit': layer.credit,
    //             'keys': [],
    //             'colors': ["#ffffff", "#fff18e", "#ffdc5b", "#ffc539", "#ffad21", "#ff920c", "#ff7500", "#ff5000", "#ff0000"],
    //             'values': [this.formatValue(radius.invert(0)), this.formatValue(radius.invert(0.5)), this.formatValue(radius.invert(1))],
    //             'colorMap': layer.imageSrc
    //           };
    //           if (layer.legendKey) {
    //             opts.keys.push({ 'str': layer.legendKey });
    //           }
    //           var legend = new ChoroplethLegend(opts);
    //           $('#legend-content table tr:last').after(legend.toString());
    //           $("#" + id + "-legend").show();
    //         }
    //         else {
    //           var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> (' + layer.credit + ')</span></div>';
    //           var str = div + layer.legendContent;
    //           var opts = {
    //             'id': id,
    //             'str': str
    //           };
    //           var legend = new ChoroplethLegend(opts);
    //           $('#legend-content table tr:last').after(legend.toString());
    //           $("#" + id + "-legend").show();
    //         }
    //       }
    //       else {
    //         var str = '';
    //         if (layer.legendContent == '') {
    //           var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> (' + layer.credit + ')</span></div>';
    //           str = div;
    //         }
    //         else {
    //           var div = '<div style="font-size: 15px">' + layer.name + '<span class="credit"> (' + layer.credit + ')</span></div>';
    //           str = div + layer.legendContent;
    //         }
    //         var opts = {
    //           'id': id,
    //           'str': str
    //         };
    //         var legend = new Legend(id, str);
    //         $('#legend-content table tr:last').after(legend.toString());
    //         //if (layer.mapType != 'raster') {
    //         $("#" + id + "-legend").show();
    //         //}
    //       }
    //     }
    //   }
  }
}

function todoPortMe() { // TODO(rsargent)
  // TODO: don't load country polygons until first use, by switching everything to use
  // COUNTRY_POLYGONS_RESOURCE, and removing the receiveData clause below

  // var COUNTRY_POLYGONS;
  // var COUNTRY_POLYGONS_RESOURCE =
  //     new Resource("country_polygons.geojson",
  //      {
  //        transform: parseAndIndexGeojson.bind(null, 'names'),
  //        receiveData: function(data) {
  //          COUNTRY_POLYGONS = data;
  //        }
  //      });

  // function searchCountryList(feature_collection, name, name_key) {
  //   if (typeof feature_collection["hash"] !== "undefined") {
  //     return feature_collection["features"][feature_collection["hash"][name]];
  //   }
  //   for (var i = 0; i < feature_collection['features'].length; i++) {
  //     var feature = feature_collection['features'][i];
  //     if (typeof name_key != "undefined") {
  //       if (name == feature["properties"][name_key]) {
  //         return feature;
  //       }
  //     } else {
  //       var names = feature['properties']['names'];
  //       if (typeof names == "undefined") {
  //         if (name == feature["properties"]["GEOID10"]) {
  //           return feature;
  //         }
  //       } else {
  //         for (var j = 0; j < names.length; j++) {
  //           if (name == names[j]) {
  //             //return feature['properties']['webmercator'];
  //             return feature;
  //           }
  //         }
  //       }
  //     }
  //   }
  //   return {};
  // };
}

