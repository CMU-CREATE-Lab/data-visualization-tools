///// <reference path="perf.js"/>
/// <reference path="StoryEditor.js"/>
/// <reference path="../../js/dat.gui.min.js"/>
/// <reference path="../../js/utils.js"/>
/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>
/// <reference path="../../timemachine/js/org/gigapan/timelapse/crossdomain_api.js"/>
/// <reference path="../../timemachine/libs/change-detect/js/TimeMachineCanvasLayer.js"/>

import { dbg } from './dbg'
import { WebGLMapLayer } from './WebGLMapLayer'
import { WebGLVectorTile2 } from './WebGLVectorTile2'
import { WebGLVideoTile } from './WebGLVideoTile'
import { Utils } from './Utils';

dbg.Utils = Utils;
console.log(`${Utils.logPrefix()} Loading index.ts`)

declare var Papa:any;
/// <reference path="../../js/papaparse.min.js"/>

import { LayerOptions } from './Layer';

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


dbg.GSheet = GSheet;

var EarthlapseUI;
var timelineUIHandler;
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

/* Set up markdown used for layer info bubbles */
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
var waypointCollection = EARTH_TIMELAPSE_CONFIG.waypointCollection;
var waypointSliderContentPath = EARTH_TIMELAPSE_CONFIG.waypointSliderContentPath || "default-waypoints.tsv";

var csvLayersContentPath : string;
if (typeof(EARTH_TIMELAPSE_CONFIG.csvLayersContentPath) === "undefined") {
  csvLayersContentPath = "1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE.870361385";
} else if (EARTH_TIMELAPSE_CONFIG.csvLayersContentPath === "") {
  csvLayersContentPath = "default-csvlayers.tsv";
} else {
  csvLayersContentPath =  EARTH_TIMELAPSE_CONFIG.csvLayersContentPath;
}


