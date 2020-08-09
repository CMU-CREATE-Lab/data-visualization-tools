/// <reference path="mapbox.js"/>
// declare var mapboxgl: any;
/// <reference path="mapbox-gl-dev-1.3.0.js"/>
/////// <reference types="./node_modules/mapbox" />
/// <reference types="mapbox-gl" />

import { gEarthTime } from './EarthTime'
import { Utils } from './Utils';
//import mapboxgl from './mapbox-gl-dev-1.3.0';

export class MapboxLayer {
  glb: any;
  gl: any;
  mapboxDef: any;
  layerDef: any;
  layerId: string;
  static map: any;
  _shown: any;
  static shownLayers: MapboxLayer[];
  static accessToken: string;
  styleIsLoaded: boolean;
  static _createMapPromise: any;
  _loadingPromise: any;
  constructor(glb, canvasLayer, tileUrl, options) {
    Utils.timelog(`MapboxLayer({$options.layerId}) constructing`);
    // Ignore tileUrl
    this.glb = glb;
    this.gl = glb.gl;
    $.extend(this, options);
    try {
      this.mapboxDef = JSON.parse(this.layerDef.Mapbox);
    }
    catch (err) {
      throw ('Cannot parse Mapbox definition for layer ' + this.layerId + ' is missing or invalid JSON');
    }
  }

  logPrefix() {
    return `${Utils.timelogPrefix()} MapboxLayer(${this.layerId})`;
  }
  // Show layer
  _show() {
    if (this._shown)
      return;
    this._shown = true;
    MapboxLayer.shownLayers.push(this);
    this._ensureLoaded();
  }

  // Ensure MapboxLayer.map exists and this layer is loaded
  async _ensureLoaded() {
    if (!this._loadingPromise) {
      this._loadingPromise = this._loadFromEnsureLoaded();
    }
    await this._loadingPromise;
    return;
  }

  // WARNING:  Use _ensureLoaded instead of _load, to make sure we don't load twice
  async _loadFromEnsureLoaded() {
    var url = this.mapboxDef.style.replace('mapbox://styles/', 'https://api.mapbox.com/styles/v1/');
    var accessToken = MapboxLayer.accessToken;
    let style = await (await Utils.fetchWithRetry(`${url}?access_token=${accessToken}`)).json();
    console.log(`${this.logPrefix()} receive style`, style);

    // Rename source and layer IDs to be unique
    this._remapStyle(style);

    if (!MapboxLayer._createMapPromise) {
      // Map constructor hasn't been called yet.  Create map it and add this MapboxLayer's layers/sources/glyphs
      MapboxLayer._createMapPromise = this._createMapFromLoad(style);
      await MapboxLayer._createMapPromise;
    } else {
      // Map constructor has been called.  Block on _createMapPromise if the map isn't yet ready
      await MapboxLayer._createMapPromise;
      var map = MapboxLayer.map;
      for (let [sourceName, sourceDef] of Object.entries(style.sources)) {
        console.log(`${this.logPrefix()} Adding source ${sourceName}`);
        map.style.addSource(sourceName, sourceDef);
      }
      for (let layer of style.layers) {
        console.log(`${this.logPrefix()} Adding layer ${layer.id}`)
        map.style.addLayer(layer);
      }
      console.log(`${this.logPrefix()} TO DO: add glyphs?`);
    }
  }

  _remapStyle(style) {
    // Prefix source and layer IDs with the EarthTime layerId
    var sources = {};
    for (let [key, value] of Object.entries(style.sources)) {
      sources[this._prefix_layerId(key)] = value;
      // someday consider going from mapbox:// to https://
      // eg https://api.mapbox.com/v4/jjkoher.8km6ojde,jjkoher.9utfa50j,mapbox.mapbox-streets-v8.json?secure=&access_token=pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow
      // this might let us work with non-public sources, by using the owner's access_token
    }
    style.sources = sources;

    // Change layers to point to new sources
    for (var layer of style.layers) {
      layer.id = this._prefix_layerId(layer.id);
      layer.source = this._prefix_layerId(layer.source);
    }
  }

  _prefix_layerId(id: string): string {
    return `${this.layerId}_${id}`
  }

