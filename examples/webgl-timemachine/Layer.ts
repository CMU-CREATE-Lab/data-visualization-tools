import { gEarthTime } from './EarthTime'
import { TileIdx } from './TileIdx'
import { TileView, TileBbox } from './TileView'
import { Tile } from './Tile';
import { Timeline, TimelineType } from './Timeline';
import { Glb } from './Glb';
import { LayerProxy } from './LayerProxy';
import { Legend } from './Legend';

export interface DrawOptions {
  bbox?: { tl: any; br: any; };
  showLbyReturns?: any;
  showYemReturns?: any;
  showSyrReturns?: any;
  showIrqReturns?: any;
  showLbyIdps?: any;
  showYemIdps?: any;
  showSyrIdps?: any;
  showIrqIdps?: any;
  question?: number;
  maxValue?: number;
  delta?: any;
  year?: number;
  years?: any;
  showRcp?: any;
  distance?: number;
  mode?: number;
  maxElevation?: any;
  setDataFnc?: string;
  epochRange?: number;
  numGlyphs?: number;
  fadeDuration?: number;
  pointSizeFnc?: any;
  sfactor?: number;
  dfactor?: number;
  glyphPath?: string;
  dotSizeRange?: [number, number];
  edgeColor?: any;
  edgeSize?: any;
  bubbleScaleRange?: [number, number];
  throttle?: number;
  epoch?: number;
  pointSize?: number;
  currentBValue?: number;
  span?: number
  subsampleAnnualRefugees?: boolean
  pointIdx?: any
  currentC?: number
  color?: [number, number, number, number?]
  idx?: number
  buffers?: any
  minTime?: number
  maxTime?: number
  showTemp?: boolean
  minTemp?: number
  maxTemp?: number
  first?: number
  count?: number
}

