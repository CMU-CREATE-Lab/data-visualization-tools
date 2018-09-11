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
// TODO: re-think about the design of the "add" and "delete" button
// TODO: bug, when loading a sheet with two themes to the viewer, the author of the first story does not show on the screen

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
    settings = safeGet(settings, {});
    var util = timelapse.getUtil();
    var container_id = settings["container_id"];
    var on_show_callback = settings["on_show_callback"];
    var on_hide_callback = settings["on_hide_callback"];
    var $this;
    var $intro;
    var $save;
    var $current_thumbnail_preview;
    var set_view_tool;
    var enable_testing = true;
    var mode;
    var spreadsheet_id;

    // For creating new stories
    var $theme;
    var $story;
    var $waypoint, waypoint_accordion;

    // For editing stories
    var $load;
    var $edit_theme, edit_theme_accordion;
    var $edit_story, edit_story_accordion, $edit_story_select_theme;
    var $edit_waypoint, edit_waypoint_accordion;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $.ajax({
        dataType: "html",
        url: "StoryEditor.html",
        success: function (html_template) {
          createUI(html_template);
          show();
          timelapse.pause();
        },
        error: function () {
          console.log("Error loading the story editor html template.");
        }
      });
    }

    function createUI(html_template) {
      $("#" + container_id).append($(html_template));
      $this = $("#" + container_id + " .story-editor");

      createSetViewTool();
      createIntroductionUI();
      createNewThemeUI();
      createNewStoryUI();
      createNewWaypointUI();
      createLoadUI();
      createEditThemeUI();
      creatEditStoryUI();
      createEditWaypointUI();
      createSaveUI();
      initGoogleDriveAPI();
    }

    // For setting a view from the timelapse viewer
    function createSetViewTool() {
      set_view_tool = new SetViewTool(timelapse, {
        container_id: container_id,
        on_view_set_callback: function (urls) {
          setThumbnailPreviewUI($current_thumbnail_preview, urls);
          $this.show();
          set_view_tool.hide();
        },
        on_cancel_callback: function () {
          $this.show();
          set_view_tool.hide();
        },
        on_hide_callback: function () {
          $current_thumbnail_preview = null;
        },
        on_show_callback: function () {
          var $l = $current_thumbnail_preview.find(".story-editor-thumbnail-preview-landscape");
          var $p = $current_thumbnail_preview.find(".story-editor-thumbnail-preview-portrait");
          set_view_tool.setUI($l.data("view"), $p.data("view"));
        }
      });
    }

    // The introduction page
    function createIntroductionUI() {
      $intro = $this.find(".story-editor-intro");
      $intro.find(".story-editor-create-button").on("click", function () {
        mode = "create";
        transition($intro, $theme);
        if (enable_testing) testCreateStory(); // for testing the function of creating a story
      });
      $intro.find(".story-editor-edit-button").on("click", function () {
        mode = "edit";
        transition($intro, $load);
      });
    }

    // For creating a new theme
    function createNewThemeUI() {
      $theme = $this.find(".story-editor-theme");
      $theme.find(".back-button").on("click", function () {
        transition($theme, $intro);
      });
      $theme.find(".next-button").on("click", function () {
        transition($theme, $story);
      });
    }

    // For creating a new story
    function createNewStoryUI() {
      $story = $this.find(".story-editor-story");
      $story.find(".back-button").on("click", function () {
        transition($story, $theme);
      });
      $story.find(".next-button").on("click", function () {
        transition($story, $waypoint);
      });
      $story.find(".story-editor-set-cover-view-button").on("click", function () {
        $current_thumbnail_preview = $story.find(".story-editor-thumbnail-preview");
        set_view_tool.show();
        $this.hide();
      });
    }

    // For creating new waypoint
    function createNewWaypointUI() {
      $waypoint = $this.find(".story-editor-waypoint");
      $waypoint.find(".back-button").on("click", function () {
        transition($waypoint, $story);
      });
      $waypoint.find(".next-button").on("click", function () {
        transition($waypoint, $save);
      });
      waypoint_accordion = createAccordion({
        accordion: "#" + container_id + " .story-editor-waypoint .custom-accordion",
        delete_confirm_dialog: "#" + container_id + " .story-editor-waypoint .delete-confirm-dialog"
      });
    }

    // For loading a Google spreadsheet
    function createLoadUI() {
      $load = $this.find(".story-editor-load");
      $load.find(".next-button").prop("disabled", true);
      $load.find(".sheet-url-textbox").on("change", function () {
        if ($(this).val().search(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) >= 0) {
          $load.find(".next-button").prop("disabled", false);
        } else {
          $load.find(".next-button").prop("disabled", true);
        }
      });
      $load.find(".google-authenticate-button").on("click", function () {
        handleAuthClick();
      });
      // TODO: Should we save state and have a refresh button if they click back in the same session?
      // It will save us Drive API quota calls if we do this.
      $load.find("#load-from-drive-list").on("click", function () {
        $load.find(".load-story-from-direct-link-content").hide();
        $load.find(".load-story-from-drive-list-content").show();
        $load.find(".sheet-url-textbox").val("").trigger('change');
        $load.find(".available-stories-on-drive").on("click", "input", function () {
          $load.find(".sheet-url-textbox").val($(this).data("google-sheets-url")).trigger("change");
        });
        if (isAuthenticatedWithGoogle()) {
          $load.find(".google-authenticate-load-prompt").hide();
          $load.find(".loading-stories-list").show();
          listSpreadsheets().then(function (files) {
            $load.find(".loading-stories-list").hide();
            $load.find(".available-stories-on-drive-container").show();
            // TODO: make this a dropdown menu, instead of radio buttons
            if (files && files.length > 0) {
              var html = "";
              for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var storyDomId = "story_" + i;
                html += "<div class='custom-radio custom-radio-right'>";
                html += "<input type='radio' name='story-list-choices' id='" + storyDomId + "' data-google-sheets-url='https://docs.google.com/spreadsheets/d/" + file.id + "'>";
                html += "<label for='" + storyDomId + "' class='noselect'>" + file.name + "</label>";
                html += "</div>";
              }
              $load.find(".available-stories-on-drive").empty().show().html(html);
            } else {
              $load.find(".available-stories-on-drive").show().html("<p>You haven't created any stories yet with the Story Editor.</p>");
            }
          });
        } else {
          $load.find(".google-authenticate-load-prompt").show();
        }
      });
      $load.find("#load-from-direct-link").on("click", function () {
        $load.find(".load-story-from-drive-list-content, .available-stories-on-drive").hide();
        $load.find(".load-story-from-direct-link-content").show();
        if (enable_testing) {
          $load.find(".sheet-url-textbox").val("https://docs.google.com/spreadsheets/d/1dn6nDMFevqPBdibzGvo9qC7CxwxdfZkDyd_ys6r-ODE/edit#gid=145707723").trigger("change");
        } else {
          $load.find(".sheet-url-textbox").val("").trigger("change");
        }
      });
      $load.find(".back-button").on("click", function () {
        transition($load, $intro);
      });
      $load.find(".next-button").on("click", function () {
        $load.find(".next-button").prop("disabled", true);
        // This util function name is misleading, it converts spreadsheet into csv, not json
        // TODO: tell people the error messages when the sheet does not work (e.g. wrong permission, wrong file, wrong format)
        util.gdocToJSON($load.find(".sheet-url-textbox").val(), function (tsv) {
          setAccordionUI(edit_theme_accordion, tsvToData(tsv));
          transition($load, $edit_theme);
          $load.find(".next-button").prop("disabled", false);
          if (enable_testing) testEditStory(); // for testing editing stories
        });
      });
    }

    // For editing themes loaded from a spreadsheet
    function createEditThemeUI() {
      var $back_confirm_dialog, $next_confirm_dialog;
      $edit_theme = $this.find(".story-editor-edit-theme");
      $edit_theme.find(".back-button").on("click", function () {
        // We do not have to update data backward here, since all unsaved data will be lost
        $back_confirm_dialog.dialog("open"); // check if the user truely wants to load another sheet
      });
      $edit_theme.find(".next-button").on("click", function () {
        // Check if the user selects a tab
        if (edit_theme_accordion.getActiveTab().length > 0) {
          forward(edit_theme_accordion, edit_story_accordion);
          transition($edit_theme, $edit_story);
          //setThemeDropdown(); // this is a special case besides forward
        } else {
          $next_confirm_dialog.dialog("open");
        }
      });
      edit_theme_accordion = createAccordion({
        accordion: "#" + container_id + " .story-editor-edit-theme .custom-accordion",
        delete_confirm_dialog: "#" + container_id + " .story-editor-edit-theme .delete-confirm-dialog"
      });
      $back_confirm_dialog = createConfirmDialog({
        selector: "#" + container_id + " .story-editor-edit-theme .back-confirm-dialog",
        action_callback: function () {
          transition($edit_theme, $load);
        }
      });
      $next_confirm_dialog = createConfirmDialog({
        selector: "#" + container_id + " .story-editor-edit-theme .next-confirm-dialog"
      });
    }

    // Set the theme dropdown for all story tabs
    function setThemeDropdown() {
      edit_story_accordion.getTabs().each(function () {
        setCustomDropdown({
          selector: "#" + container_id + " .story-editor-theme-dropdown",
          menu_items: getValues(edit_theme_accordion.getTabs().find(".story-editor-title-textbox")),
          current_index: edit_theme_accordion.getActiveIndex(),
          on_menu_item_click_callback: function (desired_theme) {
            //console.log(desired_theme);
            // TODO: move the story to the desired theme
          }
        });
      });
    }

    // For editing a story in a selected theme
    function creatEditStoryUI() {
      var $next_confirm_dialog;
      $edit_story = $this.find(".story-editor-edit-story");
      $edit_story.find(".back-button").on("click", function () {
        backward(edit_story_accordion, edit_theme_accordion); // backward propagate data
        transition($edit_story, $edit_theme);
      });
      $edit_story.find(".next-button").on("click", function () {
        // Check if the user selects a tab
        if (edit_story_accordion.getActiveTab().length > 0) {
          forward(edit_story_accordion, edit_waypoint_accordion);
          transition($edit_story, $edit_waypoint);
        } else {
          $next_confirm_dialog.dialog("open");
        }
      });
      $edit_story_select_theme = $edit_story.find(".story-editor-selected-theme");
      edit_story_accordion = createAccordion({
        accordion: "#" + container_id + " .story-editor-edit-story .custom-accordion",
        delete_confirm_dialog: "#" + container_id + " .story-editor-edit-story .delete-confirm-dialog"
      });
      $next_confirm_dialog = createConfirmDialog({
        selector: "#" + container_id + " .story-editor-edit-story .next-confirm-dialog"
      });
    }

    // For editing waypoint in a story
    function createEditWaypointUI() {
      $edit_waypoint = $this.find(".story-editor-edit-waypoint");
      $edit_waypoint.find(".back-button").on("click", function () {
        backward(edit_waypoint_accordion, edit_story_accordion); // backward propagate data
        transition($edit_waypoint, $edit_story);
      });
      $edit_waypoint.find(".next-button").on("click", function () {
        transition($edit_waypoint, $save);
      });
      edit_waypoint_accordion = createAccordion({
        accordion: "#" + container_id + " .story-editor-edit-waypoint .custom-accordion",
        delete_confirm_dialog: "#" + container_id + " .story-editor-edit-waypoint .delete-confirm-dialog"
      });
    }

    // For saving stories
    function createSaveUI() {
      $save = $this.find(".story-editor-save");
      var $next_confirm_dialog;
      var $save_to_google = $save.find(".story-editor-save-to-google");
      var $save_to_google_button = $save.find(".story-editor-save-to-google-button");
      var $save_to_google_message = $save.find(".story-editor-save-to-google-message");
      var $save_to_local = $save.find(".story-editor-save-to-local");
      var $save_to_local_button = $save.find(".story-editor-save-to-local-button");
      var $save_to_local_message = $save.find(".story-editor-save-to-local-message");
      var $save_file_name = $save.find(".story-editor-save-file-name");
      var $save_file_name_textbox = $save.find(".story-editor-save-file-name-textbox");
      $save.find(".back-button").on("click", function () {
        transition($save, mode == "create" ? $waypoint : $edit_waypoint);
        $save_to_local_button.prop("disabled", false);
        $save_to_local_message.empty();
        $save_to_google_button.prop("disabled", false);
        $save_to_google_message.empty();
      });
      $save.find(".next-button").on("click", function () {
        $next_confirm_dialog.dialog("open"); // check if the user truely wants to finish
      });
      $save_to_local_button.on("click", function () {
        downloadDataAsTsv(collectStoryData(), $save_file_name_textbox.val());
        $save_to_local_button.prop("disabled", true);
        $save_to_local_message.empty().append($("<p>The story is saved successfully on your local machine.</p>"));
      });
      $save_to_google_button.on("click", function () {
        $save_to_google_button.prop("disabled", true);
        $save_to_google_message.empty().append($("<p>Currently saving story...</p>"));
        saveDataAsTsv(collectStoryData(), $save_file_name_textbox.val(), {
          success: function (response) {
            var spreadsheet_url = "https://docs.google.com/spreadsheets/d/" + response["spreadsheetId"];
            $save_to_google_message.empty().append($("<p>The story is saved successfully as a <a target='_blank' href='" + spreadsheet_url + "'>publicly viewable link</a>.</p>"));
          },
          error: function (response) {
            $save_to_google_message.empty().append($("<p>Error saving the story with response: " + response["error"] + "</p>"));
            $save_to_google_button.prop("disabled", false);
          }
        });
      });
      $save.find("input:radio[name='story-editor-save-options']").on("change", function () {
        $save_file_name.show();
        if ($(this).val() == "google") {
          $save_to_local.hide();
          $save_to_google.show();
        } else {
          $save_to_google.hide();
          $save_to_local.show();
        }
      });
      $next_confirm_dialog = createConfirmDialog({
        selector: "#" + container_id + " .story-editor-save .next-confirm-dialog",
        action_callback: function () {
          if (mode == "create") {
            resetTabUI($theme);
            resetTabUI($story);
            waypoint_accordion.reset();
          }
          mode = undefined;
          $save_to_local_button.prop("disabled", false);
          $save_to_local_message.empty();
          $save_to_google_button.prop("disabled", false);
          $save_to_google_message.empty();
          transition($save, $intro);
        }
      });
    }

    // For initializing the Google Drive API
    function initGoogleDriveAPI() {
      addGoogleSignedInStateChangeListener(function (isSignedIn) {
        if (isSignedIn) {
          if ($("#load-from-drive-list").is(":visible")) {
            $("#load-from-drive-list").trigger("click");
          } else if ($(".story-editor-save-to-google-button").is(":visible")) {
            $(".story-editor-save-to-google-button").trigger("click");
          }
        } else {
          console.log('not logged in...');
        }
      });
    }

    // Set the user interface of a tab (one row in the tsv file)
    function setTabUI($ui, d) {
      if (typeof $ui === "undefined" || typeof d === "undefined") return;
      if (typeof d["title"] !== "undefined") {
        $ui.find(".story-editor-title-text").text(d["title"]);
        $ui.find(".story-editor-title-textbox").val(d["title"]);
      }
      if (typeof d["long_title"] !== "undefined") {
        $ui.find(".story-editor-long-title-textbox").val(d["long_title"]);
      }
      if (typeof d["description"] !== "undefined") {
        $ui.find(".story-editor-description-textbox").val(d["description"]);
      }
      if (typeof d["author"] !== "undefined") {
        $ui.find(".story-editor-author-textbox").val(d["author"]);
      }
      if (typeof d["view_landscape"] !== "undefined" && d["view_portrait"] !== "undefined") {
        var urls = set_view_tool.extractThumbnailUrls(d["view_landscape"], d["view_portrait"]);
        setThumbnailPreviewUI($ui.find(".story-editor-thumbnail-preview"), urls);
      }
      if (typeof d["data"] !== "undefined") {
        $ui.data("data", d["data"]);
      }
    }

    // Reset the user interface of a tab (one row in the tsv file)
    function resetTabUI($ui) {
      if (typeof $ui === "undefined") return;
      $ui.find(".story-editor-title-text").text("");
      $ui.find(".story-editor-title-textbox").val("");
      $ui.find(".story-editor-long-title-textbox").val("");
      $ui.find(".story-editor-description-textbox").val("");
      $ui.find(".story-editor-author-textbox").val("");
      $ui.removeData("data");
      resetThumbnailPreviewUI($ui.find(".story-editor-thumbnail-preview"));
    }

    // Set the user interface of an accordion (theme, story, waypoint)
    function setAccordionUI(accordion, data) {
      if (typeof accordion === "undefined") return;
      accordion.reset();
      data = safeGet(data, []);
      for (var i = 0; i < data.length; i++) {
        var $t = (i == 0) ? accordion.getActiveTab() : accordion.addEmptyTab();
        setTabUI($t, data[i]);
      }
    }

    // Propagate data forward from an accordion to another accordion
    function forward(from_accordion, to_accordion) {
      if (typeof from_accordion === "undefined") return;
      var $active_tab = from_accordion.getActiveTab();
      if ($active_tab.length > 0) {
        setAccordionUI(to_accordion, $active_tab.data("data"));
        $active_tab.removeData("data"); // remove stored data
      }
    }

    // Collect data from the user interface of a tab (one row in the tsv file)
    function collectTabData($ui) {
      if (typeof $ui === "undefined") return;
      var d = {};
      var $title = $ui.find(".story-editor-title-textbox");
      if ($title.length > 0) {
        d["title"] = safeGet($title.val().trim());
      }
      var $long_title = $ui.find(".story-editor-long-title-textbox");
      if ($long_title.length > 0) {
        d["long_title"] = safeGet($long_title.val().trim());
      }
      var $description = $ui.find(".story-editor-description-textbox");
      if ($description.length > 0) {
        d["description"] = safeGet($description.val().trim());
      }
      var $author = $ui.find(".story-editor-author-textbox");
      if ($author.length > 0) {
        d["author"] = safeGet($author.val().trim());
      }
      var $view_landscape = $ui.find(".story-editor-thumbnail-preview-landscape");
      var $view_portrait = $ui.find(".story-editor-thumbnail-preview-portrait");
      if ($view_landscape.length > 0 && $view_portrait.length > 0) {
        d["view_landscape"] = safeGet($view_landscape.data("view"));
        d["view_portrait"] = safeGet($view_portrait.data("view"));
      }
      var data = $ui.data("data");
      if (typeof data !== "undefined") {
        d["data"] = safeGet(data, []);
      }
      return d;
    }

    // Collect data from the user interface of an accordion (theme, story, waypoint)
    function collectAccordionData(accordion) {
      var data = [];
      accordion.getTabs().each(function () {
        var d = collectTabData($(this));
        if (hasContent(d)) data.push(d);
      });
      return data;
    }

    // Propagate data backward from an accordion to another one
    function backward(from_accordion, to_accordion) {
      var data = collectAccordionData(from_accordion);
      if (typeof to_accordion !== "undefined") {
        to_accordion.getActiveTab().data("data", data);
      }
      return data;
    }

    // Collect data from the user interface
    function collectStoryData() {
      if (mode == "create") {
        // Collect newly created story data from the user interface
        var story = collectTabData($story);
        story["data"] = collectAccordionData(waypoint_accordion);
        var theme = collectTabData($theme);
        theme["data"] = [story];
        return [theme];
      } else {
        // Collect edited story data from the user interface
        // Propagate data backward three times
        backward(edit_waypoint_accordion, edit_story_accordion);
        backward(edit_story_accordion, edit_theme_accordion);
        return backward(edit_theme_accordion);
      }
    }

    // Set thumbnail preview images (also put the video or image url inside href)
    function setThumbnailPreviewUI($ui, urls) {
      if (typeof $ui === "undefined" || typeof urls === "undefined") return;
      $ui.show();
      var $l = $ui.find(".story-editor-thumbnail-preview-landscape");
      var $p = $ui.find(".story-editor-thumbnail-preview-portrait");
      $l.prop("href", urls["landscape"]["render"]["url"]);
      $l.data("view", urls["landscape"]["render"]["args"]["root"]);
      $l.find("img").prop("src", ""); // make the loading gif appear
      $l.find("img").prop("src", urls["landscape"]["preview"]["url"]);
      $p.prop("href", urls["portrait"]["render"]["url"]);
      $p.data("view", urls["portrait"]["render"]["args"]["root"]);
      $p.find("img").prop("src", ""); // make the loading gif appear
      $p.find("img").prop("src", urls["portrait"]["preview"]["url"]);
    }

    // Reset thumbnail preview images (also put the video or image url inside href)
    function resetThumbnailPreviewUI($ui) {
      if (typeof $ui === "undefined") return;
      $ui.find("a").prop("href", "javascript:void(0)");
      $ui.find("img").prop("src", "");
      $ui.removeData("view");
      $ui.hide();
    }

    // Set the custom dropdown
    function setCustomDropdown(settings) {
      resetCustomDropdown(settings);
      var $ui = $(settings["selector"]);
      var menu_items = settings["menu_items"];
      var current_index = safeGet(settings["current_index"], 0);
      var on_menu_item_click_callback = settings["on_menu_item_click_callback"];
      var $menu = $ui.find("div");

      // Set text on the button
      var $button_text = $ui.find("button > span");
      $button_text.text(menu_items[current_index]);

      // Add events for menu items
      menu_items.forEach(function (x) {
        var $item = $("<a href=\"javascript:void(0)\">" + x + "</a>");
        $item.on("click", function () {
          console.log("click");
          var item_text = $(this).text();
          $button_text.text(item_text); // update the text on the button
          //$menu.hide();
          if (typeof on_menu_item_click_callback === "function") {
            on_menu_item_click_callback(item_text);
          }
        });
        $menu.append($item);
      });

      return $ui;
    }

    // Reset the custom dropdown
    function resetCustomDropdown(settings) {
      var $ui = $(settings["selector"]);
      $ui.find("div").empty();
      $ui.find("button > span").text("");
    }

    // Create a confirmation dialog
    function createConfirmDialog(settings) {
      settings = safeGet(settings, {});
      var has_action = (typeof settings["action_callback"] === "function");
      var action_text = safeGet(settings["action_text"], "Confirm");
      var cancel_text = has_action ? "Cancel" : "Ok";
      cancel_text = safeGet(settings["cancel_text"], cancel_text);
      var buttons = {
        "Cancel": {
          class: "ui-cancel-button",
          text: cancel_text,
          click: function () {
            $(this).dialog("close");
          }
        }
      };
      if (has_action) {
        buttons["Action"] = {
          class: "ui-action-button",
          text: action_text,
          click: function () {
            $(this).dialog("close");
            settings["action_callback"]();
          }
        }
      }
      var $dialog = $(settings["selector"]).dialog({
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
        buttons: buttons
      });
      return $dialog;
    }

    // Create a generalizable jQuery accordion for different editing purposes
    // Also a dialog for deleting tabs in the accordion
    function createAccordion(selector) {
      var $delete_confirm_dialog;
      var accordion = new CustomAccordion(selector["accordion"], {
        on_reset_callback: function () {
          accordion.getTabs().find(".story-editor-delete-button").prop("disabled", true);
        },
        on_tab_add_callback: function ($old_tab) {
          if (typeof $old_tab === "undefined") return;
          // Enable the delete button of the old tab if it was the only one tab in the accordion
          if (accordion.getTabs().length == 2) $old_tab.find(".story-editor-delete-button").prop("disabled", false);
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
        }
      });
      accordion.getUI().find(".story-editor-delete-button").prop("disabled", true);

      // The confirm dialog when deleting a tab
      $delete_confirm_dialog = createConfirmDialog({
        selector: selector["delete_confirm_dialog"],
        action_callback: function () {
          accordion.deleteActiveTab();
        }
      });
      return accordion;
    }

    // Format the story data from the UI into a tsv spreadsheet
    function dataToTsv(data) {
      var tsv = "Waypoint Title\tAnnotation Title\tAnnotation Text\tShare View\tAuthor\tMobile Share View Landscape\tMobile Share View Portrait\n";
      data = safeGet(data, []);
      for (var i = 0; i < data.length; i++) {
        var theme = data[i];
        tsv += "#" + theme.title + "\t" + theme.title + "\t" + theme.description + "\n";
        for (var j = 0; j < theme["data"].length; j++) {
          var story = theme["data"][j];
          tsv += "##" + story.title + "\t" + story.title + "\t" + story.description + "\t" + story.view_landscape + "\t" + story.author + "\t" + story.view_landscape + "\t" + story.view_portrait + "\n";
          for (var k = 0; k < story["data"].length; k++) {
            var waypoint = story["data"][k];
            tsv += waypoint.title + "\t" + waypoint.long_title + "\t" + waypoint.description + "\t" + waypoint.view_landscape + "\t\t" + waypoint.view_landscape + "\t" + waypoint.view_portrait + "\n";
          }
        }
      }
      return tsv;
    }

    // Convert from a tsv spreadsheet to a 2d array of data that will be written to a Google Sheet
    function tsvToSheetsDataArray(data) {
      var sheetsDataArray = [];
      data = safeGet(data, []);
      var tsvRows = data.split("\n");
      for (var i = 0; i < tsvRows.length; i++) {
        sheetsDataArray.push(tsvRows[i].split("\t"));
      }
      return sheetsDataArray;
    }

    // TODO: detect if "Mobile Share View Landscape" and "Mobile Share View Portrait" exists (if not, show error msg to users)
    // Recover the story data from a tsv spreadsheet
    function tsvToData(tsv) {
      var parsed = Papa.parse(tsv, {delimiter: '\t', header: true});
      var data = [];
      var theme, story, waypoint;
      parsed["data"].forEach(function (row) {
        var title = row["Waypoint Title"];
        var long_title = row["Annotation Title"];
        var description = row["Annotation Text"];
        var view_landscape = row["Mobile Share View Landscape"];
        var view_portrait = row["Mobile Share View Portrait"];
        var author = row["Author"];
        if (title.charAt(0) == "#" && title.charAt(1) != "#") {
          theme = {
            title: title.replace("#", ""),
            description: description,
            data: [] // for storing stories
          };
          data.push(theme);
        } else if (title.substring(0, 2) == "##") {
          story = {
            title: title.replace("##", ""),
            description: description,
            author: author,
            view_landscape: view_landscape,
            view_portrait: view_portrait,
            data: [] // for storing waypoint
          };
          theme["data"].push(story);
        } else {
          waypoint = {
            title: title,
            long_title: long_title,
            description: description,
            view_landscape: view_landscape,
            view_portrait: view_portrait
          };
          story["data"].push(waypoint);
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

    // Safely get the value from a variable, return a default value if undefined
    function safeGet(v, default_val) {
      if (typeof default_val === "undefined") default_val = "";
      return (typeof v === "undefined") ? default_val : v;
    }

    // Check if there are things inside every key of a dictionary
    function hasContent(dict) {
      for (var key in dict) {
        if (!$.isEmptyObject(dict[key])) return true;
      }
      return false;
    }

    // Get all values of the found dom elements and return an array
    function getValues($elements) {
      return $elements.map(function () {
        return $(this).val();
      }).get();
    }

    // Download the tsv (download.js library is used)
    function downloadDataAsTsv(data, file_name) {
      var tsv = dataToTsv(data);
      if (typeof file_name === "undefined" || file_name == "") {
        file_name = "story";
      }
      download(tsv, file_name + ".tsv", "text/plain");
    }

    // Save the tsv to a Google Sheet
    function saveDataAsTsv(data, file_name, callback) {
      callback = safeGet(callback, {});
      var tsv = dataToTsv(data);
      if (isAuthenticatedWithGoogle()) {
        // TODO: Deal with success/failure responses
        // TODO: How do we name these spreadsheets so that the listing is useful to the user
        // TODO: If users load a sheet that is not created by the editor, remind users that we cannot replace the file
        // Do we make use of the hidden developer fields in the spreadsheet?
        var want_to_replace = $this.find(".story-editor-save-to-google-replace").prop("checked");
        var data_array = tsvToSheetsDataArray(tsv);
        var promise;
        if (want_to_replace && typeof spreadsheet_id !== "undefined") {
          promise = updateSpreadsheet(spreadsheet_id, data_array);
        } else {
          promise = createNewSpreadsheetWithContent(file_name, data_array);
        }
        promise.then(function (response) {
          if (typeof callback["success"] === "function") callback["success"](response);
          spreadsheet_id = response["spreadsheetId"];
          console.log(response);
        }).catch(function (errorResponse) {
          // TODO: unable to catch the error of "popup_closed_by_user"
          if (typeof callback["error"] === "function") callback["error"](errorResponse);
          console.log(errorResponse);
        });
      } else {
        handleAuthClick();
      }
    }

    // For testing the function of creating a story
    function testCreateStory() {
      setTabUI($theme, {
        title: "City",
        description: "A city is a large human settlement. Cities generally have extensive systems for housing, transportation, sanitation, utilities, land use, and communication."
      });
      $this.find(".story-editor-theme .next-button").click();
      setTabUI($story, {
        title: "Las Vegas",
        description: "Las Vegas, officially the City of Las Vegas and often known simply as Vegas, is the 28th-most populated city in the United States, the most populated city in the state of Nevada, and the county seat of Clark County.",
        author: "Harry Potter and Ginny Weasley",
        view_landscape: "https://headless.earthtime.org/#v=376423,740061,380719,742478,pts&t=0&ps=0&l=blsat&bt=20010101&et=20010101&startDwell=0&endDwell=0&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=376537,738962,379195,743683,pts&t=0&ps=0&l=blsat&bt=20010101&et=20010101&startDwell=0&endDwell=0&fps=30"
      });
      $this.find(".story-editor-story .next-button").click();
      setAccordionUI(waypoint_accordion, [{
        title: "1984",
        long_title: "Las Vegas 1984",
        description: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis",
        view_landscape: "https://headless.earthtime.org/#v=375528,739600,381100,742737,pts&t=0&ps=0&l=blsat&bt=19840101&et=19840101&startDwell=0&endDwell=0&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=376379,738333,379516,743905,pts&t=0&ps=0&l=blsat&bt=19840101&et=19840101&startDwell=0&endDwell=0&fps=30"
      }, {
        title: "2016",
        long_title: "Las Vegas 2016",
        description: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt",
        view_landscape: "https://headless.earthtime.org/#v=375162,739550,380734,742687,pts&t=0&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=376379,738333,379516,743905,pts&t=0&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30"
      }, {
        title: "1984-2016",
        long_title: "Las Vegas 1984-2016 (Medium Speed)",
        description: "Li Europan lingues es membres del sam familie. Lor separat existentie es un myth. Por scientie, musica, sport etc, litot Europa usa li sam vocabular. Li lingues differe solmen in",
        view_landscape: "https://headless.earthtime.org/#v=374578,739513,381264,743277,pts&t=0&ps=50&l=blsat&bt=19840101&et=20161231&startDwell=0&endDwell=1&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=375825,738017,379589,744702,pts&t=0&ps=50&l=blsat&bt=19840101&et=20161231&startDwell=0&endDwell=1&fps=30"
      }, {
        title: "1991-2009",
        long_title: "Las Vegas 1991-2009 (Fast Speed)",
        description: "abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !\"§ $%& /() =?* '<> #|; ²³~ @`´ ©«» ¤¼× {}abc def ghi",
        view_landscape: "https://headless.earthtime.org/#v=375567,739964,379848,742375,pts&t=0&ps=100&l=blsat&bt=19910101&et=20091231&startDwell=1&endDwell=2&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=376502,739029,378913,743310,pts&t=0&ps=100&l=blsat&bt=19910101&et=20091231&startDwell=1&endDwell=2&fps=30"
      }]);
      $this.find(".story-editor-waypoint .next-button").click();
      $this.find(".story-editor-save .back-button").click();
      $this.find(".story-editor-waypoint .back-button").click();
      $this.find(".story-editor-story .back-button").click();
    }

    // For testing the function of editing stories
    function testEditStory() {
      edit_theme_accordion.addEmptyTab();
      setTabUI(edit_theme_accordion.getActiveTab(), {
        title: "Deforestation",
        description: "Deforestation, clearance, or clearing is the removal of a forest or stand of trees where the land is thereafter converted to a non-forest use. Examples of deforestation include conversion of forestland to farms, ranches, or urban use."
      });
      $this.find(".story-editor-edit-theme .next-button").click();
      setAccordionUI(edit_story_accordion, [{
        title: "Rondonia",
        description: "Rondonia is a state in Brazil, located in the north part of the country. To the west is a short border with the state of Acre, to the north is the state of Amazonas, in the east is Mato Grosso, and in the south and southwest is Bolivia.",
        author: "Hermione Granger and Ron Weasley",
        view_landscape: "https://headless.earthtime.org/#v=678007,1027451,699007,1039263,pts&t=0&ps=0&l=blsat&bt=19860101&et=19860101&startDwell=0&endDwell=0&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=682601,1022857,694413,1043857,pts&t=0&ps=0&l=blsat&bt=19860101&et=19860101&startDwell=0&endDwell=0&fps=30"
      }]);
      $this.find(".story-editor-edit-story .next-button").click();
      setAccordionUI(edit_waypoint_accordion, [{
        title: "1984",
        long_title: "Rondonia 1984",
        view_landscape: "https://headless.earthtime.org/#v=678007,1027451,699007,1039263,pts&t=0&ps=0&l=blsat&bt=19840101&et=19840101&startDwell=0&endDwell=0&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=682601,1022857,694413,1043857,pts&t=0&ps=0&l=blsat&bt=19840101&et=19840101&startDwell=0&endDwell=0&fps=30"
      }, {
        title: "2016",
        long_title: "Rondonia 2016",
        view_landscape: "https://headless.earthtime.org/#v=676359,1027340,700549,1040942,pts&t=0&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=681653,1022046,695255,1046236,pts&t=0&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30"
      }, {
        title: "1984-2016",
        long_title: "Rondonia 1984-2016 (Medium Speed)",
        view_landscape: "https://headless.earthtime.org/#v=676359,1027340,700549,1040942,pts&t=0&ps=50&l=blsat&bt=19840101&et=20161231&startDwell=0&endDwell=1&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=681653,1022046,695255,1046236,pts&t=0&ps=50&l=blsat&bt=19840101&et=20161231&startDwell=0&endDwell=1&fps=30"
      }, {
        title: "1993-2007",
        long_title: "Rondonia 1993-2007 (Slow Speed)",
        view_landscape: "https://headless.earthtime.org/#v=676359,1027340,700549,1040942,pts&t=0&ps=25&l=blsat&bt=19930101&et=20071231&startDwell=1&endDwell=2&fps=30",
        view_portrait: "https://headless.earthtime.org/#v=681653,1022046,695255,1046236,pts&t=0&ps=25&l=blsat&bt=19930101&et=20071231&startDwell=1&endDwell=2&fps=30"
      }]);
      $this.find(".story-editor-edit-waypoint .next-button").click();
      $this.find(".story-editor-save .back-button").click();
      $this.find(".story-editor-edit-waypoint .back-button").click();
      $this.find(".story-editor-edit-story .back-button").click();
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
    settings = safeGet(settings, {});
    var $ui = $(selector);
    var before_tab_clone_callback = settings["before_tab_clone_callback"];
    var on_tab_add_callback = settings["on_tab_add_callback"];
    var on_tab_delete_callback = settings["on_tab_delete_callback"];
    var on_reset_callback = settings["on_reset_callback"];
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
          // TODO: allow users to go next in the editor without opening a tab
          /*if (ui.newHeader.length == 0 && ui.newPanel.length == 0) {
            // This means that the tab is collapsed
            $(ui.oldHeader[0]).addClass("custom-accordion-header-active");
          }
          if (ui.oldHeader.length == 0 && ui.oldPanel.length == 0) {
            // This means that a tab is activated from the collapsed state
            $(this).find(".custom-accordion-header-active").removeClass("custom-accordion-header-active");
          }*/
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

    // Safely get the value from a variable, return a default value if undefined
    function safeGet(v, default_val) {
      if (typeof default_val === "undefined") default_val = "";
      return (typeof v === "undefined") ? default_val : v;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var reset = function () {
      // Reset the user interface
      getTabs().remove();
      $ui.append($tab_template.clone(true, true));
      $ui.accordion("refresh");
      $ui.accordion("option", "active", 0); // expand the new tab

      // Call back
      if (typeof on_reset_callback === "function") {
        on_reset_callback();
      }
    };
    this.reset = reset;

    var addEmptyTab = function () {
      var $new_tab = $tab_template.clone(true, true);
      var $old_tab;
      var $tabs = getTabs();

      // Check if there are tabs
      var active_index = -1;
      if ($tabs.length == 0) {
        // No tabs, append one tab
        $ui.append($tab_template.clone(true, true));
      } else {
        // Has tab, check if has active tab
        active_index = getActiveIndex();
        // If no active tab, add the tab to the end
        if (active_index === false) active_index = $tabs.length - 1;
        $old_tab = $($tabs[active_index]);
        $old_tab.after($new_tab);
      }
      $ui.accordion("refresh");
      $ui.accordion("option", "active", active_index + 1); // expand the new tab

      // Call back
      if (typeof on_tab_add_callback === "function") {
        on_tab_add_callback($old_tab);
      }
      return $new_tab;
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
      return $(getTabs()[getActiveIndex()]);
    };
    this.getActiveTab = getActiveTab;

    var getActiveIndex = function () {
      return $ui.accordion("option", "active");
    };
    this.getActiveIndex = getActiveIndex;

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

    var getTabs = function () {
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