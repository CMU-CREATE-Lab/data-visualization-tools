import { EarthTime } from './EarthTime'
import { GSheet } from './GSheet'
import { LayerFactory } from './LayerFactory'
import { LayerProxy } from './LayerProxy'
import { Utils } from './Utils'

class LayerCatalogEntry {
  Category: string;
  Name: string;
  'Share link identifier': string;
};

export class LayerDB {
  databaseId: GSheet;
  layerFactory: LayerFactory;
  apiUrl: string;
  layerById: {[layerId: string]: LayerProxy};
  orderedLayers: LayerProxy[] = [];
  shownLayers: LayerProxy[] = [];
  earthTime: EarthTime;
    
  // Please call async LayerDB.create instead
  private constructor() {}

  static logPrefix() {
    return `${Utils.logPrefix()} LayerDB`;
  }

  // async factory, since LayerDB isn't valid until the catalog is read
  static async create(databaseId: GSheet, opts: {apiUrl?:string, earthTime?:EarthTime}) {
    console.log(`${LayerDB.logPrefix()} start fetch layer_catalog`);
    var ret = new LayerDB();
    ret.layerFactory = new LayerFactory();
    ret.databaseId = databaseId;
    ret.apiUrl = opts.apiUrl || 'https://api.earthtime.org/';
    console.assert(ret.apiUrl.substr(-1) == '/', 'apiUrl must end with "/"')
    ret.earthTime = opts.earthTime;
    ret.layerById = {};

    // Read layer catalog
    var catalog = await (await Utils.fetchWithRetry(`${ret.apiUrl}layer-catalogs/${databaseId.file_id_gid()}`)).json()
    for(let entry of catalog) {
      let layerProxy = new LayerProxy(entry["Share link identifier"], entry["Name"], entry["Category"], ret);
      ret.layerById[layerProxy.id] = layerProxy;
      ret.orderedLayers.push(layerProxy);
    }
    console.log(`${LayerDB.logPrefix()} constructed with ${catalog.length} layers from ${databaseId.file_id_gid()}`)
    return ret;
  }

  getLayer(layerId: string) {
    return this.layerById[layerId];
  }
  
  setShownLayers(layers: LayerProxy[]) {
    for (var layerProxy of this.shownLayers) {
      layerProxy._visible = false;
    }
    this.shownLayers = Array.from(layers);
    for (var layerProxy of this.shownLayers) {
      layerProxy._visible = true;
    }
  }

  parse_and_encode_webgl_color(colorspec) {
    console.assert(colorspec.length == 7);
    var r = parseInt(colorspec.substr(1,2),16);
    var g = parseInt(colorspec.substr(3,2),16);
    var b = parseInt(colorspec.substr(5,2),16);
    return r + g * 256 + b * 65536;
  }

  // TODO(LayerDB)

  // // Pass columnDefs for a static layer, or animationLayers for animation
  // function addDotmapLayer(nickname, name, credit, category, date, columnDefs, animationLayers, drawOptions) {
  //   var useLocalTiles = false;

  //   if (EARTH_TIMELAPSE_CONFIG.localDotmaps) {
  //     for (var i = 0; i < EARTH_TIMELAPSE_CONFIG.localDotmaps.length; i++) {
  //       if (nickname == EARTH_TIMELAPSE_CONFIG.localDotmaps[i]) {
  //         useLocalTiles = true;
  //         break;
  //       }
  //     }
  //   }

  //   var tileUrl;
  //   if (useLocalTiles) {
  //     tileUrl = rootTilePath + '/dotmaptiles/' + nickname;
  //   } else {
  //     tileUrl = dotmapsServerHost + '/tilesv2/' + nickname + '/{z}/{x}/{y}';
  //     if (columnDefs) {
  //       tileUrl += '.box';
  //     } else {
  //       tileUrl += '.tbox';
  //     }
  //   }

  //   var layerOptions: LayerOptions = {
  //     // In reality the tiles are served as 512x512, but by claiming 256x256 we load an
  //     // extra level of detail, and the additional resolution looks nicer, at least on a retina display...
  //     nLevels: 14,
  //     credit: credit,
  //     drawOptions: drawOptions
  //   };

