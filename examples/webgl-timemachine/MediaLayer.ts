import { LayerInterface, LayerOptions } from './Layer'
import { LayerProxy } from './LayerProxy';
import { Glb } from './Glb';
import { gEarthTime } from './EarthTime';

export class MediaLayer extends LayerOptions implements LayerInterface {
  layerProxy: LayerProxy;
  playbackRate: number;
  loop: boolean;
  muted: boolean;
  playbackControls: boolean;
  objectFit: string;
  mediaType: string;
  extrasOptions: {[key: string]: any};
  ready: boolean;
  id: string;
  mediaPath: string;
  title: string;
  $extrasContentContainerTitleBar: any;
  $extrasContentContainer: any;
  $extrasContentComponent: any;

  constructor(layerProxy: LayerProxy, glb: Glb, canvasLayer, tileUrl: string, layerOptions: LayerOptions) {
    super(layerOptions);
    this.layerProxy = layerProxy;
    this.extrasOptions = layerOptions.layerDef;

    this.ready = false;
    this.playbackRate = this.extrasOptions["Playback Rate"] && this.extrasOptions["Playback Rate"].trim() != '' ? parseFloat(this.extrasOptions["Playback Rate"].trim()) : 1;
    this.loop = this.extrasOptions.loop;
    this.muted = this.extrasOptions.muted;
    this.playbackControls = this.extrasOptions.controls;
    this.objectFit = this.extrasOptions['object-fit'];
    this.mediaType = this.extrasOptions["Map Type"].split("-")[1];
    this.id = this.extrasOptions["Share link identifier"].replace(/\W+/g, '_');
    this.mediaPath = this.extrasOptions["URL"];
    this.title = this.extrasOptions["Name"];

    if (this.extrasOptions["Extras Options"]?.trim()) {
      this.extrasOptions = JSON.parse(this.extrasOptions["Extras Options"]);
    }

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
    }
  }

  allVisibleTilesLoaded(): boolean {
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

  handleEnable() {
    // @ts-ignore
    gEarthTime.timelapse.addParabolicMotionStoppedListener(window.autoModeExtrasViewChangeHandler);

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

    this.$extrasContentContainer.empty();

    // @ts-ignore
    if (window.disableUI) {
      // Fit to window, without title bar
      this.$extrasContentContainerTitleBar.hide();
      this.$extrasContentContainer.addClass("storyFriendlyDialog");
    } else if (extrasName.indexOf("_storyFriendlyDialog_") > 0 && $(".presentationSlider").is(":visible")) {
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
      image.addEventListener('load', function() {
        that.ready = true;
      });
      image.src = filePath;
    } else if (fileType == "video") {
      extrasHtml = '<video id="extras-video" autoplay></video>';
      this.$extrasContentContainer.html(extrasHtml).dialog("open");
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
        // @ts-ignore
        $video.one("loadstart", window.autoModeExtrasViewChangeHandler);
      }
      video.addEventListener('loadeddata', function() {
        that.ready = true;
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
      extrasHtml = '<iframe id="extras-iframe" scrolling="yes"></iframe>';
      this.$extrasContentContainer.html(extrasHtml).dialog("open");
      var iframe = document.getElementById("extras-iframe") as HTMLIFrameElement;
      iframe.addEventListener('load', function() {
        that.ready = true;
      });
      iframe.src = filePath;
    }

    // TODO: _letterBoxFit_ is for legacy support, since we now do this via the "objectFit" metadata param
    if (objectFit == "contain" || extrasName.indexOf("_letterBoxFit_") > 0) {
      $("#extras-image, #extras-video").css("object-fit", "contain");
    }

    this.$extrasContentContainer.data("layer-id", this.id);
  }

}
