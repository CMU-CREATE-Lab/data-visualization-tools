/// <reference path="ContentSearch.js"/>
/// <reference path="perf.js"/>
/// <reference path="StoryEditor.js"/>
/// <reference path="../../js/dat.gui.min.js"/>
/// <reference path="../../js/utils.js"/>
/// <reference path="../../timemachine/js/org/gigapan/timelapse/timelapse.js"/>
/// <reference path="../../timemachine/js/org/gigapan/timelapse/crossdomain_api.js"/>
/// <reference path="../../timemachine/libs/change-detect/js/TimeMachineCanvasLayer.js"/>

(window as any).dbg = (window as any).dbg || {}

import { WebGLMapLayer } from './WebGLMapLayer'

import { WebGLVectorTile2 } from './WebGLVectorTile2'
import { WebGLVideoTile } from './WebGLVideoTile'

// Backwards-compatibility with js code
// (window as any).Tile = Tile;

import { Utils } from './Utils';
import { Timelines } from './Timelines';

(window as any).dbg.Utils = Utils;
console.log(`${Utils.logPrefix()} Loading index.ts`)

declare var Papa:any;
/// <reference path="../../js/papaparse.min.js"/>

import { LayerOptions, DrawOptions } from './Layer';

import { LayerProxy } from './LayerProxy';
(window as any).dbg.LayerProxy = LayerProxy;

import { LayerDB } from './LayerDB';
(window as any).dbg.LayerDB = LayerDB;

import { EarthTime, gEarthTime, setGEarthTime } from './EarthTime';

import { AltitudeSlider } from './altitudeSlider';
(window as any).dbg.AltitudeSlider = AltitudeSlider;

import { CsvDataGrapher } from './csvDataGrapher';
(window as any).dbg.CsvDataGrapher = CsvDataGrapher;

import { DateRangePicker } from './dateRangePicker';
(window as any).dbg.DateRangePicker = DateRangePicker;

import { GSheet } from './GSheet';
(window as any).dbg.GSheet = GSheet;

import { ETMBLayer } from './ETMBLayer'
(window as any).dbg.MapboxLayer = ETMBLayer;

import { Glb } from './Glb';
import { Timeline } from './Timeline';
(window as any).dbg.Glb = Glb;

(window as any).dbg.GSheet = GSheet;

var contentSearch: ContentSearch;
var EarthlapseUI;
var timelineUIHandler;
var toggleHamburgerPanel;
var prepareSearchContent;

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

// TODO:
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
var dotmapsContentPath;
if (typeof(EARTH_TIMELAPSE_CONFIG.dotmapsContentPath) === "undefined") {
  dotmapsContentPath = "1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE.358696896";
} else if (EARTH_TIMELAPSE_CONFIG.dotmapsContentPath === "") {
  dotmapsContentPath = "default-dotmaps.tsv";
} else {
  dotmapsContentPath =  EARTH_TIMELAPSE_CONFIG.dotmapsContentPath;
}

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
  glb = null;
  canvasLayer = null;
  readyToDraw = false;
  currentlyShownTimeline: any;
  async setDatabaseID(databaseID: GSheet) {
    async function internal(earthTime: EarthTimeImpl) {
      earthTime.layerDB = null;
      earthTime.layerDB = await LayerDB.create(databaseID, {earthTime: earthTime});
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
      let timeline = visibleLayers[i].layer && visibleLayers[i].layer.timeline;
      if (timeline && timeline.startDate != timeline.endDate) {
        return timeline;
      }
    }
    return null;
  }

  updateTimelineIfNeeded() {
    let newTimeline = this.timeline();
    if (newTimeline !== this.currentlyShownTimeline) {
      this.currentlyShownTimeline = newTimeline;
      $(".controls, .captureTime, .customControl").hide();
      if (newTimeline) {
        this.timelapse.loadNewTimelineFromObj(newTimeline.getCaptureTimes(), newTimeline.timelineType);
        if (newTimeline.timelineType == "customUI") {
          $(".customControl").show()
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
  if (localStorage.dotmapsContentPath) {
    dotmapsContentPath = localStorage.dotmapsContentPath;
  }
  if (localStorage.csvLayersContentPath) {
    csvLayersContentPath = localStorage.csvLayersContentPath;
  }
}

////var showEVA = !!EARTH_TIMELAPSE_CONFIG.showEVA;
var showGFW = !!EARTH_TIMELAPSE_CONFIG.showGFW;
var showLodes = !!EARTH_TIMELAPSE_CONFIG.showLodes;
var showStories = typeof(EARTH_TIMELAPSE_CONFIG.showStories) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showStories;
var showCustomDotmaps = typeof(EARTH_TIMELAPSE_CONFIG.showCustomDotmaps) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showCustomDotmaps;
var showCsvLayers = !!EARTH_TIMELAPSE_CONFIG.showCsvLayers;



////var showForestAlerts = !!EARTH_TIMELAPSE_CONFIG.showForestAlerts;
var showCoral = typeof(EARTH_TIMELAPSE_CONFIG.showCoral) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showCoral;
////var showCoralBleaching = typeof(EARTH_TIMELAPSE_CONFIG.showCoralBleaching) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showCoralBleaching;
// TODO(differently projected timemachine)
var showHimawari8 = typeof(EARTH_TIMELAPSE_CONFIG.showHimawari8) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showHimawari8;
//var showUSDrilling = typeof(EARTH_TIMELAPSE_CONFIG.showUSDrilling) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showUSDrilling;
//var showViirs = typeof(EARTH_TIMELAPSE_CONFIG.showViirs) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showViirs;
var showMonthlyRefugees = !!EARTH_TIMELAPSE_CONFIG.showMonthlyRefugees;
var showAnnualRefugees = !!EARTH_TIMELAPSE_CONFIG.showAnnualRefugees;
var subsampleAnnualRefugees = !!EARTH_TIMELAPSE_CONFIG.subsampleAnnualRefugees;
var subsampleAnnualReturns = !!EARTH_TIMELAPSE_CONFIG.subsampleAnnualReturns;
var showAnnualReturns = !!EARTH_TIMELAPSE_CONFIG.showAnnualReturns;
//var showGlobalWindPower = !!EARTH_TIMELAPSE_CONFIG.showGlobalWindPower;
// var showVsi = !!EARTH_TIMELAPSE_CONFIG.showVsi;
var showHealthImpact = !!EARTH_TIMELAPSE_CONFIG.showHealthImpact;
//var showZika = !!EARTH_TIMELAPSE_CONFIG.showZika;
//var showDengue = !!EARTH_TIMELAPSE_CONFIG.showDengue;
//var showChiku = !!EARTH_TIMELAPSE_CONFIG.showChiku;
var showSeaLevelRise = !!EARTH_TIMELAPSE_CONFIG.showSeaLevelRise;
////var showTintedSeaLevelRise = !!EARTH_TIMELAPSE_CONFIG.showTintedSeaLevelRise;
//var showUrbanFragility = !!EARTH_TIMELAPSE_CONFIG.showUrbanFragility;
//var showGtd = !!EARTH_TIMELAPSE_CONFIG.showGtd;
//var showHiv = !!EARTH_TIMELAPSE_CONFIG.showHiv;
//var showObesity = !!EARTH_TIMELAPSE_CONFIG.showObesity;
//var showVaccineConfidence = !!EARTH_TIMELAPSE_CONFIG.showVaccineConfidence;
//var showNdviAnomaly = !!EARTH_TIMELAPSE_CONFIG.showNdviAnomaly;
//var showEbola = !!EARTH_TIMELAPSE_CONFIG.showEbola;
// var showWaterOccurrence = !!EARTH_TIMELAPSE_CONFIG.showWaterOccurrence;
// var showWaterChange = !!EARTH_TIMELAPSE_CONFIG.showWaterChange;
var showSeaLevelRise = !!EARTH_TIMELAPSE_CONFIG.showSeaLevelRise;
var showCumulativeActiveMining = !!EARTH_TIMELAPSE_CONFIG.showCumulativeActiveMining;
var showIomIdp = !!EARTH_TIMELAPSE_CONFIG.showIomIdp;
//var showBerkeleyEarthTemperatureAnomaly = !!EARTH_TIMELAPSE_CONFIG.showBerkeleyEarthTemperatureAnomaly;
//var showUppsalaConflict = !!EARTH_TIMELAPSE_CONFIG.showUppsalaConflict;
// var showLightsAtNight = typeof(EARTH_TIMELAPSE_CONFIG.showLightsAtNight) === "undefined" ? true : !!EARTH_TIMELAPSE_CONFIG.showLightsAtNight;
// var showLightsAtNight2012 = !!EARTH_TIMELAPSE_CONFIG.showLightsAtNight2012;
//var showLightsAtNight2016 = !!EARTH_TIMELAPSE_CONFIG.showLightsAtNight2016;
//var showOmiNo2 = !!EARTH_TIMELAPSE_CONFIG.showOmiNo2;
var showChinaInfrastructure = !!EARTH_TIMELAPSE_CONFIG.showChinaInfrastructure;
//var showBePm25 = !!EARTH_TIMELAPSE_CONFIG.showBePm25;
// var showLightsAtNightAnim = !!EARTH_TIMELAPSE_CONFIG.showLightsAtNightAnim;
//var showExpandingCities = !!EARTH_TIMELAPSE_CONFIG.showExpandingCities;
//var showIrena = !!EARTH_TIMELAPSE_CONFIG.showIrena;
var showCityLabelMap = !!EARTH_TIMELAPSE_CONFIG.showCityLabelMap;
//var showTsip = !!EARTH_TIMELAPSE_CONFIG.showTsip;
var showSpCrude = !!EARTH_TIMELAPSE_CONFIG.showSpCrude;
// TODO(differently projected timemachine)
var showGoes16 = !!EARTH_TIMELAPSE_CONFIG.showGoes16;
// TODO(differently projected timemachine)
var showDscovr = !!EARTH_TIMELAPSE_CONFIG.showDscovr;
//var showAnnualGlobalPm25 = !!EARTH_TIMELAPSE_CONFIG.showAnnualGlobalPm25;
//var showEcco2 = !!EARTH_TIMELAPSE_CONFIG.showEcco2;
//var showGdpPpp = !!EARTH_TIMELAPSE_CONFIG.showGdpPpp;
////var showTintedLandsat = !!EARTH_TIMELAPSE_CONFIG.showTintedLandsat;
//var showGfsTimemachine = !!EARTH_TIMELAPSE_CONFIG.showGfsTimemachine;
//var showChlorophyllConcentrationTimemachine = !!EARTH_TIMELAPSE_CONFIG.showChlorophyllConcentrationTimemachine;
//var showFishingPprTimemachine = !!EARTH_TIMELAPSE_CONFIG.showFishingPprTimemachine;
var showWindVectors = !!EARTH_TIMELAPSE_CONFIG.showWindVectors;



var googleMapsAPIKey = parseConfigOption({optionName: "googleMapsAPIKey", optionDefaultValue: "AIzaSyAGTDshdDRmq8zdw26ZmwJOswh6VseIrYY", exposeOptionToUrlHash: false});
var showExtrasMenu = parseConfigOption({optionName: "showExtrasMenu", optionDefaultValue: true, exposeOptionToUrlHash: false});
var showFullScreenButton = parseConfigOption({optionName: "showFullScreenButton", optionDefaultValue: false, exposeOptionToUrlHash: true});
var showThumbnailTool = parseConfigOption({optionName: "showThumbnailTool", optionDefaultValue: true, exposeOptionToUrlHash: false});
var thumbnailServerHost = parseConfigOption({optionName: "thumbnailServerHost", optionDefaultValue: undefined, exposeOptionToUrlHash: false});
var dotmapsServerHost = parseConfigOption({optionName: "dotmapsServerHost", optionDefaultValue: "https://dotmaptiles.createlab.org/", exposeOptionToUrlHash: false});
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
var stdWebMercatorNorth = 85.05113006405742; // Northern most latitude for standard Web Mercator
var landsatMaxScale = (landsatVersion == "2015") ? 1.25 : 0.45;
if (window.devicePixelRatio > 1) {
  landsatMaxScale -= 0.21;
}
var rasterMapTileMaxScale = 80 * landsatMaxScale;
var himawariMaxScale = 0.02;
var goes16MaxScale = 0.017;
var dscovrMaxScale = 0.004;
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
var himawariWaypoints = {};
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
// This is necessary because waypoint thumbnails are generated from the Landsat set and thus the best we can show is just a solid black thumbnail
// instead of some random location that a himawari bounds corresponds to in Landsat.
var himawariWaypointThumbnailBounds = {
  xmax: 1818264.731953845,
  xmin: 1746298.8849333557,
  ymax: 1253113.3077389232,
  ymin: 1218442.2616483232
};
var storyEditor;
var activeEarthTimeLayers = [];
var timeZone = "";
var storyLoadedFromRealKeyDown = false;


// ## 1 ##
//
//// Layer variables ////
//

var /*forestAlertsTimeMachineLayer, forestAlertsNoOverlayTimeMachineLayer,*/ landsatBaseMapLayer, darkBaseMapLayer, lightBaseMapLayer, mcrmVectorLayer, countryLabelMapLayer, cityLabelMapLayer;
var hansenMapLayer, hansenMapLayer2, animatedHansenLayer, himawariTimeMachineLayer;
//var ndviAnomalyTimeMachineLayer;
//var crwTimeMachineLayer
// var waterOccurrenceLayer, waterChangeLayer;
//var usgsWindTurbineLayer, solarInstallsLayer, drillingLayer;
var goes16TimeMachineLayer, goes16Aug2018TimeMachineLayer, goes16Nov2018TimeMachineLayer, dscovrTimeMachineLayer;
//var annualGlobalPm25TimeMachineLayer;
//var globalWindPowerLayer;
//Timelines.setTimeLine('global-wind-power-times', '1984', '2018', 1);
var annualRefugeesLayer;
var annualReturnsLayer;
// var vsiLayer;
//var healthImpactLayer;
//var zikaLayer, dengueLayer, chikuLayer;
//var viirsLayer;
//var wdpaLayer;
var seaLevelRiseLayer;
////var tintedSeaLevelRiseLayer;
//var urbanFragilityLayer;
////var coralBleachingLayer;
var monthlyRefugeesLayer;
//var gtdLayer;
//var hivLayer;
//var obesityLayer;
//var vaccineConfidenceLayer;
//var ebolaDeathsLayer;
//var ebolaCasesLayer;
//var ebolaNewCasesLayer;
var lodesLayer;
var cumulativeActiveMiningLayer;
var iomIdpLayer;
//var berkeleyEarthTemperatureAnomalyTimeMachineLayer;
//var berkeleyEarthTemperatureAnomalyV2YearlyTimeMachineLayer;
var landBorderLayer;
//var uppsalaConflictLayer;
//var omiNo2Layer;
var chinaAviationLayer;
var chinaPowerPlantsLayer;
var chinaReservoirsLayer;
Timelines.setTimeLine('china-reservoirs-times', '1950', '2012', 1);
var chinaWasteTreatmentPlantsLayer;
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

// S&P Shipping
var spCrudeLayer;
Timelines.setTimeLine('sp-crude-times', '2013', '2018', 1);

var spCrudeLayerOceania;
var spCrudeLayerAG;
var spCrudeLayerWAF;
var spCrudeLayerMedNAF;
var spCrudeLayerUrals;
var spCrudeLayerUSGC;
var spCrudeLayerLatAM;
var spCrudeLayerNS;

//var ecco2Layer;

//var gdpPppLayer;

////var tintedLandsatLayer;

//var gfsTimemachineLayer;
//var chlorophyllConcentrationTimemachineLayer;
//var fishingPprTimeMachineLayer;

var windVectorsLayer;

/*    var spCrudeLayerWAF;
Timelines.setTimeLine('sp-crude-times', '2013', '2018', 1);

var spCrudeLayerNAF;
Timelines.setTimeLine('sp-crude-times', '2013', '2018', 1);
var spCrudeLayerME;
Timelines.setTimeLine('sp-crude-times', '2013', '2018', 1);
var spCrudeLayerUS;
Timelines.setTimeLine('sp-crude-us-times', '2016', '2018', 1);
*/
var shipsWorker = new Worker('ships-worker.js');
shipsWorker.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    //spCrudeLayer.setBuffer(idx, new Float32Array(array));
    var data = new Float32Array(array);
    spCrudeLayer.buffers[idx].count = data.length / spCrudeLayer.buffers[idx].numAttributes;
    spCrudeLayer.buffers[idx].buffer = spCrudeLayer.gl.createBuffer();
    spCrudeLayer.gl.bindBuffer(spCrudeLayer.gl.ARRAY_BUFFER, spCrudeLayer.buffers[idx].buffer);
    gl.bufferData(spCrudeLayer.gl.ARRAY_BUFFER, data, spCrudeLayer.gl.STATIC_DRAW);
    spCrudeLayer.buffers[idx].ready = true;
  }
};

var shipsWorkerOceania = new Worker('ships-worker.js');
shipsWorkerOceania.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerOceania.buffers[idx].count = data.length / spCrudeLayerOceania.buffers[idx].numAttributes;
    spCrudeLayerOceania.buffers[idx].buffer = spCrudeLayerOceania.gl.createBuffer();
    spCrudeLayerOceania.gl.bindBuffer(spCrudeLayerOceania.gl.ARRAY_BUFFER, spCrudeLayerOceania.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerOceania.gl.ARRAY_BUFFER, data, spCrudeLayerOceania.gl.STATIC_DRAW);
    spCrudeLayerOceania.buffers[idx].ready = true;
  }
};
var shipsWorkerAG = new Worker('ships-worker.js');
shipsWorkerAG.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerAG.buffers[idx].count = data.length / spCrudeLayerAG.buffers[idx].numAttributes;
    spCrudeLayerAG.buffers[idx].buffer = spCrudeLayerAG.gl.createBuffer();
    spCrudeLayerAG.gl.bindBuffer(spCrudeLayerAG.gl.ARRAY_BUFFER, spCrudeLayerAG.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerAG.gl.ARRAY_BUFFER, data, spCrudeLayerAG.gl.STATIC_DRAW);
    spCrudeLayerAG.buffers[idx].ready = true;
  }
};
var shipsWorkerWAF = new Worker('ships-worker.js');
shipsWorkerWAF.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerWAF.buffers[idx].count = data.length / spCrudeLayerWAF.buffers[idx].numAttributes;
    spCrudeLayerWAF.buffers[idx].buffer = spCrudeLayerWAF.gl.createBuffer();
    spCrudeLayerWAF.gl.bindBuffer(spCrudeLayerWAF.gl.ARRAY_BUFFER, spCrudeLayerWAF.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerWAF.gl.ARRAY_BUFFER, data, spCrudeLayerWAF.gl.STATIC_DRAW);
    spCrudeLayerWAF.buffers[idx].ready = true;
  }
};
var shipsWorkerMedNAF = new Worker('ships-worker.js');
shipsWorkerMedNAF.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerMedNAF.buffers[idx].count = data.length / spCrudeLayerMedNAF.buffers[idx].numAttributes;
    spCrudeLayerMedNAF.buffers[idx].buffer = spCrudeLayerMedNAF.gl.createBuffer();
    spCrudeLayerMedNAF.gl.bindBuffer(spCrudeLayerMedNAF.gl.ARRAY_BUFFER, spCrudeLayerMedNAF.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerMedNAF.gl.ARRAY_BUFFER, data, spCrudeLayerMedNAF.gl.STATIC_DRAW);
    spCrudeLayerMedNAF.buffers[idx].ready = true;
  }
};
var shipsWorkerUrals = new Worker('ships-worker.js');
shipsWorkerUrals.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerUrals.buffers[idx].count = data.length / spCrudeLayerUrals.buffers[idx].numAttributes;
    spCrudeLayerUrals.buffers[idx].buffer = spCrudeLayerUrals.gl.createBuffer();
    spCrudeLayerUrals.gl.bindBuffer(spCrudeLayerUrals.gl.ARRAY_BUFFER, spCrudeLayerUrals.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerUrals.gl.ARRAY_BUFFER, data, spCrudeLayerUrals.gl.STATIC_DRAW);
    spCrudeLayerUrals.buffers[idx].ready = true;
  }
};
var shipsWorkerUSGC = new Worker('ships-worker.js');
shipsWorkerUSGC.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerUSGC.buffers[idx].count = data.length / spCrudeLayerUSGC.buffers[idx].numAttributes;
    spCrudeLayerUSGC.buffers[idx].buffer = spCrudeLayerUSGC.gl.createBuffer();
    spCrudeLayerUSGC.gl.bindBuffer(spCrudeLayerUSGC.gl.ARRAY_BUFFER, spCrudeLayerUSGC.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerUSGC.gl.ARRAY_BUFFER, data, spCrudeLayerUSGC.gl.STATIC_DRAW);
    spCrudeLayerUSGC.buffers[idx].ready = true;
  }
};
var shipsWorkerLatAM = new Worker('ships-worker.js');
shipsWorkerLatAM.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerLatAM.buffers[idx].count = data.length / spCrudeLayerLatAM.buffers[idx].numAttributes;
    spCrudeLayerLatAM.buffers[idx].buffer = spCrudeLayerLatAM.gl.createBuffer();
    spCrudeLayerLatAM.gl.bindBuffer(spCrudeLayerLatAM.gl.ARRAY_BUFFER, spCrudeLayerLatAM.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerLatAM.gl.ARRAY_BUFFER, data, spCrudeLayerLatAM.gl.STATIC_DRAW);
    spCrudeLayerLatAM.buffers[idx].ready = true;
  }
};
var shipsWorkerNS = new Worker('ships-worker.js');
shipsWorkerNS.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    var data = new Float32Array(array);
    spCrudeLayerNS.buffers[idx].count = data.length / spCrudeLayerNS.buffers[idx].numAttributes;
    spCrudeLayerNS.buffers[idx].buffer = spCrudeLayerNS.gl.createBuffer();
    spCrudeLayerNS.gl.bindBuffer(spCrudeLayerNS.gl.ARRAY_BUFFER, spCrudeLayerNS.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerNS.gl.ARRAY_BUFFER, data, spCrudeLayerNS.gl.STATIC_DRAW);
    spCrudeLayerNS.buffers[idx].ready = true;
  }
};

