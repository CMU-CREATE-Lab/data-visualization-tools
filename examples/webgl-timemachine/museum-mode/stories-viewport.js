EarthlapseUI.Stories.Viewport = (function() {
    var inView = false;
    var boundingBox = null;
    var startFrame = null;
    var loopRange = [];
    var keyframeNavigationTimeout = null;

    /* Set state */
    function setBoundingBox(newBoundingBox) {
        if (boundingBox === null) {
            timelapse.addViewChangeListener(refresh);
        }

        if (newBoundingBox === null) {
            timelapse.removeViewChangeListener(refresh);
        }

        boundingBox = newBoundingBox;
    }

    function setStartFrame(newStartFrame, newLoopRange) {
        startFrame = newStartFrame;
        loopRange = newLoopRange;
        if (keyframeNavigationTimeout) {
          clearTimeout(keyframeNavigationTimeout);
          keyframeNavigationTimeout = null;
        }
    }

    function isInView() {
        var storyStepBoundingBoxInPixels = boundingBox;
        var currentBoundingBox = timelapse.getBoundingBoxForCurrentView();

        var epsilonX = (storyStepBoundingBoxInPixels["xmax"] - storyStepBoundingBoxInPixels["xmin"]) / 2;
        var epsilonY = (storyStepBoundingBoxInPixels["ymax"] - storyStepBoundingBoxInPixels["ymin"]) / 2;

        var inBoundsX = Math.abs(currentBoundingBox['xmax'] - storyStepBoundingBoxInPixels['xmax']) < epsilonX;
        var inBoundsY = Math.abs(currentBoundingBox['ymax'] - storyStepBoundingBoxInPixels['ymax']) < epsilonY;
        return inBoundsX && inBoundsY;
    }

    function refresh() {
        inView = isInView();
        if (inView) {
            setBoundingBox(null);
            if (!keyframeNavigationTimeout) {
              keyframeNavigationTimeout = setTimeout(function(){
                $(".earthlapse-stories-explain-nav-done:not(.earthlapse-stories-explain-nav-return), .earthlapse-stories-explain-nav-next").addClass("pulse");
              }, 25000);
            }
            EarthlapseUI.trigger("storyenteredview", {startFrame: startFrame, loopRange: loopRange});
        }
    }

    function clear() {
        inView = false;
        EarthlapseUI.trigger("storyexitedview");
    }

    return {
        setBoundingBox: setBoundingBox,
        setStartFrame: setStartFrame,
        refresh: refresh,
        clear: clear
    };
} ());
