import { EarthTime, gEarthTime } from './EarthTime'
import { GSheet } from './GSheet'
import { LayerFactory } from './LayerFactory'
import { LayerProxy } from './LayerProxy'
import { Utils } from './Utils'
import { ETMBLayer } from './ETMBLayer'
import { Layer } from './Layer'
import { MediaLayer } from './MediaLayer'


export class LayerDB {
  databaseId: GSheet;
  layerFactory: LayerFactory;
  apiUrl: string;
  layerById: {[layerId: string]: LayerProxy};
  orderedLayers: LayerProxy[] = []; // every layer in catalog
  visibleLayers: LayerProxy[] = []; // selected layers;  some might not yet be loaded
  earthTime: EarthTime;
  legacyIdMappings: {[key: string]: string} = {};
  lruLayerCache: Layer[] = [];
  maxLruCacheSize: number = 10;
  pairedLayerModeById: {[key: string]: number} = {};

  // Please call async LayerDB.create instead
  private constructor() {}

  static logPrefix() {
    return `${Utils.logPrefix()} LayerDB`;
  }

  logPrefix() {
    return `${Utils.logPrefix()} LayerDB`;
  }

  // async factory, since LayerDB isn't valid until the catalog is read
  static async create(databaseId: GSheet, opts: {apiUrl?:string, earthTime?:EarthTime, hideDotmaps?:boolean}) {
    console.log(`${LayerDB.logPrefix()} start fetch layer_catalog`);
    var layerDB = new LayerDB();
    layerDB.layerFactory = new LayerFactory();
    layerDB.databaseId = databaseId;
    layerDB.apiUrl = opts.apiUrl || 'https://api.earthtime.org/';
    console.assert(layerDB.apiUrl.substr(-1) == '/', 'apiUrl must end with "/"')
    layerDB.layerById = {};

    // Read layer catalog
    var catalogUrl = `${layerDB.apiUrl}layer-catalogs/${databaseId.file_id_gid()}`;
    if (opts.hideDotmaps) {
      catalogUrl += '?show-dotmaps=False';
    }
    var catalog = await (await Utils.fetchWithRetry(catalogUrl)).json()
    for(let entry of catalog) {
      let layerProxy = new LayerProxy(entry["Share link identifier"],
                                      layerDB,
                                      { name: entry["Name"],
                                        category: entry["Category"],
                                        layerConstraints: entry["Layer Constraints"],
                                        hasLayerDescription: entry["Has Layer Description"],
                                        credits: entry["Credits"],
                                        baseLayer: entry["Base layer"],
                                        drawOrder: entry["Draw Order"]
                                      }
                                     );
      layerDB.layerById[layerProxy.id] = layerProxy;
      layerDB.orderedLayers.push(layerProxy);
    }
    console.log(`${LayerDB.logPrefix()} constructed with ${catalog.length} layers from ${databaseId.file_id_gid()}`)
    return layerDB;
  }

  async getLayerDescription(layerId:string) {
    var layerDB = gEarthTime.layerDB;
    if (!layerDB) {
      console.log("ERROR: Could not get layer description because layerDB not initialized yet.")
      return {};
    }
    return await (await Utils.fetchWithRetry(`${layerDB.apiUrl}layer-catalogs/${layerDB.databaseId.file_id_gid()}/layers/${layerId}/layer-description`)).json();
  }

  getLayer(layerId: string) {
    let layer = this.layerById[layerId];
    // If an initial id lookup failed, check if the id in question is a known legacy id.
    if (!layer) {
      layer = this.layerById[this.legacyIdMappings[layerId]];
    }
    return layer;
  }