  // Don't use this directly; use _ensureLoaded instead
  async _createMapFromLoad(initialStyle) {
    console.log(`${this.logPrefix()} instantiating map with initialStyle`, initialStyle);
    // @ts-ignore
    mapboxgl.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';

    // Add map div with id #mapbox_map, with same size as EarthTime canvas, but offscreen
    $("#timeMachine_timelapse_dataPanes").append("<div id='mapbox_map' style='width:100%; height:100%; left:-200vw'></div>");

    // @ts-ignore
    MapboxLayer.map = new mapboxgl.Map({
      container: 'mapbox_map',
      style: {
        version: 8,
        sources: initialStyle.sources,
        layers: initialStyle.layers,
        glyphs: initialStyle.glyphs
      },
      renderWorldCopies: false // don't show multiple earths when zooming out
    });

    MapboxLayer.map.on('error', function (e) {
      Utils.timelog('MapboxLayer: Mapbox error', e);
    });

    await new Promise<void>((resolve, reject) => { MapboxLayer.map.on('load', resolve); });
  }



  // Hide layer
  // Ideally there would be part of the layer API, but currently we're manually maintaining this within this file
  _hide() {
    if (!this._shown)
      return;
    this._shown = false;
    console.log('_hide this=', this, 'shownLayers before', MapboxLayer.shownLayers);
    MapboxLayer.shownLayers = MapboxLayer.shownLayers.filter(function (layer) { return layer != this; }, this);
    console.log('shownLayers after', MapboxLayer.shownLayers);
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
    if (!this._shown) {
      this._show();
    }
    if (MapboxLayer.map) {
      // TODO.  We need to be able to merge multiple styles
      // When we do, we'll need to specify something to _render to select just the layers
      // from this particular MapboxLayer.
      // Perhaps each MapboxLayer has a Set of mapbox layers.
      if (gEarthTime.timelapse.frameno % 300 == 0) {
        console.log(`${this.logPrefix()} TO DO: draw only this layer's layers`);
      }
      MapboxLayer.map._render(); // no args to _render means render all layers on map
    }
  }
  abortLoading() {
  }

  static beginFrame() {
    // Construct list of shown layers, according to layer proxy
    var layerDBShownMapboxLayers = new Set<MapboxLayer>();
    for (var layerProxy of gEarthTime.layerDB.shownLayers) {
      if (layerProxy.layer instanceof MapboxLayer) {
        layerDBShownMapboxLayers.add(layerProxy.layer);
      }
    }
    var toHide: MapboxLayer[] = [];
    // Synchronize shown layers with layerDB
    for (var layer of MapboxLayer.shownLayers) {
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

    if (!MapboxLayer.shownLayers.length || !MapboxLayer.map)
      return;
    var llView = gEarthTime.timelapse.pixelCenterToLatLngCenterView(gEarthTime.timelapse.getView());
    var camera = { center: { lat: llView.center.lat, lon: llView.center.lng }, zoom: 12 + Math.log2(gEarthTime.timelapse.getView().scale) };
    MapboxLayer.map.jumpTo(camera);
    MapboxLayer.map._render('beginframe');
  }
  static endFrame() {
    if (!MapboxLayer.shownLayers.length || !MapboxLayer.map)
      return;
    MapboxLayer.map._render('endframe');
  }
}

MapboxLayer.map = null;
MapboxLayer.shownLayers = [];
MapboxLayer.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';

//MapboxLayer.prototype.instantiateMap = function() {
//  if (this.map) return;
//
//  console.log('&&&&& instantiating MapboxLayer Map', this.layerId);
//
//  mapboxgl.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';
//  this.map = new mapboxgl.Map({
//    container: 'map',
//    style: 'mapbox://styles/randysargent/ck063v1340cpv1cpblztq7l9u',
//    renderWorldCopies: false // don't show multiple earths when zooming out
//  });  
//
//  console.log('&&&&& registering load');
//
//  this.map.on('load', function() {
//    console.log('&&&&& it is loaded!');
//  });
//  this.map.on('error', function() {
//    console.log('&&&&& error');
//  });
//}
  
