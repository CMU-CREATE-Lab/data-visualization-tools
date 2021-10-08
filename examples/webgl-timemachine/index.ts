/// <reference path="StoryEditor.js"/>
/// <reference path="../../js/dat.gui.min.js"/>
/// <reference path="../../js/utils.js"/>
/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>
/// <reference path="../../timemachine/js/org/gigapan/timelapse/crossdomain_api.js"/>
/// <reference path="../../timemachine/libs/change-detect/js/TimeMachineCanvasLayer.js"/>
declare var Papa:any;
/// <reference path="../../js/papaparse.min.js"/>

import { dbg } from './dbg'
import { WebGLVectorTile2 } from './WebGLVectorTile2'
import { WebGLVideoTile } from './WebGLVideoTile'
import { Utils } from './Utils';

dbg.Utils = Utils;
console.log(`${Utils.logPrefix()} Loading index.ts`)

import { LayerProxy } from './LayerProxy';
dbg.LayerProxy = LayerProxy;

import { LayerDB } from './LayerDB';
dbg.LayerDB = LayerDB;

import { EarthTime, gEarthTime, setGEarthTime, stdWebMercatorNorth, stdWebMercatorSouth } from './EarthTime';

import { AltitudeSlider } from './altitudeSlider';
dbg.AltitudeSlider = AltitudeSlider;

import { CsvDataGrapher } from './csvDataGrapher';
dbg.CsvDataGrapher = CsvDataGrapher;

import { DateRangePicker } from './dateRangePicker';
dbg.DateRangePicker = DateRangePicker;

import { GSheet } from './GSheet';
dbg.GSheet = GSheet;

import { ContentSearch} from './ContentSearch';
dbg.ContentSearch = ContentSearch;

import { ETMBLayer } from './ETMBLayer'
dbg.MapboxLayer = ETMBLayer;

import { Glb } from './Glb';
import { Timeline } from './Timeline';
import { LayerEditor } from './LayerEditor';
dbg.Glb = Glb;


var EarthlapseUI;
var layerClickHandler;
var toggleHamburgerPanel;

declare var cached_ajax;

jQuery.support.cors = true;
var UTIL = org.gigapan.Util;

var isOffline = false;
var isStaging = window.location.hostname.indexOf("staging.") == 0;
var usingCustomWaypoints = window.location.href.indexOf("explore#waypoints=") >= 0;
var isMobileDevice = UTIL.isMobileDevice();
var isBrowserSupported = UTIL.browserSupported();
var isIE = UTIL.isIE();
var isIEButNotEdge = isIE && !UTIL.isIEEdge();
var ETNotSupported = !UTIL.isWebGLSupported();

if ((ETNotSupported || isMobileDevice) && window.location.href.indexOf("/stories/") >= 0) {
  window.location.href = window.location.href.replace("/stories/", "/m/stories/");
} else if (ETNotSupported && usingCustomWaypoints) {
  var urlParams = UTIL.getUnsafeHashVars();
  var storyName = urlParams.story == "default" ? urlParams.theme : urlParams.story;
  window.location.href = window.location.href.replace("explore", "m/stories/" + storyName);
}

// If we have no internet connection (i.e. using an offline drive) show full list of local layers)
// @ts-ignore
if (!navigator.onLine && navigator.connection && navigator.connection.rtt <= 0) {
  isOffline = true;
}

// We start crashing phones with a ratio > 1 and in general retina is
// quite taxing for our videos and layers, so force pixelRatio to 1.
// And why not IE? Because errors are thrown if we try to modify this window value.
if (!isIE) {
  // @ts-ignore
  window.devicePixelRatio = 1;
}

// Set up markdown used for layer info bubbles
// @ts-ignore
var md = window.markdownit({ breaks: true, html: true });
// Remember old renderer, if overriden, or proxy to default renderer
var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  // Ensure all links open in new window
  var aIndex = tokens[idx].attrIndex('target');
  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank']);
  } else {
    tokens[idx].attrs[aIndex][1] = '_blank';
  }
  // Pass token to default renderer.
  return defaultRender(tokens, idx, options, env, self);
};


//
//// Config ////
//

// Loaded from config-local.js before now
declare var EARTH_TIMELAPSE_CONFIG;
var featuredTheme = "";
var enableMuseumMode = !!EARTH_TIMELAPSE_CONFIG.enableMuseumMode;
// Deprecated. Was json output of snaplapse editor. Instead use waypointSliderContentPath, which points to an online or exported spreadsheet.
var waypointCollection : string = EARTH_TIMELAPSE_CONFIG.waypointCollection;
// TODO: tsv exports are no longer working with new codebase
var waypointSliderContentPath : string = EARTH_TIMELAPSE_CONFIG.waypointSliderContentPath || "default-waypoints.tsv";
// TODO: tsv exports are no longer working with new codebase
var csvLayersContentPath : string;
if (typeof(EARTH_TIMELAPSE_CONFIG.csvLayersContentPath) === "undefined") {
  csvLayersContentPath = "1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE.870361385";
} else if (EARTH_TIMELAPSE_CONFIG.csvLayersContentPath === "") {
  csvLayersContentPath = "default-csvlayers.tsv";
} else {
  csvLayersContentPath =  EARTH_TIMELAPSE_CONFIG.csvLayersContentPath;
}


class EarthTimeImpl implements EarthTime {
  mode = "explore";
  waitFrames: number = 0;
  lastTimeNotWaiting: number;
  defaultMasterPlaybackRate: number = 1.0;
  defaultPlaybackRate: number = 0.5;
  layerDB: LayerDB = null;
  layerDBPromise = null;
  timelapse = null;
  rootTilePath = null;
  dotmapsServerHost = null;
  glb = null;
  canvasLayer = null;
  readyToDraw = false;
  currentlyShownTimeline: any;
  lastPlaybackTime = -1;
  lastView = {x : -1, y : -1, scale: -1};
  lastClientDimensions = {width : -1, height : -1};
  lastDrawnLayers = [];
  async setDatabaseID(databaseID: GSheet) {
    if (loadedLayersGSheet && databaseID.url() == loadedLayersGSheet.url()) return;
    loadedLayersGSheet = databaseID;

    async function internal(earthTime: EarthTimeImpl) {
      earthTime.layerDB = null;
      earthTime.layerDB = dbg.layerDB = await LayerDB.create(databaseID, {earthTime: earthTime});
      populateLayerLibrary();
    }
    this.layerDBPromise = internal(this);
    await this.layerDBPromise;
  }
  async LayerDBLoaded() {
    if (!this.layerDB) await this.layerDBPromise;
  }
  // Compute standard Google Maps zoom level -- 0 means world fits inside 256 pixels across, 1 means 512, 2: 1024 etc
  // Assumes timelapse.getPanoWidth() represents 360 degrees of longitude
  gmapsZoomLevel(): number {
    return Math.log2(this.timelapse.getPanoWidth() * this.timelapse.getView().scale / 256);
  }
  timelapseZoom(): number {
    return this.timelapse.getCurrentZoom();
  }

  _maximumUpdateTime = 30; // milliseconds
  _startOfRedraw: number;

  startRedraw() {
    this._startOfRedraw = performance.now();
  }
  redrawTakingTooLong(): boolean {
    return performance.now() - this._startOfRedraw > this._maximumUpdateTime;
  }

  private getTimelapseEpochTimes(): number[] {
    var ret = [];
    for (var i = 0; i < this.timelapse.getNumFrames(); i++) {
      ret.push(this.timelapse.getFrameEpochTime(i));
    }
    return ret;
  }

  private getTimelapseCurrentTimes(): number[] {
    var currentTimes = [];
    for (var i = 0; i < this.timelapse.getNumFrames(); i++) {
      currentTimes.push(i/this.timelapse.getFps());
    }
    return currentTimes;
  }

  private computeCurrentTimeIndex(currentTime, currentTimes) {
    for (var i = 0; i < currentTimes.length; i++) {
      if (currentTime <= currentTimes[i])  {
        return i;
      }
    }
    return currentTimes.length - 1;
  }

  // What fraction have we advanced to the next time index? (0-1)
  private computeCurrentTimesDelta(currentTime, currentTimes) {
    var currentIndex = this.computeCurrentTimeIndex(currentTime, currentTimes);
    var previousIndex = 0;
    var range = 1;
    if (currentIndex != 0) {
      previousIndex = currentIndex - 1;
      range = (currentTimes[currentIndex] - currentTimes[previousIndex]);
    }
    var delta = (currentTime - currentTimes[previousIndex]) / range;
    return delta;
  }

  currentEpochTime(): number {
    return this.currentEpochTimeAndRate().epochTime;
  }

  // Return:
  // epochTime: timeline's current epoch time, in seconds
  // rate: timelapse animation speed in multiple of realtime, i.e. epoch seconds per playback second
  currentEpochTimeAndRate(): {epochTime:number, rate:number} {
    var currentTime = this.timelapse.getCurrentTime();
    var currentTimes = this.getTimelapseCurrentTimes();
    var epochTimesMs = this.getTimelapseDates();
    if (epochTimesMs[0] == -1) {
      // Timeline is not in units of epoch time.  Pause at beginning 2022
      return {epochTime: 1640995200, rate: 0}
    }
    var delta = this.computeCurrentTimesDelta(currentTime, currentTimes);
    var currentIndex = this.computeCurrentTimeIndex(currentTime, currentTimes);
    var previousIndex = 0;
    if (currentIndex != 0) {
      previousIndex = currentIndex - 1;
    }
    var currentEpochTime = epochTimesMs[currentIndex] / 1000;
    var previousEpochTime = epochTimesMs[previousIndex] / 1000;
    var epochRange = currentEpochTime - previousEpochTime;
    var effectivePlaybackRate = this.timelapse.isPaused() ? 0 : this.timelapse.getPlaybackRate();
    var rate = effectivePlaybackRate * epochRange / (currentTimes[currentIndex] - currentTimes[previousIndex]);
    var epochTime = (previousEpochTime + epochRange*delta);

    var firstEpochTime = epochTimesMs[0] / 1000;
    if (epochTime <= firstEpochTime) {
      epochTime = firstEpochTime;
      rate = 0;
    }
    var lastEpochTime = epochTimesMs[epochTimesMs.length - 1] / 1000;
    if (epochTime >= lastEpochTime) {
      epochTime = lastEpochTime;
      rate = 0;
    }
    return {epochTime: epochTime, rate: rate};
  }

  private getTimelapseDates(): number[] {
    var dates = [];
    for (var i = 0; i < this.timelapse.getNumFrames(); i++) {
      dates.push(this.timelapse.getFrameEpochTime(i));
    }
    return dates;
  }

  // What fraction have we advanced to the next time index? (0-1)
  timelapseCurrentTimeDelta(): number {
    var delta = this.computeCurrentTimesDelta(
      this.timelapse.getCurrentTime(),
      this.getTimelapseCurrentTimes())
    return Math.min(delta, 1);
  }

  // Currently active timeline, computed as last non-empty timeline from visibleLayers
  timeline(): Timeline {
    /*
     * Normally, the last selected layer (rightmost in the share link) controls the timeline.
     * But layers without timelines don't affect this.
     * Base map timeline always has lower priority than other layer's timeline,
     *   even if the base map is later in the share link.
     * Layers with single timestamp (begin time = end time) show a year without a timeline.
     * And enforce that animated base layers like landsat pause that at same time.
     */

    let visibleLayers = this.layerDB.visibleLayers;
    let baseLayerTimeline = null;
    let dataLayerTimeline = null;
    let isFullExtent = false;

    for (let i = 0; i < visibleLayers.length; i++) {
      if (visibleLayers[i].layer?.category == 'Base Layers') {
        baseLayerTimeline = visibleLayers[i].layer?.timeline;
      } else if (visibleLayers[i].layer?.timeline != null) {
        dataLayerTimeline = visibleLayers[i].layer?.timeline;
      } else if (visibleLayers[i].layer?.layerConstraints?.isFullExtent) {
        isFullExtent = true;
      }
    }

    if (!dataLayerTimeline) {
      if (isFullExtent || !baseLayerTimeline)  {
        return null;
      } else {
        return baseLayerTimeline;
      }
    }
    return dataLayerTimeline;

  }

  playbackRates() {
    let visibleLayers = this.layerDB.visibleLayers;
    let rates = { masterPlaybackRate : this.defaultMasterPlaybackRate,
                  playbackRate : this.defaultPlaybackRate };
    // Find the first layer that has non-default playback rates.
    for (let i = visibleLayers.length - 1; i >= 0; i--) {
      let layerMasterPlaybackRate = visibleLayers[i].layer?.masterPlaybackRate;
      let layerPlaybackRate = visibleLayers[i].layer?.playbackRate;
      if ((layerMasterPlaybackRate && layerMasterPlaybackRate != this.defaultMasterPlaybackRate) || (layerPlaybackRate && layerPlaybackRate != this.defaultPlaybackRate)) {
        rates = { masterPlaybackRate : visibleLayers[i].layer.masterPlaybackRate,
                  playbackRate : visibleLayers[i].layer.playbackRate };
        break;
      }
    }
    return rates;
  }

  showVisibleLayersLegendsAndCredits() {
    let loadedLayersInIdOrder = this.layerDB.loadedLayersInIdOrder();
    let foundMapbox = false;
    for (let i = 0; i < loadedLayersInIdOrder.length; i++) {
      if (loadedLayersInIdOrder[i].layer.mapType == "mapbox" && !foundMapbox) {
        foundMapbox = true;
      }
      if (loadedLayersInIdOrder[i].layer.hasLegend && !loadedLayersInIdOrder[i].layer.legendVisible && loadedLayersInIdOrder[i].layer.allTilesLoaded()) {
        this.layerDB.layerFactory.setLegend(loadedLayersInIdOrder[i].id);
      }
    }
    if (foundMapbox && !$mapboxLogoContainer.data("active")) {
      $mapboxLogoContainer.data("active", true).show();
    } else if (!foundMapbox && $mapboxLogoContainer.data("active")) {
      $mapboxLogoContainer.data("active", false).hide();
    }
  }

  handleGraphIfNeeded() {
    // TODO: I would expect loadedLayers() to return only layers that have fully loaded,
    // but the jsondata hash of a tile (see below) can still be undefined for these layers.
    let visibleLayers = this.layerDB.visibleLayers;
    let doShow = false;
    for (let i = visibleLayers.length - 1; i >= 0; i--) {
      let layerProxy = visibleLayers[i];
      if (layerProxy.layer?.showGraph ) {
        doShow = true;
        if (layerProxy.id == csvDataGrapher.activeLayer.id) break;
        var tiles = layerProxy.layer._tileView._tiles;
        var key = Object.keys(tiles)[0];
        if (typeof key == "undefined") break;
        if (!tiles[key].jsondata) break;
        csvDataGrapher.activeLayer.id = layerProxy.id;
        csvDataGrapher.graphDataForLayer(layerProxy.id);
        showHideCsvGrapher(doShow);
        break;
      }
    }
    if (!doShow && csvDataGrapher.activeLayer.id != null) {
      showHideCsvGrapher(doShow);
    }
  }

  updateTimelineIfNeeded() {
    let newTimeline = this.timeline();
    if (newTimeline !== this.currentlyShownTimeline && gEarthTime.layerDB.loadedLayers().length == gEarthTime.layerDB.visibleLayers.length) {
      $(".controls, .captureTime, .customControl").hide();
      let $ui = $(".current-location-text-container, .annotations-resume-exit-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend");
      $ui.addClass("noTimeline");
      if (newTimeline) {
        this.timelapse.getVideoset().setFps(newTimeline.fps);

        // Normally we would use the playback rates associated with the timeline that is currently used, but we are
        // instead using the values from the last turned on layer that has non-default playback rates set.
        let playbackRates = this.playbackRates();
        this.timelapse.setMasterPlaybackRate(playbackRates.masterPlaybackRate);
        this.timelapse.setPlaybackRate(playbackRates.playbackRate, true);
        this.timelapse.loadNewTimelineFromObj(newTimeline.getCaptureTimes(), newTimeline.timelineType);

        // We need timelapse to update the time internally (above) but if we just have one date, we don't actually want to show the timeline UI,
        // so only run this if start date and end date differ.
        if (newTimeline.startDate != newTimeline.endDate) {
          $ui.removeClass("noTimeline");
          if (newTimeline.timelineType == "customUI") {
            $(".customControl").show().children().show();
          } else {
            $(".controls, .captureTime").show();
          }
        } else {
          // Ensure playback is paused for layers with single year (hidden) timeline.
          gEarthTime.timelapse.pause();
        }
      } else {
        // Ensure playback is paused for layers with no timeline.
        gEarthTime.timelapse.pause();
      }
      this.currentlyShownTimeline = newTimeline;
    }
  }
}

// TODO: Do we still want the ability to store spreadsheet link this way?
// Local Storage
if (typeof(Storage) !== "undefined") {
  if (localStorage.waypointSliderContentPath) {
    waypointSliderContentPath = localStorage.waypointSliderContentPath;
  }
  if (localStorage.csvLayersContentPath) {
    csvLayersContentPath = localStorage.csvLayersContentPath;
  }
}

// Check if we are overriding the layer spreadsheet in the share link
var harshVars = UTIL.getUnsafeHashVars();
var layerDBId = GSheet.from_url(csvLayersContentPath);;
if (harshVars.csvlayers) {
  var [fileId, gId] = harshVars.csvlayers.split(".");
  layerDBId = new GSheet(fileId, gId);
}

setGEarthTime(new EarthTimeImpl());
gEarthTime.setDatabaseID(layerDBId);


