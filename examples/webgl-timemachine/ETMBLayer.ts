/// <reference types="mapbox-gl" />
/// <reference types="../../js/jquery/jsrender"/>

import { dbg } from './dbg'
import { gEarthTime } from './EarthTime'
import { Utils } from './Utils';
//import { Handlebars } from "./handlebars.runtime.min.js";

import mapboxgl, { featureFilter } from './mapbox-gl-dev-patched-1.11.1/mapbox-gl';

import { LayerProxy } from './LayerProxy';
import { Glb } from './Glb';
import { LayerOptions, LayerInterface, Layer } from './Layer';

import {MouseOverTemplate, LayerTemplate} from "./LayerTemplate";
import { Timeline } from './Timeline';

export class ETMapboxSublayer {
  id: string;
  layer: ETMBLayer;
  drawOrder: number;
  mapboxLayers: MapboxTypes.Layer[];
  constructor(id: string, layer: ETMBLayer, drawOrder: number, mapboxLayers: MapboxTypes.Layer[] = []) {
    this.id = id;
    this.layer = layer;
    this.drawOrder = drawOrder;
    this.mapboxLayers = mapboxLayers;
  }
};

namespace MapboxTypes {
  export type Source = {[id: string]: {}}
  export type Layer = {
    id: string,
    source: string,
    metadata: {"mapbox:group"?: string},
  }
  export type AnyLayer = Layer | MapboxEarthtimeProxyLayer;
  export type Style = {
    layers: Layer[],
    sources: Source,
    glyphs: {}[]
  }
}

// EarthTime layer that contains a single Mapbox style
// If there are multiple ETMBLayers visible, they will be composited into a single Mapbox map
export class ETMBLayer extends LayerOptions implements LayerInterface {
  mapboxDef: {
    style: string,
    drawOrder?: { [drawOrderStr: string]: string[]},
    mouseOver? : {
      template: string,
      active?: boolean,
      title?: string,
      options?: {
        alias?: {[key: string]: string},
        exclude?: any,
        include?: any,
      }
    }
  }

  nextFrameNeedsRedraw = true;
  layerDef: any;
  layerId: string;
  style: MapboxTypes.Style;
  layerProxy: LayerProxy;
  timeline: Timeline = null;

  _shown: any;
  _loadingPromise: any;
  _loaded: boolean = false;
  _sublayers: Map<number, ETMapboxSublayer>; // Map enables numeric keys

  maxGmapsZoomLevel(): number | null {
    return 17;
  }

  handleVisibilityStateChange():void {
    // Override this if defined for a layer.
  }

  // NOTE: this always returns true since we can't tell whether individual
  // layers have loaded all tiles
  allTilesLoaded(): boolean {
    return true;
  }

  anyTilesLoaded(): boolean {
    return true;
  }

