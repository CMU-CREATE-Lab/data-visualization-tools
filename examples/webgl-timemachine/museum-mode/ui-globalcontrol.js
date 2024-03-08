"use strict";

(function($) {
    var startMode = EARTH_TIMELAPSE_CONFIG.useTopicsInStoryMode ? "menu" : "menu2";

    // Initialize
    EarthlapseUI.bind("init", function () {
        var $storyMode = $("<div class='ui-button earthlapse-ui-globalcontrol-item earthlapse-ui-globalcontrol-storymode'></div>");
        var $autoModeMsgIndicator = $("<div class='automode-indicator-message'>Demo mode running. Click to begin.</div>");
        var $layerMenu = $("<div id='layers-menu-choice' class='ui-button earthlapse-ui-globalcontrol-item earthlapse-ui-globalcontrol-layermenu'></div>");

        $("#timeMachine").append($storyMode, $autoModeMsgIndicator, $layerMenu);
        $storyMode.attr({
          "title": "Enter story mode"
        });
        $storyMode.button({
          icons: {
            primary: "earthlapse-ui-globalcontrol-storymodeIcon"
          },
          text: false
        }).on("click", function() {
          // Analytics
          org.gigapan.Util.addGoogleAnalyticEvent(
            'button',
            'click',
            'storymode-main-menu',
          );

          EarthlapseUI.Modes.changeModeTo(startMode);
        });

        $layerMenu.button({
          icons: {
            primary: "earthlapse-ui-globalcontrol-exploreLayerIcon"
          },
          text: false
        }).on("click", function() {
          // Analytics
          org.gigapan.Util.addGoogleAnalyticEvent(
            'button',
            'click',
            'explore-layer-menu',
          );
        });

    });
} (jQuery));
