/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>

import { LayerDB } from './LayerDB';
import { Utils } from './Utils';
import { Layer } from './Layer';

interface Timelapse {
  [key: string]: any;
}

export interface LayerDef {
  'Start date'?: string,
  'End date'?: string,
  URL?: string
}

export class LayerProxy {
  id: string;
  database: LayerDB;
  category: string;
  name: string;
  _visible: boolean;
  showGraph: boolean;
  _tileView?: any; // TODO(LayerDB): add the _tileView
  _loadingPromise: Promise<void>;
  _loaded: boolean
  options: any; // TODO: consider moving things out of options and using setDataOptions, drawOptions
  layer: Layer = null;
  _effectiveDrawOrder: any[];
  layerDef: LayerDef;

  constructor(id: string, name: string, category: string, database: LayerDB) {
    console.assert(LayerProxy.isValidId(id));
    this.id = id;
    this.name = name;
    this.category = category;
    this.database = database;
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
    } else if (this.layer.isLoaded) {
      return this.layer.isLoaded();
    } else {
      return true;
    }
  }

  async _load() {
    let url = `${this.database.apiUrl}layer-catalogs/${this.database.databaseId.file_id_gid()}/layers/${this.id}`
    console.log(`${this.logPrefix()} Fetching ${url}`)
    this._load_with_layerdef(await (await Utils.fetchWithRetry(url)).json());
  }

  _load_with_layerdef(layerDef: LayerDef) {
    if (this.layer) {
      this.layer.destroy();
      this.layer = null;
    }
    this.layerDef = layerDef;
    this.layer = this.database.layerFactory.createLayer(this, layerDef);
    console.log(`${this.logPrefix()} Loaded, layer=`, this.layer);
  }

  // Signal layer didn't completely draw by returning false, or settings timelapse.lastFrameCompletelyDrawn false
  draw(view, options) {
    if (this.isLoaded()) {
      this.layer.draw(view, options);
      return undefined;
    } else {
      this.requestLoad();
      return false;
    }
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
}
