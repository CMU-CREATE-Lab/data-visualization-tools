// This is the story editor for the EarthTime project
// [https://github.com/CMU-CREATE-Lab/data-visualization-tools]
// Files:
// - StoryEditor.js
// - StoryEditor.html
// - StoryEditor.css
// Dependencies:
// - jQuery [https://jquery.com/]
// - Papa Parse [https://www.papaparse.com/]
// - time machine [https://github.com/CMU-CREATE-Lab/timemachine-viewer]
// - the wizard template [wizard.css]

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
    settings = (typeof settings === "undefined") ? {} : settings;
    var util = timelapse.getUtil();
    var container_id = settings["container_id"];
    var on_show_callback = settings["on_show_callback"];
    var on_hide_callback = settings["on_hide_callback"];
    var $this;
    var $intro;
    var $theme_metadata, $theme_title, $theme_description;
    var $story_metadata, $story_title, $story_description, $story_authors, $story_view;
    var $waypoints, waypoints_accordion;
    var $current_thumbnail_preview;
    var set_view_tool;
    var $load, $sheet_url;
    var $edit_theme, edit_theme_accordion;

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
      createEditThemeUI();
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
          $current_thumbnail_preview = null;
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
        $current_thumbnail_preview = $story_metadata.find(".story-editor-thumbnail-preview");
        set_view_tool.show();
        $this.hide();
      });
      $story_metadata.find(".story-editor-thumbnail-preview").hide();
      $story_title = $story_metadata.find(".story-editor-story-title-textbox");
      $story_description = $story_metadata.find(".story-editor-story-description-textbox");
      $story_authors = $story_metadata.find(".story-editor-story-authors-textbox");
      $story_view = $story_metadata.find(".story-editor-thumbnail-preview-landscape");
    }

    function setThumbnailPreview(urls) {
      $current_thumbnail_preview.show();
      var $l = $current_thumbnail_preview.find(".story-editor-thumbnail-preview-landscape");
      var $p = $current_thumbnail_preview.find(".story-editor-thumbnail-preview-portrait");
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
        download(dataToTsv(collectData()));
      });
      waypoints_accordion = createAccordion({
        accordion: "#" + container_id + " .story-editor-waypoints .custom-accordion",
        delete_confirm_dialog: "#" + container_id + " .story-editor-waypoints .custom-dialog"
      });
    }

    // For loading a Google spreadsheet
    function createLoadUI() {
      $load = $this.find(".story-editor-load");
      $load.find(".back-button").on("click", function () {
        transition($load, $intro);
      });
      $load.find(".next-button").on("click", function () {
        // This util function name is misleading, it converts spreadsheet into csv, not json
        util.gdocToJSON($sheet_url.val(), function (tsv) {
          var data = tsvToData(tsv);
          console.log(data);
          transition($load, $edit_theme);
        });
      });
      $sheet_url = $load.find(".sheet-url-textbox");
    }

    // For edit themes loaded from a spreadsheet
    function createEditThemeUI() {
      $edit_theme = $this.find(".story-editor-edit-theme");
      $edit_theme.find(".back-button").on("click", function () {
        transition($edit_theme, $load);
      });
      $edit_theme.find(".next-button").on("click", function () {
        //transition($edit_theme, );
      });
      edit_theme_accordion = createAccordion({
        accordion: "#" + container_id + " .story-editor-edit-theme .custom-accordion",
        delete_confirm_dialog: "#" + container_id + " .story-editor-edit-theme .custom-dialog"
      });
    }

    // Create a generalizable jQuery accordion for different editing purposes
    // Also a dialog for deleting tabs in the accordion
    function createAccordion(selector) {
      var $delete_confirm_dialog;
      var accordion = new CustomAccordion(selector["accordion"], {
        on_tab_add_callback: function ($old_tab) {
          // Enable the delete button of the old tab if it was the only one tab in the accordion
          var $tabs = accordion.getTabs();
          if ($tabs.length == 2) $old_tab.find(".story-editor-delete-button").prop("disabled", false);
        },
        on_tab_delete_callback: function () {
          // Disable the delete button of the active tab if there is only one tab left
          var $tabs = accordion.getTabs();
          if ($tabs.length == 1) $tabs.find(".story-editor-delete-button").prop("disabled", true);
        },
        before_tab_clone_callback: function ($tab_template) {
          $tab_template.find(".story-editor-set-view-button").on("click", function () {
            $current_thumbnail_preview = accordion.getActiveTab().find(".story-editor-thumbnail-preview");
            set_view_tool.show();
            $this.hide();
          });
          $tab_template.find(".story-editor-add-button").on("click", function () {
            accordion.addEmptyTab();
          });
          $tab_template.find(".story-editor-delete-button").on("click", function () {
            $delete_confirm_dialog.dialog("open");
          });
          $tab_template.find(".story-editor-title-textbox").on("input", function () {
            accordion.setActiveTabHeaderText($(this).val());
          });
          $tab_template.find(".story-editor-thumbnail-preview").hide();
        }
      });
      accordion.getUI().find(".story-editor-delete-button").prop("disabled", true);

      // The confirm dialog when deleting a tab
      $delete_confirm_dialog = $(selector["delete_confirm_dialog"]).dialog({
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
              accordion.deleteActiveTab();
            }
          },
          "Cancel": {
            class: "ui-cancel-button",
            text: "Cancel",
            click: function () {
              $(this).dialog("close");
            }
          }
        }
      });
      return accordion;
    }

    // Collect story data from the user interface (this is for starting a story from scratch)
    function collectData() {
      var waypoints = [];
      waypoints_accordion.getTabs().each(function () {
        var $ui = $(this);
        waypoints.push({
          waypoint_title: $ui.find(".story-editor-title-textbox").val(),
          waypoint_long_title: $ui.find(".story-editor-long-title-textbox").val(),
          waypoint_description: $ui.find(".story-editor-description-textbox").val(),
          waypoint_view: $ui.find(".story-editor-thumbnail-preview-landscape").data("view")
        });
      });
      var data = [{
        theme_title: $theme_title.val(),
        theme_description: $theme_description.val(),
        stories: [{
          story_title: $story_title.val(),
          story_description: $story_description.val(),
          story_view: $story_view.data("view"),
          story_authors: $story_authors.val(),
          waypoints: waypoints
        }]
      }];
      return data;
    }

    // Download tsv as spreadsheet
    function download(tsv) {
      var a = document.createElement("a");
      a.href = "data:attachment/text," + encodeURI(tsv);
      a.target = "_blank";
      a.download = "story.tsv";
      a.click();
    }

    // Format the story data from the UI into a tsv spreadsheet
    function dataToTsv(data) {
      var tsv = "Waypoint Title\tAnnotation Title\tAnnotation Text\tShare View\tAuthor\n";
      for (var i = 0; i < data.length; i++) {
        var t = data[i]; // theme
        tsv += "#" + t.theme_title + "\t" + t.theme_title + "\t" + t.theme_description + "\t\t\n";
        for (var j = 0; j < t["stories"].length; j++) {
          var s = t["stories"][j]; // story
          tsv += "##" + s.story_title + "\t" + s.story_title + "\t" + s.story_description + "\t" + s.story_view + "\t" + s.story_authors + "\n";
          for (var k = 0; k < s["waypoints"].length; k++) {
            var w = s["waypoints"][k]; // waypoints
            tsv += w.waypoint_title + "\t" + w.waypoint_long_title + "\t" + w.waypoint_description + "\t" + w.waypoint_view + "\t\n";
          }
        }
      }
      return tsv;
    }

    // Recover the story data from a tsv spreadsheet
    function tsvToData(tsv) {
      var parsed = Papa.parse(tsv, {delimiter: '\t', header: true});
      var data = [];
      var current_theme;
      var current_story;
      var current_waypoint;
      parsed["data"].forEach(function (row) {
        var title = row["Waypoint Title"];
        var long_title = row["Annotation Title"];
        var description = row["Annotation Text"];
        var view = row["Share View"];
        var authors = row["Author"];
        if (title.charAt(0) == "#" && title.charAt(1) != "#") {
          // This row indicates a theme
          current_theme = {
            theme_title: title.replace("#", ""),
            theme_description: description,
            stories: []
          };
          data.push(current_theme);
        } else if (title.substring(0, 2) == "##") {
          // This row indicates a story
          current_story = {
            story_title: title.replace("##", ""),
            story_description: description,
            story_view: view,
            story_authors: authors,
            waypoints: []
          };
          current_theme["stories"].push(current_story);
        } else {
          // This row indicates a waypoint
          current_waypoint = {
            waypoint_title: title,
            waypoint_long_title: long_title,
            waypoint_description: description,
            waypoint_view: view
          };
          current_story["waypoints"].push(current_waypoint);
        }
      });
      return data;
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
  // Create the class
  //
  var CustomAccordion = function (selector, settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    settings = (typeof settings === "undefined") ? {} : settings;
    var $ui = $(selector);
    var before_tab_clone_callback = settings["before_tab_clone_callback"];
    var on_tab_add_callback = settings["on_tab_add_callback"];
    var on_tab_delete_callback = settings["on_tab_delete_callback"];
    var $tab_template;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $ui.accordion({
        header: "> div > h3",
        heightStyle: "content",
        animate: false,
        collapsible: true,
        activate: function (event, ui) {
          if (ui.newHeader.length == 0 && ui.newPanel.length == 0) {
            // This means that the tab is collapsed
            $(ui.oldHeader[0]).addClass("custom-accordion-header-active");
          }
          if (ui.oldHeader.length == 0 && ui.oldPanel.length == 0) {
            // This means that a tab is activated from the collapsed state
            $(this).find(".custom-accordion-header-active").removeClass("custom-accordion-header-active");
          }
        }
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

      // Clone the tab template
      $tab_template = $ui.find(".custom-accordion-tab");
      if (typeof before_tab_clone_callback === "function") {
        before_tab_clone_callback($tab_template);
      }
      $tab_template = $tab_template.clone(true, true);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var addEmptyTab = function () {
      // Add a new tab after the current active tab (if it exists)
      var active_index = $ui.accordion("option", "active");
      var $old_tab = $(getTabs()[active_index]);
      var $new_tab = $tab_template.clone(true, true);
      $old_tab.after($new_tab);
      $ui.accordion("refresh");

      // Expand the newly added tab
      $ui.accordion("option", "active", active_index + 1);

      // Call back
      if (typeof on_tab_add_callback === "function") {
        on_tab_add_callback($old_tab);
      }
    };
    this.addEmptyTab = addEmptyTab;

    var deleteActiveTab = function () {
      // Delete active tab
      getActiveTab().remove();

      // Collapse all tabs
      $ui.accordion("option", "active", false);
      $ui.accordion("refresh");

      // Call back
      if (typeof on_tab_delete_callback === "function") {
        on_tab_delete_callback();
      }
    };
    this.deleteActiveTab = deleteActiveTab;

    var getActiveTab = function () {
      var active_index = $ui.accordion("option", "active");
      return $(getTabs()[active_index]);
    };
    this.getActiveTab = getActiveTab;

    var setActiveTabHeaderText = function (txt) {
      getActiveTab().find(".custom-accordion-tab-header-text").text(txt);
    };
    this.setActiveTabHeaderText = setActiveTabHeaderText;

    var getNumOfTabs = function () {
      return getTabs().length;
    };
    this.getNumOfTabs = getNumOfTabs;

    var getUI = function () {
      return $ui;
    };
    this.getUI = getUI;

    var getTabs = function() {
      return $ui.find(".custom-accordion-tab");
    };
    this.getTabs = getTabs;

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
