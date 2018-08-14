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
    var on_hide_callback = settings["on_hide_callback"];
    var $container = $("#" + container_id);
    var $this;
    var $start_time, $end_time, $start_time_button, $end_time_button;
    var $set_speed_container;
    var $speed_slow_button, $speed_medium_button, $speed_fast_button;
    var $speed_slow_button_radio, $speed_medium_button_radio, $speed_fast_button_radio;
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
      // TODO: find a way to generate a new one correctly, currently there is a bug that the newly created one will be placed below the video tiles
      //thumbnail_tool = timelapse.getThumbnailTool();
      thumbnail_tool = new ThumbnailTool(timelapse, {paneZindex: 15, id: "set-view-thumbnail-tool"});

      // Toggle view
      $("#" + container_id + " .set-view-tool-toggle-view-button").on("click", function () {
        thumbnail_tool.swapBoxWidthHeight();
      });

      // Set start time and end time
      $set_speed_container = $("#" + container_id + " .set-view-tool-set-speed-container");
      $start_time = $("#" + container_id + " .set-view-tool-start-time");
      $end_time = $("#" + container_id + " .set-view-tool-end-time");
      $start_time_button = $("#" + container_id + " .set-view-tool-start-time-button").on("click", function () {
        setStartTime();
      });
      $end_time_button = $("#" + container_id + " .set-view-tool-end-time-button").on("click", function () {
        setEndTime();
      });

      // Select playback speed
      $speed_slow_button = $("#" + container_id + " .set-view-tool-speed-slow-button");
      $speed_slow_button_radio = $speed_slow_button.find("input[type='radio']");
      $speed_medium_button = $("#" + container_id + " .set-view-tool-speed-medium-button");
      $speed_medium_button_radio = $speed_medium_button.find("input[type='radio']");
      $speed_fast_button = $("#" + container_id + " .set-view-tool-speed-fast-button");
      $speed_fast_button_radio = $speed_fast_button.find("input[type='radio']");
      $speed_slow_button.on("click", function () {
        $speed_medium_button_radio.prop("checked", false);
        $speed_fast_button_radio.prop("checked", false);
        $speed_slow_button_radio.prop("checked", true);
      });
      $speed_medium_button.on("click", function () {
        $speed_slow_button_radio.prop("checked", false);
        $speed_fast_button_radio.prop("checked", false);
        $speed_medium_button_radio.prop("checked", true);
      });
      $speed_fast_button.on("click", function () {
        $speed_slow_button_radio.prop("checked", false);
        $speed_medium_button_radio.prop("checked", false);
        $speed_fast_button_radio.prop("checked", true);
      });

      // Set view and return
      $("#" + container_id + " .set-view-tool-set-view-button").on("click", function () {
        setView();
      });
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
      var url = thumbnail_tool.getURL()["url"]; // TODO: not sure why this url does not work
      if (typeof on_view_set_callback === "function") {
        on_view_set_callback(url);
      }
    }

    function removeClass($e, c) {
      if ($e.hasClass(c)) $e.removeClass(c)
    }

    function addClass($e, c) {
      if (!$e.hasClass(c)) $e.addClass(c)
    }

    function reset() {
      setStartTime();
      setEndTime();
    }

    //timelapse.getShareView()

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var show = function () {
      thumbnail_tool.forceAspectRatio(16, 9);
      thumbnail_tool.showCropBox();
      thumbnail_tool.removeCropHandleEvents();
      reset();
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