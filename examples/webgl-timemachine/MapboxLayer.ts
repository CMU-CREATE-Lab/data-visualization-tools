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

  _prefix_layerId(id: string): string {
    return `${this.layerId}_${id}`
  }

  _receiveStyle(style) {
    Utils.timelog(`MapboxLayer(${this.layerId}) receiveStyle ${style}`);
    console.log(JSON.stringify(style));

    // Prefix source and layer IDs with the EarthTime layerId
    var renamedSources = {};
    for (let [key, value] of Object.entries(style.sources)) {
      renamedSources[this._prefix_layerId(key)] = value;
    }

    // Modify layers in-place
    for (var layer of style.layers) {
      layer.id = this._prefix_layerId(layer.id);
      layer.source = this._prefix_layerId(layer.source);
    }

    if (!MapboxLayer.map) {
      MapboxLayer._instantiateMap(renamedSources, style.layers, style.glyphs);
    }
    else {
      Utils.timelog(`MapboxLayer(${this.layerId}) receiveStyle but map already exists.  If these are new layers and sources, need to add`);
      console.log('need to add some layers and sources!');
      debugger;
    }
    this.styleIsLoaded = true;
  }
  // Show layer
  // Ideally there would be part of the layer API, but currently we're manually maintaining this within this file
  _show() {
    if (this._shown)
      return;
    this._shown = true;
    MapboxLayer.shownLayers.push(this);

    if (!this.styleIsLoaded) {
      console.log('_show this=', this);
      var url = 'https://api.mapbox.com/styles/v1/' + this.mapboxDef.style.replace('mapbox://styles/', '');
      $.get(url, { access_token: MapboxLayer.accessToken })
        .done(this._receiveStyle.bind(this))
        .fail(function (e) { console.log('failed to fetch style in MapboxLayer'); });
    }
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
    else if (MapboxLayer.map) {
      // TODO.  We need to be able to merge multiple styles
      // When we do, we'll need to specify something to _render to select just the layers
      // from this particular MapboxLayer.
      // Perhaps each MapboxLayer has a Set of mapbox layers.
      MapboxLayer.map._render(); // need to just render the layer here?
    }
  }
  abortLoading() {
  }

  static _instantiateMap(sources, layers, glyphs) {
    if (MapboxLayer.map)
      return;

    Utils.timelog(`MapboxLayer instantiating map with sources=${sources}, layers=${layers}, glyphs=${glyphs}`);
    // @ts-ignore
    mapboxgl.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';

    // @ts-ignore
    MapboxLayer.map = new mapboxgl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: sources,
        layers: layers,
        glyphs: glyphs
      },
      renderWorldCopies: false // don't show multiple earths when zooming out
    });

    MapboxLayer.map.on('error', function (e) {
      console.log('&&&&& error', e);
      debugger;
    });
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
  
