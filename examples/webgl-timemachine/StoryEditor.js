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
    var story_container_id = settings["story_container_id"];
    var on_show_callback = settings["on_show_callback"];
    var on_hide_callback = settings["on_hide_callback"];
    var $container = $("#" + story_container_id);
    var $editor;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      // Add editor
      $editor = $("<div class='story_editor'></div>");
      $container.append($editor);

      // Add head
      $editor.append($("<div class='story_editor_head'><p>Story Editor</p></div>"));
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //
    var show = function() {
      timelapse.pause();
      if ($container.is(":visible")) return;
      $container.show();
      if (typeof on_show_callback == "function") {
        on_show_callback();
      }
    };
    this.show = show;

    var hide = function() {
      if (!$container.is(":visible")) return;
      $container.hide();
      if (typeof on_hide_callback == "function") {
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
