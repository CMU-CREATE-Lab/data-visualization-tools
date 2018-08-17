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
    var $speed, $speed_slow_radio, $speed_medium_radio, $speed_fast_radio;
    var $video_settings, $type;
    var $delay_start, $delay_end;
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
      $type = $this.find(".set-view-tool-type");
      $type.find("input:radio[name='type']").on("change", changeViewType);

      // Start and end time
      $start_time = $this.find(".set-view-tool-start-time");
      $end_time = $this.find(".set-view-tool-end-time");
      $this.find(".set-view-tool-start-time-button").on("click", setStartTime);
      $this.find(".set-view-tool-end-time-button").on("click", setEndTime);

      // Playback speed
      $speed = $this.find(".set-view-tool-speed");
      $speed_slow_radio = $this.find("#set-view-tool-speed-slow-input");
      $speed_medium_radio = $this.find("#set-view-tool-speed-medium-input");
      $speed_fast_radio = $this.find("#set-view-tool-speed-fast-input");

      // Delays
      $delay_start = $this.find(".set-view-tool-start-delay-time");
      $delay_end = $this.find(".set-view-tool-end-delay-time");

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

    // Parse the capture time string to the format for the thumbnail server
    function parseCaptureTime(capture_time, flag) {
      var default_month = (flag == "end") ? 12 : 1;
      var default_day = (flag == "end") ? 31 : 1;
      var split = capture_time.replace("UTC", "").replace(/[ T:]/g, "-").replace(".00Z", "").split("-");
      var Y = parseInt(split[0]);
      var M = parseInt(split[1]) || default_month;
      var D = parseInt(split[2]) || default_day;
      var h = parseInt(split[3]) || 0;
      var m = parseInt(split[4]) || 0;
      var s = parseInt(split[5]) || 0;
      var len = (h == 0 && m == 0 && s == 0) ? 10 : 19;
      return new Date(Date.UTC(Y, (M - 1), D, h, m, s)).toISOString().substr(0, len).replace(/[-T:]/g, "");
    }

    // Collect the parameters from the user interface
    function collectParameters() {
      // View type
      var type = $type.find("input:radio[name='type']:checked").val();

      // Start time
      var start_time = parseCaptureTime($start_time.val(), "start");

      // Return settings for image
      if (type == "image") {
        return {
          bt: start_time,
          et: start_time,
          embedTime: true,
          format: "png"
        };
      }

      // End time
      var end_time = parseCaptureTime($end_time.val(), "end");

      // Playback speed
      var speed = $speed.find("input:radio[name='playback-speed']:checked").val();
      var speed = parseFloat(speed) * 100;

      // Delays
      var delay_start = parseFloat($delay_start.val());
      var delay_end = parseFloat($delay_end.val());

      // Return settings for video
      return {
        ps: speed,
        bt: start_time,
        et: end_time,
        fps: 30,
        embedTime: true,
        startDwell: delay_start,
        endDwell: delay_end,
        format: "mp4"
      }
    }

    // Set the view and pass in the url to the callback function
    function setView() {
      // Collect parameters
      var para = collectParameters();
      console.log(para);

      // Get landscape and portrait urls from the thumbnail tool
      var url_landscape = thumbnail_tool.getURL(para);
      toggleView();
      var url_portrait = thumbnail_tool.getURL(para);
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