  constructor(layerProxy: LayerProxy, glb: Glb, canvasLayer, tileUrl: string, layerOptions: LayerOptions) {
    super(layerOptions);
    // Ignore tileUrl
    this.layerProxy = layerProxy;

    let cachedCaptureTimes = this.customSliderInfo ? Object.keys(this.customSliderInfo) : [];
    if (cachedCaptureTimes.length) {
      this.startDate = String(cachedCaptureTimes[0]);
      this.endDate = String(cachedCaptureTimes[cachedCaptureTimes.length - 1]);
    }

    if (this.startDate && this.endDate) {
      this.timeline = new Timeline(this.timelineType,
      {startDate: this.startDate, endDate: this.endDate,
       step: this.step, masterPlaybackRate: this.masterPlaybackRate,
       playbackRate: this.playbackRate, cachedCaptureTimes: cachedCaptureTimes});
    }

    try {
      this.mapboxDef = JSON.parse(this.layerDef.Mapbox);
    }
    catch (err) {
      throw (`Cannot parse Mapbox definition for layer ${this.layerId} is missing or invalid JSON`);
    }
    this._ensureLoaded();
    if (this.isVisible()) {
      this._show();
    }
  }
  // Return _sublayers in ascending drawOrder
  getSublayers(): ETMapboxSublayer[] {
    let ret=[];
    for (let drawOrder of [...this._sublayers.keys()].sort()) {
      ret.push(this._sublayers.get(drawOrder));
    }
    return ret;
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

  // Show layer
  _show() {
    if (this._shown)
      return;
    this._shown = true;
    ETMBLayer.visibleLayers.push(this);
    this._ensureLoaded();
  }

  // Ensure layer is loaded
  async _ensureLoaded() {
    if (!this._loadingPromise) {
      this._loadingPromise = this._loadFromEnsureLoaded();
    }
    await this._loadingPromise;
    this._loaded = true;
    return;
  }

  _computeSublayers() {
    var diagnostics = '';

    // Parse style
    var idToDrawOrder = {};
    for (const [drawOrderStr, ids] of Object.entries(this.mapboxDef.drawOrder ?? {})) {
      for (const id of ids) {
        idToDrawOrder[id] = parseFloat(drawOrderStr);
      }
    }

    // Record layer IDs
    this._sublayers = new Map();
    let usedDrawOrders = new Set();
    for (const layer of this.style.layers) {
      // Current behavior:  anything that's unspecified in Mapbox:drawOrder, use the layer's "Draw Order" column
      // New proposed behavior:  if Mapbox:drawOrder is not empty, take things that aren't mentioned in Mapbox:drawOrder
      //    and use drawOrder from the closest previous layer with specified drawOrder
      //    For layers that occur before the first layer with specified Mapbox:drawOrder, use drawOrder from the first specified
      //    ** Can we show an info dialog that helps show the difference between specified and unspecified drawOrder settings?
      // https://studio.mapbox.com/styles/randysargent/ckod70iuy2rsu17pcm8m4rtz3/edit/#9/37.78/-122.4241
      // https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=870361385 row 10
      let drawOrder = 0;
      let layer_id = layer.id.split('|', 2)[1]; // Grab original mapbox style layer id from before we prepended EarthTime layer name
      let group = layer?.metadata?.['mapbox:group'];

      if (idToDrawOrder[layer_id]) {
        // If JSON specifies layer name, this takes priority
        drawOrder = idToDrawOrder[layer_id];
        usedDrawOrders.add(layer_id);
        diagnostics += `Sublayer ${layer_id} uses drawOrder ${drawOrder} from JSON\n`;
      } else if (idToDrawOrder[group]) {
        // Otherwise, if JSON specifies group name (or "Component" from Mapbox Studio), use that
        drawOrder = idToDrawOrder[group];
        usedDrawOrders.add(group);
        diagnostics += `Sublayer ${layer_id} uses drawOrder ${drawOrder} from JSON, using group name ${group}\n`;
      } else {
        // If neither, use ETMBLayer-wide drawOrder from layer defintion CSV row
        drawOrder = this.drawOrder;
        diagnostics += `Neither sublayer id ${layer_id} nor group ${group} is listed in JSON, using drawOrder from CSV row ${drawOrder}\n`;
      }
      // Create one ETMapboxSublayer per drawOrder
      if (!this._sublayers.has(drawOrder)) {
        this._sublayers.set(drawOrder, new ETMapboxSublayer(`${this.layerId}:${drawOrder}`, this, drawOrder));
      }
      // Add this mapbox layer to the correct ETMapboxSublayer
      this._sublayers.get(drawOrder).mapboxLayers.push(layer);
    }
    for (const [id, drawOrder] of Object.entries(idToDrawOrder)) {
      if (!usedDrawOrders.has(id)) {
        diagnostics += `Warning: drawOrder JSON ${id}: ${drawOrder} did not match any layers or groups\n`;
      }
    }

    console.log(diagnostics); // TODO: make a keystroke to bring this up
  }
  // WARNING:  Use _ensureLoaded instead of _load, to make sure we don't load twice
  async _loadFromEnsureLoaded() {
    var url = this.mapboxDef.style.replace('mapbox://styles/', 'https://api.mapbox.com/styles/v1/');
    var accessToken = ETMBLayer.accessToken;
    let style = await (await Utils.fetchWithRetry(`${url}?access_token=${accessToken}`)).json();

    // Rename source and layer IDs to be unique
    this._remapStyle(style);
    this.style = style;

    this._computeSublayers();
    // Create ET

    if (!ETMBLayer._createMapPromise) {
      // Map constructor hasn't been called yet.  Create map it and add this MapboxLayer's layers/sources/glyphs
      ETMBLayer._createMapPromise = ETMBLayer._createMapFromLoad(style);
      await ETMBLayer._createMapPromise;
    }
    this._loaded = true;
  }


  _remapStyle(style: MapboxTypes.Style) {
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
    return `${this.layerId}|${id}`
  }

  // Don't use this directly; use _ensureLoaded instead
  static async _createMapFromLoad(initialStyle: MapboxTypes.Style) {
    // @ts-ignore
    mapboxgl.accessToken = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';

    var $earthTimeMapContainer = $("#timeMachine_timelapse_dataPanes")
    // Add map div with id #mapbox_map, with same size as EarthTime canvas, but offscreen
    $earthTimeMapContainer.append("<div id='mapbox_map' style='width:100%; height:100%; left:-200vw'></div>");
    $earthTimeMapContainer.mousemove(this.mousemove.bind(this));
    $earthTimeMapContainer.mouseleave(this.mouseleave.bind(this));

    // @ts-ignore
    dbg.map = this.map = new mapboxgl.Map({
      container: 'mapbox_map',
      style: {
        version: 8,
        sources: initialStyle.sources,
        layers: initialStyle.layers,
        glyphs: initialStyle.glyphs
      },
      renderWorldCopies: false // don't show multiple earths when zooming out
    });

    var syncState = this._syncState;
    for (const [id, source] of Object.entries(initialStyle.sources)) {
      console.log(`SOURCE ID: ${id}`)
      syncState.mapSources[id] = source;
    }

    // TODO for animated choropleths:
    // https://docs.google.com/document/d/1VmoUFQUJDMEPQSgTB3CvpNRjNxkvd3jXHQCDP4fqL_M/edit

    syncState.mapLayers = initialStyle.layers.slice(); // clone

    this.map.on('error', function (e) {
      console.log(`${Utils.logPrefix()}: !!!!! Mapbox error: ${e.error}`);
    });

    // Resize when timelapse canvas resizes
    gEarthTime.timelapse.addResizeListener(function() { this.map.resize(); }.bind(this));

    await new Promise<void>((resolve, reject) => { this.map.on('load', resolve); });
    this.mapLoaded = true;
    console.log(`${this.logPrefix()} map load`);
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
  // draw(view, opt_options) {
  //   console.assert(false);
  //   if (!this._shown) {
  //     this._show();
  //   }
  //   if (this._loaded) {
  //     ETMBLayer.map._render(); // no args to _render means render all layers on map
  //     let nextFrameNeedsRedraw: boolean;
  //     if (!ETMBLayer.map.areTilesLoaded()) {
  //       gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
  //       nextFrameNeedsRedraw = true;
  //     } else {
  //       nextFrameNeedsRedraw = false;
  //     }
  //     if (!(window as any).stopit) {
  //       console.log(`ETMBLayer draw:  nextFrameNeedsRedraw is ${nextFrameNeedsRedraw}`);
  //     }
  //     for (let layerProxy of gEarthTime.layerDB.drawnLayersOrSublayersInDrawOrder()) {
  //       let layer = layerProxy.layer;
  //       if (layer instanceof ETMBLayer) {
  //         layer.nextFrameNeedsRedraw = nextFrameNeedsRedraw;
  //       }
  //     }
  //   } else {
  //     gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
  //   }
  // }

  abortLoading() {
  }

  info(): string {
    let ret= [`${this.layerId} (ETMBLayer): Layer.isLoaded(): ${this.isLoaded()}`];
    return ret.join('\n');
  }

  ///////////////////////////////////////////////
  // static
  //

  static map: any = null;
  static mapLoaded: boolean = false;
  static visibleLayers: ETMBLayer[] = [];
  static accessToken: string = 'pk.eyJ1IjoicmFuZHlzYXJnZW50IiwiYSI6ImNrMDYzdGl3bDA3bTUzc3Fkb3o4cjc3YXgifQ.nn7FC9cpRl_THWpoAFnnow';
  static _createMapPromise: any;

  static render() {
    for (let layerProxy of gEarthTime.layerDB.loadedSublayersInDrawOrder()) {
      if (!layerProxy.layer) {
        layerProxy.requestLoad();
      }
    }
    this.syncMap();
    if (this.map) {
      this.copyEarthtimeViewToMapbox();
      // Don't wait for 'load' event;  we need to call _render beforehand to help the loading process.
      this.map._render(); // no args to _render means render all layers on map
      let nextFrameNeedsRedraw: boolean;
      if (ETMBLayer.map.loaded() && ETMBLayer.map.areTilesLoaded()) {
        nextFrameNeedsRedraw = false;
      } else {
        gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
        nextFrameNeedsRedraw = true;
      }
      for (let layerProxy of gEarthTime.layerDB.drawnLayersOrSublayersInDrawOrder()) {
        let layer = layerProxy.layer;
        if (layer instanceof ETMBLayer) {
          layer.nextFrameNeedsRedraw = nextFrameNeedsRedraw;
        }
      }
    } else {
      //console.log(`${this.staticLogPrefix()} map not yet loaded`);
    }
  }

  //   if (this._loaded) {
  //     ETMBLayer.map._render(); // no args to _render means render all layers on map
  //     let nextFrameNeedsRedraw: boolean;
  //     if (!ETMBLayer.map.areTilesLoaded()) {
  //       gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
  //       nextFrameNeedsRedraw = true;
  //     } else {
  //       nextFrameNeedsRedraw = false;
  //     }
  //     if (!(window as any).stopit) {
  //       console.log(`ETMBLayer draw:  nextFrameNeedsRedraw is ${nextFrameNeedsRedraw}`);
  //     }
  //     for (let layerProxy of gEarthTime.layerDB.drawnLayersOrSublayersInDrawOrder()) {
  //       let layer = layerProxy.layer;
  //       if (layer instanceof ETMBLayer) {
  //         layer.nextFrameNeedsRedraw = nextFrameNeedsRedraw;
  //       }
  //     }
  //   } else {
  //     gEarthTime.timelapse.lastFrameCompletelyDrawn = false;


  static copyEarthtimeViewToMapbox() {
    if (this.map) {
      var llView = gEarthTime.timelapse.pixelCenterToLatLngCenterView(gEarthTime.timelapse.getView());
      var camera = { center: { lat: llView.center.lat, lon: llView.center.lng }, zoom: gEarthTime.gmapsZoomLevel() - 1 };
      this.map.jumpTo(camera);
    }
  }

  static logPrefix() {
    return `${Utils.logPrefix()} MapboxLayer`;
  }

  static _lastPropertiesById = {} as {[layerId: string]: {[key: string]: any}};

  static mousemove(e: JQuery.MouseMoveEvent) {
    let propertiesById = {} as {[layerId: string]: {[key: string]: any}};
    var [x, y] = [0, 0]

    if (ETMBLayer.mapLoaded  && gEarthTime.layerDB.mapboxLayersAreVisible()) {
      x = e.pageX - $(e.target).offset().left;
      y = e.pageY - $(e.target).offset().top;
      let features = ETMBLayer.map.queryRenderedFeatures([x, y]);
      // For now, just get the first item from each layer
      // Eventually, would we want to be able to get more than one?
      for (const feature of features) {
        if (!(feature.layer.id in propertiesById)) {
          console.log(`feature.layer.id ${feature.layer.id}`)
          propertiesById[feature.layer.id] = feature.properties;
        }
      }
    }
    this.updateProperties(propertiesById);
  }

  static mouseleave(e: JQuery.MouseLeaveEvent) {
    this.updateProperties({});
  }

  static _layerTmpls: MouseOverTemplate[];
  static _tmpldiv: HTMLDivElement;

  static updateProperties(propertiesById: {[layerId: string]: {[key: string]: any}}) {
    if (!Utils.deepEquals(propertiesById, this._lastPropertiesById)) {
      this._lastPropertiesById = propertiesById;
      // TODO: render caption, and only log if it changes

      if (!this._tmpldiv) {
        let tmp = document.createElement("div");

        tmp.setAttribute("class", "main-template-div");
        tmp.style.display = "none";
        tmp.style.position = "absolute";
        tmp.style.padding = "13px";
        tmp.style.zIndex = "10000";
        tmp.style.width = "144px";
        this._tmpldiv = tmp;
        document.body.appendChild(this._tmpldiv);
      }

      if (!this._layerTmpls) {
        this._layerTmpls = [];

        this.visibleLayers.forEach(v => {
          if (v.mapboxDef?.mouseOver) {
            this._layerTmpls.push(new MouseOverTemplate(v.layerId, LayerTemplate.FromObject(v.mapboxDef.mouseOver)));
          }
        });
      }

      console.log(`${this.logPrefix()} # templates : ${this._layerTmpls.length}`)

      if (this._layerTmpls.length > 0) {
        let layerProps: {[key: string]: {[key: string]: any}} = {};


        Object.keys(propertiesById).forEach(p => {
          let lyrttl = p.split("|");
          let lyr = lyrttl[0], ttl = lyrttl[1];

          if (Object.keys(propertiesById[p]).length > 0) {
            if (!(lyr in layerProps))
              layerProps[lyr] = {};

            layerProps[lyr][ttl] = propertiesById[p];
          }

        });

        console.log(`${this.logPrefix()} mouse over`,layerProps);

        let divied = 0;

        this._layerTmpls.forEach(tmpl => {
            if (tmpl.active) {
              let div = tmpl.divy(layerProps[tmpl.layerId]);

              if (div)
              {
                this._tmpldiv.appendChild(div);
                divied++;
              }
            }
          });

        if (divied > 0) {
          this._tmpldiv.style.display = "block";
          this._tmpldiv.style.left = "89px";
          this._tmpldiv.style.top = "89px";
          this._tmpldiv.style.backgroundColor = "#EEE";
          this._tmpldiv.style.border = "1px solid";
        } else {
        this._tmpldiv.style.display = "none";
        }
      } else {
          this._tmpldiv.style.display = "none";
      }
      // console.log(`${this.logPrefix()} mouse over`,propertiesById);
    }
  }

  static _syncState = {
    dirty: false,
    mapSources: {} as {[id: string]: MapboxTypes.Source},
    mapLayers: [] as MapboxTypes.AnyLayer[],
  }

  static requireResync() {
    this._syncState.dirty = true;
  }

  static syncLayers() {
    // Iterate through desired and actual
    // When next desired != next actual:
    //      if next desired is somewhere in actual, shown, move it up
    //          otherwise, add it
    // When next desired is done, remove all remaining actual
    // For now, ignore ET layers

    // Compute needed layers, in draw order
    let neededLayers = [] as MapboxTypes.AnyLayer[];
    for (let layerProxy of gEarthTime.layerDB.loadedSublayersInDrawOrder()) {
      if (layerProxy instanceof ETMapboxSublayer) {
        const sublayer = layerProxy as ETMapboxSublayer;
        for (const mapboxLayer of sublayer.mapboxLayers) {
          neededLayers.push(mapboxLayer);
        }
      } else {
        neededLayers.push(MapboxEarthtimeProxyLayer.findOrCreate(layerProxy));
      }
    }

    let syncState = this._syncState;
    // Add, move, or delete layers
    let mapHasLayerID = {};
    for (let mapLayer of syncState.mapLayers) {
      mapHasLayerID[mapLayer.id] = true;
    }

    let mapIdx = 0;
    for (const neededLayer of neededLayers) {
      if (neededLayer != syncState.mapLayers[mapIdx]) {
        if (neededLayer.id in mapHasLayerID) {
          console.log(`${this.logPrefix()} moveLayer(${neededLayer.id})`)
          this.map.moveLayer(neededLayer.id, syncState.mapLayers[mapIdx].id);
          syncState.mapLayers = syncState.mapLayers.filter(l => l.id != neededLayer.id);
        } else {
          console.log(`${this.logPrefix()} addLayer(${neededLayer.id})`)
          // if mapLayers[0] is undefined, we'll add to the end instead of inserting
          this.map.addLayer(neededLayer, syncState.mapLayers[mapIdx]?.id);
        }
      } else {
        mapIdx++;
      }
    }
    for (; mapIdx < syncState.mapLayers.length; mapIdx++) {
      console.log(`${this.logPrefix()} removeLayer(${syncState.mapLayers[mapIdx].id})`)
      this.map.removeLayer(syncState.mapLayers[mapIdx].id);
    }
    syncState.mapLayers = neededLayers;
  }

  static syncMap() {
    if (this.mapLoaded && this._syncState.dirty) {

      // Compute needed sources
      let neededSources = {};
      for (let layerProxy of gEarthTime.layerDB.loadedLayers()) {
        if (layerProxy.layer instanceof ETMBLayer) {
          let layer = layerProxy.layer as ETMBLayer;
          let sources = layer.style.sources;
          for (const [id, source] of Object.entries(sources)) {
            neededSources[id] = source;
          }
        }
      }
      // Add new sources
      for (const [id, source] of Object.entries(neededSources)) {
        if (!(id in this._syncState.mapSources)) {
          console.log(`${this.logPrefix()} addSource(${id})`)
          this.map.addSource(id, source);
        }
      }

      // Add and remove layers
      this.syncLayers();

      // Remove no-longer-needed sources
      for (const [id, source] of Object.entries(this._syncState.mapSources)) {
        if (!(id in neededSources) || source != neededSources[id]) {
          console.log(`${this.logPrefix()} removeSource(${id})`)
          this.map.removeSource(id);
        }
      }
      this._syncState.mapSources = neededSources;
      this._syncState.dirty = false;
    }
  }
}

dbg.ETMBLayer = ETMBLayer;

class MapboxEarthtimeProxyLayer {
  id: string
  type: string
  renderingMode: string
  layerProxy: LayerProxy;

  render(gl, matrix) {
    console.assert(gl === gEarthTime.glb.gl);
    this.layerProxy.draw();
  }

  static _cache = {} as {[id: string]: MapboxEarthtimeProxyLayer};

  static findOrCreate(layerProxy: LayerProxy): MapboxEarthtimeProxyLayer {
    if (!(layerProxy.id in this._cache)) {
      this._cache[layerProxy.id] = new this();
      this._cache[layerProxy.id].layerProxy = layerProxy;
      this._cache[layerProxy.id].id = layerProxy.id;
      this._cache[layerProxy.id].type = 'custom';
      this._cache[layerProxy.id].renderingMode = '2d';
    }
    return MapboxEarthtimeProxyLayer._cache[layerProxy.id];
  }

}

// class LayerTemplate {

//   _def: {options: {
//     aliases: {[key: string]: string},
//     exceptions: Set<string>,
//   }, template: string}
//   _div: HTMLDivElement;
//   _tmpl: JsViews.Template;

//   constructor(templateDef : {options?: {aliases?: {[key: string]: string}, exceptions?: string[]}, template?: string,}) {
//     if (!templateDef?.options)
//       var opts = {aliases: {}, exceptions: new Set<string>()}
//     else
//       opts = {
//         aliases: templateDef.options.aliases ? templateDef.options.aliases : {},
//         exceptions: templateDef.options.exceptions ? new Set<string>(templateDef.options.exceptions) : new Set<string>()
//       }

//     let tmpl = templateDef?.template ? templateDef.template : `
//     <div>
//     {{props ~root itemVar="~parent"}}
//       {{if ~isNotDict(~parent^prop)}}
//         <b>{{>~parent^key}}:</b> {{>~parent^prop}}<br>
//       {{else}}
//         <b>{{>~parent^key}}:</b>
//         <div style="padding-left:13px">
//           {{props ~parent^prop itemVar="~child"}}
//             {{if ~isNotDict(~child^prop)}}
//               <b>{{>~child^key}}:</b> {{>~child^prop}}<br>
//             {{else}}
//               <b>{{>~child^key}}:</b>
//               <div style="padding-left:13px">
//                 {{props ~child^prop itemVar="~gchild"}}
//                   <b>{{~gchild^key}}:</b> {{>~gchild^prop}}<br>
//                 {{/props}}
//               </div>
//               <br>
//             {{/if}}
//           {{/props}}
//         </div>
//         <br>
//       {{/if}}
//     {{/props}}
//     </div>
//       `;

//     this._def = {options: opts, template: tmpl};
//     this._tmpl = $.templates({markup: tmpl, helpers: {isNotDict: (prop => {return prop.constructor != Object})}});
//   }

//   render(data: {[key: string]: {}}){
//     if (!this._div) {
//       let tempDiv = document.createElement("div");
//       tempDiv.style.display = "none";
//       tempDiv.style.position = "absolute";
//       tempDiv.style.backgroundColor = "#EEE";
//       tempDiv.style.padding = "13px";
//       tempDiv.style.zIndex = "10000";
//       tempDiv.style.fontSize = "0.67em";
//       tempDiv.style.borderRadius = "8px";
//       document.body.appendChild(tempDiv);

//       this._div = tempDiv
//     }

//     if (this._def.options.exceptions.size > 0) {
//       data = this._except(data, this._def.options.exceptions);

//       if (this._def.options.aliases.keys)
//         this._aliasInPlace(data);
//     }
//     else if (this._def.options.aliases.keys) {
//       data = this._aliasCopy(data);
//     }

//     try {
//       var html = this._tmpl(data);
//     } catch (err) {
//       html = "";
//     }

//     if (html) {
//       this._div.innerHTML = html;
//       this._div.style.display = "block";
//       this._div.style.left = "89px";
//       this._div.style.top = "89px";
//       this._div.style.border = "1px solid";
//     }
//     else {
//       this._div.style.display = "none";
//     }
//   }

//   _except(dict: {[key: string]: any}, exceptions: Set<string>)
//   {
//     let copy = {}

//     for (const label in dict)
//       if (!(label in exceptions))
//         copy[label] = dict[label];

//     return copy;
//   }

//   _aliasCopy(dict: {[key: string]: {}}) {
//     var aliasDict = {}

//     for(const label in Object.keys(dict)) {
//       if (dict[label].constructor == Object)
//         var val = this._aliasCopy(dict[label]);
//       else
//         val = dict[label];

//       let aliases = this._def.options.aliases;
//       aliasDict[label in aliases ? aliases[label]: label] = val;
//     }

//     return dict;
//   }

//   _aliasInPlace(dict: {[key: string]: {}}) {
//     for(const label in Object.keys(dict)) {
//       if (dict[label].constructor == Object)
//         this._aliasInPlace(dict[label]);

//       let aliases = this._def.options.aliases;

//       if (label in aliases) {
//         dict[aliases[label]] = dict[label];
//         delete dict[label];
//       }
//     }
//   }
// }