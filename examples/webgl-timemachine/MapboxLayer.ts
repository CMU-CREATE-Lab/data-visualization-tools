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
  static map: any = null;
  _shown: any;
  static shownLayers: MapboxLayer[] = [];
  static accessToken: string = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';
  styleIsLoaded: boolean;
  static _createMapPromise: any;
  _loadingPromise: any;
  _mapboxLayerIDs: {};
  layerLoaded: boolean = false;
  static mapLoaded: boolean = false;
  constructor(glb, canvasLayer, tileUrl, options) {
    // Ignore tileUrl
    this.glb = glb;
    this.gl = glb.gl;
    $.extend(this, options);
    console.log(`${this.logPrefix()} constructing`);
    try {
      this.mapboxDef = JSON.parse(this.layerDef.Mapbox);
    }
    catch (err) {
      throw ('Cannot parse Mapbox definition for layer ' + this.layerId + ' is missing or invalid JSON');
    }
  }

  logPrefix() {
    return `${Utils.logPrefix()} MapboxLayer(${this.layerId})`;
  }
  static staticLogPrefix() {
    return `${Utils.logPrefix()} MapboxLayer`;
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

    // Record layer IDs
    this._mapboxLayerIDs = {};
    for (let layer of style.layers) {
      this._mapboxLayerIDs[layer.id] = true;
    }

    if (!MapboxLayer._createMapPromise) {
      // Map constructor hasn't been called yet.  Create map it and add this MapboxLayer's layers/sources/glyphs
      MapboxLayer._createMapPromise = this._createMapFromLoad(style);
      await MapboxLayer._createMapPromise;
    } else {
      // Map constructor has been called.  Block on _createMapPromise if the map isn't yet ready
      await MapboxLayer._createMapPromise;
      var map = MapboxLayer.map;
      for (let [sourceID, sourceDef] of Object.entries(style.sources)) {
        console.log(`${this.logPrefix()} Adding source ${sourceID}`);
        map.addSource(sourceID, sourceDef);
      }
      for (let layer of style.layers) {
        console.log(`${this.logPrefix()} Adding layer ${layer.id}`)
        map.addLayer(layer);
      }
      console.log(`${this.logPrefix()} TO DO: add glyphs?`);
    }
    this.layerLoaded = true; 
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
    if (MapboxLayer.mapLoaded) {
      var features = MapboxLayer.map.queryRenderedFeatures([x,y]);
      for (var feature of features) {
        console.log(`${MapboxLayer.staticLogPrefix()} mousemove ${feature.layer.id} ${JSON.stringify(feature.properties)}`);
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
    $earthTimeMapContainer.mousemove(MapboxLayer.mousemove);
    $earthTimeMapContainer.mouseleave(MapboxLayer.mouseleave);
    
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
      console.log(`${Utils.logPrefix()} MapboxLayer: Mapbox error`, e);
    });

    await new Promise<void>((resolve, reject) => { MapboxLayer.map.on('load', resolve); });
    MapboxLayer.mapLoaded = true;
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
    if (this.layerLoaded) {
      MapboxLayer.map._render(this._mapboxLayerIDs); // no args to _render means render all layers on map
    }
  }
  abortLoading() {
  }

  static beginFrame() {
    if (MapboxLayer.mapLoaded) {
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

      if (!MapboxLayer.shownLayers.length) return;
    }

    if (MapboxLayer.map) {
      var llView = gEarthTime.timelapse.pixelCenterToLatLngCenterView(gEarthTime.timelapse.getView());
      var camera = { center: { lat: llView.center.lat, lon: llView.center.lng }, zoom: 12 + Math.log2(gEarthTime.timelapse.getView().scale) };
      MapboxLayer.map.jumpTo(camera);
      MapboxLayer.map._render('beginframe');
    }
  }
  static endFrame() {
    if (MapboxLayer.mapLoaded && !MapboxLayer.shownLayers.length) return;
    if (MapboxLayer.map) {
      MapboxLayer.map._render('endframe');
    }
  }
}
