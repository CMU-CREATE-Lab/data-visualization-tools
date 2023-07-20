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

}
