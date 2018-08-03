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
    var $editor, $content, $intro, $metadata, $load;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $.ajax({
        dataType: "html",
        url: "StoryEditor.html",
        success: function(html_template) {
          creatUI(html_template);
        },
        error: function() {
          console.log("Error reading the story editor html template.");
        }
      });
    }

    function creatUI(html_template) {
      $container.html(html_template);

      // Main UI
      $editor = $("#" + container_id + " .story-editor");
      $content = $("#" + container_id + " .story-editor-content");

      // The introduction
      $intro = $("#" + container_id + " .story-editor-intro");
      $("#" + container_id + " .story-editor-create-button").on("click", function() {
        transition($intro, $metadata);
      });
      $("#" + container_id + " .story-editor-edit-button").on("click", function() {
        transition($intro, $load);
      });

      // For creating a story
      $metadata = $("#" + container_id + " .story-editor-metadata");
      $("#" + container_id + " .story-editor-metadata .story-editor-left-button").on("click", function(){
        transition($metadata, $intro);
      });
      $("#" + container_id + " .story-editor-metadata .story-editor-right-button").on("click", function(){

      });

      // For loading a Google spreadsheet
      $load = $("#" + container_id + " .story-editor-load");
      $("#" + container_id + " .story-editor-load .story-editor-left-button").on("click", function(){
        transition($load, $intro);
      });
      $("#" + container_id + " .story-editor-load .story-editor-right-button").on("click", function(){

      });

    }

    function transition($from, $to) {
      $from.fadeOut(300, function() {
        $to.fadeIn(300);
      });
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