  //   if (columnDefs) {
  //     layerOptions.tileWidth = layerOptions.tileHeight = 256;
  //     layerOptions.date = date;

  //     layerOptions.setDataFunction = WebGLVectorTile2.prototype._setColorDotmapDataFromBox;
  //     layerOptions.drawFunction = WebGLVectorTile2.prototype._drawColorDotmap;
  //     layerOptions.fragmentShader = WebGLVectorTile2.colorDotmapFragmentShader;
  //     layerOptions.vertexShader = WebGLVectorTile2.colorDotmapVertexShader;
  //     layerOptions.dotmapColors = [];
  //     for (var i = 0; i < columnDefs.length; i++) {
  //       layerOptions.dotmapColors.push(parse_and_encode_webgl_color(columnDefs[i].color));
  //     }
  //     var layer = new WebGLVectorLayer2(glb, canvasLayer, tileUrl, layerOptions);
  //   } else {
  //     // Animated dotmap, composed of multiple layers
  //     console.assert(animationLayers);

  //     // Confirm all layers have the same colors in the same order
  //     // Collect epoch times for each layer
  //     var epochs: number[] = [];
  //     var firstLayer = dotmapLayerByName[animationLayers[0]];
  //     if (!firstLayer) {
  //       console.log("ERROR: Animated dotmap layer requested, but no dotmap layer found that matches '" + animationLayers[0] + "'. Skipping the full set:[" + animationLayers + "]");
  //       return;
  //     }
  //     var beginDate = dotmapLayerByName[animationLayers[0]].date;
  //     var endDate = dotmapLayerByName[animationLayers[animationLayers.length - 1]].date;
  //     timelines.setTimeLine(nickname, String(beginDate), String(endDate), 1);

  //     for (var i = 0; i < animationLayers.length; i++) {
  //       var checkLayer = dotmapLayerByName[animationLayers[i]];
  //       if (!checkLayer) {
  //         console.log("ERROR: Animated dotmap layer requested, but no dotmap layer found that matches '" + animationLayers[i] + "'. Skipping it.");
  //         continue;
  //       }
  //       var epoch = parseDateStr(checkLayer.date) as number;
  //       if (isNaN(epoch)) {
  //         console.log('While building', nickname, 'component layer', checkLayer.nickname, 'is missing parsable Date');
  //       }
  //       epochs.push(epoch);
  //       if (JSON.stringify(checkLayer.dotmapColors) != JSON.stringify(firstLayer.dotmapColors)) {
  //         console.log('ERROR in layer ' + nickname + ': component layers do not have identical color lists');
  //         return;
  //       }
  //     }
  //     layerOptions.epochs = epochs;

  //     layerOptions.tileWidth = layerOptions.tileHeight = 256;
  //     layerOptions.date = date;

  //     layerOptions.setDataFunction = WebGLVectorTile2.prototype._setColorDotmapDataFromTbox;
  //     layerOptions.drawFunction = WebGLVectorTile2.prototype._drawColorDotmapTbox;
  //     layerOptions.fragmentShader = WebGLVectorTile2.colorDotmapFragmentShader;
  //     layerOptions.vertexShader = WebGLVectorTile2.colorDotmapVertexShaderTbox;
  //     // TODO: make sure the colors from component layers are identical and in identical order?
  //     layerOptions.dotmapColors = firstLayer.dotmapColors;
  //     var layer = new WebGLVectorLayer2(glb, canvasLayer, tileUrl, layerOptions);
  //   }

  //   dotmapLayers.push(layer);
  //   dotmapLayerByName[nickname] = layer;

  //   var id = 'show-dotmap-' + nickname;
  //   var category_id = category ? "category-" + category.trim().replace(/ /g,"-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase() : "category-us-demographics";

  //   var row = '<tr><td><label name="' + nickname + '">';
  //   row += '<input type="checkbox" id="' + id + '">';
  //   row += name;
  //   row += '</label></tr>';

  //   if ($('#' + category_id).length == 0) {
  //     $(".map-layer-div #category-other").prev("h3").before("<h3 class='dotmap'>" + category + "</h3><table class='dotmap' id='" + category_id + "'></table>");
  //   }

  //   $('#' + category_id).append(row);

