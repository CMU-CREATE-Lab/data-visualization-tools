/// <reference path="mapbox.js"/>
// declare var mapboxgl: any;
/// <reference path="mapbox-gl-dev-1.3.0.js"/>
/////// <reference types="./node_modules/mapbox" />
/// <reference types="mapbox-gl" />

import { gEarthTime } from './EarthTime'
//import mapboxgl from './mapbox-gl-dev-1.3.0';

export class MapboxLayer {
  glb: any;
  gl: any;
  mapboxDef: any;
  layerDef: any;
  layerId: string;
  _mapboxStyle: any;
  static map: any;
  _shown: any;
  static shownLayers: MapboxLayer[];
  static accessToken: string;
  constructor(glb, canvasLayer, tileUrl, options) {
    console.log('in MapboxLayer constructor')
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
    console.log('&&&&& created MapboxLayer', this.layerId);
  }
  _receiveStyle(style) {
    console.log('receiveStyle', style);
    console.log(JSON.stringify(style));
    this._mapboxStyle = style;
    if (!MapboxLayer.map) {
      MapboxLayer._instantiateMap(style.sources, style.layers, style.glyphs);
      console.log('i used glyphs ', style.glyphs);
    }
    else {
      console.log('need to add some layers and sources!');
      debugger;
    }
  }
  // Show layer
  // Ideally there would be part of the layer API, but currently we're manually maintaining this within this file
  _show() {
    if (this._shown)
      return;
    this._shown = true;
    MapboxLayer.shownLayers.push(this);

    var url = 'https://api.mapbox.com/styles/v1/' + this.mapboxDef.style.replace('mapbox://styles/', '');
    $.get(url, { access_token: MapboxLayer.accessToken })
      .done(this._receiveStyle.bind(this))
      .fail(function (e) { console.log('failed to fetch style in MapboxLayer'); });
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
      MapboxLayer.map._render('data-conveniencesupermarkets'); // need to just render the layer here?
    }
  }
  abortLoading() {
  }
  static _instantiateMap(sources, layers, glyphs) {
    if (MapboxLayer.map)
      return;

    console.log('instantiating map!');
    // @ts-ignore
    mapboxgl.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';

    var oldmode = false;

    if (oldmode) {
    // @ts-ignore
    MapboxLayer.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/randysargent/ck063v1340cpv1cpblztq7l9u',
        renderWorldCopies: false // don't show multiple earths when zooming out
      });
    }
    else {
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
    }

    MapboxLayer.map.on('error', function (e) {
      console.log('&&&&& error', e);
      debugger;
    });
  }
  static beginFrame() {
    // Construct list of shown layers, according to layer proxy
    var layerDBShownLayers = new Set();
    for (var layerProxy of gEarthTime.layerDB.shownLayers) {
      layerDBShownLayers.add(layerProxy.layer);
    }
    var toHide: MapboxLayer[] = [];
    // Synchronize shown layers with layerDB
    for (var layer of MapboxLayer.shownLayers) {
      if (!layerDBShownLayers.has(layer)) {
        toHide.push(layer);
      }
    }
    for (var layer of toHide) {
      layer._hide();
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
  