export class LayerOptions {
    constructor(layerOptions: LayerOptions) {
      for (var attrib in layerOptions) {
        this[attrib] = layerOptions[attrib];
      }
      this.levelThreshold = this.levelThreshold ?? 0
    }
    tileWidth?: number = 256;
    tileHeight?: number = 256;
    layerId: string;
    category: string;
    customSliderInfo?: {};
    timelineType: TimelineType;
    hasTimeline?: boolean = false;
    hasLegend?: boolean = false;
    startDate: string;
    endDate: string;
    date?: string; // if layer represents single date, e.g. static dotmap
    step: number;
    showGraph: boolean;
    mapType: any;
    color: any;
    legendContent: any;
    legendKey: any;
    drawOptions?: DrawOptions = {};
    setDataOptions?: any;
    name: string;
    credit: string;
    scalingFunction: any;
    colorScalingFunction: any;
    externalGeojson: any;
    nameKey: any;
    playbackRate: number = 0.5;
    masterPlaybackRate: number = 1;
    nLevels?: number = 21;
    imageSrc: any;
    drawLayerFunction?: (DrawOptions) => DrawOptions;
    drawFunction: (...any: any[]) => any;
    numAttributes: number;
    vertexShader: string;
    fragmentShader: string;
    drawOrder: number;
    loadDataFunction: any; // TODO
    dataLoadedFunction: any; // TODO
    colormap?: any;
    avoidShowingChildAndParent: boolean;
    rootUrl?: any;
    greenScreen?: any;
    maptype: string;
    setDataFunction?: (...any: any[]) => any;
    layerDef: any;
    maxLevelOverride?: number;
    levelThreshold: number;
    dotmapColors?: number[];
    dotmapColumnDefs?: {name: string, color: string}[];
    layerConstraints?: {[key: string]: any};
  }

  export abstract class Layer extends LayerOptions {
    layerProxy: LayerProxy;
    glb: Glb;
    gl: any;
    _canvasLayer: any;
    _tileView: TileView;
    tileClass: typeof Tile;
    colormapTexture: any;
    ready: boolean;
    colormapImage: HTMLImageElement;
    // null if layer has no timestamps associated with it
    // null if we don't yet have enough information to create a Timeline
    timeline: Timeline = null;
    defaultUrl: string;
    projectionBounds?: {north: number, south: number, east: number, west: number};
    getSublayers?: () => any[];
    legend?: Legend;
    isLoaded(): boolean { return true; }; // Override this in subclass if needed
    legendVisible: boolean;

    constructor(layerProxy: LayerProxy, layerOptions: LayerOptions, tileClass: typeof Tile) {
      super(layerOptions);
      this.layerProxy = layerProxy;
      this.glb = gEarthTime.glb;
      this.gl = this.glb.gl;
      this.tileClass = tileClass;
      this._canvasLayer = gEarthTime.canvasLayer;
      if (!this.drawOptions.color && this.color) {
        // Deprecated declaration of color at toplevel; move to drawOptions
        this.drawOptions.color = this.color;
      }

      // TODO: It's possible a startDate and endDate are unknown from the initial definition
      // and will be loaded later. e.g. a TimeMachine layer and its corresponding tm.json
      if (this.startDate && this.endDate) {
        this.timeline = new Timeline(this.timelineType,
        {startDate: this.startDate, endDate: this.endDate,
         step: this.step, masterPlaybackRate: this.masterPlaybackRate,
         playbackRate: this.playbackRate, hasCachedCaptureTimes: false});
      }

      // Note: This is overriden for WebGLTimeMachineLayers
      this._tileView = new TileView({
        panoWidth: this.tileWidth * Math.pow(2, this.nLevels),
        panoHeight: this.tileHeight * Math.pow(2, this.nLevels),
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
        createTile: this._createTile.bind(this),
        maxLevelOverride: this.maxLevelOverride,
        updateTiles: tileClass.updateTiles,
        levelThreshold: this.levelThreshold
      });

      if (this.colormap) {
        this.ready = false;
        this.colormapTexture = this.createTexture();
        this.colormapImage = new Image();
        this.colormapImage.crossOrigin = "anonymous";
        this.colormapImage.onload = this.handleLoadedColormap.bind(this);
        let that = this;
        this.colormapImage.addEventListener('error',
          function (event) { console.log(`ERROR: cannot load colormap ${that.colormapImage.src}`) }
        );
        this.colormapImage.src = this.colormap;
      }
      else {
        this.ready = true;
        this.colormapTexture = null;
      }
    }
    abstract draw(view: any, options: any);

    isVisible() {
      return this.layerProxy.isVisible();
    }

    getWidth() {
      return this._tileView.getWidth();
    }
    getHeight() {
      return this._tileView.getHeight();
    }
    destroy() {
      this._tileView._discardTilesAndResources();
    }
    getTileView() {
      return this._tileView;
    }
    getTiles() {
      return this._tileView._tiles;
    }
    abortLoading() {
      this._tileView._abort();
    }
    createTexture() {
      var gl = this.gl;
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return texture;
    }
    handleLoadedColormap() {
      var gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.colormapTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.colormapImage);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.ready = true;
    }

    _createTile(ti: TileIdx, bounds: TileBbox) {
      var opt_options: any = {};
      if (this.drawFunction) {
        opt_options.drawFunction = this.drawFunction;
      }
      if (this.scalingFunction) {
        opt_options.scalingFunction = this.scalingFunction;
      }
      if (this.colorScalingFunction) {
        opt_options.colorScalingFunction = this.colorScalingFunction;
      }
      if (this.externalGeojson) {
        opt_options.externalGeojson = this.externalGeojson;
      }
      if (this.setDataOptions) {
        opt_options.setDataOptions = this.setDataOptions;
      }
      return new this.tileClass(this, ti, bounds, opt_options);

    }

    // Typically call this from subclass draw()
    // viewBounds:  xmin, xmax, ymin, ymax all in coords 0-256
    // TODO: Fix this for 900913 coords
  _drawHelper(view, opt_options) {
    if (this.ready) {
      var width = this._canvasLayer.canvas.width / this._canvasLayer.resolutionScale_;
      var height = this._canvasLayer.canvas.height / this._canvasLayer.resolutionScale_;
      var options = opt_options ?? {};

      // Compute transform to be x:0-1, y:0-1
      var transform = new Float32Array([2 / width, 0, 0, 0, 0, -2 / height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);
      translateMatrix(transform, width * 0.5, height * 0.5);

      // Modify transform to show view
      scaleMatrix(transform, view.scale, view.scale);
      translateMatrix(transform, -view.x, -view.y);

      // TODO: Refactor how tile views are initialized and drawn
      this._tileView.setView(view, width, height, this._canvasLayer.resolutionScale_);
      if (this.drawLayerFunction) options = this.drawLayerFunction(options);
      this._tileView.update(transform, options);
    }
  }

  countDrawnPoints() {
    var keys = Object.keys(this._tileView._tiles);
    var pointCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var tile = this._tileView._tiles[keys[i]];
      if (tile._ready) {
        pointCount += tile._pointCount;
      }
    }
    return pointCount;
  }
}
