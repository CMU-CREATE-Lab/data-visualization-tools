/// <reference types="mapbox-gl" />
/// <reference types="../../js/jquery/jsrender"/>

import { dbg } from './dbg'
import { gEarthTime } from './EarthTime'
import { Utils } from './Utils';
//import { Handlebars } from "./handlebars.runtime.min.js";

import mapboxgl, { featureFilter } from './mapbox-gl-dev-patched-1.11.1/mapbox-gl';

import { LayerProxy } from './LayerProxy';
import { Glb } from './Glb';
import { LayerOptions, LayerInterface } from './Layer';

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
    templateDef? : {
      options?: {}
      template?: string
    }
  }

  layerDef: any;
  layerId: string;
  style: MapboxTypes.Style;
  layerProxy: LayerProxy;

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
  allVisibleTilesLoaded(): boolean {
    return true;
  }

  constructor(layerProxy: LayerProxy, glb: Glb, canvasLayer, tileUrl: string, layerOptions: LayerOptions) {
    super(layerOptions);
    // Ignore tileUrl
    this.layerProxy = layerProxy;
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
    // Parse style
    var idToDrawOrder = {};
    for (const [drawOrderStr, ids] of Object.entries(this.mapboxDef.drawOrder ?? {})) {
      for (const id of ids) {
        idToDrawOrder[id] = parseFloat(drawOrderStr);
      }
    }

    // Record layer IDs
    this._sublayers = new Map();
    for (const layer of this.style.layers) {
      let drawOrder = idToDrawOrder[layer.id] ?? idToDrawOrder[layer?.metadata?.['mapbox:group']] ?? 400;
      if (!this._sublayers.has(drawOrder)) {
        this._sublayers.set(drawOrder, new ETMapboxSublayer(`${this.layerId}:${drawOrder}`, this, drawOrder));
      }
      this._sublayers.get(drawOrder).mapboxLayers.push(layer);
    }
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
    return `${this.layerId}_${id}`
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
      syncState.mapSources[id] = source;
    }
    syncState.mapLayers = initialStyle.layers.slice(); // clone

    this.map.on('error', function (e) {
      console.log(`${Utils.logPrefix()}: !!!!! Mapbox error: ${e.error}`);
    });

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
  draw(view, opt_options) {
    console.assert(false);
    if (!this._shown) {
      this._show();
    }
    if (this._loaded) {
      ETMBLayer.map._render(); // no args to _render means render all layers on map
      if (!ETMBLayer.map.areTilesLoaded()) {
        gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      }
    } else {
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
    }
  }

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
    } else {
      //console.log(`${this.staticLogPrefix()} map not yet loaded`);
    }
  }

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
          propertiesById[feature.layer.id] = feature.properties;
        }
      }
    }
    this.updateProperties(propertiesById);
  }

  static mouseleave(e: JQuery.MouseLeaveEvent) {
    this.updateProperties({});
  }

  static layerTemplate: LayerTemplate;

  static updateProperties(propertiesById: {[layerId: string]: {[key: string]: any}}) {
    if (!Utils.deepEquals(propertiesById, this._lastPropertiesById)) {
      this._lastPropertiesById = propertiesById;
      // TODO: render caption, and only log if it changes

      if (!this.layerTemplate)
        this.layerTemplate = new LayerTemplate(this.visibleLayers[0].mapboxDef.templateDef);

      let html = this.layerTemplate.render(propertiesById)

      console.log(`${this.logPrefix()} mouse over`,propertiesById);
      console.log(`${html}`);
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

class LayerTemplate {

  _def: {options: {
    aliases: {[key: string]: string},
    exceptions: Set<string>,
  }, template: string}
  _div: HTMLDivElement;
  _tmpl: JsViews.Template;

  constructor(templateDef : {options?: {aliases?: {[key: string]: string}, exceptions?: string[]}, template?: string,}) {
    if (!templateDef?.options)
      var opts = {aliases: {}, exceptions: new Set<string>()}
    else
      opts = {
        aliases: templateDef.options.aliases ? templateDef.options.aliases : {},
        exceptions: templateDef.options.exceptions ? new Set<string>(templateDef.options.exceptions) : new Set<string>() 
      }
      
    let tmpl = templateDef?.template ? templateDef.template : `
    <div>
    {{props ~root itemVar="~parent"}}
      {{if ~isNotDict(~parent^prop)}}
        <b>{{>~parent^key}}:</b> {{>~parent^prop}}<br>
      {{else}}
        <b>{{>~parent^key}}:</b>
        <div style="padding-left:13px">
          {{props ~parent^prop itemVar="~child"}}
            {{if ~isNotDict(~child^prop)}}
              <b>{{>~child^key}}:</b> {{>~child^prop}}<br>
            {{else}}
              <b>{{>~child^key}}:</b>
              <div style="padding-left:13px">
                {{props ~child^prop itemVar="~gchild"}}
                  <b>{{~gchild^key}}:</b> {{>~gchild^prop}}<br>
                {{/props}}
              </div>
              <br>
            {{/if}}
          {{/props}}
        </div>
        <br>
      {{/if}}
    {{/props}}
    </div>
      `;

    this._def = {options: opts, template: tmpl};
    this._tmpl = $.templates({markup: tmpl, helpers: {isNotDict: (prop => {return prop.constructor != Object})}});
  }

  render(data: {[key: string]: {}}): string {
    if (!this._div) {
      let tempDiv = document.createElement("div");
      tempDiv.style.display = "none";
      tempDiv.style.position = "absolute";
      tempDiv.style.backgroundColor = "#EEE";
      tempDiv.style.padding = "13px";
      tempDiv.style.zIndex = "10000";
      tempDiv.style.fontSize = "0.67em";
      tempDiv.style.borderRadius = "8px";
      document.body.appendChild(tempDiv);

      this._div = tempDiv
    }

    if (this._def.options.exceptions.size > 0) {
      data = this._except(data, this._def.options.exceptions);
      
      if (this._def.options.aliases.keys)
        this._aliasInPlace(data);
    }
    else if (this._def.options.aliases.keys) {
      data = this._aliasCopy(data);
    }

    try {
      var html = this._tmpl(data);
    } catch (err) {
      html = "";
    }

    if (html) {
      this._div.innerHTML = html;
      this._div.style.display = "block";
      this._div.style.left = "89px";
      this._div.style.top = "89px";
      this._div.style.border = "1px solid";
    }
    else {
      this._div.style.display = "none";
    }

    return html;
  }

  _except(dict: {[key: string]: any}, exceptions: Set<string>)
  {
    let copy = {}

    for (const label in dict)
      if (!(label in exceptions))
        copy[label] = dict[label];

    return copy;
  }

  _aliasCopy(dict: {[key: string]: {}}) {
    var aliasDict = {}

    for(const label in Object.keys(dict)) {
      if (dict[label].constructor == Object)
        var val = this._aliasCopy(dict[label]);
      else
        val = dict[label];

      let aliases = this._def.options.aliases;
      aliasDict[label in aliases ? aliases[label]: label] = val;
    }

    return dict;
  }

  _aliasInPlace(dict: {[key: string]: {}}) {
    for(const label in Object.keys(dict)) {
      if (dict[label].constructor == Object)
        this._aliasInPlace(dict[label]);

      let aliases = this._def.options.aliases;

      if (label in aliases) {
        dict[aliases[label]] = dict[label];
        delete dict[label];
      }
    }
  }
}