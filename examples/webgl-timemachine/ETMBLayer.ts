/// <reference types="mapbox-gl" />

import { gEarthTime } from './EarthTime'
import { Utils } from './Utils';

import mapboxgl from './mapbox/mapbox-gl-dev-patched-1.11.1';
import { LayerProxy } from './LayerProxy';
import { Glb } from './Glb';
import { LayerOptions } from './Layer';

export class ETMapboxSublayer {
  layer: ETMBLayer;
  id: string;
  drawOrder: number;
  constructor(layer: ETMBLayer, id: string, drawOrder: number) {
    this.layer = layer;
    this.id = id;
    this.drawOrder = drawOrder;
  }
};

// EarthTime layer that contains a single Mapbox style
// If there are multiple ETMBLayers visible, they will be composited into a single Mapbox map
export class ETMBLayer extends LayerOptions {
  mapboxDef: any;
  layerDef: any;
  layerId: string;
  static map: any = null;
  static mapLoaded: boolean = false;
  _shown: any;
  static visibleLayers: ETMBLayer[] = [];
  static accessToken: string = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';
  static _createMapPromise: any;

  _loadingPromise: any;
  _loaded: boolean = false;
  
  _mapboxLayerIDs: {};
  style: any;
  layerProxy: LayerProxy;
  _subLayers: ETMapboxSublayer[];
  constructor(layerProxy: LayerProxy, glb: Glb, canvasLayer, tileUrl: string, layerOptions: LayerOptions) {
    super(layerOptions);
    // Ignore tileUrl
    this.layerProxy = layerProxy;
    console.log(`${this.logPrefix()} constructing`);
    try {
      this.mapboxDef = JSON.parse(this.layerDef.Mapbox);
    }
    catch (err) {
      throw ('Cannot parse Mapbox definition for layer ' + this.layerId + ' is missing or invalid JSON');
    }
    this._ensureLoaded();
    if (this.isVisible()) {
      this._show();
    }
  }
  getSubLayers(): ETMapboxSublayer[] {
    return this._subLayers;
  }

  isLoaded(): boolean {
    return this._loaded;
  }

  isVisible(): boolean {
    return this.layerProxy.isVisible();
  }

  logPrefix() {
    return `${Utils.logPrefix()} MapboxLayer(${this.layerId})`;
  }
  static logPrefix() {
    return `${Utils.logPrefix()} MapboxLayer`;
  }
  // Show layer
  _show() {
    if (this._shown)
      return;
    this._shown = true;
    ETMBLayer.visibleLayers.push(this);
    this._ensureLoaded();
  }

  // Ensure MapboxLayer.map exists and this layer is loaded
  async _ensureLoaded() {
    if (!this._loadingPromise) {
      console.log(`${this.logPrefix()} starting map load`);
      this._loadingPromise = this._loadFromEnsureLoaded();
    }
    await this._loadingPromise;
    this._loaded = true;
    return;
  }

  findGroups() {
    let groups = new Set();
    let orderedGroups = [];
    for (let layer of this.style.layers) {
      let group = layer.metadata['mapbox:group'];
      if (!groups.has(group)) {
        groups.add(group);
        orderedGroups.push(group);
      }
    }
    return orderedGroups;
  }

  // WARNING:  Use _ensureLoaded instead of _load, to make sure we don't load twice
  async _loadFromEnsureLoaded() {
    console.log(`${this.logPrefix()} entering _loadFromEnsureLoaded`);
    var url = this.mapboxDef.style.replace('mapbox://styles/', 'https://api.mapbox.com/styles/v1/');
    var accessToken = ETMBLayer.accessToken;
    let style = await (await Utils.fetchWithRetry(`${url}?access_token=${accessToken}`)).json();
    console.log(`${this.logPrefix()} receive style`, style);

    // Rename source and layer IDs to be unique
    this._remapStyle(style);
    this.style = style;

    // Record layer IDs
    this._mapboxLayerIDs = {};
    for (let layer of style.layers) {
      this._mapboxLayerIDs[layer.id] = true;
      let drawOrder = 400;
      this._subLayers.push(new ETMapboxSublayer(this, layer.id, drawOrder));
    }

    // Create ET

    // console.log(`${this.logPrefix()} checking createMapPromise`);
    // if (!ETMBLayer._createMapPromise) {
    //     console.log(`${this.logPrefix()} calling _createMapFromLoad`);
    //   // Map constructor hasn't been called yet.  Create map it and add this MapboxLayer's layers/sources/glyphs
    //   ETMBLayer._createMapPromise = this._createMapFromLoad(style);
    //   console.log(`${this.logPrefix()} awaiting _createMapPromise`);
    //   await ETMBLayer._createMapPromise;
    //   console.log(`${this.logPrefix()} _createMapPromise complete!`);
    // } else {
    //   // Map constructor has been called.  Block on _createMapPromise if the map isn't yet ready
    //   await ETMBLayer._createMapPromise;
    //   var map = ETMBLayer.map;
    //   for (let [sourceID, sourceDef] of Object.entries(style.sources)) {
    //     console.log(`${this.logPrefix()} Adding source ${sourceID}`);
    //     map.addSource(sourceID, sourceDef);
    //   }
    //   for (let layer of style.layers) {
    //     console.log(`${this.logPrefix()} Adding layer ${layer.id}`)
    //     map.addLayer(layer);
    //   }
    //   console.log(`${this.logPrefix()} TO DO: add glyphs?`);
    // }
    this._loaded = true; 
  }

