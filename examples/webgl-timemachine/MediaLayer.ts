import { LayerInterface, LayerOptions } from './Layer'
import { LayerProxy } from './LayerProxy';
import { Glb } from './Glb';
import { availableUIModes, gEarthTime } from './EarthTime';

export class MediaLayer extends LayerOptions implements LayerInterface {
  layerProxy: LayerProxy;
  playbackRate: number;
  loop: boolean;
  muted: boolean;
  playbackControls: boolean;
  objectFit: string;
  mediaType: string;
  layerDef: {[key: string]: any};
  extrasOptions: {[key: string]: any};
  ready: boolean;
  id: string;
  mediaPath: string;
  title: string;
  $extrasContentContainerTitleBar: any;
  $extrasContentContainer: any;
  $extrasContentComponent: any;
  nextFrameNeedsRedraw = true;
  iframeClickHandler: () => void;
  lastAutoModeStateBeforeManualSet: boolean;
  sandboxIframe: boolean;
  subtitles: string;

  constructor(layerProxy: LayerProxy, glb: Glb, canvasLayer, tileUrl: string, layerOptions: LayerOptions) {
    super(layerOptions);
    this.layerProxy = layerProxy;
    this.layerDef = layerOptions.layerDef;

    this.ready = false;
    this.playbackRate = this.layerDef["Playback Rate"] && this.layerDef["Playback Rate"].trim() != '' ? parseFloat(this.layerDef["Playback Rate"].trim()) : 1;
    this.mediaType = this.layerDef["Map Type"].split("-")[1];
    this.id = this.layerDef["Share link identifier"].replace(/\W+/g, '_');
    this.mediaPath = this.layerDef["URL"];
    this.title = this.layerDef["Name"];
    this.extrasOptions = {};
    if (this.layerDef["Extras Options"]?.trim()) {
      this.extrasOptions = JSON.parse(this.layerDef["Extras Options"]);
    }
    this.objectFit = this.extrasOptions['object-fit'] ?? "";
    this.loop = this.extrasOptions['loop'] ?? true;
    this.subtitles = this.extrasOptions['subtitles'];
    this.muted = this.extrasOptions['muted'] ?? true;
    this.playbackControls = this.extrasOptions['controls'] ?? false;
    this.sandboxIframe = this.extrasOptions['sandbox-iframe'] ?? false;

    this.$extrasContentContainerTitleBar = $(".extras-content-dialog .ui-dialog-titlebar");
    this.$extrasContentContainer = $("#extras-content-container");
    this.$extrasContentComponent = $(".extras-content-dialog");

    this.handleEnable();
  }

  maxGmapsZoomLevel(): number {
    return 22;
  }

  info(): string {
    return "";
  }

  handleVisibilityStateChange(): void {
    if (this.layerProxy.isVisible()) {;
      this.handleEnable();
    } else {
      this.$extrasContentContainer.dialog("close");
      // Revert back CSS that may have been set for this layer
      this.$extrasContentContainerTitleBar.show();
      $(this.$extrasContentContainer).add(this.$extrasContentComponent).removeClass("storyFriendlyDialog");
      if (typeof(this.lastAutoModeStateBeforeManualSet) != 'undefined') {
        gEarthTime.snaplapseViewerForPresentationSlider.setAutoModeEnableState(this.lastAutoModeStateBeforeManualSet);
      }
    }
  }

  allTilesLoaded(): boolean {
    return true;
  }

  anyTilesLoaded(): boolean {
    return true;
  }

  draw(view: any, options: any) { }

  destroy() { }

  abortLoading() { }

  getWidth() {
    return 256;
  }

  getHeight() {
    return 256;
  }

  isLoaded(): boolean { return this.ready; }