  setVisibleLayers(layerProxies: LayerProxy[], setByUser?: boolean) {
    console.log(`${this.logPrefix()} setVisibleLayers: [${layerProxies.map(l => l.id)}]`);
    // Modify layerProxies array based on the constraints defined for each requested layer.
    layerProxies = this.layerFactory.handleLayerConstraints(layerProxies, setByUser);
    if (!Utils.arrayShallowEquals(layerProxies, this.visibleLayers)) {
      for (let layerProxy of this.visibleLayers) {
        layerProxy._visible = false;
        layerProxy._setByUser = false;
      }
      let pastAndCurrentLayers = this.visibleLayers;
      this.visibleLayers = Array.from(layerProxies);
      this.visibleLayers.forEach(layerProxy => {
        layerProxy._visible = true;
        layerProxy._setByUser = !!setByUser;
        layerProxy.requestLoad();
      });
      // Handle any cleanup or prep for a layer as it is turned on/off.
      // Filter out unique layers before concating to list of previously seen layers.
      pastAndCurrentLayers = pastAndCurrentLayers.concat(this.visibleLayers.filter((item) => pastAndCurrentLayers.indexOf(item) < 0));
      pastAndCurrentLayers.forEach(layerProxy => {
        if (layerProxy.layer) {
          layerProxy.layer.handleVisibilityStateChange();
        }
      });
      // Handle the UI changes for a layers turning on and off
      this.layerFactory.handleVisibleLayersUIStateChange();
    } else {
      this._setGmapsMaxLevel();
    }
  }


  handleLruLayerCaching() {
    for (let layerProxy of this.visibleLayers) {
      let layer: Layer = layerProxy.layer;
      if (!layer || layer instanceof MediaLayer) {
        continue;
      }
      let cacheIdx = this.lruLayerCache.indexOf(layer);
      if (cacheIdx >= 0) {
        this.lruLayerCache.unshift(this.lruLayerCache.splice(cacheIdx, 1)[0]);
      } else {
        if (this.lruLayerCache.length == this.maxLruCacheSize) {
          this.lruLayerCache.pop().destroy();
        }
        this.lruLayerCache.unshift(layer);
      }
    }
  }


  visibleLayerIds() {
    return this.visibleLayers.map(layer => layer.id);
  }

  _setGmapsMaxLevel(maxZoom?: number) {
    // Set timelapse max zoom based on all the layers
    maxZoom ||= this.computeMaxGmapsZoomLevel();
    gEarthTime.timelapse.setGmapsMaxLevel(maxZoom);
  }

  _mapLegacyLayerIds(id: string, legacyIds: []) {
    legacyIds.forEach(legacyId => {
      if (!this.legacyIdMappings[legacyId]) {
        this.legacyIdMappings[legacyId] = id;
      }
    })
  }

  _loadedCache = {
    valid: false,
    loadedLayers: null as LayerProxy[],
    loadedLayersInIdOrder: [] as LayerProxy[],
    loadedSublayersInDrawOrder: null as LayerProxy[],
    prevVisibleLayers: [] as LayerProxy[],
    prevLoadStates: {} as {[key:string]: boolean}
  }

  invalidateLoadedCache() {
    this._loadedCache.valid = false;
  }

  _matchPairedLayers() {
    this.pairedLayerModeById = {};
    let pairableLayerIds: string[] = [];
    for (let layerProxy of this.visibleLayers) {
      if (!layerProxy.layer) {
        // Don't try to pair layers if any _paired layers are still loading
        return;
      }
      if (layerProxy.layer.paired) {
        pairableLayerIds.push(layerProxy.id);
      }
    }
    // Pair layers.  If an odd number of paired layers, pair all but the last layer
    for (let i = 0; i < Math.floor(pairableLayerIds.length / 2); i++) {
      this.pairedLayerModeById[pairableLayerIds[i * 2 + 0]] = 3; // display right
      this.pairedLayerModeById[pairableLayerIds[i * 2 + 1]] = 2; // display left
    }
  }

