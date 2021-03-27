/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>

import { LayerDB } from './LayerDB';
import { Utils } from './Utils';
import { Layer } from './Layer';
import { gEarthTime, stdWebMercatorNorth } from './EarthTime';


export interface LayerDef {
  type: string;
  'Start date'?: string,
  'End date'?: string,
  URL?: string
  [key: string]: any
}

export class LayerProxy {
  id: string;
  layerDb: LayerDB;
  category: string;
  credits: string;
  baseLayer: string;
  drawOrder: number;
  name: string;
  layerConstraints: {[key:string]: any};
  hasLayerDescription: boolean;
  _visible: boolean;
  showGraph: boolean;
  _loadingPromise: Promise<void>;
  _loaded: boolean
  options: any; // TODO: consider moving things out of options and using setDataOptions, drawOptions
  layer: Layer = null;
  _effectiveDrawOrder: any[];
  layerDef: LayerDef;
  _setByUser?: boolean;

  constructor(id: string, layerDb: LayerDB, options: {name: string, category: string, credits: string, baseLayer: string, drawOrder: string, layerConstraints: {[key:string]: any}, hasLayerDescription: boolean}) {
    console.assert(LayerProxy.isValidId(id));
    this.id = id;
    this.name = options.name;
    this.category = options.category;
    this.credits = options.credits;
    this.baseLayer = options.baseLayer;
    this.layerConstraints = options.layerConstraints;
    this.drawOrder = parseInt(options.drawOrder); // Note this can result in a drawOrder being NaN. This will be overriden when the layer is actually loaded.
    if (this.layerConstraints && this.layerConstraints.legacyIds) {
      layerDb._mapLegacyLayerIds(id, this.layerConstraints.legacyIds);
    }
    this.hasLayerDescription = options.hasLayerDescription;
    this.layerDb = layerDb;
  }

  getLayerConstraints() {
    return Object.keys(this.layerConstraints).length == 0 ? null : this.layerConstraints;
  }

  isVisible(): boolean {
    return this._visible;
  }

  logPrefix() {
    return `${Utils.logPrefix()} Layer(${this.id})`
  }

  requestLoad() {
    if (!this.layer && !this._loadingPromise) {
      this._loadingPromise = this._load();
    }
  }

  isLoaded(): boolean {
    if (!this.layer) {
      return false;
    } else {
      return this.layer.isLoaded();
    }
  }

  // Return Layer, loading first if not yet loaded
  async getLayerAsync() {
    if (!this.layer) {
      this.requestLoad();
      await this._loadingPromise;
    }
    return this.layer;
  }

  async _load() {
    let url = `${this.layerDb.apiUrl}layer-catalogs/${this.layerDb.databaseId.file_id_gid()}/layers/${this.id}`
    console.log(`${this.logPrefix()} Fetching ${url}`)
    await this._loadFromLayerdef(await (await Utils.fetchWithRetry(url)).json());
  }

  async _loadFromLayerdef(layerDef: LayerDef) {
    if (this.layer) {
      this.layer.destroy();
      this.layer = null;
    }
    this.layerDef = layerDef;
    this.layer = await this.layerDb.layerFactory.createLayer(this, layerDef);
    this.layerDb.invalidateLoadedCache();
    console.log(`${this.logPrefix()} layerFactory.createLayer completed`);
  }

  // Signal layer didn't completely draw by returning false, or settings timelapse.lastFrameCompletelyDrawn false
  draw() {
    let options = {};
    // let options = {pointSize: 2};
    // if (layer.options) {
    //   $.extend(options, layer.options);
    // }

    // TODO LayerDB: uncomment and fix pairs
    // if (pairCount && isPairCandidate(layer)) {
    //   options.mode = pairCount + 1; // 2 or 3 for left or right
    //   pairCount--;
    // }

    if (!this.isLoaded()) {
      this.requestLoad();
      return false;
    }

    var layer = this.layer;

    // The "timelapse" class maintains a coordinate system for zooming and panning.
    // Originally this coordinate system was tied to the current Landsat basemap, which resulted in
    // coordinate systems changing when we upgraded Landsat basemap.
    // Today, we initialize the timelapse class with a "standard" coordinate system, from the 2016 Landsat

    // Find upperLeft and lowerRight pixel coords that express the layer's bounding box
    // in the coordinate system of the underlying timelapse projection pixel space.
    if (layer?.projectionBounds) {
      let projectionBounds = layer.projectionBounds;
      var upperLeft = gEarthTime.timelapse.getProjection().latlngToPoint({
        lat: projectionBounds.north,
        lng: projectionBounds.west
      });
      var lowerRight = gEarthTime.timelapse.getProjection().latlngToPoint({
        lat: projectionBounds.south,
        lng: projectionBounds.east
      });
    } else {
      var upperLeft = gEarthTime.timelapse.getProjection().latlngToPoint({
        lat: stdWebMercatorNorth,
        lng: -180
      });
      var lowerRight = gEarthTime.timelapse.getProjection().latlngToPoint({
        lat: -stdWebMercatorNorth,
        lng: 180
      });
    }

    var view = gEarthTime.timelapse.getView();
    // Compute scaling difference between our layer's pixels and the timelapse pixels
    var timelapse2map = layer.getWidth() / (lowerRight.x - upperLeft.x);

    // Translate upperLeft to 0,0
    view.y -= upperLeft.y
    view.x -= upperLeft.x
    // Apply timelpase2map scaling
    view.x *= timelapse2map;
    view.y *= timelapse2map;
    view.scale /= timelapse2map;

    this.layer.draw(view, options);
    return undefined;
  }


  // TODO(LayerDB) make sure that when time range changes, the timeline updates
  updateData(newDataProperties, refreshData, isLast) {
    if (newDataProperties) {
      $.extend(true, this, newDataProperties);
    }
    if (refreshData) {
      // TODO(LayerDB): destroy the tiles here
      //this.destroy(); //update tiles to use new data
    }
    // if (refreshTimeline) {
    //   timelines.setTimeLine(layer.id, layer.startDate, layer.endDate, layer.step);
    //   var cachedLayerTimelinePath = layer.id + ".json";
    //   //TODO determine timeline styling
    //   requestNewTimeline(cachedLayerTimelinePath, "defaultUI"); //update timeline to match new date range
    // }
  }

  // Valid share link ID is composed of A-Z, a-z, 0-9, underscore, dash
  static isValidId(id: string) {
    return !!id.match(/^[\w-]+$/);
  }

  static formatValue(value: number) {
    for (var suffix of ['', 'K', 'M', 'G', 'T', 'P']) {
      if (suffix == 'P' || Math.abs(value) < 1000) break;
      value /= 1000;
    }
    // Round to 2 digits, remove trailing zeros, and add suffix
    return value.toFixed(2).replace(/\.?0+$/, '') + suffix;
  }

  info(): string {
    if (this.layer) {
      return this.layer.info();
    } else {
      return `${this.id}: proxy has not loaded layer`;
    }
  }
}
