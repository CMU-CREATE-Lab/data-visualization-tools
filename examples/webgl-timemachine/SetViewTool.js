// This is the set view tool for the EarthTime project
// [https://github.com/CMU-CREATE-Lab/data-visualization-tools]
// Files:
// - SetViewTool.js
// - SetViewTool.html
// - SetViewTool.css
// Dependencies:
// - jQuery [https://jquery.com/]
// - time machine [https://github.com/CMU-CREATE-Lab/timemachine-viewer]
// - the wizard template [wizard.css]

(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var SetViewTool = function (timelapse, settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    settings = (typeof settings === "undefined") ? {} : settings;
    var container_id = settings["container_id"];
    var on_view_set_callback = settings["on_view_set_callback"];
    var on_cancel_callback = settings["on_cancel_callback"];
    var on_hide_callback = settings["on_hide_callback"];
    var on_show_callback = settings["on_show_callback"];
    var $this;
    var $start_time, $end_time;
    var $landscape_view_radio, $portrait_view_radio;
    var $speed_slow_radio, $speed_medium_radio, $speed_fast_radio;
    var $type_image_radio, $type_video_radio, $video_settings;
    var $delay_start, $delay_end;
    var thumbnail_tool;
    var start_frame_number, end_frame_number;
    var DEFAULT_PREVIEW_WIDTH = 320;
    var DEFAULT_PREVIEW_HEIGHT = 180;
    var DEFAULT_ASPECT_RATIO = {
      width: 16,
      height: 9
    };
    var bound = {};

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      // Create the thumbnail tool
      thumbnail_tool = new ThumbnailTool(timelapse, {
        headlessClientHost: EARTH_TIMELAPSE_CONFIG.headlessClientHost,
        paneZindex: 15,
        id: "set-view-thumbnail-tool",
        defaultBoxPadding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      });
      var absolute_path_to_html = document.querySelector('script[src*="SetViewTool.js"]').src.replace(".js", ".html");
      // Load the html template
      $.ajax({
        dataType: "html",
        url: absolute_path_to_html,
        success: function (html_template) {
          createUI(html_template);
        },
        error: function () {
          console.log("Error loading the set view tool html template.");
        }
      });
    }

    function createUI(html_template) {
      $("#" + container_id).append($(html_template));
      $this = $("#" + container_id + " .set-view-tool");

      // Toggle view
      $landscape_view_radio = $this.find(".set-view-tool-toggle-landscape-view-radio");
      $portrait_view_radio = $this.find(".set-view-tool-toggle-portrait-view-radio");
      $this.find("input:radio[name='set-view-tool-toggle-view-radio']").on("change", toggleViewDirection);

      // Video settings
      $video_settings = $this.find(".set-view-tool-video-settings");
      $type_image_radio = $this.find("#set-view-tool-set-to-image-input");
      $type_video_radio = $this.find("#set-view-tool-set-to-video-input");
      $this.find("input:radio[name='set-view-tool-type-input']").on("change", changeViewType);

      // Start and end time
      $start_time = $this.find(".set-view-tool-start-time");
      $end_time = $this.find(".set-view-tool-end-time");
      $this.find(".set-view-tool-start-time-button").on("click", syncStartTime);
      $this.find(".set-view-tool-end-time-button").on("click", syncEndTime);

      // Playback speed
      $speed_slow_radio = $this.find("#set-view-tool-speed-slow-input");
      $speed_medium_radio = $this.find("#set-view-tool-speed-medium-input");
      $speed_fast_radio = $this.find("#set-view-tool-speed-fast-input");

      // Delays
      $delay_start = $this.find(".set-view-tool-start-delay-time");
      $delay_end = $this.find(".set-view-tool-end-delay-time");

      // Set view or cancel
      $this.find(".set-view-tool-save-view-button").on("click", saveView);
      $this.find(".set-view-tool-cancel-button").on("click", cancel);
    }

    // Update the settings to match the ones on the time machine viewer
    function syncSettingsToViewer() {
      setPlaybackSpeed(timelapse.getPlaybackRate());
      syncStartTime();
      syncEndTime();
    }

    // Change the view type to image or video
    function changeViewType() {
      if ($(this).val() == "video") {
        $video_settings.show();
      } else {
        $video_settings.hide();
      }
    }

    // Cancel this tool
    function cancel() {
      if (typeof on_cancel_callback === "function") {
        on_cancel_callback();
      }
    }

    // Swap the width and height of the thumbnail tool crop box
    function toggleViewDirection() {
      // Save current bound and load new ones (need to use the previous state of the value)
      if ($(this).val() == "portrait") {
        bound["landscape"] = thumbnail_tool.cropBoxToViewBox();
        if (typeof bound["portrait"] !== "undefined") timelapse.setNewView({
          bbox: bound["portrait"]
        }, true, false);
      } else {
        bound["portrait"] = thumbnail_tool.cropBoxToViewBox();
        if (typeof bound["landscape"] !== "undefined") timelapse.setNewView({
          bbox: bound["landscape"]
        }, true, false);
      }
      // Swap width and height
      thumbnail_tool.swapBoxWidthHeight();
    }

    // Get the view direction
    function getViewDirection() {
      return $this.find("input:radio[name='set-view-tool-toggle-view-radio']:checked").val();
    }

    // Set the playback speed
    function setPlaybackSpeed(ps) {
      if (ps == 0.25) {
        $speed_slow_radio.prop("checked", true).trigger("change");
      } else if (ps == 1) {
        $speed_fast_radio.prop("checked", true).trigger("change");
      } else {
        $speed_medium_radio.prop("checked", true).trigger("change");
      }
    }

    // Set the view type (image or video)
    function setViewType(view_type) {
      if (view_type == "image") {
        $type_image_radio.prop("checked", true).trigger("change");
      } else {
        $type_video_radio.prop("checked", true).trigger("change");
      }
    }

    // Get the view type (image or video)
    function getViewType() {
      return $this.find("input:radio[name='set-view-tool-type-input']:checked").val();
    }

    // Sync the waypoint starting time
    function syncStartTime() {
      var n = timelapse.getCurrentFrameNumber();
      var ct = timelapse.getCaptureTimeByFrameNumber(n);
      start_frame_number = n;
      $start_time.val(ct);
      $start_time.data("frameNumber", n);

      // Sanity check, start_frame_number should <= end_frame_number
      if (typeof end_frame_number !== "undefined" && n > end_frame_number) {
        end_frame_number = n;
        $end_time.val(ct);
      }
    }

    // Sync the waypoint ending time
    function syncEndTime() {
      var n = timelapse.getCurrentFrameNumber();
      var ct = timelapse.getCaptureTimeByFrameNumber(n);
      end_frame_number = n;
      $end_time.val(ct);
      $end_time.data("frameNumber", n);

      // Sanity check, end_frame_number should >= start_frame_number
      if (typeof start_frame_number !== "undefined" && n < start_frame_number) {
        start_frame_number = n;
        $start_time.val(ct);
      }
    }

    // Get playback time from frame number
    function getTimeFromFrame(frameNumber, flag) {
      var isStart = flag == "start";
      return timelapse.shareDateFromFrame(frameNumber, isStart);
    }

    // Collect the parameters from the user interface
    function collectParameters(desired_bound, desired_width, desired_height) {
      // Start time
      var start_time = getTimeFromFrame($start_time.data("frameNumber"), "start");
      // Start Time in playback time
      var start_time_in_playback_time = timelapse.playbackTimeFromShareDate(start_time);
      // Layers
      // Need to pass in 'forThumbnail' to force a real share view (which includes location, time, layers, etc) and not a story share view (which is just the name of story from a theme)
      var layers = safeGet(timelapse.getUtil().unpackVars(timelapse.getShareView(undefined, undefined, {"forThumbnail" : true})).l, "");

      // Collect the preview settings
      var preview = {
        bt: start_time,
        et: start_time,
        t: start_time_in_playback_time,
        fps: 30,
        l: layers,
        embedTime: false,
        format: "jpg",
        width: desired_width,
        height: desired_height,
        bound: desired_bound
      };

      // Return settings for image
      if (getViewType() == "image") {
        return {
          preview: preview,
          render: preview
        }
      }

      // End time
      var end_time = getTimeFromFrame($end_time.data("frameNumber"), "end");

      // Playback speed
      var speed = $this.find("input:radio[name='set-view-tool-speed-input']:checked").val();
      var speed = parseFloat(speed) * 100;

      // Delays
      var delay_start = parseFloat($delay_start.val());
      var delay_end = parseFloat($delay_end.val());

      // Return settings for video
      return {
        preview: preview,
        render: {
          ps: speed,
          bt: start_time,
          et: end_time,
          t: start_time_in_playback_time,
          fps: 30,
          l: layers,
          embedTime: false,
          startDwell: delay_start,
          endDwell: delay_end,
          format: "mp4",
          width: desired_width,
          height: desired_height,
          bound: desired_bound
        }
      }
    }

    // Save the view and pass in the urls to the callback function
    function saveView() {
      // Set bound
      var current_bound_type = $this.find("input:radio[name='set-view-tool-toggle-view-radio']:checked").val();
      bound[current_bound_type] = thumbnail_tool.cropBoxToViewBox();

      // Automatically compute another bounding box if not defined
      if (current_bound_type == "portrait") {
        bound["landscape"] = safeGet(bound["landscape"], thumbnail_tool.getRotatedBox(bound["portrait"]));
      } else {
        bound["portrait"] = safeGet(bound["portrait"], thumbnail_tool.getRotatedBox(bound["landscape"]));
      }

      // Get landscape urls from the thumbnail tool
      var p = collectParameters(bound["landscape"], DEFAULT_PREVIEW_WIDTH, DEFAULT_PREVIEW_HEIGHT);
      var url_landscape = {
        preview: thumbnail_tool.getURL(p["preview"]),
        render: thumbnail_tool.getURL(p["render"])
      };

      // Get portrait urls from the thumbnail tool
      p = collectParameters(bound["portrait"], DEFAULT_PREVIEW_HEIGHT, DEFAULT_PREVIEW_WIDTH);
      var url_portrait = {
        preview: thumbnail_tool.getURL(p["preview"]),
        render: thumbnail_tool.getURL(p["render"])
      };

      // Callback
      if (typeof on_view_set_callback === "function") {
        on_view_set_callback({
          landscape: url_landscape,
          portrait: url_portrait
        });
      }
    }

    function removeClass($e, c) {
      if ($e.hasClass(c)) $e.removeClass(c)
    }

    function addClass($e, c) {
      if (!$e.hasClass(c)) $e.addClass(c)
    }

    function reset() {
      // We only want to clear the view, not the settings
      bound = {};
    }

    // Safely get the value from a variable, return a default value if undefined
    function safeGet(v, default_val) {
      if (typeof default_val === "undefined") default_val = "";
      return (typeof v === "undefined") ? default_val : v;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var show = function () {
      if (getViewDirection() == "landscape") {
        thumbnail_tool.forceAspectRatio(DEFAULT_ASPECT_RATIO["width"], DEFAULT_ASPECT_RATIO["height"]);
      } else {
        thumbnail_tool.forceAspectRatio(DEFAULT_ASPECT_RATIO["height"], DEFAULT_ASPECT_RATIO["width"]);
      }
      thumbnail_tool.showCropBox();
      thumbnail_tool.centerAndDrawCropBox();
      syncSettingsToViewer();
      $this.show();
      if (typeof on_show_callback === "function") {
        on_show_callback();
      }
    };
    this.show = show;

    var hide = function () {
      thumbnail_tool.hideCropBox();
      $this.hide();
      reset();
      if (typeof on_hide_callback === "function") {
        on_hide_callback();
      }
    };
    this.hide = hide;

    // Set the user interface based on parameters saved in the share view
    var setUI = function (share_view_landscape, share_view_portrait) {
      if (typeof share_view_landscape === "undefined" || share_view_landscape.trim() == "") return;
      if (typeof share_view_portrait === "undefined" || share_view_portrait.trim() == "") return;

      // Currently the editor does not allow different arguments except the view bounding box
      // Use the arguments from the landscape share view url as default
      var urls = extractThumbnailUrls(share_view_landscape, share_view_portrait);
      var args_landscape = urls["landscape"]["render"]["args"];
      var args_portrait = urls["portrait"]["render"]["args"];

      var set_view_and_ui = function () {
        // Set the view
        var share_view = (getViewDirection() == "landscape") ? share_view_landscape : share_view_portrait;
        timelapse.loadSharedViewFromUnsafeURL(share_view);
        // Set the user interface of the set view tool
        var start_playback_time = timelapse.playbackTimeFromShareDate(args_landscape["bt"]);
        var end_playback_time = timelapse.playbackTimeFromShareDate(args_landscape["et"]);
        setViewType(args_landscape["format"] == "mp4" ? "video" : "image");
        setPlaybackSpeed(parseFloat(args_landscape["ps"]) / 100);
        $start_time.val(timelapse.getCaptureTimeByTime(start_playback_time));
        $start_time.data("frameNumber", timelapse.timeToFrameNumber(start_playback_time));
        $end_time.val(timelapse.getCaptureTimeByTime(end_playback_time));
        $end_time.data("frameNumber", timelapse.timeToFrameNumber(end_playback_time));
        $delay_start.val(args_landscape["startDwell"]);
        $delay_end.val(args_landscape["endDwell"]);
        if (!$.isEmptyObject(args_landscape["bound"])) bound["landscape"] = args_landscape["bound"];
        if (!$.isEmptyObject(args_portrait["bound"])) bound["portrait"] = args_portrait["bound"];
      };

      // Load the dataset back and sync the timelapse viewer
      var timeline_change_callback = function () {
        set_view_and_ui();
        timelapse.removeTimelineUIChangeListener(timeline_change_callback);
      };
      timelapse.addTimelineUIChangeListener(timeline_change_callback);
      handleLayers(args_landscape["l"].split(","));

      // We need to call this function because the timeline change listener does not always fire
      set_view_and_ui();
    };
    this.setUI = setUI;

    // Extract the landscape and portrait thumbnail urls from the share view urls
    var extractThumbnailUrls = function (share_view_landscape, share_view_portrait) {
      if (typeof share_view_landscape === "undefined" || share_view_landscape.trim() == "") return;
      if (typeof share_view_portrait === "undefined" || share_view_portrait.trim() == "") return;
      var url_landscape = {
        preview: thumbnail_tool.getUrlFromShareView({
          shareView: share_view_landscape,
          width: DEFAULT_PREVIEW_WIDTH,
          height: DEFAULT_PREVIEW_HEIGHT,
          format: "jpg"
        }),
        render: thumbnail_tool.getUrlFromShareView({
          shareView: share_view_landscape,
          width: DEFAULT_PREVIEW_WIDTH,
          height: DEFAULT_PREVIEW_HEIGHT
        })
      };
      var url_portrait = {
        preview: thumbnail_tool.getUrlFromShareView({
          shareView: share_view_portrait,
          width: DEFAULT_PREVIEW_HEIGHT,
          height: DEFAULT_PREVIEW_WIDTH,
          format: "jpg"
        }),
        render: thumbnail_tool.getUrlFromShareView({
          shareView: share_view_portrait,
          width: DEFAULT_PREVIEW_HEIGHT,
          height: DEFAULT_PREVIEW_WIDTH
        })
      };
      return {
        landscape: url_landscape,
        portrait: url_portrait
      };
    };
    this.extractThumbnailUrls = extractThumbnailUrls;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Constructor
    //
    init();
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Register to window
  //
  if (!window.SetViewTool) {
    window.SetViewTool = SetViewTool;
  }
})();