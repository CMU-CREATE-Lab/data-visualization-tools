(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var StoryEditor = function (timelapse, settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    var container_id = settings["container_id"];
    var on_show_callback = settings["on_show_callback"];
    var on_hide_callback = settings["on_hide_callback"];
    var $container = $("#" + container_id);
    var $intro;
    var $theme_metadata, $story_metadata, $waypoints, $load;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $.ajax({
        dataType: "html",
        url: "StoryEditor.html",
        success: function (html_template) {
          creatUI(html_template);
          //show();
        },
        error: function () {
          console.log("Error reading the story editor html template.");
        }
      });
    }

    function creatUI(html_template) {
      $container.html(html_template);

      // The introduction page
      $intro = $("#" + container_id + " .story-editor-intro");
      $intro.find(".story-editor-create-button").on("click", function () {
        transition($intro, $theme_metadata);
      });
      $intro.find(".story-editor-edit-button").on("click", function () {
        transition($intro, $load);
      });

      // For creating a theme
      $theme_metadata = $("#" + container_id + " .story-editor-theme-metadata");
      $theme_metadata.find(".story-editor-back-button").on("click", function () {
        transition($theme_metadata, $intro);
      });
      $theme_metadata.find(".story-editor-next-button").on("click", function () {
        transition($theme_metadata, $story_metadata);
      });

      // For creating a story
      $story_metadata = $("#" + container_id + " .story-editor-story-metadata");
      $story_metadata.find(".story-editor-back-button").on("click", function () {
        transition($story_metadata, $theme_metadata);
      });
      $story_metadata.find(".story-editor-next-button").on("click", function () {
        transition($story_metadata, $waypoints);
      });

      // For adding waypoints
      $waypoints = $("#" + container_id + " .story-editor-waypoints");
      $waypoints.find(".story-editor-back-button").on("click", function () {
        transition($waypoints, $story_metadata);
      });
      $waypoints.find(".story-editor-next-button").on("click", function () {
        //transition($waypoints, );
      });
      $waypoints.find(".story-editor-accordion").accordion({
        header: "> div > h3",
        heightStyle: "content"
      }).sortable({
        axis: "y",
        handle: "h3",
        stop: function (event, ui) {
          // IE doesn't register the blur when sorting
          // so trigger focusout handlers to remove .ui-state-focus
          ui.item.children("h3").triggerHandler("focusout");
          // Refresh accordion to handle new order
          $(this).accordion("refresh");
        }
      });

      // For loading a Google spreadsheet
      $load = $("#" + container_id + " .story-editor-load");
      $load.find(".story-editor-back-button").on("click", function () {
        transition($load, $intro);
      });
      $load.find(".story-editor-next-button").on("click", function () {
        //transition($load, );
      });
    }


    // Make a transition from one DOM element to another
    function transition($from, $to) {
      if (typeof $from !== "undefined") {
        $from.fadeOut(300, function () {
          if (typeof $to !== "undefined") {
            $to.fadeIn(300);
          }
        });
      } else {
        if (typeof $to !== "undefined") {
          $to.fadeIn(300);
        }
      }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var show = function () {
      timelapse.pause();
      if ($container.is(":visible")) return;
      $container.show();
      if (typeof on_show_callback === "function") {
        on_show_callback();
      }
    };
    this.show = show;

    var hide = function () {
      if (!$container.is(":visible")) return;
      $container.hide();
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
  if (!window.StoryEditor) {
    window.StoryEditor = StoryEditor;
  }
})();