  _remapStyle(style) {
    // Prefix source and layer IDs with the EarthTime layerId
    var sources = {};
    for (let [key, value] of Object.entries(style.sources)) {
      sources[this._prefixLayerId(key)] = value;
      // someday consider going from mapbox:// to https://
      // eg https://api.mapbox.com/v4/jjkoher.8km6ojde,jjkoher.9utfa50j,mapbox.mapbox-streets-v8.json?secure=&access_token=pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow
      // this might let us work with non-public sources, by using the owner's access_token
    }
    style.sources = sources;

    // Change layers to point to new sources
    for (var layer of style.layers) {
      layer.id = this._prefixLayerId(layer.id);
      layer.source = this._prefixLayerId(layer.source);
    }
  }

  _prefixLayerId(id: string): string {
    return `${this.layerId}_${id}`
  }

  static mousemove(e) {
    var x = e.pageX - $(e.target).offset().left;
    var y = e.pageY - $(e.target).offset().top;
    if (ETMBLayer.mapLoaded) {
      var features = ETMBLayer.map.queryRenderedFeatures([x,y]);
      for (var feature of features) {
        console.log(`${ETMBLayer.logPrefix()} mousemove ${feature.layer.id} ${JSON.stringify(feature.properties)}`);
      }
    }
  }

  static mouseleave(e) {
    console.log('mouseleave', e);
  }

  // Don't use this directly; use _ensureLoaded instead
  async _createMapFromLoad(initialStyle) {
    console.log(`${this.logPrefix()} instantiating map with initialStyle`, initialStyle);
    // @ts-ignore
    mapboxgl.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';

    var $earthTimeMapContainer = $("#timeMachine_timelapse_dataPanes")
    // Add map div with id #mapbox_map, with same size as EarthTime canvas, but offscreen
    $earthTimeMapContainer.append("<div id='mapbox_map' style='width:100%; height:100%; left:-200vw'></div>");
    $earthTimeMapContainer.mousemove(ETMBLayer.mousemove);
    $earthTimeMapContainer.mouseleave(ETMBLayer.mouseleave);
    
    console.log(`${this.logPrefix()} instantiating map with style ${initialStyle}`);
    // @ts-ignore
    ETMBLayer.map = new mapboxgl.Map({
      container: 'mapbox_map',
      style: {
        version: 8,
        sources: initialStyle.sources,
        layers: initialStyle.layers,
        glyphs: initialStyle.glyphs
      },
      renderWorldCopies: false // don't show multiple earths when zooming out
    });

    ETMBLayer.map.on('error', function (e) {
      console.log(`${Utils.logPrefix()} MapboxLayer: Mapbox error`, e);
    });

    console.log(`${this.logPrefix()} waiting for map to load`);
    await new Promise<void>((resolve, reject) => { ETMBLayer.map.on('load', resolve); });
    ETMBLayer.mapLoaded = true;
    console.log(`${this.logPrefix()} map is loaded`);
  }

  // Hide layer
  // Ideally there would be part of the layer API, but currently we're manually maintaining this within this file
  _hide() {
    if (!this._shown)
      return;
    this._shown = false;
    console.log('_hide this=', this, 'visibleLayers before', ETMBLayer.visibleLayers);
    ETMBLayer.visibleLayers = ETMBLayer.visibleLayers.filter(function (layer) { return layer != this; }, this);
    console.log('visibleLayers after', ETMBLayer.visibleLayers);
  }
  destroy() {
    console.log("TODO(RS): implement MapboxLayer.destroy");
  }
  getWidth() {
    return 256;
  }
  getHeight() {
    return 256;
  }
  // viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
  draw(view, opt_options) {
    console.assert(false);
    if (!this._shown) {
      this._show();
    }
    if (this._loaded) {
      ETMBLayer.map._render(); // no args to _render means render all layers on map
    }
  }

  static render() {
    for (let layerProxy of gEarthTime.layerDB.visibleLayers) {
      if (!layerProxy.layer) {
        layerProxy.requestLoad();
      }
    }
    this.syncLayers();
    if (this.map) {
      this.setView();
      // Don't wait for 'load' event;  we need to call _render beforehand to help the loading process.
      this.map._render(); // no args to _render means render all layers on map
    } else {
      //console.log(`${this.staticLogPrefix()} map not yet loaded`);
    }
  }

  abortLoading() {
  }

  static syncLayers() {
    if (this.mapLoaded) {
      // Construct list of shown layers, according to layer proxy
      var layerDBShownMapboxLayers = new Set<ETMBLayer>();
      for (var layerProxy of gEarthTime.layerDB.visibleLayers) {
        if (layerProxy.layer instanceof ETMBLayer) {
          layerProxy.layer._show();
          layerDBShownMapboxLayers.add(layerProxy.layer);
        }
      }
      var toHide: ETMBLayer[] = [];
      // Synchronize shown layers with layerDB
      for (var layer of ETMBLayer.visibleLayers) {
        if (!layerDBShownMapboxLayers.has(layer)) {
          toHide.push(layer);
        }
      }

      for (var layer of toHide) {
        layer._hide();
      }

      for (var layer of layerDBShownMapboxLayers) {
        if (!layer._shown) layer._show();
      }

      if (!this.visibleLayers.length) return;
    }

  }

  static setView() {
    if (this.map) {
      var llView = gEarthTime.timelapse.pixelCenterToLatLngCenterView(gEarthTime.timelapse.getView());
      var camera = { center: { lat: llView.center.lat, lon: llView.center.lng }, zoom: 12 + Math.log2(gEarthTime.timelapse.getView().scale) };
      this.map.jumpTo(camera);
    }
  }

  static beginFrame() {
    this.syncLayers();
    if (this.map) {
      this.setView();
      this.map._render('beginframe');
    }
  }
  static endFrame() {
    if (this.mapLoaded && !this.visibleLayers.length) return;
    if (this.map) {
      this.map._render('endframe');
    }
  }
}
