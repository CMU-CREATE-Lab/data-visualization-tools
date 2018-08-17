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
    var $this;
    var $start_time, $end_time;
    var $speed_slow_radio, $speed_medium_radio, $speed_fast_radio;
    var $video_settings;
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
      $("#" + container_id).append($(html_template));
      $this = $("#" + container_id + " .set-view-tool");

      // Thumbnail tool
      thumbnail_tool = new ThumbnailTool(timelapse, {
        paneZindex: 15,
        id: "set-view-thumbnail-tool"
      });

      // Toggle view
      $this.find(".set-view-tool-toggle-view-button").on("click", toggleView);

      // Video settings
      $video_settings = $this.find(".set-view-tool-video-settings");
      $this.find(".set-view-tool-type input:radio[name='type']").on("change", changeViewType);

      // Start and end time
      $start_time = $this.find(".set-view-tool-start-time");
      $end_time = $this.find(".set-view-tool-end-time");
      $this.find(".set-view-tool-start-time-button").on("click", setStartTime);
      $this.find(".set-view-tool-end-time-button").on("click", setEndTime);

      // Playback speed
      $speed_slow_radio = $this.find("#set-view-tool-speed-slow-input");
      $speed_medium_radio = $this.find("#set-view-tool-speed-medium-input");
      $speed_fast_radio = $this.find("#set-view-tool-speed-fast-input");

      // Set view or cancel
      $this.find(".set-view-tool-set-view-button").on("click", setView);
      $this.find(".set-view-tool-cancel-button").on("click", cancel);
    }

    // Update the settings to match the ones on the time machine viewer
    function syncSettingsToViewer() {
      // Playback speed
      var ps = timelapse.getPlaybackRate();
      if (ps == 0.25) {
        $speed_slow_radio.prop("checked", true).trigger("change");
      } else if (ps == 1) {
        $speed_fast_radio.prop("checked", true).trigger("change");
      } else {
        $speed_medium_radio.prop("checked", true).trigger("change");
      }

      // Start and end time
      setStartTime();
      setEndTime();
    }

    // Change the view type to image or video
    function changeViewType() {
      var val = $(this).val();
      if (val == "video") {
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
    function toggleView() {
      thumbnail_tool.swapBoxWidthHeight();
    }

    // Set the waypoint starting time
    function setStartTime() {
      var captureTimes = timelapse.getCaptureTimes();
      var n = timelapse.getCurrentFrameNumber();
      start_frame_number = n;
      $start_time.val(captureTimes[n]);

      // Sanity check, start_frame_number should <= end_frame_number
      if (typeof end_frame_number !== "undefined" && n > end_frame_number) {
        end_frame_number = n;
        $end_time.val(captureTimes[n]);
      }
    }

    // Set the waypoint ending time
    function setEndTime() {
      var captureTimes = timelapse.getCaptureTimes();
      var n = timelapse.getCurrentFrameNumber();
      end_frame_number = n;
      $end_time.val(captureTimes[n]);

      // Sanity check, end_frame_number should >= start_frame_number
      if (typeof start_frame_number !== "undefined" && n < start_frame_number) {
        start_frame_number = n;
        $start_time.val(captureTimes[n]);
      }
    }

    // Collect the parameters from the user interface
    function collectParameters() {
      // Playback speed (slow, medium, fast)
      var speed = $this.find(".set-view-tool-speed input:radio[name='playback-speed']:checked").val();
      // View type (image, video)
      var type = $this.find(".set-view-tool-type input:radio[name='type']:checked").val();
    }

    // Set the view and pass in the url to the callback function
    function setView() {
      // Get landscape and portrait urls from the thumbnail tool
      var url_landscape = thumbnail_tool.getURL();
      toggleView();
      var url_portrait = thumbnail_tool.getURL();
      toggleView();

      // Check which one is the landscape view
      if (url_landscape["args"]["width"] < url_landscape["args"]["height"]) {
        var tmp = url_landscape;
        url_landscape = url_portrait;
        url_portrait = tmp;
      }

      // Callback
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