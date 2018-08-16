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
    var container_id = settings["container_id"];
    var on_view_set_callback = settings["on_view_set_callback"];
    var on_cancel_callback = settings["on_cancel_callback"];
    var on_hide_callback = settings["on_hide_callback"];
    var $container = $("#" + container_id);
    var $this;
    var $start_time, $end_time, $start_time_button, $end_time_button;
    var $speed_slow_radio, $speed_medium_radio, $speed_fast_radio;
    var $video_settings, $set_to_image_radio, $set_to_video_radio;
    var thumbnail_tool;
    var start_frame_number, end_frame_number;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $.ajax({
        dataType: "html",
        url: "SetViewTool.html",
        success: function (html_template) {
          creatUI(html_template);
        },
        error: function () {
          console.log("Error loading the set view tool html template.");
        }
      });
    }

    function creatUI(html_template) {
      $container.append($(html_template));
      $this = $("#" + container_id + " .set-view-tool");

      // Thumbnail tool
      thumbnail_tool = new ThumbnailTool(timelapse, {
        paneZindex: 15,
        id: "set-view-thumbnail-tool"
      });

      // Toggle view
      $("#" + container_id + " .set-view-tool-toggle-view-button").on("click", function () {
        toggleView();
      });

      // Video settings
      $video_settings = $("#" + container_id + " .set-view-tool-video-settings");
      $set_to_image_radio = $("#" + container_id + " #set-view-tool-set-to-image-input");
      $set_to_video_radio = $("#" + container_id + " #set-view-tool-set-to-video-input");
      $("#" + container_id + " .set-view-tool-type input:radio[name='type']").change(function () {
        var val = $(this).val();
        if (val == "video") {
          $video_settings.show();
        } else {
          $video_settings.hide();
        }
      });

      // Set start time and end time
      $start_time = $("#" + container_id + " .set-view-tool-start-time");
      $end_time = $("#" + container_id + " .set-view-tool-end-time");
      $start_time_button = $("#" + container_id + " .set-view-tool-start-time-button").on("click", function () {
        setStartTime();
      });
      $end_time_button = $("#" + container_id + " .set-view-tool-end-time-button").on("click", function () {
        setEndTime();
      });

      // Select playback speed
      $speed_slow_radio = $("#" + container_id + " #set-view-tool-speed-slow-input");
      $speed_medium_radio = $("#" + container_id + " #set-view-tool-speed-medium-input");
      $speed_fast_radio = $("#" + container_id + " #set-view-tool-speed-fast-input");
      $("#" + container_id + " .set-view-tool-speed input:radio[name='playback-speed']").change(function () {
        var val = $(this).val();
        if (val == "slow") {
          // set speed to slow
        } else if (val == "fast") {
          // set speed to fast
        } else {
          // set speed to medium
        }
      });

      // Set view
      $("#" + container_id + " .set-view-tool-set-view-button").on("click", function () {
        setView();
      });

      // Cancel
      $("#" + container_id + " .set-view-tool-cancel-button").on("click", function () {
        cancel();
      });
    }

    function syncSettingsToViewer() {
      var ps = timelapse.getPlaybackRate();
      if (ps == 0.25) {
        $speed_slow_radio.prop("checked", true).trigger("change");
      } else if (ps == 1) {
        $speed_fast_radio.prop("checked", true).trigger("change");
      } else {
        $speed_medium_radio.prop("checked", true).trigger("change");
      }
      setStartTime();
      setEndTime();
    }

    function cancel() {
      if (typeof on_cancel_callback === "function") {
        on_cancel_callback();
      }
    }

    function toggleView() {
      thumbnail_tool.swapBoxWidthHeight();
    }

    function setStartTime() {
      var captureTimes = timelapse.getCaptureTimes();
      var n = timelapse.getCurrentFrameNumber();
      start_frame_number = n;
      $start_time.val(captureTimes[n]);
      if (typeof end_frame_number !== "undefined" && n > end_frame_number) {
        end_frame_number = n;
        $end_time.val(captureTimes[n]);
      }
    }

    function setEndTime() {
      var captureTimes = timelapse.getCaptureTimes();
      var n = timelapse.getCurrentFrameNumber();
      end_frame_number = n;
      $end_time.val(captureTimes[n]);
      if (typeof start_frame_number !== "undefined" && n < start_frame_number) {
        start_frame_number = n;
        $start_time.val(captureTimes[n]);
      }
    }

    function setView() {
      var url_landscape = thumbnail_tool.getURL();
      toggleView();
      var url_portrait = thumbnail_tool.getURL();
      toggleView();
      if (url_landscape["args"]["width"] < url_landscape["args"]["height"]) {
        var tmp = url_landscape;
        url_landscape = url_portrait;
        url_portrait = tmp;
      }
      // Check which one is the landscape view
      if (typeof on_view_set_callback === "function") {
        on_view_set_callback(url_landscape["url"], url_portrait["url"]);
      }
    }

    function removeClass($e, c) {
      if ($e.hasClass(c)) $e.removeClass(c)
    }

    function addClass($e, c) {
      if (!$e.hasClass(c)) $e.addClass(c)
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var show = function () {
      thumbnail_tool.forceAspectRatio(16, 9);
      thumbnail_tool.showCropBox();
      syncSettingsToViewer();
      $this.show();
    };
    this.show = show;

    var hide = function () {
      thumbnail_tool.hideCropBox();
      $this.hide();
      if (typeof on_hide_callback === "function") {
        on_hide_callback();
      }
    };
    this.hide = hide;

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