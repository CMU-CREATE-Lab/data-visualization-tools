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
    var $speed_slow_button, $speed_medium_button, $speed_fast_button
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

      // Select playback speed
      var c = "custom-radio-active";
      $speed_slow_button = $("#" + container_id + " .set-view-tool-speed-slow-button");
      $speed_medium_button = $("#" + container_id + " .set-view-tool-speed-medium-button");
      $speed_fast_button = $("#" + container_id + " .set-view-tool-speed-fast-button");
      $speed_slow_button.on("click", function () {
        removeClass($speed_medium_button, c)
        removeClass($speed_fast_button, c)
        addClass($speed_slow_button, c)
      });
      $speed_medium_button.on("click", function () {
        removeClass($speed_slow_button, c)
        removeClass($speed_fast_button, c)
        addClass($speed_medium_button, c)
      });
      $speed_fast_button.on("click", function () {
        removeClass($speed_slow_button, c)
        removeClass($speed_medium_button, c)
        addClass($speed_fast_button, c)
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
      timelapse.getThumbnailTool().centerAndDrawCropBox();
      $this.show();
    };
    this.show = show;

    var hide = function () {
      timelapse.getThumbnailTool().hideCropBox();
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