  async handleEnable() {
    var that = this;
    var relativePath = "../../../extras/";
    var filePath = relativePath + this.mediaPath;
    var fileType = this.mediaType;
    var playbackRate = this.playbackRate || 1;
    var extrasName = this.id;
    var loopVideoPlayback = this.loop;
    var muteVideoAudio = this.muted;
    var enableVideoPlaybackControls = this.playbackControls;
    var objectFit = this.objectFit;
    var sandboxIframe = this.sandboxIframe;
    var subtitles = this.subtitles;

    this.$extrasContentContainer.empty();

    // @ts-ignore
    if (window.disableUI || gEarthTime.disableMediaLayerTitleBar) {
      // Fit to window, without title bar
      this.$extrasContentContainerTitleBar.hide();
      this.$extrasContentContainer.addClass("storyFriendlyDialog");
    } else if (extrasName.indexOf("_storyFriendlyDialog_") > 0 &&
               ($(".presentationSlider").is(":visible") || (gEarthTime.uiMode == availableUIModes.ALT1 && $("#waypointDots").is(":visible") && $("#waypointDots").length))) {
      // Fit to window, without title bar and minus height of waypoint slider
      this.$extrasContentContainerTitleBar.hide();
      $(this.$extrasContentContainer).add(this.$extrasContentComponent).addClass("storyFriendlyDialog");
    } else {
      // Fit to window, keep title bar
      $(this.$extrasContentContainer).add(this.$extrasContentComponent).removeClass("storyFriendlyDialog");
      this.$extrasContentContainer.dialog('option', 'title', this.title);
    }

    var extrasHtml = "";
    if (fileType == "image") {
      extrasHtml = '<img id="extras-image">';
      this.$extrasContentContainer.html(extrasHtml).dialog("open");
      var image = document.getElementById("extras-image") as HTMLImageElement;
      $(image).one('load', function() {
        that.ready = true;
        that.nextFrameNeedsRedraw = false;
        that.afterLoad(that);
      });
      image.src = filePath;
    } else if (fileType == "video") {
      extrasHtml = '<video id="extras-video" autoplay></video>';
      this.$extrasContentContainer.html(extrasHtml).dialog("open");
      var $video = $("#extras-video") as JQuery<HTMLVideoElement>;
      var video = $video[0] as HTMLVideoElement;
      if (loopVideoPlayback) {
        video.loop = true;
      }
      if (subtitles) {
        let blob = await fetch(subtitles).then(r => r.blob());
        let track = document.createElement('track');
        track.src = URL.createObjectURL(blob);
        video.appendChild(track);
        video.textTracks[0].mode = "showing";
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
      //if (!gEarthTime.timelapse.isMovingToWaypoint()) {
        // @ts-ignore
        $video.one("loadedmetadata", () => that.afterLoad(that));
      //}
      $(video).one('loadeddata', function() {
        that.ready = true;
        that.nextFrameNeedsRedraw = false;
      });
      video.src = filePath;
      // Must set playbackRate *after* setting the file path
      video.playbackRate = playbackRate;
    } else if (fileType == "iframe") {
      // If the extra is an iframe, then the URL can be absolute
      var re = new RegExp("^(http|https)://", "i");
      var match = re.test(this.mediaPath);
      if (match) {
        filePath = this.mediaPath;
      }
      var extra_params = "";
      // Prevent external links inside an iframe from navigating the page away.
      if (sandboxIframe) {
        extra_params += " sandbox='allow-scripts allow-same-origin allow-modals allow-pointer-lock allow-forms allow-top-navigation'";
      }
      extrasHtml = `<iframe id="extras-iframe" scrolling="yes" ${extra_params}></iframe>`;
      this.$extrasContentContainer.html(extrasHtml).dialog("open");
      var iframe = document.getElementById("extras-iframe") as HTMLIFrameElement;
      $(iframe).one('load', function() {
        that.ready = true;
        that.nextFrameNeedsRedraw = false;
        that.afterLoad(that);
      });
      iframe.src = filePath;
    }

    // TODO: _letterBoxFit_ is for legacy support, since we now do this via the "objectFit" metadata param
    if (objectFit == "contain" || extrasName.indexOf("_letterBoxFit_") > 0) {
      $("#extras-image, #extras-video").css("object-fit", "contain");
    }

    this.$extrasContentContainer.data("layer-id", this.id);
  }

  afterLoad(that) {
    if (gEarthTime.snaplapseViewerForPresentationSlider && gEarthTime.autoModeBeforeSlideChangeState.isAutoModeEnabled) {
      var extrasMediaType = "";
      gEarthTime.layerDB.visibleLayers.forEach(function(layerProxy) {
        if (layerProxy?.layer.mapType.startsWith("extras-")) {
          extrasMediaType = layerProxy.layer.mediaType;
          return;
        }
      });
      if (extrasMediaType == "video") {
        var $videoExtra = $("#extras-video") as JQuery<HTMLVideoElement>;
        $videoExtra.off('pause play ended');
        gEarthTime.snaplapseViewerForPresentationSlider.clearAutoModeTimeout();
        // @ts-ignore
        $videoExtra[0].originalLoop = $videoExtra[0].loop;
        $videoExtra[0].loop = false;
        gEarthTime.autoModeBeforeSlideChangeState.isAutoModeEnabled = gEarthTime.snaplapseViewerForPresentationSlider.isAutoModeEnabled();
        that.lastAutoModeStateBeforeManualSet = gEarthTime.autoModeBeforeSlideChangeState.isAutoModeEnabled;
        gEarthTime.snaplapseViewerForPresentationSlider.setAutoModeEnableState(false);
        $videoExtra.one('ended', function() {
          // @ts-ignore
          $videoExtra[0].loop = $videoExtra[0].originalLoop;
          gEarthTime.snaplapseViewerForPresentationSlider.setAutoModeEnableState(gEarthTime.autoModeBeforeSlideChangeState.isAutoModeEnabled);
          if (gEarthTime.autoModeBeforeSlideChangeState.isAutoModeRunning) {
            if (!gEarthTime.snaplapseViewerForPresentationSlider.isAutoModeEnabled() && that.lastAutoModeStateBeforeManualSet) {
              gEarthTime.snaplapseViewerForPresentationSlider.setAutoModeEnableState(true);
            }
            gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeWaypointTimeout(1500);
          } else {
            if ($videoExtra[0].loop) {
              $videoExtra[0].play();
            }
            gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeIdleTimeout();
          }
        });
        $videoExtra.on('pause', function() {
          gEarthTime.snaplapseViewerForPresentationSlider.setAutoModeEnableState(gEarthTime.autoModeBeforeSlideChangeState.isAutoModeEnabled);
          gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeIdleTimeout();
        });
        $videoExtra.on('play', function() {
          that.lastAutoModeStateBeforeManualSet = gEarthTime.autoModeBeforeSlideChangeState.isAutoModeEnabled;
          gEarthTime.snaplapseViewerForPresentationSlider.setAutoModeEnableState(false);
          gEarthTime.snaplapseViewerForPresentationSlider.clearAutoModeTimeout();
          if (gEarthTime.autoModeBeforeSlideChangeState.isAutoModeRunninge && !gEarthTime.snaplapseViewerForPresentationSlider.isAutoModePromptActive()) {
            gEarthTime.snaplapseViewerForPresentationSlider.setAutoModePrompt(true);
          }
        });        
      } else if (extrasMediaType == "iframe") {
        var $iframeExtra = $("#extras-iframe") as JQuery<HTMLIFrameElement>;
        $(window).off('blur', this.iframeClickHandler);
        window.focus();
        if (gEarthTime.autoModeBeforeSlideChangeState.isAutoModeRunning) {
          gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeWaypointTimeout();
        }
        this.iframeClickHandler = function() {
          window.setTimeout(function () {
            if (document.activeElement == $iframeExtra[0]) {
              gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeIdleTimeout();
              window.focus();
              $("body").trigger("click", {forceHide : true});
            }
          }, 0);
        }
        $(window).on('blur', this.iframeClickHandler);
      } else if (extrasMediaType) {
        if (gEarthTime.autoModeBeforeSlideChangeState.isAutoModeRunning) {
          gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeWaypointTimeout();
        } else {
          gEarthTime.snaplapseViewerForPresentationSlider.startAutoModeIdleTimeout();
        }
      }
    }
  }
}