/*
var shipsWorkerWAF = new Worker('ships-worker.js');
shipsWorkerWAF.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    //spCrudeLayer.setBuffer(idx, new Float32Array(array));
    var data = new Float32Array(array);
    spCrudeLayerWAF.buffers[idx].count = data.length / spCrudeLayerWAF.buffers[idx].numAttributes;
    spCrudeLayerWAF.buffers[idx].buffer = spCrudeLayerWAF.gl.createBuffer();
    spCrudeLayerWAF.gl.bindBuffer(spCrudeLayerWAF.gl.ARRAY_BUFFER, spCrudeLayerWAF.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerWAF.gl.ARRAY_BUFFER, data, spCrudeLayerWAF.gl.STATIC_DRAW);
    spCrudeLayerWAF.buffers[idx].ready = true;
  }
};

var shipsWorkerNAF = new Worker('ships-worker.js');
shipsWorkerNAF.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    //spCrudeLayer.setBuffer(idx, new Float32Array(array));
    var data = new Float32Array(array);
    spCrudeLayerNAF.buffers[idx].count = data.length / spCrudeLayerNAF.buffers[idx].numAttributes;
    spCrudeLayerNAF.buffers[idx].buffer = spCrudeLayerNAF.gl.createBuffer();
    spCrudeLayerNAF.gl.bindBuffer(spCrudeLayerNAF.gl.ARRAY_BUFFER, spCrudeLayerNAF.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerNAF.gl.ARRAY_BUFFER, data, spCrudeLayerNAF.gl.STATIC_DRAW);
    spCrudeLayerNAF.buffers[idx].ready = true;
  }
};

var shipsWorkerME = new Worker('ships-worker.js');
shipsWorkerME.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    //spCrudeLayer.setBuffer(idx, new Float32Array(array));
    var data = new Float32Array(array);
    spCrudeLayerME.buffers[idx].count = data.length / spCrudeLayerME.buffers[idx].numAttributes;
    spCrudeLayerME.buffers[idx].buffer = spCrudeLayerME.gl.createBuffer();
    spCrudeLayerME.gl.bindBuffer(spCrudeLayerME.gl.ARRAY_BUFFER, spCrudeLayerME.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerME.gl.ARRAY_BUFFER, data, spCrudeLayerME.gl.STATIC_DRAW);
    spCrudeLayerME.buffers[idx].ready = true;
  }
};

var shipsWorkerUS = new Worker('ships-worker.js');
shipsWorkerUS.onmessage = function(e) {
  if (typeof e.data["idx"] != "undefined") {
    var idx = e.data.idx;
    var array = e.data["array"];
    //spCrudeLayer.setBuffer(idx, new Float32Array(array));
    var data = new Float32Array(array);
    spCrudeLayerUS.buffers[idx].count = data.length / spCrudeLayerUS.buffers[idx].numAttributes;
    spCrudeLayerUS.buffers[idx].buffer = spCrudeLayerUS.gl.createBuffer();
    spCrudeLayerUS.gl.bindBuffer(spCrudeLayerUS.gl.ARRAY_BUFFER, spCrudeLayerUS.buffers[idx].buffer);
    gl.bufferData(spCrudeLayerUS.gl.ARRAY_BUFFER, data, spCrudeLayerUS.gl.STATIC_DRAW);
    spCrudeLayerUS.buffers[idx].ready = true;
  }
};
*/

// LODES interface
var lodesGui;
var lodesOptions;

var LodesOptions = function() {
  this.doPulse = true;
  this.totalTime = 1000;
  this.dwellTime = 1000;
  this.filter = true;
  this.distance = 50.0;
  this.animate = 'animate';
  this.speed = 1;
  this.se01 = true;
  this.se02 = true;
  this.se03 = true;
};

var lodesAnimationState = {
  then: new Date(),
  inMainLoop: false,
  inStartDwell: true,
  inEndDwell: false,
  pulse: false
};

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


function initLodesGui() {
  if (lodesOptions) return;
  lodesOptions = new LodesOptions();
  // @ts-ignore
  var gui = new dat.GUI();
  // @ts-ignore
  var f1 = gui.addFolder('Animation');
  f1.add(lodesOptions, 'animate', { animate: 'animate', home: 'home', work: 'work' } );
  f1.add(lodesOptions, 'speed', { fast: 1, medium: 3, slow: 5});
  f1.open();
  // @ts-ignore
  var f2 = gui.addFolder('Distance in KM');
  f2.add(lodesOptions, 'filter');
  f2.add(lodesOptions, 'distance',10,100);
  f2.open();
  // @ts-ignore
  var f3 = gui.addFolder('Earnings per Month');
  f3.add(lodesOptions, 'se01').name('< $1251');
  f3.add(lodesOptions, 'se02').name('$1251 - $3333');
  f3.add(lodesOptions, 'se03').name('> $3333');
  f3.open();
  f3.onResize = function() {
      var el1 = document.getElementById("se01-color");
      var el2 = document.getElementById("se02-color");
      var el3 = document.getElementById("se03-color");

      if (f3.closed) {
          el1.style['display'] = 'none';
          el2.style['display'] = 'none';
          el3.style['display'] = 'none';
      } else {
          el1.style['display'] = 'block';
          el2.style['display'] = 'block';
          el3.style['display'] = 'block';
      }
  };
  // @ts-ignore
  gui.onResize = function() {
      if (gui.closed) {
          var el1 = document.getElementById("se01-color");
          var el2 = document.getElementById("se02-color");
          var el3 = document.getElementById("se03-color");

          el1.style['display'] = 'none';
          el2.style['display'] = 'none';
          el3.style['display'] = 'none';

      }
  };
  var dg = document.getElementsByClassName("dg ac")[0];
  var el = document.createElement("div");
  el["id"] = "se01-color";
  el["style"]["position"] = "absolute";
  el["style"]["width"] = "24px";
  el["style"]["height"] = "12px";
  el["style"]["top"] = "205px";
  el["style"]["right"] = "112px";
  el["style"]["backgroundColor"] = "#194BFF";
  el["style"]["zIndex"] = "100";
  dg.appendChild(el);

  var el = document.createElement("div");
  el["id"] = "se02-color";
  el["style"]["position"] = "absolute";
  el["style"]["width"] = "24px";
  el["style"]["height"] = "12px";
  el["style"]["top"] = "233px";
  el["style"]["right"] = "112px";
  el["style"]["backgroundColor"] = "#148A09";
  el["style"]["zIndex"] = "100";
  dg.appendChild(el);

  var el = document.createElement("div");
  el["id"] = "se03-color";
  el["style"]["position"] = "absolute";
  el["style"]["width"] = "24px";
  el["style"]["height"] = "12px";
  el["style"]["top"] = "261px";
  el["style"]["right"] = "112px";
  el["style"]["backgroundColor"] = "#E31E1E";
  el["style"]["zIndex"] = "100";
  dg.appendChild(el);
  dg["style"]["display"] = "none";

}

// ## 2 ##
//// Layer tile paths
//

//var fishingPprTimeMachineUrl = rootTilePath + "/fishing-ppr.timemachine/crf19-8fps-1424x800";
//var crwTimeMachineUrl = rootTilePath + "/coral/coralreefwatch-3.timemachine/crf20-22fps-1424x800";
//var ndviAnomalyTimeMachineUrl = rootTilePath + "/ndvi_anomaly_1000v01/1068x600";
var himawariTimeMachineUrl = gEarthTime.rootTilePath + "/himawari8/himawari8-nov-2015.timemachine/crf26-12fps-1424x800";
var goes16TimeMachineUrl = gEarthTime.rootTilePath + "/goes16/2017-09-01.timemachine/crf26-12fps-1424x800";
var goes16Aug2018TimeMachineUrl = gEarthTime.rootTilePath + "/goes16/2018-08-01.timemachine/crf26-12fps-1424x800";
var goes16Nov2018TimeMachineUrl = gEarthTime.rootTilePath + "/goes16/2018-11-01.timemachine/crf26-12fps-1424x800";
var dscovrTimeMachineUrl = gEarthTime.rootTilePath + "/dscovr/dscovr.timemachine/crf26-6fps-1424x800";
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

//var wdpaUrl = rootTilePath + "/wdpaline-year/{z}/{x}/{y}.bin";
var mcrmUrl = gEarthTime.rootTilePath + "/coral/mcrm-lines-wrapdateline/{z}/{x}/{y}.bin";

//var viirsUrl = rootTilePath + "/viirs/viirs_20140817-20170917.bin";

///var coralBleachingUrl = gEarthTime.rootTilePath + "/coral/{z}/{x}/{y}.bin";
//var usgsWindTurbineUrl = rootTilePath + "/energy/wind-installs-usgs/{z}/{x}/{y}.bin";
//var solarInstallsUrl = rootTilePath + "/energy/solar-installs/{z}/{x}/{y}.bin";
//var globalWindPowerUrl = rootTilePath + "/energy/global-wind-power/windfarms-world_20180330.bin";
//var drillingUrl = rootTilePath + "/energy/drilling/{z}/{x}/{y}.bin";
var animatedHansenUrls = [gfcTransUrl, gfcLossGainUrl];
var monthlyRefugeesUrl = gEarthTime.rootTilePath + '/monthly-mediterranean-refugees/{z}/{x}/{y}.bin';

var annualRefugeesUrl = gEarthTime.rootTilePath + "/annual-refugees/{z}/{x}/{y}.bin";
if (subsampleAnnualRefugees) {
  annualRefugeesUrl = gEarthTime.rootTilePath + "/annual-refugees/subsampled/{z}/{x}/{y}.bin";
}
var annualReturnsUrl =  gEarthTime.rootTilePath + "/annual-returns/refugee-returns.bin";
if (subsampleAnnualReturns) {
  annualReturnsUrl = gEarthTime.rootTilePath + "/annual-returns/refugee-returns-subsampled.bin";
}

// var vsiUrl = rootTilePath + "/vsi/tiles/{default}/{z}/{x}/{y}.png";
var healthImpactUrl = gEarthTime.rootTilePath + "/health-impact/{z}/{x}/{y}.bin";
//var zikaUrl = rootTilePath + "/pandemics/zika/{z}/{x}/{y}.bin";
//var dengueUrl = rootTilePath + "/pandemics/dengue/{z}/{x}/{y}.bin";
//var chikuUrl = rootTilePath + "/pandemics/chiku/{z}/{x}/{y}.bin";

var seaLevelRiseUrl = gEarthTime.rootTilePath + "/sea-level-rise/201704_lockin_animated_land/{z}/{x}/{y}.png"; //"http://a.ss2tiles.climatecentral.org/lockin_animated_land/{z}/{x}/{y}.png";
//var urbanFragilityUrl = rootTilePath + "/urban-fragility/{z}/{x}/{y}.bin";
//var gtdUrl = rootTilePath + "/gtd/{z}/{x}/{y}.bin";
//var hivUrl = rootTilePath + "/hiv/{z}/{x}/{y}.bin";
//var obesityUrl = rootTilePath + "/obesity/{z}/{x}/{y}.geojson";
//var vaccineConfidenceUrl = rootTilePath + "/vaccine-confidence/{z}/{x}/{y}.geojson";
//var ebolaDeathsUrl = rootTilePath + "/ebola/deaths/{z}/{x}/{y}.bin";
//var ebolaCasesUrl = rootTilePath + "/ebola/cases/{z}/{x}/{y}.bin";
//var ebolaNewCasesUrl = rootTilePath + "/ebola/new-cases/{z}/{x}/{y}.bin";

var lodesUrl = gEarthTime.rootTilePath + "/lodes/lodes-10/{z}/{x}/{y}.bin";

var cumulativeActiveMiningUrl = "https://storage.googleapis.com/skytruth-data/color_test_cumulativeActiveMining-FOOTPRINT/{z}/{x}/{y}.png";

var iomIdpUrl = gEarthTime.rootTilePath + "/iom-idp/idp-returns.geojson";
var landBorderUrl = gEarthTime.rootTilePath + "/land-borders2/{default}/{z}/{x}/{y}.png";

//var uppsalaConflictUrl = rootTilePath + "/ucdp/uppsala-conflict.bin";

//var omiNo2Url = rootTilePath + "/omi-no2/omi-no2.timemachine/crf24-12fps-1424x800";

var chinaAviationUrl = gEarthTime.rootTilePath + "/china-infrastructure/china-aviation.bin";
var chinaPowerPlantsUrl = gEarthTime.rootTilePath + "/china-infrastructure/china-power-plants.bin";
var chinaReservoirsUrl = gEarthTime.rootTilePath + "/china-infrastructure/china-reservoirs.bin";
var chinaWasteTreatmentPlantsUrl = gEarthTime.rootTilePath + "/china-infrastructure/china-waste-treatment-plants.bin";

//var bePm25Url = rootTilePath + "/be-pm25/be-pm25.timemachine/crf24-22fps-1424x800";

//var expandingCitiesUrl = rootTilePath + "/expandingCities/expandingCities.bin";

//var irenaSolarUrl = 'https://data.cmucreatelab.org/earthtime/IRENA/Solar.Electricity_capacity_MW.csv';
//var irenaWindUrl = 'https://data.cmucreatelab.org/earthtime/IRENA/Wind.Electricity_capacity_MW.csv';

//var tsipUrl = rootTilePath + "/tsip/tsip.bin";

var spCrudeUrl = gEarthTime.rootTilePath + "/sp-crude/0-crude-flows.bin";
var spCrudeUrlOceania = gEarthTime.rootTilePath + "/sp-crude/Oceania/0-crude-flows_Oceania.bin";
var spCrudeUrlAG = gEarthTime.rootTilePath + "/sp-crude/AG/0-crude-flows_AG.bin";
var spCrudeUrlWAF = gEarthTime.rootTilePath + "/sp-crude/WAF/0-crude-flows_WAF.bin";
var spCrudeUrlMedNAF = gEarthTime.rootTilePath + "/sp-crude/MedNAF/0-crude-flows_MedNAF.bin";
var spCrudeUrlUrals = gEarthTime.rootTilePath + "/sp-crude/Urals/0-crude-flows_Urals.bin";
var spCrudeUrlUSGC = gEarthTime.rootTilePath + "/sp-crude/USGC/0-crude-flows_USGC.bin";
var spCrudeUrlLatAM = gEarthTime.rootTilePath + "/sp-crude/LatAM/0-crude-flows_LatAM.bin";
var spCrudeUrlNS = gEarthTime.rootTilePath + "/sp-crude/NS/0-crude-flows_NS.bin";
//var ecco2Url = rootTilePath + "/oceans/ecco2.timemachine/crf26-16fps-1424x800";
//var gdpPppUrl = rootTilePath + "/economics/gdp_ppp.timemachine/crf26-10fps-1424x800";

//var gfsTimemachineUrl = rootTilePath + "/gfs-timemachine.timemachine/crf24-12fps-1424x800";

var windVectorsUrl = gEarthTime.rootTilePath + "/wind/test.json";

//var chlorophyllConcentrationTimemachineUrl = rootTilePath + "/chlorophyll_concentration.timemachine/crf24-12fps-1424x800";

/*
var spCrudeUrlWAF = rootTilePath + "/sp-crude/0-crude-flows_WAF.bin"
var spCrudeUrlNAF = rootTilePath + "/sp-crude/0-crude-flows_NAF.bin"
var spCrudeUrlME = rootTilePath + "/sp-crude/0-crude-flows_ME.bin"
var spCrudeUrlUS = rootTilePath + "/sp-crude/0-crude-flows_US.bin"
*/

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
    var layerProxy = gEarthTime.layerDB.getLayer(layerId);
    if (layerProxy) {
      layerProxies.push(layerProxy);
    } else {
      console.log(`${Utils.logPrefix()} handlelayers: Cannot find layer ${layerId}`);
    }
  }
  gEarthTime.layerDB.setVisibleLayers(layerProxies);

  // // Clear out all layers that were checked
  // $(".map-layer-div").find("input[type='checkbox']:checked").trigger("click");
  // gEarthTime.timelapse.hideSpinner("timeMachine");
  // if (!layers) {
  //   activeEarthTimeLayers = [];
  // }

  // var layerExtraId = layers.find(function(layer) {
  //   return (layer.indexOf("extras_") == 0 || layer.indexOf("e-") == 0);
  // });

  // if (layerExtraId) {
  //   setTimeout(function() {
  //     $('#extras-selector-menu li[data-name="' + layerExtraId + '"]').click();
  //   }, 100);
  //   return;
  // }

  // layers.forEach(function(layer) {
  //   var $layerToggle = $("#layers-list label[name='" + layer + "'] input");
  //   if (!$layerToggle.prop('checked')) $layerToggle.trigger("click");
  // });

  // // If a layer set does not include a base map and the layer in question is not
  // // also a base layer, add it to layer list.
  // if (layers.length == 1) {
  //   var baseLayerIds = $("#category-base-layers").find("label").map(function() {
  //     return $(this).attr("name");
  //   });
  //   if ($.inArray(visibleBaseMapLayer, baseLayerIds) >= 0) {
  //     var selectedBaseLayerId = $("#category-base-layers").find(":checked").parent().attr("name");
  //     if (layers.indexOf(selectedBaseLayerId) == -1) {
  //       layers.unshift(selectedBaseLayerId);
  //       if (activeEarthTimeLayers.indexOf(selectedBaseLayerId) == -1) {
  //         activeEarthTimeLayers.unshift(selectedBaseLayerId);
  //       }
  //     }
  //   }
  // }

  // // Hack
  // // TODO: Revist toggling of CSV layers that did not have a timeline
  // if ((layers.length <= 1 || activeLayersWithTimeline <= 1) & visibleBaseMapLayer == "blsat") {
  //   doSwitchToLandsat();
  // }
}

