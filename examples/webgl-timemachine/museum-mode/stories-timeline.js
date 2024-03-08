"use strict";

(function($) {
    /* DOM reference cache */
    var labels = [];
    var timeFormat = "YYYY";
    var originalTimeFormat = timeFormat;
    var showMidLabels = true;
    var originalShowMidLabels = showMidLabels;
    var frames = [];

    var startFrame = 0;
    var doPause = false;
    var wasPausedBeforeDrag = false;
    var $timelineOffsets;
    var loopRange = [];

    var progressBarStartRightPos = 112;
    var progressBarEndRightPos = -12;

    function scale(number, inMin, inMax, outMin, outMax) {
      return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    // Update timeline progress bar
    function update() {
        if (EarthlapseUI.Modes.getCurrentMode() == "explore") return;

        // passed argument might be out of date
        var currentFrameNumber = timelapse.getCurrentFrameNumber();

        if (currentFrameNumber == lastFrameNumber) return;

        var captureTimes = timelapse.getCaptureTimes();
        var lastFrameNumber = currentFrameNumber;

        // % amount of time between frames
        if (captureTimes[currentFrameNumber]) {
          var frameIndices = $(".earthlapse-stories-timeline-labels .circle[data-frame-num]").map((idx, elm) => $(elm).data("frame-num")).toArray();
          var progress = scale(currentFrameNumber, frameIndices[0], frameIndices[frameIndices.length - 1], progressBarStartRightPos, progressBarEndRightPos);
        }

        var fps = timelapse.getFps();
        EarthlapseUI.trigger("storytimeupdate", {
            progress: progress,
            lastFrameNumber: lastFrameNumber,
            currentFrameNumber: currentFrameNumber,
            fps: fps
        });
    }

    function setStartFrame(newStartFrame, newDoPause, newLoopRange) {
        startFrame = newStartFrame;
        loopRange = newLoopRange;

        if (newDoPause != null) {
          doPause = newDoPause;
        }

        // Should we seek to another frame?
        if (startFrame != null) {
            //pause();
            // startFrame is captureTime
            seekToFrame(startFrame);
        }

        // Should we pause the timelapse?
        // if (!doPause) {
        //     play();
        // }
    }

    function setPlaybackSpeed(newSpeed) {
      if (typeof(newSpeed) === 'undefined') return;
      var newPlaybackRate = timelapse.getMaxPlaybackRate() * (newSpeed / 100);
      timelapse.setPlaybackRate(newPlaybackRate);
    }

    function setLabels(newLabels, newTimeFormat, newShowMidLabels, ignoreBuild) {
        labels = newLabels;
        timeFormat = typeof(newTimeFormat) === "undefined" ? originalTimeFormat : newTimeFormat;
        showMidLabels = typeof(newShowMidLabels) === "undefined" ? originalShowMidLabels : newShowMidLabels;
        if (!ignoreBuild) {
          build();
        }
    }

    function getLabelInfo(layer) {
      return museumModeDefaultTimelineLabels[layer];
    }

    function build() {
        if (EarthlapseUI.Modes.getCurrentMode() != "story") return;

        var timelineObj = gEarthTime.timeline();
        if (!timelineObj) {
          // build();
          return;
        }
        var captureTimes = timelineObj.cachedCaptureTimes;
        var timelineLayerId = timelineObj.associatedLayerId;

        var labelInfo = getLabelInfo(timelineLayerId);
        if (!labelInfo) {
          //labelInfo = getLabelInfo('default');
          EarthlapseUI?.Stories?.Timeline?.setTimelineVisibility(true);
          return;
        }
        // ~40 ticks is the "safe" max yearly ticks, with every other one labeled on the screen.
        // Note that for monthly data, we may want to display either as "Apr '19, May '19, etc" or "2019-04, 2019-05",
        //    with the latter limiting number of timeline ticks that can comfortably fit on the screen.
        // For daily, we either use limited number of ticks in formats like "Apr 1 '19, May 12, '19" or we pick a day out
        //    of each month to use and display things as monthly like outlined above.
        // See stories-timeline-labels.js as an example of the formats
        setLabels(labelInfo.labels, labelInfo.timeFormat, labelInfo.showMidLabels, true);
        //pause();

        frames = [];
        var index = 0;
        for (var frameId in labels) {
            var frameNumber = captureTimes.indexOf(frameId);
            var label = labels[frameId];
            var yearMonth = [label, 12];
            if (timeFormat == "slr") {
              frameNumber = index;
            } else if (timeFormat == "YYYY-MM-DD" || timeFormat == "YYYY-MM") {
              var array = frameId.split("-");
              var year = array[0];
              var month = array[1];
              yearMonth = [year, month];
            }
            frames.push({
                frameId: frameId,
                frameNumber: frameNumber,
                label: label,
                yearMonth: yearMonth
            });
            index++;
        }
        frames.sort(function (a, b) { return a.frameNumber - b.frameNumber; });

        var lastFrameNumber = frames[frames.length - 1] ? frames[frames.length - 1].frameNumber : 0;

        // Fix stop frame
        setStartFrame(startFrame, doPause, loopRange);

        EarthlapseUI.trigger("storynewtimeline", {
            lastFrameNumber: lastFrameNumber,
            loopRange: loopRange,
            frames: frames,
            showMidLabels: showMidLabels
        });

        $timelineOffsets = $(".earthlapse-stories-timeline").offset();

        $(".earthlapse-stories-timeline").one("click", function() {
          loopRange = [];
        });

        update();
    }

    function handleTimeTickMousedown(event) {
      loopRange = [];
      wasPausedBeforeDrag = timelapse.isPaused();
      if (!wasPausedBeforeDrag)
        timelapse.handlePlayPause();
      var frameNum = parseInt($(this).data("frame-num"));
      timelapse.seekToFrame(frameNum);
      $(event.target).removeClass("openHand").addClass("closedHand");
      $("body").removeClass("openHand").addClass("closedHand");
      $(".earthlapse-modes-story-container").on("mousemove", trackMouseAndSlide);
      $(document).one("mouseup", function(event) {
        $("body, .earthlapse-stories-timeline-labels .circle").removeClass("closedHand openHand");
        if (!wasPausedBeforeDrag)
          timelapse.handlePlayPause();
        $(".earthlapse-modes-story-container").off("mousemove", trackMouseAndSlide);
        org.gigapan.Util.addGoogleAnalyticEvent('slider', 'click', 'storymode-seek=' + timelapse.getCurrentCaptureTime());
      });
    }

    function trackMouseAndSlide(event) {
      var $marker = $(document.elementFromPoint(event.pageX, $timelineOffsets.top));
      var newFrameNum = $marker.data("frame-num");
      if (newFrameNum != undefined && newFrameNum != timelapse.getCurrentFrameNumber()) {
        timelapse.seekToFrame(newFrameNum);
      }
    }

    function setTimelineVisibility(timelineHidden) {
        if (timelineHidden) {
          $(".earthlapse-modes-story-container .earthlapse-stories-timeline, .earthlapse-modes-story-container .customPlay").addClass("earthlapse-stories-timeline-hidden");
          $(".current-location-text-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").addClass("noTimeline");
        } else {
          $(".earthlapse-modes-story-container .earthlapse-stories-timeline, .earthlapse-modes-story-container .customPlay").removeClass("earthlapse-stories-timeline-hidden");
          $(".current-location-text-container, .scaleBarContainer, #logosContainer, .current-location-text, #layers-legend").removeClass("noTimeline");
        }
    }

    function play() {
        if (!timelapse.isPaused() || timelapse.isDoingLoopingDwell()) { return; }
        timelapse.handlePlayPause();
    }

    function pause() {
        if (timelapse.isPaused() && !timelapse.isDoingLoopingDwell()) { return; }
        timelapse.handlePlayPause();
    }

    function seekToFrame(frameId) {
        var captureTimes = timelapse.getCaptureTimes();
        var frameNumber = captureTimes.indexOf(frameId);
        timelapse.seekToFrame(frameNumber);
    }

    EarthlapseUI.bind("init", function () {
        timelapse.addTimeChangeListener(update);
        timelapse.addTimelineUIChangeListener(build);
    });

    // Expose EarthlapseUI.Stories.Timeline API
    EarthlapseUI.Stories.Timeline = {
        setLabels: setLabels,
        setStartFrame: setStartFrame,
        setPlaybackSpeed: setPlaybackSpeed,
        build: build,
        pause: pause,
        play: play,
        setTimelineVisibility: setTimelineVisibility,
        handleTimeTickMousedown: handleTimeTickMousedown,
        getLabelInfo: getLabelInfo
    };
} (jQuery));
