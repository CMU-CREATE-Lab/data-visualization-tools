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
// TODO: add a feature for importing the view from other waypoints (or shared view link)
// TODO: add the the function to move a waypoint to another story
// TODO: add buttons for moving tabs up and down in the accordion
// TODO: hide and show stories (publish and unpublish)


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
  var container_id = settings["container_id"];
  var on_show_callback = settings["on_show_callback"];
  var on_hide_callback = settings["on_hide_callback"];
  var $this;
  var $intro, $start, $logout, $login_message;
  var $create_file_name_textbox;
  var $save, $save_to_google_button, $save_file_name_textbox, $save_to_google_message, $save_to_google_replace_checkbox;
  var $current_thumbnail_preview;
  var set_view_tool;
  var enable_testing = false;
  var current_sheet_id;
  var current_sheet_name;
  var want_to_refresh_story_from_drive = true;
  var UTIL;
  var GOOGLE_API;
  var $save_success_dialog, $save_error_dialog;

  // For detail editing
  var $theme;
  var $story;
  var $waypoint;

  // For editing stories
  var $load, $load_from_google_drive_radio;
  var $edit_theme, edit_theme_accordion;
  var $edit_story, edit_story_accordion;
  var $edit_waypoint, edit_waypoint_accordion;

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Private methods
  //
  function init() {
    UTIL = timelapse.getUtil();
    GOOGLE_API = new StoryEditorGoogleAPI({
      on_ready: function (isSignedIn) {
        var $logout_btn = $("#" + container_id + " .story-editor .story-editor-intro .story-editor-logout-button");
        var $start_btn = $("#" + container_id + " .story-editor .story-editor-intro .story-editor-start-button");
        var $login_message_txt = $("#" + container_id + " .story-editor .story-editor-intro .login-message");
        if (isSignedIn && $logout_btn.hasClass("force-hide")) {
          $logout_btn.removeClass("force-hide");
          $login_message_txt.text("");
          $start_btn.text("Begin");
        }
      }
    });
    var absolute_path_to_html = document.querySelector('script[src*="StoryEditor.js"]').src.replace(".js", ".html");
    $.ajax({
      dataType: "html",
      url: absolute_path_to_html,
      success: function (html_template) {
        createUI(html_template);
      },
      error: function () {
        console.log("Error loading the story editor html template.");
      }
    });
  }

  function createUI(html_template) {
    $("#" + container_id).append($(html_template));
    $this = $("#" + container_id + " .story-editor");
    $this.find(".close").on("click", function () {
      hide();
    });
    createSetViewTool();
    createIntroductionUI();
    createGeneralSaveUI();
    createNewThemeUI();
    createNewStoryUI();
    createNewWaypointUI();
    createLoadUI();
    createEditThemeUI();
    createEditStoryUI();
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
    $login_message = $intro.find(".login-message");
    $logout = $intro.find(".story-editor-logout-button");
    $start = $intro.find(".story-editor-start-button");
    $start.on("click", function () {
      if (GOOGLE_API.isAuthenticatedWithGoogle()) {
        $login_message.text("");
        $start.text("Begin");
        transition($intro, $load);
      } else {
        var promise = GOOGLE_API.handleAuthClick();
        promise.then(function (response) {
          // A user id is returned, ignore for now
          $login_message.text("");
          $start.text("Begin");
          transition($intro, $load);
        }).catch(function (response) {
          var msg = "An error is encountered when logging in to the Google Drive.";
          if (response["message"]["error"] == "popup_closed_by_user") {
            msg += " Please log in to proceed."
          } else {
            msg += " Please try again later."
          }
          $login_message.text(msg);
        });
      }
    });
    // IMPORTANT: there is no way to test logout on localhost
    $logout.on("click", function () {
      GOOGLE_API.handleSignoutClick();
    });
  }

  // For creating the UI for all save buttons at the bottom
  function createGeneralSaveUI() {
    $save_success_dialog = createConfirmDialog({
      selector: "#" + container_id + " .save-success-dialog"
    });
    $save_error_dialog = createConfirmDialog({
      selector: "#" + container_id + " .save-error-dialog"
    });
    $(".save-button").on("click", function () {
      var $ui = $(this);
      var $back = $ui.siblings(".back-button");
      var $next = $ui.siblings(".next-button");
      $back.prop("disabled", true);
      $next.prop("disabled", true);
      $ui.prop("disabled", true);
      var $parent = $ui.parent().parent().parent();
      var from;
      if ($parent.hasClass("story-editor-edit-waypoint")) {
        from = "waypoint";
      } else if ($parent.hasClass("story-editor-edit-story")) {
        from = "story";
      } else if ($parent.hasClass("story-editor-edit-theme")) {
        from = "theme";
      }
      saveStoryCollection({
        desired_sheet_id: current_sheet_id,
        desired_sheet_name: current_sheet_name,
        from: from,
        success: function () {
          $back.prop("disabled", false);
          $next.prop("disabled", false);
          $ui.prop("disabled", false);
          $save_success_dialog.dialog("open");
        },
        error: function () {
          $back.prop("disabled", false);
          $next.prop("disabled", false);
          $ui.prop("disabled", false);
          $save_error_dialog.dialog("open");
        }
      });
    });
  }

  // For creating a new theme
  function createNewThemeUI() {
    var $back_confirm_dialog;
    $theme = $this.find(".story-editor-theme");
    $theme.find(".back-button").on("click", function () {
      $back_confirm_dialog.dialog("open");
    });
    $theme.find(".next-button").on("click", function () {
      syncActiveTab(edit_theme_accordion, $theme, "backward");
      transition($theme, $edit_theme);
    });
    $back_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-theme .back-confirm-dialog",
      action_callback: function () {
        transition($theme, $edit_theme);
      }
    });
  }

  // For creating a new story
  function createNewStoryUI() {
    var $back_confirm_dialog;
    $story = $this.find(".story-editor-story");
    $story.find(".back-button").on("click", function () {
      $back_confirm_dialog.dialog("open");
    });
    $story.find(".next-button").on("click", function () {
      syncActiveTab(edit_story_accordion, $story, "backward");
      transition($story, $edit_story);
    });
    $back_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-story .back-confirm-dialog",
      action_callback: function () {
        transition($story, $edit_story);
      }
    });
    $story.find(".story-editor-set-view-button").on("click", function () {
      $current_thumbnail_preview = $story.find(".story-editor-thumbnail-preview");
      set_view_tool.show();
      $this.hide();
    });
  }

  // For creating new waypoint
  function createNewWaypointUI() {
    var $back_confirm_dialog;
    $waypoint = $this.find(".story-editor-waypoint");
    $waypoint.find(".back-button").on("click", function () {
      $back_confirm_dialog.dialog("open");
    });
    $waypoint.find(".next-button").on("click", function () {
      syncActiveTab(edit_waypoint_accordion, $waypoint, "backward");
      transition($waypoint, $edit_waypoint);
    });
    $back_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-waypoint .back-confirm-dialog",
      action_callback: function () {
        transition($waypoint, $edit_waypoint);
      }
    });
    $waypoint.find(".story-editor-set-view-button").on("click", function () {
      $current_thumbnail_preview = $waypoint.find(".story-editor-thumbnail-preview");
      set_view_tool.show();
      $this.hide();
    });
  }

  // For loading a Google spreadsheet
  function createLoadUI() {
    $load = $this.find(".story-editor-load");
    var $load_from_direct_link = $load.find(".load-from-direct-link");
    var $load_from_google_drive = $load.find(".load-from-google-drive");
    var $google_authenticate_load_prompt = $load.find(".google-authenticate-load-prompt");
    var $stories_on_drive_container = $load.find(".stories-on-drive-container");
    var $stories_on_drive_dropdown = $load.find(".stories-on-drive-dropdown");
    var $load_from_google_drive_message = $load.find(".load-from-google-drive-message");
    var $load_from_direct_link_radio = $load.find("#load-from-direct-link-radio");
    $load_from_google_drive_radio = $load.find("#load-from-google-drive-radio");
    var $load_collection_container = $load.find("#load-collection-container");
    var $create_collection_container = $load.find("#create-collection-container");
    var $load_collection_radio = $load.find("#load-collection-radio");
    var $create_collection_radio = $load.find("#create-collection-radio");
    var $sheet_url_textbox = $load.find(".sheet-url-textbox");
    $create_file_name_textbox = $load.find(".story-editor-create-file-name-textbox");
    var $create_to_google_message = $load.find(".story-editor-create-to-google-message");
    var $method_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-load .method-confirm-dialog"
    });
    var $url_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-load .url-confirm-dialog"
    });
    var $permission_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-load .permission-confirm-dialog"
    });
    var $server_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-load .server-confirm-dialog"
    });
    var $format_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-load .format-confirm-dialog"
    });
    var $back = $load.find(".back-button").on("click", function () {
      transition($load, $intro);
    });
    var $next = $load.find(".next-button");
    var disableUI = function () {
      $next.prop("disabled", true);
      $back.prop("disabled", true);
      $create_file_name_textbox.prop("disabled", true);
      $sheet_url_textbox.prop("disabled", true);
      $load_from_direct_link_radio.prop("disabled", true);
      $load_from_google_drive_radio.prop("disabled", true);
      $load_collection_radio.prop("disabled", true);
      $create_collection_radio.prop("disabled", true);
    };
    var enableUI = function () {
      $next.prop("disabled", false);
      $back.prop("disabled", false);
      $create_file_name_textbox.prop("disabled", false);
      $sheet_url_textbox.prop("disabled", false);
      $load_from_direct_link_radio.prop("disabled", false);
      $load_from_google_drive_radio.prop("disabled", false);
      $load_collection_radio.prop("disabled", false);
      $create_collection_radio.prop("disabled", false);
    };
    $next.on("click", function () {
      if ($load_collection_radio.is(":checked")) {
        // This means that we want to load the Google sheet
        // Set sheet url
        var sheet_url;
        if ($load_from_google_drive_radio.is(":checked")) {
          current_sheet_id = $stories_on_drive_dropdown.data("sheet_id");
          current_sheet_name = $stories_on_drive_dropdown.data("sheet_name");
          if (typeof current_sheet_id !== "undefined") sheet_url = getSheetUrlById(current_sheet_id);
        } else {
          var unsafe_sheet_url = $sheet_url_textbox.val();
          var res = unsafe_sheet_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          if (res != null) sheet_url = unsafe_sheet_url;
          current_sheet_id = UTIL.googleSheetUrlToDocTab(unsafe_sheet_url).split(".")[0];
          var promise = GOOGLE_API.getSpreadsheetInfo(current_sheet_id);
          promise.then(function (response) {
            current_sheet_name = response.info.properties.title;
          }).catch(function (errorResponse) {
            console.error(errorResponse);
          });
        }
        // Load data or not
        if (typeof sheet_url === "undefined") {
          $url_confirm_dialog.dialog("open");
        } else {
          disableUI();
          // This util function name is misleading, it converts spreadsheet into csv, not json
          UTIL.gdocToJSON(sheet_url, function (tsv) {
            enableUI();
            tsvToData({
              tsv: tsv,
              error: function () {
                $format_confirm_dialog.dialog("open");
              },
              success: function (data) {
                setAccordionUI(edit_theme_accordion, data);
                transition($load, $edit_theme);
                if (enable_testing) testEditStory(); // for testing editing stories
              }
            });
          }, function (xhr) {
            enableUI();
            var s = xhr.status;
            if (s == 0) {
              $permission_confirm_dialog.dialog("open");
            } else if (s == 404 || s == 400) {
              $url_confirm_dialog.dialog("open");
            } else {
              $server_confirm_dialog.dialog("open");
            }
          });
        }
      } else if ($create_collection_radio.is(":checked")) {
        // This means that we want to create the Google sheet
        disableUI();
        $create_to_google_message.text("Currently creating story...");
        saveStoryCollection({
          desired_sheet_name: $create_file_name_textbox.val(),
          success: function () {
            enableUI();
            transition($load, $edit_theme);
            $create_to_google_message.text("");
            if (enable_testing) testCreateStory(); // for testing the function of creating a story
          },
          error: function () {
            enableUI();
            $create_to_google_message.text("An error is encountered when saving the story to Google Drive. Please try again later.");
          }
        });
      } else {
        $method_confirm_dialog.dialog("open");
      }
    });
    $load.find(".google-authenticate-button").on("click", function () {
      var promise = GOOGLE_API.handleAuthClick();
      promise.then(function (response) {
        // A user id is returned, ignore for now
      }).catch(function (response) {
        var msg = "An error is encountered when logging in to the Google Drive.";
        if (response["message"]["error"] == "popup_closed_by_user") {
          msg += " Please log in to proceed."
        } else {
          msg += " Please try again later."
        }
        $load_from_google_drive_message.empty().append($("<p>" + msg + "</p>"));
      });
    });
    $load_from_google_drive_radio.on("click", function () {
      $load_from_direct_link.hide();
      $load_from_google_drive.show();
      if (!want_to_refresh_story_from_drive) return;
      $stories_on_drive_container.hide();
      loadStoryListFromGoogleDrive({
        authenticated: function () {
          $google_authenticate_load_prompt.hide();
          $load_from_google_drive_message.empty().append($("<p>Loading stories from Google Drive...</p>"));
        },
        not_authenticated: function () {
          $google_authenticate_load_prompt.show();
        },
        success: function (files) {
          $load_from_google_drive_message.empty();
          if (files && files.length > 0) {
            setGoogleSheetListDropdown($stories_on_drive_dropdown, files);
            $stories_on_drive_container.show();
            want_to_refresh_story_from_drive = false;
          } else {
            $load_from_google_drive_message.append($("<p>You have not created stories yet with the Story Editor.</p>"));
          }
        },
        error: function (response) {
          $load_from_google_drive_message.empty().append($("<p>Error loading the list of stories with response: " + response["error"] + "</p>"));
        }
      });
    });
    $load_from_direct_link_radio.on("click", function () {
      $load_from_google_drive.hide();
      $load_from_direct_link.show();
    });
    $("input[type=radio][name=create-or-load-input]").on("change", function () {
      if (this.value == "create") {
        $load_collection_container.hide();
        $create_collection_container.show();
      } else if (this.value == "load") {
        $load_collection_container.show();
        $create_collection_container.hide();
      }
    });
  }

  // Set the dropdown menu for showing the list of google sheets
  function setGoogleSheetListDropdown($dropdown, files) {
    var sheet_name_list = [];
    var sheet_id_list = [];
    files.forEach(function (x) {
      sheet_name_list.push(x["name"]);
      sheet_id_list.push(x["id"]);
    });
    $dropdown.removeData(["sheet_id", "sheet_name"]);
    setCustomDropdown($dropdown, {
      items: sheet_name_list,
      on_item_create_callback: function ($ui, index) {
        $ui.data({
          "sheet_id": sheet_id_list[index],
          "sheet_name": sheet_name_list[index]
        });
      },
      on_item_click_callback: function ($ui) {
        $dropdown.data({
          "sheet_id": $ui.data("sheet_id"),
          "sheet_name": $ui.data("sheet_name")
        });
      }
    });
  }

  // For editing themes loaded from a spreadsheet
  function createEditThemeUI() {
    var $back_confirm_dialog, $next_confirm_dialog;
    $edit_theme = $this.find(".story-editor-edit-theme");
    $edit_theme.find(".back-button").on("click", function () {
      // We do not have to update data backward here, since all unsaved data will be lost
      // We also do not need to reset the UI, since we update the UI when loading story data
      $back_confirm_dialog.dialog("open"); // check if the user truely wants to load another sheet
    });
    $edit_theme.find(".next-button").on("click", function () {
      // Check if the user selects a tab
      if (edit_theme_accordion.getActiveTab().length > 0) {
        forward(edit_theme_accordion, edit_story_accordion);
        transition($edit_theme, $edit_story);
      } else {
        $next_confirm_dialog.dialog("open");
      }
    });
    $edit_theme.find(".story-editor-add-button").on("click", function () {
      setTabUI(edit_theme_accordion.addEmptyTab(), generateEmptyData());
    });
    $edit_theme.find(".story-editor-edit-button").on("click", function () {
      syncActiveTab(edit_theme_accordion, $theme, "forward");
      transition($edit_theme, $theme);
    });
    edit_theme_accordion = createAccordion({
      accordion: "#" + container_id + " .story-editor-edit-theme .custom-accordion",
      delete_confirm_dialog: "#" + container_id + " .story-editor-edit-theme .delete-confirm-dialog"
    });
    $back_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-edit-theme .back-confirm-dialog",
      action_callback: function () {
        transition($edit_theme, $load);
        reset();
      }
    });
    $next_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-edit-theme .next-confirm-dialog"
    });
  }

  // For editing a story in a selected theme
  function createEditStoryUI() {
    var $next_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-edit-story .next-confirm-dialog"
    });
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
    $edit_story.find(".story-editor-add-button").on("click", function () {
      setTabUI(edit_story_accordion.addEmptyTab(), generateEmptyData());
    });
    $edit_story.find(".story-editor-edit-button").on("click", function () {
      syncActiveTab(edit_story_accordion, $story, "forward");
      transition($edit_story, $story);
    });
    edit_story_accordion = createAccordion({
      accordion: "#" + container_id + " .story-editor-edit-story .custom-accordion",
      delete_confirm_dialog: "#" + container_id + " .story-editor-edit-story .delete-confirm-dialog"
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
      whenGoToSaveUI();
    });
    $edit_waypoint.find(".story-editor-add-button").on("click", function () {
      setTabUI(edit_waypoint_accordion.addEmptyTab(), generateEmptyData());
    });
    $edit_waypoint.find(".story-editor-edit-button").on("click", function () {
      syncActiveTab(edit_waypoint_accordion, $waypoint, "forward");
      transition($edit_waypoint, $waypoint);
    });
    edit_waypoint_accordion = createAccordion({
      accordion: "#" + container_id + " .story-editor-edit-waypoint .custom-accordion",
      delete_confirm_dialog: "#" + container_id + " .story-editor-edit-waypoint .delete-confirm-dialog"
    });
  }

  // Handle the save UI when going to it
  function whenGoToSaveUI() {
    if ($save_file_name_textbox.val() == "") {
      $save_file_name_textbox.val(current_sheet_name);
    }
  }

  // For saving stories
  function createSaveUI() {
    $save = $this.find(".story-editor-save");
    $save_to_google_button = $save.find(".story-editor-save-to-google-button");
    $save_to_google_replace_checkbox = $save.find(".story-editor-save-to-google-replace-checkbox");
    $save_to_google_message = $save.find(".story-editor-save-to-google-message");
    $save_file_name_textbox = $save.find(".story-editor-save-file-name-textbox");
    var $next_confirm_dialog = createConfirmDialog({
      selector: "#" + container_id + " .story-editor-save .next-confirm-dialog",
      action_callback: function () {
        transition($save, $intro);
        reset();
      }
    });
    $save.find(".back-button").on("click", function () {
      transition($save, $edit_waypoint);
      $save_to_google_button.prop("disabled", false);
    });
    $save.find(".next-button").on("click", function () {
      $next_confirm_dialog.dialog("open"); // check if the user truely wants to finish
    });
    $save_to_google_button.on("click", function () {
      $save_to_google_button.prop("disabled", true);
      $save_to_google_message.empty().append($("<p>Currently saving story...</p>"));
      saveStoryCollection({
        desired_sheet_id: $save_to_google_replace_checkbox.prop("checked") ? current_sheet_id : undefined,
        desired_sheet_name: $save_file_name_textbox.val(),
        success: function (story_data) {
          $save_file_name_textbox.val(current_sheet_name);
          var story_links = getDesktopStoryLinks(current_sheet_id, story_data);
          var link_html = "<a target='_blank' href='" + getShareLink(current_sheet_id) + "'>publicly viewable link</a>";
          var message = "<p>";
          if (typeof desired_sheet_id !== "undefined") {
            message += "The " + link_html + " with updated stories was successfully replaced.";
          } else {
            message += "The stories were saved as a " + link_html + ".";
          }
          if (story_links.length > 0) {
            message += " The following links point to each story:<ul>";
            story_links.forEach(function (x) {
              var title = x["title"];
              if (title == "") title = "[empty title]";
              message += "<li><a target='_blank' href='" + x["url"] + "'>" + title + "</a></li>";
            });
            message += "</ul>";
          }
          message += "</p>";
          $save_to_google_message.empty().append($(message));
          if ($load_from_google_drive_radio.is(":checked")) {
            want_to_refresh_story_from_drive = true;
            $load_from_google_drive_radio.trigger("click");
          }
        },
        error: function () {
          $save_to_google_message.empty().append($("<p>An error is encountered when saving the story to Google Drive. Please try again later.</p>"));
          $save_to_google_button.prop("disabled", false);
        }
      });
    });
    $save_to_google_replace_checkbox.on("change", function () {
      $save_to_google_button.prop("disabled", false);
    });
    $save_file_name_textbox.on("change", function () {
      $save_to_google_button.prop("disabled", false);
    });
  }

  function saveStoryCollection(options) {
    options = safeGet(options, {});
    var desired_sheet_id = options["desired_sheet_id"];
    var desired_sheet_name = safeGet(options["desired_sheet_name"], ""); // prevent unnecessary API calls
    var story_data = collectStoryData(options["from"]);
    var success = options["success"];
    var error = options["error"];
    try {
      saveDataAsTsv({
        data: story_data,
        sheet_id: desired_sheet_id,
        file_name: desired_sheet_name,
        success: function (response) {
          current_sheet_id = response["spreadsheetId"];
          if (typeof response["spreadsheetTitle"] !== "undefined") {
            current_sheet_name = response["spreadsheetTitle"];
          } else {
            if (typeof desired_sheet_name !== "undefined" && desired_sheet_name !== "") {
              current_sheet_name = desired_sheet_name;
            }
          }
          if (typeof success === "function") success(story_data);
        },
        error: function () {
          if (typeof error === "function") error();
        },
      });
    } catch (err) {
      console.error(err.message);
      if (typeof error === "function") error();
    }
  }

  // Get the desktop share link of each story of the EarthTime viewer
  function getDesktopStoryLinks(sheet_id, data) {
    var urls = [];
    for (var i = 0; i < data.length; i++) {
      var story = data[i]["data"];
      for (var j = 0; j < story.length; j++) {
        var story_title = story[j]["title"];
        var story_id = strToKey(story_title);
        urls.push({
          title: story_title,
          url: getStoryLink(sheet_id, story_id)
        });
      }
    }
    return urls;
  }

  // Get the share link of one story
  function getStoryLink(sheet_id, story_id) {
    var root = getRootUrl();
    if (root.indexOf("localhost") >= 0 || root.indexOf("file:") >= 0) {
      return getShareLink(sheet_id) + "&story=" + story_id;
    } else {
      return getRootUrl() + "/stories/" + story_id + "#waypoints=" + sheet_id + ".0";
    }
  }

  // Get the share link of the EarthTime viewer with stories by google sheet id
  function getShareLink(sheet_id) {
    var root = getRootUrl();
    var hash = "#waypoints=" + sheet_id + ".0";
    if (root.indexOf("localhost") >= 0 || root.indexOf("file:") >= 0) {
      return getRootUrl() + hash;
    } else {
      return getRootUrl() + "/explore" + hash;
    }
  }

  // Get the root url of the share link
  function getRootUrl() {
    var host = window.location.host;
    var base = window.location.protocol + "//" + window.location.host;
    if (host.indexOf("localhost") >= 0 || host.indexOf("file:") >= 0) {
      return base + window.location.pathname;
    } else {
      return base;
    }
  }

  // For initializing the Google Drive API
  function initGoogleDriveAPI() {
    GOOGLE_API.addGoogleSignedInStateChangeListener(function (isSignedIn) {
      if (isSignedIn) {
        if ($load_from_google_drive_radio.is(":checked")) {
          $load_from_google_drive_radio.trigger("click");
        } else if ($save_to_google_button.is(":checked")) {
          $save_to_google_button.trigger("click");
        }
        if ($logout.hasClass("force-hide")) {
          $logout.removeClass("force-hide");
          $login_message.text("");
          $start.text("Begin");
        }
      } else {
        console.log('not logged in...');
        if (!$logout.hasClass("force-hide")) {
          $logout.addClass("force-hide");
          $login_message.text("You have been successfully signed out.");
          $start.text("Login and Begin");
        }
      }
    });
  }

  // Reset the story editor
  function reset() {
    $create_file_name_textbox.val("");
    current_sheet_id = undefined;
    current_sheet_name = undefined;
    setAccordionUI(edit_theme_accordion, []);
    setAccordionUI(edit_story_accordion, []);
    setAccordionUI(edit_waypoint_accordion, []);
    $save_to_google_button.prop("disabled", false);
    $save_to_google_message.empty();
    $save_file_name_textbox.val("");
    $save_to_google_replace_checkbox.prop("checked", true);
    if ($load_from_google_drive_radio.is(":checked")) {
      want_to_refresh_story_from_drive = true;
      $load_from_google_drive_radio.trigger("click");
    }
  }

  // Set the user interface of a tab (one row in the tsv file)
  function setTabUI($ui, d) {
    if (typeof $ui === "undefined" || typeof d === "undefined") return;
    if (typeof d["title"] !== "undefined") {
      $ui.find(".story-editor-title-text").text(d["title"]);
      $ui.find(".story-editor-title-textbox").text(d["title"]);
    }
    if (typeof d["long_title"] !== "undefined") {
      $ui.find(".story-editor-long-title-textbox").text(d["long_title"]);
    }
    if (typeof d["description"] !== "undefined") {
      $ui.find(".story-editor-description-textbox").text(d["description"]);
    }
    if (typeof d["author"] !== "undefined") {
      $ui.find(".story-editor-author-textbox").text(d["author"]);
    }
    if (typeof d["data_source"] !== "undefined") {
      $ui.find(".story-editor-data-source-textbox").text(d["data_source"]);
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
    $ui.find(".story-editor-title-textbox").text("");
    $ui.find(".story-editor-long-title-textbox").text("");
    $ui.find(".story-editor-description-textbox").text("");
    $ui.find(".story-editor-author-textbox").text("");
    $ui.find(".story-editor-data-source-textbox").text("");
    $ui.removeData("data");
    resetThumbnailPreviewUI($ui.find(".story-editor-thumbnail-preview"));
  }

  // Set the user interface of an accordion (theme, story, waypoint)
  function setAccordionUI(accordion, data) {
    if (typeof accordion === "undefined") return;
    accordion.removeAllTabs();
    data = safeGet(data, []);
    if (data.length == 0) {
      setTabUI(accordion.addEmptyTab(), generateEmptyData());
    } else {
      for (var i = 0; i < data.length; i++) {
        setTabUI(accordion.addEmptyTab(), data[i]);
      }
    }
  }

  // Sync the content of the tab and the user editing panel
  // The tab is on the accordion
  // The panel is the UI that shows up when users click the "Edit" button on the tab
  function syncActiveTab(accordion, $panel, direction) {
    var selectors = [
      ".story-editor-title-textbox",
      ".story-editor-long-title-textbox",
      ".story-editor-description-textbox",
      ".story-editor-author-textbox",
      ".story-editor-data-source-textbox"
    ];
    var $active_tab = accordion.getActiveTab();
    for (var i = 0; i < selectors.length; i++) {
      var s = selectors[i];
      if (direction == "forward") {
        $panel.find(s).val($active_tab.find(s).text());
      } else if (direction == "backward") {
        $active_tab.find(s).text($panel.find(s).val());
      }
    }
    if (direction == "forward") {
      syncActiveTabView($active_tab, $panel, true);
    } else if (direction == "backward") {
      syncActiveTabView($panel, $active_tab);
      accordion.setActiveTabHeaderText($panel.find(".story-editor-title-textbox").val());
    }
  }

  // Sync the thumbnail preview
  function syncActiveTabView($from_tab, $to_tab, reset_to_tab) {
    var $from_tab_thumbnail_preview = $from_tab.find(".story-editor-thumbnail-preview");
    var $l = $from_tab_thumbnail_preview.find(".story-editor-thumbnail-preview-landscape");
    var $p = $from_tab_thumbnail_preview.find(".story-editor-thumbnail-preview-portrait");
    var urls = set_view_tool.extractThumbnailUrls($l.data("view"), $p.data("view"));
    var $to_tab_thumbnail_preview = $to_tab.find(".story-editor-thumbnail-preview");
    if (typeof reset_to_tab !== "undefined" && reset_to_tab) {
      resetThumbnailPreviewUI($to_tab_thumbnail_preview);
    }
    setThumbnailPreviewUI($to_tab_thumbnail_preview, urls);
    // TODO: If urls isn't undefined, trigger an ajax call to start creating the full mobile render for these thumbnails
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

  // Append a new data instance to the tab data
  function appendTabData($ui, d) {
    var data = $ui.data("data");
    data.push(d);
    $ui.data("data", data);
  }

  // Collect data from the user interface of a tab (one row in the tsv file)
  function collectTabData($ui) {
    if (typeof $ui === "undefined") return;
    var d = {};
    var $title = $ui.find(".story-editor-title-textbox");
    if ($title.length > 0) {
      d["title"] = safeGet($title.text().trim());
    }
    var $long_title = $ui.find(".story-editor-long-title-textbox");
    if ($long_title.length > 0) {
      d["long_title"] = safeGet($long_title.text().trim());
    }
    var $description = $ui.find(".story-editor-description-textbox");
    if ($description.length > 0) {
      d["description"] = safeGet($description.text().trim());
    }
    var $author = $ui.find(".story-editor-author-textbox");
    if ($author.length > 0) {
      d["author"] = safeGet($author.text().trim());
    }
    var $data_source = $ui.find(".story-editor-data-source-textbox");
    if ($data_source.length > 0) {
      d["data_source"] = safeGet($data_source.text().trim());
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
    return deepCopy(d, {});
  }

  // Collect data from the user interface of an accordion (theme, story, waypoint)
  function collectAccordionData(accordion) {
    var data = [];
    accordion.getTabs().each(function () {
      var d = collectTabData($(this));
      if (hasContent(d)) data.push(d);
    });
    return deepCopy(data, []);
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
  function collectStoryData(from) {
    from = safeGet(from, "waypoint");
    // Collect edited story data from the user interface
    // Propagate data backward based on the current user interface that user in on
    if (from == "waypoint") {
      backward(edit_waypoint_accordion, edit_story_accordion);
    }
    if (from == "waypoint" || from == "story") {
      backward(edit_story_accordion, edit_theme_accordion);
    }
    return backward(edit_theme_accordion);
  }

  // Set thumbnail preview images (also put the video or image url inside href)
  function setThumbnailPreviewUI($ui, urls) {
    if (typeof $ui === "undefined" || typeof urls === "undefined") return;
    $ui.show();
    // If the thumbnail is for the story intro, don't show date UI
    var $storyEditPage = $ui.closest(".story-editor-edit-story");
    var extraParams = "";
    if ($storyEditPage.length) {
      extraParams += "&disableUI=true";
    }
    var $l = $ui.find(".story-editor-thumbnail-preview-landscape");
    var $p = $ui.find(".story-editor-thumbnail-preview-portrait");
    $l.prop("href", urls["landscape"]["render"]["url"]);
    $l.data("view", urls["landscape"]["render"]["args"]["root"] + extraParams);
    $l.find("img").prop("src", ""); // make the loading gif appear
    $l.find("img").prop("src", urls["landscape"]["preview"]["url"]);
    $p.prop("href", urls["portrait"]["render"]["url"]);
    $p.data("view", urls["portrait"]["render"]["args"]["root"] + extraParams);
    $p.find("img").prop("src", ""); // make the loading gif appear
    $p.find("img").prop("src", urls["portrait"]["preview"]["url"]);
  }

  // Reset thumbnail preview images (also put the video or image url inside href)
  function resetThumbnailPreviewUI($ui) {
    if (typeof $ui === "undefined") return;
    $ui.find("a").prop("href", "javascript:void(0)");
    $ui.find("img").prop("src", "");
    $ui.find(".story-editor-thumbnail-preview-landscape").removeData("view");
    $ui.find(".story-editor-thumbnail-preview-portrait").removeData("view");
    $ui.hide();
  }

  // Set the custom dropdown
  function setCustomDropdown($ui, settings) {
    var items = settings["items"]; // the text that will appear for each item
    var init_index = settings["init_index"];
    var on_item_click_callback = settings["on_item_click_callback"];
    var on_item_create_callback = settings["on_item_create_callback"];
    var $menu = $ui.find("div").empty();
    var $button_text = $ui.find("a > span").text("");
    var $selected_item;
    // Set initial button text
    if (typeof init_index !== "undefined" && typeof items !== "undefined") $button_text.text(items[init_index]);
    // Set button event
    // Note that the button is designed to use focusout and focus to determine its state
    // "focusout" indicates that the menu is currently opened and should be closed
    // "focus" indicates that the menu is currently closed and should be opened
    $ui.find("a").off("focusout").on("focusout", function () {
      // Find which item is hovered, and then simulate the click
      if (typeof $selected_item !== "undefined") {
        $button_text.text($selected_item.text()); // update the text on the button
        if (typeof on_item_click_callback === "function") on_item_click_callback($selected_item, $selected_item.index());
        $selected_item = undefined;
      }
      if ($menu.is(":visible")) $menu.addClass("force-hide"); // close the menu
    }).off("focus").on("focus", function () {
      if (!$menu.is(":visible")) $menu.removeClass("force-hide"); // open the menu
    });
    // Add events for menu items
    for (var i = 0; i < items.length; i++) {
      var $item = $("<a href=\"javascript:void(0)\">" + items[i] + "</a>");
      // We need to let the focusout button event know which item is selected
      // Note that we cannot use the click event to find this,
      // because as soon as the item is clicked,
      // the focusout event of the button is triggered,
      // this closes the menu and we never get the click event from the items
      $item.on("mouseover", function () {
        $selected_item = $(this);
      }).on("mouseout", function () {
        $selected_item = undefined;
      });
      $menu.append($item);
      if (typeof on_item_create_callback === "function") on_item_create_callback($item, i);
    }
    return $ui;
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
      width: 285,
      modal: true,
      position: {
        my: "center",
        at: "center",
        of: $this
      },
      classes: {
        "ui-dialog": "custom-dialog"
      }, // this is for jquery 1.12 and after
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
      on_tab_add_callback: function ($old_tab, $new_tab) {
        var tab_length = accordion.getTabs().length;
        // Enable the delete button of the old tab if it was the only one tab in the accordion
        if (tab_length == 2) $old_tab.find(".story-editor-delete-button").prop("disabled", false);
        // Disable the delete button of the new tab if there is only one tab
        if (tab_length == 1) $new_tab.find(".story-editor-delete-button").prop("disabled", true);
        // Set the theme dropdown menu
        setThemeListDropdown($new_tab);
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
        $tab_template.find(".story-editor-copy-button").on("click", function () {
          var d = collectTabData(accordion.getActiveTab());
          d["title"] += " Copy";
          if (typeof d["data"] !== "undefined") {
            d["data"].forEach(function (x) {
              x["title"] += " Copy";
              if (typeof x["data"] !== "undefined") {
                x["data"].forEach(function (y) {
                  y["title"] += " Copy";
                });
              }
            });
          }
          setTabUI(accordion.addEmptyTab(), d);
        });
        $tab_template.find(".story-editor-delete-button").on("click", function () {
          $delete_confirm_dialog.dialog("open");
        });
      }
    });
    accordion.getUI().find(".story-editor-delete-button").prop("disabled", true);

    // The confirm dialog when deleting a tab
    $delete_confirm_dialog = createConfirmDialog({
      selector: selector["delete_confirm_dialog"],
      action_callback: function () {
        accordion.removeActiveTab();
      }
    });
    return accordion;
  }

  // Generate empty data
  function generateEmptyData() {
    return {};
    /*
    return {
      title: "(empty)",
      long_title: "(empty)",
      description: "(empty)",
      author: "(empty)",
      data_source: "(empty)",
      view_landscape: "https://headless.earthtime.org/#v=-578347,38087,2667882,1864091,pts&t=0&ps=0&l=blsat&bt=0&et=0&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=524363,25926,1565172,1876252,pts&t=0&ps=0&l=blsat&bt=0&et=0&startDwell=0&endDwell=0&fps=30"
    };
    */
  }

  // Set the theme list dropdown for a story tab
  function setThemeListDropdown($tab) {
    if (typeof $tab === "undefined") return;
    var $dropdown = $tab.find(".story-editor-theme-dropdown");
    if ($dropdown.length == 0) return;
    setCustomDropdown($dropdown, {
      items: getValues(edit_theme_accordion.getTabs().find(".story-editor-title-textbox")), // all themes
      init_index: edit_theme_accordion.getActiveIndex(), // current theme index
      on_item_click_callback: function ($ui, index) {
        // Move the story from the original theme to the desired theme
        if (edit_theme_accordion.getActiveIndex() === index) return; // return if same theme
        var d = collectTabData($tab); // collect tab data
        edit_story_accordion.removeTab($tab); // remove tab from the accordion
        backward(edit_story_accordion, edit_theme_accordion); // backward update data
        appendTabData(edit_theme_accordion.getTabByIndex(index), d); // add data back to the desired theme tab
      }
    });
  }

  // Format the story data from the UI into a tsv spreadsheet
  function dataToTsv(data) {
    var tsv = "Waypoint Title\tAnnotation Title\tAnnotation Text\tShare View\tAuthor\tMobile Share View Landscape\tMobile Share View Portrait\n";
    data = safeGet(data, []);
    for (var i = 0; i < data.length; i++) {
      var theme = data[i];
      tsv += "#" + theme.title + "\t" + theme.title + "\t" + theme.description + "\n";
      var theme_data = safeGet(theme["data"], []);
      for (var j = 0; j < theme_data.length; j++) {
        var story = theme_data[j];
        // Merge story author and data source to the Author column
        var author = story.author;
        if (typeof story.data_source !== "undefined" && story.data_source !== "") {
          author += "<br>" + story.data_source;
        }
        tsv += "##" + story.title + "\t" + story.title + "\t" + story.description + "\t" + story.view_landscape + "\t" + author + "\t" + story.view_landscape + "\t" + story.view_portrait + "\n";
        var story_data = safeGet(story["data"], []);
        for (var k = 0; k < story_data.length; k++) {
          var waypoint = story_data[k];
          tsv += waypoint.title + "\t" + waypoint.long_title + "\t" + waypoint.description + "\t" + waypoint.view_landscape + "\t\t" + waypoint.view_landscape + "\t" + waypoint.view_portrait + "\n";
        }
      }
    }
    return tsv;
  }

  // Convert string to a valid key for a dictionary
  function strToKey(str) {
    return str.replace(/ /g, "_").replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
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

  // Recover the story data from a tsv spreadsheet
  function tsvToData(settings) {
    if (typeof settings["tsv"] === "undefined") return;
    var success = settings["success"];
    var error = settings["error"];
    var parsed = Papa.parse(settings["tsv"], {
      delimiter: "\t",
      header: true,
      beforeFirstChunk: function (chunk) {
        return chunk.trim();
      }
    });
    var is_valid_csv = isValidTsv(parsed);
    if (!is_valid_csv && typeof error === "function") {
      error();
      return;
    }
    // Parse data
    var data = [];
    var theme, story, waypoint;
    parsed["data"].forEach(function (row) {
      if (typeof row === "undefined") return;
      var title = row["Waypoint Title"];
      var long_title = row["Annotation Title"];
      var description = row["Annotation Text"];
      var view_landscape = row["Mobile Share View Landscape"];
      var view_portrait = row["Mobile Share View Portrait"];
      // Because author and data source are all stored in the Author column, we need to separate them by <br>
      var author_column_split = safeGet(row["Author"], "").split("<br>");
      var author = author_column_split[0];
      var data_source = author_column_split[1];
      if (title.charAt(0) == "#" && title.charAt(1) != "#") {
        theme = {
          title: long_title,
          description: description,
          data: [] // for storing stories
        };
        data.push(theme);
      } else if (title.substring(0, 2) == "##") {
        story = {
          title: long_title,
          description: description,
          author: author,
          data_source: data_source,
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
    if (is_valid_csv && typeof success === "function") {
      success(data);
    }
    return data;
  }

  // Check if the tsv is a valid file that generated by the story editor
  // The input is the parsed tsv, using Papa Parse library
  function isValidTsv(parsed_tsv) {
    var fields = parsed_tsv["meta"]["fields"];
    var checks = [];
    checks.push(fields.indexOf("Waypoint Title"));
    checks.push(fields.indexOf("Annotation Title"));
    checks.push(fields.indexOf("Annotation Text"));
    checks.push(fields.indexOf("Share View"));
    checks.push(fields.indexOf("Author"));
    checks.push(fields.indexOf("Mobile Share View Landscape"));
    checks.push(fields.indexOf("Mobile Share View Portrait"));
    for (var i = 0; i < checks.length; i++) {
      if (checks[i] < 0) return false;
    }
    return true;
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

  // Deep copy of an object
  // new_obj should be "[]" or "{}", depending on the type of obj
  function deepCopy(obj, new_obj) {
    return $.extend(true, new_obj, obj);
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
      return $(this).text();
    }).get();
  }

  // Download the tsv (download.js library is used)
  function downloadDataAsTsv(settings) {
    var tsv = dataToTsv(settings["data"]);
    var file_name = safeGet(settings["file_name"], "");
    if (file_name == "") file_name = "story";
    download(tsv, file_name + ".tsv", "text/plain");
  }

  // Save the tsv to a Google Sheet
  function saveDataAsTsv(settings) {
    settings = safeGet(settings, {});
    var file_name = settings["file_name"];
    var data_array = tsvToSheetsDataArray(dataToTsv(settings["data"]));
    var sheet_id = settings["sheet_id"];
    var success = settings["success"];
    var error = settings["error"];
    var authenticated = settings["authenticated"];
    var not_authenticated = settings["not_authenticated"];
    // Authentication
    if (GOOGLE_API.isAuthenticatedWithGoogle()) {
      if (typeof authenticated === "function") authenticated();
      var promise;
      if (typeof sheet_id !== "undefined") {
        promise = GOOGLE_API.updateSpreadsheet(sheet_id, data_array, file_name);
      } else {
        promise = GOOGLE_API.createNewSpreadsheetWithContent(file_name, data_array);
      }
      promise.then(function (response) {
        if (typeof success === "function") success(response);
      }).catch(function (response) {
        if (typeof error === "function") error(response);
      });
    } else {
      if (typeof not_authenticated === "function") not_authenticated();
    }
  }

  // Load available stories in the form of spreadsheets from a Google Drive
  function loadStoryListFromGoogleDrive(settings) {
    settings = safeGet(settings, {});
    var success = settings["success"];
    var error = settings["error"];
    var authenticated = settings["authenticated"];
    var not_authenticated = settings["not_authenticated"];
    // Authentication
    if (GOOGLE_API.isAuthenticatedWithGoogle()) {
      if (typeof authenticated === "function") authenticated();
      var promise = GOOGLE_API.listSpreadsheets();
      promise.then(function (files) {
        if (typeof success === "function") success(files);
      }).catch(function (errorResponse) {
        if (typeof error === "function") error(errorResponse);
      });
    } else {
      if (typeof not_authenticated === "function") not_authenticated();
    }
  }

  // Get google spreadsheet url by id
  function getSheetUrlById(sheet_id) {
    return "https://docs.google.com/spreadsheets/d/" + sheet_id;
  }

  // For testing the function of creating a story
  function testCreateStory() {
    setTabUI(edit_theme_accordion.getActiveTab(), {
      title: "City",
      description: "A city is a large human settlement. Cities generally have extensive systems for housing, transportation, sanitation, utilities, land use, and communication."
    });
    $this.find(".story-editor-edit-theme .next-button").click();
    setAccordionUI(edit_story_accordion, [{
      title: "Las Vegas",
      description: "Las Vegas, officially the City of Las Vegas and often known simply as Vegas, is the 28th-most populated city in the United States, the most populated city in the state of Nevada, and the county seat of Clark County.",
      author: "Harry Potter and Ginny Weasley",
      data_source: "Hogwarts School of Witchcraft and Wizardry",
      view_landscape: "https://headless.earthtime.org/#v=376423,740061,380719,742478,pts&t=1.7&ps=0&l=blsat&bt=20010101&et=20010101&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=376537,738962,379195,743683,pts&t=1.7&ps=0&l=blsat&bt=20010101&et=20010101&startDwell=0&endDwell=0&fps=30"
    }]);
    $this.find(".story-editor-edit-story .next-button").click();
    setAccordionUI(edit_waypoint_accordion, [{
      title: "1984",
      long_title: "Las Vegas 1984",
      description: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis",
      view_landscape: "https://headless.earthtime.org/#v=375528,739600,381100,742737,pts&t=0&ps=0&l=blsat&bt=19840101&et=19840101&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=376379,738333,379516,743905,pts&t=0&ps=0&l=blsat&bt=19840101&et=19840101&startDwell=0&endDwell=0&fps=30"
    }, {
      title: "2016",
      long_title: "Las Vegas 2016",
      description: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt",
      view_landscape: "https://headless.earthtime.org/#v=375162,739550,380734,742687,pts&t=3.2&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=376379,738333,379516,743905,pts&t=3.2&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30"
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
      view_landscape: "https://headless.earthtime.org/#v=375567,739964,379848,742375,pts&t=0.7&ps=100&l=blsat&bt=19910101&et=20091231&startDwell=1&endDwell=2&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=376502,739029,378913,743310,pts&t=0.7&ps=100&l=blsat&bt=19910101&et=20091231&startDwell=1&endDwell=2&fps=30"
    }]);
    $this.find(".story-editor-edit-waypoint .next-button").click();
    $this.find(".story-editor-save .back-button").click();
    $this.find(".story-editor-edit-waypoint .back-button").click();
    $this.find(".story-editor-edit-story .back-button").click();
  }

  // For testing the function of editing stories
  function testEditStory() {
    setTabUI(edit_theme_accordion.addEmptyTab(), {
      title: "Deforestation",
      description: "Deforestation, clearance, or clearing is the removal of a forest or stand of trees where the land is thereafter converted to a non-forest use. Examples of deforestation include conversion of forestland to farms, ranches, or urban use."
    });
    $this.find(".story-editor-edit-theme .next-button").click();
    setAccordionUI(edit_story_accordion, [{
      title: "Rondonia",
      description: "Rondonia is a state in Brazil, located in the north part of the country. To the west is a short border with the state of Acre, to the north is the state of Amazonas, in the east is Mato Grosso, and in the south and southwest is Bolivia.",
      author: "Hermione Granger and Ron Weasley",
      view_landscape: "https://headless.earthtime.org/#v=678007,1027451,699007,1039263,pts&t=0.2&ps=0&l=blsat&bt=19860101&et=19860101&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=682601,1022857,694413,1043857,pts&t=0.2&ps=0&l=blsat&bt=19860101&et=19860101&startDwell=0&endDwell=0&fps=30"
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
      view_landscape: "https://headless.earthtime.org/#v=676359,1027340,700549,1040942,pts&t=3.2&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=681653,1022046,695255,1046236,pts&t=3.2&ps=0&l=blsat&bt=20160101&et=20160101&startDwell=0&endDwell=0&fps=30"
    }, {
      title: "1984-2016",
      long_title: "Rondonia 1984-2016 (Medium Speed)",
      view_landscape: "https://headless.earthtime.org/#v=676359,1027340,700549,1040942,pts&t=0&ps=50&l=blsat&bt=19840101&et=20161231&startDwell=0&endDwell=1&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=681653,1022046,695255,1046236,pts&t=0&ps=50&l=blsat&bt=19840101&et=20161231&startDwell=0&endDwell=1&fps=30"
    }, {
      title: "1993-2007",
      long_title: "Rondonia 1993-2007 (Slow Speed)",
      view_landscape: "https://headless.earthtime.org/#v=676359,1027340,700549,1040942,pts&t=0.9&ps=25&l=blsat&bt=19930101&et=20071231&startDwell=1&endDwell=2&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=681653,1022046,695255,1046236,pts&t=0.9&ps=25&l=blsat&bt=19930101&et=20071231&startDwell=1&endDwell=2&fps=30"
    }]);
    $this.find(".story-editor-edit-waypoint .next-button").click();
    $this.find(".story-editor-save .back-button").click();
    $this.find(".story-editor-edit-waypoint .back-button").click();
    $this.find(".story-editor-edit-story .back-button").click();
    setTabUI(edit_theme_accordion.addEmptyTab(), {
      title: "Forced Displacement",
      description: "Forced displacement or forced immigration is the coerced movement of a person or people away from their home or home region and it often connotes violent coercion."
    });
    $this.find(".story-editor-edit-theme .next-button").click();
    setAccordionUI(edit_story_accordion, [{
      title: "Refugee",
      description: "A refugee, generally speaking, is a displaced person who has been forced to cross national boundaries and who cannot return home safely.",
      author: "Luna Lovegood",
      view_landscape: "https://headless.earthtime.org/#v=812158,604912,1444623,960674,pts&t=0.6&ps=0&l=bdrk,ar&bt=0.6&et=0.6&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=950510,466561,1306272,1099026,pts&t=0.6&ps=0&l=bdrk,ar&bt=0.6&et=0.6&startDwell=0&endDwell=0&fps=30"
    }]);
    $this.find(".story-editor-edit-story .next-button").click();
    setAccordionUI(edit_waypoint_accordion, [{
      title: "Middle East",
      long_title: "Middle East 2007",
      view_landscape: "https://headless.earthtime.org/#v=1229254,734461,1327079,789488,pts&t=0.7&ps=0&l=bdrk,ar&bt=0.7&et=0.7&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=1268126,719764,1313244,799974,pts&t=0.7&ps=0&l=bdrk,ar&bt=0.7&et=0.7&startDwell=0&endDwell=0&fps=30"
    }, {
      title: "Africa",
      long_title: "Africa 2005 to 2007",
      view_landscape: "https://headless.earthtime.org/#v=694151,570697,1598232,1079242,pts&t=0.5&ps=50&l=bdrk,ar&bt=20050101&et=20071231&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=891919,372929,1400464,1277010,pts&t=0.5&ps=50&l=bdrk,ar&bt=20050101&et=20071231&startDwell=0&endDwell=0&fps=30"
    }]);
    $this.find(".story-editor-edit-waypoint .next-button").click();
    $this.find(".story-editor-save .back-button").click();
    $this.find(".story-editor-edit-waypoint .back-button").click();
    $this.find(".story-editor-edit-story .back-button").click();
    setTabUI(edit_theme_accordion.addEmptyTab(), {
      title: "Cloud",
      description: "In meteorology, a cloud is an aerosol consisting of a visible mass of minute liquid droplets, frozen crystals, or other particles suspended in the atmosphere of a planetary body."
    });
    $this.find(".story-editor-edit-theme .next-button").click();
    setAccordionUI(edit_story_accordion, [{
      title: "Himawari",
      description: "The Himawari geostationary satellites, operated by the Japan Meteorological Agency (JMA), support weather forecasting, tropical cyclone tracking, and meteorology research.",
      author: "Albus Dumbledore",
      data_source: "Hogwarts School of Witchcraft and Wizardry",
      view_landscape: "https://headless.earthtime.org/#v=-988195,-148041,2788731,1976479,pts&t=1.3333333333333333&ps=0&l=bdrk,h8_16&bt=1.3333333333333333&et=1.3333333333333333&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=-161992,-974244,1962528,2802682,pts&t=1.3333333333333333&ps=0&l=bdrk,h8_16&bt=1.3333333333333333&et=1.3333333333333333&startDwell=0&endDwell=0&fps=30"
    }]);
    $this.find(".story-editor-edit-story .next-button").click();
    setAccordionUI(edit_waypoint_accordion, [{
      title: "Japan",
      long_title: "Japan 2015-11-02 04:10",
      view_landscape: "https://headless.earthtime.org/#v=458642,166597,1111869,534037,pts&t=13.833333333333334&ps=0&l=bdrk,h8_16&bt=13.833333333333334&et=13.833333333333334&startDwell=0&endDwell=0&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=594818,11761,975694,688874,pts&t=13.833333333333334&ps=0&l=bdrk,h8_16&bt=13.833333333333334&et=13.833333333333334&startDwell=0&endDwell=0&fps=30"
    }, {
      title: "Australia",
      long_title: "Australia Animation",
      description: "from 2015-11-04 12:40 to 2015-11-05 05:10",
      view_landscape: "https://headless.earthtime.org/#v=106682,1094517,1576768,1921441,pts&t=41.75&ps=50&l=bdrk,h8_16&bt=20151104124000&et=20151105051000&startDwell=0&endDwell=1&fps=30",
      view_portrait: "https://headless.earthtime.org/#v=-7241,214674,1035176,2067859,pts&t=41.75&ps=50&l=bdrk,h8_16&bt=20151104124000&et=20151105051000&startDwell=0&endDwell=1&fps=30"
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
    if (isVisible()) return;
    $this.show();
    if (typeof on_show_callback === "function") {
      on_show_callback();
    }
  };
  this.show = show;

  var hide = function () {
    if (!isVisible()) return;
    $this.hide();
    if (typeof on_hide_callback === "function") {
      on_hide_callback();
    }
  };
  this.hide = hide;

  var isVisible = function () {
    return $this.is(":visible");
  };
  this.isVisible = isVisible;

  var toggle = function () {
    if (isVisible()) {
      hide();
    } else {
      show();
    }
  };
  this.toggle = toggle;

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
  var removeAllTabs = function () {
    getTabs().remove();
    $ui.accordion("refresh");
  };
  this.removeAllTabs = removeAllTabs;

  var removeTab = function ($tab) {
    $tab.remove();
    $ui.accordion("refresh");
  };
  this.removeTab = removeTab;

  var addEmptyTab = function () {
    var $new_tab = $tab_template.clone(true, true);
    var $old_tab;
    var $tabs = getTabs();

    // Check if there are tabs
    var active_index = -1;
    if ($tabs.length == 0) {
      // No tabs, append one tab
      $ui.append($new_tab);
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
      on_tab_add_callback($old_tab, $new_tab);
    }
    return $new_tab;
  };
  this.addEmptyTab = addEmptyTab;

  var removeActiveTab = function () {
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
  this.removeActiveTab = removeActiveTab;

  var getActiveTab = function () {
    return getTabByIndex(getActiveIndex());
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

  var getTabByIndex = function (index) {
    return $(getTabs()[index]);
  };
  this.getTabByIndex = getTabByIndex;

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Constructor
  //
  init();
};
