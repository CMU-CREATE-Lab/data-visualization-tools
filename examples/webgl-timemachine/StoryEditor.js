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
    var $theme_title, $theme_description;
    var $story_title, $story_long_title, $story_description, $story_authors, $story_view;

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
      $theme_title = $theme_metadata.find(".story-editor-theme-title-textbox");
      $theme_description = $theme_metadata.find(".story-editor-theme-description-textbox");
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
      $story_title = $story_metadata.find(".story-editor-story-title-textbox");
      $story_long_title = $story_metadata.find(".story-editor-story-long-title-textbox");
      $story_description = $story_metadata.find(".story-editor-story-description-textbox");
      $story_authors = $story_metadata.find(".story-editor-story-authors-textbox");
      $story_view = $story_metadata.find(".story-editor-thumbnail-preview-landscape");
    }

    function setThumbnailPreview(urls) {
      $current_thumbnail_preview_container.show();
      var $l = $current_thumbnail_preview_container.find(".story-editor-thumbnail-preview-landscape");
      var $p = $current_thumbnail_preview_container.find(".story-editor-thumbnail-preview-portrait");
      $l.prop("href", urls["landscape"]["render"]["url"]);
      $l.data("view", urls["landscape"]["render"]["orignialRootUrl"]);
      $l.find("img").prop("src", urls["landscape"]["preview"]["url"]);
      $p.prop("href", urls["portrait"]["render"]["url"]);
      $p.data("view", urls["portrait"]["render"]["orignialRootUrl"]);
      $p.find("img").prop("src", urls["portrait"]["preview"]["url"]);
    }

    // For waypoints
    function createWaypointUI() {
      // For displaying waypoints
      $waypoints = $this.find(".story-editor-waypoints");
      $waypoints.find(".back-button").on("click", function () {
        transition($waypoints, $story_metadata);
      });
      $waypoints.find(".next-button").on("click", function () {
        // Download data as a spreadsheet
        download(getDataAsSheet());
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
      $waypoint_tab.find(".story-editor-waypoint-title-textbox").on("change", function () {
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

    // Collect story data from the user interface
    function collectData() {
      // Theme
      var theme_title = $theme_title.val();
      var theme_description = $theme_description.val();

      // Story
      var story_title = $story_title.val();
      var story_long_title = $story_long_title.val();
      var story_description = $story_description.val();
      var story_authors = $story_authors.val();
      var story_view = $story_view.data("view");

      // Waypoints
      var waypoints = [];
      $waypoints_accordion.find(".story-editor-accordion-tab").each(function () {
        var $ui = $(this);
        var waypoint_title = $ui.find(".story-editor-waypoint-title-textbox").val();
        var waypoint_long_title = $ui.find(".story-editor-waypoint-long-title-textbox").val();
        var waypoint_description = $ui.find(".story-editor-waypoint-description-textbox").val();
        var waypoint_view = $ui.find(".story-editor-thumbnail-preview-landscape").data("view");
        waypoints.push({
          waypoint_title: waypoint_title,
          waypoint_long_title: waypoint_long_title,
          waypoint_description: waypoint_description,
          waypoint_view: waypoint_view
        });
      });

      // Return
      return [{
        theme_title: theme_title,
        theme_description: theme_description,
        stories: [{
          story_title: story_title,
          story_long_title: story_long_title,
          story_description: story_description,
          story_view: story_view,
          story_authors: story_authors,
          waypoints: waypoints
        }]
      }]
    }

    // Download text as spreadsheet
    function download(text) {
      var a = document.createElement("a");
      a.href = "data:attachment/text," + encodeURI(text);
      a.target = "_blank";
      a.download = "story.tsv";
      a.click();
    }

    // Format the story data from the UI into a tsv spreadsheet
    function getDataAsSheet() {
      var sheet = "Waypoint Title\tAnnotation Title\tAnnotation Text\tShare View\tAuthor\n";
      var data = collectData();
      for (var i = 0; i < data.length; i++) {
        var t = data[i]; // theme
        sheet += "#" + t.theme_title + "\t" + t.theme_title + "\t" + t.theme_description + "\t\t\n";
        for (var j = 0; j < t["stories"].length; j++) {
          var s = t["stories"][j]; // story
          sheet += "##" + s.story_title + "\t" + s.story_long_title + "\t" + s.story_description + "\t" + s.story_view + "\t" + s.story_authors + "\n";
          for (var k = 0; k < s["waypoints"].length; k++) {
            var w = s["waypoints"][k]; // waypoints
            sheet += w.waypoint_title + "\t" + w.waypoint_long_title + "\t" + w.waypoint_description + "\t" + w.waypoint_view + "\t\n";
          }
        }
      }
      return sheet;
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