  //   // Create and insert legend
  //   var legend='<tr id="' + nickname + '-legend" style="display: none"><td>';
  //   legend += '<div style="font-size: 17px">' + name;
  //   if (credit) legend += '<span class="credit">(' + credit + ')</span>';
  //   legend += '</div>';

  //   if (animationLayers) {
  //     // Use colors from first layer
  //     legend += $('#' + animationLayers[0] + '-legend #colors').html();
  //   } else {
  //     legend += '<div id="colors" style="float: left; padding-right:8px">';
  //     for (var i = 0; i < columnDefs.length; i++) {
  //       legend += '<div style="float: left; padding-right:8px">';
  //       legend += '<div style="background-color:' + columnDefs[i].color + '; width: 12px; height: 12px; float: left; margin-top: 2px; margin-left: 8px;"></div>';
  //       legend += '&nbsp;' + columnDefs[i].name + '</div>';
  //     }
  //     legend += '</div>';
  //   }
  //   legend += '</tr>';

  //   $('#legend-content table tr:last').after(legend);

  //   // Handle click event to turn on and off layer
  //   $('#' + id).on("click", function(e) {
  //     var $this = $(this);
  //     if ($this.prop('checked')) {
  //       layer.getTileView().handleTileLoading({layerDomId: $this[0].id});
  //       // Turn off other dotmap layers if main layer list and the event was
  //       // initiated by the user.
  //       if (e.originalEvent && e.pageX != 0 && e.pageY != 0) {
  //         $("#layers-list input[id^='show-dotmap']:checked").not(this).click();
  //       }
  //       // Use dark basemap
  //       if (visibleBaseMapLayer != "bdrk") {
  //         $("#bdrk-base").click();
  //       }
  //       // Turn on layer
  //       layer.show();
  //       if (animationLayers) {
  //         setActiveLayersWithTimeline(1);
  //         timelineType = "defaultUI";
  //         requestNewTimeline(nickname + ".json", timelineType);
  //       } else {
  //         timelineType = "none";
  //       }
  //       $("#" + nickname + "-legend").show();
  //     } else {
  //       // Turn off layer
  //       layer.hide();
  //       cacheLastUsedLayer(layer);
  //       // TODO: If a dot map layer had a timeline then we need to decrement the count
  //       // Also setting directly to customUI may not be correct
  //       timelineType = "customUI";
  //       requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
  //       $("#" + nickname + "-legend").hide();
  //     }
  //   }).prop('checked', layer.isVisible());
  // }

  ///////////////////////////
  ////// load dotmap layers
  ///////////////////////////
  // function loadDotmapLayersFromTsv(tsvLayerDefinitions) {
  //   if (tsvLayerDefinitions.startsWith('Dotmap layer info')) {
  //     // Backwards-compatibility;  paste new header
  //     var header = 'Enabled\tShare link identifier\tName\tCredits\tPopName1\tColor1\tDefinition1\tPopName2\tColor2\tDefinition2\tPopName3\tColor3\tDefinition3\tPopName4\tColor4\tDefinition4\tPopName5\tColor5\tDefinition5\tPopName6\tColor6\tDefinition6\tPopName7\tColor7\tDefinition7\tPopName8\tColor8\tDefinition8\tPopName9\tColor9\tDefinition9';
  //     tsvLayerDefinitions = [header].concat(tsvLayerDefinitions.split('\n').slice(2)).join('\n');
  //   }
  //   var parsed = Papa.parse(tsvLayerDefinitions, {
  //     delimiter: '\t',
  //     header: true
  //   });
  //   var layerdefs = parsed['data'];
  //   for (var i = 0; i < layerdefs.length; i++) {
  //     var layerdef = layerdefs[i];
  //     if (layerdef['Enabled'].toLowerCase() == 'false') continue;
  //     var layerIdentifier = layerdef['Share link identifier'].replace(/\W+/g, '_'); // sanitize non-word chars