function initLayerToggleUI() {
  // ## 3 ##
  //// Layer toggle event handlers ////

  $("#show-forest-change").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      hansenMapLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-forest-loss-gain").prop('checked')) {
        $("#show-forest-loss-gain").click();
      }
      if ($("#show-animated-forest-loss-gain").prop('checked')) {
        $("#show-animated-forest-loss-gain").click();
      }
      if ($("#show-forest-alerts").prop('checked')) {
        $("#show-forest-alerts").click();
      }
      if ($("#show-forest-alerts-no-overlay").prop('checked')) {
        $("#show-forest-alerts-no-overlay").click();
      }
      showHansenLayer = true;
      $("#forest-loss-year-legend").show();
    } else {
      showHansenLayer = false;
      cacheLastUsedLayer(hansenMapLayer);
      $("#forest-loss-year-legend").hide();
    }
  }).prop('checked', showHansenLayer);

  $("#show-forest-loss-gain").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      hansenMapLayer2.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-forest-change").prop('checked')) {
        $("#show-forest-change").click();
      }
      if ($("#show-animated-forest-loss-gain").prop('checked')) {
        $("#show-animated-forest-loss-gain").click();
      }
      if ($("#show-forest-alerts").prop('checked')) {
        $("#show-forest-alerts").click();
      }
      if ($("#show-forest-alerts-no-overlay").prop('checked')) {
        $("#show-forest-alerts-no-overlay").click();
      }
      showHansenLayer2 = true;
      timelineType = "none";
      $("#forest-loss-gain-legend").show();
      $("#baseLayerCreditContainer").hide();
    } else {
      showHansenLayer2 = false;
      cacheLastUsedLayer(hansenMapLayer2);
      timelineType = "customUI";
      $("#forest-loss-gain-legend").hide();
      $("#baseLayerCreditContainer").show();
    }
  }).prop('checked', showHansenLayer2);

  $("#show-animated-forest-loss-gain").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      //animatedHansenLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-forest-change").prop('checked')) {
        $("#show-forest-change").click();
      }
      if ($("#show-forest-loss-gain").prop('checked')) {
        $("#show-forest-loss-gain").click();
      }
      if ($("#show-forest-alerts").prop('checked')) {
        $("#show-forest-alerts").click();
      }
      if ($("#show-forest-alerts-no-overlay").prop('checked')) {
        $("#show-forest-alerts-no-overlay").click();
      }
      showAnimatedHansenLayer = true;
      setActiveLayersWithTimeline(1);
      /*
      if (!showViirsLayer) {
        timelineType = "customUI";
        requestNewTimeline("animated-forest-loss-gain-times.json", timelineType);
      }
      */
      $("#forest-loss-gain-legend").show();
    } else {
      showAnimatedHansenLayer = false;
      cacheLastUsedLayer(animatedHansenLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      $("#forest-loss-gain-legend").hide();
    }
  }).prop('checked', showAnimatedHansenLayer);

  /*$("#show-coral").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      coralBleachingLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      mcrmVectorLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-coral-bleaching-alerts").prop('checked')) {
        $("#show-coral-bleaching-alerts").click();
      }
      showCoralBleachingLayer = true;
      setActiveLayersWithTimeline(1);
      showMcrmLayer = true;
      timelineType = "customUI";
      $("#coral-bleaching-legend").show();
    } else {
      showCoralBleachingLayer = false;
      cacheLastUsedLayer(coralBleachingLayer);
      showMcrmLayer = false;
      cacheLastUsedLayer(mcrmVectorLayer);
      setActiveLayersWithTimeline(-1);
      // @ts-ignore
      if (!enableMuseumMode || EarthlapseUI.Modes.getCurrentMode() == "explore") {
        doSwitchToLandsat();
      }
      if (!$("#show-coral-bleaching-alerts").prop('checked')) {
        $("#coral-bleaching-legend").hide();
      }
    }
  }).prop('checked', showCoralBleachingLayer);*/

  $("#show-himawari").on("click", function() {
    //$(".current-location-text-container").hide();
    //$(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight").removeClass("thumbnail_highlight");

    var $this = $(this);
    if ($this.prop('checked')) {
      himawariTimeMachineLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      // Clear out non-himawari8 layers if they were already active.
      var $activeLayersNotIncludingClickedLayer = $(".map-layer-div").find("input:checked").not($(this));
      if ($activeLayersNotIncludingClickedLayer.length > 1) {
        $activeLayersNotIncludingClickedLayer.trigger("click");
      }
      showHimawariTimeMachineLayer = true;
      activeLayersWithTimeline = 1;
      previousActiveLayersWithTimeline = activeLayersWithTimeline;
      timelineType = "defaultUI";
      previousVisibleBaseMapLayer = visibleBaseMapLayer;
      visibleBaseMapLayer = "himawari";
      requestNewTimeline("himawari-times.json", timelineType);
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(12);
      gEarthTime.timelapse.setMaxScale(himawariMaxScale);
      gEarthTime.timelapse.setDoDwell(false);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(1);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (landsatVersion == "2016") {
        $.getScript("himawari_landsat_ajax_includes.js")
          .done(function(script, status) {
            eval(script);
            landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
          }
        );
      }
      $("#baselayerCreditText").html("&copy; JMA");
    } else {
      showHimawariTimeMachineLayer = false;
      cacheLastUsedLayer(himawariTimeMachineLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(10);
      gEarthTime.timelapse.seek(0);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (!$(".timemachine").prop('checked')) {
        if (landsatVersion == "2016") {
          $.getScript(landsatAjaxIncludesPath)
            .done(function(script, status) {
              eval(script);
              landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
            }
          );
        }
      }
    }
    gEarthTime.timelapse.warpTo(gEarthTime.timelapse.getHomeView());
  }).prop('checked', showHimawariTimeMachineLayer);

  $("#show-goes16").on("click", function() {
    //$(".current-location-text-container").hide();
    //$(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight").removeClass("thumbnail_highlight");

    var $this = $(this);
    if ($this.prop('checked')) {
      goes16TimeMachineLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      // Clear out non-goes16 layers if they were already active.
      var $activeLayersNotIncludingClickedLayer = $(".map-layer-div").find("input:checked").not($(this));
      if ($activeLayersNotIncludingClickedLayer.length > 1) {
        $activeLayersNotIncludingClickedLayer.trigger("click");
      }
      showGoes16TimeMachineLayer = true;
      activeLayersWithTimeline = 1;
      previousActiveLayersWithTimeline = activeLayersWithTimeline;
      timelineType = "defaultUI";
      previousVisibleBaseMapLayer = visibleBaseMapLayer;
      visibleBaseMapLayer = "goes16";
      requestNewTimeline("goes16-times.json", timelineType);
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(12);
      gEarthTime.timelapse.setMaxScale(goes16MaxScale);
      gEarthTime.timelapse.setDoDwell(false);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(1);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (landsatVersion == "2016") {
        $.getScript("himawari_landsat_ajax_includes.js")
          .done(function(script, status) {
            eval(script);
            landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
          }
        );
      }
      $("#baselayerCreditText").html("&copy; NOAA");
    } else {
      showGoes16TimeMachineLayer = false;
      cacheLastUsedLayer(goes16TimeMachineLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(10);
      gEarthTime.timelapse.seek(0);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (!$(".timemachine").prop('checked')) {
        if (landsatVersion == "2016") {
          $.getScript(landsatAjaxIncludesPath)
            .done(function(script, status) {
              eval(script);
              landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
            }
          );
        }
      }
    }
    gEarthTime.timelapse.warpTo(gEarthTime.timelapse.getHomeView());
  }).prop('checked', showGoes16TimeMachineLayer);

  $("#show-goes16-aug-2018").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      goes16Aug2018TimeMachineLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      // Clear out non-goes16 layers if they were already active.
      var $activeLayersNotIncludingClickedLayer = $(".map-layer-div").find("input:checked").not($(this));
      if ($activeLayersNotIncludingClickedLayer.length > 1) {
        $activeLayersNotIncludingClickedLayer.trigger("click");
      }
      showGoes16Aug2018TimeMachineLayer = true;
      activeLayersWithTimeline = 1;
      previousActiveLayersWithTimeline = activeLayersWithTimeline;
      timelineType = "defaultUI";
      previousVisibleBaseMapLayer = visibleBaseMapLayer;
      visibleBaseMapLayer = "goes16-aug-2018";
      requestNewTimeline("goes16-aug-2018-times.json", timelineType);
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(12);
      gEarthTime.timelapse.setMaxScale(goes16MaxScale);
      gEarthTime.timelapse.setDoDwell(false);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(1);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (landsatVersion == "2016") {
        $.getScript("himawari_landsat_ajax_includes.js")
          .done(function(script, status) {
            eval(script);
            landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
          }
        );
      }
      $("#baselayerCreditText").html("&copy; NOAA");
    } else {
      showGoes16Aug2018TimeMachineLayer = false;
      cacheLastUsedLayer(goes16Aug2018TimeMachineLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(10);
      gEarthTime.timelapse.seek(0);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (!$(".timemachine-layer").prop('checked')) {
        if (landsatVersion == "2016") {
          $.getScript(landsatAjaxIncludesPath)
            .done(function(script, status) {
              eval(script);
              landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
            }
          );
        }
      }
    }
    gEarthTime.timelapse.warpTo(gEarthTime.timelapse.getHomeView());
  }).prop('checked', showGoes16Aug2018TimeMachineLayer);

  $("#show-goes16-nov-2018").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      goes16Nov2018TimeMachineLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      // Clear out non-goes16 layers if they were already active.
      var $activeLayersNotIncludingClickedLayer = $(".map-layer-div").find("input:checked").not($(this));
      if ($activeLayersNotIncludingClickedLayer.length > 1) {
        $activeLayersNotIncludingClickedLayer.trigger("click");
      }
      showGoes16Nov2018TimeMachineLayer = true;
      activeLayersWithTimeline = 1;
      previousActiveLayersWithTimeline = activeLayersWithTimeline;
      timelineType = "defaultUI";
      previousVisibleBaseMapLayer = visibleBaseMapLayer;
      visibleBaseMapLayer = "goes16-nov-2018";
      requestNewTimeline("goes16-nov-2018-times.json", timelineType);
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(12);
      gEarthTime.timelapse.setMaxScale(goes16MaxScale);
      gEarthTime.timelapse.setDoDwell(false);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(1);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (landsatVersion == "2016") {
        $.getScript("himawari_landsat_ajax_includes.js")
          .done(function(script, status) {
            eval(script);
            landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
          }
        );
      }
      $("#baselayerCreditText").html("&copy; NOAA");
    } else {
      showGoes16Nov2018TimeMachineLayer = false;
      cacheLastUsedLayer(goes16Nov2018TimeMachineLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(10);
      gEarthTime.timelapse.seek(0);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (!$(".timemachine-layer").prop('checked')) {
        if (landsatVersion == "2016") {
          $.getScript(landsatAjaxIncludesPath)
            .done(function(script, status) {
              eval(script);
              landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
            }
          );
        }
      }
    }
    gEarthTime.timelapse.warpTo(gEarthTime.timelapse.getHomeView());
  }).prop('checked', showGoes16Nov2018TimeMachineLayer);

  $("#show-dscovr").on("click", function() {
    //$(".current-location-text-container").hide();
    //$(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation.thumbnail_highlight").removeClass("thumbnail_highlight");

    var $this = $(this);
    if ($this.prop('checked')) {
      dscovrTimeMachineLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      // Clear out non-dscovr layers if they were already active.
      var $activeLayersNotIncludingClickedLayer = $(".map-layer-div").find("input:checked").not($(this));
      if ($activeLayersNotIncludingClickedLayer.length > 1) {
        $activeLayersNotIncludingClickedLayer.trigger("click");
      }
      showDscovrTimeMachineLayer = true;
      activeLayersWithTimeline = 1;
      previousActiveLayersWithTimeline = activeLayersWithTimeline;
      timelineType = "defaultUI";
      previousVisibleBaseMapLayer = visibleBaseMapLayer;
      visibleBaseMapLayer = "dscovr";
      requestNewTimeline("dscovr-times.json", timelineType);
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(6);
      gEarthTime.timelapse.seek(0);
      gEarthTime.timelapse.setMaxScale(dscovrMaxScale);
      gEarthTime.timelapse.setDoDwell(false);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(1);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (landsatVersion == "2016") {
        $.getScript("himawari_landsat_ajax_includes.js")
          .done(function(script, status) {
            eval(script);
            landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
          }
        );
      }
      $("#baselayerCreditText").html("&copy; NOAA");
    } else {
      showDscovrTimeMachineLayer = false;
      cacheLastUsedLayer(dscovrTimeMachineLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      var v = gEarthTime.timelapse.getVideoset();
      v.setFps(10);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      $("#layers-legend").hide();
      // Handle Landsat 2016 bounds.
      if (!$("#show-goes16").prop('checked') && !$("#show-himawari").prop('checked')) {
        if (landsatVersion == "2016") {
          $.getScript(landsatAjaxIncludesPath)
            .done(function(script, status) {
              eval(script);
              landsatBaseMapLayer.resetDimensions(cached_ajax["./1068x600/r.json"]);
            }
          );
        }
      }
    }
    gEarthTime.timelapse.warpTo(gEarthTime.timelapse.getHomeView());
  }).prop('checked', showDscovrTimeMachineLayer);

  $("#show-monthly-refugees").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      monthlyRefugeesLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-annual-refugees").prop('checked')) {
        $("#show-annual-refugees").click();
      }
      showMonthlyRefugeesLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("monthly-refugees-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.85);
      gEarthTime.timelapse.setPlaybackRate(0.425);
      gEarthTime.timelapse.setDoDwell(false);
      $("#monthly-refugees-legend").show();
    } else {
      showMonthlyRefugeesLayer = false;
      cacheLastUsedLayer(monthlyRefugeesLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      $("#monthly-refugees-legend").hide();
    }
  }).prop('checked', showMonthlyRefugeesLayer);


  $("#show-annual-refugees").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      annualRefugeesLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-monthly-refugees").prop('checked')) {
        $("#show-monthly-refugees").click();
      }
      showAnnualRefugeesLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("annual-refugees-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.045);
      gEarthTime.timelapse.setPlaybackRate(0.0225);
      $("#annual-refugees-legend").show();
    } else {
      showAnnualRefugeesLayer = false;
      cacheLastUsedLayer(annualRefugeesLayer);
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      $("#annual-refugees-legend").hide();
    }
  }).prop('checked', showAnnualRefugeesLayer);

  $("#show-annual-returns").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      annualReturnsLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-monthly-refugees").prop('checked')) {
        $("#show-monthly-refugees").click();
      }
      showAnnualReturnsLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("annual-refugees-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.045);
      gEarthTime.timelapse.setPlaybackRate(0.0225);
      $("#annual-returns-legend").show();
    } else {
      showAnnualReturnsLayer = false;
      cacheLastUsedLayer(annualReturnsLayer);
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      $("#annual-returns-legend").hide();
    }
  }).prop('checked', showAnnualReturnsLayer);

  $("#show-sea-level-rise-1p0").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      seaLevelRiseLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-sea-level-rise-1p5").prop('checked')) {
        $("#show-sea-level-rise-1p5").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-2p0").prop('checked')) {
        $("#show-sea-level-rise-2p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-4p0").prop('checked')) {
        $("#show-sea-level-rise-4p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      showSeaLevelRiseLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sea-level-rise-1p0-times.json", timelineType);
      $("#sea-level-rise-legend").show();
    } else {
      showSeaLevelRiseLayer = false;
      cacheLastUsedLayer(seaLevelRiseLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      $("#sea-level-rise-legend").hide();
    }
  }).prop('checked', showSeaLevelRiseLayer);

  $("#show-sea-level-rise-1p5").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      seaLevelRiseLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-sea-level-rise-1p0").prop('checked')) {
        $("#show-sea-level-rise-1p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-2p0").prop('checked')) {
        $("#show-sea-level-rise-2p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-4p0").prop('checked')) {
        $("#show-sea-level-rise-4p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      showSeaLevelRiseLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sea-level-rise-1p5-times.json", timelineType);
      $("#sea-level-rise-legend").show();
    } else {
      showSeaLevelRiseLayer = false;
      cacheLastUsedLayer(seaLevelRiseLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      $("#sea-level-rise-legend").hide();
    }
  }).prop('checked', showSeaLevelRiseLayer);

  $("#show-sea-level-rise-2p0").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      seaLevelRiseLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-sea-level-rise-1p0").prop('checked')) {
        $("#show-sea-level-rise-1p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-1p5").prop('checked')) {
        $("#show-sea-level-rise-1p5").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-4p0").prop('checked')) {
        $("#show-sea-level-rise-4p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      showSeaLevelRiseLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sea-level-rise-2p0-times.json", timelineType);
      $("#sea-level-rise-legend").show();
    } else {
      showSeaLevelRiseLayer = false;
      cacheLastUsedLayer(seaLevelRiseLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      $("#sea-level-rise-legend").hide();
    }
  }).prop('checked', showSeaLevelRiseLayer);

  $("#show-sea-level-rise-4p0").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      seaLevelRiseLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if ($("#show-sea-level-rise-1p0").prop('checked')) {
        $("#show-sea-level-rise-1p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-2p0").prop('checked')) {
        $("#show-sea-level-rise-2p0").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      if ($("#show-sea-level-rise-1p5").prop('checked')) {
        $("#show-sea-level-rise-1p5").prop('checked', false);
        setActiveLayersWithTimeline(-1);
      }
      showSeaLevelRiseLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sea-level-rise-times.json", timelineType);
      $("#sea-level-rise-legend").show();
    } else {
      showSeaLevelRiseLayer = false;
      cacheLastUsedLayer(seaLevelRiseLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      $("#sea-level-rise-legend").hide();
    }
  }).prop('checked', showSeaLevelRiseLayer);

  $("#show-lodes").on("click", function() {
    initLodesGui();
    var dg = document.getElementsByClassName("dg ac")[0];
    var $this = $(this);
    if ($this.prop('checked')) {
      lodesLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      if (visibleBaseMapLayer != "blte") {
        $("#blte-base").click();
      }
      dg["style"]["display"] = "block";
      showLodesLayer = true;
      timelineType = "none";
      $("#lodes-legend").show();
    } else {
      showLodesLayer = false;
      cacheLastUsedLayer(lodesLayer);
      dg["style"]["display"] = "none";
      doSwitchToLandsat();
      $("#lodes-legend").hide();
    }
  }).prop('checked', showLodesLayer);

  $("#show-cumulative-active-mining").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      cumulativeActiveMiningLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showCumulativeActiveMiningLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      $("#cumulative-active-mining-legend").show();
    } else {
      showCumulativeActiveMiningLayer = false;
      cacheLastUsedLayer(cumulativeActiveMiningLayer);
      setActiveLayersWithTimeline(-1);
      $("#cumulative-active-mining-legend").hide();
    }
  }).prop('checked', showCumulativeActiveMiningLayer);

  $("#show-iraq-iom-idp").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("iraq-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showIrqIdps'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showIrqIdps'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-syria-iom-idp").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("syria-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showSyrIdps'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showSyrIdps'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-yemen-iom-idp").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("yemen-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showYemIdps'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showYemIdps'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-libya-iom-idp").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("libya-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showLbyIdps'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showLbyIdps'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-iraq-iom-return").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("iraq-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showIrqReturns'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      setActiveLayersWithTimeline(-1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showIrqReturns'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-syria-iom-return").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("syria-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showSyrReturns'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      timelineType = "customUI";
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showSyrReturns'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-yemen-iom-return").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("yemen-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showYemReturns'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      timelineType = "customUI";
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showYemReturns'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-libya-iom-return").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      iomIdpLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showIomIdpLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline("libya-iom-idp-times.json", timelineType);
      $("#iom-idp-legend").show();
      iomIdpLayer.options['showLbyReturns'] = true;
      gEarthTime.timelapse.setMasterPlaybackRate(0.5);
      gEarthTime.timelapse.setPlaybackRate(0.1);
    } else {
      showIomIdpLayer = false;
      timelineType = "customUI";
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      if (!$("#show-iraq-iom-idp").prop('checked') && !$("#show-syria-iom-idp").prop('checked') && !$("#show-libya-iom-idp").prop('checked') && !$("#show-yemen-iom-idp").prop('checked') && !$("#show-iraq-iom-return").prop('checked') && !$("#show-syria-iom-return").prop('checked') && !$("#show-libya-iom-return").prop('checked') && !$("#show-yemen-iom-return").prop('checked'))
        $("#iom-idp-legend").hide();
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      iomIdpLayer.options['showLbyReturns'] = false;
      if (Object.values(iomIdpLayer.options).indexOf(true) == -1) {
        iomIdpLayer.destroy();
      }
    }
  }).prop('checked', showIomIdpLayer);

  $("#show-china-aviation").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      chinaAviationLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showChinaAviationLayer = true;
      $("#china-aviation-legend").show();
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
    } else {
      showChinaAviationLayer = false;
      cacheLastUsedLayer(chinaAviationLayer);
      $("#china-aviation-legend").hide();
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
    }
  }).prop('checked', showChinaAviationLayer);

  $("#show-china-power-plants").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      chinaPowerPlantsLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showChinaPowerPlantsLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      //requestNewTimeline("china-power-plants-times.json", timelineType);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      $("#china-power-plants-legend").show();
    } else {
      showChinaPowerPlantsLayer = false;
      cacheLastUsedLayer(chinaPowerPlantsLayer);
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      $("#china-power-plants-legend").hide();
    }
  }).prop('checked', showChinaPowerPlantsLayer);

  $("#show-china-reservoirs").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      chinaReservoirsLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showChinaReservoirsLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("china-reservoirs-times.json", timelineType);
      $("#china-reservoirs-legend").show();
    } else {
      showChinaReservoirsLayer = false;
      cacheLastUsedLayer(chinaReservoirsLayer);
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      $("#china-reservoirs-legend").hide();
    }
  }).prop('checked', showChinaReservoirsLayer);

  $("#show-china-waste-treatment-plants").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      chinaWasteTreatmentPlantsLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showChinaWasteTreatmentPlantsLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      //requestNewTimeline("china-waste-treatment-plants-times.json", timelineType);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);

      $("#china-waste-treatment-plants-legend").show();
    } else {
      showChinaWasteTreatmentPlantsLayer = false;
      cacheLastUsedLayer(chinaWasteTreatmentPlantsLayer);
      setActiveLayersWithTimeline(-1);
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);
      $("#china-waste-treatment-plants-legend").hide();
    }
  }).prop('checked', showChinaWasteTreatmentPlantsLayer);

  $("#show-sp-crude").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayer = false;
      cacheLastUsedLayer(spCrudeLayer);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude").prop('checked')) {
        $("#sp-crude-legend").hide();
      }
    }
  }).prop('checked', showSpCrudeLayer);

  $("#show-sp-crude_Oceania").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerOceania.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerOceania = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_Oceania").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerOceania = false;
      cacheLastUsedLayer(spCrudeLayerOceania);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_Oceania").prop('checked')) {
        $("#sp-crude-legend_Oceania").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerOceania);

  $("#show-sp-crude_AG").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerAG.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerAG = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_AG").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerAG = false;
      cacheLastUsedLayer(spCrudeLayerAG);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_AG").prop('checked')) {
        $("#sp-crude-legend_AG").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerAG);

  $("#show-sp-crude_WAF").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerWAF.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerWAF = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_WAF").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerWAF = false;
      cacheLastUsedLayer(spCrudeLayerWAF);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_WAF").prop('checked')) {
        $("#sp-crude-legend_WAF").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerWAF);

  $("#show-sp-crude_MedNAF").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerMedNAF.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerMedNAF = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_MedNAF").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerMedNAF = false;
      cacheLastUsedLayer(spCrudeLayerMedNAF);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_MedNAF").prop('checked')) {
        $("#sp-crude-legend_MedNAF").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerMedNAF);

  $("#show-sp-crude_Urals").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerUrals.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerUrals = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_Urals").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerUrals = false;
      cacheLastUsedLayer(spCrudeLayerUrals);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_Urals").prop('checked')) {
        $("#sp-crude-legend_Urals").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerUrals);

  $("#show-sp-crude_USGC").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerUSGC.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerUSGC = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_USGC").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerUSGC = false;
      cacheLastUsedLayer(spCrudeLayerUSGC);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_USGC").prop('checked')) {
        $("#sp-crude-legend_USGC").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerUSGC);

  $("#show-sp-crude_LatAM").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerLatAM.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerLatAM = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_LatAM").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerLatAM = false;
      cacheLastUsedLayer(spCrudeLayerLatAM);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_LatAM").prop('checked')) {
        $("#sp-crude-legend_LatAM").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerLatAM);

  $("#show-sp-crude_NS").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      spCrudeLayerNS.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showSpCrudeLayerNS = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("sp-crude-times.json", timelineType);
      gEarthTime.timelapse.setMasterPlaybackRate(0.005);
      gEarthTime.timelapse.setPlaybackRate(0.00225);
      $("#sp-crude-legend_NS").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showSpCrudeLayerNS = false;
      cacheLastUsedLayer(spCrudeLayerNS);
      gEarthTime.timelapse.setMasterPlaybackRate(1);
      gEarthTime.timelapse.setPlaybackRate(defaultPlaybackSpeed);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-sp-crude_NS").prop('checked')) {
        $("#sp-crude-legend_NS").hide();
      }
    }
  }).prop('checked', showSpCrudeLayerNS);

  $("#show-wind-vectors").on("click", function() {
    var $this = $(this);
    if ($this.prop('checked')) {
      windVectorsLayer.getTileView().handleTileLoading({layerDomId: $this[0].id});
      showWindVectorsLayer = true;
      setActiveLayersWithTimeline(1);
      timelineType = "customUI";
      requestNewTimeline("wind-vectors-times.json", timelineType);
      $("#wind-vectors-legend").show();
      if (visibleBaseMapLayer != "bdrk") {
        $("#bdrk-base").click();
      }
    } else {
      showWindVectorsLayer = false;
      cacheLastUsedLayer(windVectorsLayer);
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
      if (!$("#show-wind-vectors").prop('checked')) {
        $("#wind-vectors-legend").hide();
      }
    }
  }).prop('checked', showWindVectorsLayer);

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
    if (visibleBaseMapLayer == "blsat") {
      gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      // TODO: Need to rethink this
      if (activeLayersWithTimeline < 1) {
        setActiveLayersWithTimeline(1);
      }
      // TODO: This special case may be out of sync with the edge cases elsewhere in the code
      /*
      if (!showViirsLayer) {
        timelineType = "customUI";
      }
      */
    } else {
      if (previousVisibleBaseMapLayer == "bdrk" || previousVisibleBaseMapLayer == "blte") {
        timelineType = "none";
      } else {
        setActiveLayersWithTimeline(-1);
      }
      // TODO: This is only accurate if we have base layers with levels > 12.
      // It's a bit convoluted to use different scale when toggling layers on/off. Again, another reason to refactor all this...
      gEarthTime.timelapse.setMaxScale(rasterMapTileMaxScale);
    }
  });

  // Initially set activeLayersWithTimeline to 1 if we first load with landsat enabled.
  // Also set the custom scale.
  if (visibleBaseMapLayer == "blsat") {
    activeLayersWithTimeline = 1;
    gEarthTime.timelapse.setMaxScale(landsatMaxScale);
  }

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
        if (feedback.vertical == "top")
          $("#extras-selector").prepend(initialEntry);
        else
          $("#extras-selector").append(initialEntry);
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
      contentSearch.updateLayerSelectionsFromMaster();
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
    if (typeof(contentSearch) != "undefined" && contentSearch.initialized && selectedLayerName && isSelectionChecked) {
      contentSearch.updateLayerSelectionsFromMaster();
    }
    $('#layers-menu label[name=' + selectedLayerName + ']').find("input").prop("checked", isSelectionChecked);
    var fromRealKeydown = e.originalEvent && e.pageX != 0 && e.pageY != 0;
    if (fromRealKeydown && $(".current-location-text-container").is(':visible')) {
      showAnnotationResumeExit();
    }
    if (isMobileDevice || isIEButNotEdge) {
      if (visibleBaseMapLayer != "blsat" || showHansenLayer2) {
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
    var selectedLayers = $('.map-layer-checkbox').find("input:checked").not("#show-himawari, #show-goes16, #show-goes16-aug-2018, #show-goes16-nov-2018, #show-dscovr");
    // Subtract one, since base layers are included in this count but they don't use the legend.
    // @ts-ignore
    var numLayersOn = selectedLayers.size() - $("#category-base-layers").find(":checked").length;

    // Legend container toggling
    if (numLayersOn <= 0) {
      $("#layers-legend").hide();
    } else {
      $("#layers-legend").show();
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
      gEarthTime.layerDB.setVisibleLayers(layersToBeDrawn);
    } else {
      layersToBeDrawn.splice(layersToBeDrawn.indexOf(clickedLayer), 1);
      gEarthTime.layerDB.setVisibleLayers(layersToBeDrawn);
    }

    return;
    var toggledLayer = $(e.target);
    var toggledLayerId = toggledLayer.parent("label").attr("name");

    if (toggledLayerId) {
      if (toggledLayer.attr('type') == 'radio') {
        var toggledLayerGroup = $('input[name=' + toggledLayer.attr("name") + ']');
        toggledLayerGroup.each(function(idx, element) {
          var tmp = $(element).parent("label").attr("name");
          var activeLayerIdx = activeEarthTimeLayers.indexOf(tmp);
          if (activeLayerIdx >= 0) {
            activeEarthTimeLayers.splice(activeLayerIdx, 1);
          }
        });
        activeEarthTimeLayers.push(toggledLayerId);
      } else if (toggledLayer.prop("checked")) {
        activeEarthTimeLayers.push(toggledLayerId);
      } else {
        var activeLayerIdx = activeEarthTimeLayers.indexOf(toggledLayerId);
        if (activeLayerIdx >= 0) {
          activeEarthTimeLayers.splice(activeLayerIdx, 1);
        }
        if (activeEarthTimeLayers.length == 0) {
          doSwitchToLandsat();
        } else if (activeEarthTimeLayers.length == 1 && activeEarthTimeLayers.indexOf("blsat") == 0) {
          doSwitchToLandsat();
        }
      }
    }

    dateRangePicker.handleCalendarLayers(false);
    altitudeSlider.handleAltitudeLayers();

    var $layerContainer = $(e.target).parents("table");
    var $layerContainerHeader = $layerContainer.prev();
    var layerCategory = $layerContainerHeader.attr("aria-controls")
    if (layerCategory) {
      layerCategory = layerCategory.replace('-featured', '');
    }
    var ignoredLayerCategory = 'category-base-layers';
    var numLayersActiveInCurrentContainer = $layerContainer.find("input:checked").length;
    var layersListTopPos = featuredTheme ? $("#layers-list").position().top : 0;
    // Note: >1 because we ignore Base layers
    if ($('.map-layer-div').find("input:checked").length > 1) {
      $(".clearLayers").show();
    } else {
      $(".clearLayers").hide();
    }

    // Add indicator that a layer is on in a category but ignore the first category (base layers)
    if ($layerContainerHeader.length && layerCategory && layerCategory.indexOf(ignoredLayerCategory) == -1) {
      // Note the plural because we have a featured section of layers that uses the same names
      var $layerContainerHeaders = $("#layers-menu h3[aria-controls*='" + layerCategory + "']");
      if (numLayersActiveInCurrentContainer > 0) {
        $layerContainerHeaders.append("<span class='ui-icon ui-icon-bullet active-layers-in-category'>");
      } else {
        $layerContainerHeaders.find(".active-layers-in-category").remove();
      }
    }

    var isFromUser = true;

    if ($(".csvlayer").find("input:checked").length > 0) {
      timelineType = "defaultUI";
    }

    // Toggle off Himawari/GOES16/DSCOVR if any other layer is selected when it is up. These layers are a special mode.
    // Base layer is part of the checkbox total, hence the > 1 check.
    if ((showHimawariTimeMachineLayer || showGoes16TimeMachineLayer || goes16Aug2018TimeMachineLayer || goes16Nov2018TimeMachineLayer || showDscovrTimeMachineLayer) && $('.map-layer-checkbox').find("input:checked").not("#show-himawari, #show-goes16, #show-goes16-aug-2018, #show-goes16-nov-2018, #show-dscovr").length > 1) {
      if ($("#show-himawari").prop('checked')) {
        $("#show-himawari").click();
      } else if ($("#show-goes16").prop('checked')) {
        $("#show-goes16").click();
      } else if ($("#show-goes16-aug-2018").prop('checked')) {
        $("#show-goes16-aug-2018").click();
      } else if ($("#show-goes16-nov-2018").prop('checked')) {
        $("#show-goes16-nov-2018").click();
      } else if ($("#show-dscovr").prop('checked')) {
        $("#show-dscovr").click();
      }
    }

    // Hide any timelines that are visible if we have no layers up that require a timeline or we are a static layer that fully covers the entire globe
    if (activeLayersWithTimeline <= 0 || (visibleBaseMapLayer == "blsat" && activeLayersWithTimeline == 1 && (showHansenLayer2))) {
      $(".controls, .customControl").hide();
      $(".customControl").hide();
    } else if (activeLayersWithTimeline > 0) {
      if (timelineType == "customUI") {
        $(".controls, .captureTime").hide();
        $(".customControl").show();
      } else if (timelineType == "defaultUI") {
        $(".customControl").hide();
        $(".controls, .captureTime").show();
      }
    }

    if (e && e.originalEvent) {
      var originalEvent = e.originalEvent;
      // If true, event came from user interaction, otherwise it came from javascript
      if (!originalEvent.isTrusted)
        isFromUser = false;
      // Browsers without isTrusted property
      if (originalEvent.x == 0 && originalEvent.y == 0)
        isFromUser = false;
      // IE 11
      if (originalEvent.isTrusted && (originalEvent.x == 0 && originalEvent.y == -55))
        isFromUser = false;
    }

    if ((activeLayersWithTimeline >= 1 && visibleBaseMapLayer != "blsat") ||
        (activeLayersWithTimeline == 1 && visibleBaseMapLayer == "blsat" && !(showHansenLayer2))) {
      if (timelineType == "customUI") {
        $(".customControl").show().children().show();
      } else if (timelineType == "defaultUI") {
        $(".controls, .captureTime").show();
      }
    }

    if (isFromUser && visibleBaseMapLayer != "blsat" && activeLayersWithTimeline == 0) {
      $(".customControl").hide();
    }

    if (timelineType != "none" && activeLayersWithTimeline == 0) {
      timelineType = "none";
    }

    if (activeLayersWithTimeline <= 1 && timelineType == "none") {
      $(".current-location-text-container, .annotations-resume-exit-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").addClass("noTimeline");
    } else {
      $(".current-location-text-container, .annotations-resume-exit-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").removeClass("noTimeline");
    }

    if (timelineType == "defaultUI" && visibleBaseMapLayer == "blsat" && activeLayersWithTimeline == 1 && $(".csvlayer").find("input:checked").length == 0) {
      timelineType = "customUI";
    }

    timelineHidden = $(".noTimeline").length != 0;
  };

  $('#layers-menu').on('click', "input[type=checkbox], input[type=radio]", timelineUIHandler);

  $("body").on("click", "#layers-list .ui-accordion-header, #layers-list-featured .ui-accordion-header", function() {
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
  if (timelineType == "defaultUI" && showMonthlyRefugeesLayer) {
    return false;
  } else {
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
  }
}


//////////////////////////////////////////////////////////


// BEGIN WebGL vars
var gl;

// ## 4 ##
//// Layer visibility ////
//

var showMcrmLayer = false;
var showHansenLayer = false;
var showHansenLayer2 = false;
//var showCoralBleachingLayer = false;
var showAnimatedHansenLayer = false;
var showHimawariTimeMachineLayer = false;
var showGoes16TimeMachineLayer = false;
var showGoes16Aug2018TimeMachineLayer = false;
var showGoes16Nov2018TimeMachineLayer = false;
var showDscovrTimeMachineLayer = false;
var showMonthlyRefugeesLayer = false;
var showAnnualRefugeesLayer = false;
var showAnnualReturnsLayer = false;
var showSeaLevelRiseLayer = false;
var showLodesLayer = false;
var showCumulativeActiveMiningLayer = false;
var showIomIdpLayer = false;
var showChinaAviationLayer = false;
var showChinaPowerPlantsLayer = false;
var showChinaReservoirsLayer = false;
var showChinaWasteTreatmentPlantsLayer = false;
var showCountryLabelMapLayer = false;
var showSpCrudeLayer = false;
var showSpCrudeLayerOceania = false;
var showSpCrudeLayerAG = false;
var showSpCrudeLayerWAF = false;
var showSpCrudeLayerMedNAF = false;
var showSpCrudeLayerUrals = false;
var showSpCrudeLayerUSGC = false;
var showSpCrudeLayerLatAM = false;
var showSpCrudeLayerNS = false;
var showWindVectorsLayer = false;

// Default Time Machine visibility
var tileViewVisibility = {
  videoTile: true,
  vectorTile: false
};

var waypointsLoadedPath;
var csvDataGrapher = new CsvDataGrapher(gEarthTime);
var dateRangePicker = new DateRangePicker(gEarthTime);
var altitudeSlider = new AltitudeSlider(gEarthTime);
var dotmapLayers = [];
var dotmapLayerByName = {};
var dotlayersLoadedPath;
var csvlayersLoadedPath;
var waypointJSONListReadyInterval;
var waitToLoadWaypointLayersOnPageReadyInterval;
var timelineUIChangeListeners = [];

function modifyWaypointSliderContent(keyframes, theme, story) {
  if (!himawariWaypoints[theme]) {
    himawariWaypoints[theme] = {};
  }
  himawariWaypoints[theme][story] = {};
  if (!annotationPicturePaths[theme]) {
    annotationPicturePaths[theme] = {};
  }
  annotationPicturePaths[theme][story] = {};
  for (var i = 0; i < keyframes.length; i++) {
    var keyframe = keyframes[i];
    // TODO: Force to only work with absolute image paths. One day we can figure out how to support paths from the internet without the wrath of trolls.
    var annotationPicturePath = keyframe.unsafe_string_annotationPicPath && keyframe.unsafe_string_annotationPicPath.indexOf("thumbnails/") == 0 ? keyframe.unsafe_string_annotationPicPath : undefined;
    annotationPicturePaths[theme][story][i] = { path : annotationPicturePath };
    // Himawari is a special case.
    // We need to store the bounds and times and then replace them with a default view.
    // The default view allows for a black thumbnail to be used on the waypoint slider instead of some random position in Landsat
    // Then when we actually click the Himawari waypoint, we load up the original bounds and time and use them.
    for (var j = 0; j < keyframe.layers.length; j++) {
      if (keyframe.layers[j] == "h8" || keyframe.layers[j] == "h8_16") {
        // Himawari keyframes made with Landsat 2015 and viewed in Landsat 2016 with reset dimensions
        // do not position correctly and need to be corrected below.
        if (landsatVersion == "2016" && keyframe.layers[j] == "h8") {
          keyframe.bounds.xmin -= 34645;
          keyframe.bounds.xmax -= 30000;
          keyframe.bounds.ymin -= 80931;
          keyframe.bounds.ymax -= 15128;
          var tmp = gEarthTime.timelapse.pixelBoundingBoxToPixelCenter(keyframe.bounds);
          tmp.scale *= 2;
          keyframe.bounds = gEarthTime.timelapse.pixelCenterToPixelBoundingBoxView(tmp).bbox;
        }
        himawariWaypoints[theme][story][i] = {
          bounds: keyframe.bounds,
          time: keyframe.time
        };
        // Fake bounds for thumbnail generating
        keyframe.bounds = himawariWaypointThumbnailBounds;
        break;
      }
    }

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
  himawariWaypoints = {};
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
        // TODO: Do we still need this for himawari now that we have real thumbnails?
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
  gl = gEarthTime.canvasLayer.canvas.getContext('experimental-webgl',  {antialias: false, alpha: true, stencil: true, depth: true, failIfMajorPerformanceCaveat: false});
  (window as any).gl = gl; // TODO(LayerDB): someday stop using this global

  gEarthTime.glb = new Glb(gl);
  (window as any).glb = gEarthTime.glb; // TODO(LayerDB): someday stop using this global

  var layer_html = '';

  layer_html += '<ul id="layers-list">';

  var landsat_base_str = '<label class="blsat-select" for="blsat-base" name="blsat"><input type="radio" id="blsat-base" name="base-layers" value="blsat"/>Google Earth Engine Timelapse</label>';
  var landsat_base = '<td colspan="2">' + landsat_base_str + '</td>';
  var light_base = '<td><label for="blte-base" name="blte"><input type="radio" id="blte-base" name="base-layers" value="blte"/><span>Light Map</span></label></td>';
  var dark_base = '<td><label for="bdrk-base" name="bdrk"><input type="radio" id="bdrk-base" name="base-layers" value="bdrk"/><span>Dark Map</span></label></td>';

  // NOTE NOTE NOTE
  // What is set for the name in the label must never be changed and is forever connected to share links
  // The schema for generating the label name is using the initials of the data product. If this ends up conflicting
  // with one that already exists, then it is up to you to come up with something. Perhaps the initials of the name you would
  // give it when describing the layer to someone. Keep it as short as possible though.
  // NOTE NOTE NOTE
  var show_forest_change = '<td class="forest-change-select"><label for="show-forest-change" name="fly"><input type="checkbox" id="show-forest-change" />Forest Loss by Year</label></td>';
  var show_forest_loss_gain = '<td class="forest-loss-gain-select"><label for="show-forest-loss-gain" name="flg"><input type="checkbox" id="show-forest-loss-gain" />Forest Loss/Gain</label></td>';
  var show_animated_forest_loss_gain = '<td class="animated-forest-loss-select"><label for="show-animated-forest-loss-gain" name="aflg"><input type="checkbox" id="show-animated-forest-loss-gain" />Forest Loss/Gain (Animated)</label></td>';
  var show_coral = '<td class="coral-select"><label for="show-coral" name="cb"><input type="checkbox" id="show-coral"/>Coral Bleaching</label></td>';
  var show_himawari = '<td class="timemachine himawari-select"><label for="show-himawari" name="h8_16"><input type="checkbox" id="show-himawari" />Himawari-8</label></td>';
  var show_monthly_refugees = '<td class="monthly-refugees-select"><label for="show-monthly-refugees" name="mmr"><input type="checkbox" id="show-monthly-refugees" />Mediterranean Refugees</label></td>';
  var show_annual_refugees = '<td class="annual-refugees-select"><label for="show-annual-refugees" name="ar"><input type="checkbox" id="show-annual-refugees" />Global Refugees</label></td>';
  var show_annual_returns = '<td class="annual-returns-select"><label for="show-annual-returns" name="arr"><input type="checkbox" id="show-annual-returns" />Global Returnees</label></td>';
  var show_sea_level_rise_1p0 = '<td class="sea-level-rise-1p0-select"><label for="show-sea-level-rise-1p0" name="slr10"><input type="checkbox" id="show-sea-level-rise-1p0" />Sea Level Rise Due to 1.0&deg;C Increase</label></td>';
  var show_sea_level_rise_1p5 = '<td class="sea-level-rise-1p5-select"><label for="show-sea-level-rise-1p5" name="slr15"><input type="checkbox" id="show-sea-level-rise-1p5" />Sea Level Rise Due to 1.5&deg;C Increase</label></td>';
  var show_sea_level_rise_2p0 = '<td class="sea-level-rise-2p0-select"><label for="show-sea-level-rise-2p0" name="slr2"><input type="checkbox" id="show-sea-level-rise-2p0" />Sea Level Rise Due to 2.0&deg;C Increase</label></td>';
  var show_sea_level_rise_4p0 = '<td class="sea-level-rise-4p0-select"><label for="show-sea-level-rise-4p0" name="slr4"><input type="checkbox" id="show-sea-level-rise-4p0" />Sea Level Rise Due to 4.0&deg;C Increase</label></td>';
  var show_lodes = '<td class="lodes-select"><label for="show-lodes" name="lodes"><input type="checkbox" id="show-lodes" />LODES</label></td>';
  var show_cumulative_active_mining_layer = '<td class="cumulative-active-mining-select"><label for="show-cumulative-active-mining" name="cumulative-active-mining"><input type="checkbox" id="show-cumulative-active-mining" />Active Mining</label></td>';
  var show_iraq_iom_idp = '<td class="iraq-iom-idp-select"><label for="show-iraq-iom-idp" name="iraq-iom-idp"><input type="checkbox" id="show-iraq-iom-idp" />Iraq IDPs</label></td>';
  var show_syria_iom_idp = '<td class="syria-iom-idp-select"><label for="show-syria-iom-idp" name="syria-iom-idp"><input type="checkbox" id="show-syria-iom-idp" />Syria IDPs</label></td>';
  var show_libya_iom_idp = '<td class="libya-iom-idp-select"><label for="show-libya-iom-idp" name="libya-iom-idp"><input type="checkbox" id="show-libya-iom-idp" />Libya IDPs</label></td>';
  var show_yemen_iom_idp = '<td class="yemen-iom-idp-select"><label for="show-yemen-iom-idp" name="yemen-iom-idp"><input type="checkbox" id="show-yemen-iom-idp" />Yemen IDPs</label></td>';
  var show_iraq_iom_return = '<td class="iraq-iom-return-select"><label for="show-iraq-iom-return" name="iraq-iom-return"><input type="checkbox" id="show-iraq-iom-return" />Iraq Returnees</label></td>';
  var show_syria_iom_return = '<td class="syria-iom-return-select"><label for="show-syria-iom-return" name="syria-iom-return"><input type="checkbox" id="show-syria-iom-return" />Syria Returnees</label></td>';
  var show_libya_iom_return = '<td class="libya-iom-return-select"><label for="show-libya-iom-return" name="libya-iom-return"><input type="checkbox" id="show-libya-iom-return" />Libya Returnees</label></td>';
  var show_yemen_iom_return = '<td class="yemen-iom-return-select"><label for="show-yemen-iom-return" name="yemen-iom-return"><input type="checkbox" id="show-yemen-iom-return" />Yemen Returnees</label></td>';
  var show_berkeley_earth_temperature_anomaly = '<td class="berkeley-earth-temperature-anomaly-select"><label for="show-berkeley-earth-temperature-anomaly" name="berkeley-earth-temperature-anomaly"><input type="checkbox" id="show-berkeley-earth-temperature-anomaly" />Temperature Anomaly</label></td>';
  var show_berkeley_earth_temperature_anomaly_v2_yearly = '<td class="berkeley-earth-temperature-anomaly-v2-yearly-select"><label for="show-berkeley-earth-temperature-anomaly-v2-yearly" name="berkeley-earth-temperature-anomaly-v2-yearly"><input type="checkbox" id="show-berkeley-earth-temperature-anomaly-v2-yearly" />Temperature Anomaly V2 Yearly</label></td>';
  var show_china_aviation = '<td class="china-aviation-select"><label for="show-china-aviation" name="china-aviation"><input type="checkbox" id="show-china-aviation" />China Aviation</label></td>';
  var show_china_power_plants = '<td class="china-power-plants-select"><label for="show-china-power-plants" name="china-power-plants"><input type="checkbox" id="show-china-power-plants" />China Power Plants</label></td>';
  var show_china_reservoirs = '<td class="china-reservoirs-select"><label for="show-china-reservoirs" name="china-reservoirs"><input type="checkbox" id="show-china-reservoirs" />China Reservoirs</label></td>';
  var show_china_waste_treatment_plants = '<td class="china-waste-treatment-plants-select"><label for="show-china-waste-treatment-plants" name="china-waste-treatment-plants"><input type="checkbox" id="show-china-waste-treatment-plants" />China Waste Treatment Plants</label></td>';
  var show_sp_crude = '<td class="sp-crude-select"><label for="show-sp-crude" name="sp-crude"><input type="checkbox" id="show-sp-crude" />Crude Oil flows</label></td>';
  var show_sp_crude_Oceania = '<td class="sp-crude-select_Oceania"><label for="show-sp-crude_Oceania" name="sp-crude_Oceania"><input type="checkbox" id="show-sp-crude_Oceania" />Oceania Crude Oil flows</label></td>';
  var show_sp_crude_AG = '<td class="sp-crude-select_AG"><label for="show-sp-crude_AG" name="sp-crude_AG"><input type="checkbox" id="show-sp-crude_AG" />AG Crude Oil flows</label></td>';
  var show_sp_crude_WAF = '<td class="sp-crude-select_WAF"><label for="show-sp-crude_WAF" name="sp-crude_WAF"><input type="checkbox" id="show-sp-crude_WAF" />WAF Crude Oil flows</label></td>';
  var show_sp_crude_MedNAF = '<td class="sp-crude-select_MedNAF"><label for="show-sp-crude_MedNAF" name="sp-crude_MedNAF"><input type="checkbox" id="show-sp-crude_MedNAF" />MedNAF Crude Oil flows</label></td>';
  var show_sp_crude_Urals = '<td class="sp-crude-select_Urals"><label for="show-sp-crude_Urals" name="sp-crude_Urals"><input type="checkbox" id="show-sp-crude_Urals" />Urals Crude Oil flows</label></td>';
  var show_sp_crude_USGC = '<td class="sp-crude-select_USGC"><label for="show-sp-crude_USGC" name="sp-crude_USGC"><input type="checkbox" id="show-sp-crude_USGC" />USGC Crude Oil flows</label></td>';
  var show_sp_crude_LatAM = '<td class="sp-crude-select_LatAM"><label for="show-sp-crude_LatAM" name="sp-crude_LatAM"><input type="checkbox" id="show-sp-crude_LatAM" />LatAM Crude Oil flows</label></td>';
  var show_sp_crude_NS = '<td class="sp-crude-select_NS"><label for="show-sp-crude_NS" name="sp-crude_NS"><input type="checkbox" id="show-sp-crude_NS" />NS Crude Oil flows</label></td>';
  var show_goes16 = '<td class="timemachine goes16-select"><label for="show-goes16" name="goes16"><input type="checkbox" id="show-goes16" />GOES16</label></td>';
  var show_goes16_aug2018 = '<td class="timemachine goes16-aug-2018-select"><label for="show-goes16-aug-2018" name="goes16-aug-2018"><input type="checkbox" id="show-goes16-aug-2018" />GOES16 August 2018</label></td>';
  var show_goes16_nov2018 = '<td class="timemachine goes16-nov-2018-select"><label for="show-goes16-nov-2018" name="goes16-nov-2018"><input type="checkbox" id="show-goes16-nov-2018" />GOES16 November 2018</label></td>';
  var show_dscovr = '<td class="timemachine dscovr-select"><label for="show-dscovr" name="dscovr"><input type="checkbox" id="show-dscovr" />DSCOVR</label></td>';
  var show_wind_vectors = '<td class="wind-vectors-select"><label for="show-wind-vectors" name="wind-vectors"><input type="checkbox" id="show-wind-vectors" />Wind Vectors</label></td>';

  layer_html += '<div id="all-data-layers-title">All Data</div>';
  layer_html += '<div class="layers-scroll-vertical">';
  layer_html += '<div class="map-layer-div map-layer-checkbox">';

  /* BASE LAYERS */
  layer_html += '  <h3>Base Layers</h3>';
  layer_html += '  <table id="category-base-layers">';
  layer_html += '    <tr>';
  layer_html += landsat_base;
  layer_html += '    </tr>';
  layer_html += '    <tr>';
  layer_html += light_base;
  layer_html += dark_base;
  layer_html += '    </tr>';
  layer_html += '  </table>';
  /* END BASE LAYERS */

  /* FOREST CATEGORY */
  layer_html += '  <h3>Forests</h3>';
  layer_html += '  <table id="category-forests">';
  layer_html += '    <tr>';
  layer_html += show_forest_change;
  layer_html += '    </tr>';
  layer_html += '    <tr>';
  layer_html += show_forest_loss_gain;
  layer_html += '    </tr>';
  layer_html += '    <tr>';
  layer_html += show_animated_forest_loss_gain;
  layer_html += '    </tr>';
  layer_html += '  </table>';
  /* END FOREST CATEGORY */

  /* WIND CATEGORY */
  layer_html += '  <h3>Wind</h3>';
  layer_html += '  <table id="category-wind">';
  if (showWindVectors) {
    layer_html += '   <tr>';
    layer_html += show_wind_vectors;
    layer_html += '   </tr>';
  }
  layer_html += '  </table>';
  /* END WIND CATEGORY */

  /* WATER CATEGORY */
  layer_html += '  <h3>Water</h3>';
  layer_html += '  <table id="category-water">';
  layer_html += '  </table>';
  /* END WATER CATEGORY */

  /* CLIMATE CATEGORY */
  layer_html += '  <h3>Climate</h3>';
  layer_html += '  <table id="category-climate">';
  if (showSeaLevelRise) {
    layer_html += '    <tr>';
    layer_html += show_sea_level_rise_1p0;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sea_level_rise_1p5;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sea_level_rise_2p0;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sea_level_rise_4p0;
    layer_html += '    </tr>';
  }
  layer_html += '  </table>';
  /* END CLIMATE CATEGORY */

  /* POLLUTION CATEGORY */
  layer_html += '  <h3>Pollution</h3>';
  layer_html += '  <table id="category-pollution">';
  layer_html += '  </table>';
  /* END POLLUTION CATEGORY */

  /* CORAL CATEGORY */
  layer_html += '  <h3>Coral</h3>';
  layer_html += '  <table id="category-coral">';
  if (showCoral) {
    layer_html += '    <tr>';
    layer_html += show_coral;
    layer_html += '    </tr>';
  }
  layer_html += '  </table>';
  /* END CORAL CATEGORY */

  /* ENERGY CATEGORY */
  layer_html += '  <h3>Energy</h3>';
  layer_html += '  <table id="category-energy">';
  if (showSpCrude) {
    layer_html += '    <tr>';
    layer_html += show_sp_crude;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_Oceania;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_AG;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_WAF;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_MedNAF;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_Urals;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_USGC;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_LatAM;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_sp_crude_NS;
    layer_html += '    </tr>';
  }

  layer_html += '  </table>';
  /* END ENERGY CATEGORY */

  /* REFUGEE CATEGORY */
  layer_html += '  <h3>Forced Displacement</h3>';
  layer_html += '  <table id="category-forced-displacement">';
  if (showMonthlyRefugees) {
    layer_html += '    <tr>';
    layer_html += show_monthly_refugees;
    layer_html += '    </tr>';
  }
  if (showAnnualRefugees) {
    layer_html += '    <tr>';
    layer_html += show_annual_refugees;
    layer_html += '    </tr>';
  }
  if (showAnnualReturns) {
    layer_html += '    <tr>';
    layer_html += show_annual_returns;
    layer_html += '    </tr>';
  }
  if (showIomIdp) {
    layer_html += '   <tr>';
    layer_html += show_iraq_iom_idp;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_syria_iom_idp;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_libya_iom_idp;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_yemen_iom_idp;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_iraq_iom_return;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_syria_iom_return;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_libya_iom_return;
    layer_html += '   </tr>';
    layer_html += '   <tr>';
    layer_html += show_yemen_iom_return;
    layer_html += '   </tr>';
  }
  layer_html += '  </table>';
  /* END REFUGEE CATEGORY */

  /* CHINA INFRASTRUCTURE CATEGORY */
  if (showChinaInfrastructure) {
    layer_html += '  <h3 style="display: none">China Infrastructure</h3>';
    layer_html += '  <table id="category-ci" style="display: none">';
    layer_html += '    <tr>';
    layer_html += show_china_aviation;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_china_power_plants;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_china_reservoirs;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_china_waste_treatment_plants;
    layer_html += '    </tr>';
    layer_html += '  </table>';
  }
  /* END CHINA INFRASTRUCTURE CATEGORY */

  /* US DEMOGRAPHICS CATEGORY */
  if (showLodes) {
    layer_html += '  <h3>US Demographics</h3>';
    layer_html += '  <table id="category-us-demographics">';
    layer_html += '    <tr>';
    layer_html += show_lodes;
    layer_html += '    </tr>';
    layer_html += '  </table>';
  }
  /* END US DEMOGRAPHICS CATEGORY */

  /* MISC CATEGORY */
  layer_html += '  <h3>Other</h3>';
  layer_html += '  <table id="category-other">';
  /*
  if (showGtd) {
    layer_html += '    <tr>';
    layer_html += show_gtd;
    layer_html += '    </tr>';
  }
  */
  /*
  if (showUppsalaConflict) {
    layer_html += '    <tr>';
    layer_html += show_uppsala_conflict;
    layer_html += '    </tr>';
  }
  */
  if (showCumulativeActiveMining) {
    layer_html += '    <tr>';
    layer_html += show_cumulative_active_mining_layer;
    layer_html += '    </tr>';
  }
  if (showHimawari8) {
    layer_html += '    <tr>';
    layer_html += show_himawari;
    layer_html += '    </tr>';
  }
  if (showGoes16) {
    layer_html += '    <tr>';
    layer_html += show_goes16;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_goes16_aug2018;
    layer_html += '    </tr>';
    layer_html += '    <tr>';
    layer_html += show_goes16_nov2018;
    layer_html += '    </tr>';
  }
  if (showDscovr) {
    layer_html += '    <tr>';
    layer_html += show_dscovr;
    layer_html += '    </tr>';
  }
  if (showCsvLayers) {
    // Custom CSV Layers
    layer_html += '  <tbody id="csvlayers_table">';
    layer_html += '  </tbody>';
  }
  layer_html += '  </table>';
  /* END MISC CATEGORY */

  // ## 5 ##
  //// Add additional layers to side UI panel ////
  //

  layer_html += '</div>';

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
  layer_html += '</div>';
  layer_html += '<div class="clearLayers"></div>';
  layer_html += '</ul>';

  // Legend content
  var legend_html = '<div id="layers-legend">';
  legend_html += '<div id="legend-content">';
  legend_html += '<table cellpadding=5>';
  legend_html += '<tr id="forest-loss-year-legend" style="display: none"><td><div style="font-size: 17px">Forest Loss By Year <span class="credit"> (Hansen et al)</span></div><div style="float:left; padding-right:3px; margin-left: 6px; font-size: 14px;">2000</div><div style="margin-top: 3px; float: left; background-image: -webkit-linear-gradient(left, yellow, orange 65%, red 100%);background-image: linear-gradient(left, yellow, orange 65%, red 100%); width: 68%; height: 10px"></div><div style="float:left; padding-left: 3px; font-size: 14px;">2018</div></div></td></tr>';
  legend_html += '<tr id="forest-loss-gain-legend" style="display: none; font-size: 14px;"><td><div style="font-size: 17px">Forest Loss/Gain 2000-2018 <span class="credit"> (Hansen et al)</span></div><div style="float: left; padding-right:8px"><div style="background-color:#00e000; width: 12px; height: 12px; float: left; margin-top: 2px; margin-left: 8px;"></div>&nbsp;Extent</div><div style="float: left; padding-right:8px"><div style="background-color:#ff0000; width: 12px; height: 12px; float: left; margin-top: 2px"></div>&nbsp;Loss</div><div style="float: left; padding-right:8px"><div style="background-color:#0000ff; width: 12px; height: 12px; float: left; margin-top: 2px"></div>&nbsp;Gain</div><div><div style="background-color:#ff00ff; width: 12px; height: 12px; float: left; margin-top: 2px"></div>&nbsp;Both</div></td></tr>';
  legend_html += '<tr id="fires-at-night-legend" style="display: none"><td><div style="background-color:#eda46a; border-radius: 50%; width:13px; height: 13px;"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Fires At Night <span class="credit"> (NOAA)</span></div></td></tr>';
  /////legend_html += '<tr id="coral-bleaching-legend" style="display: none"><td><div style="float:left; background-color:#fa13ab; width:17px; height: 5px;"></div><div style="margin-left: 29px; margin-top: -5px; font-size: 17px">Coral Reefs <span class="credit"> (NOAA, UNEP-WCMC)</span></div></td></tr>';
  legend_html += '<tr id="coral-bleaching-alerts-legend" style="display: none"><td><div style="font-size: 17px">Coral Reef Watch <span class="credit"> (NOAA, UNEP-WCMC)</span></div><div style="float:left; padding-right:3px; margin-left: 8px; font-size: 14px;">Watch</div><div style="margin-top: 4px; float: left; background-image: -webkit-linear-gradient(left, #ffff00, #fbb404 65%, #a00200 100%);background-image: linear-gradient(left, #ffff00, #fbb404 65%, #a00200 100%); width: 68%; height: 10px"></div><div style="float:left; padding-left: 3px; font-size: 14px;">Alert</div></td></tr>';
  legend_html += '<tr id="monthly-refugees-legend" style="display: none"><td><div style="background: #ff0000;background: -moz-linear-gradient(right, #ff0000 0%, #ffffff 100%);background: -webkit-linear-gradient(left, #ff0000 0%,#ffffff 100%); background: linear-gradient(to right, #ff0000 0%,#ffffff 100%); width:12px; height: 12px; border-radius: 50%; border: 1px solid rgb(210,210,210);"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Refugees Crossing the Mediterranean: Jan 2014 - Jun 2016 <span class="credit"> (UNHCR)</span></div></td></tr>';
  if (subsampleAnnualRefugees)
    legend_html += '<tr id="annual-refugees-legend" style="display: none"><td><div style="background: #ff0000;background: -moz-linear-gradient(right, #da7300 25%, red 100%);background: -webkit-linear-gradient(left, #da7300 25%,red 100%); background: linear-gradient(to right, #da7300 25%,red 100%); width:12px; height: 12px; border-radius: 50%; border: 1px solid rgb(210,210,210);"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Global Refugee Flow: 2000 - 2015 <span class="credit"> (UNHCR) <br> 1 dot = ~17 refugees</span></div></td></tr>';
  else
    legend_html += '<tr id="annual-refugees-legend" style="display: none"><td><div style="background: #ff0000;background: -moz-linear-gradient(right, #da7300 25%, red 100%);background: -webkit-linear-gradient(left, #da7300 25%,red 100%); background: linear-gradient(to right, #da7300 25%,red 100%); width:12px; height: 12px; border-radius: 50%; border: 1px solid rgb(210,210,210);"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Global Refugee Flow: 2000 - 2015 <span class="credit"> (UNHCR) <br> 1 dot = 1 refugee </span></div></td></tr>';
  if (subsampleAnnualReturns)
    legend_html += '<tr id="annual-returns-legend" style="display: none"><td><div style="background: #ff0000;background: -moz-linear-gradient(right, lightyellow 25%, navy 100%);background: -webkit-linear-gradient(left, lightyellow 25%,navy 100%); background: linear-gradient(to right, lightyellow 25%,navy 100%); width:12px; height: 12px; border-radius: 50%; border: 1px solid rgb(210,210,210);"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Global Refugee Return Flow: 2000 - 2015 <span class="credit"> (UNHCR) <br> 1 dot = ~17 refugees </span></div></td></tr>';
  else
    legend_html += '<tr id="annual-returns-legend" style="display: none"><td><div style="background: #ff0000;background: -moz-linear-gradient(right, lightyellow 25%, navy 100%);background: -webkit-linear-gradient(left, lightyellow 25%,navy 100%); background: linear-gradient(to right, lightyellow 25%,navy 100%); width:12px; height: 12px; border-radius: 50%; border: 1px solid rgb(210,210,210);"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">Global Refugee Return Flow: 2000 - 2015 <span class="credit"> (UNHCR) <br> 1 dot = 1 refugee </span></div></td></tr>';
  legend_html += '<tr id="sea-level-rise-legend" style="display: none"><td><div style="font-size: 17px">Global Temperature Rise <span id="slr-degree"></span> &#x2103;<span class="credit"> (Climate Central)</span></div><div style="font-size: 15px">Multi-century Sea Level Increase:<span id="slr-feet" style="width:25px;"></span>&nbsp;<span id="slr-meters" style="width:25px; color: red;"></span></div></td></tr>';
  legend_html += '<tr id="tibnted-sea-level-rise-legend" style="display: none"><td><div style="font-size: 17px">Global Temperature Rise <span id="slr-degree"></span> &#x2103;<span class="credit"> (Climate Central)</span></div><div style="font-size: 15px">Multi-century Sea Level Increase:<span id="slr-feet" style="width:25px;"></span>&nbsp;<span id="slr-meters" style="width:25px; color: red;"></span></div></td></tr>';
  legend_html += '<tr id="lodes-legend" style="display: none"><td><div>LODES<span class="credit"> (US Census)</span></div></td></tr>';
  legend_html += '<tr id="cumulative-active-mining-legend" style="display: none"><td><div>Active Mining<span class="credit"> (SkyTruth)</span></div><div style="float:left; padding-right:3px; margin-left: 8px; font-size: 14px;">1984</div><div style="margin-top: 3px; float: left; background-image: -webkit-linear-gradient( to right, rgb(255,255,255),rgb(128,0,0));background-image: linear-gradient(to right, rgb(255,255,255),rgb(128,0,0)); width: 50%; height: 10px"></div><div style="float:left; padding-left: 3px; font-size: 14px;">2016</div></td></tr>';
  legend_html += '<tr id="iraq-iom-idp-legend" style="display: none"><td><div>IRAQ IDPS<span class="credit"> (IOM)</span></div></td></tr>';
  legend_html += '<tr id="syria-iom-idp-legend" style="display: none"><td><div>Syria IDPS<span class="credit"> (IOM)</span></div></td></tr>';
  legend_html += '<tr id="yemen-iom-idp-legend" style="display: none"><td><div>Yemen IDPS<span class="credit"> (IOM)</span></div></td></tr>';
  legend_html += '<tr id="libya-iom-idp-legend" style="display: none"><td><div>Libya IDPS<span class="credit"> (IOM)</span></div></td></tr>';
  legend_html += '<tr id="iom-idp-legend" style="display: none"><td><div style="font-size: 17px">Internally Displaced Persons (IDPs) <br/>and Returnees<span class="credit"> (IOM)</span></div><svg class="svg-legend" width="242" height="130"><rect width="240" height="110" fill="white" opacity="0"></rect> <g transform="translate(2,10)"> <circle class="gain" r="5" cx="5" cy="10" style="fill: #8b0000; stroke: #fff;"></circle> <circle class="loss" r="5" cx="5" cy="30" style="fill: #00008b; stroke: #fff;"></circle> <text x="15" y="13" style="font-size: 12px; fill: #fff">Individuals displaced</text> <text x="15" y="33" style="font-size: 12px; fill: #fff">Indivdual returnees</text> <circle r="10.0" cx="160.0" cy="110.0" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle> <text text-anchor="middle" x="160.0" y="102.0" dy="13" style="font-size: 10px; fill: #fff">18K</text><circle r="30.0" cx="160.0" cy="90.0" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle> <text text-anchor="middle" x="160.0" y="80.0" dy="13" style="font-size: 10px; fill: #fff">900K</text><!--<circle r="60.0" cx="160.0" cy="110.0" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle> <text text-anchor="middle" x="160.0" y="80.0" dy="13" style="font-size: 10px; fill: #fff">900K</text>--></g> </svg></td></tr>';
  legend_html += '<tr id="berkeley-earth-temperature-anomaly-legend" style="display: none"><td><div style="font-size: 13px">Average Temperature Annual Anomaly 1850-2017<span class="credit"> (Berkeley Earth)</span></div><svg class="svg-legend" width="220" height="40"><text font-size="12px" fill="rgba(255, 255, 255, 1.0)" y="10" x="40">Temperature Anomaly (&#8451)</text><rect fill="#00008b" y="20" x="0" height="10" width="20.0"></rect><rect fill="#3031c9" y="20" x="20" height="10" width="20.0"></rect><rect fill="#5768e6" y="20" x="40" height="10" width="20.0"></rect><rect fill="#799ef6" y="20" x="60" height="10" width="20.0"></rect><rect fill="#a1d4fe" y="20" x="80" height="10" width="20.0"></rect><rect fill="#ffffff" y="20" x="100" height="10" width="20.0"></rect><rect fill="#ffd130" y="20" x="120" height="10" width="20.0"></rect><rect fill="#ff9500" y="20" x="140" height="10" width="20.0"></rect><rect fill="#ed5700" y="20" x="160" height="10" width="20.0"></rect><rect fill="#c42102" y="20" x="180" height="10" width="20.0"></rect><rect fill="#8b0000" y="20" x="200" height="10" width="20.0"></rect><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="0">-10</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="25">-8</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="45">-6</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="65">-4</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="85">-2</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="107">0</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="127">2</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="147">4</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="167">6</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="187">8</text><text font-size="10.5px" fill="rgba(255, 255, 255, 0.8)" y="40" x="205">10</text></svg></td></tr>';
  legend_html += '<tr id="berkeley-earth-temperature-anomaly-v2-yearly-legend" style="display: none"><td><div style="font-size: 13px">Average Temperature Annual Anomaly 1850-2018<span class="credit"> (Berkeley Earth)</span></div><svg width="400" height="45"><text font-size="12px" fill="rgba(255, 255, 255, 1.0)" y="10" x="40">Temperature Anomaly Relative to 1951-1980 Average (&#8451)</text><rect y="20"fill="#2a0050ff" x="0" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="5"><=-6</text><rect y="20"fill="#13008cff" x="30" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="40">-5</text><rect y="20"fill="#0319c6ff" x="60" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="70">-4</text><rect y="20"fill="#0455edff" x="90" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="100">-3</text><rect y="20"fill="#04adf9ff" x="120" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="130">-2</text><rect y="20"fill="#5ce6feff" x="150" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="160">-1</text><rect y="20"fill="#fefcf4ff" x="180" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="190">0</text><rect y="20"fill="#fee44fff" x="210" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="220">1</text><rect y="20"fill="#f8a409ff" x="240" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="250">2</text><rect y="20"fill="#e95001ff" x="270" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="280">3</text><rect y="20"fill="#c21200ff" x="300" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="310">4</text><rect y="20"fill="#87010fff" x="330" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="340">5</text><rect y="20"fill="#56001eff" x="360" height="10" width="30"></rect><text fill="rgba(255, 255, 255, 0.8)" font-size="10.5px" y="42" x="365">>=6</text></svg></td></tr>';
  legend_html += '<tr id="china-aviation-legend" style="display: none"><td><div style="background-color:red; border-radius: 50%; width:13px; height: 13px;"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">China Aviation <span class="credit"> (Oxford & Harvard)</span></div></td></tr>';
  legend_html += '<tr id="china-power-plants-legend" style="display: none"><td><div style="background-color:green; border-radius: 50%; width:13px; height: 13px;"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">China Power Plants <span class="credit"> (Oxford & Harvard)</span></div></td></tr>';
  legend_html += '<tr id="china-reservoirs-legend" style="display: none"><td><div style="background-color:blue; border-radius: 50%; width:13px; height: 13px;"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">China Reservoirs <span class="credit"> (Oxford & Harvard)</span></div></td></tr>';
  legend_html += '<tr id="china-waste-treatment-plants-legend" style="display: none"><td><div style="background-color:orange; border-radius: 50%; width:13px; height: 13px;"></div><div style="margin-left: 29px; margin-top: -15px; font-size: 17px">China Waste Treatment Plants <span class="credit"> (Oxford & Harvard)</span></div></td></tr>';
  legend_html += '<tr id="sp-crude-legend" style="display: none"><td><div style="font-size: 15px">Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="220"><circle class="gain" r="10" cx="15" cy="10" style="fill: red; stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">Middle East</text><circle class="gain" r="10" cx="15" cy="35" style="fill: blue; stroke: #fff;"></circle><text x="30" y="40" style="font-size: 12px; fill: #fff">North Africa</text><circle class="gain" r="10" cx="15" cy="60" style="fill: green; stroke: #fff;"></circle><text x="30" y="65" style="font-size: 12px; fill: #fff">North Sea</text><circle class="gain" r="10" cx="15" cy="85" style="fill: yellow; stroke: #fff;"></circle><text x="30" y="90" style="font-size: 12px; fill: #fff">Urals</text><circle class="gain" r="10" cx="15" cy="110" style="fill: purple; stroke: #fff;"></circle><text x="30" y="115" style="font-size: 12px; fill: #fff">US Golf Coast</text><circle class="gain" r="10" cx="15" cy="135" style="fill: orange; stroke: #fff;"></circle><text x="30" y="140" style="font-size: 12px; fill: #fff">West Africa</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_AG" style="display: none"><td><div style="font-size: 15px">Arab Gulf Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(228, 26, 28); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">Arab Gulf</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_WAF" style="display: none"><td><div style="font-size: 15px">West Africa Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(255, 127, 0); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">West Africa</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_MedNAF" style="display: none"><td><div style="font-size: 15px">Mediterranean Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(55, 126, 184); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">Mediterranean</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_NS" style="display: none"><td><div style="font-size: 15px">North Sea Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(77, 175, 74); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">North Sea</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_USGC" style="display: none"><td><div style="font-size: 15px">U.S. Gulf Coast Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(152, 78, 163); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">U.S. Gulf Coast</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_LatAM" style="display: none"><td><div style="font-size: 15px">Latin America Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(247, 129, 191); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">Latin America</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_Oceania" style="display: none"><td><div style="font-size: 15px">Oceania Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(166, 86, 40); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">Oceania</text></svg></td></tr>';
  legend_html += '<tr id="sp-crude-legend_Urals" style="display: none"><td><div style="font-size: 15px">Urals Crude Oil Flows<span> (S&P Global)</div><svg class="svg-legend" width="240" height="35"><circle class="gain" r="10" cx="15" cy="10" style="fill: rgb(255, 255, 51); stroke: #fff;"></circle><text x="30" y="15" style="font-size: 12px; fill: #fff">Urals</text></svg></td></tr>';

  // ## 5b ##
  //// Add to layer legend ////
  //
  legend_html += '</table>';
  legend_html += '</div>';
  legend_html += '</div>';

  //$(layer_html).appendTo($("#layers-menu"));
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

/////////////  // Himawari-8
/////////////  var himawariTimeMachineLayerOptions = {
/////////////    // TODO(LayerDB)  numFrames hardcoded for now, until we remove this code altogether :-)
/////////////    numFrames: 1000,
/////////////    //numFrames: cached_ajax['himawari-times.json']['capture-times'].length,
/////////////    fps: 12,
/////////////    nLevels: 4,
/////////////    width: 11000,
/////////////    height: 11000,
/////////////    tileRootUrl: himawariTimeMachineUrl
/////////////  };
/////////////  himawariTimeMachineLayer = new WebGLTimeMachineLayer(gEarthTime.glb, gEarthTime.canvasLayer, himawariTimeMachineLayerOptions);
/////////////
/////////////  // GOES16
/////////////  var goes16TimeMachineLayerOptions = {
/////////////    // TODO(LayerDB)  numFrames hardcoded for now, until we remove this code altogether :-)
/////////////    numFrames: 1000,
/////////////    //numFrames: cached_ajax['goes16-times.json']['capture-times'].length,
/////////////    fps: 12,
/////////////    nLevels: 4,
/////////////    width: 10848,
/////////////    height: 10848,
/////////////    tileRootUrl: goes16TimeMachineUrl
/////////////  };
/////////////  goes16TimeMachineLayer = new WebGLTimeMachineLayer(gEarthTime.glb, gEarthTime.canvasLayer, goes16TimeMachineLayerOptions);
/////////////
/////////////  // GOES16-Aug2018
/////////////  var goes16Aug2018TimeMachineLayerOptions = {
/////////////    // TODO(LayerDB)  numFrames hardcoded for now, until we remove this code altogether :-)
/////////////    numFrames: 1000,
/////////////    //numFrames: cached_ajax['goes16-aug-2018-times.json']['capture-times'].length,
/////////////    fps: 12,
/////////////    nLevels: 4,
/////////////    width: 10848,
/////////////    height: 10848,
/////////////    tileRootUrl: goes16Aug2018TimeMachineUrl
/////////////  };
/////////////  goes16Aug2018TimeMachineLayer = new WebGLTimeMachineLayer(gEarthTime.glb, gEarthTime.canvasLayer, goes16Aug2018TimeMachineLayerOptions);
/////////////
/////////////  // GOES16-Nov2018
/////////////  var goes16Nov2018TimeMachineLayerOptions = {
/////////////    // TODO(LayerDB)  numFrames hardcoded for now, until we remove this code altogether :-)
/////////////    numFrames: 1000,
/////////////    //numFrames: cached_ajax['goes16-nov-2018-times.json']['capture-times'].length,
/////////////    fps: 12,
/////////////    nLevels: 4,
/////////////    width: 10848,
/////////////    height: 10848,
/////////////    tileRootUrl: goes16Nov2018TimeMachineUrl
/////////////  };
/////////////  goes16Nov2018TimeMachineLayer = new WebGLTimeMachineLayer(gEarthTime.glb, gEarthTime.canvasLayer, goes16Nov2018TimeMachineLayerOptions);
/////////////
/////////////
/////////////  // DSCOVR
/////////////  var dscovrTimeMachineLayerOptions = {
/////////////    // TODO(LayerDB)  numFrames hardcoded for now, until we remove this code altogether :-)
/////////////    numFrames: 1000,
/////////////    //numFrames: cached_ajax['dscovr-times.json']['capture-times'].length,
/////////////    fps: 6,
/////////////    nLevels: 3,
/////////////    width: 2048,
/////////////    height: 2048,
/////////////    tileRootUrl: dscovrTimeMachineUrl
/////////////  };
/////////////  dscovrTimeMachineLayer = new WebGLTimeMachineLayer(gEarthTime.glb, gEarthTime.canvasLayer, dscovrTimeMachineLayerOptions);
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
/////////////  hansenMapLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, gfcTransUrl, defaultMapLayerOptions);
/////////////  hansenMapLayer2 = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, gfcLossGainUrl, defaultMapLayerOptions);
/////////////
/////////////  landBorderLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, landBorderUrl, defaultBaseMapLayerOptions);
/////////////  countryLabelMapLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, countryLabelMapUrl, defaultBaseMapLayerOptions);
/////////////  cityLabelMapLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, cityLabelMapUrl, defaultBaseMapLayerOptions);
/////////////
/////////////  // Coral Reefs (in pink)
/////////////  var mcrmVectorLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    numAttributes: 2
/////////////  };
/////////////  mcrmVectorLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, mcrmUrl, mcrmVectorLayerOptions);
/////////////
/////////////  // Coral Bleaching Events
/////////////  var coralBleachingLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawPoints,
/////////////    fragmentShader: WebGLVectorTile2.vectorPointTileFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.vectorPointTileVertexShader,
/////////////    numAttributes: 3
/////////////  };
/////////////  coralBleachingLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, coralBleachingUrl, coralBleachingLayerOptions);
/////////////
/////////////  var animatedHansenLayerOptions = {
/////////////    nLevels: 12,
/////////////    tileWidth: 256,
/////////////    tileHeight: 256
/////////////  };
/////////////  animatedHansenLayer = new WebGLMapLayer2(gEarthTime.glb, gEarthTime.canvasLayer, animatedHansenUrls, animatedHansenLayerOptions);
/////////////
/////////////  var monthlyRefugeesLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawMonthlyRefugees,
/////////////    fragmentShader: WebGLVectorTile2.monthlyRefugeesFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.monthlyRefugeesVertexShader,
/////////////    numAttributes: 10
/////////////  };
/////////////  monthlyRefugeesLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, monthlyRefugeesUrl, monthlyRefugeesLayerOptions);
/////////////
/////////////  var annualRefugeesLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawAnnualRefugees,
/////////////    fragmentShader: WebGLVectorTile2.annualRefugeesFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.annualRefugeesVertexShader,
/////////////    imageSrc: "https://tiles.earthtime.org/colormaps/annual-refugees-color-map.png",
/////////////    numAttributes: 7
/////////////  };
/////////////  annualRefugeesLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, annualRefugeesUrl, annualRefugeesLayerOptions);
/////////////
/////////////  var annualReturnsLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawAnnualRefugees,
/////////////    fragmentShader: WebGLVectorTile2.annualRefugeesFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.annualRefugeesVertexShader,
/////////////    imageSrc: "https://tiles.earthtime.org/colormaps/annual-returns-color-map.png",
/////////////    numAttributes: 7
/////////////  };
/////////////  annualReturnsLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, annualReturnsUrl, annualReturnsLayerOptions);
/////////////
/////////////  var seaLevelRiseLayerOptions = {
/////////////    nLevels: 9,
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    fragmentShader: WebGLMapTile.seaLevelRiseTextureFragmentShader,
/////////////    drawFunction: WebGLMapTile.prototype._drawSeaLevelRise
/////////////  };
/////////////  seaLevelRiseLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, seaLevelRiseUrl, seaLevelRiseLayerOptions);
/////////////
/////////////  var lodesLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 10,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawLodes,
/////////////    fragmentShader: WebGLVectorTile2.lodesFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.lodesVertexShader,
/////////////    numAttributes: 6
/////////////  };
/////////////  lodesLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, lodesUrl, lodesLayerOptions);
/////////////
/////////////  var cumulativeActiveMiningLayerOptions = {
/////////////    nLevels: 12,
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    fragmentShader: WebGLMapTile.animatedTextureFragmentShader,
/////////////    drawFunction: WebGLMapTile.prototype._drawAnimatedTexture
/////////////  };
/////////////  cumulativeActiveMiningLayer = new WebGLMapLayer(gEarthTime.glb, gEarthTime.canvasLayer, cumulativeActiveMiningUrl, cumulativeActiveMiningLayerOptions);
/////////////
/////////////  var iomIdpLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    loadDataFunction: WebGLVectorTile2.prototype._loadGeojsonData,
/////////////    setDataFunction: WebGLVectorTile2.prototype._setIomIdpData,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawIomIdp,
/////////////    fragmentShader: WebGLVectorTile2.iomIdpFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.iomIdpVertexShader
/////////////  };
/////////////  iomIdpLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, iomIdpUrl, iomIdpLayerOptions);
/////////////  iomIdpLayer.options = {
/////////////    'showIrqIdps': false,
/////////////    'showSyrIdps': false,
/////////////    'showYemIdps': false,
/////////////    'showLbyIdps': false,
/////////////    'showIrqReturns': false,
/////////////    'showSyrReturns': false,
/////////////    'showYemReturns': false,
/////////////    'showLbyReturns': false
/////////////  };
/////////////
/////////////  var chinaLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawPoints,
/////////////    fragmentShader: WebGLVectorTile2.vectorPointTileFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.vectorPointTileVertexShader,
/////////////    numAttributes: 3
/////////////  };
/////////////  chinaAviationLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, chinaAviationUrl, chinaLayerOptions);
/////////////  chinaPowerPlantsLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, chinaPowerPlantsUrl, chinaLayerOptions);
/////////////  chinaReservoirsLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, chinaReservoirsUrl, chinaLayerOptions);
/////////////  chinaWasteTreatmentPlantsLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, chinaWasteTreatmentPlantsUrl, chinaLayerOptions);
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrl, layerOptions);
/////////////  spCrudeLayer.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerOceania = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlOceania, layerOptions);
/////////////  spCrudeLayerOceania.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerAG = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlAG, layerOptions);
/////////////  spCrudeLayerAG.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerWAF = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlWAF, layerOptions);
/////////////  spCrudeLayerWAF.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerMedNAF = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlMedNAF, layerOptions);
/////////////  spCrudeLayerMedNAF.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerUrals = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlUrals, layerOptions);
/////////////  spCrudeLayerUrals.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerUSGC = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlUSGC, layerOptions);
/////////////  spCrudeLayerUSGC.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerLatAM = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlLatAM, layerOptions);
/////////////  spCrudeLayerLatAM.buffers = [];
/////////////
/////////////  var layerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawSpCrude,
/////////////    fragmentShader: WebGLVectorTile2.spCrudeFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.spCrudeVertexShader,
/////////////    numAttributes: 7
/////////////  };
/////////////  spCrudeLayerNS = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, spCrudeUrlNS, layerOptions);
/////////////  spCrudeLayerNS.buffers = [];
/////////////
/////////////  var windVectorsLayerOptions = {
/////////////    tileWidth: 256,
/////////////    tileHeight: 256,
/////////////    nLevels: 0,
/////////////    drawFunction: WebGLVectorTile2.prototype._drawWindVectors,
/////////////    loadDataFunction: WebGLVectorTile2.prototype._loadWindVectorsData,
/////////////    setDataFunction: WebGLVectorTile2.prototype._setWindVectorsData,
/////////////    fragmentShader: WebGLVectorTile2.vectorPointTileFragmentShader,
/////////////    vertexShader: WebGLVectorTile2.vectorPointTileVertexShader,
/////////////    numAttributes: 3
/////////////  };
/////////////  windVectorsLayer = new WebGLVectorLayer2(gEarthTime.glb, gEarthTime.canvasLayer, windVectorsUrl, windVectorsLayerOptions);
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
      var waypointStartTime = waypoint.time;
      var waypointBounds = waypoint.bounds;

      clearInterval(waitToLoadWaypointLayersOnPageReadyInterval);

      // TODO: Do we still need this for himawari now that we have real thumbnails?
      if (Object.keys(himawariWaypoints).length) {
        var himawariWaypoint = (himawariWaypoints[currentWaypointTheme] && himawariWaypoints[currentWaypointTheme][currentWaypointStory]) ? himawariWaypoints[currentWaypointTheme][currentWaypointStory][waypointIndex] : null;
      }
      isAutoModeRunning = snaplapseViewerForPresentationSlider.isAutoModeRunning();
      if (waypointTitle) {
        lastSelectedAnnotationBeforeHidden = $("#" + waypointTitle.replace(/\W+/g, "_") + " .snaplapse_keyframe_list_item_thumbnail_overlay_presentation");
      }

      // We are still technically using Landsat (web mercator) projections for any dataset being drawn,
      // so the bounds that slide-change returns is not valid for our use. But we already
      // know the bounds each himawari waypoints should be, so use that instead.
      if (himawariWaypoint) {
        waypointBounds = himawariWaypoint.bounds;
        waypointStartTime = himawariWaypoint.time;
        gEarthTime.timelapse.setMaxScale(himawariMaxScale);
      } else if (waypoint.layers && waypoint.layers.indexOf("blsat") >= 0) {
        gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      } else if (waypoint.layers) {
        gEarthTime.timelapse.setMaxScale(rasterMapTileMaxScale);
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
      var waypointPlaybackSpeed = waypoint.speed;

      // TODO: Do we still need this for himawari now that we have real thumbnails?
      if (Object.keys(himawariWaypoints).length) {
        var himawariWaypoint = (himawariWaypoints[currentWaypointTheme] && himawariWaypoints[currentWaypointTheme][currentWaypointStory]) ? himawariWaypoints[currentWaypointTheme][currentWaypointStory][waypointIndex] : null;
      }
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

      // Remove himawari since we do special cases further below
      var himawariIdx = waypointLayers.indexOf("h8");
      himawariIdx = himawariIdx > -1 ? himawariIdx : waypointLayers.indexOf("h8_16");
      if (himawariIdx > -1) waypointLayers.splice(himawariIdx, 1);

      // Show layer ids
      handleLayers(waypointLayers);

      if (waypoint.layers && waypoint.layers.indexOf("blsat") >= 0) {
        gEarthTime.timelapse.setMaxScale(landsatMaxScale);
      } else if (waypoint.layers) {
        gEarthTime.timelapse.setMaxScale(rasterMapTileMaxScale);
      }

      // Handle Himawari
      // Note: Must be run after other layers
      // Note: Needed because does not use mercator projection
      if (himawariWaypoint) {
        var initialHimawariViewChangeHack = function() {
          if (isAutoModeRunning) {
            snaplapseViewerForPresentationSlider.startAutoModeWaypointTimeout();
          } else {
            snaplapseViewerForPresentationSlider.startAutoModeIdleTimeout();
          }
          gEarthTime.timelapse.seek(himawariWaypoint.time);
        };

        var setHimawariView = function(himawariBoundingBox, himawariTime, himawariPlaybackSpeed) {
          var himawariView = {
            bbox: himawariBoundingBox
          };
          if (showHimawariTimeMachineLayer) {
            gEarthTime.timelapse.setNewView(himawariView);
          } else {
            $("#show-himawari").click();
            gEarthTime.timelapse.stopParabolicMotion({doCallback : false});
            gEarthTime.timelapse.setNewView(himawariView, true, !!waypointPlaybackSpeed, initialHimawariViewChangeHack);
          }
          gEarthTime.timelapse.setMasterPlaybackRate(1);
          gEarthTime.timelapse.setPlaybackRate(himawariPlaybackSpeed);
        };

        setHimawariView(himawariWaypoint.bounds, himawariWaypoint.time, 0.5);
      }
      // End Himawari

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
      handleLayers(layers);
      // The time in a share link may correspond to a layer that has a different timeline than the default one.
      // Re-run corresponding sharelink code once the timeline has changed.
      // Note that this may be unncessary because of the callback for CSV layers, but it's possible not to have CSV layers
      // and CSV layers are async (and could be loaded very fast) so we keep this in.
      var onloadView = function() {
        clearTimelineUIChangeListeners();
        gEarthTime.timelapse.removeTimelineUIChangeListener(onloadView);
        gEarthTime.timelapse.loadSharedViewFromUnsafeURL(UTIL.getUnsafeHashString());
        var shareDate = vals.bt || vals.t;
        var timeToSeek = gEarthTime.timelapse.playbackTimeFromShareDate(shareDate);
        gEarthTime.timelapse.seekToFrame(gEarthTime.timelapse.timeToFrameNumber(timeToSeek));
      };
      clearTimelineUIChangeListeners();
      gEarthTime.timelapse.addTimelineUIChangeListener(onloadView);
      // In the event a sharelink layer does not have a timeline change, be sure the above listener is removed.
      var onloadViewWatchDog = setTimeout(function() {
        gEarthTime.timelapse.removeTimelineUIChangeListener(onloadView);
      }, 1000);
      timelineUIChangeListeners.push({"type" : "timeout", "fn" : onloadViewWatchDog});
      timelineUIChangeListeners.push({"type" : "uiChangeListener", "fn" : onloadView});
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

  prepareSearchContent = function() {
    contentSearch.reset(true);
  }

  contentSearch = new ContentSearch($('#search-content input'), $('#layer-search-results'));

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
            } else if (type == "dotmap layers") {
              localStorage.dotmapsContentPath = url;
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
    localStorage.removeItem("dotmapsContentPath");
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

  if (typeof windVectorsLayer != "undefined" && typeof windVectorsLayer._tileView != "undefined" && typeof windVectorsLayer._tileView._tiles["000000000000000"] != "undefined"
    ) {
    windVectorsLayer._tileView._tiles["000000000000000"].resizeWindVectors()
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
  gEarthTime.startRedraw();
  if (!gEarthTime.readyToDraw) return;
  if (disableAnimation) {
    gEarthTime.canvasLayer.setAnimate(false);
    disableAnimation = false;
  }

  gEarthTime.updateTimelineIfNeeded();

  gEarthTime.timelapse.frameno = (gEarthTime.timelapse.frameno || 0) + 1;

  perf_drawframe();
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Set this to true at the beginning of frame redraw;  any layer that decides it wasn't completely drawn will set
  // this to false upon draw below
  gEarthTime.timelapse.lastFrameCompletelyDrawn = true;

  //
  //// Draw layers ////
  //

  var getLayerView = function(layerProxy: LayerProxy, ignore) {
    if (!layerProxy.layer) return null;
    var dataLayer = layerProxy.layer;
    if (!dataLayer || !dataLayer._tileView) return null;

    // The timelapse projection uses bounds from landsatBasemapLayer, which might not
    // share the standard Web Mercator north bound.

    // Compute offset, if any, in units of timelapse.getView() pixels,
    // between standard Web Mercator and landsatBasemapLayer.
    var yOffset = gEarthTime.timelapse.getProjection().latlngToPoint({
      lat: stdWebMercatorNorth,
      lng: 0
    }).y;
    var view = gEarthTime.timelapse.getView();
    var timelapse2map = dataLayer.getWidth() / gEarthTime.timelapse.getDatasetJSON().width;
    view.y -= yOffset;
    view.x *= timelapse2map;
    view.y *= timelapse2map;
    view.scale /= timelapse2map;
    return view;
  };

  function layerCountDrawnPoints(layer) {
    var keys = Object.keys(layer._tileView._tiles);
    var pointCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var tile = layer._tileView._tiles[keys[i]];
      if (tile._ready) {
        pointCount += tile._pointCount;
      }
    }
    return pointCount;
  }

  function drawCsvLayer(layer: LayerProxy, options: any = {}) {
    options = $.extend({}, options); // shallow-copy options

    options.pointSize = 2.0;
    // TODO LayerDB: uncomment and fix pairs
    // if (pairCount && isPairCandidate(layer)) {
    //   options.mode = pairCount + 1; // 2 or 3 for left or right
    //   pairCount--;
    // }
    if (layer.options) {
      $.extend(options, layer.options);
    }
    return layer.draw(getLayerView(layer, null), options);
  }

  var mapboxRenders = false;
  

  if (gEarthTime.layerDB.mapboxLayersAreVisible()) {
    console.log("YO!  let's reimplement mapbox layer display")
    //ETMBLayer.render();
  } else {
    for (let layerProxy of gEarthTime.layerDB.loadedLayersInDrawOrder()) {
      drawCsvLayer(layerProxy, {});
    }
  }
  for (let layerProxy of gEarthTime.layerDB.unloadedLayers()) {
    if (!layerProxy.layer) {
      layerProxy.requestLoad();
    }
  }

  ////////////////////////////////////////////////////////////////
  // LAYERDB

  /** END NS LAYER */

  return;



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
  if (showHimawariTimeMachineLayer) {
    var himawariView = getLayerView(himawariTimeMachineLayer, landsatBaseMapLayer);
    himawariTimeMachineLayer.draw(himawariView, tileViewVisibility);
  } else if (showGoes16TimeMachineLayer) {
    var goes16View = getLayerView(goes16TimeMachineLayer, landsatBaseMapLayer);
    goes16TimeMachineLayer.draw(goes16View, tileViewVisibility);
  } else if (showGoes16Aug2018TimeMachineLayer) {
    var goes16Aug2018View = getLayerView(goes16Aug2018TimeMachineLayer, landsatBaseMapLayer);
    goes16Aug2018TimeMachineLayer.draw(goes16Aug2018View, tileViewVisibility);
  } else if (showGoes16Nov2018TimeMachineLayer) {
    var goes16Nov2018View = getLayerView(goes16Nov2018TimeMachineLayer, landsatBaseMapLayer);
    goes16Nov2018TimeMachineLayer.draw(goes16Nov2018View, tileViewVisibility);
  } else if (showDscovrTimeMachineLayer) {
    var dscovrView = getLayerView(dscovrTimeMachineLayer, landsatBaseMapLayer);
    dscovrTimeMachineLayer.draw(dscovrView, tileViewVisibility);
  } else {
    // Static layers that cover the entire planet should be placed before the base layers in this manner.
    // if (showLightsAtNightLayer) { // Draw lightsAtNightMapLayer
    //   var lightsAtNightLayerView = getLayerView(lightsAtNightMapLayer, landsatBaseMapLayer);
    //   lightsAtNightMapLayer.draw(lightsAtNightLayerView);
    // }
    //  else if (showLightsAtNight2012Layer) { // Draw lightsAtNight2012MapLayer
    //   var lightsAtNight2012LayerView = getLayerView(lightsAtNight2012MapLayer, landsatBaseMapLayer);
    //   lightsAtNight2012MapLayer.draw(lightsAtNight2012LayerView);
    // }
    if (showHansenLayer2) { // Draw Forest Loss/Gain
      var hansenMapLayerView2 = getLayerView(hansenMapLayer2, landsatBaseMapLayer);
      hansenMapLayer2.draw(hansenMapLayerView2);
    } else if (visibleBaseMapLayer == "blsat") { // Draw Landsat
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

    // Draw Coral Reef Watch
    /*if (showCrwTimeMachineLayer) {
      var crwView = getLayerView(crwTimeMachineLayer, landsatBaseMapLayer);
      crwTimeMachineLayer.draw(crwView, tileViewVisibility);
    }*/

    // Draw NDVI Anomaly
    /*if (showNdviAnomalyTimeMachineLayer) {
      var ndviView = getLayerView(ndviAnomalyTimeMachineLayer, landsatBaseMapLayer);
      ndviAnomalyTimeMachineLayer.draw(ndviView, tileViewVisibility);
    }*/

    // Draw Forest Loss by Year (Transparent)
    if (showHansenLayer) {
      var hansenMapLayerView = getLayerView(hansenMapLayer, landsatBaseMapLayer);
      hansenMapLayer.draw(hansenMapLayerView);
    }

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

    // Draw Animated Hansen Layer
    if (showAnimatedHansenLayer) {
      var animatedHansenLayerView = getLayerView(animatedHansenLayer, landsatBaseMapLayer);
      var beginDate = Number(gEarthTime.timelapse.getCaptureTimes()[0]);
      var endDate = Number(gEarthTime.timelapse.getCaptureTimes()[gEarthTime.timelapse.getCaptureTimes().length - 1]);
      var currentDate = Number(gEarthTime.timelapse.getCaptureTimeByTime(gEarthTime.timelapse.getCurrentTime()));
      var ratio = (currentDate - beginDate) / (endDate - beginDate);
      animatedHansenLayerView.alpha = ratio;
      animatedHansenLayer.draw(animatedHansenLayerView);
    }

    // Draw Coral
    if (showMcrmLayer) {
      var mcrmLayerView = getLayerView(mcrmVectorLayer, landsatBaseMapLayer);
      mcrmVectorLayer.draw(mcrmLayerView);
    }

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

    // Draw Coral Bleaching
    /*if (showCoralBleachingLayer) {
      var coralBleachingLayerView = getLayerView(coralBleachingLayer, landsatBaseMapLayer);
      let options: any = {};
      options.color = [0.82, 0.22, 0.07, 1.0];
      options.pointSize = 8.0;
      coralBleachingLayer.draw(coralBleachingLayerView, options);
    }*/

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

    // Draw Protected Areas (WDPA)
    /*
    if (showWdpaLayer) {
      let options: DrawOptions = {};
      var wdpaLayerView = getLayerView(wdpaLayer, landsatBaseMapLayer);
      wdpaLayer.draw(wdpaLayerView, options);
    }
    */

    // Draw Mediterranean Monthly Refugees
    if (showMonthlyRefugeesLayer) {
      var monthlyRefugeesLayerView = getLayerView(monthlyRefugeesLayer, landsatBaseMapLayer);
      let options: any = {};
      monthlyRefugeesLayer.draw(monthlyRefugeesLayerView, options);
    }


    // Draw Annual Refugees
    if (showAnnualRefugeesLayer) {
      var annualRefugeesLayerView = getLayerView(annualRefugeesLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      var ratio = gEarthTime.timelapse.getCurrentTime() / (gEarthTime.timelapse.getNumFrames() / gEarthTime.timelapse.getFps());
      var times = gEarthTime.timelapse.getCaptureTimes();
      var startDate = new Date(parseInt(times[0]), 0, 1);
      let endDate = new Date(parseInt(times[times.length - 1]) + 1, 0, 1);
      var range = endDate.getTime() - startDate.getTime();
      let currentDate = new Date(ratio * range + startDate.getTime());
      // TODO(LayerDB): we need a currentDate() that is fully granular, like this one
      // @ts-ignore
      options.currentTime = currentDate;
      options.span = 240 * 24 * 60 * 60 * 1000;
      options.subsampleAnnualRefugees = subsampleAnnualRefugees;
      options.pointIdx = {
        2001: {'count': 798896, 'start': 0},
        2002: {'count': 1377803, 'start': 798896},
        2003: {'count': 402155, 'start': 2176699},
        2004: {'count': 640155, 'start': 2578854},
        2005: {'count': 375991, 'start': 3219009},
        2006: {'count': 1666399, 'start': 3595000},
        2007: {'count': 2881204, 'start': 5261399},
        2008: {'count': 431865, 'start': 8142603},
        2009: {'count': 900246, 'start': 8574468},
        2010: {'count': 492341, 'start': 9474714},
        2011: {'count': 742046, 'start': 9967055},
        2012: {'count': 1356451, 'start': 10709101},
        2013: {'count': 2260887, 'start': 12065552},
        2014: {'count': 3107100, 'start': 14326439},
        2015: {'count': 2331430, 'start': 17433539}
      };
      annualRefugeesLayer.draw(annualRefugeesLayerView, options);
    }

    // Draw Annual Returns
    if (showAnnualReturnsLayer) {
      var annualReturnsLayerView = getLayerView(annualReturnsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      var ratio = gEarthTime.timelapse.getCurrentTime() / (gEarthTime.timelapse.getNumFrames() / gEarthTime.timelapse.getFps());
      var times = gEarthTime.timelapse.getCaptureTimes();
      var startDate = new Date(parseInt(times[0]), 0, 1);
      let endDate = new Date(parseInt(times[times.length - 1]) + 1, 0, 1);
      var range = endDate.getTime() - startDate.getTime();
      let currentDate = new Date(ratio * range + startDate.getTime());
      // @ts-ignore
      options.currentTime = currentDate;
      options.span = 240 * 24 * 60 * 60 * 1000;
      options.subsampleAnnualRefugees = subsampleAnnualReturns;
      options.pointIdx = {
        2000: {'count': 763562, 'start': 0},
        2001: {'count': 453831, 'start': 763562},
        2002: {'count': 2411730, 'start': 1217393},
        2003: {'count': 1093240, 'start': 3629123},
        2004: {'count': 1431823, 'start': 4722363},
        2005: {'count': 1105375, 'start': 6154186},
        2006: {'count': 710542, 'start': 7259561},
        2007: {'count': 728128, 'start': 7970103},
        2008: {'count': 589392, 'start': 8698231},
        2009: {'count': 247555, 'start': 9287623},
        2010: {'count': 171179, 'start': 9535178},
        2011: {'count': 530960, 'start': 9706357},
        2012: {'count': 525154, 'start': 10237317},
        2013: {'count': 413619, 'start': 10762471},
        2014: {'count': 126877, 'start': 11176090},
        2015: {'count': 201440, 'start': 11302967}
      };
      annualReturnsLayer.draw(annualReturnsLayerView, options);
    }


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
    // Draw Sea Level Rise Layer
    if (showSeaLevelRiseLayer) {
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
      var meters = document.getElementById("slr-meters");
      var degree = document.getElementById("slr-degree");
      var seaLevelRiseLayerView = getLayerView(seaLevelRiseLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      var ratio = gEarthTime.timelapse.getCurrentTime() / (gEarthTime.timelapse.getNumFrames() / gEarthTime.timelapse.getFps());
      var times = gEarthTime.timelapse.getCaptureTimes();
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
        if (gEarthTime.timelapse.getCurrentCaptureTime() == times[i]) {
          currentIndex = i;
        }
      }
      //feet.innerHTML = sea_level_heights[currentIndex][0] + "ft";
      if (sea_level_heights[currentIndex]) {
        $(meters).html("+" + sea_level_heights[currentIndex][1].toFixed(1) + "m");
      }
      $(degree).html((currentIndex / 2).toFixed(1));
      seaLevelRiseLayer.draw(seaLevelRiseLayerView, options);
      $(".timeText, .captureTimeMain").html(gEarthTime.timelapse.getCurrentCaptureTime() + "&degC");
    }

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
    if (showCumulativeActiveMiningLayer) {
      var cumulativeActiveMiningLayerView = getLayerView(cumulativeActiveMiningLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      var ratio = gEarthTime.timelapse.getCurrentTime() / (gEarthTime.timelapse.getNumFrames() / gEarthTime.timelapse.getFps());
      var times = gEarthTime.timelapse.getCaptureTimes();
      var start = parseFloat(times[0]);
      var end = parseFloat(times[times.length - 1]) + 0.5;
      var range = end - start;
      var current = ratio * range + start;
      var currentIndex = 0;
      for (var i = 0; i < times.length; i++) {
        if (gEarthTime.timelapse.getCurrentCaptureTime() == times[i]) {
          currentIndex = i;
        }
      }
      var colorRamp = {
        "1984": [255,255,255],
        "1985": [255,255,204],
        "1986": [250,246,198],
        "1987": [246,238,192],
        "1988": [242,229,187],
        "1989": [238,221,181],
        "1990": [233,212,176],
        "1991": [229,204,170],
        "1992": [225,195,165],
        "1993": [221,187,159],
        "1994": [216,178,154],
        "1995": [212,170,148],
        "1996": [208,161,143],
        "1997": [204,153,137],
        "1998": [199,144,132],
        "1999": [195,136,126],
        "2000": [191,127,121],
        "2001": [187,119,115],
        "2002": [183,110,109],
        "2003": [178,102,104],
        "2004": [174,93,98],
        "2005": [170,85,93],
        "2006": [166,76,87],
        "2007": [161,68,82],
        "2008": [157,59,76],
        "2009": [153,51,71],
        "2010": [149,42,65],
        "2011": [144,34,60],
        "2012": [140,25,54],
        "2013": [136,17,49],
        "2014": [132,8,43],
        "2015": [128,0,38],
        "2016": [128,0,0]
      }
      var currentBValue = colorRamp[times[currentIndex]][2]/255;
      options.currentBValue = currentBValue;
      cumulativeActiveMiningLayer.draw(cumulativeActiveMiningLayerView, options);
    }

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

    // Draw GDP PPP
    /*if (showGdpPppLayer) {
      var view = getLayerView(gdpPppLayer, landsatBaseMapLayer);
      gdpPppLayer.draw(view, tileViewVisibility);
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

    if (showWindVectorsLayer) {
      var view = getLayerView(windVectorsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.color = [0.0, 0.0, 1.0, 1.0];
      options.pointSize = 5.0;

      var bbox = gEarthTime.timelapse.pixelBoundingBoxToLatLngBoundingBoxView(gEarthTime.timelapse.getBoundingBoxForCurrentView()).bbox;
      var ne = bbox.ne; // tr
      var sw = bbox.sw; // bl
      var tl = {'lat':ne.lat, 'lng': ne.lng};
      var br = {'lat':sw.lat, 'lng': sw.lng};
      options['bbox'] = {'tl': tl, 'br': br};
      windVectorsLayer.draw(view, options);
    }


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

    if (showIomIdpLayer) {
      var iomIdpLayerView = getLayerView(iomIdpLayer, landsatBaseMapLayer);
      interface IomIdpDrawOptions extends DrawOptions {
        showIrqIdps?:    boolean,
        showSyrIdps?:    boolean,
        showYemIdps?:    boolean,
        showLbyIdps?:    boolean,
        showIrqReturns?: boolean,
        showSyrReturns?: boolean,
        showYemReturns?: boolean,
        showLbyReturns?: boolean
      }
      let options: IomIdpDrawOptions = {};
      options.pointSize = 4.0;
      options.showIrqIdps = iomIdpLayer.options['showIrqIdps'];
      options.showSyrIdps = iomIdpLayer.options['showSyrIdps'];
      options.showYemIdps = iomIdpLayer.options['showYemIdps'];
      options.showLbyIdps = iomIdpLayer.options['showLbyIdps'];
      options.showIrqReturns = iomIdpLayer.options['showIrqReturns'];
      options.showSyrReturns = iomIdpLayer.options['showSyrReturns'];
      options.showYemReturns = iomIdpLayer.options['showYemReturns'];
      options.showLbyReturns = iomIdpLayer.options['showLbyReturns'];
      iomIdpLayer.draw(iomIdpLayerView, options);
    }

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

    if (showChinaAviationLayer) {
      var chinaAviationLayerView = getLayerView(chinaAviationLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 5 * window.devicePixelRatio;
      options.color = [1.0, 0.0, 0.0, 1.0];
      chinaAviationLayer.draw(chinaAviationLayerView, options);
    }

    if (showChinaPowerPlantsLayer) {
      var chinaPowerPlantsLayerView = getLayerView(chinaPowerPlantsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 5 * window.devicePixelRatio;
      options.color = [0.0, 1.0, 0.0, 1.0];
      chinaPowerPlantsLayer.draw(chinaPowerPlantsLayerView, options);
    }

    if (showChinaReservoirsLayer) {
      var chinaReservoirsLayerView = getLayerView(chinaReservoirsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 5 * window.devicePixelRatio;
      options.color = [0.0, 0.0, 1.0, 1.0];
      chinaReservoirsLayer.draw(chinaReservoirsLayerView, options);
    }

    if (showChinaWasteTreatmentPlantsLayer) {
      var chinaWasteTreatmentPlantsLayerView = getLayerView(chinaWasteTreatmentPlantsLayer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 5 * window.devicePixelRatio;
      options.color = [1.0, 0.5, 0.15, 1.0];
      chinaWasteTreatmentPlantsLayer.draw(chinaWasteTreatmentPlantsLayerView, options);
    }

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

    if (showLodesLayer) {
      var lodesLayerView = getLayerView(lodesLayer, landsatBaseMapLayer);
      interface LodesDrawOptions extends DrawOptions {
        se01?: boolean,
        se02?: boolean,
        se03?: boolean,
        filter?: boolean,
        distance?: number,
        step?: number
      }
      let options: LodesDrawOptions = {};
      options.se01 = lodesOptions.se01;
      options.se02 = lodesOptions.se02;
      options.se03 = lodesOptions.se03;

      options.filter = lodesOptions.filter;
      options.distance = lodesOptions.distance;

      if (lodesOptions.animate == 'animate') {
        var now = new Date();
        var deltaTime = now.getTime() - lodesAnimationState.then.getTime();
        var step = deltaTime/(lodesOptions.totalTime*lodesOptions.speed);
        if (lodesAnimationState.inMainLoop) {
          if (lodesOptions.doPulse) {
            if (lodesAnimationState.pulse) {
              step = 1. - step;
            }
          } else if (lodesAnimationState.pulse) {
            lodesAnimationState.pulse = false;
          }

          if (deltaTime >= lodesOptions.totalTime*lodesOptions.speed) {
            lodesAnimationState.then = new Date();
            lodesAnimationState.inMainLoop = false;
            if (lodesOptions.doPulse && lodesAnimationState.pulse) {
              lodesAnimationState.inStartDwell = true;
            } else {
              lodesAnimationState.inEndDwell = true;
            }
          }
        }
        else if (lodesAnimationState.inStartDwell) {
          step = 0.;
          if (deltaTime >= lodesOptions.dwellTime) {
            lodesAnimationState.inStartDwell = false;
            lodesAnimationState.inMainLoop = true;
            lodesAnimationState.then = new Date();
            if (lodesOptions.doPulse) {
              lodesAnimationState.pulse = false;
            }
          }
        }
        else {
          step = 1.;
          if (deltaTime >= lodesOptions.dwellTime) {
            lodesAnimationState.inEndDwell = false;
            lodesAnimationState.then = new Date();
            if (lodesOptions.doPulse) {
              lodesAnimationState.inMainLoop = true;
              lodesAnimationState.pulse = true;
            } else {
              lodesAnimationState.inStartDwell = true;
            }
          }
        }
        step = Math.min(Math.max(step, 0.),1.);

      } else if (lodesOptions.animate == 'home'){
          step = 0.;
      } else {
        step = 1.;
      }

      options.step = step;

      var zoom = gEarthTime.gmapsZoomLevel();
      var throttle = 1.0;
      if (zoom >= 5 && zoom < 11) {
        throttle = Math.min(1000000/layerCountDrawnPoints(layer), 1.0);
      }

      options.throttle = throttle;
      lodesLayer.draw(lodesLayerView, options);
    }

    // Show dotmaps loaded from spreadsheet
    for (var i = 0; i < dotmapLayers.length; i++) {
      var layer = dotmapLayers[i];
      if (layer.visible) {
        var view = getLayerView(layer, landsatBaseMapLayer);
        let options: DrawOptions = {};

        // Throttle number of pixels if we're drawing "too many"
        var maxPoints = gEarthTime.canvasLayer.canvas.width * gEarthTime.canvasLayer.canvas.height;
        var pointCount = layerCountDrawnPoints(layer);
        var drawFraction = 0.125;
        drawFraction = Math.min(maxPoints/pointCount, 1.0);

        options.throttle = drawFraction;

        layer.draw(view, options);
      }
    }

    var crude_flows_index = [
      {'filename': '0-crude-flows.bin', 'max_epoch': 1362803764.439162, 'min_epoch': 1344196740.0},
      {'filename': '1-crude-flows.bin', 'max_epoch': 1368630850.6254642, 'min_epoch': 1356352440.0},
      {'filename': '2-crude-flows.bin', 'max_epoch': 1375477977.755611, 'min_epoch': 1363526454.6067417},
      {'filename': '3-crude-flows.bin', 'max_epoch': 1382008440.0, 'min_epoch': 1365473760.0},
      {'filename': '4-crude-flows.bin', 'max_epoch': 1392493649.7164462, 'min_epoch': 1371392040.0},
      {'filename': '5-crude-flows.bin', 'max_epoch': 1393598774.858223, 'min_epoch': 1382677171.011236},
      {'filename': '6-crude-flows.bin', 'max_epoch': 1399832731.587473, 'min_epoch': 1385223928.5822306},
      {'filename': '7-crude-flows.bin', 'max_epoch': 1406034129.6090713, 'min_epoch': 1392063240.0},
      {'filename': '8-crude-flows.bin', 'max_epoch': 1413160440.0, 'min_epoch': 1400939343.3707864},
      {'filename': '9-crude-flows.bin', 'max_epoch': 1418089195.8662152, 'min_epoch': 1404994380.0},
      {'filename': '10-crude-flows.bin', 'max_epoch': 1424125799.774436, 'min_epoch': 1413165780.0},
      {'filename': '11-crude-flows.bin', 'max_epoch': 1442046780.0, 'min_epoch': 1417092012.1348314},
      {'filename': '12-crude-flows.bin', 'max_epoch': 1437058019.1022444, 'min_epoch': 1421189963.6363637},
      {'filename': '13-crude-flows.bin', 'max_epoch': 1443465644.3032672, 'min_epoch': 1425812640.0},
      {'filename': '14-crude-flows.bin', 'max_epoch': 1448988823.6228287, 'min_epoch': 1436904887.2727273},
      {'filename': '15-crude-flows.bin', 'max_epoch': 1455260843.3774915, 'min_epoch': 1445261237.9165041},
      {'filename': '16-crude-flows.bin', 'max_epoch': 1463993410.909091, 'min_epoch': 1450881160.140802},
      {'filename': '17-crude-flows.bin', 'max_epoch': 1467755612.9371564, 'min_epoch': 1457289194.0186915},
      {'filename': '18-crude-flows.bin', 'max_epoch': 1474374616.3636363, 'min_epoch': 1463748721.8181818},
      {'filename': '19-crude-flows.bin', 'max_epoch': 1481250173.6283185, 'min_epoch': 1469280227.0160873},
      {'filename': '20-crude-flows.bin', 'max_epoch': 1487025440.549273, 'min_epoch': 1474853520.0},
      {'filename': '21-crude-flows.bin', 'max_epoch': 1492642858.041543, 'min_epoch': 1483774740.0},
      {'filename': '22-crude-flows.bin', 'max_epoch': 1503923820.0, 'min_epoch': 1482323820.0},
      {'filename': '23-crude-flows.bin', 'max_epoch': 1508006340.0, 'min_epoch': 1492941696.4485981},
      {'filename': '24-crude-flows.bin', 'max_epoch': 1509999715.9048486, 'min_epoch': 1497947778.504673}
      ];
    function showIndex(idx, epoch) {
      return crude_flows_index[idx]['min_epoch'] < epoch && crude_flows_index[idx]['max_epoch'] > epoch;
    }

    // TODO(LayerDB)
    // Draw CSV z=400 (most CSV layers, by default)
    // for (var i = 0; i < csvFileLayers.layers.length; i++) {
    //   var layer = csvFileLayers.layers[i];
    //    if (layer.visible && layer.z == 400) {
    //      drawCsvLayer(layer);
    //    }
    // }

    if (showSpCrudeLayer) {
      var layer = spCrudeLayer;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index.length; i++) {
        if (showIndex(i, currentEpoch)) {
          if (typeof spCrudeLayer.buffers[i] == "undefined") {
            spCrudeLayer.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index[i]["filename"];
            shipsWorker.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayer.buffers;
          layer.draw(view, options);
        }
      }
    }

    var crude_flows_index_Oceania = [{'max_epoch': 1.5083176e+09, 'filename': 'Oceania/0-crude-flows_Oceania.bin', 'min_epoch': 1.3435715e+09}];
    var crude_flows_index_AG = [{'max_epoch': 1.3617048e+09, 'filename': 'AG/0-crude-flows_AG.bin', 'min_epoch': 1.3441967e+09}, {'max_epoch': 1.3771071e+09, 'filename': 'AG/1-crude-flows_AG.bin', 'min_epoch': 1.3594772e+09}, {'max_epoch': 1.3706697e+09, 'filename': 'AG/2-crude-flows_AG.bin', 'min_epoch': 1.3597724e+09}, {'max_epoch': 1.3761761e+09, 'filename': 'AG/3-crude-flows_AG.bin', 'min_epoch': 1.3693578e+09}, {'max_epoch': 1.3799291e+09, 'filename': 'AG/4-crude-flows_AG.bin', 'min_epoch': 1.3730234e+09}, {'max_epoch': 1.3835629e+09, 'filename': 'AG/5-crude-flows_AG.bin', 'min_epoch': 1.376452e+09}, {'max_epoch': 1.3884915e+09, 'filename': 'AG/6-crude-flows_AG.bin', 'min_epoch': 1.3797737e+09}, {'max_epoch': 1.3922216e+09, 'filename': 'AG/7-crude-flows_AG.bin', 'min_epoch': 1.3842066e+09}, {'max_epoch': 1.3967419e+09, 'filename': 'AG/8-crude-flows_AG.bin', 'min_epoch': 1.3880942e+09}, {'max_epoch': 1.4022243e+09, 'filename': 'AG/9-crude-flows_AG.bin', 'min_epoch': 1.3932987e+09}, {'max_epoch': 1.4059923e+09, 'filename': 'AG/10-crude-flows_AG.bin', 'min_epoch': 1.398294e+09}, {'max_epoch': 1.4106575e+09, 'filename': 'AG/11-crude-flows_AG.bin', 'min_epoch': 1.4030985e+09}, {'max_epoch': 1.4146995e+09, 'filename': 'AG/12-crude-flows_AG.bin', 'min_epoch': 1.408361e+09}, {'max_epoch': 1.4204237e+09, 'filename': 'AG/13-crude-flows_AG.bin', 'min_epoch': 1.4105153e+09}, {'max_epoch': 1.4244887e+09, 'filename': 'AG/14-crude-flows_AG.bin', 'min_epoch': 1.416967e+09}, {'max_epoch': 1.4297343e+09, 'filename': 'AG/15-crude-flows_AG.bin', 'min_epoch': 1.4202262e+09}, {'max_epoch': 1.4338424e+09, 'filename': 'AG/16-crude-flows_AG.bin', 'min_epoch': 1.4269531e+09}, {'max_epoch': 1.438222e+09, 'filename': 'AG/17-crude-flows_AG.bin', 'min_epoch': 1.4312159e+09}, {'max_epoch': 1.4429395e+09, 'filename': 'AG/18-crude-flows_AG.bin', 'min_epoch': 1.4354159e+09}, {'max_epoch': 1.4478618e+09, 'filename': 'AG/19-crude-flows_AG.bin', 'min_epoch': 1.4417828e+09}, {'max_epoch': 1.4529947e+09, 'filename': 'AG/20-crude-flows_AG.bin', 'min_epoch': 1.4457651e+09}, {'max_epoch': 1.458193e+09, 'filename': 'AG/21-crude-flows_AG.bin', 'min_epoch': 1.4514196e+09}, {'max_epoch': 1.4634623e+09, 'filename': 'AG/22-crude-flows_AG.bin', 'min_epoch': 1.4557041e+09}, {'max_epoch': 1.4669064e+09, 'filename': 'AG/23-crude-flows_AG.bin', 'min_epoch': 1.4613379e+09}, {'max_epoch': 1.4730853e+09, 'filename': 'AG/24-crude-flows_AG.bin', 'min_epoch': 1.4639675e+09}, {'max_epoch': 1.4782132e+09, 'filename': 'AG/25-crude-flows_AG.bin', 'min_epoch': 1.4703533e+09}, {'max_epoch': 1.480319e+09, 'filename': 'AG/26-crude-flows_AG.bin', 'min_epoch': 1.4711836e+09}, {'max_epoch': 1.4862049e+09, 'filename': 'AG/27-crude-flows_AG.bin', 'min_epoch': 1.47741e+09}, {'max_epoch': 1.4903073e+09, 'filename': 'AG/28-crude-flows_AG.bin', 'min_epoch': 1.4828404e+09}, {'max_epoch': 1.4943535e+09, 'filename': 'AG/29-crude-flows_AG.bin', 'min_epoch': 1.4861729e+09}, {'max_epoch': 1.4983288e+09, 'filename': 'AG/30-crude-flows_AG.bin', 'min_epoch': 1.4919392e+09}, {'max_epoch': 1.5031058e+09, 'filename': 'AG/31-crude-flows_AG.bin', 'min_epoch': 1.4967662e+09}, {'max_epoch': 1.5120396e+09, 'filename': 'AG/32-crude-flows_AG.bin', 'min_epoch': 1.5002131e+09}];
    var crude_flows_index_WAF = [{'max_epoch': 1.3656445e+09, 'filename': 'WAF/0-crude-flows_WAF.bin', 'min_epoch': 1.3473725e+09}, {'max_epoch': 1.3747565e+09, 'filename': 'WAF/1-crude-flows_WAF.bin', 'min_epoch': 1.3650022e+09}, {'max_epoch': 1.3842788e+09, 'filename': 'WAF/2-crude-flows_WAF.bin', 'min_epoch': 1.3740604e+09}, {'max_epoch': 1.3929523e+09, 'filename': 'WAF/3-crude-flows_WAF.bin', 'min_epoch': 1.3833535e+09}, {'max_epoch': 1.4025202e+09, 'filename': 'WAF/4-crude-flows_WAF.bin', 'min_epoch': 1.3921147e+09}, {'max_epoch': 1.411857e+09, 'filename': 'WAF/5-crude-flows_WAF.bin', 'min_epoch': 1.4018527e+09}, {'max_epoch': 1.4214098e+09, 'filename': 'WAF/6-crude-flows_WAF.bin', 'min_epoch': 1.4116553e+09}, {'max_epoch': 1.4311532e+09, 'filename': 'WAF/7-crude-flows_WAF.bin', 'min_epoch': 1.4210131e+09}, {'max_epoch': 1.4404055e+09, 'filename': 'WAF/8-crude-flows_WAF.bin', 'min_epoch': 1.4305885e+09}, {'max_epoch': 1.4499501e+09, 'filename': 'WAF/9-crude-flows_WAF.bin', 'min_epoch': 1.4388869e+09}, {'max_epoch': 1.458926e+09, 'filename': 'WAF/10-crude-flows_WAF.bin', 'min_epoch': 1.4490766e+09}, {'max_epoch': 1.468358e+09, 'filename': 'WAF/11-crude-flows_WAF.bin', 'min_epoch': 1.458066e+09}, {'max_epoch': 1.4786161e+09, 'filename': 'WAF/12-crude-flows_WAF.bin', 'min_epoch': 1.4664877e+09}, {'max_epoch': 1.4881251e+09, 'filename': 'WAF/13-crude-flows_WAF.bin', 'min_epoch': 1.4772301e+09}, {'max_epoch': 1.4974886e+09, 'filename': 'WAF/14-crude-flows_WAF.bin', 'min_epoch': 1.4877286e+09}, {'max_epoch': 1.507764e+09, 'filename': 'WAF/15-crude-flows_WAF.bin', 'min_epoch': 1.496261e+09}, {'max_epoch': 1.511334e+09, 'filename': 'WAF/16-crude-flows_WAF.bin', 'min_epoch': 1.5044224e+09}];
    var crude_flows_index_MedNAF = [{'max_epoch': 1.3762028e+09, 'filename': 'MedNAF/0-crude-flows_MedNAF.bin', 'min_epoch': 1.3501318e+09}, {'max_epoch': 1.4003267e+09, 'filename': 'MedNAF/1-crude-flows_MedNAF.bin', 'min_epoch': 1.3754286e+09}, {'max_epoch': 1.4250889e+09, 'filename': 'MedNAF/2-crude-flows_MedNAF.bin', 'min_epoch': 1.3960728e+09}, {'max_epoch': 1.4498509e+09, 'filename': 'MedNAF/3-crude-flows_MedNAF.bin', 'min_epoch': 1.4244504e+09}, {'max_epoch': 1.4743622e+09, 'filename': 'MedNAF/4-crude-flows_MedNAF.bin', 'min_epoch': 1.4464378e+09}, {'max_epoch': 1.4972628e+09, 'filename': 'MedNAF/5-crude-flows_MedNAF.bin', 'min_epoch': 1.4736177e+09}, {'max_epoch': 1.5095916e+09, 'filename': 'MedNAF/6-crude-flows_MedNAF.bin', 'min_epoch': 1.4953752e+09}];
    var crude_flows_index_Urals = [{'max_epoch': 1.3944883e+09, 'filename': 'Urals/0-crude-flows_Urals.bin', 'min_epoch': 1.3512047e+09}, {'max_epoch': 1.435146e+09, 'filename': 'Urals/1-crude-flows_Urals.bin', 'min_epoch': 1.3944666e+09}, {'max_epoch': 1.47633e+09, 'filename': 'Urals/2-crude-flows_Urals.bin', 'min_epoch': 1.4350828e+09}, {'max_epoch': 1.5092532e+09, 'filename': 'Urals/3-crude-flows_Urals.bin', 'min_epoch': 1.4763123e+09}];
    var crude_flows_index_USGC = [{'max_epoch': 1.5122628e+09, 'filename': 'USGC/0-crude-flows_USGC.bin', 'min_epoch': 1.3621992e+09}];
    var crude_flows_index_LatAM = [{'max_epoch': 1.3680512e+09, 'filename': 'LatAM/0-crude-flows_LatAM.bin', 'min_epoch': 1.3474893e+09}, {'max_epoch': 1.3785563e+09, 'filename': 'LatAM/1-crude-flows_LatAM.bin', 'min_epoch': 1.3666175e+09}, {'max_epoch': 1.3898134e+09, 'filename': 'LatAM/2-crude-flows_LatAM.bin', 'min_epoch': 1.3767935e+09}, {'max_epoch': 1.4000607e+09, 'filename': 'LatAM/3-crude-flows_LatAM.bin', 'min_epoch': 1.3878431e+09}, {'max_epoch': 1.4103395e+09, 'filename': 'LatAM/4-crude-flows_LatAM.bin', 'min_epoch': 1.3986446e+09}, {'max_epoch': 1.4202254e+09, 'filename': 'LatAM/5-crude-flows_LatAM.bin', 'min_epoch': 1.408922e+09}, {'max_epoch': 1.43073e+09, 'filename': 'LatAM/6-crude-flows_LatAM.bin', 'min_epoch': 1.4186223e+09}, {'max_epoch': 1.4399827e+09, 'filename': 'LatAM/7-crude-flows_LatAM.bin', 'min_epoch': 1.4289676e+09}, {'max_epoch': 1.4490721e+09, 'filename': 'LatAM/8-crude-flows_LatAM.bin', 'min_epoch': 1.4386007e+09}, {'max_epoch': 1.4587574e+09, 'filename': 'LatAM/9-crude-flows_LatAM.bin', 'min_epoch': 1.4481128e+09}, {'max_epoch': 1.4689476e+09, 'filename': 'LatAM/10-crude-flows_LatAM.bin', 'min_epoch': 1.4563868e+09}, {'max_epoch': 1.4796142e+09, 'filename': 'LatAM/11-crude-flows_LatAM.bin', 'min_epoch': 1.4676618e+09}, {'max_epoch': 1.4914527e+09, 'filename': 'LatAM/12-crude-flows_LatAM.bin', 'min_epoch': 1.4776771e+09}, {'max_epoch': 1.5010688e+09, 'filename': 'LatAM/13-crude-flows_LatAM.bin', 'min_epoch': 1.4883502e+09}, {'max_epoch': 1.511766e+09, 'filename': 'LatAM/14-crude-flows_LatAM.bin', 'min_epoch': 1.498359e+09}];
    var crude_flows_index_NS = [{'max_epoch': 1.4191127e+09, 'filename': 'NS/0-crude-flows_NS.bin', 'min_epoch': 1.3472122e+09}, {'max_epoch': 1.4766056e+09, 'filename': 'NS/1-crude-flows_NS.bin', 'min_epoch': 1.4182052e+09}, {'max_epoch': 1.5126084e+09, 'filename': 'NS/2-crude-flows_NS.bin', 'min_epoch': 1.4763096e+09}];

    /** START Oceania LAYER */
    function showIndexOceania(idx, epoch) {
      return crude_flows_index_Oceania[idx]['min_epoch'] < epoch && crude_flows_index_Oceania[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerOceania) {
      var layer = spCrudeLayerOceania;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_Oceania.length; i++) {
        if (showIndexOceania(i, currentEpoch)) {
          if (typeof spCrudeLayerOceania.buffers[i] == "undefined") {
            spCrudeLayerOceania.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_Oceania[i]["filename"];
            shipsWorkerOceania.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerOceania.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END Oceania LAYER */


    /** START AG LAYER */
    function showIndexAG(idx, epoch) {
      return crude_flows_index_AG[idx]['min_epoch'] < epoch && crude_flows_index_AG[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerAG) {
      var layer = spCrudeLayerAG;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_AG.length; i++) {
        if (showIndexAG(i, currentEpoch)) {
          if (typeof spCrudeLayerAG.buffers[i] == "undefined") {
            spCrudeLayerAG.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_AG[i]["filename"];
            shipsWorkerAG.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerAG.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END AG LAYER */


    /** START WAF LAYER */
    function showIndexWAF(idx, epoch) {
      return crude_flows_index_WAF[idx]['min_epoch'] < epoch && crude_flows_index_WAF[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerWAF) {
      var layer = spCrudeLayerWAF;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_WAF.length; i++) {
        if (showIndexWAF(i, currentEpoch)) {
          if (typeof spCrudeLayerWAF.buffers[i] == "undefined") {
            spCrudeLayerWAF.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_WAF[i]["filename"];
            shipsWorkerWAF.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerWAF.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END WAF LAYER */


    /** START MedNAF LAYER */
    function showIndexMedNAF(idx, epoch) {
      return crude_flows_index_MedNAF[idx]['min_epoch'] < epoch && crude_flows_index_MedNAF[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerMedNAF) {
      var layer = spCrudeLayerMedNAF;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_MedNAF.length; i++) {
        if (showIndexMedNAF(i, currentEpoch)) {
          if (typeof spCrudeLayerMedNAF.buffers[i] == "undefined") {
            spCrudeLayerMedNAF.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_MedNAF[i]["filename"];
            shipsWorkerMedNAF.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerMedNAF.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END MedNAF LAYER */


    /** START Urals LAYER */
    function showIndexUrals(idx, epoch) {
      return crude_flows_index_Urals[idx]['min_epoch'] < epoch && crude_flows_index_Urals[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerUrals) {
      var layer = spCrudeLayerUrals;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_Urals.length; i++) {
        if (showIndexUrals(i, currentEpoch)) {
          if (typeof spCrudeLayerUrals.buffers[i] == "undefined") {
            spCrudeLayerUrals.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_Urals[i]["filename"];
            shipsWorkerUrals.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerUrals.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END Urals LAYER */


    /** START USGC LAYER */
    function showIndexUSGC(idx, epoch) {
      return crude_flows_index_USGC[idx]['min_epoch'] < epoch && crude_flows_index_USGC[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerUSGC) {
      var layer = spCrudeLayerUSGC;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_USGC.length; i++) {
        if (showIndexUSGC(i, currentEpoch)) {
          if (typeof spCrudeLayerUSGC.buffers[i] == "undefined") {
            spCrudeLayerUSGC.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_USGC[i]["filename"];
            shipsWorkerUSGC.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerUSGC.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END USGC LAYER */


    /** START LatAM LAYER */
    function showIndexLatAM(idx, epoch) {
      return crude_flows_index_LatAM[idx]['min_epoch'] < epoch && crude_flows_index_LatAM[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerLatAM) {
      var layer = spCrudeLayerLatAM;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_LatAM.length; i++) {
        if (showIndexLatAM(i, currentEpoch)) {
          if (typeof spCrudeLayerLatAM.buffers[i] == "undefined") {
            spCrudeLayerLatAM.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_LatAM[i]["filename"];
            shipsWorkerLatAM.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerLatAM.buffers;
          layer.draw(view, options);
        }
      }
    }
    /** END LatAM LAYER */


    /** START NS LAYER */
    function showIndexNS(idx, epoch) {
      return crude_flows_index_NS[idx]['min_epoch'] < epoch && crude_flows_index_NS[idx]['max_epoch'] > epoch;
    }

    if (showSpCrudeLayerNS) {
      var layer = spCrudeLayerNS;
      var view = getLayerView(layer, landsatBaseMapLayer);
      let options: DrawOptions = {};
      options.pointSize = 2.;
      options.color = [0.5,0.05,0.5,1.0];
      var currentEpoch = gEarthTime.currentEpochTime();
      for (var i = 0; i < crude_flows_index_NS.length; i++) {
        if (showIndexNS(i, currentEpoch)) {
          if (typeof spCrudeLayerNS.buffers[i] == "undefined") {
            spCrudeLayerNS.buffers[i] = {
              "numAttributes": 7,
              "count": 0,
              "buffer": null,
              "ready": false
            };

            var dataUrl = gEarthTime.rootTilePath + '/sp-crude/' + crude_flows_index_NS[i]["filename"];
            shipsWorkerNS.postMessage({'idx': i, 'url': dataUrl});
          }
          options.idx = i;
          options.buffers = spCrudeLayerNS.buffers;
          layer.draw(view, options);
        }
      }
    }
        /** END NS LAYER */

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
  await setupUIAndOldLayers();
  //console.log(`${Utils.logPrefix()} setting readyToDraw true`);
  gEarthTime.readyToDraw = true;

  // Show bdrk
  //for (const id of Object.keys(gEarthTime.layerDB.layerById).slice(0,1000)) {
  //  gEarthTime.layerDB.layerById[id].show();
  //}
  var layerDB = gEarthTime.layerDB;
  layerDB.setVisibleLayers([
    layerDB.getLayer('bdrk')
    //layerDB.getLayer('mapbox_grocery_convenience_allegheny_county')
    //layerDB.getLayer('cb'),
    //layerDB.getLayer('mapbox_dark_map'),
    //layerDB.getLayer('drug_use'),
    //layerDB.getLayer('mapbox_cities'),
    //layerDB.getLayer('crw')
    //layerDB.getLayer('coral_only'),
    //layerDB.getLayer('gsr_oceans_yearly_ppr_1950_2014_animated')
  ]);
}

$(init);

