/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>

import { LayerDB } from './LayerDB';
import { Utils } from './Utils';
import { gEarthTime } from './EarthTime';

declare var EARTH_TIMELAPSE_CONFIG;

export class LayerOptions {
  id: string
  name: string
  category: string
  nLevels?: number
  credit?: string
  drawOptions?: object
  tileWidth?: number
  tileHeight?: number
  date?: string
  loadDataFunction?: () => any
  setDataFunction?: () => any
  drawFunction?: () => any
  numAttributes?: number
  fragmentShader?: string
  layerDef: {[key: string]: string}
  vertexShader?: string
  dotmapColors?: number[]
  epochs?: number[]
  z?: number
  colormap?: string
  avoidShowingChildAndParent?: boolean
  rootUrl?: string
  greenScreen?: boolean
  useTmJsonTimeTicks?: boolean

  customSliderInfo?: {[key: string]: any}
  timelineType?: string
  hasTimeline?: boolean
  startDate?: string
  endDate?: string
  step?: number

  showGraph?: boolean
  mapType?: string
  color?: any
  legendContent?: string
  legendKey?: string
  setDataOptions?: {[key: string]: any}
  scalingFunction?: string
  colorScalingFunction?: string
  externalGeojson?: string
  nameKey?: string
  playbackRate?: string
  masterPlaybackRate?: string
  imageSrc?: string
  paired?: boolean
}

export interface DrawOptions {
  gmapsZoomLevel?: number;
  throttle?: number;
  epoch?: number;
  pointSize?: number;
  currentBValue?: number;
  zoom?: number
  currentTime?: Date
  span?: number
  subsampleAnnualRefugees?: boolean
  pointIdx?: any
  currentC?: number
  color?: [number, number, number, number]
  idx?: number
  buffers?: any
}

interface Timelapse {
  [key: string]: any;
}

export interface LayerDef {
  'Start date'?: string,
  'End date'?: string
}

export class LayerProxy extends LayerOptions {
  database: LayerDB;
  _visible: boolean;
  showGraph: boolean;
  _tileView?: any; // TODO(LayerDB): add the _tileView
  _loadingPromise: Promise<void>;
  _loaded: boolean
  options: any; // TODO: consider moving things out of options and using setDataOptions, drawOptions
  layer: any;

  constructor(id: string, database: LayerDB) {
    console.assert(LayerProxy.isValidId(id));
    super();
    this.id = id;
    this.database = database;
  }

  isVisible(): boolean {
    return this._visible;
  }

  log(arg1, ...args) {
    Utils.timelog(`Layer ${this.id}: ${arg1}`, ...args);
  }

  requestLoad() {
    if (!this._loaded && !this._loadingPromise) {
      this._loadingPromise = this._load();
    }
  }

  async _load() {
    //ret.catalog = 
    let url = `${this.database.apiUrl}layer-catalogs/${this.database.databaseId.file_id_gid()}/layers/${this.id}`
    this.log(`Fetching ${url}`)
    let layerDef: LayerDef = await (await Utils.fetchWithRetry(url)).json();
    this.layer = this.database.layerFactory.createLayer(layerDef);
    this.log(`Loaded, layer=`, this.layer);
    this._loaded = true;
    //this.loadFromLayerDef(layerDef);
  }

  // Signal layer didn't completely draw by returning false, or settings timelapse.lastFrameCompletelyDrawn false
  draw(view, options) {
    if (this._loaded) {
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

