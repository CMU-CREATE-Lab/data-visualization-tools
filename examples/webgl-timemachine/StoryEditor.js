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
    var set_view_tool;
    var $container = $("#" + container_id);
    var $this;
    var $intro, $theme_metadata, $story_metadata, $waypoints, $load;
    var $waypoints_accordion, $waypoint_template;

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
          show();
          timelapse.pause();
        },
        error: function () {
          console.log("Error loading the story editor html template.");
        }
      });
    }

    function creatUI(html_template) {
      $container.append($(html_template));
      $this = $("#" + container_id + " .story-editor");
      createSetViewTool();
      createIntroductionUI();
      createThemeUI();
      createWaypointUI();
      createLoadUI();
    }

    function createSetViewTool() {
      // For setting a view from the timelapse viewer
      set_view_tool = new SetViewTool(timelapse, {
        container_id: container_id,
        on_view_set_callback: function () {
          $this.show();
          set_view_tool.hide();
        }
      });
    }

    function createIntroductionUI() {
      // The introduction page
      $intro = $("#" + container_id + " .story-editor-intro");
      $intro.find(".story-editor-create-button").on("click", function () {
        transition($intro, $theme_metadata);
      });
      $intro.find(".story-editor-edit-button").on("click", function () {
        transition($intro, $load);
      });
    }

    function createThemeUI() {
      // For creating a theme
      $theme_metadata = $("#" + container_id + " .story-editor-theme-metadata");
      $theme_metadata.find(".back-button").on("click", function () {
        transition($theme_metadata, $intro);
      });
      $theme_metadata.find(".next-button").on("click", function () {
        transition($theme_metadata, $story_metadata);
      });

      // For creating a story
      $story_metadata = $("#" + container_id + " .story-editor-story-metadata");
      $story_metadata.find(".back-button").on("click", function () {
        transition($story_metadata, $theme_metadata);
      });
      $story_metadata.find(".next-button").on("click", function () {
        transition($story_metadata, $waypoints);
      });
      $story_metadata.find(".story-editor-set-cover-view-button").on("click", function () {
        set_view_tool.show();
        $this.hide();
      });
    }

    function createWaypointUI() {
      // For displaying waypoints
      $waypoints = $("#" + container_id + " .story-editor-waypoints");
      $waypoints.find(".back-button").on("click", function () {
        transition($waypoints, $story_metadata);
      });
      $waypoints.find(".next-button").on("click", function () {
        // download the story as a spreadsheet
      });
      $waypoints_accordion = $waypoints.find(".story-editor-accordion").accordion({
        header: "> div > h3",
        heightStyle: "content",
        animate: false
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

      // For adding and deleting waypoints
      var $waypoint_tab = $waypoints_accordion.find(".story-editor-accordion-tab");
      $waypoint_tab.find(".story-editor-set-waypoint-view").on("click", function () {
        set_view_tool.show();
        $this.hide();
      });
      $waypoint_tab.find(".story-editor-add-waypoint").on("click", function () {
        // Count the current number of tabs
        var n = $waypoints_accordion.find(".story-editor-accordion-tab").length;
        // Add a new tab after the current tab
        var $current_tab = $(this).closest(".story-editor-accordion-tab");
        $current_tab.after($waypoint_template.clone(true, true));
        $waypoints_accordion.accordion("refresh");
        // Expand the newly added tab
        var active = $waypoints_accordion.accordion("option", "active");
        $waypoints_accordion.accordion("option", "active", active + 1);
        // Enable the delete button of the current tab if there was only one tab left
        if (n == 1) $current_tab.find(".story-editor-delete-waypoint").prop("disabled", false);
      });
      $waypoint_tab.find(".story-editor-delete-waypoint").on("click", function () {
        // Activate the previous tab (if the deleted one is the first tab, activate the next tab instead)
        var active = $waypoints_accordion.accordion("option", "active");
        var target = active - 1;
        if (target < 0) target = 0;
        $waypoints_accordion.accordion("option", "active", target);
        // Delete the current tab
        $(this).closest(".story-editor-accordion-tab").remove();
        $waypoints_accordion.accordion("refresh");
        // Disable the delete button of the active tab if there is only one tab left
        var $tabs = $waypoints_accordion.find(".story-editor-accordion-tab");
        if ($tabs.length == 1) $tabs.find(".story-editor-delete-waypoint").prop("disabled", true);
      });
      $waypoint_tab.find(".story-editor-set-waypoint-title").on("change", function () {
        // Set the title text of the tab
        var $ui = $(this);
        var $tab = $ui.closest(".story-editor-accordion-tab");
        $tab.find(".story-editor-waypoint-title").text($ui.val());
      });
      $waypoint_template = $waypoint_tab.clone(true, true);
      $waypoint_tab.find(".story-editor-delete-waypoint").prop("disabled", true);
    }

    function createLoadUI() {
      // For loading a Google spreadsheet
      $load = $("#" + container_id + " .story-editor-load");
      $load.find(".back-button").on("click", function () {
        transition($load, $intro);
      });
      $load.find(".next-button").on("click", function () {
        //transition($load, );
      });
    }

    // Make a transition from one DOM element to another
    function transition($from, $to) {
      var d = 0;
      if (typeof $from !== "undefined") {
        $from.fadeOut(d, function () {
          if (typeof $to !== "undefined") {
            $to.fadeIn(d);
          }
        });
      } else {
        if (typeof $to !== "undefined") {
          $to.fadeIn(d);
        }
      }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var show = function () {
      if ($this.is(":visible")) return;
      $this.show();
      if (typeof on_show_callback === "function") {
        on_show_callback();
      }
    };
    this.show = show;

    var hide = function () {
      if (!$this.is(":visible")) return;
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
  if (!window.StoryEditor) {
    window.StoryEditor = StoryEditor;
  }
})();