var showStories = typeof(EARTH_TIMELAPSE_CONFIG.showStories) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showStories;
var showCustomDotmaps = typeof(EARTH_TIMELAPSE_CONFIG.showCustomDotmaps) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showCustomDotmaps;
var showCsvLayers = !!EARTH_TIMELAPSE_CONFIG.showCsvLayers;
var googleMapsAPIKey = parseConfigOption({optionName: "googleMapsAPIKey", optionDefaultValue: "AIzaSyAGTDshdDRmq8zdw26ZmwJOswh6VseIrYY", exposeOptionToUrlHash: false});
var showFullScreenButton = parseConfigOption({optionName: "showFullScreenButton", optionDefaultValue: false, exposeOptionToUrlHash: true});
var showThumbnailTool = parseConfigOption({optionName: "showThumbnailTool", optionDefaultValue: true, exposeOptionToUrlHash: false});
var thumbnailServerHost = parseConfigOption({optionName: "thumbnailServerHost", optionDefaultValue: undefined, exposeOptionToUrlHash: false});
gEarthTime.dotmapsServerHost = parseConfigOption({optionName: "dotmapsServerHost", optionDefaultValue: "https://dotmaptiles.createlab.org/", exposeOptionToUrlHash: false});
var headlessClientHost = parseConfigOption({optionName: "headlessClientHost", optionDefaultValue: undefined, exposeOptionToUrlHash: false});
var usePresentationClicker = parseConfigOption({optionName: "usePresentationClicker", optionDefaultValue: false, exposeOptionToUrlHash: false});
var enableThemeHamburgerButton = parseConfigOption({optionName: "enableThemeHamburgerButton", optionDefaultValue: false, exposeOptionToUrlHash: false});
// Show timestamp, legend, logos
var minimalUI = parseConfigOption({optionName: "minimalUI", optionDefaultValue: false, exposeOptionToUrlHash: true});
// Show only timestamp
// Legacy (TODO: remove) - This version of the param has a special case on the thumbnail server. It centers the timestamp at the bottom.
var timestampOnlyUI = parseConfigOption({optionName: "timestampOnlyUI", optionDefaultValue: false, exposeOptionToUrlHash: true});
// This version of the param will place the timestamp at the bottom center.
var timestampOnlyUICentered = parseConfigOption({optionName: "timestampOnlyUICentered", optionDefaultValue: false, exposeOptionToUrlHash: true});
// This version of the param will place the timestamp at the bottom left.
var timestampOnlyUILeft = parseConfigOption({optionName: "timestampOnlyUILeft", optionDefaultValue: false, exposeOptionToUrlHash: true});
// Only show visualization
var disableUI = parseConfigOption({optionName: "disableUI", optionDefaultValue: false, exposeOptionToUrlHash: true});
(window as any).disableUI = disableUI;
// Hide annotation box
var disableAnnotations = parseConfigOption({optionName: "disableAnnotations", optionDefaultValue: false, exposeOptionToUrlHash: true});
// Prevent presentation slider from being initialized
var disablePresentationSlider = parseConfigOption({optionName: "disablePresentationSlider", optionDefaultValue: false, exposeOptionToUrlHash: true});
// Hide waypoint/bookmark slider
var hidePresentationSlider = parseConfigOption({optionName: "hidePresentationSlider", optionDefaultValue: false, exposeOptionToUrlHash: true});
var initiallyShowPresentationSlider = hidePresentationSlider ? true : parseConfigOption({optionName: "initiallyShowPresentationSlider", optionDefaultValue: false, exposeOptionToUrlHash: true});
var forceLegend = parseConfigOption({optionName: "forceLegend", optionDefaultValue: false, exposeOptionToUrlHash: true});
var centerLegend = parseConfigOption({optionName: "centerLegend", optionDefaultValue: false, exposeOptionToUrlHash: true});
var extraContributors = parseConfigOption({optionName: "extraContributors", optionDefaultValue: "", exposeOptionToUrlHash: false});
if (extraContributors) {
  extraContributors = extraContributors.replace(",", " |");
}
var extraContributorsLogoPath = parseConfigOption({optionName: "extraContributorsLogoPath", optionDefaultValue: "", exposeOptionToUrlHash: false});
var extraContributorTakesPrecedence = parseConfigOption({optionName: "extraContributorTakesPrecedence", optionDefaultValue: false, exposeOptionToUrlHash: false});
var showCredits = parseConfigOption({optionName: "showCredits", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showShareButton = parseConfigOption({optionName: "showShareButton", optionDefaultValue: true, exposeOptionToUrlHash: true});
var showSettingsButton = isMobileDevice ? false : parseConfigOption({optionName: "showSettingsButton", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showZoomControls = parseConfigOption({optionName: "showZoomControls", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showStoriesButton = !showStories ? false : parseConfigOption({optionName: "showStoriesButton", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showLayersButton = parseConfigOption({optionName: "showLayersButton", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showHomeLogo = parseConfigOption({optionName: "showHomeLogo", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showSearchBox = parseConfigOption({optionName: "showSearchBox", optionDefaultValue: true, exposeOptionToUrlHash: true});
var letterboxBottomOffset = parseConfigOption({optionName: "letterboxBottomOffset", optionDefaultValue: 312, exposeOptionToUrlHash: false});
var enableLetterboxMode = parseConfigOption({optionName: "enableLetterboxMode", optionDefaultValue: false, exposeOptionToUrlHash: true});
var disableTopNav = enableLetterboxMode ? true : parseConfigOption({optionName: "disableTopNav", optionDefaultValue: false, exposeOptionToUrlHash: true});
var disableResumeExitAnnotationPrompt = parseConfigOption({optionName: "disableResumeExitAnnotationPrompt", optionDefaultValue: false, exposeOptionToUrlHash: false});
var isHyperwall = parseConfigOption({optionName: "isHyperwall", optionDefaultValue: false, exposeOptionToUrlHash: false});
var useGoogleSearch = parseConfigOption({optionName: "useGoogleSearch", optionDefaultValue: true, exposeOptionToUrlHash: false});
var enableAutoMode = parseConfigOption({optionName: "enableAutoMode", optionDefaultValue: false, exposeOptionToUrlHash: false});
var autoModeCriteria = parseConfigOption({optionName: "autoModeCriteria", optionDefaultValue: {}, exposeOptionToUrlHash: false});
var screenTimeoutInMilliseconds = parseConfigOption({optionName: "screenTimeoutInMilliseconds", optionDefaultValue: (8 * 60 * 1000), exposeOptionToUrlHash: false});
var waypointDelayInMilliseconds = parseConfigOption({optionName: "waypointDelayInMilliseconds", optionDefaultValue: (1 * 15 * 1000), exposeOptionToUrlHash: false});
// Note that while this does say speed, it is actually playback rate. (i.e. generally a value between 0-1)
var defaultPlaybackSpeed = parseConfigOption({optionName: "defaultPlaybackSpeed", optionDefaultValue: gEarthTime.defaultPlaybackRate, exposeOptionToUrlHash: false});
var useFaderShader = parseConfigOption({optionName: "useFaderShader", optionDefaultValue: true, exposeOptionToUrlHash: false});
var enableWaypointText = parseConfigOption({optionName: "enableWaypointText", optionDefaultValue: true, exposeOptionToUrlHash: false});
var defaultTrackingId = document.location.hostname === "earthtime.org" ? "UA-10682694-21" : "";
var trackingId = parseConfigOption({optionName: "trackingId", optionDefaultValue: defaultTrackingId, exposeOptionToUrlHash: false});
gEarthTime.rootTilePath = parseConfigOption({optionName: "rootTilePath", optionDefaultValue: "../../../data/", exposeOptionToUrlHash: false});
var enableStoryEditor = !showStories ? false : parseConfigOption({optionName: "enableStoryEditor", optionDefaultValue: false, exposeOptionToUrlHash: false});
var pauseWhenInitialized = parseConfigOption({optionName: "pauseWhenInitialized", optionDefaultValue: false, exposeOptionToUrlHash: true});
var disableAnimation = parseConfigOption({optionName: "disableAnimation", optionDefaultValue: false, exposeOptionToUrlHash: true});
var preserveDrawingBuffer = parseConfigOption({optionName: "preserveDrawingBuffer", optionDefaultValue: false, exposeOptionToUrlHash: true});


//
//// App variables ////
//

// TODO: Firefox seeking speed is not precise enough for the assumption made by the fader shader.
// For now, disable fader shader for Firefox otherwise we get jumpback during playback.
WebGLVideoTile.useFaderShader = UTIL.isFirefox() ? false : useFaderShader;
var isAutoModeRunning = false;
var visibleBaseMapLayer = "blsat";
var thumbnailTool;
var snaplapseViewerForPresentationSlider;
interface Bounds {
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number
}

interface Waypoint {
  scale?: number,
  bounds?: Bounds
}
var previousWaypoint: Waypoint = {};
var waypointViewChangeListener;
var hideWaypointListener;
var snaplapseForPresentationSlider;
var parabolicMotionStoppedListener;
var currentWaypointTheme = "";
var currentWaypointStory;
var annotationPicturePaths = {};
var waypointJSONList = {};
var lastSelectedWaypointIndex = -1;
var keysDown = [];
var loadedInitialCsvLayers = false;
var dotmapLayersInitialized = false;
var csvFileLayersInitialized = false;
var storiesInitialized = false;
var timeMachinePlayerInitialized = false;
var $nextAnnotationLocationButton;
var $previousAnnotationLocationButton;
var lastLayerMenuScrollPos = 0;
var $lastActiveLayerTopic;
var lastSelectedAnnotationBeforeHidden;
var initialTopNavWrapperElm;
var $activeLayerDescriptionTooltip;
var storyEditor;
var storyLoadedFromRealKeyDown = false;
var $mapboxLogoContainer;
var verboseRedrawTest = false;
var spinnerWaitTime = 1000; // milliseconds


function parseConfigOption(settings) {
  var returnVal = (typeof(EARTH_TIMELAPSE_CONFIG[settings.optionName]) === "undefined" && typeof(settings.optionDefaultValue) !== "undefined") ? settings.optionDefaultValue : EARTH_TIMELAPSE_CONFIG[settings.optionName];

  if (settings.exposeOptionToUrlHash) {
    var hashVars = UTIL.getUnsafeHashVars(true);
    var configOptionInHash = hashVars.hasOwnProperty(settings.optionName);
    if (configOptionInHash) {
      returnVal = hashVars[settings.optionName];
      // If option in hash but no value set, assume value is true and return early
      if (typeof(returnVal) === "undefined") {
        return true;
      }
    }
  }

  if (typeof(settings.optionDefaultValue) === "number") {
    returnVal = parseFloat(returnVal);
  } else if (typeof(settings.optionDefaultValue) === "boolean") {
    returnVal = String(returnVal) === "true";
  }

  return returnVal;
}

var clearTimelineUIChangeListeners = function() {
  for (var i = timelineUIChangeListeners.length - 1; i >= 0; i--) {
    var entry = timelineUIChangeListeners[i];
    if (entry.type == "interval") {
      clearInterval(entry.fn);
    } else if (entry.type == "timeout") {
      clearTimeout(entry.fn);
    } else if (entry.type == "uiChangeListener") {
      gEarthTime.timelapse.removeTimelineUIChangeListener(entry.fn);
    }
    timelineUIChangeListeners.splice(i, 1);
  }
};

var autoModeExtrasViewChangeHandler = function() {
  gEarthTime.timelapse.removeParabolicMotionStoppedListener(autoModeExtrasViewChangeHandler);
  if (snaplapseViewerForPresentationSlider && snaplapseViewerForPresentationSlider.isAutoModeRunning()) {
    var $videoExtra = $("#extras-video");
    if ($videoExtra.length > 0) {
      snaplapseViewerForPresentationSlider.setAutoModeEnableState(false);
      snaplapseViewerForPresentationSlider.clearAutoModeTimeout();
      // @ts-ignore
      $videoExtra[0].originalLoop = $videoExtra[0].loop;
      // @ts-ignore
      $videoExtra[0].loop = false;
      $videoExtra[0].addEventListener('ended', function(event) {
        setTimeout(function() {
          // @ts-ignore
          $videoExtra[0].loop = $videoExtra[0].originalLoop;
          snaplapseViewerForPresentationSlider.setAutoModeEnableState(true);
          snaplapseViewerForPresentationSlider.initializeAndRunAutoMode();
        }, 1000);
      });
    }
  }
};
(window as any).autoModeExtrasViewChangeHandler = autoModeExtrasViewChangeHandler;

interface FrameGrabInterface {
  isLoaded(): boolean;
  captureFrame(state: {[key: string]: any}): {[key: string]: any};
}

let frameGrab: FrameGrabInterface = {
  isLoaded: function(): boolean {
    // In addition to readyToDraw being true, we also need timeline information loaded before we can properly handle the bt/et values of a sharelink,
    //   which we use to determine the number of frames to export and shard out.
    // We determine all this by seeing not only that gEarthTime is "ready" but also that the number of layers requested matches the number of layers loaded
    //   (note the tiles may not have loaded, which is fine).
    return isEarthTimeLoadedAndInitialLayerProxiesLoaded();
  },
  captureFrame: function(state: {bounds:any, seek_time:number}): {[key: string]: any} {
    Utils.clearGrablog();
    let before_frameno = gEarthTime.timelapse.frameno;
    gEarthTime.timelapse.setNewView(state.bounds, true);
    gEarthTime.timelapse.seek(state.seek_time);
    gEarthTime.canvasLayer.update_();

    let layerInfo = [];
    for (let layerProxy of gEarthTime.layerDB.visibleLayers) {
      layerInfo.push(layerProxy.info());
    }

    return {
      complete: gEarthTime.timelapse.lastFrameCompletelyDrawn,
      after_time: gEarthTime.timelapse.getCurrentTime(),
      before_frameno: before_frameno,
      frameno: gEarthTime.timelapse.frameno,
      aux_info: {
        layerdb_size: gEarthTime.layerDB.orderedLayers.length,
        visible_layers: gEarthTime.layerDB.visibleLayerIds(),
        layer_info: layerInfo.join('\n'),
        log: Utils.getGrablog().join('\n')
      }
    }
  }
};

(window as any).gFrameGrab = frameGrab;

function isEarthTimeLoaded() {
  return gEarthTime.readyToDraw;
}
(window as any).isEarthTimeLoaded = isEarthTimeLoaded;

function isEarthTimeLoadedAndInitialLayerProxiesLoaded() {
  return isEarthTimeLoaded() &&
         gEarthTime.layerDB.visibleLayers.length > 0 &&
         gEarthTime.layerDB.loadedLayers().length == gEarthTime.layerDB.visibleLayers.length;
}

function googleMapsLoadedCallback() {
  if (useGoogleSearch && $("#location_search").length) {
    // @ts-ignore
    var autocomplete = new google.maps.places.Autocomplete($("#location_search").get(0));
    var geocoder = new google.maps.Geocoder();

    // Hack to enable places selection from dropdown on touch screens
    $(document).on('touchstart', '.pac-item', function(e) {
      e.preventDefault();
      var searchText = $(this).text();
      $("#location_search").val(searchText);
      google.maps.event.trigger(autocomplete, 'place_changed', {
        locationName: searchText
      });
      $('.pac-container').hide();
    });

    $("#location_search").on("input", function(e) {
      if ($(this).val() == "") {
        $("#location_search_clear_icon").hide();
      } else {
        $("#location_search_clear_icon").show();
      }
    });

    $("#location_search").on("keydown", function(e) {
      if (e.keyCode == 13) {
        google.maps.event.trigger(e.target, 'focus', {});
        google.maps.event.trigger(e.target, 'keydown', {
          keyCode: 13
        });
      }
    });

    google.maps.event.addListener(autocomplete, 'place_changed', function(options) {
      var place = (options && options.locationName) || autocomplete.getPlace();
      if (!place) return;
      if (!place.geometry) {
        var address = $("#location_search").val();
        $("#location_search").val("");
        geocoder.geocode({
          // @ts-ignore
          'address': address
        }, function(results, status) {
          if (status == google.maps.GeocoderStatus.OK) {
            var lat = results[0].geometry.location.lat();
            var lng = results[0].geometry.location.lng();
            newView = {
              center: {
                "lat": lat,
                "lng": lng
              },
              "zoom": 10
            };
            gEarthTime.timelapse.setNewView(newView, false, false);
          } else {
            console.log("Geocode failed: " + status);
          }
        });
      } else {
        var newView = {
          center: {
            "lat": place.geometry.location.lat(),
            "lng": place.geometry.location.lng()
          },
          "zoom": 10
        };
        gEarthTime.timelapse.setNewView(newView, false, false);
      }

      var searchLocation = (options && options.locationName) || place.formatted_address;
      if (searchLocation) {
        searchLocation = searchLocation.replace(/ /g, '');
        UTIL.addGoogleAnalyticEvent('textbox', 'search', 'go-to-searched-place=' + searchLocation);
      }
    });
  }
}


async function handleLayers(layerIds: string[], setByUser?: boolean) {
  await gEarthTime.layerDBPromise;
  var layerProxies = [];

  // Note that main UI logic should be done in LayerFactory.handleLayerMenuUI()
  // This method should just do getLayer calls and then pass to LayerDB.setVisibleLayers

  for (var layerId of layerIds) {
    var layerProxy = gEarthTime.layerDB.getLayer(layerId);
    if (layerProxy) {
      layerProxies.push(layerProxy);
    } else {
      console.log(`${Utils.logPrefix()} handlelayers: Cannot find layer ${layerId}`);
    }
  }
  console.log(`${Utils.logPrefix()} handleLayers; calling setVisibleLayers`);
  gEarthTime.layerDB.setVisibleLayers(layerProxies, setByUser);
}
(window as any).handleLayers = handleLayers;

function initLayerToggleUI() {
  $("#extras-content-container").dialog({
    appendTo: "#timeMachine",
    modal: false,
    autoOpen: false,
    draggable: false,
    resizable: false,
    dialogClass: "extras-content-dialog",
    open: function(event, ui) {
      $("#timeMachine").removeClass("presentationSliderSelection presentationSliderSelectionOverflow");
      $("#navControls").children().not(".fullScreen").addClass("force-hidden");
      if (enableLetterboxMode) {
        $(".extras-content-dialog").addClass("letterbox");
      }
    },
    close: function(event, ui) {
      gEarthTime.timelapse.removeParabolicMotionStoppedListener(autoModeExtrasViewChangeHandler);
      var $extrasContentContainer = $(event.target);
      var layerId = $extrasContentContainer.data("layer-id");
      var $selectedLayer = $("#layers-menu input#" + layerId);
      var fromCloseButton = $(event.currentTarget).hasClass('ui-dialog-titlebar-close');
      if (fromCloseButton) {
        $selectedLayer.trigger("click");
      }
      var extrasVideo = $("#extras-video")[0] as HTMLVideoElement;
      var extrasIframe = $("#extras-iframe")[0] as HTMLIFrameElement;
      if (extrasVideo) {
        extrasVideo.pause();
        extrasVideo.removeEventListener("loadstart", autoModeExtrasViewChangeHandler);
        extrasVideo.src = "";
      } else if (extrasIframe) {
        extrasIframe.src = "";
      }
      $extrasContentContainer.data("layer-id", "");
      $("#navControls").children().removeClass("force-hidden");
    }
  }).css({
    'z-index': '2000',
    'left': '0px',
    'top': '0px'
  });

  $(document).on("keydown", function(e) {
    var fromRealKeydown = e.originalEvent && e.pageX != 0 && e.pageY != 0;
    // @ts-ignore
    if ((e.target.tagName == "INPUT" || e.target.tagName == "TEXTAREA") && !!fromRealKeydown) return;

    // 'page up' key
    // Quick way to step forward through waypoints
    if (!disablePresentationSlider && e.keyCode === 33) {
      var selectedIdx = 0;
      var $selectedWaypoint = $(".snaplapse_keyframe_list .thumbnail_highlight");
      if ($selectedWaypoint.length > 0) {
        selectedIdx = $selectedWaypoint.parents(".snaplapse_keyframe_list_item").index();
        selectedIdx++;
        if (selectedIdx > $(".snaplapse_keyframe_list").children().last().index()) {
          selectedIdx = 0;
        }
      }
      $(".snaplapse_keyframe_list").children().eq(selectedIdx).children().first().trigger("click", {fromKeyboard: true});
    }

    // 'page down' key
    // Quick way to step backwards through waypoints
    if (!disablePresentationSlider && e.keyCode === 34) {
      var lastWaypointIdx, selectedIdx: number;
      lastWaypointIdx = selectedIdx = $(".snaplapse_keyframe_list").children().last().index();
      var $selectedWaypoint = $(".snaplapse_keyframe_list .thumbnail_highlight");
      if ($selectedWaypoint.length) {
        selectedIdx = $selectedWaypoint.parents(".snaplapse_keyframe_list_item").index();
        selectedIdx--;
        if (selectedIdx < 0) {
          selectedIdx = lastWaypointIdx;
        }
      }
      $(".snaplapse_keyframe_list").children().eq(selectedIdx).children().first().trigger("click", {fromKeyboard: true});
    }

    // 'tab' or 'enter' key
    // Quick way to toggle play/pause
    if (usePresentationClicker) {
      if (e.keyCode === 9 || e.keyCode === 13) {
        e.preventDefault();
        e.stopImmediatePropagation();
        gEarthTime.timelapse.handlePlayPause();
      }
    }

    // 'a' key
    // Quick way to stop animating and go to the beginning
    if (e.keyCode === 65) {
      if (!gEarthTime.timelapse.isPaused()) {
        gEarthTime.timelapse.handlePlayPause();
      }
      gEarthTime.timelapse.seek(0);
    }
    // 's' key
    // Quick way to stop animating and go to the end
    if (e.keyCode === 83 && keysDown.length == 0) {
      if (!gEarthTime.timelapse.isPaused()) {
        gEarthTime.timelapse.handlePlayPause();
      }
      gEarthTime.timelapse.seek(gEarthTime.timelapse.getDuration());
    }
    // 'c' key and share view dialog is not visible
    // Quick way to clear all layers
    if (e.keyCode === 67) {
      handleLayers([]);
      /*var openCategories = $("#layers-menu h3.ui-accordion-header.ui-state-active");
      var availableCategories = $(".map-layer-div").children("h3");
      $.each(openCategories, function(index, value) {
        if (index == 0) return;
        var openIndex = availableCategories.index(openCategories[index]);
        $(".map-layer-div").accordion("option", "active", openIndex);
      });*/
      if ($(".current-location-text-container").is(":visible")) {
        showAnnotationResumeExit();
      }
      $(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight").removeClass("thumbnail_highlight");
      gEarthTime.timelapse.clearShareViewTimeLoop();
    }
    // 'h' key
    // Quick way to toggle the layer panel
    if (e.keyCode === 72) {
      $("#presentation-slider-hamburger-wrapper").trigger("click");
    }
    // 'l' key (lowercase L)
    // Quick way to turn on automode
    if (e.keyCode === 76) {
      if (typeof(EarthlapseUI) !== "undefined" && enableMuseumMode) {
        EarthlapseUI.Modes.revertToDefault();
      } else {
        var currentSelectedWaypoint = snaplapseViewerForPresentationSlider.getCurrentWaypointIndex();
        if (currentSelectedWaypoint >= 0) {
          snaplapseViewerForPresentationSlider.setCurrentAutoModeWaypointIdx(currentSelectedWaypoint);
        }
        snaplapseViewerForPresentationSlider.initializeAndRunAutoMode();
      }
    }

    //'k' key
    if (e.keyCode === 75) {
      if (!$('#layer-editor').length) {
        $('#viewerContainer').append('<div id="layer-editor">Layers</div>');
      }

      $('#layer-editor').dialog({
        height: 640,
        maxHeight: 640,
        maxWidth: 960,
        width: 720
      });
      var layerEditor = new LayerEditor('layer-editor');
    }

    // up arrow
    // Quick way to toggle between the various items whether under the extras menu (if just selected) or a layer
    if (e.keyCode === 38) {
      var $newActiveTopic = $(document.activeElement).closest($(".ui-accordion-content")) as JQuery<HTMLElement>;
      $lastActiveLayerTopic = $newActiveTopic.length ? $newActiveTopic : $lastActiveLayerTopic;
      if (!$lastActiveLayerTopic) return;
      var $layers = $lastActiveLayerTopic.find("input");
      for (var i = 0; i < $layers.length; i++) {
        if ($($layers[i]).prop('checked')) {
          $layers.filter(":checked").click();
          $($layers[i-1]).trigger('click');
          e.preventDefault();
          break;
        }
      }
    }
    // down arrow
    // Quick way to toggle between the various items whether under the extras menu (if just selected) or a layer
    if (e.keyCode === 40) {
      var $newActiveTopic = $(document.activeElement).closest($(".ui-accordion-content")) as JQuery<HTMLElement>;
      $lastActiveLayerTopic = $newActiveTopic.length ? $newActiveTopic : $lastActiveLayerTopic;
      if (!$lastActiveLayerTopic) return;
      var $layers = $lastActiveLayerTopic.find("input");
      for (var i = 0; i < $layers.length; i++) {
        if ($($layers[i]).prop('checked')) {
          $layers.filter(":checked").click();
          $($layers[i+1]).trigger('click');
          e.preventDefault();
          break;
        }
      }
    }
    // "<" and ">" tweak dot sizes.  "." resets dotScale to 1
    if (e.key == '<' && WebGLVectorTile2.dotScale > 0.4) {
      WebGLVectorTile2.dotScale /= 1.3;
    } else if (e.key == '>' && WebGLVectorTile2.dotScale < 4) {
      WebGLVectorTile2.dotScale *= 1.3;
    } else if (e.key == '.') {
      WebGLVectorTile2.dotScale = 1;
    }
    if (keysDown.indexOf(e.keyCode) < 0) {
      keysDown.push(e.keyCode);
      // SHIFT + S + V
      // Shortcut to bring up share view dialog
      if (keysDown[0] === 16 && keysDown[1] === 83 && keysDown[2] === 86) {
        $(".sharePicker").trigger("click");
      }
      // SHIFT + J
      // Shortcut to bring up settings dialog
      if (keysDown[0] === 16 && keysDown[1] === 74) {
        showSettingsDialog();
      }
    }
  }).on("keyup", function(e) {
    keysDown.length = 0;
  });

  $('#layers-menu').on("click", "input[type=checkbox], input[type=radio]", function(e) {
    var selectedLayerName = $(this).parent().attr("name");
    var $selection = $(this);
    var isSelectionChecked = $selection.prop("checked");
    $('#layers-menu label[name=' + selectedLayerName + ']').find("input").prop("checked", isSelectionChecked);
    var fromRealKeydown = e.originalEvent && e.pageX != 0 && e.pageY != 0;
    if (fromRealKeydown && $(".current-location-text-container").is(':visible')) {
      showAnnotationResumeExit();
    }
    if (isMobileDevice || isIEButNotEdge) {
      if (visibleBaseMapLayer != "blsat") {
        UTIL.setDrawState(false);
      } else {
        UTIL.setDrawState(true);
      }
    }
    gEarthTime.timelapse.updateShareViewTextbox();

  });

  $('#layers-menu').on("change", "input", function(e) {
    if (enableLetterboxMode) {
      updateLetterboxSelections($(this));
    }

    // Legend container toggling
    let $legendContainer = $("#layers-legend");
    if ($legendContainer.find("tr").length > 0) {
      $legendContainer.show();
    } else {
      $legendContainer.hide();
    }

    if (e.originalEvent && e.pageX != 0 && e.pageY != 0 && $(this).prop('checked')) {
      UTIL.addGoogleAnalyticEvent('button', 'click', 'layer=' + $(this).prop("id"));
    }
  });

  layerClickHandler = function(e) {
    var $toggledLayerElm = $(e.target);
    var toggledLayerId = $toggledLayerElm.parent("label").attr("name");

    let layerIdsToBeDrawn = gEarthTime.layerDB.visibleLayerIds();
    if ($toggledLayerElm.prop("checked")) {
      layerIdsToBeDrawn.push(toggledLayerId);
    } else {
      layerIdsToBeDrawn.splice(layerIdsToBeDrawn.indexOf(toggledLayerId), 1);
    }
    handleLayers(layerIdsToBeDrawn, true);
  };

  $('#layers-menu').on('click', "input[type=checkbox], input[type=radio]", layerClickHandler);

  $("body").on("click", "#layers-list .ui-accordion-header, #layers-list-featured .ui-accordion-header", function(e) {
    // Don't scroll layer category into view if it was not initiated by an actual user interaction.
    if (!e.originalEvent && !e.detail) return;
    var $this = $(this);
    if (!$this.hasClass("ui-state-active")) {
      lastLayerMenuScrollPos = 0;
      return;
    }
    var $topParentContainer = $this.parents("ul");
    // -5px of borders, paddings, etc
    lastLayerMenuScrollPos = this.offsetTop - $topParentContainer.offset().top + $("#layers-menu #search-content").outerHeight() - 5;
    var $scrollContainer = $topParentContainer.children(".layers-scroll-vertical, .featured-layers-scroll-vertical");
    $scrollContainer.animate({
      scrollTop: lastLayerMenuScrollPos
    });
    $lastActiveLayerTopic = $this.next();
  });

  $(document).on("click touchmove", function(e) {
    if ($activeLayerDescriptionTooltip && $activeLayerDescriptionTooltip.length && !$(e.target).hasClass("layer-description") && !$(e.target).closest("div").hasClass("ui-tooltip-content")) {
      $activeLayerDescriptionTooltip.tooltip("disable");
      $activeLayerDescriptionTooltip = null;
    }
    // @ts-ignore
    if ((e.target).id == "menu-icon" || $(e.target).hasClass("shrink-nav")) return;

    if ($("#menu-icon").is(":visible")) {
      $("#top-nav li.menu-option").hide();
    }
  });

  $("#top-nav .menu-option").on("click", function() {
    if ($("#menu-icon").is(":visible")) {
      $("#top-nav li.menu-option").hide();
    }
  });

  $("#menu-icon").on("click", function() {
    if ($("#top-nav li.menu-option").is(":visible")) {
      $("#top-nav li.menu-option").hide();
    } else {
      $("#top-nav li.menu-option").show();
    }
  });

  // TODO(pdille): Fix for new code
  // Add vertical/horizontal scroll support to specific parts of the UI (e.g. layers/themes panels)
  /*try {
    if (UTIL.isTouchDevice()) {
      UTIL.verticalTouchScroll($("#layers-list .layers-scroll-vertical"));
      UTIL.verticalTouchScroll($("#layer-search-results.layers-scroll-vertical"));
      UTIL.verticalTouchScroll($("#theme-list .themes-scroll-vertical"));
      UTIL.verticalTouchScroll($("#csvChartLegend"));
      if (enableLetterboxMode) {
        UTIL.touchHorizontalScroll($("#letterbox-bottom-picker-content"));
        UTIL.touchHorizontalScroll($("#letterbox-bottom-picker-results-content"));
      }
    }
  } catch (e) {
    console.log('Error creating scroll events for UI: ', e);
  }*/

  // Set the starting base layer
  $('input:radio[name=base-layers][id=' + visibleBaseMapLayer + '-base]').trigger("click");

  gEarthTime.timelapse.addResizeListener(function() {
    if ($(".player").hasClass("right-panel-active")) {
      $("#top-nav, #csvChartContainer, #timeMachine .presentationSlider").addClass("right-panel-active");
    } else {
      $("#top-nav, #csvChartContainer, #timeMachine .presentationSlider").removeClass("right-panel-active");
    }
    resize();
  });

  thumbnailTool = gEarthTime.timelapse.getThumbnailTool();
}
// END of initLayerToggleUI()


function removeFeaturedTheme() {
  $("#featured-layers-title, #layers-list-featured").remove();
  $(".map-layer-div").show();
  $("#layers-list").removeClass("featured");
  featuredTheme = "";
};

function createFeaturedLayersSection() {
  if (enableLetterboxMode) return;

  $("#featured-layers-title, #layers-list-featured").remove();

  $("<div id='featured-layers-title'>Featured Data for: <br>" + featuredTheme + "</div><ul id='layers-list-featured'><div class='featured-layers-scroll-vertical'><div id='featured-layers'></div></div><div id='show-more-layers'>Show More</div></ul>").insertBefore($("#layers-list"));

  var featuredLayerCount = 0;
  // TODO(rsargent)  Work with pdille on a replacement for this
  // var layerDefs = csvFileLayers.layersData.data;
  // if (!layerDefs) return;
  // for (var i = 0; i < layerDefs.length; i++) {
  //   var layerDef = layerDefs[i];
  //   var shareLinkIdentifier = layerDef['Share link identifier'];
  //   var $layer = $("#layers-list label[name='" + shareLinkIdentifier + "']");
  //   // Featured layers section
  //   if (featuredTheme) {
  //     var possibleFeaturedThemes = layerDef['Featured Themes'] ? JSON.parse(layerDef['Featured Themes']) : [];
  //     if (possibleFeaturedThemes.indexOf(featuredTheme) != -1 || possibleFeaturedThemes.indexOf("All") != -1) {
  //       featuredLayerCount++;
  //       var $clonedLayer = $layer.closest("tr").clone(true, true);
  //       var inputGroup;
  //       if (shareLinkIdentifier == "blsat" || shareLinkIdentifier == "bdrk") {
  //         var inputGroup = $clonedLayer.find("input");
  //         inputGroup.attr("name", inputGroup.attr("name") + "-featured");
  //       }
  //       // TODO: If the layer to clone is not in the DOM, errors be thrown
  //       var clonedLayerCategory = $layer.closest("table").attr("id");
  //       if (!clonedLayerCategory) continue;
  //       if ($('#featured-layers #' + clonedLayerCategory + "-featured").length == 0) {
  //         $("#featured-layers").append($("<h3>" + clonedLayerCategory.split("category-")[1].replace('-',' ') + "</h3><table id='" + clonedLayerCategory + "-featured'></table>"));
  //       }
  //       $('#featured-layers #' + clonedLayerCategory + "-featured").append($clonedLayer);
  //     }
  //   }
  // }

  // If we don't find any layers that match the selected theme or we just have base layers, remove the featured section and show all layers
  if (featuredLayerCount == 0 || $("#featured-layers").find("h3").length == 1) {
    removeFeaturedTheme();
  } else {
    $("#layers-list").addClass("featured");

    $("#show-more-layers").on("click", function() {
      if ($(this).hasClass("active")) {
        $("#featured-layers-title, .featured-layers-scroll-vertical").show();
        $("#layers-list-featured").removeClass("shrink");
        $(".map-layer-div").hide();
        $(this).text("Show More");
      } else {
        $("#featured-layers-title, .featured-layers-scroll-vertical").hide();
        $("#layers-list-featured").addClass("shrink");
        $(".map-layer-div").show();
        $(this).html("Show Less");
      }
      resizeLayersMenu();
      $(this).toggleClass("active");
      lastLayerMenuScrollPos = 0;
    });

    $("#featured-layers").accordion({
      collapsible: true,
      active: false,
      animate: false,
      heightStyle: 'content',
      beforeActivate: function(event, ui) {
        var additionalHeight = 0;
        // The accordion believes a panel is being opened
        if (ui.newHeader[0]) {
          var currHeader  = ui.newHeader;
          var currContent = currHeader.next('.ui-accordion-content');
        // The accordion believes a panel is being closed
        } else {
          var currHeader  = ui.oldHeader;
          var currContent = currHeader.next('.ui-accordion-content');
        }

        // Since we've changed the default behavior, this detects the actual status
        var isPanelSelected = currHeader.attr('aria-selected') == 'true';

        // Toggle the panel's header
        currHeader.toggleClass('ui-corner-all',isPanelSelected).toggleClass('accordion-header-active ui-state-active ui-corner-top', !isPanelSelected).attr('aria-selected', ((!isPanelSelected).toString()));

        // Toggle the panel's icon
        currHeader.children('.ui-icon').toggleClass('ui-icon-triangle-1-e', isPanelSelected).toggleClass('ui-icon-triangle-1-s', !isPanelSelected);

        // Toggle the panel's content
        currContent.toggleClass('accordion-content-active', !isPanelSelected);
        if (isPanelSelected) {
          currContent.slideUp(0);
          additionalHeight = -1 * currContent.height();
        } else {
          currContent.slideDown(0);
          additionalHeight = currContent.height();
        }

        if ($("#featured-layers").height() + additionalHeight >= $("#layers-menu").height() / 2 && $("#show-more-layers").hasClass("active")) {
          $("#layers-list-featured, #layers-list").addClass("shrink");
        } else {
          $("#layers-list-featured, #layers-list").removeClass("shrink");
        }
        resizeLayersMenu();

        // Cancel the default action
        return false;
      }
    });
  }
  // Add vertical scroll to featured layers
  try {
    if (featuredTheme && UTIL.isTouchDevice()) {
      UTIL.verticalTouchScroll($(".featured-layers-scroll-vertical"));
    }
  } catch (e) {
    console.log('Error creating scroll events for featured layers UI: ', e);
  }
}

function hideAnnotationResumeExit() {
  $(".annotations-resume-exit-container").hide();
}

function hideAnnotations() {
  $(".current-location-text-container").hide();
  lastSelectedAnnotationBeforeHidden.removeClass("thumbnail_highlight");
}

function showAnnotations(fromResume=false) {
  $(".annotations-resume-exit-container").hide();
  $(".current-location-text-container").show();
  if (lastSelectedAnnotationBeforeHidden && fromResume) {
    lastSelectedAnnotationBeforeHidden.trigger("click", {fromKeyboard: true});
  }
}

function showAnnotationResumeExit() {
  if (lastSelectedAnnotationBeforeHidden) {
    lastSelectedAnnotationBeforeHidden.removeClass("thumbnail_highlight");
  }
  $(".current-location-text-container").hide();
  gEarthTime.timelapse.clearShareViewTimeLoop();
  if (disableAnnotations) return;
  if (!disableResumeExitAnnotationPrompt) {
    $(".annotations-resume-exit-container").show();
  }
  if (disableTopNav) {
    $(".annotations-button-separator, .annotations-exit-button").hide();
  }
  setExploreModeUrl();
}

//////////////////////////////////////////////////////////


// BEGIN WebGL vars
var gl;

var loadedWaypointsGSheet;
var loadedLayersGSheet;

var csvDataGrapher = new CsvDataGrapher(gEarthTime);
var dateRangePicker = new DateRangePicker(gEarthTime);
var altitudeSlider = new AltitudeSlider(gEarthTime);
var contentSearch = new ContentSearch();

var waitToLoadWaypointLayersOnPageReadyInterval;
var timelineUIChangeListeners = [];


function modifyWaypointSliderContent(keyframes, theme, story) {
  // TODO: Do we still want pictures within annotations?
  return;
  if (!annotationPicturePaths[theme]) {
    annotationPicturePaths[theme] = {};
  }
  annotationPicturePaths[theme][story] = {};
  for (var i = 0; i < keyframes.length; i++) {
    var keyframe = keyframes[i];
    // TODO: Force to only work with absolute image paths. One day we can figure out how to support paths from the internet without the wrath of trolls.
    var annotationPicturePath = keyframe.unsafe_string_annotationPicPath && keyframe.unsafe_string_annotationPicPath.indexOf("thumbnails/") == 0 ? keyframe.unsafe_string_annotationPicPath : undefined;
    annotationPicturePaths[theme][story][i] = { path : annotationPicturePath };
  }
}


function loadWaypointSliderContentFromCSV(csvdata) {
  var parsed = Papa.parse(csvdata, {delimiter: '\t', header: true, quoteChar:"\\"});
  var waypointdefs = parsed['data'];

  // Clear out internal data stores and relevant dom elements
  annotationPicturePaths = {};
  waypointJSONList = {};
  var story_count;
  var theme_html = "";
  $(".themes-div").empty();
  $("#timeMachine").removeClass("presentationSliderSelection");
  var currentWaypointSliderContentUrl;

  if (enableThemeHamburgerButton) {
    // May just be a single item if there is only only one or zero themes designated
    waypointJSONList = snaplapseForPresentationSlider.CSVToJSONList(waypointdefs);
    for (var themeId in waypointJSONList) {
      var themeTitle = waypointJSONList[themeId].themeTitle;
      var themeEnabled = isStaging || usingCustomWaypoints ? "true" : waypointJSONList[themeId].enabled;
      var stories = waypointJSONList[themeId].stories;
      var numStories = Object.keys(stories).length;
      // Handle legacy case where we treat theme as a story
      if (numStories == 1 && stories['default']) {
        theme_html += "<li data-enabled='" + themeEnabled + "' class='theme-selection-heading-no-accordion' id='story_" + themeId + "'>" + themeTitle + "</li>";
        continue;
      }
      story_count = 0;
      for (var storyId in stories) {
        if (story_count == 0) {
          theme_html += "<h3 data-enabled='" + themeEnabled + "'>" + themeTitle + "</h3>";
          theme_html += "<table data-enabled='" + themeEnabled + "' id=theme_" + themeId + ">";
          theme_html += "<tr id='theme_description'><td colspan='3'><p style='padding-right: 10px; text-transform: none !important;'>" + waypointJSONList[themeId].mainThemeDescription + "</p></td></tr>";
        }
        var storyTitle = stories[storyId].storyTitle;
        var storyEnabled = isStaging || usingCustomWaypoints ? "true" : stories[storyId].enabled;
        theme_html += "<tr data-enabled='" + storyEnabled + "' id='story_" + storyId + "'>";
        var thumbnailURL = gEarthTime.timelapse.getThumbnailOfView(stories[storyId].mainShareView, 128, 74, false) || "https://via.placeholder.com/128x74";
        theme_html += "<td width='50%'><div style='width: 128px; height: 74px; overflow:hidden; border: 1px solid #232323'><img src='" + thumbnailURL + "'/></div></td>";
        theme_html += "<td width='10%'><input type='radio'></td>";
        theme_html += "<td width='40%' style='word-break: break-word;padding-right: 10px;'>" + storyTitle + "</td>";
        theme_html += "</tr>";
        story_count++;
      }
      theme_html += "</table>";
    }
    $(".themes-div").append(theme_html);

    // TODO: Why do we loop through again and not do this above?
    for (var themeId in waypointJSONList) {
      var stories = waypointJSONList[themeId].stories
      for (var storyId in stories) {
        var waypointJSON = JSON.parse(stories[storyId].waypoints);
        modifyWaypointSliderContent(waypointJSON.snaplapse.keyframes, themeId, storyId);
        currentWaypointSliderContentUrl = snaplapseForPresentationSlider.getAsUrlString(waypointJSON.snaplapse.keyframes);
        // Handle legacy case where we treat theme as a story
        if (storyId == 'default') {
          storyId = themeId;
        }
        $("#theme-list #story_" + storyId).data("waypoint-url", currentWaypointSliderContentUrl);
      }
    }

    $(".themes-div").find('[data-enabled="false"]').addClass("force-hidden");
    $(".themes-div").accordion("refresh");

    var storyAndTheme = getStoryAndThemeFromUrl();
    var $selectedStoryElement;
    var themeLoaded = waypointJSONList[storyAndTheme.theme];
    var storyEqualsTheme = themeLoaded && waypointJSONList[storyAndTheme.theme].stories['default']
    var storyLoaded = themeLoaded && waypointJSONList[storyAndTheme.theme].stories[storyAndTheme.story];
    if (storyEqualsTheme) {
      $selectedStoryElement = $("#story_" + storyAndTheme.theme);
    } else if (storyLoaded) {
      $selectedStoryElement = $("#story_" + storyAndTheme.story);
    }

    if ($selectedStoryElement) {
      $selectedStoryElement.click();
    }
    $(".snaplapse_keyframe_container").prepend($("#presentation-slider-hamburger-wrapper"));
    $(".snaplapse_keyframe_list").addClass("has-hamburger");
    if (!isHyperwall && !isMobileDevice) {
      $("#presentation-slider-hamburger-wrapper .hamburger").height($(".snaplapse_keyframe_list").height() - 2);
      $("#presentation-slider-hamburger-wrapper #theme-title-container").height($(".snaplapse_keyframe_list").height());
    }
    $("#presentation-slider-hamburger-wrapper").show();
  } else {
    // Even older legacy case where we load only a single set of waypoints, no theme ever designated.
    // TODO: It is likely this has bitrotted.
    currentWaypointTheme = "default";
    currentWaypointStory = "default";
    var waypointJSON = JSON.parse(snaplapseForPresentationSlider.CSVToJSON(waypointdefs));
    modifyWaypointSliderContent(waypointJSON.snaplapse.keyframes, currentWaypointTheme, currentWaypointStory);
    currentWaypointSliderContentUrl = snaplapseForPresentationSlider.getAsUrlString(waypointJSON.snaplapse.keyframes);
    var waypointSliderContent = "#presentation=" + currentWaypointSliderContentUrl;
    gEarthTime.timelapse.loadSharedDataFromUnsafeURL(waypointSliderContent);
  }
  sortThemes();
  if (enableLetterboxMode) {
    updateLetterboxContent();
  }
  storiesInitialized = true;
}


function loadWaypoints(path:GSheet) {
  var waypointsUrl = path.url();
  if (loadedWaypointsGSheet && waypointsUrl == loadedWaypointsGSheet.url()) return;
  loadedWaypointsGSheet = path;

  // Keep track of spreadsheet path
  UTIL.addGoogleAnalyticEvent('javascript', 'load-waypoints', 'spreadsheet-path=' + path);

  // Legacy waypoint format (output of snaplapse editor)
  if (waypointCollection) {
    gEarthTime.timelapse.loadSharedDataFromUnsafeURL(waypointCollection);
    storiesInitialized = true;
  } else {
    UTIL.loadTsvData(waypointsUrl, loadWaypointSliderContentFromCSV, this);
  }
}


function populateLayerLibrary() {
  let layer_html = "";
  layer_html += '<div id="all-data-layers-title">All Data</div>';
  layer_html += '  <div class="layers-scroll-vertical">';
  layer_html += '    <div class="map-layer-div map-layer-checkbox">';

  let layersByCategory = {};
  for (let layer of gEarthTime.layerDB.orderedLayers) {
    // TODO: Legacy until we consolidate the base layer categories in the Default layer spreadsheet.
    if (layer.category == "Base Maps") {
      layer.category = "Base Layers";
    }
    if (!layersByCategory[layer.category]) {
      layersByCategory[layer.category] = [];
    }
    layersByCategory[layer.category].push({id: layer.id, name: layer.name, hasDescription: layer.hasLayerDescription});
  }
  let categories = Object.keys(layersByCategory);
  for (let category of categories) {
    let inputType = category == "Base Layers" ? "radio" : "checkbox";
    let categoryId = "category-" + category.trim().replace(/ /g,"-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase();
    let categoryLayers = layersByCategory[category];
    // Sort the layers alphabetically within a category
    categoryLayers = categoryLayers.sort(function(layer1:LayerProxy, layer2:LayerProxy) {
      if (layer1.name.toLowerCase() < layer2.name.toLowerCase()) {
        return -1;
      } else {
        // If layer is equal, technically return 0, but that should not happen so always return 1
        return 1;
      }
    });
    layer_html += `<h3>${category}</h3>`;
    layer_html += `<table id="${categoryId}">`;

    for (const layer of categoryLayers) {
      layer_html += `<tr><td><label name="${layer.id}"><input type="${inputType}" id="${layer.id}" name="${categoryId}">${layer.name}</label></td>`;
      // Add layer description buttons
      if (layer.hasDescription) {
        layer_html += `<td colspan='3'><div class='layer-description'></div></td>`;
      }
      layer_html += "</tr>";
    }
    layer_html += "</table>";
  }
  layer_html += '    </div>';
  layer_html += '  </div>';
  layer_html += '<div class="clearLayers"></div>';

  $("#layers-list").html(layer_html);

  // Turn layer categories into accordion selectables
  $(".map-layer-div, .themes-div").accordion({
    collapsible: true,
    active: false,
    animate: false,
    heightStyle: 'content',
    create: function() {
      if (enableLetterboxMode) {
        updateLetterboxContent();
      }
    },
    beforeActivate: function(event, ui) {
      if ($(this).hasClass('themes-div')) return;
      // The accordion believes a panel is being opened
      if (ui.newHeader[0]) {
          var currHeader  = ui.newHeader;
          var currContent = currHeader.next('.ui-accordion-content');
      // The accordion believes a panel is being closed
      } else {
          var currHeader  = ui.oldHeader;
          var currContent = currHeader.next('.ui-accordion-content');
      }
      // Since we've changed the default behavior, this detects the actual status
      var isPanelSelected = currHeader.attr('aria-selected') == 'true';

      // Toggle the panel's header
      currHeader.toggleClass('ui-corner-all',isPanelSelected).toggleClass('accordion-header-active ui-state-active ui-corner-top', !isPanelSelected).attr('aria-selected', ((!isPanelSelected).toString()));

      // Toggle the panel's icon
      currHeader.children('.ui-icon').toggleClass('ui-icon-triangle-1-e', isPanelSelected).toggleClass('ui-icon-triangle-1-s', !isPanelSelected);

      // Toggle the panel's content
      currContent.toggleClass('accordion-content-active', !isPanelSelected);
      if (isPanelSelected) {
        currContent.slideUp(0);
      } else {
        currContent.slideDown(0);
      }

      // Cancel the default action
      return false;
    }
  });

  sortLayerCategories();
}


// Run after timelapse.onTimeMachinePlayerReady
async function setupUIAndOldLayers() {
  if (!isBrowserSupported) {
    $("#baseLayerCreditContainer").hide();
  }

  // initialize the canvasLayer
  var timeMachineCanvasLayerOptions = {
    timelapse: gEarthTime.timelapse,
    resizeHandler: resize,
    animate: true,
    updateHandler: update,
    resolutionScale: window.devicePixelRatio || 1
  };
  gEarthTime.canvasLayer = new TimeMachineCanvasLayer(timeMachineCanvasLayerOptions);
  // Expose globally for thumbnail de-facto api
  (window as any).canvasLayer = gEarthTime.canvasLayer;

  // initialize WebGL
  // depth: true and stencil: true required for Mapbox
  gl = gEarthTime.canvasLayer.canvas.getContext('experimental-webgl',  {antialias: true, alpha: true, stencil: true, depth: true, failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: preserveDrawingBuffer});
  (window as any).gl = gl; // TODO(LayerDB): someday stop using this global

  gEarthTime.glb = new Glb(gl);
  (window as any).glb = gEarthTime.glb; // TODO(LayerDB): someday stop using this global

  // Legend content
  var legend_html = '<div id="layers-legend">';
  legend_html += '  <div id="legend-content">';
  legend_html += '    <table cellpadding=5>';
  legend_html += '    </table>';
  legend_html += '  </div>';
  legend_html += '</div>';
  $(legend_html).appendTo($("#timeMachine .player"));

  if (enableLetterboxMode) {
    $(".presentationSlider, .current-location-text-container, .annotations-resume-exit-container, .annotation-nav, .player, #csvChartContainer").addClass("letterbox");
  } else {
    $nextAnnotationLocationButton = $('.next-annotation-location');
    $nextAnnotationLocationButton.button({
      icons: {
        primary: "ui-icon-right-arrow"
      },
      text: false
    }).click(function() {
      $('.current-location-text').removeClass("allow-pointer-events");
      if ($(this).hasClass("annotation-story-end-button")) {
        $nextAnnotationLocationButton.button("disable");
        $(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight").removeClass("thumbnail_highlight");
        $('.current-location-text').children().empty().addClass("allow-pointer-events");
        $(".current-location-text-toggle").hide();
        $('.current-location-text-title').show().html('<div id="annotation-choose-another-story">Choose another story?</div><div id="annotation-start-story-over">Restart from the beginning?</div>')
      } else {
        var e = jQuery.Event("keydown");
        e.which = 33;
        e.keyCode = 33;
        $(document).trigger(e);
      }
    });

    $previousAnnotationLocationButton = $('.previous-annotation-location');
    $previousAnnotationLocationButton.button({
      icons: {
        primary: "ui-icon-left-arrow"
      },
      text: false
    }).click(function() {
      $('.current-location-text').removeClass("allow-pointer-events");
      var e = jQuery.Event("keydown");
      e.which = 34;
      e.keyCode = 34;
      $(document).trigger(e);
    });

    var $controlsContainer = $("<div id='controlsContainer' />");

    var $appControls = $("<div id='appControls' />");
    var $topNav = $("#top-nav ul");
    $appControls.appendTo($controlsContainer);

    if (showShareButton) {
      var $shareBtn = $("<li id='share-menu-choice' class='menu-option' title='Share a view'>Share</li>");
      $shareBtn.on("click", function() {
        $(".sharePicker").trigger("click");
        UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-show-share-panel');
      });
      $shareBtn.appendTo($topNav);
    }

    if (enableStoryEditor) {
      $("<li id='story-editor-menu-choice' class='menu-option' title='Story Editor'>Story Editor</li>").on("click", function() {
        storyEditor.toggle();
        UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-show-story-editor-panel');
      }).appendTo($topNav);
    }

    if (showSettingsButton) {
      var $settingBtn = $("<li id='settings-menu-choice' class='menu-option' title='Show settings'>Settings</li>");
      $settingBtn.on("click", function() {
        if (settingsDialog && settingsDialog.is(":visible")) {
          settingsDialog.dialog("close");
        } else {
          showSettingsDialog();
        }
      });
      $settingBtn.appendTo($topNav);
    }

    var $navigationControls = $("<div id='navControls' />");
    $navigationControls.appendTo($controlsContainer);

    if (showZoomControls && !isMobileDevice && !isHyperwall) {
      var $zoomControls = $($(".zoom > *").not(".zoomSlider, .zoomall")).addClass("controlButton");
      $zoomControls.appendTo($navigationControls);
    }

    $controlsContainer.appendTo($("#timeMachine .player"));

    if (showFullScreenButton) {
      $("#timeMachine .fullScreen").appendTo($navigationControls);
    }

    if (!showHomeLogo) {
      $("#menu-logo").remove();
    }

    if (!showStoriesButton) {
      $("#stories-menu-choice").remove();
    }

    if (!showLayersButton) {
      $("#layers-menu-choice").remove();
    }

    $appControls.css("top", ($navigationControls.height() + 20) + "px");

    // Hide any tables that have all their children
    // hidden (i.e. all layers of that topic are hidden)
    $("#layers-list").find('table').each(function() {
      if ($($(this)[0]).children().length == 0) {
        $(this).prev().hide();
      }
    });

    // Add clear active layer button
    var $clearLayersBtn = $(".clearLayers");
    $clearLayersBtn.button({
      icons: {
        primary: "clearLayersIcon"
      },
      // @ts-ignore
      showLabel: true,
      label: "Clear Active Layers",
      text: "Clear Active Layers"
    }).click(function() {
      var e = jQuery.Event("keydown");
      e.which = 67;
      e.keyCode = 67;
      $("body").trigger(e);
      UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-clear-active-layers');
    });
  }

  if (isHyperwall) {
    $("#layers-list, #layers-legend, .base-map-div, .customZoomhelp, #logosContainer").addClass("hyperwall");
  }

  // Layer Toggle UI
  initLayerToggleUI();

  // TODO: Why is this element of TimeMachine initially outside the controls container?
  $(".captureTime").prependTo(".controls");

  snaplapseForPresentationSlider = gEarthTime.timelapse.getSnaplapseForPresentationSlider();
  if (snaplapseForPresentationSlider) {
    snaplapseViewerForPresentationSlider = snaplapseForPresentationSlider.getSnaplapseViewer();
  }

  if (isMobileDevice) {
    $(".current-location-text-container").addClass("current-location-text-container-touchFriendly");
    $(".annotations-resume-exit-container").addClass("annotations-resume-exit-container-touchFriendly");
    $("#logosContainer").addClass("logosContainer-touchFriendly");
  }

  if (snaplapseViewerForPresentationSlider) {
    $('.presentationSlider').show();
    var $elements = $('#layers-legend, #theme-title-container, .current-location-text-container, .annotations-resume-exit-container, .presentationSlider, .customControl, .controls, .captureTime, .scaleBarContainer, .snaplapse_keyframe_container, .keyframeSubtitleBoxForHovering, .snaplapse_keyframe_list_item_presentation, .snaplapse_keyframe_list_item_thumbnail_overlay_presentation');
    if (isHyperwall)
      $elements.addClass('hyperwall');
    if (enableLetterboxMode)
      $elements.addClass('letterbox');

    snaplapseViewerForPresentationSlider.addEventListener('snaplapse-loaded', function() {
      $(".snaplapse_keyframe_container").scrollLeft(0);
      isAutoModeRunning = snaplapseViewerForPresentationSlider.isAutoModeRunning();
      //if (isAutoModeRunning) {
      //  var snaplapseForPresentationSlider = timelapse.getSnaplapseForPresentationSlider();
      //  snaplapseForPresentationSlider.getSnaplapseViewer().initializeAndRunAutoMode();
      //}
      if (isAutoModeRunning && enableMuseumMode) {
        handleStoryToggle(false);
      }
      var vals = UTIL.getUnsafeHashVars();
      var waypointId;
      if (vals.waypointIdx) {
        var potentialWaypoint = $(".snaplapse_keyframe_list").children().eq(vals.waypointIdx).children()[0];
        if (potentialWaypoint) {
          waypointId = potentialWaypoint.id;
        }
      } else {
        waypointId = $(".snaplapse_keyframe_list").children().first().children()[0].id;
      }
      $("#" + waypointId).trigger("click", {fromKeyboard: storyLoadedFromRealKeyDown});
      (document.activeElement as HTMLElement).blur();
    });

    snaplapseViewerForPresentationSlider.addEventListener('automode-start', function() {
      if (!currentWaypointStory) {
        var $availableStories = $("#theme-list [id^=story_]");
        $availableStories.first().click();
      }
      if (gEarthTime.timelapse.isPaused() && !gEarthTime.timelapse.isDoingLoopingDwell()) {
        gEarthTime.timelapse.handlePlayPause();
      }
    });

    snaplapseViewerForPresentationSlider.addEventListener('slide-before-changed', function(waypoint) {
      var waypointTitle = waypoint.title;
      var waypointIndex = waypoint.index;
      var waypointBounds = waypoint.bounds;

      clearInterval(waitToLoadWaypointLayersOnPageReadyInterval);

      // Temporarily set a max scale, based on what the waypoint's shareview asks for. Note that this may be overriden by the max zoom of a layer
      let maxWaypointScale = gEarthTime.timelapse.pixelBoundingBoxToPixelCenter(waypointBounds).scale;
      gEarthTime.timelapse.setMaxScale(maxWaypointScale);

      isAutoModeRunning = snaplapseViewerForPresentationSlider.isAutoModeRunning();
      if (waypointTitle) {
        lastSelectedAnnotationBeforeHidden = $("#" + waypointTitle.replace(/\W+/g, "_") + " .snaplapse_keyframe_list_item_thumbnail_overlay_presentation");
      }

      var unsafeHashVars = UTIL.getUnsafeHashVars();
      if (gEarthTime.mode == "explore" || (lastSelectedWaypointIndex != -1 && typeof(unsafeHashVars.waypointIdx) !== "undefined")) {
        setNewStoryAndThemeUrl(currentWaypointTheme, currentWaypointStory, -1);
      }

      if (enableThemeHamburgerButton && isAutoModeRunning && (autoModeCriteria.cycleThroughStoriesAndThemes || autoModeCriteria.cycleThroughStories) && lastSelectedWaypointIndex > waypointIndex) {
        var $availableStories = $("#theme-list [id^=story_]");
        var nextWaypointCollectionIdx;
        var availableStoriesArray = $availableStories.toArray();
        var $currentWaypointCollection;
        var $currentStory;
        for (var i = 0; i < availableStoriesArray.length; i++) {
          var $story = $(availableStoriesArray[i]);
          if ($story.hasClass("activeStory")) {
            $currentStory = $story;
            $currentWaypointCollection = $(availableStoriesArray[i]);
            nextWaypointCollectionIdx = i + 1;
            break;
          }
        }
        var $nextWaypointCollection = $($availableStories.get(nextWaypointCollectionIdx));
        // If no more stories are next (i.e. we are the last story of the last theme), then for now use the first story of the first theme.
        if ($nextWaypointCollection.length == 0) {
          $nextWaypointCollection = $availableStories.first();
        }
        if (autoModeCriteria.cycleThroughStories && !autoModeCriteria.cycleThroughStoriesAndThemes) {
          // If the theme contains only a single story, no need to trigger the story again. Just wrap back to the first waypoint,
          // which is the default behavior of auto mode. So, we just exit early here then.
          if ($currentStory.siblings("[id^=story_]").length == 0) {
            return;
          }
          // Find the theme of the current story and the theme of the next story.
          var $currentWaypointCollectionTheme = $currentWaypointCollection.parents("table").first();
          var $nextWaypointCollectionTheme = $nextWaypointCollection.parents("table").first();
          // If we are looping through stories of a theme and the theme of the next story does not match the
          // current theme, then we have hit the last story of the current theme and it is time to start over.
          if ($currentWaypointCollectionTheme[0].id != $nextWaypointCollectionTheme[0].id) {
            $nextWaypointCollection = $currentWaypointCollectionTheme.find("[id^=story_]").first();
          }
        }
        $nextWaypointCollection.trigger("click");
        if (enableLetterboxMode) {
          $("#letterbox-" + $nextWaypointCollection[0].id).prop("checked", true);
        }
      }

      lastSelectedWaypointIndex = waypointIndex;

      gEarthTime.timelapse.removeParabolicMotionStoppedListener(parabolicMotionStoppedListener);

      var waypointTimelineUIChangeListener = function(info) {
        clearTimelineUIChangeListeners();
        // If we are moving and reach this point, then this means the timeline UI changed before we made it to the final view.
        // The callback of timelapse.setNewView will handle setting the correct time for us, so no need to do anything.
        // However, if we reach this point and we are not moving, this means that the UI changed after the final view,
        // so we need to set the correct time.
        // If we are holding SHIFT or "pinning the butterfly" then use the previous time we came from and not the waypoint's time.
        if (keysDown.indexOf(16) >= 0 || gEarthTime.timelapse.getCurrentTouchCount()) {
          var seekTime = gEarthTime.timelapse.playbackTimeFromShareDate(info.captureTimeBeforeTimelineChange);
          gEarthTime.timelapse.seek(seekTime);
        } else if (!gEarthTime.timelapse.isMovingToWaypoint()) {
          var currentWaypoint = snaplapseForPresentationSlider.getKeyframes()[lastSelectedWaypointIndex];
          var seekTime = gEarthTime.timelapse.playbackTimeFromShareDate(currentWaypoint.beginTime);
          gEarthTime.timelapse.seek(seekTime);
        }

        let hashVars = UTIL.getUnsafeHashVars();
        let playbackRates = gEarthTime.playbackRates();
        var shareViewWithSpeedVal = typeof(hashVars.ps) != "undefined";
        var storyWaypointActive = $(".thumbnail_highlight").length;

        // If we have a sharelink that has a PS value, set the playback rate to properly make it relative to the new master ("max") rate.
        // If we don't have a sharelink that has a PS value, check if we are in a story and if we are, set the playback rate
        //   to the rate defined in the waypoint, relative to the max rate. And if we aren't in a story, set the playback rate defined
        //   for the layer that is currently controlling playback rates.

        if (shareViewWithSpeedVal && playbackRates.masterPlaybackRate != this.defaultMasterPlaybackRate) {
          let newPlaybackRate:number = (hashVars.ps / 100.0) * playbackRates.masterPlaybackRate;
          gEarthTime.timelapse.setPlaybackRate(newPlaybackRate, true);
        } else if (!shareViewWithSpeedVal) {
          if (storyWaypointActive) {
            let newPlaybackRate:number = gEarthTime.timelapse.getMaxPlaybackRate() * (waypoint.speed / 100.0);
            gEarthTime.timelapse.setPlaybackRate(newPlaybackRate, true);
          } else {
            gEarthTime.timelapse.setPlaybackRate(playbackRates.playbackRate, true);
          }
        }

        var waypointPlayPause = function() {
          if ($(".thumbnail_highlight").length == 0) return;

          var currentWaypointIdx = snaplapseForPresentationSlider.getSnaplapseViewer().getCurrentWaypointIndex();
          var currentWaypoint = snaplapseForPresentationSlider.getKeyframes()[currentWaypointIdx];
          var currentWaypointCenterView = gEarthTime.timelapse.pixelBoundingBoxToLatLngCenterView(currentWaypoint.bounds);
          var currentCenterView = gEarthTime.timelapse.pixelCenterToLatLngCenterView(gEarthTime.timelapse.getView());

          // We don't want to run this if the user has canceled moving to the waypoint, so check whether we are actually
          // at the waypoint location. Note that because of screen size, the zoom levels can differ, hency why the zoom
          // difference chosen here is larger than desired.
          if (Math.abs(currentWaypointCenterView.center.lat - currentCenterView.center.lat) > 0.001 ||
              Math.abs(currentWaypointCenterView.center.lng - currentCenterView.center.lng) > 0.001 ||
              Math.abs(currentWaypointCenterView.zoom - currentCenterView.zoom) > 0.5) {
            return;
          }

          if (gEarthTime.timelapse.getNumFrames() > 1 && gEarthTime.timelapse.getPlaybackRate() > 0) {
            if (gEarthTime.timelapse.isPaused() && !gEarthTime.timelapse.isDoingLoopingDwell()) {
              gEarthTime.timelapse.play();
            }
          } else {
            gEarthTime.timelapse.pause();
          }
        }

        // Technically each waypoint will trigger a callback from the timelapse library when it reaches its desired view
        // and will handle playback state at that point. However, layers may still be loading at this stage and we thus
        // need re-run these playback checks now that the timeline has changed.
        if (gEarthTime.timelapse.isMovingToWaypoint()) {
          var waypointPlayPauseCallback = function() {
            gEarthTime.timelapse.removeParabolicMotionStoppedListener(waypointPlayPauseCallback);
            waypointPlayPause();
          }
          gEarthTime.timelapse.addParabolicMotionStoppedListener(waypointPlayPauseCallback);
        } else {
          // Need a slight delay so that this is run after the default timelapse library callback
          setTimeout(waypointPlayPause, 30);
        }
      };
      clearTimelineUIChangeListeners();
      gEarthTime.timelapse.addTimelineUIChangeListener(waypointTimelineUIChangeListener);
      // In the event a sharelink layer does not have a timeline change, be sure the above listener is removed.
      var waypointTimelineUIChangeListenerWatchDog = setTimeout(function() {
        clearTimelineUIChangeListeners();
      }, 1000);
      timelineUIChangeListeners.push({"type" : "timeout", "fn" : waypointTimelineUIChangeListenerWatchDog});
      timelineUIChangeListeners.push({"type" : "uiChangeListener", "fn" : waypointTimelineUIChangeListener});
    });

    snaplapseViewerForPresentationSlider.addEventListener('slide-changed', function(waypoint) {
      var waypointIndex = waypoint.index;
      var waypointBounds = waypoint.bounds;
      var waypointLayers = waypoint.layers || [];

      var lastAvailableWaypointIdx = $(".snaplapse_keyframe_list").children().last().index();
      var selectedWaypointIdx = snaplapseViewerForPresentationSlider.getCurrentWaypointIndex();

      if ($previousAnnotationLocationButton && $previousAnnotationLocationButton.button("instance") && $nextAnnotationLocationButton && $nextAnnotationLocationButton.button("instance")) {
        $previousAnnotationLocationButton.button("enable").removeClass("annotation-story-start-button");
        $nextAnnotationLocationButton.button("enable").removeClass("annotation-story-end-button");
        if (selectedWaypointIdx == 0) {
          $previousAnnotationLocationButton.button("disable");
        } else if (selectedWaypointIdx == lastAvailableWaypointIdx) {
          $nextAnnotationLocationButton.addClass("annotation-story-end-button");
        }
      }

      // Don't zoom anywhere when an extra layer is to be shown
      // TODO: Note that if a non-extras layer begins with "extras_" then this logic incorrectly flags it.
      // The real answer is to test each layer to see if it is of type MediaLayer, but until the layer is loaded we don't know this.
      if (waypointLayers.some(layerId => /^extras_/.test(layerId))) {
        gEarthTime.timelapse.stopParabolicMotion();
      }

      // Show layer ids
      handleLayers(waypointLayers);

      // Display info box for the waypoints
      if (enableWaypointText) {
        var waypointScale = gEarthTime.timelapse.pixelBoundingBoxToPixelCenter(waypointBounds).scale;
        var $current_location_text = $(".current-location-text");
        var $current_location_text_container = $(".current-location-text-container");

        gEarthTime.timelapse.removeViewChangeListener(waypointViewChangeListener);
        gEarthTime.timelapse.removeViewChangeListener(hideWaypointListener);

        if (waypoint.annotationBoxTitle || waypoint.description) {
          showAnnotations();
          $(".snaplapse_keyframe_list .snaplapse_keyframe_list_item_thumbnail_overlay_presentation").eq(selectedWaypointIdx).addClass("thumbnail_highlight");
          if (waypoint.annotationBoxTitle) {
            $current_location_text.find(".current-location-text-title").show().text(waypoint.annotationBoxTitle);
          } else {
            $current_location_text.find(".current-location-text-title").empty().hide();
          }
          var $current_location_text_picture = $("#current-location-text-picture");
          if (Object.keys(annotationPicturePaths).length) {
            if (annotationPicturePaths[currentWaypointTheme] && annotationPicturePaths[currentWaypointTheme][currentWaypointStory] && annotationPicturePaths[currentWaypointTheme][currentWaypointStory][waypointIndex].path) {
              $current_location_text_picture.show();
              $current_location_text_picture.css('background-image', 'url("' + annotationPicturePaths[currentWaypointTheme][currentWaypointStory][waypointIndex].path + '")');
            } else {
              $current_location_text_picture.empty().hide();
            }
          }
          var $slideTextToggle = $(".current-location-text-toggle");
          if (waypoint.description) {
            var waypointBoxText = waypoint.description;
            var $current_location_text_p = $(".current-location-text p");
            if (Object.keys(waypointJSONList).length && selectedWaypointIdx == 0 && $previousAnnotationLocationButton && waypointJSONList[currentWaypointTheme]) {
              var story = waypointJSONList[currentWaypointTheme].stories[currentWaypointStory];
              if (story && story.storyDescription && story.storyAuthor) {
                var storyAuthorText = story.storyAuthor;
                if (storyAuthorText.trim().toLowerCase().indexOf("story ") != 0) {
                  storyAuthorText = "Story by: " + storyAuthorText;
                }
                waypointBoxText += "<div class='story-author-text'>" + storyAuthorText + "</div>";
                $current_location_text_p.css("text-align", "center");
              }
            }
            $current_location_text.find("p").show().html(waypointBoxText);
            $current_location_text_p .removeClass("force-hide text-overflow-ellipsis");
            if ($current_location_text.height() > 30) {
              $slideTextToggle.removeClass("maximize-icon").addClass("minimize-icon").show();
            } else {
              $slideTextToggle.hide();
            }
          } else {
            $current_location_text.find("p").empty().hide();
            $slideTextToggle.hide();
          }
        } else {
          // No waypoint title or description given; really should never happen since to be useful every waypoint should have accompanying text.
          $current_location_text_container.hide();
        }

        waypointViewChangeListener = function() {
          var currentView = gEarthTime.timelapse.getView();
          previousWaypoint.scale = waypointScale;
          previousWaypoint.bounds = waypointBounds;
          if (currentView.scale * 2.5 > waypointScale && (currentView.x >= waypointBounds.xmin && currentView.x <= waypointBounds.xmax && currentView.y >= waypointBounds.ymin && currentView.y <= waypointBounds.ymax)) {
            hideWaypointListener = function() {
              var currentView = gEarthTime.timelapse.getView();
              var previousWaypointBounds = previousWaypoint.bounds;
              if (((previousWaypoint.scale * 3.0 < currentView.scale && !gEarthTime.timelapse.isMovingToWaypoint()) || (previousWaypoint.scale / 2.5 > currentView.scale && !gEarthTime.timelapse.isMovingToWaypoint()) || !(currentView.x >= previousWaypointBounds.xmin && currentView.x <= previousWaypointBounds.xmax && currentView.y >= previousWaypointBounds.ymin && currentView.y <= previousWaypointBounds.ymax))) {
                if ($(".thumbnail_highlight").length || $(".current-location-text-container").is(":visible")) {
                  showAnnotationResumeExit();
                }
                gEarthTime.timelapse.removeViewChangeListener(hideWaypointListener);
                gEarthTime.timelapse.clearShareViewTimeLoop();
              }
            };
            gEarthTime.timelapse.addViewChangeListener(hideWaypointListener);
            gEarthTime.timelapse.removeViewChangeListener(waypointViewChangeListener);
          }
        };
        gEarthTime.timelapse.addViewChangeListener(waypointViewChangeListener);

        parabolicMotionStoppedListener = function() {
          gEarthTime.timelapse.removeParabolicMotionStoppedListener(parabolicMotionStoppedListener);
          gEarthTime.timelapse.removeViewChangeListener(waypointViewChangeListener);
          var waypointScale = gEarthTime.timelapse.pixelBoundingBoxToPixelCenter(waypointBounds).scale;
          var currentView = gEarthTime.timelapse.getView();
          if ((waypointScale / 2.5 > currentView.scale || !(currentView.x >= waypointBounds.xmin && currentView.x <= waypointBounds.xmax && currentView.y >= waypointBounds.ymin && currentView.y <= waypointBounds.ymax))) {
            showAnnotationResumeExit();
          }
        };
        gEarthTime.timelapse.addParabolicMotionStoppedListener(parabolicMotionStoppedListener);
      }
    });
    // End snaplapseViewerForPresentationSlider check
  }

  // Location search box, with autocomplete.
  if (showSearchBox) {
    var $locationSearchDiv = $('<div class="location_search_div"><span id="location_search_icon"></span><span id="location_search_clear_icon" class="clear-search-icon" title="Clear location search"></span><input id="location_search" type="text" placeholder="Search for a location...">');
    if (enableLetterboxMode) {
      $locationSearchDiv.addClass("top-panel letterbox").appendTo($("#letterbox-bottom-controls"));
      $(".location_search_div").addClass("letterbox");
    } else {
      if (disableTopNav) {
        $locationSearchDiv.appendTo("#viewerContainer");
      } else {
        $locationSearchDiv.appendTo("#top-nav");
      }
    }
  }

  $(".current-location-text-container, .annotations-resume-exit-container").appendTo($("#timeMachine .player"));

  // Note: Google's service gives much better results, but for locations where Google APIs cannot be used, we fallback to this.
  if (!useGoogleSearch) {
    var locationList = [];
    $("#location_search").autocomplete({
      minLength: 5,
      source: function(request, response) {
        locationList = [];
        //http://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1
        $.getJSON("https://photon.komoot.de/api/?limit=5", {
          q: request.term
        }, function(data, status, xhr) {
          response(data.features);
        });
      },
      select: function(event, ui) {
        var view;
        //if (ui.item.properties.extent) {
        //  view = {bbox: {"ne": {"lat": ui.item.properties.extent[1], "lng": ui.item.properties.extent[2]}, "sw": {"lat" : ui.item.properties.extent[3], "lng": ui.item.properties.extent[0]}}};
        //} else {
        view = {
          center: {
            "lat": ui.item.geometry.coordinates[1],
            "lng": ui.item.geometry.coordinates[0]
          },
          "zoom": 12
        };
        //}
        gEarthTime.timelapse.setNewView(view);
        if (ui.item.properties) {
          UTIL.addGoogleAnalyticEvent('textbox', 'search', 'go-to-searched-place=' + ui.item.properties.name + "," + ui.item.properties.country);
        }
      }
    }).on("keydown", function(e) {
      if (e.keyCode == 13) {
        $(e.target).trigger("focus");
        // TODO: jQuery seems to not have a unique identifier to this. So what happens if we have more than one autocomplete element on the page?
        $('.ui-autocomplete').find("li").first().trigger("click");
      }
      // @ts-ignore
    }).autocomplete("instance")._renderItem = function(ul, item) {
      var tmpLocationString = (item.properties.name || "") + ", " + (item.properties.state || "") + item.properties.country;
      if (item.properties.osm_value == "hamlet" || !item.properties.country || locationList.indexOf(tmpLocationString) >= 0) return $("<li>");
      locationList.push(tmpLocationString);
      return $("<li style='z-index:9999'>").append("<a>" + (item.properties.name || "") + ", " + (item.properties.state || "") + "<br>" + item.properties.country + "</a>").appendTo(ul);
    };
  } else {
    UTIL.loadGoogleAPIs(googleMapsLoadedCallback, gEarthTime.timelapse.getSettings().apiKeys);
  }

  // Set the letterbox mode
  if (enableLetterboxMode) {
    // Move the presentation slider out
    var $presentationSlider = $("#" + gEarthTime.timelapse.getTimeMachineDivId() + " .presentationSlider");
    $presentationSlider.prependTo("#letterbox-bottom");
    var $chartContainer = $("#csvChartContainer");
    $chartContainer.appendTo("#timeMachine");
    var $chartLegend = $("#csvChartLegend");
    $chartLegend.appendTo("#timeMachine");
    $(".hamburger").hide();
  }

  var hashChange = function() {
    var vals = UTIL.getUnsafeHashVars();
    console.log(`${Utils.logPrefix()} index: hashChange: ${vals}`);

    if (vals.csvlayers) {
      let csvlayersPath = vals.csvlayers ? docTabToGoogleSheetUrl(vals.csvlayers) : csvLayersContentPath;
      gEarthTime.setDatabaseID(GSheet.from_url(csvlayersPath));
    }

    if (vals.l) {
      var layers = vals.l.split(",");
      if (loadedInitialCsvLayers){
        dateRangePicker.handleCalendarLayers(true, layers);
        altitudeSlider.handleAltitudeLayers();
      }

      // Temporarily set a max scale, based on what the shareview asks for. Note that this may be overriden by the max zoom of a layer
      let view = gEarthTime.timelapse.pixelCenterToLatLngCenterView(gEarthTime.timelapse.normalizeView(gEarthTime.timelapse.unsafeViewToView(vals.v)));
      let maxShareViewScale = gEarthTime.timelapse.zoomToScale(view.zoom);
      gEarthTime.timelapse.setMaxScale(maxShareViewScale);

      // The time in a share link may correspond to a layer that has a different timeline than the default one.
      // Re-run corresponding sharelink code once the timeline has changed.
      // Note that this may be unncessary because of the callback for CSV layers, but it's possible not to have CSV layers
      // and CSV layers are async (and could be loaded very fast) so we keep this in.
      var onloadView = function() {
        clearTimelineUIChangeListeners();
        gEarthTime.timelapse.loadSharedViewFromUnsafeURL(UTIL.getUnsafeHashString());
      };
      clearTimelineUIChangeListeners();
      gEarthTime.timelapse.addTimelineUIChangeListener(onloadView);
      timelineUIChangeListeners.push({"type" : "uiChangeListener", "fn" : onloadView});

      // Turn on layers encoded in the share link
      handleLayers(layers);
    }

    if (gEarthTime.timelapse.isPresentationSliderEnabled() && showStories) {
      let waypointsPath = vals.waypoints ? docTabToGoogleSheetUrl(vals.waypoints) : waypointSliderContentPath;
      // If for some reason the waypoints cannot load, the controls need to be manually
      // pushed up by changing the player to where it would be had the waypoints loaded.
      $("#timeMachine .player").css("bottom", "93px");
      loadWaypoints(GSheet.from_url(waypointsPath));
    }
  };

  if (isOffline) {
    $(".map-layer-div").show();
    // Sort all the newly added layers
    sortLayerCategories();
  }

  csvDataGrapher.initialize();

  $(".current-location-text-toggle").on("click", function() {
    var $this = $(this);
    var $slideText = $(".current-location-text p");
    if ($this.hasClass("minimize-icon")) {
      $this.removeClass("minimize-icon").addClass("maximize-icon");
      if ($(".current-location-text-title").is(":visible")) {
        $slideText.addClass("force-hide");
      } else {
        $slideText.addClass("text-overflow-ellipsis");
      }
    } else {
      $this.removeClass("maximize-icon").addClass("minimize-icon");
      $slideText.removeClass("force-hide text-overflow-ellipsis");
    }
  });

  $("#location_search_clear_icon").on("click", function() {
      $("#location_search").val("");
      $(this).hide();
  });

  $("#logosContainer, #baseLayerCreditContainer").appendTo("#timeMachine .player");

  $("#theme-title-container").on("click", function() {
    $('#stories-menu-choice').click();
  });

  $("#menu-logo").on("click", function() {
    window.location.href = window.location.protocol + "//" + window.location.host + getUrlPathName();
  });

  toggleHamburgerPanel = function($panel) {
    if ($panel.is(":visible")) {
      // If selected panel is visible, hide hamburger
      $('#main-hamburger-menu').hide("slide", { direction: "left" }, 150);
      $('#main-hamburger-menu').removeClass("is-active");
      return false;
    }

    $('#main-hamburger-menu').show("slide", { direction: "left" }, 150);
    $('#main-hamburger-menu').addClass("is-active");
    $panel.show();
    $panel.siblings().hide();
    return true;
  }

  $("#stories-menu-choice").on("click", function() {
    if (toggleHamburgerPanel($('#theme-menu'))) {
      UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-show-story-panel');
    }

    var $activeStoryMenu = $("#theme-menu").find("h3").children(".ui-icon-bullet");
    if ($activeStoryMenu.length) {
      if (!$activeStoryMenu.closest("h3").hasClass("ui-accordion-header-active")) {
        $activeStoryMenu.click();
      }
    }
  });

  $("#viewerContainer, #top-nav-wrapper").on("click", "#layers-menu-choice", function() {
    if (toggleHamburgerPanel($('#layers-menu'))) {
      UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-show-layer-panel');
    }

    if ($("#show-more-layers").length && !$("#show-more-layers").hasClass("active")) {
      $(".map-layer-div, #all-data-layers-title").hide();
    }
    resizeLayersMenu();
    $("#layer-search-box").focus();

    var $scrollContainer = $("#layers-menu").find("ul > .layers-scroll-vertical, ul > .featured-layers-scroll-vertical");
    $scrollContainer.animate({
      scrollTop: lastLayerMenuScrollPos
    }, 250);
  });

  $("#theme-menu").on("click", "[id^=story_]", function(e) {
    // Note that a story can also be a theme (old way)
    var $selectedStoryElement = $(e.currentTarget);
    storyLoadedFromRealKeyDown = e.originalEvent && e.pageX != 0 && e.pageY != 0;

    var isAutoModeRunning = snaplapseViewerForPresentationSlider.isAutoModeRunning();

    // If what's clicked is already loaded, don't load again and go to the first waypoint
    if ($('#theme-title').attr('data-theme-id') == $selectedStoryElement[0].id) {
      if (isAutoModeRunning) {
        snaplapseViewerForPresentationSlider.initializeAndRunAutoMode();
      } else {
        $(".snaplapse_keyframe_list").children().eq(0).children().first().trigger("click", {fromKeyboard: storyLoadedFromRealKeyDown});
      }
      return;
    }

    // Uncheck any selected stories
    $("#theme-menu").find("input").prop("checked", false);
    // Add selection indicator to currently selected story
    $selectedStoryElement.find("input").prop("checked", true);
    // Remove active class from all stories
    $("#theme-menu .activeStory").removeClass('activeStory');
    // Add active class to currently selected story
    $selectedStoryElement.addClass('activeStory');

    $("#theme-menu .active-story-in-theme").remove();
    var $storyGroup = $selectedStoryElement.parents("table");
    var $themeHeading;

    var selectedWaypointTheme;

    if ($storyGroup.length == 0) {
      // Old way where theme = story
      $themeHeading = $selectedStoryElement;
      selectedWaypointTheme = $selectedStoryElement.attr("id").replace("story_","");
      currentWaypointStory = "default";
    } else {
      $themeHeading = $storyGroup.prev();
      selectedWaypointTheme = $storyGroup.attr("id").replace("theme_","");
      currentWaypointStory = $selectedStoryElement.attr("id").replace("story_","");
    }

    if (currentWaypointTheme != selectedWaypointTheme) {
      currentWaypointTheme = selectedWaypointTheme;
      featuredTheme = capitalize_each_word_in_string(currentWaypointTheme.replace(/_/g, " "));
      //if (!isOffline) {
      //  createFeaturedLayersSection();
      //}
    }

    $themeHeading.append("<span class='ui-icon ui-icon-bullet active-story-in-theme' style='float:right;'>");

    if (!enableMuseumMode) {
      setNewStoryAndThemeUrl(currentWaypointTheme, currentWaypointStory);
    }

    $("#theme-title").attr("data-theme-id", $selectedStoryElement[0].id).text($selectedStoryElement.text());
    var waypointSliderContent = "#presentation=" + $selectedStoryElement.data("waypoint-url");
    gEarthTime.timelapse.loadSharedDataFromUnsafeURL(waypointSliderContent);
    UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-select-theme=' + currentWaypointTheme);
    UTIL.addGoogleAnalyticEvent('button', 'click', 'viewer-select-story=' + currentWaypointStory);
    if ($('#main-hamburger-menu').hasClass("is-active")) {
      $("#stories-menu-choice").click();
    }
    handleStoryToggle(!hidePresentationSlider);
  });

  $("body").on("click", "#annotation-choose-another-story", function() {
    if (!$("#theme-menu").is(":visible")) {
      $('#stories-menu-choice').trigger("click");
    }
  });

  $("body").on("click", "#annotation-start-story-over", function() {
    var e = jQuery.Event("keydown");
    e.which = 33;
    e.keyCode = 33;
    $(document).trigger(e);
  });

  $("body").on("click", function(e) {
    if (!e.originalEvent && !e.detail) return;
    var ignoreElemIds = ["stories-menu-choice", "layers-menu-choice", "main-hamburger-menu", "theme-title-container", "annotation-choose-another-story"];
    var $ignoredElms = $(e.target).closest("#stories-menu-choice, #layers-menu-choice, #main-hamburger-menu, #theme-title-container, #annotation-choose-another-story");
    if (ignoreElemIds.indexOf($ignoredElms.attr("id")) != -1 || !$('#main-hamburger-menu').hasClass("is-active") || $(e.target).closest("div").hasClass("ui-tooltip-content")) return;
    $('#main-hamburger-menu').toggle("slide", { direction: "left" }, 150);
    $("#top-nav").toggleClass("menu-active");
    $('#main-hamburger-menu').toggleClass("is-active");
  });

  // Special case when we are running locally, which means we probably are running from a dedicated EarthTime installion or local drive for a presentation.
  if (gEarthTime.rootTilePath.indexOf("../") == 0) {
    $("#productLogo").html("EarthTime.org");
    $("#contributors").html("Carnegie Mellon University | CREATE Lab");
  }

  if ((extraContributors || extraContributorsLogoPath) && extraContributorTakesPrecedence) {
    var $labAndCMULogoDiv = $("<div id='labAndCMULogo'></div>");
    var $contributors = $("#contributors");
    var $logosContainer = $("#logosContainer");
    $logosContainer.append($labAndCMULogoDiv)
    $labAndCMULogoDiv.html($contributors.html());
    $contributors.html("").addClass("heading");
    $logosContainer.prepend($("<div id='poweredBy'>Powered by</div>"));
    $logosContainer.prepend($contributors);
  }

  if (extraContributorsLogoPath) {
    $("<div><img id='contributorsLogo'></div>").appendTo($("#contributors"));
    $("#contributorsLogo").prop("src", extraContributorsLogoPath);
  } else if (extraContributors) {
    if (extraContributors == "Igarape Institute") {
      var idx = extraContributors.indexOf('e');
      extraContributors = extraContributors.substr(0, idx) + '&eacute;' + extraContributors.substr(idx + 1);
      $("#productLogo").css("font-size", "30px");
      $("#contributors").css("font-size", "20px");
      $(".current-location-text p").css({"font-size" : "20px", "line-height" : "22px"});
      $(".current-location-text-title").css("font-size", "24px");
    }
    var separator = extraContributorTakesPrecedence ? "" : " | ";
    $("#contributors").html($("#contributors").html() + separator + extraContributors);
  }

  $("#datepicker-ui").appendTo($("#timeMachine .player"));

  if (minimalUI) {
    // Move capture time outside of the timeline controls
    $(".captureTime").insertBefore(".controls");
    $(".captureTime, .scaleBarContainer, #logosContainer, #baseLayerCreditContainer").addClass("minimalUIMode");
    // Move annotation to top left
    $(".current-location-text-container, .annotation-nav, .annotations-resume-exit-container").addClass("letterbox");
    // Remove top nav, side control panel, search box, and timelines
    $("#controlsContainer, .location_search_div, .customControl, .controls").remove();
    disableTopNav = true;
    // Hide presentation slider so that it's still usable via keyboard/clicker but not shown on screen
    handleStoryToggle(false);
  } else if (timestampOnlyUI || timestampOnlyUILeft || timestampOnlyUICentered) {
    // Move capture time outside of the timeline controls
    $(".captureTime").insertBefore(".controls");
    $(".captureTime, .scaleBarContainer, #logosContainer, #baseLayerCreditContainer").addClass("minimalUIMode");
    // Remove top-nav, side control panel, search box, timelines, scalebar, logos and legend (if not being forced on)
    $("#controlsContainer, .location_search_div, .customControl, .controls, .scaleBarContainer, #baseLayerCreditContainer, #logosContainer").remove();
    if (!forceLegend) {
      $("#layers-legend").remove();
    }
    disableTopNav = true;
    if (timestampOnlyUICentered) {
      $(".captureTime").addClass("centered");
    }
  }

  if (!showCredits) {
    $("#logosContainer").remove();
  }

  if (disableUI) {
    // Remove top nav, side control panel, search box, timelines, scalebar, logos and legend (if not being forced on)
    $("#controlsContainer, .location_search_div, .customControl, .controls, .scaleBarContainer, .captureTime, #baseLayerCreditContainer, #logosContainer, #altitude-slider").remove();
    if (!forceLegend) {
      $("#layers-legend").remove();
    }
    $("#datepicker-ui").hide();
    disableTopNav = true;
    disableAnnotations = true;
  }

  if (centerLegend) {
    $("#layers-legend").addClass("centered");
  }

  $(".annotations-resume-button").on("click", function() {
    showAnnotations(true);
  });

  $(".annotations-exit-button").on("click", function() {
    hideAnnotationResumeExit();
    $("#theme-menu").find("input").prop("checked", false);
    $("#theme-menu .activeStory").removeClass('activeStory');
    $("#theme-menu .active-story-in-theme").remove();
    handleStoryToggle(false);
    removeFeaturedTheme();
    $('#theme-title').attr('data-theme-id', '');
  });

  if (enableLetterboxMode) {
    $("#letterbox-list-themes-button").on("click", function() {
      updateLetterboxContent("themes");
    });
    $("#letterbox-list-layers-button").on("click", function() {
      updateLetterboxContent("layers");
    });
    $("#letterbox-clear-layers-button").on("click", function() {
      var e = jQuery.Event("keydown");
      e.which = 67;
      e.keyCode = 67;
      $("body").trigger(e);
    });
    updateLetterboxSelections();
  }

  if (disableTopNav) {
    $("#top-nav").remove();
    $("#viewerContainer, .location_search_div").addClass("topNavDisabled");
  }

  if (disableAnnotations) {
    var selectorsToRemove = [".annotation-nav", ".annotations-resume-exit-container"];
    if (!enableMuseumMode) {
      selectorsToRemove.push(".current-location-text-container");
    }
    $(selectorsToRemove.join(",")).remove();
  }

  handleStoryToggle(initiallyShowPresentationSlider);

  // Workaround for issue that came with Chrome 65. Rot in hell browsers.
  // Force redraw of the sticky positioned menus in bottom left.
  $(".snaplapse_keyframe_container").scroll(function() {
    $("#presentation-slider-hamburger-wrapper").hide().show(0);
  });

  $(".layers-scroll-vertical").scroll(function() {
    if ($(".ui-tooltip").length && $activeLayerDescriptionTooltip) {
      $activeLayerDescriptionTooltip.tooltip("disable");
      $activeLayerDescriptionTooltip = null;
      return;
    }
  });

  $("#layers-menu").on("mouseenter", ".layer-description", function (e) {
      e.stopImmediatePropagation();
  });

  // @ts-ignore
  $.ui.position.custom = {
    left: function(position, data) {
      // @ts-ignore
      $.ui.position.flip.left(position, data);
    },
    top: function(position, data) {
      var initPos = position.top;
      // @ts-ignore
      $.ui.position.flip.top(position, data);
      if (initPos != position.top) {
        $(".ui-tooltip-content").addClass('flip-bottom');
      } else {
        $(".ui-tooltip-content").removeClass('flip-bottom');
      }
    }
  };

  $("#layers-menu").on("click", ".layer-description", async function (e) {
    let layerDescription = $(this).data("layer-description");
    if (!layerDescription) {
      let layerId = $(e.target).parent().prev().find("label").attr("name");
      layerDescription = (await gEarthTime.layerDB.getLayerDescription(layerId))["Layer Description"];
      $(this).data("layer-description", layerDescription);
    }

    if ($(".ui-tooltip").length) {
      $activeLayerDescriptionTooltip.tooltip("disable");
      $activeLayerDescriptionTooltip = null;
      return;
    }

    $activeLayerDescriptionTooltip = $(this);
    $(this).tooltip({
      items: $(this),
      position: { my: 'left top', at: 'right+15 top-18', collision: "custom" },
      tooltipClass: "right",
      content: md.render(layerDescription)
    });
    $(this).tooltip("open");
    $(this).off("mouseleave");
  });

  if (enableMuseumMode) {
    EarthlapseUI.init();
  }

  initialTopNavWrapperElm = {};
  initialTopNavWrapperElm.outerWidth = $("#top-nav-wrapper").outerWidth();

  // Initialize the story editor
  if (enableStoryEditor) {
    var $viewerContainer = $("#viewerContainer");
    var $sidePanel = $("#sidePanel");
    var $topNav = $("#top-nav");
    storyEditor = new StoryEditor(gEarthTime.timelapse, {
      container_id: "sidePanel",
      on_hide_callback: function () {
        $viewerContainer.css("right", "0");
        $topNav.css("right", "0");
        $sidePanel.hide();
        gEarthTime.timelapse.onresize();
      },
      on_show_callback: function () {
        $viewerContainer.css("right", "341px");
        $topNav.css("right", "341px");
        $sidePanel.show();
        gEarthTime.timelapse.onresize();
      }
    });
  }

  $mapboxLogoContainer = $("#mapboxLogoContainer");

  // Keep this last

  // Note that hash change events are run in reverse order of them being added when handled
  // by the Timelapse library. This is desirable here because we want EarthTime's hashchange event
  // to run before the view handling done by Timelapse.
  gEarthTime.timelapse.addHashChangeListener(hashChange);
  $(window).trigger("hashchange");

  timeMachinePlayerInitialized = true;

  // End of onTimeMachinePlayerReady
}

var sortLayerCategories = function() {
  var $layerAccordions = $(".map-layer-div, #featured-layers");
  $layerAccordions.each(function(i, layerAccordion) {
    var $layerAccordion = $(layerAccordion);
    var entries = $.map($layerAccordion.children("h3").get(), function(entry) {
      var $entry = $(entry);
      return $entry.add($entry.next());
    });

    entries.sort(function(a, b) {
      return a.filter("h3").text().localeCompare(b.filter("h3").text());
    });

    $.each(entries, function() {
      // Ensure 'Base Layers' is always the first entry
      if (this.filter("h3").text() == "Base Layers") {
        this.detach().prependTo($layerAccordion);
      } else {
        this.detach().appendTo($layerAccordion);
      }
    });
  });
}

var sortThemes = function() {
  // TODO: Do we ever want users to actually set an order in the spreadsheet as opposed to force sorting here?

  var $themeList = $(".themes-div");
  var $themes = $themeList.children("li");

  // Theme is the same as a story
  if ($themes.length) {
    // @ts-ignore
    $themes.sort(function(a, b) {
      return $(a).text().localeCompare($(b).text());
    });

    $.each($themes, function() {
      $(this).detach().appendTo($themeList);
    });

  } else { // Stories fall under a theme
    var entries = $.map($themeList.children("h3").get(), function(entry) {
      var $entry = $(entry);
      return $entry.add($entry.next());
    });

    entries.sort(function(a, b) {
      return a.filter("h3").text().localeCompare(b.filter("h3").text());
    });

    $.each(entries, function() {
      this.detach().appendTo($themeList);
    });
  }
}

var updateLetterboxContent = function(newSectionChoice=null) {
  var sectionChoice = newSectionChoice || "themes";
  var numRows = 3;

  $("#letterbox-control-buttons .letterbox-list-button-highlight").removeClass("letterbox-list-button-highlight");
  if (sectionChoice == "themes") {
    $("#letterbox-list-themes-button").addClass("letterbox-list-button-highlight");
  } else if (sectionChoice == "layers") {
    $("#letterbox-list-layers-button").addClass("letterbox-list-button-highlight");
  }

  // Create letterbox base layers table
  if (!$(".letterbox-base-layers-table").length) {
    var baseLayers = $("#category-base-layers").find("td").map(function() {
      return $(this);
    }).get();

    var baselayerRowHeight = Math.floor(100 / baseLayers.length);

    var html = "<table class='letterbox-base-layers-table'><caption>Base Layers:</caption>";

    for (var i = 0; i < baseLayers.length; i++) {
      var inputId = $(baseLayers[i]).find("input")[0].id;
      var textName = baseLayers[i].text();

      if (textName.indexOf("Earth Engine") >= 0) {
        textName = "Timelapse";
      }

      html += "<tr height='" + baselayerRowHeight + "%'><td><div><label class='pointer' for='letterbox-" + inputId + "'><input type='radio' class='pointer' id='letterbox-" + inputId + "' data-base-layer-id='" + inputId + "' name='letterbox-base-layers'/>" + textName + "</label></div></td></tr>"
    }
    html += "</table>";

    $("#letterbox-base-layers").children().remove();
    $("#letterbox-base-layers").html(html);

    // Handle letterbox base layer selection
    $('.letterbox-base-layers-table').on("click", "td", function(e) {
      // Clicking a span will cause this to run twice, so we ignore element a user did not physically click
      if (!e.detail) return;
      var $input = $(this).find("input");
      // Special case since this is a radio button
      $input.prop("checked", true);
      $("#" + $input.data("base-layer-id")).trigger("click");
    });
  }

  if (sectionChoice == "themes") {
    // Create letterbox theme table

    // First do legacy handling where theme was a story
    var layerThemes = $(".themes-div").find("li").map(function() {
      return $(this);
    }).get();

    // Now handle stories that fall under a theme
    var themes = $(".themes-div").find("table[id^='theme'][data-enabled='true']");
    themes.each(function() {
      var $stories = $(this).find("tr[id^='story'][data-enabled='true']");
      $stories.each(function() {
        var $story = $(this).clone();
        $story.text($(this).parents().prev(".ui-accordion-header").text() + " - " + $(this).text());
        // @ts-ignore
        layerThemes.push($story);
      });
    });

    var numThemesPerRow = Math.ceil(layerThemes.length / numRows);

    var html = "<table class='letterbox-bottom-picker-table'><tr><th>Themes:</th></tr><tr height='33%'>";

    var k = 0;
    var j = 0;
    var doSwap = false;
    for (var i = 0; i < layerThemes.length; i++) {
      if ((i % numThemesPerRow == 0) && i > 0) {
        html += "</tr><tr height='33%'>";
        j = 0;
        k += 1;
      }
      var idx = (j*numRows + k);
      if (idx >= layerThemes.length) {
        idx -= (k + 1)
        doSwap = true;
      }
      var themeId = layerThemes[idx][0].id;
      var theme = layerThemes[idx].text();
      html += "<td><label class='pointer' for='letterbox-" + themeId + "'><input type='radio' class='pointer' id='letterbox-" + themeId + "' data-theme-id='" + themeId + "' name='letterbox-layer-theme'/>" + theme + "</label></td>"
      j++;
    }
    html += "</tr></table>";

    $("#letterbox-bottom-picker-results-content").children().remove();
    $("#letterbox-bottom-picker-content").children().remove();
    $("#letterbox-bottom-picker-content").html(html);

    if (doSwap) {
      var lastColumns = $('.letterbox-bottom-picker-table tr > td:last-child');
      var tmp = $(lastColumns[0]).html();
      $(lastColumns[0]).html($(lastColumns[1]).html());
      $(lastColumns[1]).html(tmp);
    }

    // Handle letterbox theme selection
    $('.letterbox-bottom-picker-table').on("click", "td", function(e) {
      // Clicking a span will cause this to run twice, so we ignore element a user did not physically click
      if (!e.detail) return;
      var $input = $(this).find("input");
      // Special case since this is a radio button
      $input.prop("checked", true);
      $("#" + $input.data("theme-id")).trigger("click");
    });

    $("#letterbox-bottom-picker-content").find("input#letterbox-" + $("#theme-title").attr("data-theme-id")).prop("checked", true);

  } else if (sectionChoice == "layers") {
    // Create letterbox layer categories table, sorted alphabetically top down, left to right
    var layerCategories = $("#layers-list").find("h3").map(function() {
      if ($(this).text() != "Base Layers") {
        return $(this);
      }
    }).get();

    var numCategoriesPerRow = Math.ceil(layerCategories.length / numRows);

    var html = "<table class='letterbox-bottom-picker-table'><tr><th colspan='2'>Layer Categories:</th></tr><tr height='33%'>";
    var k = 0;
    var j = 0;
    var doSwap = false;
    for (var i = 0; i < layerCategories.length; i++) {
      if ((i % numCategoriesPerRow == 0) && i > 0) {
        html += "</tr><tr height='33%'>";
        j = 0;
        k += 1;
      }
      var idx = (j*numRows + k);
      if (idx >= layerCategories.length) {
        idx -= (k + 1)
        doSwap = true;
      }
      var categoryId = layerCategories[idx][0].id;
      var category = layerCategories[idx].text();
      html += "<td><label class='pointer' for='letterbox-" + categoryId + "'><input type='radio' class='pointer' id='letterbox-" + categoryId + "' data-category-id='" + categoryId + "' name='letterbox-layer-categories'/>" + category + "</label></td>"
      j++;
    }
    html += "</tr></table>";

    $("#letterbox-bottom-picker-content").children().remove();
    $("#letterbox-bottom-picker-content").html(html);

    if (doSwap) {
      var lastColumns = $('.letterbox-bottom-picker-table tr > td:last-child');
      var tmp = $(lastColumns[0]).html();
      $(lastColumns[0]).html($(lastColumns[1]).html());
      $(lastColumns[1]).html(tmp);
    }

    // Handle letterbox layer category selection
    $('.letterbox-bottom-picker-table').on("click", "td", function(e) {
      // Clicking a span will cause this to run twice, so we ignore element a user did not physically click
      if (!e.detail) return;

      var $input = $(this).find("input");
      // Special case since this is a radio button
      $input.prop("checked", true);

      // Create letterbox layers table
      var categoryLayers = $("#" + $input.data("category-id")).next().find("td").not(".loading-layer-spinner-small");
      var numLayersPerRow = Math.ceil(categoryLayers.length / numRows);

      var html = "<table class='letterbox-bottom-picker-results-table'><tr style='height: 1%'><th>" + $(this).text() + " Layers:</th></tr><tr height='33%'>";

      for (var i = 0; i < categoryLayers.length; i++) {
        if ((i % numLayersPerRow == 0) && i > 0) {
          html += "</tr><tr height='33%'>";
        }

        var labelName = $(categoryLayers[i]).find("label").attr('name');
        // Ignore the layer info bubble element (or any other non-layer toggle label element)
        if (!labelName) continue;
        var inputId = $(categoryLayers[i]).find("input")[0].id;

        html += "<td><label class='pointer' name='letterbox-" + labelName + "'><input type='checkbox' class='pointer' id='letterbox-" + inputId + "' data-layer-id='" + inputId + "'/>" + $(categoryLayers[i]).text() + "</label></td>";

      }
      html += "</tr></table>";

      $("#letterbox-bottom-picker-results-content").children().remove();
      $("#letterbox-bottom-picker-results-content").html(html);

      // Handle letterbox specific layer selection
      $(".letterbox-bottom-picker-results-table").on("click", "td", function(e) {
        if (e.toElement.tagName.toLowerCase() == "label") return;
        var $input = $(this).find("input");
        $("#" + $input.data("layer-id")).trigger("click");
      });

      updateLetterboxSelections();
    });
  }
}

var updateLetterboxSelections = function(elemClicked?) {
  var $letterboxContainers = $("#letterbox-base-layers, #letterbox-bottom-picker-results-content");
  if (elemClicked) {
    $letterboxContainers.find("input#letterbox-" + elemClicked[0].id).prop("checked", elemClicked.prop("checked"));
  } else {
    $letterboxContainers.find("input:checked").prop("checked", false);
    var activeLayers = $(".map-layer-div").find("input:checked").map(function() {
      return $(this);
    }).get();
    for (var i = 0; i < activeLayers.length; i++) {
      var activeSelection = $letterboxContainers.find("input#letterbox-" + activeLayers[i][0].id);
      activeSelection.prop("checked", true);
    }
  }
}


// CSV Data Grapher
var showHideCsvGrapher = function(doShow) {
  if (doShow) {
    $("#csvChartLegend").show();
    $("#csvChartContainer").show();
    $("#timeMachine").addClass("layerGraphs");
  } else {
    $("#csvChartLegend").hide();
    $("#csvChartContainer").hide();
    $("#timeMachine").removeClass("layerGraphs");
    csvDataGrapher.activeLayer.id = null;
  }
  resize();
};

// TODO: replace this with GSheet class
function docTabToGoogleSheetUrl(doctab) {
  var docId = doctab.split('.')[0];
  var ret = 'https://docs.google.com/spreadsheets/d/' + docId + '/edit';
  var tabId = doctab.split('.')[1];
  if (tabId) ret += '#gid=' + tabId;
  return ret;
}

function googleSheetUrlToDocTab(url) {
  var match = /spreadsheets\/d\/(.*?)\/(.*?[#&]gid=(\d+))?/.exec(url);
  if (!match || match[1].length < 20) return null;
  var ret = match[1];
  if (match[3]) ret += '.' + match[3];
  return ret;
}

var spreadsheetUrlDialog;
function askForSpreadsheetUrl(type, callback) {
  if (!spreadsheetUrlDialog) {
    spreadsheetUrlDialog = $('<div style="line-height: 200%"></div>').appendTo($('body'));
  }
  var d = spreadsheetUrlDialog;
  d.html('Paste new Google Spreadsheet tab URL for ' + type + '.<br>' +
          '<input type="text" size=90 id="spreadsheet-path"><br>' +
          '<i>If your spreadsheet has more than one tab, be sure to select the correct tab ' +
          'before copying its URL, as each tab has a different URL.</i><br>' +
          '<label style="cursor: pointer"><input type="checkbox" id="make-spreadsheet-default" value="' + type + '" style="cursor: pointer;">Make this the default spreadsheet loaded from now on?</label><br>');

  d.dialog({
    minWidth: 800,
    title: "Change " + type,
    buttons: {
      Ok: function() {
        var url = d.find('#spreadsheet-path').val();
        if (typeof(Storage) !== "undefined") {
          var $makeDefaultElem = d.find('#make-spreadsheet-default');
          var makeDefault = $makeDefaultElem.is(':checked');
          if (makeDefault) {
            if (type == "waypoints") {
              localStorage.waypointSliderContentPath = url;
            } else if (type == "csv layers") {
              localStorage.csvLayersContentPath = url;
            }
          }
        }
        if (googleSheetUrlToDocTab(url)) {
          $(this).dialog("close");
          callback(url);
        } else {
          alert('URL entered is not a valid Google Spreadsheet link.');
        }
      },
      Cancel: function() { $(this).dialog("close"); }
    }
  });
}

interface StoryAndTheme {
  theme?: string,
  story?: string
}

function getStoryAndThemeFromUrl(): StoryAndTheme {
  var returnVals: StoryAndTheme = {};
  var currentUrl = window.location.href;
  var hashVars = UTIL.getUnsafeHashVars();
  // legacy support
  if (hashVars.theme) {
    returnVals.theme = hashVars.theme.toLowerCase();
  }
  if (hashVars.story) {
    returnVals.story = hashVars.story.toLowerCase();
  }
  // new format
  if (!returnVals.story) {
    var matchResult = currentUrl.match(/stories\/(\w*)\/?/);
    if (matchResult) {
      returnVals.story = matchResult[1].toLowerCase();
    }
  }
  if (!returnVals.theme) {
    var matchResult = currentUrl.match(/themes\/(\w*)\/?/);
    // Pull theme from URL or pull from internally tracked theme
    if (!matchResult) {
      var availableThemes = Object.keys(waypointJSONList);
      for (var i = 0; i < availableThemes.length; i++) {
        if (waypointJSONList[availableThemes[i]].stories[returnVals.story]) {
          currentWaypointTheme = availableThemes[i];
          break;
        }
      }
    }
    returnVals.theme = matchResult ? matchResult[1].toLowerCase() : currentWaypointTheme;
  }
  return returnVals;
}

function getUrlPathName() {
  var pathName = location.pathname;
  pathName = pathName.replace("/explore","");
  var indexOfStoryTheme = pathName.indexOf("/stories");
  if (indexOfStoryTheme != -1) {
    pathName = pathName.substring(0, indexOfStoryTheme);
  }
  if (pathName == "") {
    pathName = "/";
  }
  return pathName;
}

function setNewStoryAndThemeUrl(newTheme, newStory, newWaypointIndex=undefined) {
  var unsafeHashVars = UTIL.getUnsafeHashVars();
  var hashParamsToInclude;
  var replaceStateUrl;

  if (newWaypointIndex == -1) {
    unsafeHashVars.waypointIdx = "";
  } else if (newWaypointIndex >= 0) {
    unsafeHashVars.waypointIdx = newWaypointIndex;
  }

  if (unsafeHashVars.theme || window.location.protocol.indexOf("file:") != -1 || window.location.host.indexOf("localhost") != -1 || newStory == "default") {
    unsafeHashVars.theme = newTheme;
    unsafeHashVars.story = newStory;
    hashParamsToInclude = generateHashString(unsafeHashVars);
    replaceStateUrl = window.location.protocol + "//" + window.location.host + getUrlPathName() + hashParamsToInclude;
  } else {
    hashParamsToInclude = generateHashString(unsafeHashVars);
    replaceStateUrl = window.location.protocol + "//" + window.location.host + getUrlPathName() + "stories/" + newStory + hashParamsToInclude;
  }

  window.history.replaceState('themeStory', 'Title', replaceStateUrl);

  $("#timeMachine .player .presentation-mode-share-input").show();
  $("#timeMachine .player .shareView .ui-dialog-title").text("Share a Story");

  gEarthTime.mode = "story";
}

function setExploreModeUrl() {
  var unsafeHashVars = UTIL.getUnsafeHashVars()
  delete unsafeHashVars.theme;
  delete unsafeHashVars.story;
  delete unsafeHashVars.waypointIdx;
  var hashParamsToInclude = generateHashString(unsafeHashVars);
  var replaceStateUrl;

  if (window.location.protocol.indexOf("file:") != -1 || window.location.host.indexOf("localhost") != -1) {
    replaceStateUrl = window.location.protocol + "//" + window.location.host + getUrlPathName() + hashParamsToInclude;
  } else {
    replaceStateUrl = window.location.protocol + "//" + window.location.host + getUrlPathName() + "explore" + hashParamsToInclude;
  }

  window.history.replaceState('explore', 'Title', replaceStateUrl);

  $("#timeMachine .player .presentation-mode-share-input").hide();
  $("#timeMachine .player .shareView .ui-dialog-title").text("Share a View");

  gEarthTime.mode = "explore";
}

function generateHashString(fields) {
  var newHash = "";
  for (var prop in fields) {
    if (fields.hasOwnProperty(prop)) {
      if (fields[prop] == "") continue;
      if (newHash) {
        newHash += '&';
      } else {
        newHash = '#';
      }
      newHash += prop + '=' + fields[prop];
    }
  }
  return newHash;
}

// Modify window.location.hash to include all fields from object newFields.
// If a field in newFields isn't already in window.location.hash, add it.
// If a field in newFields isn already in window.location.hash, overwrite it.
function changeHash(newFields) {
  var fields = UTIL.getUnsafeHashVars();
  $.extend(fields, newFields);
  var newHash = generateHashString(fields);
  if (newHash) {
    window.location.hash = newHash;
  }
}

function getSpreadsheetDownloadPath(path) {
  if (path && path.indexOf(".tsv") == -1 && path.indexOf("http") == -1) {
    path = docTabToGoogleSheetUrl(path);
  }
  return path;
}

var settingsDialog;

function showSettingsDialog() {
  if (!settingsDialog) {
    settingsDialog =
      $('<div title="Settings" style="line-height: 200%"></div>')
      .appendTo($('body'));
  }

  var d = settingsDialog;
  d.html('<a target="_blank" href="' + getSpreadsheetDownloadPath(loadedWaypointsGSheet.url()) + '" title="Click to view current waypoint spreadsheet">Current waypoints spreadsheet</a>' +
          '<button style="float: right; cursor: pointer;" title="Click to change waypoint list">Switch</button><br>' +
          '<a target="_blank" href="https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=358696896" title="Click to view current dotmap spreadsheet">Current dotmap layer spreadsheet</a><br>' +
          '<a target="_blank" href="' + loadedLayersGSheet.url() + '" title="Click to view current csv spreadsheet">Current csv layer spreadsheet</a>' +
          '<button style="float: right; cursor: pointer;" title="Click to change csv layers">Switch</button><br><br>' +
          '<button style="float: right; cursor: pointer; font-size: 12px" title="Reset spreadsheets back to their defaults">Reset spreadsheets to default values</button><br>');


  d.find('button:eq(0)').click(function () {
    askForSpreadsheetUrl('waypoints', function (newUrl) {
      changeHash({waypoints: googleSheetUrlToDocTab(newUrl)});
      d.dialog("close");
    });
  });

  d.find('button:eq(1)').click(function () {
    askForSpreadsheetUrl('csv layers', function (newUrl) {
      changeHash({csvlayers: googleSheetUrlToDocTab(newUrl)});
      d.dialog("close");
    });
  });

  d.find('button:eq(2)').click(function () {
    localStorage.removeItem("waypointSliderContentPath");
    localStorage.removeItem("csvLayersContentPath");
    parent.location.hash = '';
    alert("Spreadsheets successfully reset back to their default values. You may have to reload the page to see this change.");
  });

  d.dialog({
    minWidth: 350,
    buttons: {
      Ok: function() { d.dialog("close"); },
      Cancel: function() { d.dialog("close"); }
    }
  });
}



$(document).tooltip({
  items: "#show-more-layers",
  position: { my: 'left top', at: 'right+15 top-18', collision: "custom" },
  tooltipClass: "show-more-layers-tooltip",
  content: function() {
    var $element = $(this);
    if ($element.attr("id") == "show-more-layers") {
      return "Clicking this will toggle access to the full EarthTime data library. Some layers are a work in progress and will be further developed as time goes on.";
    }
  }
});


function handleStoryToggle(doShow) {
  if (doShow) {
    $("#timeMachine .presentationSlider").removeClass("offscreen");
    $("#timeMachine .player").removeClass("presentationSliderOffscreen");
    $("#layers-list, #theme-list, .themes-scroll-vertical").addClass("waypoints");
    $("#timeMachine .shareView").css("height", "calc(100% + " + $(".player").css("bottom") + ")");
    $("#timeMachine .player .presentation-mode-share-input").show();
    $("#timeMachine .player .shareView .ui-dialog-title").text("Share a Story");
  } else {
    $("#timeMachine .presentationSlider").addClass("offscreen");
    $("#timeMachine .player").addClass("presentationSliderOffscreen");
    $("#layers-list, #theme-list, .themes-scroll-vertical").removeClass("waypoints");
    $("#timeMachine .shareView").css("height", "100%");
    $("#timeMachine .player .presentation-mode-share-input").hide();
    $("#timeMachine .player .shareView .ui-dialog-title").text("Share a View");
  }
  gEarthTime.timelapse.onresize();
  gEarthTime.timelapse.clearShareViewTimeLoop();
  gEarthTime.timelapse.updateShareViewTextbox();
  $("body").trigger('resize');
  if (thumbnailTool) {
    thumbnailTool.resizeCanvas();
  }
  $("#timeMachine").hide().show(0);
}

function resize() {
  var width = gEarthTime.canvasLayer.canvas.width;
  var height = gEarthTime.canvasLayer.canvas.height;
  gl.viewport(0, 0, width, height);

  if (!disableTopNav) {
    var $el1 = $(".location_search_div");
    var $el2 = $("#top-nav-wrapper");
    if (!$el2.hasClass("shrink-nav") && initialTopNavWrapperElm) {
      initialTopNavWrapperElm.outerWidth = $el2.outerWidth();
    }

    if ($el1.length > 0 && initialTopNavWrapperElm) {
      var needHamburgerNav = ($el1[0].offsetLeft <= initialTopNavWrapperElm.outerWidth);
    }
  }

  resizeLayersMenu();

  var $menu_items = $("#top-nav li.menu-option");
  if (needHamburgerNav) {
    $(".menu-option, #top-nav-wrapper, #menu-icon").addClass("shrink-nav");
    $menu_items.hide();
  } else {
    $(".menu-option, #top-nav-wrapper, #menu-icon").removeClass("shrink-nav");
    $menu_items.show();
  }

  gEarthTime.canvasLayer.resize_();

  if (csvDataGrapher.activeLayer.id) {
    csvDataGrapher.chart.render();
  }
}

function resizeLayersMenu() {
  if ($("#show-more-layers").length == 0) return;
  // Make sure the layers height never exceeds the space that would push out the 'Show More' button
  if ($("#layers-menu").is(":visible") && $("#layers-list-featured").is(":visible")) {
    $(".featured-layers-scroll-vertical").css("max-height", ($("#layers-list").height() - $("#layers-list-featured").offset().top) + "px");
  }
  var heightDiff = 0;
  if (featuredTheme) {
    // 1px extra because of borders
    heightDiff = $("#layers-list").offset().top - $('#layers-list-featured').height() - 1;
  }
  $("#layers-list .layers-scroll-vertical").css("height", "calc(100% - " + heightDiff + "px)");
}

// Draws to canvas.
// Called by TimeMachineCanavasLayer during animation and/or view changes
function update() {
  let currentTimelapseView = gEarthTime.timelapse.getView();
  let currentViewportWidth = gEarthTime.timelapse.getViewportWidth();
  let currentViewportHeight = gEarthTime.timelapse.getViewportHeight();
  let currentPlaybackTime = gEarthTime.timelapse.getCurrentTime();
  let currentDrawnLayers = gEarthTime.layerDB.drawnLayersOrSublayersInDrawOrder();

  let needRedraw = false;

  for (let layerProxy of gEarthTime.layerDB.visibleLayers) {
    if (layerProxy.layer?.nextFrameNeedsRedraw) {
      needRedraw = true;
      if (verboseRedrawTest) console.log(`Layer ${layerProxy.id} requests redraw`);
      break;
    } else if (layerProxy.layer?.drawFunction?.drawEveryFrame) {
      needRedraw = true;
    }
  }

  if (gEarthTime.lastPlaybackTime != currentPlaybackTime) {
    needRedraw = true;
    if (verboseRedrawTest) console.log('Playback time changed; need redraw');
  } else if (gEarthTime.lastView.x != currentTimelapseView.x ||
             gEarthTime.lastView.y != currentTimelapseView.y ||
             gEarthTime.lastView.scale != currentTimelapseView.scale) {
    needRedraw = true;
    if (verboseRedrawTest) console.log('View changed; need redraw');
  } else if (gEarthTime.lastClientDimensions.height != currentViewportHeight ||
             gEarthTime.lastClientDimensions.width != currentViewportWidth) {
    needRedraw = true;
    if (verboseRedrawTest) console.log('Viewport changed; need redraw');
  } else if (gEarthTime.lastDrawnLayers.length != currentDrawnLayers.length ||
             !gEarthTime.lastDrawnLayers.map(layerProxy => layerProxy.id).every((id,i)=> (currentDrawnLayers[i] && id == currentDrawnLayers[i].id))) {
    needRedraw = true;
    if (verboseRedrawTest) console.log('Layers changed; need redraw');
  } else if (!gEarthTime.timelapse.lastFrameCompletelyDrawn) {
    if (verboseRedrawTest) console.log('lastFrameCompletelyDrawn was false; need redraw');
    needRedraw = true;
  }

  gEarthTime.lastPlaybackTime = currentPlaybackTime;
  gEarthTime.lastView = currentTimelapseView;
  gEarthTime.lastClientDimensions = {width: currentViewportWidth, height: currentViewportHeight};
  gEarthTime.lastDrawnLayers = currentDrawnLayers;

  gEarthTime.timelapse.lastFrameCompletelyDrawn = true;

  if (!gEarthTime.readyToDraw || !gEarthTime.layerDB) {
    gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
    return;
  }
  if (disableAnimation && isEarthTimeLoadedAndInitialLayerProxiesLoaded()) {
    gEarthTime.canvasLayer.setAnimate(false);
    disableAnimation = false;
  }

  gEarthTime.timelapse.frameno = (gEarthTime.timelapse.frameno || 0) + 1;

  // We are "waiting" this frame if any layer isn't loaded, or any loaded non-mapbox layer doesn't yet have tiles
  var waiting = false;

  // Set this to true at the beginning of frame redraw;  any layer that decides it wasn't completely drawn will set
  // this to false upon draw below
  // If any selected layers not yet loaded, set lastFrameCompletelyDrawn to false
  for (let layerProxy of gEarthTime.layerDB.visibleLayers) {
    if (!layerProxy.isLoaded()) {
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      waiting = true;
    } else if (!(layerProxy.layer instanceof ETMBLayer) &&
               layerProxy.layer.anyTilesLoaded() == false) {
      gEarthTime.timelapse.lastFrameCompletelyDrawn = false;
      waiting = true;
    }
  }

  // If we have waited at least {spinnerWaitTime} seconds in a row, show the spinner
  if (!waiting || !gEarthTime.lastTimeNotWaiting) {
    gEarthTime.lastTimeNotWaiting = new Date().getTime();
    gEarthTime.timelapse.hideSpinner("timeMachine");
  } else {
    let waiting = new Date().getTime() - gEarthTime.lastTimeNotWaiting;
    if (waiting > spinnerWaitTime) {
      gEarthTime.timelapse.showSpinner("timeMachine");
    }
  }

  if (!needRedraw) return;

  gEarthTime.updateTimelineIfNeeded();

  gEarthTime.startRedraw();

  gl.clear(gl.COLOR_BUFFER_BIT);

  (window as any).perf_drawframe();

  if (gEarthTime.layerDB.mapboxLayersAreVisible()) {
    // Ask ETMBLayer to render everything as Mapbox.  (EarthTime layers are inserted into Mapbox and drawn as custom layers)
    ETMBLayer.render();
  } else {
    // Any layer missing tiles or not completely drawing will set lastFrameCompletelyDrawn to false
    // Only mapbox layers have sublayers currently;  drawnSublayers in this case only ever returns
    // the layers themselves.
    for (let sublayer of gEarthTime.layerDB.drawnLayersOrSublayersInDrawOrder()) {
      sublayer.draw();
    }
  }

  gEarthTime.showVisibleLayersLegendsAndCredits();

  gEarthTime.handleGraphIfNeeded();
}

function getLegendHTML() {
  var $legend = $("#layers-legend");
  if (!$legend.length) {
    return "";
  }
  var clone = $legend[0].cloneNode(true);
  $(clone).find("*").filter(function() {
    return this.style.display == "none"
  }).remove();
  // @ts-ignore
  return clone.outerHTML;
}
(window as any).getLegendHTML = getLegendHTML;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// Called once on (jQuery) DOM ready
async function init() {
  await gEarthTime.LayerDBLoaded();
  if (ETNotSupported) {
    $("#baseLayerCreditContainer, #logosContainer, #top-nav").hide();
    $("#browser_not_supported").show();
    return;
  }

  //var landsatUrl = EARTH_TIMELAPSE_CONFIG.landsatUrl || 'https://storage.googleapis.com/timelapse-test/tmp/herwig/export/cmu_20200106_resampled';
  var landsatUrl = '.';

  var timemachineReadyResolver;
  var timelapseReadyPromise = new Promise((resolve, reject) => { timemachineReadyResolver = resolve});

  var settings = {
    constrainVerticalCover: true, // constrain zoom-out and panning so that vertical span is always covered by the map (useful for mapbox)
    loopDwell: {
      startDwell: 1.5,
      endDwell: 1.5
    },
    playbackSpeed: defaultPlaybackSpeed,
    viewerType: isMobileDevice || isIEButNotEdge ? undefined : "webgl",
    url: landsatUrl,
    apiKeys: googleMapsAPIKey ? {'googleMaps': googleMapsAPIKey} : undefined,
    enablePresentationSlider: !disablePresentationSlider,
    enableEditor: false,
    showEditorOnLoad: false,
    showFullScreenBtn: showFullScreenButton,
    showThumbnailTool: showThumbnailTool,
    showShareBtn: showShareButton,
    thumbnailServerHost: thumbnailServerHost,
    headlessClientHost: headlessClientHost,
    presentationSliderSettings: {
      onLoadAnimation: "none",
      playAfterAnimation: false,
      initialWaypointIndex: 0,
      doAutoMode: enableAutoMode,
      showAnnotations: false,
      screenIdleTime: screenTimeoutInMilliseconds,
      waypointDelayTime: waypointDelayInMilliseconds,
      height: 94
    },
    useTouchFriendlyUI: isHyperwall || isMobileDevice,
    datasetType: "landsat",
    playOnLoad: !pauseWhenInitialized,
    mediaType: ".mp4",
    onTimeMachinePlayerReady: function(viewerDivId) {
      setupPostMessageHandlers();
      console.log(`${Utils.logPrefix()} onTimeMachinePlayerReady`);
      timemachineReadyResolver(null);
    },
    scaleBarOptions: {
      scaleBarDiv: "scaleBar1"
    },
    isGoogleAnalyticEventTrackingEnabled: true,
    startEditorFromPresentationMode: true
  };

  if (enableLetterboxMode) {
    $("#letterbox-content").show();
    $("#timeMachine").addClass("letterbox");
    $("#letterbox-main").replaceWith($("#timeMachine"));
    $("#letterbox-bottom").css("height", letterboxBottomOffset);
    $("#timeMachine").css("height", "calc(100% - " + letterboxBottomOffset + "px)");
  } else {
    $("#letterbox-content").remove();
  }

  // Wait for layerDB to load
  await gEarthTime.layerDBPromise;


  // from landsat_ajax_includes_2016.js
  // We think this produced the majority of pixel-coordinate share links
  // Moving forward, we intend to only share lat/lng share links
  cached_ajax['./1068x600/r.json']={
    "height":1881298, "width":2097152,
    "fps":10.0,"frames":33, "leader":0,"level_info":[{"cols":1,"rows":1},{"cols":1,"rows":5},{"cols":5,"rows":9},{"cols":9,"rows":17},{"cols":21,"rows":37},{"cols":45,"rows":73},{"cols":93,"rows":145},{"cols":185,"rows":293},{"cols":369,"rows":585},{"cols":737,"rows":1173},{"cols":1473,"rows":2349},{"cols":2945,"rows":4701},{"cols":5889,"rows":9405}],"level_scale":2.0,"nlevels":13,"tile_height":200,"tile_width":356,"video_height":800,"video_width":1424
  };
  cached_ajax['./tm.json']={"capture-times":["1984","1985","1986","1987","1988","1989","1990","1991","1992","1993","1994","1995","1996","1997","1998","1999","2000","2001","2002","2003","2004","2005","2006","2007","2008","2009","2010","2011","2012","2013","2014","2015","2016"],"datasets":[{"id":"1068x600","name":"1068x600"}],"projection-bounds":{"east":180.00000000000003,"north":83.68837076275285,"south":-82.60002600943437,"west":-180.00000000000003},"sizes":["1068x600"]};

  gEarthTime.timelapse = new org.gigapan.timelapse.Timelapse("timeMachine", settings);
  (window as any).timelapse = gEarthTime.timelapse;

  // Wait for timelapse to be ready
  //console.log(`${Utils.logPrefix()} awaiting timelapseReadyPromise`);
  await timelapseReadyPromise;
  //console.log(`${Utils.logPrefix()} awaiting setupUIAndOldLayers`);
  {
    // Constrain viewing bounds to full mercator
    let proj = gEarthTime.timelapse.getProjection();
    let ymin = proj.latlngToPoint({lat: stdWebMercatorNorth, lng: 0}).y;
    let ymax = proj.latlngToPoint({lat: stdWebMercatorSouth, lng: 0}).y;
    gEarthTime.timelapse.setVerticalCoverConstraint(ymin, ymax);
  }

  await setupUIAndOldLayers();

  // NOTE: Layers from a story or share link may already have been activated.
  let layersToShow = gEarthTime.layerDB.visibleLayers;
  if (layersToShow.length == 0) {
    // Landsat is default initial layer for EarthTime
    var layerDB = gEarthTime.layerDB;
    layersToShow = [
      layerDB.getLayer('blsat')
    ];
    console.log(`${Utils.logPrefix()} init; calling setVisibleLayers`);
    layerDB.setVisibleLayers(layersToShow);
  }

  //console.log(`${Utils.logPrefix()} setting readyToDraw true`);
  gEarthTime.readyToDraw = true;

  contentSearch.initialize();
}

$(init);
