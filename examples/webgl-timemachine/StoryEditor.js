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
    var $this;
    var $intro, $theme_metadata, $story_metadata, $waypoints, $load;
    var $waypoints_accordion, $waypoint_template, $waypoint_delete_dialog;
    var $want_to_delete_tab;
    var $current_thumbnail_preview_container;
    var set_view_tool;
    var $theme_title, $theme_content, $story_title, $story_content, $story_authors;

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
      $("#" + container_id).append($(html_template));
      $this = $("#" + container_id + " .story-editor");
      createSetViewTool();
      createIntroductionUI();
      createThemeMetadataUI();
      createStoryMetadataUI();
      createWaypointUI();
      createLoadUI();
      // TODO: need to prevent the keyboard from firing events that control the viewer
    }

    // For setting a view from the timelapse viewer
    function createSetViewTool() {
      set_view_tool = new SetViewTool(timelapse, {
        container_id: container_id,
        on_view_set_callback: function (urls) {
          setThumbnailPreview(urls);
          $this.show();
          set_view_tool.hide();
        },
        on_cancel_callback: function () {
          $this.show();
          set_view_tool.hide();
        },
        on_hide_callback: function () {
          $current_thumbnail_preview_container = null;
        }
      });
    }

    // The introduction page
    function createIntroductionUI() {
      $intro = $this.find(".story-editor-intro");
      $intro.find(".story-editor-create-button").on("click", function () {
        transition($intro, $theme_metadata);
      });
      $intro.find(".story-editor-edit-button").on("click", function () {
        transition($intro, $load);
      });
    }

    // For creating a theme
    function createThemeMetadataUI() {
      $theme_metadata = $this.find(".story-editor-theme-metadata");
      $theme_metadata.find(".back-button").on("click", function () {
        transition($theme_metadata, $intro);
      });
      $theme_metadata.find(".next-button").on("click", function () {
        transition($theme_metadata, $story_metadata);
      });
      $theme_title = $theme_metadata.find(".theme-title-textbox");
      $theme_content = $theme_metadata.find(".theme-content-textbox");
    }

    // For creating a story
    function createStoryMetadataUI() {
      $story_metadata = $this.find(".story-editor-story-metadata");
      $story_metadata.find(".back-button").on("click", function () {
        transition($story_metadata, $theme_metadata);
      });
      $story_metadata.find(".next-button").on("click", function () {
        transition($story_metadata, $waypoints);
      });
      $story_metadata.find(".story-editor-set-cover-view-button").on("click", function () {
        set_view_tool.show();
        $current_thumbnail_preview_container = $story_metadata.find(".story-editor-thumbnail-preview-container");
        $this.hide();
      });
      $story_metadata.find(".story-editor-thumbnail-preview-container").hide();
      $story_title = $story_metadata.find(".story-title-textbox");
      $story_content = $story_metadata.find(".story-content-textbox");
      $story_authors = $story_metadata.find(".story-authors-textbox");
    }

    function setThumbnailPreview(urls) {
      $current_thumbnail_preview_container.show();
      var $l = $current_thumbnail_preview_container.find(".story-editor-thumbnail-preview-landscape");
      var $p = $current_thumbnail_preview_container.find(".story-editor-thumbnail-preview-portrait");
      $l.prop("href", urls["landscape"]["render"]);
      $l.find("img").prop("src", urls["landscape"]["preview"]);
      $p.prop("href", urls["portrait"]["render"]);
      $p.find("img").prop("src", urls["portrait"]["preview"]);
    }

    // For waypoints
    function createWaypointUI() {
      // For displaying waypoints
      $waypoints = $this.find(".story-editor-waypoints");
      $waypoints.find(".back-button").on("click", function () {
        transition($waypoints, $story_metadata);
      });
      $waypoints.find(".next-button").on("click", function () {
        // Collect data
        var data = collectData();
        console.log(data);
        // download the story as a spreadsheet
      });
      $waypoints_accordion = $waypoints.find(".story-editor-accordion").accordion({
        header: "> div > h3",
        heightStyle: "content",
        animate: false,
        collapsible: true
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
        var $current_tab = $(this).closest(".story-editor-accordion-tab");
        $current_thumbnail_preview_container = $current_tab.find(".story-editor-thumbnail-preview-container");
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
        $waypoint_delete_dialog.dialog("open");
        $want_to_delete_tab = $(this).closest(".story-editor-accordion-tab");
      });
      $waypoint_tab.find(".story-editor-set-waypoint-title").on("change", function () {
        // Set the title text of the tab
        var $ui = $(this);
        var $tab = $ui.closest(".story-editor-accordion-tab");
        $tab.find(".story-editor-waypoint-title-text").text($ui.val());
      });
      $waypoint_tab.find(".story-editor-thumbnail-preview-container").hide();
      $waypoint_template = $waypoint_tab.clone(true, true);
      $waypoint_tab.find(".story-editor-delete-waypoint").prop("disabled", true);

      // The confirm dialog when deleting a waypoint
      $waypoint_delete_dialog = $this.find(".story-editor-delete-waypoint-confirm-dialog");
      $waypoint_delete_dialog.dialog({
        appendTo: $this,
        autoOpen: false,
        resizable: false,
        height: "auto",
        draggable: false,
        width: 245,
        modal: true,
        position: {my: "center", at: "center", of: $this},
        classes: {"ui-dialog": "custom-dialog"}, // this is for jquery 1.12 and after
        dialogClass: "custom-dialog", // this is for before jquery 1.12
        buttons: {
          "Delete": {
            class: "ui-delete-button",
            text: "Delete",
            click: function () {
              $(this).dialog("close");
              // Delete the current tab
              $want_to_delete_tab.remove();
              $waypoints_accordion.accordion("option", "active", false);
              $want_to_delete_tab = null;
              // Disable the delete button of the active tab if there is only one tab left
              var $tabs = $waypoints_accordion.find(".story-editor-accordion-tab");
              if ($tabs.length == 1) $tabs.find(".story-editor-delete-waypoint").prop("disabled", true);
            }
          },
          "Cancel": {
            class: "ui-cancel-button",
            text: "Cancel",
            click: function () {
              $(this).dialog("close");
              $want_to_delete_tab = null;
            }
          }
        }
      });
    }

    // For loading a Google spreadsheet
    function createLoadUI() {
      $load = $this.find(".story-editor-load");
      $load.find(".back-button").on("click", function () {
        transition($load, $intro);
      });
      $load.find(".next-button").on("click", function () {
        //transition($load, );
      });
    }

    // Collect data for the story from the user interface
    function collectData() {
      var story_title = $story_title.val();
      var story_key = stringToKey(story_title);
      var story_content = $story_content.val();
      var story_authors = $story_authors.val();
      var story = {};
      story[story_key] = {
        storyTitle: story_title,
        storyDescription: story_content,
        storyAuthor: story_authors
      };

      var waypoint_json_list = {};
      var theme_title = $theme_title.val();
      var theme_key = stringToKey(theme_title);
      var theme_content = $theme_content.val();
      waypoint_json_list[theme_key] = {
        themeTitle: theme_title,
        mainThemeDescription: theme_content,
        stories: story
      };

      return waypoint_json_list;
    }

    // Turn a string into a key for a dictionary
    function stringToKey(s) {
      return s.replace(/ /g, "_").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
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