  //     var date = null,
  //       columnDefs = null,
  //       animationLayers = null;
  //     if (layerdef['AnimationLayers']) {
  //       animationLayers = layerdef['AnimationLayers'].replace(/\s/g, '').split('|');
  //     } else {
  //       columnDefs = [];
  //       for (var c = 1; 1; c++) {
  //         var name = layerdef['PopName' + c];
  //         if (!name) break;
  //         var color = layerdef['Color' + c];
  //         var expression = layerdef['Definition' + c];
  //         columnDefs.push({
  //           name: name,
  //           color: color,
  //           expression: expression
  //         });
  //       }
  //       date = layerdef['Date'];
  //     }
  //     var drawOptions = null;
  //     if (layerdef['Draw Options']) {
  //       try {
  //         drawOptions = JSON.parse(layerdef['Draw Options']);
  //       } catch (e) {
  //         console.log('Cannot parse Draw Options from dotmap layer ' + layerIdentifier)
  //       }
  //     }
  //     addDotmapLayer(layerIdentifier, // identifier
  //       layerdef['Name'], // name
  //       layerdef['Credits'], // credit
  //       layerdef['Category'], // layer category
  //       date,
  //       columnDefs,
  //       animationLayers,
  //       drawOptions);
  //   }
  //   // New layers have been added, so refresh the layer panel
  //   $(".map-layer-div").accordion("refresh");
  //   sortLayerCategories();
  //   if (enableLetterboxMode) {
  //     updateLetterboxContent();
  //   }
  //   dotmapLayersInitialized = true;
  // }

  // function loadDotmapLayers(path) {
  //   if (path == dotlayersLoadedPath) return;
  //   dotlayersLoadedPath = path;

  //   // Clear out any dot map layers that have already been loaded
  //   $("#dotmaps_table, .dotmap").find("input:checked").trigger("click");
  //   $(".dotmap").remove();
  //   $('#custom_dotmaps_table').empty();

  //   UTIL.loadTsvData(path, loadDotmapLayersFromTsv, this);
  // }



    // misc() {  
    //   this.layers = [];
    //   this.layerById = {};
    //   this.layersLoadedListeners = [];
    //   this.layersData = {};
    // }
  
    // addLayersLoadedListener(listener) {
    //   if (typeof (listener) === "function") {
    //     this.layersLoadedListeners.push(listener);
    //   }
    // }
    // removeLayersLoadedListener(listener) {
    //   for (var i = 0; i < this.layersLoadedListeners.length; i++) {
    //     if (this.layersLoadedListeners[i] == listener) {
    //       this.layersLoadedListeners.splice(i, 1);
    //       break;
    //     }
    //   }
    // }
    // loadLayersFromTsv(layerDefinitions) {
    //   this.layersData = Papa.parse(layerDefinitions, { delimiter: "\t", header: true });
    //   for (var i = 0; i < this.layersData.data.length; i++) {
    //     var layerDef = this.layersData.data[i];
    //     // Trim whitespace for all fields
    //     for (var key in layerDef) {
    //       if (layerDef.hasOwnProperty(key))
    //         layerDef[key] = layerDef[key].trim();
    //     }
    //     if (layerDef["Enabled"].toLowerCase() != "true")
    //       continue;
    //     if (layerDef["Map Type"].split("-")[0] == "extras") {
    //       this.addExtrasContent(layerDef);
    //     }
    //     else {
    //       var layer = this.addLayer(layerDef);
    //       if (layer.mapType == 'raster' || layer.mapType == 'timemachine') {
    //         //TODO: Raster and timemachine layers do not have the addDataLoadedListener callback
    //         this.setLegend(layer.layerId);
    //         $("#" + layer.layerId + "-legend").hide();
    //       }
    //       timelines.setTimeLine(layer.layerId, layerDef["Start date"], layerDef["End date"], layerDef["Step"]);
    //     }
    //   }
    //   for (var i = 0; i < this.layersLoadedListeners.length; i++) {
    //     this.layersLoadedListeners[i]();
    //   }
    // }
    // loadLayers(path) {
    //   if (path == csvlayersLoadedPath)
    //     return;
    //   csvlayersLoadedPath = path;
    //   var that = this;
    //   // Clear out any csv layers that have already been loaded
    //   $("#csvlayers_table, .csvlayer").find("input:checked").trigger("click");
    //   $(".csvlayer").remove();
    //   $("#csvlayers_table").empty();
    //   that.layers = [];
    //   org.gigapan.Util.loadTsvData(path, that.loadLayersFromTsv, that);
    // }
  }
  