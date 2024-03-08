"use strict";

(function($) {
    /* Configuration */
    var defaultMode = "default";
    var revertTimeoutDelay = EARTH_TIMELAPSE_CONFIG.screenTimeoutInMilliseconds; // milliseconds since last click/touch
    var alternateModeTimeoutDelay = (4 * EARTH_TIMELAPSE_CONFIG.waypointDelayInMilliseconds) + 10000; // milliseconds between welcome screen and waypoint automode
    var enableAutoMode = EARTH_TIMELAPSE_CONFIG.enableAutoMode;

    /* State information */
    var currentMode = null;
    var revertTimeout = null;
    var autoModeStateTimeout = null;
    var isExploreAutoModeRunning = false;

    /* Functions */
    function changeModeTo(mode) {
        // If mode isn't changing, do nothing
        if (currentMode === mode) { return; }

        // Enable new mode
        var $body = $("body");
        $body.removeClass("earthlapse-modes-default earthlapse-modes-story earthlapse-modes-explore earthlapse-modes-menu earthlapse-modes-menu2");
        switch (mode) {
            case "menu":
                $body.addClass("earthlapse-modes-menu");
                mode = "menu";
                break;
            case "menu2":
                $body.addClass("earthlapse-modes-menu2");
                mode = "menu2";
                break;
            case "story":
                $body.addClass("earthlapse-modes-story");
                mode = "story";
                // TODO
                $(".customPlay").appendTo(".earthlapse-modes-screen.earthlapse-modes-container.earthlapse-modes-story-container");
                break;
            case "explore":
                $body.addClass("earthlapse-modes-explore");
                mode = "explore";
                // TODO
                $(".customPlay").appendTo(".customControl");
                gEarthTime.handleStoryToggle(false);
                //if (!currentWaypointStory) {
                //  var $availableStories = $("#theme-list [id^=story_]");
                //  $availableStories.first().click();
                //}
                $("#theme-menu, #layers-list").css("visibility", "visible");
                break;
            default:
                $body.addClass("earthlapse-modes-default");
                mode = "default";
                break;
        }

        // Record mode state change
        var oldMode = currentMode;
        currentMode = mode;

        // Trigger event handlers
        EarthlapseUI.trigger("changemode", {
            oldMode: oldMode,
            mode: mode,
            isExploreAutoModeRunning: isExploreAutoModeRunning
        });

        //resize();
        timelapse.onresize();
    }

    function getCurrentMode() {
        return currentMode;
    }

    async function loadScreen(mode) {
        //console.log('loaded', mode);
        // Load mode-specific CSS
        $("<link href=\"museum-mode/modes-" + escape(mode) + ".css\" rel=\"stylesheet\" type=\"text/css\" />").appendTo("head");

        // Load mode-specific HTML
        await $.ajax({
            url: "museum-mode/modes-" + escape(mode) + ".html",
            success: function(results) {
                // Append screen to page
                var $results = $(results);
                var $screen = $results.filter(".earthlapse-modes-screen");
                $screen.addClass("earthlapse-modes-container earthlapse-modes-" + escape(mode) + "-container");
                $("#timeMachine").append($results);

                // Trigger event handlers
                EarthlapseUI.trigger("loadedscreen", { mode: mode });

                // If this is the default screen, switch to it now
                if (mode === defaultMode) {
                    revertToDefault();
                }
            }
        });
    }

    function revertToDefault() {
        EarthlapseUI.Stories.resetIndex();
        changeModeTo("default");
        clearTimeout(autoModeStateTimeout);
        autoModeStateTimeout = setTimeout(toggleAutoModeState, alternateModeTimeoutDelay);
    }

    function toggleAutoModeState() {
      if (!enableAutoMode) return;
      var snaplapseForPresentationSlider = timelapse.getSnaplapseForPresentationSlider();
      if (EarthlapseUI.Modes.getCurrentMode() == "default") {
        isExploreAutoModeRunning = true;
        changeModeTo("explore");
        snaplapseForPresentationSlider.getSnaplapseViewer().setAutoModeEnableState(true);
        snaplapseForPresentationSlider.getSnaplapseViewer().initializeAndRunAutoMode();
        autoModeUISetup(true);
      } else {
        changeModeTo("default");
        isExploreAutoModeRunning = false;
        snaplapseForPresentationSlider.getSnaplapseViewer().setAutoModeEnableState(false);
        snaplapseForPresentationSlider.getSnaplapseViewer().clearAutoModeTimeout();
        autoModeUISetup(false);
      }
      autoModeStateTimeout = setTimeout(toggleAutoModeState, alternateModeTimeoutDelay);
    }

    function resetRevertTimeout() {
      clearTimeout(autoModeStateTimeout);
      clearTimeout(revertTimeout);
      revertTimeout = setTimeout(function() {
        toggleAutoModeState();
        // Analytics
        org.gigapan.Util.addGoogleAnalyticEvent('interface', 'click', 'interaction-end=' + Date.now());
      }, revertTimeoutDelay);
    }

    function autoModeUISetup(enabled) {
      $("#main-hamburger-menu").hide();
      if (enabled) {
        $(".automode-indicator-message").show();
        $(".customControl, .controls, .location_search_div, #controlsContainer").css("opacity", 0);
        $(".scaleBarContainer, #logosContainer, #layers-legend").addClass("noTimelineForced");
        $(".captureTime, .presentationSlider, .annotation-nav, .current-location-text p, .current-location-text-title, .current-location-text-container, .scaleBarContainer, #layers-legend").addClass("automode-enabled");
        $(".captureTime").insertBefore(".controls");
        gEarthTime.handleStoryToggle(false);
      } else {
        $(".automode-indicator-message").hide();
        $(".customControl, .controls, .location_search_div, #controlsContainer").css("opacity", 1);
        $(".scaleBarContainer, #logosContainer, #layers-legend").removeClass("noTimelineForced");
        $(".captureTime, .presentationSlider, .annotation-nav, .current-location-text p, .current-location-text-title, .current-location-text-container, .scaleBarContainer, #layers-legend").removeClass("automode-enabled");
        $(".captureTime").insertBefore(".controls");
        $(".captureTime").prependTo(".controls");
        gEarthTime.handleStoryToggle(true);
      }
    }

    // Initialize
    EarthlapseUI.bind("init", function() {
        // Setup basic Earthlapse Modes UI
        $("body").addClass("earthlapse-modes");

        // Convert CREATE Lab UI into Earthlapse exploration mode
        var $explore = $(".location_search_div, .presentationSlider, .current-location-text, .player > div[class]:not(#timeMachine_timelapse, #timeMachine_timelapse > div, #baseLayerCreditContainer)");
        $explore.addClass("earthlapse-modes-container earthlapse-modes-explore-container");
        $explore.filter(".vector-legend, .contextMapContainer").addClass("earthlapse-modes-story-container");

        // Disable panning/zooming on screens
        document.addEventListener("touchmove", function (e) {
            var $screen = $(".earthlapse-modes-screen").not(function () {
                var $this = $(this);
                return $this.hasClass("earthlapse-modes-screen-passthru") || $this.css("visibility") === "hidden";
            });
            if ($screen.length === 0) { return; }
            timelapse.setTargetView(timelapse.getView());
            e.stopImmediatePropagation();
        }, true);

        // Set up timeout to revert to default mode
        $(document).on("click touchstart", function (e) {
            // Use the detail property of a mouse event to track whether a real user initiated click happened
            if (e.detail == undefined || $(this).hasClass("disableClick")) return;
            $("body").addClass("disableClick");

            if (EarthlapseUI.Modes.getCurrentMode() == "explore" && isExploreAutoModeRunning && e.detail == 1) {
              var modeChoice = EARTH_TIMELAPSE_CONFIG.useTopicsInStoryMode ? "menu" : "menu2";
              changeModeTo(modeChoice);
              isExploreAutoModeRunning = false;
              $("#theme-menu, #layers-list").css("visibility", "hidden");
              autoModeUISetup(false);
              // Analytics
              org.gigapan.Util.addGoogleAnalyticEvent('interface', 'click', 'interaction-begin=' + Date.now());
              resetRevertTimeout();
            } else if (e.detail == 1) {
              resetRevertTimeout();
            }
        });

        $('#layers-list, .ui-multiselect-checkboxes').on('click', 'input', function() {
          if (isExploreAutoModeRunning) {
            $(".scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").addClass("noTimeline");
          }
        });

        if (storyModeLocationOverrideName) {
          $(".earthlapse-modes").addClass(storyModeLocationOverrideName);
        }
    });

    // Expose modes API
    EarthlapseUI.Modes = {
        changeModeTo: changeModeTo,
        getCurrentMode: getCurrentMode,
        loadScreen: loadScreen,
        revertToDefault: revertToDefault,
        resetRevertTimeout: resetRevertTimeout
    };
} (jQuery));
