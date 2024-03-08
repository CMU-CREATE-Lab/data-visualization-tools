"use strict";

(function($) {
    /* Configuration */
    var showToggleUI = false;      // show the minimize/restore button?
    var defaultComplexity = "minimal"; // default UI complexity: full or minimal

    /* Bindings */
    EarthlapseUI.bind("init", function() {
        var $machine = $("#timeMachine");

        // Mark optional UI elements
        $(".sideToolBar").addClass("earthlapse-ui-chrome earthlapse-ui-chrome-optional");

        // Default to minimal UI
        if (defaultComplexity === "minimal") {
            $machine.addClass("earthlapse-ui-minimal");
        }

        if (showToggleUI) {
            // Add UI toggle button
            var $toggle = $("<button type=\"button\" id=\"earthlapse-ui-chrome-toggle\" />");
            var $toggleDiv = $("<div class=\"earthlapse-ui-chrome earthlapse-ui-chrome-toggle-div\" />").append($toggle);
            $machine.append($toggleDiv);

            // Attach event handler to toggle button
            var lastTouch = 0;
            $toggle.on("mousedown touchstart", function(e) {
                e.preventDefault();

                // Prevent double triggers
                var thisTouch = (new Date()).getTime();
                if (thisTouch - lastTouch < 200) { return; }
                lastTouch = thisTouch;

                // Toggle optional UI elements
                $machine.toggleClass("earthlapse-ui-minimal");
            });
        }
    });
} (jQuery));
