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
    var $container = $("#" + container_id);
    var $this;
    var $speed_slow_button, $speed_medium_button, $speed_fast_button;
    var $speed_slow_button_radio, $speed_medium_button_radio, $speed_fast_button_radio;
    var thumbnail_tool;

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
      thumbnail_tool = timelapse.getThumbnailTool();
      //thumbnail_tool = new ThumbnailTool(timelapse, {});

      // Toggle view
      $("#" + container_id + " .set-view-tool-toggle-view-button").on("click", function () {
        thumbnail_tool.swapBoxWidthHeight();
      });

      // Select playback speed
      var c = "custom-radio-active";
      $speed_slow_button = $("#" + container_id + " .set-view-tool-speed-slow-button");
      $speed_slow_button_radio = $speed_slow_button.find("input[type='radio']");
      $speed_medium_button = $("#" + container_id + " .set-view-tool-speed-medium-button");
      $speed_medium_button_radio = $speed_medium_button.find("input[type='radio']");
      $speed_fast_button = $("#" + container_id + " .set-view-tool-speed-fast-button");
      $speed_fast_button_radio = $speed_fast_button.find("input[type='radio']");
      $speed_slow_button.on("click", function () {
        removeClass($speed_medium_button, c);
        removeClass($speed_fast_button, c);
        addClass($speed_slow_button, c);
        $speed_medium_button_radio.prop("checked", false);
        $speed_fast_button_radio.prop("checked", false);
        $speed_slow_button_radio.prop("checked", true);
      });
      $speed_medium_button.on("click", function () {
        removeClass($speed_slow_button, c);
        removeClass($speed_fast_button, c);
        addClass($speed_medium_button, c);
        $speed_slow_button_radio.prop("checked", false);
        $speed_fast_button_radio.prop("checked", false);
        $speed_medium_button_radio.prop("checked", true);
      });
      $speed_fast_button.on("click", function () {
        removeClass($speed_slow_button, c);
        removeClass($speed_medium_button, c);
        addClass($speed_fast_button, c);
        $speed_slow_button_radio.prop("checked", false);
        $speed_medium_button_radio.prop("checked", false);
        $speed_fast_button_radio.prop("checked", true);
      });

      // Set view and return
      $("#" + container_id + " .set-view-tool-set-view-button").on("click", function () {
        setView();
      });
    }

    function setView() {
      if (typeof on_view_set_callback === "function") {
        on_view_set_callback();
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
      thumbnail_tool.removeCropHandleEvents();
      $this.show();
    };
    this.show = show;

    var hide = function () {
      thumbnail_tool.hideCropBox();
      $this.hide();
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