  _recomputeLoadCacheIfNeeded() {
    var cache = this._loadedCache;
    if (cache.valid) {
      if (!Utils.arrayShallowEquals(cache.prevVisibleLayers, this.visibleLayers)) {
        // Invalidate cache if visibleLayers has changed
        cache.valid = false;
      } else {
        // Invalidate cache if visibleLayers load state has changed
        for (let layerProxy of cache.prevVisibleLayers) {
          if (layerProxy.isLoaded() !== cache.prevLoadStates[layerProxy.id]) {
            cache.valid = false;
            break;
          }
        }
      }
    }

    if (!cache.valid) {
      ETMBLayer.requireResync();
      this._matchPairedLayers();
      cache.prevVisibleLayers = Array.from(this.visibleLayers);
      cache.prevLoadStates = {};
      let loadedSublayers = [];
      cache.loadedLayers = [];
      let fullyLoaded = true;
      for (let [i, layerProxy] of this.visibleLayers.entries()) {
        let isLoaded = layerProxy.isLoaded();
        cache.prevLoadStates[layerProxy.id] = isLoaded;
        if (isLoaded) {
          cache.loadedLayers.push(layerProxy);
          let layer = layerProxy.layer;
          layer.nextFrameNeedsRedraw = true;
          if ('getSublayers' in layer) {
            for (let [j, sublayer] of layer.getSublayers().entries()) {
              loadedSublayers.push([sublayer.drawOrder, i, j, sublayer]);
            }
          } else {
            loadedSublayers.push([layer.drawOrder, i, layerProxy]);
          }
        } else {
          fullyLoaded = false;
        }
      }

      this.handleLruLayerCaching();

      cache.loadedLayersInIdOrder = cache.loadedLayers.slice();

      cache.loadedLayersInIdOrder.sort(function(layer1, layer2) {
        if (layer1.id < layer2.id) {
          return -1;
        } else {
          // If layer is equal, technically return 0, but that should not happen so always return 1
          return 1;
        }
      });

      loadedSublayers.sort(function(layer1, layer2) {
        var cmp = layer1[0] - layer2[0];

        if (cmp == 0){
          cmp = layer1[1] - layer2[1];

          if (cmp == 0){
            cmp = layer1[2] - layer2[2];
          }
        }

        return cmp;
      });

      cache.loadedSublayersInDrawOrder = [];
      for (let drawable of loadedSublayers) {
        cache.loadedSublayersInDrawOrder.push(drawable[drawable.length - 1]);
      }
      console.log(`${this.logPrefix()} loadedLayersInDrawOrder now [${cache.loadedSublayersInDrawOrder.map(l => l.id)}]`);
      cache.valid = true;
      if (fullyLoaded) {
        // Set timelapse max zoom based on all the layers
        this._setGmapsMaxLevel();
      }
    }
  }

  // Return the maximum zoom level of all loaded layers
  computeMaxGmapsZoomLevel() {
    let maxZoom = null;
    // Allow 50% overzoom;
    let defaultOverZoom = 0.5;
    for (let layerProxy of this.loadedLayers()) {
      let layerMaxZoom = layerProxy.layer.maxGmapsZoomLevel();
      if (layerMaxZoom !== null) {
        layerMaxZoom += layerProxy?.layerConstraints?.overZoom ?? defaultOverZoom;
        if (maxZoom !== null) {
          maxZoom = Math.max(maxZoom, layerMaxZoom);
        } else {
          maxZoom = layerMaxZoom;
        }
      }
    }
    if (maxZoom === null) {
      console.log('Warning, no layers with maxGmapsZoomLevel, choosing default');
      maxZoom = 12; // arbitrary earthtime-scale default zoom
    }
    return maxZoom;

  }

  // Returns loadedSublayersInDrawOrder, minus any layers below the last full-extent
  // layer (if any)
  drawnLayersOrSublayersInDrawOrder(): LayerProxy[] {
    let drawnSublayers = this.loadedSublayersInDrawOrder();
    let startIndex = 0;
    for (let i = 0; i < drawnSublayers.length; i++) {
      if (drawnSublayers[i].layer?.layerConstraints?.isFullExtent) {
        startIndex = i; // Start drawing at the last found layer with full extents, if any
      }
    }
    return startIndex ? drawnSublayers.slice(startIndex) : drawnSublayers;
  }

  loadedSublayersInDrawOrder(): LayerProxy[] {
    this._recomputeLoadCacheIfNeeded();
    return this._loadedCache.loadedSublayersInDrawOrder;
  }

  loadedLayers(): LayerProxy[] {
    this._recomputeLoadCacheIfNeeded();
    return this._loadedCache.loadedLayers;
  }

  loadedLayersInIdOrder(): LayerProxy[] {
    this._recomputeLoadCacheIfNeeded();
    return this._loadedCache.loadedLayersInIdOrder;
  }

  mapboxLayersAreVisible() {
    for (let layerProxy of this.visibleLayers) {
      if (layerProxy.layer && layerProxy.layer instanceof ETMBLayer) {
        return true;
      }
    }
    return false;
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