class EarthTimeImpl implements EarthTime {
  layerDB: LayerDB = null;
  layerDBPromise = null;
  timelapse = null;
  rootTilePath = null;
  dotmapsServerHost = null;
  glb = null;
  canvasLayer = null;
  readyToDraw = false;
  currentlyShownTimeline: any;
  async setDatabaseID(databaseID: GSheet) {
    async function internal(earthTime: EarthTimeImpl) {
      earthTime.layerDB = null;
      earthTime.layerDB = dbg.layerDB = await LayerDB.create(databaseID, {earthTime: earthTime});
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
  redrawTakingTooLong() {
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

  private computeCurrentDate(currentTime, currentTimes, dates): Date {
    var delta = this.computeCurrentTimesDelta(currentTime, currentTimes);
    var currentIndex = this.computeCurrentTimeIndex(currentTime, currentTimes);
    var previousIndex = 0;
    if (currentIndex != 0) {
      previousIndex = currentIndex - 1;
    }
    var currentDate = dates[currentIndex];
    var previousDate = dates[previousIndex];
    var range = currentDate - previousDate;
    var date = new Date(previousDate + range*delta);
    // Ensure we don't go beyond the last date of the timeline.
    // An example of where this is needed is when we are playing at fast speed and the current time
    // might go slightly beyond (small epsilon) the desired end time. You can see this when playing
    // the Obesity layer at fast speed.
    var lastTimelineDate = new Date(gEarthTime.timelapse.getCaptureTimes()[gEarthTime.timelapse.getNumFrames() - 1]);
    if (date > lastTimelineDate) {
      date = lastTimelineDate;
    }
    return date;
  }

  private getTimelapseDates(): Date[] {
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

  currentDate(): Date {
    var currentTime = this.timelapse.getCurrentTime();
    var currentTimes = this.getTimelapseCurrentTimes();
    return this.computeCurrentDate(currentTime, currentTimes, this.getTimelapseDates());
  }

  currentEpochTime(): number {
    return this.currentDate().getTime() / 1000;
  }

  // Currently active timeline, computed as last non-empty timeline from visibleLayers
  timeline(): Timeline {
    let visibleLayers = this.layerDB.visibleLayers;
    for (let i = visibleLayers.length - 1; i >= 0; i--) {
      let timeline = visibleLayers[i].layer?.timeline;
      // Check whether we have a layer that covers the world, but does not have a timeline associated with it (e.g. lights at night)
      if (!timeline && visibleLayers[i].layer?.layerConstraints?.isFullExtent) {
        break;
      }
      if (timeline) {
        return timeline;
      }
    }
    return null;
  }

  showVisibleLayersLegends() {
    let loadedLayersInIdOrder = this.layerDB.loadedLayersInIdOrder();
    for (let i = 0; i < loadedLayersInIdOrder.length; i++) {
      if (loadedLayersInIdOrder[i].layer.hasLegend && !loadedLayersInIdOrder[i].layer.legendVisible) {
        this.layerDB.layerFactory.setLegend(loadedLayersInIdOrder[i].id);
      }
    }
  }

  updateTimelineIfNeeded() {
    let newTimeline = this.timeline();
    if (newTimeline !== this.currentlyShownTimeline) {
      this.currentlyShownTimeline = newTimeline;
      $(".controls, .captureTime, .customControl").hide();
      let $ui = $(".current-location-text-container, .annotations-resume-exit-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend");
      $ui.addClass("noTimeline");
      if (newTimeline) {
        this.timelapse.getVideoset().setFps(newTimeline.fps);
        this.timelapse.loadNewTimelineFromObj(newTimeline.getCaptureTimes(), newTimeline.timelineType);
        this.timelapse.setMasterPlaybackRate(newTimeline.masterPlaybackRate);
        this.timelapse.setPlaybackRate(newTimeline.playbackRate);
        // We need timelapse to update the time internally (above) but if we just have one date, we don't actually want to show the timeline UI.
        if (newTimeline.startDate == newTimeline.endDate) {
          return;
        } else {
          $ui.removeClass("noTimeline");
        }
        if (newTimeline.timelineType == "customUI") {
          $(".customControl").show().children().show();
        } else {
          $(".controls, .captureTime").show();
        }
      }
    }
  }
};

setGEarthTime(new EarthTimeImpl());
gEarthTime.setDatabaseID(GSheet.from_url(csvLayersContentPath));

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

////var showEVA = !!EARTH_TIMELAPSE_CONFIG.showEVA;
var showGFW = !!EARTH_TIMELAPSE_CONFIG.showGFW;
var showStories = typeof(EARTH_TIMELAPSE_CONFIG.showStories) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showStories;
var showCustomDotmaps = typeof(EARTH_TIMELAPSE_CONFIG.showCustomDotmaps) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showCustomDotmaps;
var showCsvLayers = !!EARTH_TIMELAPSE_CONFIG.showCsvLayers;



////var showForestAlerts = !!EARTH_TIMELAPSE_CONFIG.showForestAlerts;
//var showUSDrilling = typeof(EARTH_TIMELAPSE_CONFIG.showUSDrilling) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showUSDrilling;
//var showViirs = typeof(EARTH_TIMELAPSE_CONFIG.showViirs) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showViirs;
//var showGlobalWindPower = !!EARTH_TIMELAPSE_CONFIG.showGlobalWindPower;
// var showVsi = !!EARTH_TIMELAPSE_CONFIG.showVsi;
//var showHealthImpact = !!EARTH_TIMELAPSE_CONFIG.showHealthImpact;
//var showZika = !!EARTH_TIMELAPSE_CONFIG.showZika;
//var showDengue = !!EARTH_TIMELAPSE_CONFIG.showDengue;
//var showChiku = !!EARTH_TIMELAPSE_CONFIG.showChiku;
//var showUrbanFragility = !!EARTH_TIMELAPSE_CONFIG.showUrbanFragility;
//var showGtd = !!EARTH_TIMELAPSE_CONFIG.showGtd;
//var showHiv = !!EARTH_TIMELAPSE_CONFIG.showHiv;
//var showObesity = !!EARTH_TIMELAPSE_CONFIG.showObesity;
//var showVaccineConfidence = !!EARTH_TIMELAPSE_CONFIG.showVaccineConfidence;
//var showNdviAnomaly = !!EARTH_TIMELAPSE_CONFIG.showNdviAnomaly;
//var showEbola = !!EARTH_TIMELAPSE_CONFIG.showEbola;
// var showWaterOccurrence = !!EARTH_TIMELAPSE_CONFIG.showWaterOccurrence;
// var showWaterChange = !!EARTH_TIMELAPSE_CONFIG.showWaterChange;
//var showBerkeleyEarthTemperatureAnomaly = !!EARTH_TIMELAPSE_CONFIG.showBerkeleyEarthTemperatureAnomaly;
//var showUppsalaConflict = !!EARTH_TIMELAPSE_CONFIG.showUppsalaConflict;
// var showLightsAtNight = typeof(EARTH_TIMELAPSE_CONFIG.showLightsAtNight) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showLightsAtNight;
// var showLightsAtNight2012 = !!EARTH_TIMELAPSE_CONFIG.showLightsAtNight2012;
//var showLightsAtNight2016 = !!EARTH_TIMELAPSE_CONFIG.showLightsAtNight2016;
//var showOmiNo2 = !!EARTH_TIMELAPSE_CONFIG.showOmiNo2;
//var showBePm25 = !!EARTH_TIMELAPSE_CONFIG.showBePm25;
// var showLightsAtNightAnim = !!EARTH_TIMELAPSE_CONFIG.showLightsAtNightAnim;
//var showExpandingCities = !!EARTH_TIMELAPSE_CONFIG.showExpandingCities;
//var showIrena = !!EARTH_TIMELAPSE_CONFIG.showIrena;
var showCityLabelMap = !!EARTH_TIMELAPSE_CONFIG.showCityLabelMap;
//var showTsip = !!EARTH_TIMELAPSE_CONFIG.showTsip;
//var showAnnualGlobalPm25 = !!EARTH_TIMELAPSE_CONFIG.showAnnualGlobalPm25;
//var showEcco2 = !!EARTH_TIMELAPSE_CONFIG.showEcco2;
//var showTintedLandsat = !!EARTH_TIMELAPSE_CONFIG.showTintedLandsat;
//var showGfsTimemachine = !!EARTH_TIMELAPSE_CONFIG.showGfsTimemachine;
//var showChlorophyllConcentrationTimemachine = !!EARTH_TIMELAPSE_CONFIG.showChlorophyllConcentrationTimemachine;
//var showFishingPprTimemachine = !!EARTH_TIMELAPSE_CONFIG.showFishingPprTimemachine;

var googleMapsAPIKey = parseConfigOption({optionName: "googleMapsAPIKey", optionDefaultValue: "AIzaSyAGTDshdDRmq8zdw26ZmwJOswh6VseIrYY", exposeOptionToUrlHash: false});
var showExtrasMenu = parseConfigOption({optionName: "showExtrasMenu", optionDefaultValue: true, exposeOptionToUrlHash: false});
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
var useGoogleMaps = parseConfigOption({optionName: "useGoogleMaps", optionDefaultValue: false, exposeOptionToUrlHash: false});
var useGoogleSearch = parseConfigOption({optionName: "useGoogleSearch", optionDefaultValue: true, exposeOptionToUrlHash: false});
var enableAutoMode = parseConfigOption({optionName: "enableAutoMode", optionDefaultValue: false, exposeOptionToUrlHash: false});
var autoModeCriteria = parseConfigOption({optionName: "autoModeCriteria", optionDefaultValue: {}, exposeOptionToUrlHash: false});
var screenTimeoutInMilliseconds = parseConfigOption({optionName: "screenTimeoutInMilliseconds", optionDefaultValue: (8 * 60 * 1000), exposeOptionToUrlHash: false});
var waypointDelayInMilliseconds = parseConfigOption({optionName: "waypointDelayInMilliseconds", optionDefaultValue: (1 * 15 * 1000), exposeOptionToUrlHash: false});
var defaultPlaybackSpeed = parseConfigOption({optionName: "defaultPlaybackSpeed", optionDefaultValue: 0.5, exposeOptionToUrlHash: false});
var useFaderShader = parseConfigOption({optionName: "useFaderShader", optionDefaultValue: true, exposeOptionToUrlHash: false});
var enableWaypointText = parseConfigOption({optionName: "enableWaypointText", optionDefaultValue: true, exposeOptionToUrlHash: false});
var defaultTrackingId = document.location.hostname === "earthtime.org" ? "UA-10682694-21" : "";
var trackingId = parseConfigOption({optionName: "trackingId", optionDefaultValue: defaultTrackingId, exposeOptionToUrlHash: false});
gEarthTime.rootTilePath = parseConfigOption({optionName: "rootTilePath", optionDefaultValue: "../../../data/", exposeOptionToUrlHash: false});
var baseMapsNoLabels = parseConfigOption({optionName: "baseMapsNoLabels", optionDefaultValue: false, exposeOptionToUrlHash: true});
var useRetinaLightBaseMap = parseConfigOption({optionName: "useRetinaLightBaseMap", optionDefaultValue: false, exposeOptionToUrlHash: false});
var useRetinaLightNoLabelsBaseMap = baseMapsNoLabels ? true : parseConfigOption({optionName: "useRetinaLightNoLabelsBaseMap", optionDefaultValue: false, exposeOptionToUrlHash: false});
var useRetinaDarkBaseMap = parseConfigOption({optionName: "useRetinaDarkBaseMap", optionDefaultValue: false, exposeOptionToUrlHash: false});
var useRetinaDarkNoLabelsBaseMap = baseMapsNoLabels ? true : parseConfigOption({optionName: "useRetinaDarkNoLabelsBaseMap", optionDefaultValue: false, exposeOptionToUrlHash: false});
var enableStoryEditor = !showStories ? false : parseConfigOption({optionName: "enableStoryEditor", optionDefaultValue: false, exposeOptionToUrlHash: false});
var pauseWhenInitialized = parseConfigOption({optionName: "pauseWhenInitialized", optionDefaultValue: false, exposeOptionToUrlHash: true});
var disableAnimation = parseConfigOption({optionName: "disableAnimation", optionDefaultValue: false, exposeOptionToUrlHash: true});
var preserveDrawingBuffer = parseConfigOption({optionName: "preserveDrawingBuffer", optionDefaultValue: false, exposeOptionToUrlHash: true});
var landsatVersion = parseConfigOption({optionName: "landsatVersion", optionDefaultValue: "2015", exposeOptionToUrlHash: false});
// Deprecated
var customDarkMapUrl = parseConfigOption({optionName: "customDarkMapUrl", optionDefaultValue: "", exposeOptionToUrlHash: false});
var customDarkMapUrlOrId = parseConfigOption({optionName: "customDarkMapUrlOrId", optionDefaultValue: "", exposeOptionToUrlHash: true}) || customDarkMapUrl;
// Deprecated
var customLightMapUrl = parseConfigOption({optionName: "customLightMapUrl", optionDefaultValue: "", exposeOptionToUrlHash: false});
var customLightMapUrlOrId = parseConfigOption({optionName: "customLightMapUrlOrId", optionDefaultValue: "", exposeOptionToUrlHash: true}) || customLightMapUrl;

// TODO:
// Until we decide to force everyone to latest landsat, pull the version corresponding to the config above.
if (landsatVersion == "2015"){
  var cachedLandsatTimeJsonPath = "landsat-times.json";
  var landsatAjaxIncludesPath = "landsat_ajax_includes.js";
} else if (landsatVersion == "2019"){
  var cachedLandsatTimeJsonPath = "landsat-times-2019.json";
  var landsatAjaxIncludesPath = "landsat_ajax_includes_2019.js";
} else {
  var cachedLandsatTimeJsonPath = "landsat-times-2016.json";
  var landsatAjaxIncludesPath = "landsat_ajax_includes_2016.js";
  if (isMobileDevice || isIEButNotEdge) {
    landsatAjaxIncludesPath = "https://earthengine.google.com/timelapse/data/20161025/ajax_includes.js";
  }
}


//
//// App variables ////
//

WebGLVideoTile.useFaderShader = useFaderShader;
var showTile = true;
var landsatMaxScale = (landsatVersion == "2015") ? 1.25 : 0.45;
if (window.devicePixelRatio > 1) {
  landsatMaxScale -= 0.21;
}
var rasterMapTileMaxScale = 80 * landsatMaxScale;
var isAutoModeRunning = false;
var visibleBaseMapLayer = "blsat";
var previousVisibleBaseMapLayer = visibleBaseMapLayer;
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
var timelineType = "customUI";
var activeLayersWithTimeline = 0;
var timelineHidden = false;
var previousActiveLayersWithTimeline = 0;
var lastSelectedWaypointIndex = -1;
var keysDown = [];
var $lastSelectedExtra;
var loadedInitialCsvLayers = false;
var dotmapLayersInitialized = false;
var csvFileLayersInitialized = false;
var storiesInitialized = false;
var timeMachinePlayerInitialized = false;
var timeInMsSinceLastWaypointLoop = 0;
var $nextAnnotationLocationButton;
var $previousAnnotationLocationButton;
var lastLayerMenuScrollPos = 0;
var lastFeaturedLayerMenuScrollPos = 0;
var lastThemeMenuScrollPos = 0;
var $lastActiveLayerTopic = $();
var $lastActiveFeaturedLayerTopic = $();
var lastActiveLayers = [];
var maxCachedLayers = 8;
var lastSelectedAnnotationBeforeHidden;
var initialTopNavWrapperElm;
var $activeLayerDescriptionTooltip;
var storyEditor;
var activeEarthTimeLayers = [];
var timeZone = "";
var storyLoadedFromRealKeyDown = false;


// ## 1 ##
//
//// Layer variables ////
//

var /*forestAlertsTimeMachineLayer, forestAlertsNoOverlayTimeMachineLayer,*/ landsatBaseMapLayer, darkBaseMapLayer, lightBaseMapLayer, mcrmVectorLayer, countryLabelMapLayer, cityLabelMapLayer;
//var ndviAnomalyTimeMachineLayer;
//var crwTimeMachineLayer
// var waterOccurrenceLayer, waterChangeLayer;
//var usgsWindTurbineLayer, solarInstallsLayer, drillingLayer;
//var annualGlobalPm25TimeMachineLayer;
//var globalWindPowerLayer;
//Timelines.setTimeLine('global-wind-power-times', '1984', '2018', 1);
// var vsiLayer;
//var healthImpactLayer;
//var zikaLayer, dengueLayer, chikuLayer;
//var viirsLayer;
////var tintedSeaLevelRiseLayer;
//var urbanFragilityLayer;
//var monthlyRefugeesLayer;
//var gtdLayer;
//var hivLayer;
//var obesityLayer;
//var vaccineConfidenceLayer;
//var ebolaDeathsLayer;
//var ebolaCasesLayer;
//var ebolaNewCasesLayer;
//var berkeleyEarthTemperatureAnomalyTimeMachineLayer;
//var berkeleyEarthTemperatureAnomalyV2YearlyTimeMachineLayer;
var landBorderLayer;
//var uppsalaConflictLayer;
//var omiNo2Layer;
//var bePm25Layer;
// var lightsAtNightAnimLayer;
//var expandingCitiesLayer;
//Timelines.setTimeLine('expanding-cities-times', '1955', '2030', 5);
//var irenaSolarLayer;
//Timelines.setTimeLine('irena-solar-times', '2000', '2016', 1);
//var irenaWindLayer;
//Timelines.setTimeLine('irena-wind-times', '2000', '2016', 1);
//var tsipLayer;
//Timelines.setTimeLine('tsip-times', '2000', '2017', 1);

//var ecco2Layer;

////var tintedLandsatLayer;

//var gfsTimemachineLayer;
//var chlorophyllConcentrationTimemachineLayer;
//var fishingPprTimeMachineLayer;

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

// ## 2 ##
//// Layer tile paths
//

//var fishingPprTimeMachineUrl = rootTilePath + "/fishing-ppr.timemachine/crf19-8fps-1424x800";
//var ndviAnomalyTimeMachineUrl = rootTilePath + "/ndvi_anomaly_1000v01/1068x600";
//var annualGlobalPm25TimeMachineUrl = rootTilePath + "/annual-global-pm25/pm2_5v2.timemachine/crf26-6fps-1424x800";
////var forestAlertsTimeMachineUrl = rootTilePath + "/global-forest-alerts/ForestAlarms2016v2/1068x600";
////var forestAlertsNoOverlayTimeMachineUrl = rootTilePath + "/global-forest-alerts/ForestAlarmsNoOverlay2016v1/1068x600";
//var berkeleyEarthTemperatureAnomalyTimeMachineUrl = rootTilePath + "/berkeley-earth/berkeley-earth.timemachine/crf24-12fps-1424x800";
//var berkeleyEarthTemperatureAnomalyV2YearlyTimeMachineUrl = rootTilePath + "/berkeley-earth/temp-anomaly/yearly.timemachine/crf24-12fps-1424x800";
//var berkeleyEarthTemperatureAnomalyV2MoWindowTimeMachineUrl = rootTilePath + "/berkeley-earth/temp-anomaly/window_12mo.timemachine/crf24-12fps-1424x800";
var osmDefaultUrl = gEarthTime.rootTilePath + "/openstreetmap/default/";
var omtDarkUrl = gEarthTime.rootTilePath + "/openmaptiles/dark-map/{default}/{z}/{x}/{y}.png";
var omtDarkRetinaUrl = gEarthTime.rootTilePath + "/openmaptiles/dark-map-retina/{default}/{z}/{x}/{y}.png";
var omtDarkRetinaNoLabelsUrl = gEarthTime.rootTilePath + "/openmaptiles/dark-map-retina-no-labels/{default}/{z}/{x}/{y}.png";
var omtLightUrl = gEarthTime.rootTilePath + "/openmaptiles/light-map/{default}/{z}/{x}/{y}.png";
var omtLightRetinaUrl = gEarthTime.rootTilePath + "/openmaptiles/light-map-retina/{default}/{z}/{x}/{y}.png";
var omtLightRetinaNoLabelsUrl = gEarthTime.rootTilePath + "/openmaptiles/light-map-retina-no-labels/{default}/{z}/{x}/{y}.png";
var gfcTransUrl = gEarthTime.rootTilePath + "/global-forest-change/loss_year_transparent/{default}/{z}/{x}/{y}.png";
var gfcLossGainUrl = gEarthTime.rootTilePath + "/global-forest-change/loss_tree_gain/{default}/{z}/{x}/{y}.png";
var googleMapsDefaultUrl = "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i386081408!3m14!2sen-US!3sUS!5e18!12m1!1e47!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcy5lOmd8cC5jOiNmZjAwMDAwMCxzLmU6bHxwLnY6b2ZmLHMuZTpsLml8cC52Om9mZixzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLmU6bC50LnN8cC5jOiNmZjIxMjEyMSxzLnQ6MXxzLmU6Z3xwLmM6I2ZmNzU3NTc1fHAudjpvZmYscy50OjE3fHAudjpvbixzLnQ6MTd8cy5lOmwudC5mfHAuYzojZmZjY2NjY2Mscy50OjE3fHMuZTpsLnQuc3xwLmM6I2ZmMDAwMDAwLHMudDoyMXxwLnY6b2ZmLHMudDoxOXxzLmU6bC50LmZ8cC5jOiNmZmJkYmRiZCxzLnQ6MjB8cC52Om9mZixzLnQ6MTh8cC52Om9uLHMudDoxOHxzLmU6bC50LmZ8cC5jOiNmZjdmN2Y3ZixzLnQ6MTh8cy5lOmwudC5zfHAuYzojZmYwMDAwMDAscy50OjJ8cC52Om9mZixzLnQ6MnxzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLnQ6NDB8cy5lOmd8cC5jOiNmZjE4MTgxOCxzLnQ6NDB8cy5lOmwudC5mfHAuYzojZmY2MTYxNjEscy50OjQwfHMuZTpsLnQuc3xwLmM6I2ZmMWIxYjFiLHMudDozfHAudjpvZmYscy50OjN8cy5lOmcuZnxwLmM6I2ZmMmMyYzJjLHMudDozfHMuZTpsLml8cC52Om9mZixzLnQ6M3xzLmU6bC50LmZ8cC5jOiNmZjhhOGE4YSxzLnQ6NTB8cy5lOmd8cC5jOiNmZjM3MzczNyxzLnQ6NDl8cy5lOmd8cC5jOiNmZjNjM2MzYyxzLnQ6Nzg1fHMuZTpnfHAuYzojZmY0ZTRlNGUscy50OjUxfHMuZTpsLnQuZnxwLmM6I2ZmNjE2MTYxLHMudDo0fHAudjpvZmYscy50OjR8cy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy50OjZ8cC5jOiNmZjRjNGM0YyxzLnQ6NnxzLmU6Z3xwLmM6I2ZmMzMzMzMzLHMudDo2fHMuZTpsLnQuZnxwLmM6I2ZmM2QzZDNk!4e0";
var googleMapsDarkStyleUrl = "https://mts0.googleapis.com/vt?pb=!1m4!1m3!1i{z}!2i{x}!3i{y}!2m3!1e0!2sm!3i323305239!3m14!2sen-US!3sUS!5e18!12m1!1e47!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcC5oOiMwMDAwYjB8cC5pbDp0cnVlfHAuczotMzAscy50OjJ8cC52Om9mZg!4e0";
var googleMapsDefaultRetinaUrl = "https://mts1.googleapis.com/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i323305239!3m9!2sen-US!3sUS!5e18!12m1!1e47!12m3!1e37!2m1!1ssmartmaps!4e0!5m1!5f2";

var googleMapsDarkStyleRetinaUrl = "https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i386081408!3m14!2sen-US!3sUS!5e18!12m1!1e47!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcy5lOmd8cC5jOiNmZjAwMDAwMCxzLmU6bHxwLnY6b2ZmLHMuZTpsLml8cC52Om9mZixzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLmU6bC50LnN8cC5jOiNmZjIxMjEyMSxzLnQ6MXxzLmU6Z3xwLmM6I2ZmNzU3NTc1fHAudjpvZmYscy50OjE3fHAudjpvbixzLnQ6MTd8cy5lOmwudC5mfHAuYzojZmZjY2NjY2Mscy50OjE3fHMuZTpsLnQuc3xwLmM6I2ZmMDAwMDAwLHMudDoyMXxwLnY6b2ZmLHMudDoxOXxzLmU6bC50LmZ8cC5jOiNmZmJkYmRiZCxzLnQ6MjB8cC52Om9mZixzLnQ6MTh8cC52Om9uLHMudDoxOHxzLmU6bC50LmZ8cC5jOiNmZjdmN2Y3ZixzLnQ6MTh8cy5lOmwudC5zfHAuYzojZmYwMDAwMDAscy50OjJ8cC52Om9mZixzLnQ6MnxzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLnQ6NDB8cy5lOmd8cC5jOiNmZjE4MTgxOCxzLnQ6NDB8cy5lOmwudC5mfHAuYzojZmY2MTYxNjEscy50OjQwfHMuZTpsLnQuc3xwLmM6I2ZmMWIxYjFiLHMudDozfHAudjpvZmYscy50OjN8cy5lOmcuZnxwLmM6I2ZmMmMyYzJjLHMudDozfHMuZTpsLml8cC52Om9mZixzLnQ6M3xzLmU6bC50LmZ8cC5jOiNmZjhhOGE4YSxzLnQ6NTB8cy5lOmd8cC5jOiNmZjM3MzczNyxzLnQ6NDl8cy5lOmd8cC5jOiNmZjNjM2MzYyxzLnQ6Nzg1fHMuZTpnfHAuYzojZmY0ZTRlNGUscy50OjUxfHMuZTpsLnQuZnxwLmM6I2ZmNjE2MTYxLHMudDo0fHAudjpvZmYscy50OjR8cy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy50OjZ8cC5jOiNmZjRjNGM0YyxzLnQ6NnxzLmU6Z3xwLmM6I2ZmMzMzMzMzLHMudDo2fHMuZTpsLnQuZnxwLmM6I2ZmM2QzZDNk!4e0!5m1!5f2";
    googleMapsDarkStyleRetinaUrl = 'https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i408105841!3m14!2sen-US!3sUS!5e18!12m1!1e68!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcy5lOmd8cC5jOiNmZjIxMjEyMSxzLmU6bC5pfHAudjpvZmYscy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy5lOmwudC5zfHAuYzojZmYyMTIxMjEscy50OjF8cy5lOmd8cC5jOiNmZjc1NzU3NSxzLnQ6MTd8cy5lOmcuc3xwLnY6b2ZmLHMudDoxN3xzLmU6bC50LmZ8cC5jOiNmZjllOWU5ZSxzLnQ6MjF8cC52Om9mZixzLnQ6MTl8cy5lOmcuc3xwLnY6b2ZmLHMudDoxOXxzLmU6bC50LmZ8cC5jOiNmZmJkYmRiZCxzLnQ6MTh8cy5lOmcuc3xwLnY6b2ZmLHMudDoxMzEzfHAuYzojZmYwMDAwMDAscy50OjJ8cy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy50OjQwfHMuZTpnfHAuYzojZmYxODE4MTgscy50OjQwfHMuZTpsLnQuZnxwLmM6I2ZmNjE2MTYxLHMudDo0MHxzLmU6bC50LnN8cC5jOiNmZjFiMWIxYixzLnQ6M3xzLmU6Zy5mfHAuYzojZmYyYzJjMmMscy50OjN8cy5lOmwudC5mfHAuYzojZmY4YThhOGEscy50OjUwfHMuZTpnfHAuYzojZmYzNzM3Mzcscy50OjQ5fHMuZTpnfHAuYzojZmYzYzNjM2Mscy50Ojc4NXxzLmU6Z3xwLmM6I2ZmNGU0ZTRlLHMudDo1MXxzLmU6bC50LmZ8cC5jOiNmZjYxNjE2MSxzLnQ6NHxzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLnQ6NnxzLmU6Z3xwLmM6I2ZmMDAwMDAwLHMudDo2fHMuZTpnLmZ8cC5jOiNmZjMyMzIzMixzLnQ6NnxzLmU6bC50LmZ8cC5jOiNmZjNkM2QzZA!4e0!5m1!5f2';

var googleMapsCountryLabelUrl = 'https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i388084864!3m14!2sen-US!3sUS!5e18!12m1!1e68!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcy5lOmd8cC5jOiNmZjIxMjEyMSxzLmU6bC5pfHAudjpvZmYscy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy5lOmwudC5zfHAuYzojZmYyMTIxMjEscy50OjF8cy5lOmd8cC5jOiNmZjc1NzU3NXxwLnY6b2ZmLHMudDoxN3xzLmU6bC50LmZ8cC5jOiNmZjllOWU5ZSxzLnQ6MjF8cC52Om9mZixzLnQ6MTl8cC52Om9mZixzLnQ6MTl8cy5lOmwudC5mfHAuYzojZmZiZGJkYmQscy50OjIwfHAudjpvZmYscy50OjE4fHAudjpvZmYscy50OjV8cC52Om9mZixzLnQ6MnxwLnY6b2ZmLHMudDoyfHMuZTpsLnR8cC52Om9mZixzLnQ6MnxzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLnQ6NDB8cy5lOmd8cC5jOiNmZjE4MTgxOCxzLnQ6NDB8cy5lOmwudC5mfHAuYzojZmY2MTYxNjEscy50OjQwfHMuZTpsLnQuc3xwLmM6I2ZmMWIxYjFiLHMudDozfHAudjpvZmYscy50OjN8cy5lOmcuZnxwLmM6I2ZmMmMyYzJjLHMudDozfHMuZTpsfHAudjpvZmYscy50OjN8cy5lOmwuaXxwLnY6b2ZmLHMudDozfHMuZTpsLnQuZnxwLmM6I2ZmOGE4YThhLHMudDo1MHxzLmU6Z3xwLmM6I2ZmMzczNzM3LHMudDo0OXxzLmU6Z3xwLmM6I2ZmM2MzYzNjLHMudDo3ODV8cy5lOmd8cC5jOiNmZjRlNGU0ZSxzLnQ6NTF8cy5lOmwudC5mfHAuYzojZmY2MTYxNjEscy50OjR8cC52Om9mZixzLnQ6NHxzLmU6bC50LmZ8cC5jOiNmZjc1NzU3NSxzLnQ6NnxwLnY6b2ZmLHMudDo2fHMuZTpnfHAuYzojZmYwMDAwMDAscy50OjZ8cy5lOmwudHxwLnY6b2ZmLHMudDo2fHMuZTpsLnQuZnxwLmM6I2ZmM2QzZDNk!4e0';
    googleMapsCountryLabelUrl = 'https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i388083592!3m14!2sen-US!3sUS!5e18!12m1!1e68!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcy5lOmd8cC5jOiNmZjIxMjEyMSxzLmU6bC5pfHAudjpvZmYscy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy5lOmwudC5zfHAuYzojZmYyMTIxMjEscy50OjF8cy5lOmd8cC5jOiNmZjc1NzU3NXxwLnY6b2ZmLHMudDoxN3xzLmU6bC50LmZ8cC5jOiNmZmZmZmZmZixzLnQ6MTd8cy5lOmwudC5zfHAuYzojZmYwMDAwMDAscy50OjIxfHAudjpvZmYscy50OjE5fHAudjpvZmYscy50OjE5fHMuZTpsLnQuZnxwLmM6I2ZmYmRiZGJkLHMudDoyMHxwLnY6b2ZmLHMudDoxOHxwLnY6b2ZmLHMudDo1fHAudjpvZmYscy50OjJ8cC52Om9mZixzLnQ6MnxzLmU6bC50fHAudjpvZmYscy50OjJ8cy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy50OjQwfHMuZTpnfHAuYzojZmYxODE4MTgscy50OjQwfHMuZTpsLnQuZnxwLmM6I2ZmNjE2MTYxLHMudDo0MHxzLmU6bC50LnN8cC5jOiNmZjFiMWIxYixzLnQ6M3xwLnY6b2ZmLHMudDozfHMuZTpnLmZ8cC5jOiNmZjJjMmMyYyxzLnQ6M3xzLmU6bHxwLnY6b2ZmLHMudDozfHMuZTpsLml8cC52Om9mZixzLnQ6M3xzLmU6bC50LmZ8cC5jOiNmZjhhOGE4YSxzLnQ6NTB8cy5lOmd8cC5jOiNmZjM3MzczNyxzLnQ6NDl8cy5lOmd8cC5jOiNmZjNjM2MzYyxzLnQ6Nzg1fHMuZTpnfHAuYzojZmY0ZTRlNGUscy50OjUxfHMuZTpsLnQuZnxwLmM6I2ZmNjE2MTYxLHMudDo0fHAudjpvZmYscy50OjR8cy5lOmwudC5mfHAuYzojZmY3NTc1NzUscy50OjZ8cC52Om9mZixzLnQ6NnxzLmU6Z3xwLmM6I2ZmMDAwMDAwLHMudDo2fHMuZTpsLnR8cC52Om9mZixzLnQ6NnxzLmU6bC50LmZ8cC5jOiNmZjNkM2QzZA!4e0&token=52457';
var omtCountryLabelUrl = gEarthTime.rootTilePath + "/labels/dark-map-country-labels/{default}/{z}/{x}/{y}.png";
var googleMapsCityLabelUrl = 'https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i397094607!3m14!2sen-US!3sUS!5e18!12m1!1e68!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2zcy50OjV8cC52Om9mZixzLnQ6MnxwLnY6b2ZmLHMudDozfHAudjpvZmYscy50OjN8cy5lOmx8cC52Om9mZixzLnQ6NHxwLnY6b2ZmLHMudDo2fHAudjpvZmY!4e0!5m1!5f2&token=118514';

var lightMapUrl;
if (customLightMapUrlOrId.indexOf("http") == 0) {
  lightMapUrl = customLightMapUrl;
} else if (useGoogleMaps) {
  lightMapUrl = googleMapsDefaultRetinaUrl;
} else if (useRetinaLightNoLabelsBaseMap) {
  lightMapUrl = omtLightRetinaNoLabelsUrl;
} else if (useRetinaLightBaseMap) {
  lightMapUrl = omtLightRetinaUrl;
} else {
  lightMapUrl = omtLightUrl;
}

var darkMapUrl;
if (customDarkMapUrlOrId.indexOf("http") == 0) {
  darkMapUrl = customDarkMapUrl;
} else if (useGoogleMaps) {
  darkMapUrl = googleMapsDarkStyleRetinaUrl;
} else if (useRetinaDarkNoLabelsBaseMap) {
  darkMapUrl = omtDarkRetinaNoLabelsUrl;
} else if (useRetinaDarkBaseMap) {
  darkMapUrl = omtDarkRetinaUrl;
} else {
  darkMapUrl = omtDarkUrl;
}

var countryLabelMapUrl = useGoogleMaps ? googleMapsCountryLabelUrl : omtCountryLabelUrl;
var cityLabelMapUrl = useGoogleMaps ? googleMapsCityLabelUrl : googleMapsCityLabelUrl;

// var lightsAtNightUrl = rootTilePath + "/lights-at-night/{default}/{z}/{x}/{y}.png";
// TODO: Change to rootTilePath once it is uploaded to Google Storage
// var lightsAtNightAnimUrl = "https://tiles.earthtime.org/lan-anim.timemachine/crf18-4fps-1424x800";
// Note that x/y are swapped for these two lights at night data sets
// var lightsAtNight2012Url = rootTilePath + "/lights-at-night-2012/{default}/{z}/{y}/{x}.jpg";
//var lightsAtNight2016Url = rootTilePath + "/lights-at-night-2016/{default}/{z}/{y}/{x}.jpg";
// var waterOccurrenceUrl = rootTilePath + "/water/occurrence_2018/{default}/{z}/{x}/{y}.png";
// var waterChangeUrl = rootTilePath + "/water/change_2018/{default}/{z}/{x}/{y}.png";

//var viirsUrl = rootTilePath + "/viirs/viirs_20140817-20170917.bin";

//var usgsWindTurbineUrl = rootTilePath + "/energy/wind-installs-usgs/{z}/{x}/{y}.bin";
//var solarInstallsUrl = rootTilePath + "/energy/solar-installs/{z}/{x}/{y}.bin";
//var globalWindPowerUrl = rootTilePath + "/energy/global-wind-power/windfarms-world_20180330.bin";
//var drillingUrl = rootTilePath + "/energy/drilling/{z}/{x}/{y}.bin";
// var vsiUrl = rootTilePath + "/vsi/tiles/{default}/{z}/{x}/{y}.png";
var healthImpactUrl = gEarthTime.rootTilePath + "/health-impact/{z}/{x}/{y}.bin";
//var zikaUrl = rootTilePath + "/pandemics/zika/{z}/{x}/{y}.bin";
//var dengueUrl = rootTilePath + "/pandemics/dengue/{z}/{x}/{y}.bin";
//var chikuUrl = rootTilePath + "/pandemics/chiku/{z}/{x}/{y}.bin";

//var urbanFragilityUrl = rootTilePath + "/urban-fragility/{z}/{x}/{y}.bin";
//var gtdUrl = rootTilePath + "/gtd/{z}/{x}/{y}.bin";
//var hivUrl = rootTilePath + "/hiv/{z}/{x}/{y}.bin";
//var obesityUrl = rootTilePath + "/obesity/{z}/{x}/{y}.geojson";
//var vaccineConfidenceUrl = rootTilePath + "/vaccine-confidence/{z}/{x}/{y}.geojson";
//var ebolaDeathsUrl = rootTilePath + "/ebola/deaths/{z}/{x}/{y}.bin";
//var ebolaCasesUrl = rootTilePath + "/ebola/cases/{z}/{x}/{y}.bin";
//var ebolaNewCasesUrl = rootTilePath + "/ebola/new-cases/{z}/{x}/{y}.bin";

var landBorderUrl = gEarthTime.rootTilePath + "/land-borders2/{default}/{z}/{x}/{y}.png";

//var uppsalaConflictUrl = rootTilePath + "/ucdp/uppsala-conflict.bin";

//var omiNo2Url = rootTilePath + "/omi-no2/omi-no2.timemachine/crf24-12fps-1424x800";

//var bePm25Url = rootTilePath + "/be-pm25/be-pm25.timemachine/crf24-22fps-1424x800";

//var expandingCitiesUrl = rootTilePath + "/expandingCities/expandingCities.bin";

//var irenaSolarUrl = 'https://data.cmucreatelab.org/earthtime/IRENA/Solar.Electricity_capacity_MW.csv';
//var irenaWindUrl = 'https://data.cmucreatelab.org/earthtime/IRENA/Wind.Electricity_capacity_MW.csv';

//var tsipUrl = rootTilePath + "/tsip/tsip.bin";

//var ecco2Url = rootTilePath + "/oceans/ecco2.timemachine/crf26-16fps-1424x800";

//var gfsTimemachineUrl = rootTilePath + "/gfs-timemachine.timemachine/crf24-12fps-1424x800";

//var chlorophyllConcentrationTimemachineUrl = rootTilePath + "/chlorophyll_concentration.timemachine/crf24-12fps-1424x800";

function isEarthTimeLoaded() {
  if (showCustomDotmaps && !dotmapLayersInitialized) {
    return false;
  } else if (showCsvLayers && !csvFileLayersInitialized) {
    return false;
  } else if (showStories && !storiesInitialized) {
    return false;
  } else if (!timeMachinePlayerInitialized) {
    return false;
  }
  return true;
}


// TODO(LayerDB).  Paul, I'm removing ajax includes on the guess we have or are planning to move this metadata out of the source code
//     and either load from tm.json/r.json or the layer definition
// (The callback to init is moved to the end of this file)
// $.getScript(landsatAjaxIncludesPath)
//   .done(function(script, status) {
//     eval(script);
//     $(init);
//   }
// );

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

// Wait until currrent execution finishes so that we can skip loading the timeline in case it is not the last call.
// We do this because the timeline loads asynchronously; otherwise, the next waypoint might use the wrong timeline.
var finalizeNewTimelineTimeout = null;

function requestNewTimeline(url, newTimelineStyle) {
  // The last timeline request takes precedence
  if (finalizeNewTimelineTimeout !== null) {
    clearTimeout(finalizeNewTimelineTimeout);
    finalizeNewTimelineTimeout = null;
  }
  finalizeNewTimelineTimeout = setTimeout(function() {
    gEarthTime.timelapse.loadNewTimeline(url, newTimelineStyle);
    finalizeNewTimelineTimeout = null;
  }, 0);
}

function cacheLastUsedLayer(layer) {
  var cacheIdx = lastActiveLayers.indexOf(layer);

  if (cacheIdx >= 0) {
    lastActiveLayers.push(lastActiveLayers.splice(cacheIdx, 1)[0]);
  } else {
    if (lastActiveLayers.length == maxCachedLayers) {
      lastActiveLayers.shift().destroy();
    }

    // May not do anything if tiles have all loaded for this layer or have been deleted
    layer.abortLoading();

    var tiles = Object.keys(layer.getTiles());

    if (tiles && tiles.length > 0) {
      lastActiveLayers.push(layer);
    }
  }
}

async function handleLayers(layers: string[]) {
  await gEarthTime.layerDBPromise;
  var layerProxies = [];

  for (var layerId of layers) {
    if (layerId.indexOf("extras_") == 0 || layerId.indexOf("e-") == 0) {
      let $extra = $('#extras-selector-menu li[data-name="' + layerId + '"]');
      if ($extra.length) {
        $extra.trigger("click");
      }
    }
    var layerProxy = gEarthTime.layerDB.getLayer(layerId);
    if (layerProxy) {
      layerProxies.push(layerProxy);
    } else {
      console.log(`${Utils.logPrefix()} handlelayers: Cannot find layer ${layerId}`);
    }

  }
  console.log(`${Utils.logPrefix()} handleLayers; calling setVisibleLayers`);
  gEarthTime.layerDB.setVisibleLayers(layerProxies);
}

function initLayerToggleUI() {
  // ## 3 ##
  //// Layer toggle event handlers ////

  // Base layers
  $("input:radio[name=base-layers]").on("click", function() {
    previousVisibleBaseMapLayer = visibleBaseMapLayer;
    visibleBaseMapLayer = String($(this).val());
    if (visibleBaseMapLayer == "blsat") {
      $("#baselayerCreditText").html("&copy; Google");
    } else if (visibleBaseMapLayer == "blte") {
      if (customLightMapUrlOrId && customLightMapUrlOrId.indexOf("http") != 0) {
        $("#baselayerCreditText").html("&copy; " + gEarthTime.layerDB.getLayer(customDarkMapUrlOrId).layer?.credit);
      } else if (useGoogleMaps) {
        $("#baselayerCreditText").html("&copy; Google");
        //$("#baselayerCreditText").html("&copy; Google (Dashed gray line indicates disputed borders)");
      } else {
        $("#baselayerCreditText").html("&copy; OpenMapTiles, &copy; OpenStreetMap");
      }
    } else if (visibleBaseMapLayer == "bdrk") {
      if (customDarkMapUrlOrId && customDarkMapUrlOrId.indexOf("http") != 0) {
        $("#baselayerCreditText").html("&copy; " + gEarthTime.layerDB.getLayer(customDarkMapUrlOrId).layer?.credit);
      } else if (useGoogleMaps) {
        $("#baselayerCreditText").html("&copy; Google");
        //$("#baselayerCreditText").html("&copy; Google (Dashed gray line indicates disputed borders)");
      } else {
        $("#baselayerCreditText").html("&copy; OpenMapTiles, &copy; OpenStreetMap");
      }
    }
  });

  // Copy over data attributes to selectmenu
  $.widget("ui.selectmenu", $.ui.selectmenu, {
    _renderItem: function(ul, item) {
      var elementdata = item.element[0].dataset;
      var attributesObj = {};
      Object.keys(elementdata).forEach(function(x) {
        attributesObj["data-" + x] = elementdata[x];
      });
      // TODO: If we want to support jQueryUI > 1.11.x then we need to
      // append a div to the <li>, like so: .append("<div>")
      return $('<li>')
        .attr(attributesObj)
        .append(item.label)
        .appendTo(ul);
    }
  });

  var appendTarget = "#timeMachine";
  if (enableLetterboxMode) {
    appendTarget = "#letterbox-content";
  }
  $("#extras-selector").selectmenu({
    close: function() {
      $lastSelectedExtra = null;
    },
    position: {
      at: "left top",
      collision: 'flip',
      using: function(coords, feedback) {
        // Using 'flip' above, we ensure that the menu either draws up or down, depending upon how much space we have.
        // Then we place the default select option at either the begining or end based on this direction.
        $("#extras-selector option[id='default-extras-select']").remove();
        $(this).css({
          top: coords.top,
          left: coords.left
        });
        var initialEntry = '<option id="default-extras-select" selected="selected" value="select">Select extra content...</option>';
        if (feedback.vertical == "top") {
          $("#extras-selector").prepend(initialEntry);
        } else {
          $("#extras-selector").append(initialEntry);
        }
        $("#extras-selector").selectmenu("refresh");
      }
    },
    appendTo: appendTarget
  });

  // Use click event rather than selectmenu 'change' since that event is not registered on the touch screen.
  $(".ui-selectmenu-menu").on("click", "li", function(e) {
    $lastSelectedExtra = $(e.currentTarget);

    gEarthTime.timelapse.addParabolicMotionStoppedListener(autoModeExtrasViewChangeHandler);

    var relativePath = "../../../extras/";
    var filePath = relativePath + $lastSelectedExtra.data("filepath");
    var fileType = $lastSelectedExtra.data("type");
    var playbackRate = parseFloat($lastSelectedExtra.data("playbackrate")) || 1;
    var extrasName = $lastSelectedExtra.data("name");
    var loopVideoPlayback = $lastSelectedExtra.data("loop");
    var muteVideoAudio = $lastSelectedExtra.data("muted");
    var enableVideoPlaybackControls = $lastSelectedExtra.data("controls");
    var objectFit = $lastSelectedExtra.data("objectfit");

    if (enableLetterboxMode) {
      $(".extras-content-dialog").addClass("letterbox");
    }
    if (disableUI) {
      // Fit to window, without title bar
      $(".extras-content-dialog .ui-dialog-titlebar").hide();
      $("#extras-content-container").addClass("storyFriendlyDialog");
    } else if (extrasName.indexOf("_storyFriendlyDialog_") > 0 && $(".presentationSlider").is(":visible")) {
      // Fit to window, without title bar and minus height of waypoint slider
      $(".extras-content-dialog .ui-dialog-titlebar").hide();
      $("#extras-content-container, .extras-content-dialog").addClass("storyFriendlyDialog");
    } else {
      // Fit to window, keep title bar
      $("#extras-content-container, .extras-content-dialog").removeClass("storyFriendlyDialog");
      $("#extras-content-container").dialog('option', 'title', $lastSelectedExtra.text());
    }

    var $extrasHtml = "";
    if (fileType == "image") {
      $extrasHtml = '<img id="extras-image" src="' + filePath + '">';
      $("#extras-content-container").html($extrasHtml).dialog("open");
    } else if (fileType == "video") {
      $extrasHtml = '<video id="extras-video" autoplay></video>';
      $("#extras-content-container").html($extrasHtml).dialog("open");
      var $video = $("#extras-video");
      var video = $video[0] as HTMLVideoElement;
      if (loopVideoPlayback) {
        video.loop = true;
      }
      if (muteVideoAudio) {
        video.muted = true;
      }
      // @ts-ignore
      $video.gVideo({
        childtheme: 'smalldark'
      });
      if (!enableVideoPlaybackControls) {
        $(".ghinda-video-controls").remove();
      }
      if (!gEarthTime.timelapse.isMovingToWaypoint()) {
        $video.one("loadstart", autoModeExtrasViewChangeHandler);
      }
      video.src = filePath;
      // Must set playbackRate *after* setting the file path
      video.playbackRate = playbackRate;
    } else if (fileType == "iframe") {
      // If the extra is an iframe, then the URL can be absolute
      var re = new RegExp("^(http|https)://", "i");
      var match = re.test($lastSelectedExtra.data("filepath"));
      if (match) {
        filePath = $lastSelectedExtra.data("filepath");
      }
      $extrasHtml = '<iframe id="extras-iframe" src="' + filePath + '" scrolling="no"></iframe>';
      $("#extras-content-container").html($extrasHtml).dialog("open");
    } else if (fileType == "link") {
      window.location.href = filePath;
    }

    if (objectFit == "contain") {
      $("#extras-image, #extras-video").css("object-fit", "contain");
    }

    // TODO: Remove this now that we pass this in via the spreadsheet metadata
    if (extrasName.indexOf("_letterBoxFit_") > 0) {
      $("#extras-image, #extras-video").css("object-fit", "contain");
    }

  });

  $("#extras-content-container").dialog({
    appendTo: "#timeMachine",
    modal: false,
    autoOpen: false,
    draggable: false,
    resizable: false,
    dialogClass: "extras-content-dialog",
    open: function(event, ui) {
      $("#timeMachine").removeClass("presentationSliderSelection presentationSliderSelectionOverflow");
    },
    close: function(event, ui) {
      $lastSelectedExtra = null;
      gEarthTime.timelapse.removeParabolicMotionStoppedListener(autoModeExtrasViewChangeHandler);
    },
    beforeClose: function(event, ui) {
      var $extrasVideo = $("#extras-video");
      if ($extrasVideo && $extrasVideo[0]) {
        var extrasVideo = $extrasVideo[0] as HTMLVideoElement;
        extrasVideo.pause();
        extrasVideo.src = "";
        extrasVideo.removeEventListener("loadstart", autoModeExtrasViewChangeHandler);
      }
      $("#extras-selector").val("select").selectmenu("refresh");
    }
  }).css({
    'z-index': '2000',
    'left': '0px',
    'top': '0px'
  });

  $(document).keydown(function(e) {
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
      var openCategories = $("h3.ui-accordion-header.ui-state-active");
      var availableCategories = $(".map-layer-div").children("h3");
      $.each(openCategories, function(index, value) {
        if (index == 0) return;
        var openIndex = availableCategories.index(openCategories[index]);
        $(".map-layer-div").accordion("option", "active", openIndex);
      });
      if ($(".current-location-text-container").is(":visible")) {
        showAnnotationResumeExit();
      }
      $(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight").removeClass("thumbnail_highlight");
      $("#extras-content-container").dialog("close");
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
      if ($lastSelectedExtra) {
        $lastSelectedExtra.prev().click();
      } else {
        var $newActiveTopic = $(document.activeElement).closest($(".ui-accordion-content")) as JQuery<HTMLElement>;
        $lastActiveLayerTopic = $newActiveTopic.length ? $newActiveTopic : $lastActiveLayerTopic;
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
    }
    // down arrow
    // Quick way to toggle between the various items whether under the extras menu (if just selected) or a layer
    if (e.keyCode === 40) {
      if ($lastSelectedExtra) {
        $lastSelectedExtra.next().click();
      } else {
        var $newActiveTopic = $(document.activeElement).closest($(".ui-accordion-content")) as JQuery<HTMLElement>;
        $lastActiveLayerTopic = $newActiveTopic.length ? $newActiveTopic : $lastActiveLayerTopic;
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
        $(".share").trigger("click");
      }
      // SHIFT + J
      // Shortcut to bring up settings dialog
      if (keysDown[0] === 16 && keysDown[1] === 74) {
        showSettingsDialog();
      }
    }
  }).keyup(function(e) {
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

  timelineUIHandler = function(e) {
    var $toggledLayerElm = $(e.target);
    var toggledLayerId = $toggledLayerElm.parent("label").attr("name");

    let layersToBeDrawn = Array.from(gEarthTime.layerDB.visibleLayers);
    let clickedLayer = gEarthTime.layerDB.getLayer(toggledLayerId);
    if ($toggledLayerElm.prop("checked")) {
      layersToBeDrawn.push(clickedLayer);
      console.log(`${Utils.logPrefix()} timelineUIHandler checked; calling setVisibleLayers`);
      gEarthTime.layerDB.setVisibleLayers(layersToBeDrawn);
    } else {
      console.log(`${Utils.logPrefix()} timelineUIHandler not checked; calling setVisibleLayers`);
      layersToBeDrawn.splice(layersToBeDrawn.indexOf(clickedLayer), 1);
      gEarthTime.layerDB.setVisibleLayers(layersToBeDrawn);
    }

    return;
    // var toggledLayer = $(e.target);
    // var toggledLayerId = toggledLayer.parent("label").attr("name");

    // if (toggledLayerId) {
    //   if (toggledLayer.attr('type') == 'radio') {
    //     var toggledLayerGroup = $('input[name=' + toggledLayer.attr("name") + ']');
    //     toggledLayerGroup.each(function(idx, element) {
    //       var tmp = $(element).parent("label").attr("name");
    //       var activeLayerIdx = activeEarthTimeLayers.indexOf(tmp);
    //       if (activeLayerIdx >= 0) {
    //         activeEarthTimeLayers.splice(activeLayerIdx, 1);
    //       }
    //     });
    //     activeEarthTimeLayers.push(toggledLayerId);
    //   } else if (toggledLayer.prop("checked")) {
    //     activeEarthTimeLayers.push(toggledLayerId);
    //   } else {
    //     var activeLayerIdx = activeEarthTimeLayers.indexOf(toggledLayerId);
    //     if (activeLayerIdx >= 0) {
    //       activeEarthTimeLayers.splice(activeLayerIdx, 1);
    //     }
    //     if (activeEarthTimeLayers.length == 0) {
    //       doSwitchToLandsat();
    //     } else if (activeEarthTimeLayers.length == 1 && activeEarthTimeLayers.indexOf("blsat") == 0) {
    //       doSwitchToLandsat();
    //     }
    //   }
    // }

    // dateRangePicker.handleCalendarLayers(false);
    // altitudeSlider.handleAltitudeLayers();

    // var $layerContainer = $(e.target).parents("table");
    // var $layerContainerHeader = $layerContainer.prev();
    // var layerCategory = $layerContainerHeader.attr("aria-controls")
    // if (layerCategory) {
    //   layerCategory = layerCategory.replace('-featured', '');
    // }
    // var ignoredLayerCategory = 'category-base-layers';
    // var numLayersActiveInCurrentContainer = $layerContainer.find("input:checked").length;
    // var layersListTopPos = featuredTheme ? $("#layers-list").position().top : 0;
    // // Note: >1 because we ignore Base layers
    // if ($('.map-layer-div').find("input:checked").length > 1) {
    //   $(".clearLayers").show();
    // } else {
    //   $(".clearLayers").hide();
    // }

    // // Add indicator that a layer is on in a category but ignore the first category (base layers)
    // if ($layerContainerHeader.length && layerCategory && layerCategory.indexOf(ignoredLayerCategory) == -1) {
    //   // Note the plural because we have a featured section of layers that uses the same names
    //   var $layerContainerHeaders = $("#layers-menu h3[aria-controls*='" + layerCategory + "']");
    //   if (numLayersActiveInCurrentContainer > 0) {
    //     $layerContainerHeaders.append("<span class='ui-icon ui-icon-bullet active-layers-in-category'>");
    //   } else {
    //     $layerContainerHeaders.find(".active-layers-in-category").remove();
    //   }
    // }

    // var isFromUser = true;

    // if ($(".csvlayer").find("input:checked").length > 0) {
    //   timelineType = "defaultUI";
    // }

    // // Hide any timelines that are visible if we have no layers up that require a timeline or we are a static layer that fully covers the entire globe
    // if (activeLayersWithTimeline <= 0 || (visibleBaseMapLayer == "blsat" && activeLayersWithTimeline == 1 && (showHansenLayer2))) {
    //   $(".controls, .customControl").hide();
    //   $(".customControl").hide();
    // } else if (activeLayersWithTimeline > 0) {
    //   if (timelineType == "customUI") {
    //     $(".controls, .captureTime").hide();
    //     $(".customControl").show();
    //   } else if (timelineType == "defaultUI") {
    //     $(".customControl").hide();
    //     $(".controls, .captureTime").show();
    //   }
    // }

    // if (e && e.originalEvent) {
    //   var originalEvent = e.originalEvent;
    //   // If true, event came from user interaction, otherwise it came from javascript
    //   if (!originalEvent.isTrusted)
    //     isFromUser = false;
    //   // Browsers without isTrusted property
    //   if (originalEvent.x == 0 && originalEvent.y == 0)
    //     isFromUser = false;
    //   // IE 11
    //   if (originalEvent.isTrusted && (originalEvent.x == 0 && originalEvent.y == -55))
    //     isFromUser = false;
    // }

    // if ((activeLayersWithTimeline >= 1 && visibleBaseMapLayer != "blsat") ||
    //     (activeLayersWithTimeline == 1 && visibleBaseMapLayer == "blsat" && !(showHansenLayer2))) {
    //   if (timelineType == "customUI") {
    //     $(".customControl").show().children().show();
    //   } else if (timelineType == "defaultUI") {
    //     $(".controls, .captureTime").show();
    //   }
    // }

    // if (isFromUser && visibleBaseMapLayer != "blsat" && activeLayersWithTimeline == 0) {
    //   $(".customControl").hide();
    // }

    // if (timelineType != "none" && activeLayersWithTimeline == 0) {
    //   timelineType = "none";
    // }

    // if (activeLayersWithTimeline <= 1 && timelineType == "none") {
    //   $(".current-location-text-container, .annotations-resume-exit-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").addClass("noTimeline");
    // } else {
    //   $(".current-location-text-container, .annotations-resume-exit-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").removeClass("noTimeline");
    // }

    // if (timelineType == "defaultUI" && visibleBaseMapLayer == "blsat" && activeLayersWithTimeline == 1 && $(".csvlayer").find("input:checked").length == 0) {
    //   timelineType = "customUI";
    // }

    // timelineHidden = $(".noTimeline").length != 0;
  };

  $('#layers-menu').on('click', "input[type=checkbox], input[type=radio]", timelineUIHandler);

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

  gEarthTime.timelapse.addTimelineUIChangeListener(function() {
    if (visibleBaseMapLayer != "blsat" && activeLayersWithTimeline == 0) {
      $(".customControl").hide();
    }
  });

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

function setActiveLayersWithTimeline(modifier) {
  previousActiveLayersWithTimeline = activeLayersWithTimeline;
  activeLayersWithTimeline += modifier;
  if (activeLayersWithTimeline < 0) activeLayersWithTimeline = 0;
}

function doSwitchToLandsat() {
  // Special case for layers with defaultUI timeline.
  // if (timelineType == "defaultUI" && showMonthlyRefugeesLayer) {
  //   return false;
  // } else {
  previousVisibleBaseMapLayer = visibleBaseMapLayer;
  timelineType = "customUI";
  $("#layers-list #blsat-base").click();
  if (activeLayersWithTimeline <= 0) {
    setActiveLayersWithTimeline(1);
  }
  requestNewTimeline(cachedLandsatTimeJsonPath, "customUI");
  gEarthTime.timelapse.setMasterPlaybackRate(1);
  gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
  gEarthTime.timelapse.setDwellTimes(1.5, 1.5);
  gEarthTime.timelapse.setDoDwell(true);
  // @ts-ignore
  WebGLVideoTile.useGreenScreen = false;
  var v = gEarthTime.timelapse.getVideoset();
  v.setFps(10);
  return true;
  //}
}


//////////////////////////////////////////////////////////


// BEGIN WebGL vars
var gl;

// ## 4 ##
//// Layer visibility ////
//

var showCountryLabelMapLayer = false;

// Default Time Machine visibility
var tileViewVisibility = {
  videoTile: true,
  vectorTile: false
};

var waypointsLoadedPath;
var csvDataGrapher = new CsvDataGrapher(gEarthTime);
var dateRangePicker = new DateRangePicker(gEarthTime);
var altitudeSlider = new AltitudeSlider(gEarthTime);
var contentSearch = new ContentSearch();
var dotmapLayers = [];
var dotmapLayerByName = {};
var dotlayersLoadedPath;
var csvlayersLoadedPath;
var waypointJSONListReadyInterval;
var waitToLoadWaypointLayersOnPageReadyInterval;
var timelineUIChangeListeners = [];

function modifyWaypointSliderContent(keyframes, theme, story) {
  // TODO: Check state of this code
  return;
  annotationPicturePaths[theme][story] = {};
  for (var i = 0; i < keyframes.length; i++) {
    var keyframe = keyframes[i];
    // TODO: Force to only work with absolute image paths. One day we can figure out how to support paths from the internet without the wrath of trolls.
    var annotationPicturePath = keyframe.unsafe_string_annotationPicPath && keyframe.unsafe_string_annotationPicPath.indexOf("thumbnails/") == 0 ? keyframe.unsafe_string_annotationPicPath : undefined;
    annotationPicturePaths[theme][story][i] = { path : annotationPicturePath };
    // Sections in the spreadsheet to jump to are flagged by having the title start with a #
    if (keyframe.unsafe_string_frameTitle.indexOf("#") == 0) {
      keyframe.unsafe_string_frameTitle = keyframe.unsafe_string_frameTitle.slice(1);
    }
  }
}

function loadWaypointSliderContentFromCSV(csvdata) {
  var parsed = Papa.parse(csvdata, {delimiter: '\t', header: true});
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
        var thumbnailURL = gEarthTime.timelapse.getThumbnailOfView(stories[storyId].mainShareView, 128, 74, false) || "https://placehold.it/128x74";
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
    // Even older legacy case where we load only a single set of waypoints, no theme ever designated
    currentWaypointTheme = "default";
    currentWaypointStory = "default";
    // TODO(LayerDB) Paul: I disabled this because CSVToJSON was undefined and need help fixing this
    if (false) {
      var waypointJSON = JSON.parse(snaplapseForPresentationSlider.CSVToJSON(waypointdefs));
      modifyWaypointSliderContent(waypointJSON.snaplapse.keyframes, currentWaypointTheme, currentWaypointStory);
      currentWaypointSliderContentUrl = snaplapseForPresentationSlider.getAsUrlString(waypointJSON.snaplapse.keyframes);
      var waypointSliderContent = "#presentation=" + currentWaypointSliderContentUrl;
      gEarthTime.timelapse.loadSharedDataFromUnsafeURL(waypointSliderContent);
    }
  }
  sortThemes();
  if (enableLetterboxMode) {
    updateLetterboxContent();
  }
  storiesInitialized = true;
}

function loadWaypoints(path) {
  if (path == waypointsLoadedPath) return;
  waypointsLoadedPath = path;

  // Keep track of spreadsheet path
  UTIL.addGoogleAnalyticEvent('javascript', 'load-waypoints', 'spreadsheet-path=' + path);

  // Legacy waypoint format (output of snaplapse editor)
  if (waypointCollection) {
    gEarthTime.timelapse.loadSharedDataFromUnsafeURL(waypointCollection);
    storiesInitialized = true;
  } else {
    UTIL.loadTsvData(path, loadWaypointSliderContentFromCSV, this);
  }
}


function populateLayerLibrary() {
  let layer_html = "";
  layer_html += '<ul id="layers-list">';
  layer_html += '  <div id="all-data-layers-title">All Data</div>';
  layer_html += '    <div class="layers-scroll-vertical">';
  layer_html += '      <div class="map-layer-div map-layer-checkbox">';

  let layersByCategory = {};
  for (let layer of gEarthTime.layerDB.orderedLayers) {
    if (!layersByCategory[layer.category]) {
      layersByCategory[layer.category] = [];
    }
    layersByCategory[layer.category].push({id: layer.id, name: layer.name});
  }

  let categories = Object.keys(layersByCategory);
  for (let category of categories) {
    let categoryId = "category-" + category.trim().replace(/ /g,"-").replace(/^[^a-zA-Z]+|[^\w-]+/g, "_").toLowerCase();
    let categoryLayers = layersByCategory[category];
    layer_html += `<h3>${category}</h3>`;
    layer_html += `<table id="${categoryId}">`;
    categoryLayers.forEach(function(layer) {
      layer_html += `<tr><td><label name="${layer.id}"><input type="checkbox" id="${layer.id}">${layer.name}</label></td></tr>`;
    });
    layer_html += "</table>";
  }
  layer_html += '      </div>';
  layer_html += '    </div>';
  layer_html += '  <div class="clearLayers"></div>';
  layer_html += '</ul>';

  $(layer_html).appendTo($("#layers-menu"));

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


  // initialize WebGL
  gl = gEarthTime.canvasLayer.canvas.getContext('experimental-webgl',  {antialias: false, alpha: true, stencil: true, depth: true, failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: preserveDrawingBuffer});
  (window as any).gl = gl; // TODO(LayerDB): someday stop using this global

  gEarthTime.glb = new Glb(gl);
  (window as any).glb = gEarthTime.glb; // TODO(LayerDB): someday stop using this global

  var layer_html = '';

  // Extras menu
  layer_html += '<div class="extras-selector-div">';
  layer_html += ' <select name="extras-selector" id="extras-selector">';
  layer_html += '   <option id="default-extras-select" selected="selected" value="select">Select extra content...</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="AirVisualEarth.mp4" data-name="e-AirVisualEarth">AirVisual Earth</option>';
  layer_html += '   <option data-playback-rate="2" data-type="video" data-file-path="pumphandle_2014.mp4" data-name="e-pumphandle">Measured CO2 Over Time</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="Carbon Dioxide 2006 GEOS-5 model.mp4" data-name="e-geos5model">CO2 2006 GEOS-5 Model</option>';
  layer_html += '   <option data-playback-rate="2" data-type="video" data-file-path="Land + Ocean Average Temperature Annual Anomaly.mp4" data-name="e-tempanomaly">Temperature Anomaly 1850-2013</option>';
  layer_html += '   <option data-playback-rate="0.5" data-type="video" data-file-path="berkeley-earth.mp4" data-name="e-tempanomaly2">Temperature Anomaly 1850-2015</option>';
  layer_html += '   <option data-playback-rate="2" data-type="video" data-file-path="Arctic ice age, 1987-2014.mp4" data-name="e-icethinning">Ice Thinning 1987-2014</option>';
  layer_html += '   <option data-playback-rate="2" data-type="video" data-file-path="Larsen-B-Collapse.mp4" data-name="e-larsenb">Larsen-B Collapse</option>';
  layer_html += '   <option data-playback-rate="4" data-type="video" data-file-path="Orbiting Carbon Observatory.mp4" data-name="e-oco">Orbiting Carbon Observatory</option>';
  layer_html += '   <option data-playback-rate="2" data-type="video" data-file-path="Arctic Sea Ice, September 1979 to September 2014.mp4" data-name="e-seaice">Sea Ice Concentration 1979-2014</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="coral-reef-watch-daily-7day-max.mp4" data-name="e-crw">Coral Reef Watch 2013-2015</option>';
  layer_html += '   <option data-playback-rate="0.5" data-type="video" data-file-path="merra-spi.mp4" data-name="e-spi">Standardized Precipitation Index 1980-2015</option>';
  layer_html += '   <option data-type="iframe" data-file-path="http://choices.climatecentral.org/widget.html?utm_source=Davos&utm_medium=embed&utm_campaign=SSMC-Map#11/31.2301/121.4736?compare=temperatures&carbon-end-yr=2100&scenario-a=warming-4&scenario-b=warming-2&presentation=1" data-name="e-shanghaisealevel">Shanghai Sea Level</option>';
  layer_html += '   <option data-type="img" data-file-path="land-and-ocean-temps.png" data-name="e-hottestyear2015">2015: Hottest Year on Record</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="refugee_camps.mp4" data-name="e-refugeesmosul">Refugee Camps Outside Mosul</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="iraq_smoke.mp4" data-name="e-oilmosul">Qayyarah Oil Field South of Mosul</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="sugarcane_plantations.mp4" data-name="e-sugarcane">Sugarcane Plantation in Bolivia</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="cepi.mp4" data-name="e-cepi">Coalition for Epidemic Prepardness Innovations</option>';
  layer_html += '   <option data-playback-rate="1.5" data-type="video" data-file-path="temp-anomaly.mp4" data-name="e-tempanomaly3">Temperature Anomaly 1970-2016</option>';
  layer_html += '   <option data-type="img" data-file-path="water-synergies-p1.png" data-name="e-watersynergies">Water Synergies Pt1</option>';
  layer_html += '   <option data-type="img" data-file-path="water-synergies-p2.png" data-name="e-watersynergies2">Water Synergies Pt2</option>';
  layer_html += '   <option data-type="img" data-file-path="altered-river-flow.png" data-name="e-riverflow">Altered River Flow</option>';
  layer_html += '   <option data-type="img" data-file-path="solar-with-legend.png" data-name="e-globalatlas">Global Atlas for Renewable Energy</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="smog_tower_pm_animation.mp4" data-name="e-smogtoweranim">Smog Tower PM10 Animation</option>';
  layer_html += '   <option data-type="img" data-file-path="smog_tower_pm_reduction.png" data-name="e-smogtowerpm10">Smog Tower PM10 Reduction</option>';
  layer_html += '   <option data-type="img" data-file-path="smog_free_tower_tianjin.jpg" data-name="e-smogtowertianjin">Smog Free Tower Tianjin</option>';
  layer_html += '   <option data-type="img" data-file-path="smog_free_tower_dalian.jpeg" data-name="e-smogtowerdalian">Smog Free Tower Dalian</option>';
  layer_html += '   <option data-type="img" data-file-path="Outbound FDI by Sector Geo.jpg" data-name="e-fdi">Outbound FDI by Sector Geo</option>';
  layer_html += '   <option data-type="img" data-file-path="BRI-mapping.jpg" data-name="e-bri">BRI Mapping</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="global_and_european_fisheries_map.mp4" data-name="e-globalfishmap">Global and European Fisheries Map</option>';
  layer_html += '   <option data-type="img" data-file-path="nation-states.jpg" data-name="e-nationstates">Nation States</option>';
  layer_html += '   <option data-type="img" data-file-path="Doughnut-classic.png" data-name="e-doughnut_classic">Doughnut Classic</option>';
  layer_html += '   <option data-type="img" data-file-path="Doughnut-transgressing.png" data-name="e-doughnut_transgressing">Doughnut Transgressing</option>';
  layer_html += '   <option data-type="img" data-file-path="Trade Openness.png" data-name="e-tradeopenness">Trade Openness</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="Global Cyber Centre.mp4" data-name="e-globalcyber">Global Cyber Centre</option>';
  if (showGFW)
    layer_html += '   <option data-type="iframe" data-file-path="http://localhost:8081/index.html?workspace=https://api-dot-skytruth-pleuston.appspot.com/v1/workspaces/udw-v1-4a79e843-9e84-4c02-a903-f49c4d0ebc0c" data-name="e-gfw">Global Fishing Watch</option>';
  layer_html += '   <optgroup label="World Economic Forum - Davos 2016">';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The Climate Crisis with Naomi Oreskes and Achim Steiner.mp4" data-name="e-davos16climate1">Climate Crisis with Naomi Oreskes and Achim Steiner</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The Climate Crisis with Naomi Oreskes and Nicholas Stern.mp4" data-name="e-davos16climate2">Climate Crisis with Naomi Oreskes and Nicholas Stern</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The Future of Forests with Matthew Hansen and Andrew Steer.mp4" data-name="e-davos16forests1">Future of Forests with Matthew Hansen and Andrew Steer</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The Industrialization Impasse with Ricardo Hausmann and Illah Nourbakhsh.mp4 data-name="e-davos16industrial1"">Industrialization Impasse with Ricardo Hausmann and Illah Nourbakhsh</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The Race for Resources with Ellen MacArthur and Randy Sargent.mp4" data-name="e-davos16resources1">Race for Resources with Ellen MacArthur and Randy Sargent</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The Race for Resources with William McDonough and Randy Sargent.mp4" data-name="e-davos16resources2">Race for Resources with William McDonough and Randy Sargent</option>';
  layer_html += '   <option data-playback-rate="1" data-type="video" data-file-path="WEF/The War on Water with Johan Rockstrom and Randy Sargent.mp4" data-name="e-davos16water1">War on Water with Johan Rockstrom and Randy Sargent</option>';
  layer_html += '   </optgroup>';
  layer_html += ' </select>';
  layer_html += '</div>';

  // Create clear selected layer(s) button
  //layer_html += '<div class="clearLayers"></div>';


  // Legend content
  var legend_html = '<div id="layers-legend">';
  legend_html += '<div id="legend-content">';
  legend_html += '<table cellpadding=5>';
  legend_html += '<tr id="forest-loss-year-legend" style="display: none"><td><div style="font-size: 17px">Forest Loss By Year <span class="credit"> (Hansen et al)</span></div><div style="float:left; padding-right:3px; margin-left: 6px; font-size: 14px;">2000</div><div style="margin-top: 3px; float: left; background-image: -webkit-linear-gradient(left, yellow, orange 65%, red 100%);background-image: linear-gradient(left, yellow, orange 65%, red 100%); width: 68%; height: 10px"></div><div style="float:left; padding-left: 3px; font-size: 14px;">2018</div></div></td></tr>';
  legend_html += '<tr id="forest-loss-gain-legend" style="display: none; font-size: 14px;"><td><div style="font-size: 17px">Forest Loss/Gain 2000-2018 <span class="credit"> (Hansen et al)</span></div><div style="float: left; padding-right:8px"><div style="background-color:#00e000; width: 12px; height: 12px; float: left; margin-top: 2px; margin-left: 8px;"></div>&nbsp;Extent</div><div style="float: left; padding-right:8px"><div style="background-color:#ff0000; width: 12px; height: 12px; float: left; margin-top: 2px"></div>&nbsp;Loss</div><div style="float: left; padding-right:8px"><div style="background-color:#0000ff; width: 12px; height: 12px; float: left; margin-top: 2px"></div>&nbsp;Gain</div><div><div style="background-color:#ff00ff; width: 12px; height: 12px; float: left; margin-top: 2px"></div>&nbsp;Both</div></td></tr>';
  legend_html += '<tr id="fires-at-night-legend" style="display: none"><td><div style="background-color:#eda46a; border-radius: 50%; width:13px; height: 13px;"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Fires At Night <span class="credit"> (NOAA)</span></div></td></tr>';
  legend_html += '<tr id="sea-level-rise-legend" style="display: none"><td><div style="font-size: 17px">Global Temperature Rise <span id="slr-degree"></span> &#x2103;<span class="credit"> (Climate Central)</span></div><div style="font-size: 15px">Multi-century Sea Level Increase:<span id="slr-feet" style="width:25px;"></span>&nbsp;<span id="slr-meters" style="width:25px; color: red;"></span></div></td></tr>';
  legend_html += '<tr id="tibnted-sea-level-rise-legend" style="display: none"><td><div style="font-size: 17px">Global Temperature Rise <span id="slr-degree"></span> &#x2103;<span class="credit"> (Climate Central)</span></div><div style="font-size: 15px">Multi-century Sea Level Increase:<span id="slr-feet" style="width:25px;"></span>&nbsp;<span id="slr-meters" style="width:25px; color: red;"></span></div></td></tr>';
  legend_html += '<tr id="berkeley-earth-temperature-anomaly-legend" style="display: none"><td><div style="font-size: 13px">Average Temperature Annual Anomaly 1850-2017<span class="credit"> (Berkeley Earth)</span></div><svg class="svg-legend" width="220" height="40"><text font-size="12px" fill="rgba(255, 255, 255, 1.0)" y="10" x="40">Temperature Anomaly (&#8451)</text><rect fill="#00008b" y="20" x="0" height="10" width="20.0"></rect><rect fill="#3031c9" y="20" x="20" height="10" width="20.0"></rect><rect fill="#5768e6" y="20" x="40" height="10" width="20.0"></rect><rect fill="#799ef6" y="20" x="60" height="10" width="20.0"></rect><rect fill="#a1d4fe" y="20" x="80" height="10" width="20.0"></rect><rect fill="#ffffff" y="20" x="100" height="10" width="20.0"></rect><rect fill="#ffd130" y="20" x="120" height="10" width="20.0"></rect><rect fill="#ff9500" y="20" x="140" height="10" width="20.0"></rect><rect fill="#ed5700" y="20" x="160" height="10" width="20.0"></rect><rect fill="#c42102" y="20" x="180" height="10" width="20.0"></rect><rect fill="#8b0000" y="20" x="200" height="10" width="20.0"></rect><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="0">-10</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="25">-8</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="45">-6</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="65">-4</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="85">-2</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="107">0</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="127">2</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="147">4</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="167">6</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="187">8</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="205">10</text></svg></td></tr>';
  legend_html += '<tr id="berkeley-earth-temperature-anomaly-v2-yearly-legend" style="display: none"><td><div style="font-size: 13px">Average Temperature Annual Anomaly 1850-2018<span class="credit"> (Berkeley Earth)</span></div><svg width="400" height="45"><text font-size="12px" fill="rgba(255, 255, 255, 1.0)" y="10" x="40">Temperature Anomaly Relative to 1951-1980 Average (&#8451)</text><rect y="20"fill="#2a0050ff" x="0" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="5"><=-6</text><rect y="20"fill="#13008cff" x="30" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="40">-5</text><rect y="20"fill="#0319c6ff" x="60" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="70">-4</text><rect y="20"fill="#0455edff" x="90" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="100">-3</text><rect y="20"fill="#04adf9ff" x="120" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="130">-2</text><rect y="20"fill="#5ce6feff" x="150" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="160">-1</text><rect y="20"fill="#fefcf4ff" x="180" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="190">0</text><rect y="20"fill="#fee44fff" x="210" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="220">1</text><rect y="20"fill="#f8a409ff" x="240" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="250">2</text><rect y="20"fill="#e95001ff" x="270" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="280">3</text><rect y="20"fill="#c21200ff" x="300" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="310">4</text><rect y="20"fill="#87010fff" x="330" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="340">5</text><rect y="20"fill="#56001eff" x="360" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="365">>=6</text></svg></td></tr>';

  // ## 5b ##
  //// Add to layer legend ////
  //
  legend_html += '</table>';
  legend_html += '</div>';
  legend_html += '</div>';

  $(layer_html).appendTo($("#layers-menu"));
  $(legend_html).appendTo($("#timeMachine .player"));

  if (showExtrasMenu) {
    $(".extras-selector-div").show();
  }

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
        $(".share").trigger("click");
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


  // ## 6 ##
  //// Layer options and initialization ////
  //

  // Landsat

  // var landsatTimeMachineLayerOptions = {
  //   numFrames: cached_ajax[cachedLandsatTimeJsonPath]['capture-times'].length,
  //   fps: cached_ajax['./1068x600/r.json'].fps,
  //   width: cached_ajax['./1068x600/r.json'].width,
  //   height: cached_ajax['./1068x600/r.json'].height,
  //   startYear: parseInt(cached_ajax[cachedLandsatTimeJsonPath]['capture-times'][0]),
  //   tileRootUrl: landsatUrl
  // };
  //landsatBaseMapLayer = new WebGLTimeMachineLayer(glb, canvasLayer, landsatTimeMachineLayerOptions);

/////////////
/////////////  // For any raster map
/////////////  var defaultMapLayerOptions = {
/////////////    nLevels: 11,
/////////////    tileWidth: 256,
/////////////    tileHeight: 256
/////////////  };
/////////////
/////////////  // For any retina raster map
/////////////  var retinaMapLayerOptions = {
/////////////    nLevels: useGoogleMaps ? 20 : 11,
/////////////    tileWidth: 512,
/////////////    tileHeight: 512
/////////////  };
/////////////
  // For the light/dark base layers
  var defaultBaseMapLayerOptions = {
    nLevels: useGoogleMaps ? 20 : 11,
    tileWidth: 256,
    tileHeight: 256
  };
/////////////
/////////////  var baseMapLayerOptions = isHyperwall ? retinaMapLayerOptions : defaultBaseMapLayerOptions;
////////////
lightBaseMapLayer = new WebGLMapLayer(null, gEarthTime.glb, gEarthTime.canvasLayer, lightMapUrl, defaultBaseMapLayerOptions as LayerOptions);
/////////////  darkBaseMapLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, darkMapUrl, defaultBaseMapLayerOptions);
/////////////
/////////////  landBorderLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, landBorderUrl, defaultBaseMapLayerOptions);
/////////////  countryLabelMapLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, countryLabelMapUrl, defaultBaseMapLayerOptions);
/////////////  cityLabelMapLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, cityLabelMapUrl, defaultBaseMapLayerOptions);
/////////////
/////////////
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
      if (lastSelectedWaypointIndex != -1 && typeof(unsafeHashVars.waypointIdx) !== "undefined") {
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
      };
      clearTimelineUIChangeListeners();
      gEarthTime.timelapse.addTimelineUIChangeListener(waypointTimelineUIChangeListener);
      // In the event a sharelink layer does not have a timeline change, be sure the above listener is removed.
      var waypointTimelineUIChangeListenerWatchDog = setTimeout(function() {
        gEarthTime.timelapse.removeTimelineUIChangeListener(waypointTimelineUIChangeListener);
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
      if (waypointLayers.find(layerId => layerId.includes("extras"))) {
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
          if (waypoint.description) {
            var waypointBoxText = waypoint.description;
            if (Object.keys(waypointJSONList).length && selectedWaypointIdx == 0 && $previousAnnotationLocationButton && waypointJSONList[currentWaypointTheme]) {
              var story = waypointJSONList[currentWaypointTheme].stories[currentWaypointStory];
              if (story && story.storyDescription && story.storyAuthor) {
                var storyAuthorText = story.storyAuthor;
                if (storyAuthorText.trim().toLowerCase().indexOf("story ") != 0) {
                  storyAuthorText = "Story by: " + storyAuthorText;
                }
                waypointBoxText += "<div class='story-author-text'>" + storyAuthorText + "</div>";
                $(".current-location-text p").css("text-align", "center");
              }
            }
            $current_location_text.find("p").show().html(waypointBoxText);
          } else {
            $current_location_text.find("p").empty().hide();
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

        // Close the extra content pop-up if a waypoint is clicked, but only if the new waypoint is not also an extra.
        var layerExtraId = waypoint.layers.find(function(layer) {
          return (layer.indexOf("extras_") == 0 || layer.indexOf("e-") == 0);
        });
        if (!layerExtraId) {
          $('#extras-content-container').dialog('close');
        }
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
    var storyTheme = getStoryAndThemeFromUrl();
    //vals = $.extend({}, storyTheme, vals);

    // Another hashChange call may happen later from csvFileLayers.addLayersLoadedListener() which will end up clearing out
    // any layers a waypoint may have up. So if we are looking at a waypoint, we need to filter out its layers.
    var activeWaypoint = $(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight");
    if (activeWaypoint.length) {
      var waypointLayersSelectors = "";
      var waypointIdx = snaplapseViewerForPresentationSlider.getCurrentWaypointIndex();
      if (snaplapseForPresentationSlider) {
        var waypointLayerIds = snaplapseForPresentationSlider.getKeyframes()[waypointIdx].layers;
        for (var i = 0; i < waypointLayerIds.length; i++) {
          waypointLayersSelectors += "label[name='" + waypointLayerIds[i] + "']";
          // Need to comma separate each selector
          if (i < waypointLayerIds.length - 1) {
            waypointLayersSelectors += ",";
          }
        }
      }
    }
    // Turn off any layers that are active except ones related to current waypoint
    $(".map-layer-div").find("input[type='checkbox']:checked").parent().not(waypointLayersSelectors).children().trigger("click");
    if (vals.l) {
      var layers = vals.l.split(",");
      if (loadedInitialCsvLayers){
        dateRangePicker.handleCalendarLayers(true, layers);
        altitudeSlider.handleAltitudeLayers();
      }

      // Temporarily set a max scale, based on what the shareview asks for. Note that this may be overriden by the max zoom of a layer
      let maxShareViewScale = gEarthTime.timelapse.zoomToScale(gEarthTime.timelapse.unsafeViewToView(vals.v).zoom);
      gEarthTime.timelapse.setMaxScale(maxShareViewScale);

      // The time in a share link may correspond to a layer that has a different timeline than the default one.
      // Re-run corresponding sharelink code once the timeline has changed.
      // Note that this may be unncessary because of the callback for CSV layers, but it's possible not to have CSV layers
      // and CSV layers are async (and could be loaded very fast) so we keep this in.
      let loopDwell = gEarthTime.timelapse.getLoopDwell();
      gEarthTime.timelapse.setDoDwell(false)
      var onloadView = function() {
        clearTimelineUIChangeListeners();
        gEarthTime.timelapse.removeTimelineUIChangeListener(onloadView);
        gEarthTime.timelapse.loadSharedViewFromUnsafeURL(UTIL.getUnsafeHashString());
        gEarthTime.timelapse.setDoDwell(loopDwell);
      };
      clearTimelineUIChangeListeners();
      gEarthTime.timelapse.addTimelineUIChangeListener(onloadView);
      timelineUIChangeListeners.push({"type" : "uiChangeListener", "fn" : onloadView});

      // Turn on layers encoded in the share link
      handleLayers(layers);
    }

    if (gEarthTime.timelapse.isPresentationSliderEnabled()) {
      if ($("#timeMachine .presentationSlider").hasClass("offscreen")) {
        // First check for legacy case
        if (vals.theme) {
          $("#" + vals.theme).click();
        } else if (storyTheme.story) {
          $("#story_" + storyTheme.story).click();
        }
      }
      if (showStories) {
        var waypointsPath = vals.waypoints ? docTabToGoogleSheetUrl(vals.waypoints) : waypointSliderContentPath;
        // If for some reason the waypoints cannot load, the controls need to be manually
        // pushed up by changing the player to where it would be had the waypoints loaded.
        $("#timeMachine .player").css("bottom", "93px");
        loadWaypoints(waypointsPath);
      }
      // TODO
      populateLayerLibrary();
    }
  };

  /*$(".map-layer-div, .themes-div").accordion({
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

  sortLayerCategories();*/

  // TODO(LayerDB)

  // We now need to poll for new data in the draw callback

  // Callback when data for a specific CSV layer has loaded.
  // csvFileLayers.addDataLoadedListener(function(layerId) {
  //   csvDataGrapher.graphDataForLayer(layerId);
  //   showHideCsvGrapher(true, layerId, true);
  //   csvFileLayers.setLegend(layerId);
  // });

  // // Callback when a CSV file has been loaded and layers added to the DOM.
  // csvFileLayers.addLayersLoadedListener(function() {
  //   // Override base dark map from a csv layer
  //   if (customDarkMapUrlOrId && customDarkMapUrlOrId.indexOf("http") != 0) {
  //     darkBaseMapLayer._tileUrl = csvFileLayers.layerById[customDarkMapUrlOrId]._tileUrl;
  //   }

  //   // Override base light map from a csv layer
  //   if (customLightMapUrlOrId && customLightMapUrlOrId.indexOf("http") != 0) {
  //     lightBaseMapLayer._tileUrl = csvFileLayers.layerById[customLightMapUrlOrId]._tileUrl;
  //   }

  //   // If csv layers load before waypoints, keep checking for waypoint ready status
  //   waypointJSONListReadyInterval = setInterval(function() {
  //     if (!waypointJSONList) return;
  //     window.clearInterval(waypointJSONListReadyInterval);
  //     var storyTheme = getStoryAndThemeFromUrl();
  //     featuredTheme = currentWaypointTheme || featuredTheme || storyTheme.theme;
  //     featuredTheme = capitalize_each_word_in_string(featuredTheme.replace(/_/g, " "));

  //     if (!loadedInitialCsvLayers) {
  //       loadedInitialCsvLayers = true;
  //       // CSV layers are loaded asynchronously, so trigger another hash change if we just loaded the page
  //       $(window).trigger('hashchange');
  //     }

  //     // TODO(rsargent)  Work with pdille to understand this
  //     // var layerDefs = csvFileLayers.layersData.data;
  //     // for (var i = 0; i < layerDefs.length; i++) {
  //     //   var layerDef = layerDefs[i];
  //     //   var shareLinkIdentifier = layerDef['Share link identifier'];
  //     //   var $layer = $("#layers-list label[name='" + shareLinkIdentifier + "']");
  //     //   // Add layer description buttons
  //     //   if (layerDef['Layer Description']) {
  //     //     var $layerDescriptionElm = $("<td colspan='3'><div class='layer-description'></div></td>");
  //     //     $layer.closest("tr").append($layerDescriptionElm);
  //     //     $layerDescriptionElm.find(".layer-description").attr("data-layer-description", layerDef['Layer Description']);
  //     //   }
  //     // }

  //     if (featuredTheme) {
  //       createFeaturedLayersSection();
  //     } else {
  //       $(".map-layer-div").show();
  //     }
  //     $(".map-layer-div").accordion("refresh");
  //     $("#extras-selector").selectmenu("refresh");
  //     // Sort all the newly added layers
  //     sortLayerCategories();
  //     resizeLayersMenu();
  //     if (enableLetterboxMode) {
  //       updateLetterboxContent();
  //     }
  //   }, 50);
  //   window.prepareSearchContent();
  //   csvFileLayersInitialized = true;
  // });

  if (isOffline) {
    $(".map-layer-div").show();
    // Sort all the newly added layers
    sortLayerCategories();
  }

  csvDataGrapher.initialize();

  // TODO(LayerDB)

  // $("#layers-list").on("click", ".csvlayer input, input[data-has-graph='true']", function(e) {
  //   var activeGraphableLayers = $(".csvlayer input, tr input[data-has-graph='true']").closest("input:checked");
  //   var $target = $(e.target);
  //   var layerId = $target.parent().attr("name");
  //   //var layerIds = csvFileLayers.layers.map(function(props) {
  //   //  return props['_layerId'];
  //   //});
  //   //var layerIdx = layerIds.indexOf(layerId);
  //   var dataLoaded = $target.data("has-graph") ? true : false;
  //   var layer = csvFileLayers.layerById[layerId];

  //   if (layer && layer._tileView) {
  //     var tiles = layer._tileView._tiles;
  //     var key = Object.keys(tiles)[0];
  //     // Checking point count is a special case when we are only displaying a chart and nothing on the main map
  //     dataLoaded = key && layer.showGraph && (tiles[key]._ready || tiles[key]._pointCount == 0);
  //   }
  //   if (dataLoaded && $target.is(':checked') && !$target.data("has-graph")) {
  //     var layerId = tiles[key].layerId;
  //     csvDataGrapher.graphDataForLayer(layerId);
  //   }
  //   var isCsvLayer = $(this).closest("tr").hasClass("csvlayer");
  //   if ($target.is(':checked') && dataLoaded) {
  //     showHideCsvGrapher(true, layerId, isCsvLayer);
  //   } else {
  //     csvDataGrapher.removePlot($target.data("graph-name"));
  //   }
  //   if (activeGraphableLayers.length == 0) {
  //     showHideCsvGrapher(false, layerId, isCsvLayer);
  //     csvDataGrapher.removeAllPlots();
  //   }
  // });

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
      if (!isOffline) {
        createFeaturedLayersSection();
      }
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
    setNewStoryAndThemeUrl(currentWaypointTheme, currentWaypointStory);
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

  $("#layers-menu").on("click", ".layer-description", function (e) {
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
      content: md.render($(this).attr("data-layer-description"))
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

  // Keep this last
  $(window).on('hashchange', hashChange).trigger('hashchange');
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
var showHideCsvGrapher = function(doShow, layerId, isCSV) {
  if (doShow && layerId && isCSV) {
    // @ts-ignore
    // TODO(LayerDB)
    if (!layerDB.getLayer(layerId).showGraph()) return;
  }
  if (doShow) {
    $("#csvChartLegend").show();
    $("#csvChartContainer").show();
    if (!disablePresentationSlider) {
      $("#layers-legend, .controls, .customControl, #baseLayerCreditContainer, .current-location-text-container, .annotations-resume-exit-container, .player, .scaleBarContainer, #logosContainer").addClass("layerGraphs");
    }
    $("#timeMachine").addClass("layerGraphs");
  } else {
    $("#csvChartLegend").hide();
    $("#csvChartContainer").hide();
    if (!disablePresentationSlider) {
      $("#layers-legend, .controls, .customControl, #baseLayerCreditContainer, .current-location-text-container, .annotations-resume-exit-container, .player, .scaleBarContainer, #logosContainer").removeClass("layerGraphs");
    }
    $("#timeMachine").removeClass("layerGraphs");
  }
  var snaplapse = gEarthTime.timelapse.getSnaplapseForPresentationSlider();
  if (snaplapse) {
    snaplapse.getSnaplapseViewer().showHideSnaplapseContainer(!doShow);
  }
  resize();
  csvDataGrapher.chart.render();
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
  d.html('<a target="_blank" href="' + getSpreadsheetDownloadPath(waypointsLoadedPath) + '" title="Click to view current waypoint spreadsheet">Current waypoints spreadsheet</a>' +
          '<button style="float: right; cursor: pointer;" title="Click to change waypoint list">Switch</button><br>' +
          '<a target="_blank" href="https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=358696896" title="Click to view current dotmap spreadsheet">Current dotmap layer spreadsheet</a><br>' +
          '<a target="_blank" href="' + gEarthTime.layerDB.databaseId.url() + '" title="Click to view current csv spreadsheet">Current csv layer spreadsheet</a>' +
          '<button style="float: right; cursor: pointer;" title="Click to change csv layers">Switch</button><br><br>' +
          '<button style="float: right; cursor: pointer; font-size: 12px" title="Reset spreadsheets back to their defaults">Reset spreadsheets to default values</button><br>');


  d.find('button:eq(0)').click(function () {
    askForSpreadsheetUrl('waypoints', function (newUrl) {
      changeHash({waypoints: googleSheetUrlToDocTab(newUrl)});
      d.dialog("close");
    });
  });

  d.find('button:eq(1)').click(function () {
    askForSpreadsheetUrl('dotmap layers', function (newUrl) {
      changeHash({dotlayers: googleSheetUrlToDocTab(newUrl)});
      d.dialog("close");
    });
  });

  d.find('button:eq(2)').click(function () {
    askForSpreadsheetUrl('csv layers', function (newUrl) {
      changeHash({csvlayers: googleSheetUrlToDocTab(newUrl)});
      d.dialog("close");
    });
  });

  d.find('button:eq(3)').click(function () {
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
  gEarthTime.startRedraw();
  if (!gEarthTime.readyToDraw) return;
  if (disableAnimation) {
    gEarthTime.canvasLayer.setAnimate(false);
    disableAnimation = false;
  }

  gEarthTime.updateTimelineIfNeeded();

  gEarthTime.showVisibleLayersLegends();

  gEarthTime.timelapse.frameno = (gEarthTime.timelapse.frameno || 0) + 1;

  //perf_drawframe();
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Set this to true at the beginning of frame redraw;  any layer that decides it wasn't completely drawn will set
  // this to false upon draw below
  gEarthTime.timelapse.lastFrameCompletelyDrawn = true;

  //
  //// Draw layers ////
  //

  if (gEarthTime.layerDB.mapboxLayersAreVisible()) {
    ETMBLayer.render();
  } else {
    for (let sublayer of gEarthTime.layerDB.drawnSublayersInDrawOrder()) {
      sublayer.draw();
    }
  }

  // TODO: remove getLayerView as soon as we've moved all layers from index.ts to the spreadsheet
  var getLayerView = function(layerProxy: LayerProxy, ignore) {
    throw 'do not use getLayerView; instead move layers to database and use LayerProxy.draw'
  };

  ////////////////////////////////////////////////////////////////
  // LAYERDB

  /** END NS LAYER */

  // TODO(LayerDB)

  // function isPairCandidate(layer) {
  //   return layer.visible && layer.paired;
  // }

  // // Set up to draw half-circles if we have exactly two visible paired layers
  // var pairCount = 0;
  // for (var i = 0; i < csvFileLayers.layers.length; i++) {
  //   if (isPairCandidate(csvFileLayers.layers[i])) pairCount++;
  // }
  // if (pairCount != 2) pairCount = 0;

  // function drawCsvLayer(layer, options) {
  //   var view = getLayerView(layer, landsatBaseMapLayer);
  //   if (options) {
  //     options = $.extend({}, options); // shallow-copy options
  //   } else {
  //     options = {};
  //   }

  //   var lightBaseMapView = timelapse.getView();
  //   var timelapse2map = lightBaseMapLayer.getWidth() / landsatBaseMapLayer.getWidth();
  //   lightBaseMapView.x *= timelapse2map;
  //   lightBaseMapView.y *= timelapse2map;
  //   lightBaseMapView.scale /= timelapse2map;
  //   var mapLevel = lightBaseMapLayer._tileView._scale2level(lightBaseMapView.scale);
  //   options.zoomLevel = mapLevel;
  //   options.gmapsZoomLevel = gmapsZoomLevel;

  //   options.zoom = timelapse.getCurrentZoom();
  //   var currentTime = timelapse.getCurrentTime();
  //   var currentTimes = getCurrentTimes(timelapse);
  //   var dates = getDates(timelapse);
  //   var delta = getCurrentTimesDelta(currentTime, currentTimes);
  //   let currentDate = getCurrentDate(currentTime, currentTimes, dates);
  //   options.currentTime = currentDate;
  //   options.delta = Math.min(delta, 1.0);
  //   options.pointSize = 2.0;
  //   if (pairCount && isPairCandidate(layer)) {
  //     options.mode = pairCount + 1; // 2 or 3 for left or right
  //     pairCount--;
  //   }
  //   if (layer.options) {
  //     $.extend(options, layer.options);
  //   }
  //   layer.draw(view, options);
  // }

  // These are special case layers that do not play with any of the other layers.
  if (false) {
    // Static layers that cover the entire planet should be placed before the base layers in this manner.
    // if (showLightsAtNightLayer) { // Draw lightsAtNightMapLayer
    //   var lightsAtNightLayerView = getLayerView(lightsAtNightMapLayer, landsatBaseMapLayer);
    //   lightsAtNightMapLayer.draw(lightsAtNightLayerView);
    // }
    //  else if (showLightsAtNight2012Layer) { // Draw lightsAtNight2012MapLayer
    //   var lightsAtNight2012LayerView = getLayerView(lightsAtNight2012MapLayer, landsatBaseMapLayer);
    //   lightsAtNight2012MapLayer.draw(lightsAtNight2012LayerView);
    // }
    if (visibleBaseMapLayer == "blsat") { // Draw Landsat
      landsatBaseMapLayer.draw(gEarthTime.timelapse.getView(), tileViewVisibility);
    } else if (visibleBaseMapLayer == "blte") { // Draw Light Map
      var lightBaseMapView = getLayerView(lightBaseMapLayer, landsatBaseMapLayer);
      lightBaseMapLayer.draw(lightBaseMapView);
    } else if (visibleBaseMapLayer == "bdrk") { // Draw Dark Map
      var darkBaseMapView = getLayerView(darkBaseMapLayer, landsatBaseMapLayer);
      var options = {showTile: showTile};
      darkBaseMapLayer.draw(darkBaseMapView, options);
    }

    // TODO(LayerDB)
    // Draw CSV z=100 (typically raster base maps)
    // for (var i = 0; i < csvFileLayers.layers.length; i++) {
    //   var layer = csvFileLayers.layers[i];
    //   if (layer.visible && layer.z == 100) {
    //     drawCsvLayer(layer);
    //   }
    // }

    //// Layers to draw above the base layer (or planet-wide static layers)

    // Draw Fishing PPR
    /*if (showFishingPprTimeMachineLayer) {
      var fishingPprView = getLayerView(fishingPprTimeMachineLayer, landsatBaseMapLayer);
      fishingPprTimeMachineLayer.draw(fishingPprView, tileViewVisibility);
    }*/

    // Draw NDVI Anomaly
    /*if (showNdviAnomalyTimeMachineLayer) {
      var ndviView = getLayerView(ndviAnomalyTimeMachineLayer, landsatBaseMapLayer);
      ndviAnomalyTimeMachineLayer.draw(ndviView, tileViewVisibility);
    }*/

    // Draw Vegetation Sensitivity Index
    // if (showVsiLayer) {
    //   var vsiLayerView = getLayerView(vsiLayer, landsatBaseMapLayer);
    //   vsiLayer.draw(vsiLayerView);
    // }

    // // Draw Water Occurrence
    // if (showWaterOccurrenceLayer) {
    //   var waterOccurrenceView = getLayerView(waterOccurrenceLayer, landsatBaseMapLayer);
    //   waterOccurrenceLayer.draw(waterOccurrenceView);
    // }

    // // Draw Water Change
    // if (showWaterChangeLayer) {
    //   var waterChangeView = getLayerView(waterChangeLayer, landsatBaseMapLayer);
    //   waterChangeLayer.draw(waterChangeView);
    // }

    // Draw Fires at Night (VIIRS)
    /*
    var viirsIndex = {
      '201408': {'count': 115909, 'first': 0},
      '201409': {'count': 213165, 'first': 115909},
      '201410': {'count': 232833, 'first': 329074},
      '201411': {'count': 146622, 'first': 561907},
      '201412': {'count': 151926, 'first': 708529},
      '201501': {'count': 192835, 'first': 860455},
      '201502': {'count': 150901, 'first': 1053290},
      '201503': {'count': 189347, 'first': 1204191},
      '201504': {'count': 175398, 'first': 1393538},
      '201505': {'count': 133021, 'first': 1568936},
      '201506': {'count': 116314, 'first': 1701957},
      '201507': {'count': 192662, 'first': 1818271},
      '201508': {'count': 289941, 'first': 2010933},
      '201509': {'count': 282792, 'first': 2300874},
      '201510': {'count': 286486, 'first': 2583666},
      '201511': {'count': 187366, 'first': 2870152},
      '201512': {'count': 183570, 'first': 3057518},
      '201601': {'count': 208576, 'first': 3241088},
      '201602': {'count': 179606, 'first': 3449664},
      '201603': {'count': 184595, 'first': 3629270},
      '201604': {'count': 185076, 'first': 3813865},
      '201605': {'count': 144875, 'first': 3998941},
      '201606': {'count': 126776, 'first': 4143816},
      '201607': {'count': 175568, 'first': 4270592},
      '201608': {'count': 236754, 'first': 4446160},
      '201609': {'count': 254754, 'first': 4682914},
      '201610': {'count': 174679, 'first': 4937668},
      '201611': {'count': 167121, 'first': 5112347},
      '201612': {'count': 183016, 'first': 5279468},
      '201701': {'count': 181133, 'first': 5462484},
      '201702': {'count': 158187, 'first': 5643617},
      '201703': {'count': 156410, 'first': 5801804},
      '201704': {'count': 170735, 'first': 5958214},
      '201705': {'count': 101733, 'first': 6128949},
      '201706': {'count': 132268, 'first': 6230682},
      '201707': {'count': 171562, 'first': 6362950},
      '201708': {'count': 299079, 'first': 6534512},
      '201709': {'count': 298956, 'first': 6833591},
      '201710': {'count': 53789, 'first': 7132547}
    };
    if (showViirsLayer) {
      var viirsLayerView = getLayerView(viirsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;

      var currentMonth = currentDate.getUTCMonth();
      var currentYear = currentDate.getUTCFullYear();
      var prevYear = currentYear;
      var prevMonth = currentMonth - 1;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
      }

      var currentIdx = currentYear + ('0' + (currentMonth+1)).slice(-2);
      var prevIdx = prevYear + ('0' + (prevMonth+1)).slice(-2);
      options.first = prevIdx in viirsIndex ? viirsIndex[prevIdx]['first'] : 0 ;
      options.count = prevIdx in viirsIndex && currentIdx in viirsIndex ? viirsIndex[currentIdx]['count'] + viirsIndex[prevIdx]['count'] : 100;

      viirsLayer.draw(viirsLayerView, options);
    }
    */

    // Draw Wind Layer
/*
    if (showUsgsWindTurbineLayer) {
      var usgsWindTurbineLayerView = getLayerView(usgsWindTurbineLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [0.1, 0.5, 0.1, 1.0];
      options.pointSize = 3.0;
      usgsWindTurbineLayer.draw(usgsWindTurbineLayerView, options);
    }
*/
    // Draw Global Wind Layer
/*
    if (showGlobalWindPowerLayer) {
      var globalWindPowerLayerView = getLayerView(globalWindPowerLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.pointSize = 3;
      options.color = [0.1, 0.5, 0.1, 1.0];
      globalWindPowerLayer.draw(globalWindPowerLayerView, options);
    }
*/

    // Draw Solar Layer
    /*
    if (showSolarInstallsLayer) {
      var solarInstallsLayerView = getLayerView(solarInstallsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.pointSize = 3;
      solarInstallsLayer.draw(solarInstallsLayerView, options);
    }
    */

    // Draw Oil/Gas Drilling Layer
    /*
    if (showDrillingLayer) {
      var drillingLayerView = getLayerView(drillingLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [0.82, 0.22, 0.07, 1.0];
      drillingLayer.draw(drillingLayerView, options);
    }
    */
    // Draw Forest Alerts (No Overlay)
    /*if (showForestAlertsNoOverlayTimeMachineLayer) {
      var forestAlertsNoOverlayView = timelapse.getView();
      var timelapse2map = forestAlertsNoOverlayTimeMachineLayer.getWidth() / landsatBaseMapLayer.getWidth();

      var p = timelapse.getProjection();
      var offest = p.latlngToPoint({
        "lat": 5.506709319555738,
        "lng": -82.5513118548623
      });

      forestAlertsNoOverlayView.x -= offest.x;
      forestAlertsNoOverlayView.y -= offest.y;
      forestAlertsNoOverlayTimeMachineLayer.draw(forestAlertsNoOverlayView, tileViewVisibility);
    }

    // Draw Forest Alerts (With Overlay)
    if (showForestAlertsTimeMachineLayer) {
      var forestAlertsView = timelapse.getView();
      var timelapse2map = forestAlertsTimeMachineLayer.getWidth() / landsatBaseMapLayer.getWidth();

      var p = timelapse.getProjection();
      var offest = p.latlngToPoint({
        "lat": 5.506709319555738,
        "lng": -82.5513118548623
      });

      forestAlertsView.x -= offest.x;
      forestAlertsView.y -= offest.y;
      forestAlertsTimeMachineLayer.draw(forestAlertsView, tileViewVisibility);
    }*/

    // Draw Nutritional Deficiency Layers
    /*
    if (showHealthImpactLayer) {
      var healthImpactLayerView = getLayerView(healthImpactLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();

      var ratio = timelapse.getCurrentTime() / (timelapse.getNumFrames() / timelapse.getFps());
      var times = timelapse.getCaptureTimes();
      var endDate = new Date("2055");
      var startDate = new Date("2015");
      var range = endDate.getTime() - startDate.getTime();
      var currentDate = new Date(ratio * range + startDate.getTime());
      var year = currentDate.getUTCFullYear();

      for (var i = 0; i < times.length - 1; i++) {
        if (year == times[i] || year < times[i + 1] && year > times[i]) {
          year = parseInt(times[i]);
        }
      }
      var currentYear = new Date(year, 0, 1);
      var nextYear = new Date(year + 5, 0, 1);
      if (year >= 2050) {
        nextYear = currentYear;
      }
      var delta = (currentDate.getTime() - currentYear) / (nextYear - currentYear);

      options.year = year;
      options.delta = delta;
      options.showRcp = showHealthImpactRcp;

      healthImpactLayer.draw(healthImpactLayerView, options);
    }
    */

    // Draw Zika Layer
    /*
    if (showZikaLayer) {
      var zikaLayerView = getLayerView(zikaLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var ratio = timelapse.getCurrentTime() / (timelapse.getNumFrames() / timelapse.getFps());
      var times = timelapse.getCaptureTimes();
      var startDate = new Date(parseInt(times[0]), 0, 1);
      var endDate = new Date(parseInt(times[times.length - 1]) + 1, 0, 1);
      var range = endDate.getTime() - startDate.getTime();
      var currentDate = new Date(ratio * range + startDate.getTime());
      options.currentTime = currentDate;
      options.color = [1.0, 0.1, 0.1, 1.0];
      options.pointSize = 10.0;
      zikaLayer.draw(zikaLayerView, options);
    }
    */
    // Draw Dengue Layer
    /*
    if (showDengueLayer) {
      var dengueLayerView = getLayerView(dengueLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var ratio = timelapse.getCurrentTime() / (timelapse.getNumFrames() / timelapse.getFps());
      var times = timelapse.getCaptureTimes();
      var startDate = new Date(parseInt(times[0]), 0, 1);
      var endDate = new Date(parseInt(times[times.length - 1]) + 1, 0, 1);
      var range = endDate.getTime() - startDate.getTime();
      var currentDate = new Date(ratio * range + startDate.getTime());
      options.currentTime = currentDate;
      options.color = [0.2, 1.0, 0.1, 1.0];
      options.pointSize = 10.0;
      dengueLayer.draw(dengueLayerView, options);
    }
    */
    // Draw Chiku Layer
    /*
    if (showChikuLayer) {
      var chikuLayerView = getLayerView(chikuLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var ratio = timelapse.getCurrentTime() / (timelapse.getNumFrames() / timelapse.getFps());
      var times = timelapse.getCaptureTimes();
      var startDate = new Date(parseInt(times[0]), 0, 1);
      var endDate = new Date(parseInt(times[times.length - 1]) + 1, 0, 1);
      var range = endDate.getTime() - startDate.getTime();
      var currentDate = new Date(ratio * range + startDate.getTime());
      options.currentTime = currentDate;
      options.color = [0.1, 0.1, 1.0, 1.0];
      options.pointSize = 10.0;
      chikuLayer.draw(chikuLayerView, options);
    }
    */

    /*if (showTintedSeaLevelRiseLayer) {
      var sea_level_heights = [
        [0.0, 0.0],
        [2.4, 0.7],
        [7.0, 2.1],
        [9.4, 2.9],
        [15, 4.7],
        [18, 5.6],
        [21, 6.4],
        [26, 7.9],
        [29, 8.9]
      ]; // [feet,meters]
      var feet = document.getElementById("slr-feet");
      var meters = document.getElementById("slr-meters");
      var degree = document.getElementById("slr-degree");
      var seaLevelRiseLayerView = getLayerView(seaLevelRiseLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      var ratio = timelapse.getCurrentTime() / (timelapse.getNumFrames() / timelapse.getFps());
      var times = timelapse.getCaptureTimes();
      var start = parseFloat(times[0]);
      var end = parseFloat(times[times.length - 1]) + 0.5;
      var range = end - start;
      var current = ratio * range + start;
      options.currentC = Math.min(current, times[times.length - 1]);
      if (visibleBaseMapLayer == "blsat") {
        options.color = [0.1, 0.1, 0.1, 1.0];
      } else if (visibleBaseMapLayer == "blte") {
        options.color = [0.4921875, 0.7421875, 0.91015625, 1.0];
      } else if (visibleBaseMapLayer == "bdrk") {
        options.color = [0.203125, 0.203125, 0.203125, 1.0];
      }
      // else if (showLightsAtNightLayer) {
      //   options.color = [0.0, 0.0, 0.0, 1.0];
      // }
      var currentIndex = 0;
      for (var i = 0; i < times.length; i++) {
        if (timelapse.getCurrentCaptureTime() == times[i]) {
          currentIndex = i;
        }
      }
      //feet.innerHTML = sea_level_heights[currentIndex][0] + "ft";
      if (sea_level_heights[currentIndex]) {
        $(meters).html("+" + sea_level_heights[currentIndex][1].toFixed(1) + "m");
      }
      $(degree).html((currentIndex / 2).toFixed(1));
      tintedSeaLevelRiseLayer.draw(seaLevelRiseLayerView, options);
      $(".timeText, .captureTimeMain").html(timelapse.getCurrentCaptureTime() + "&degC");
    }*/

    /*
    if (showUrbanFragilityLayer) {
      var urbanFragilityLayerView = getLayerView(urbanFragilityLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();

      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      var year = currentDate.getUTCFullYear();
      options.year = year;
      options.delta = Math.min(delta, 1);
      urbanFragilityLayer.draw(urbanFragilityLayerView, options);

    }
    */

    /*
    if (showGtdLayer) {
      var gtdLayerView = getLayerView(gtdLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [1.0, 0.0, 0.0, 1.0];
      gtdLayer.draw(gtdLayerView, options);
    }
    */
    /*
    if (showUppsalaConflictLayer) {
      var uppsalaConflictLayerView = getLayerView(uppsalaConflictLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [1.0, 0.0, 0.0, 1.0];
      uppsalaConflictLayer.draw(uppsalaConflictLayerView, options);
    }
    */
    /*
    if (showHivLayer) {
      var hivLayerView = getLayerView(hivLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();

      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      var year = currentDate.getUTCFullYear();
      options.year = year;
      options.delta = Math.min(delta, 1);
      hivLayer.draw(hivLayerView, options);
    }
    */
    /*
    if (showObesityLayer) {
      var obesityLayerView = getLayerView(obesityLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();

      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      var year = currentDate.getUTCFullYear();
      options.year = year;
      options.delta = Math.min(delta, 1);
      obesityLayer.draw(obesityLayerView, options);
    }
    */
    /*
    if (showVaccineConfidenceLayer) {
      var vaccineConfidenceLayerView = getLayerView(vaccineConfidenceLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};

      var vaccineConfidenceQuestion = 1.0;
      if ($("#show-vaccine-confidence-q2").prop('checked')) {
        vaccineConfidenceQuestion = 2.0;
      }
      if ($("#show-vaccine-confidence-q3").prop('checked')) {
        vaccineConfidenceQuestion = 3.0;
      }
      if ($("#show-vaccine-confidence-q4").prop('checked')) {
        vaccineConfidenceQuestion = 4.0;
      }
      options.question = vaccineConfidenceQuestion;
      vaccineConfidenceLayer.draw(vaccineConfidenceLayerView, options);

    }
    */
    /*
    if (showEbolaDeathsLayer) {
      var ebolaLayerView = getLayerView(ebolaDeathsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [1.0, 0.0, 0.0, 1.0];
      options.pointSize = 2.5;
      ebolaDeathsLayer.draw(ebolaLayerView, options);
    }
    */
    /*
    if (showEbolaCasesLayer) {
      var ebolaLayerView = getLayerView(ebolaCasesLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [0.0, 1.0, 0.0, 1.0];
      options.pointSize = 2.5;
      ebolaCasesLayer.draw(ebolaLayerView, options);
    }
    */
    /*
    if (showEbolaNewCasesLayer) {
      var ebolaLayerView = getLayerView(ebolaNewCasesLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.color = [0.0, 0.0, 1.0, 1.0];
      options.pointSize = 5.0;
      ebolaNewCasesLayer.draw(ebolaLayerView, options);
    }
    */

    // Draw Annual Global PM 2.5
    /*if (showAnnualGlobalPm25TimeMachineLayer) {
      var view = getLayerView(annualGlobalPm25TimeMachineLayer, landsatBaseMapLayer);
      annualGlobalPm25TimeMachineLayer.draw(view, tileViewVisibility);
    }*/

    // Draw ECCO2
    /*if (showEcco2Layer) {
      var view = getLayerView(ecco2Layer, landsatBaseMapLayer);
      ecco2Layer.draw(view, tileViewVisibility);
    }*/

    // Draw GFS
    /*if (showGfsTimemachineLayer) {
      var view = getLayerView(gfsTimemachineLayer, landsatBaseMapLayer);
      gfsTimemachineLayer.draw(view, tileViewVisibility);
    }*/

    // Draw Chlorophyll Concentration
    /*if (showChlorophyllConcentrationTimemachineLayer) {
      var view = getLayerView(chlorophyllConcentrationTimemachineLayer, landsatBaseMapLayer);
      chlorophyllConcentrationTimemachineLayer.draw(view, tileViewVisibility);
    }*/

    // TODO(LayerDB)
    // Draw CSV z=200 (typically raster+choropleths)
    // for (var i = 0; i < csvFileLayers.layers.length; i++) {
    //   var layer = csvFileLayers.layers[i];
    //   if (layer.visible && layer.z == 200) {
    //     drawCsvLayer(layer);
    //   }
    // }

    // bubble-maps half-circle hack
    // Create list of visible CSV Layers
    //var visibleCsvLayers = [];
    //for (var i = 0; i < csvFileLayers.layers.length; i++) {
    //  var layer = csvFileLayers.layers[i];
    //  if (layer.visible && layer.paired) {
    //    visibleCsvLayers.push(i);
    //  }
    //}
    //if (visibleCsvLayers.length >= 2) {
    //  if (visibleCsvLayers[0] == i) {
    //    options.mode = 2.0;
    //  }
    //  if (visibleCsvLayers[1] == i) {
    //    options.mode = 3.0;
    //  }
    //}

    /*if (showBerkeleyEarthTemperatureAnomalyTimeMachineLayer) {
      var view = getLayerView(berkeleyEarthTemperatureAnomalyTimeMachineLayer, landsatBaseMapLayer);
      berkeleyEarthTemperatureAnomalyTimeMachineLayer.draw(view, tileViewVisibility);

      var landBorderView = getLayerView(landBorderLayer, landsatBaseMapLayer);
      landBorderLayer.draw(landBorderView);

      if (showCityLabelMap) {
        var cityLabelView = getLayerView(cityLabelMapLayer, landsatBaseMapLayer);
        cityLabelMapLayer.draw(cityLabelView);
      }
    }*/

    /*if (showBerkeleyEarthTemperatureAnomalyV2YearlyTimeMachineLayer) {
      var view = getLayerView(berkeleyEarthTemperatureAnomalyV2YearlyTimeMachineLayer, landsatBaseMapLayer);
      berkeleyEarthTemperatureAnomalyV2YearlyTimeMachineLayer.draw(view, tileViewVisibility);

      var landBorderView = getLayerView(landBorderLayer, landsatBaseMapLayer);
      landBorderLayer.draw(landBorderView);

      if (showCityLabelMap) {
        var cityLabelView = getLayerView(cityLabelMapLayer, landsatBaseMapLayer);
        cityLabelMapLayer.draw(cityLabelView);
      }
    }*/

    /*if (showOmiNo2Layer) {
      var view = getLayerView(omiNo2Layer, landsatBaseMapLayer);
      omiNo2Layer.draw(view, tileViewVisibility);

      var landBorderView = getLayerView(landBorderLayer, landsatBaseMapLayer);
      landBorderLayer.draw(landBorderView);
    }*/

    /*if (showBePm25Layer) {
      var view = getLayerView(bePm25Layer, landsatBaseMapLayer);
      bePm25Layer.draw(view, tileViewVisibility);
    }*/

    // if (showLightsAtNightAnimLayer) {
    //   var view = getLayerView(lightsAtNightAnimLayer, landsatBaseMapLayer);
    //   lightsAtNightAnimLayer.draw(view, tileViewVisibility);
    // }

    if (showCountryLabelMapLayer) {
      var countryLabelMapView = getLayerView(countryLabelMapLayer, landsatBaseMapLayer);
      countryLabelMapLayer.draw(countryLabelMapView);
    }

    /*
    if (showExpandingCitiesLayer) {
      var layerView = getLayerView(expandingCitiesLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.pointSize = 5 * window.devicePixelRatio;
      options.color = [1.0, 0.5, 0.15, 1.0];
      var year = currentDate.getUTCFullYear();
      options.year = year;
      options.delta = Math.min(delta, 1);
      options.maxValue = 195;
      expandingCitiesLayer.draw(layerView, options);
    }
    */
/*
    if (showIrenaWindLayer) {
      var layer  = irenaWindLayer;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.pointSize = 500.;
      layer.draw(view, options);
    }
    if (showIrenaSolarLayer) {
      var layer = irenaSolarLayer;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.pointSize = 500.;
      options.color = [0.5,0.05,0.5,1.0];
      layer.draw(view, options);
    }
*/
    /*
    if (showTsipLayer) {
      var layer = tsipLayer;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.zoom = timelapse.getCurrentZoom();
      var currentTime = timelapse.getCurrentTime();
      var currentTimes = getCurrentTimes(timelapse);
      var dates = getDates(timelapse);
      var delta = getCurrentTimesDelta(currentTime, currentTimes);
      let currentDate = getCurrentDate(currentTime, currentTimes, dates);
      options.currentTime = currentDate;
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      layer.draw(view, options);
    }
    */

  // END LAYER DRAWS
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

}

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
  //console.log(`${Utils.logPrefix()} setting readyToDraw true`);
  gEarthTime.readyToDraw = true;

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

  contentSearch.initialize();
}

$(init);
