"use strict";

(function($) {
    /* State information */
    var index;          // Keyframe index in current story
    var storyId;        // Current story's storyID,
    var themeId;        // Current story's themeID,

    var doWarp = false;

    var lastBoundingBox;
    var lastSetOfLayers;

    var layers = {};

    var snaplapseForPresentationSlider;
    var snaplapseViewerForPresentationSlider;


    /* Functions */
    function setLayers(requestedLayers) {
      var layerProxies = [];
        for (var layerId of requestedLayers) {
          //console.log(layerId)
          var layerProxy = gEarthTime.layerDB.getLayer(layerId);
          if (layerProxy) {
            layerProxies.push(layerProxy);
          } else {
            console.log(`setLayers: Cannot find layer ${layerId}`);
          }
        }
        gEarthTime.layerDB.setVisibleLayers(layerProxies);
    }

    function clearLayers() {
        setLayers([]);
    }

    function startStory(requestedStoryId, requestedThemeId) {
        // Check if valid story ID
        if (typeof museumModeThemeStoryDict[requestedThemeId][requestedStoryId] === "undefined") {
            throw "Invalid story ID";
        }

        storyId = requestedStoryId;
        themeId = requestedThemeId;
        EarthlapseUI.trigger("storystarted", {
            storyId: storyId,
            themeId: themeId
        });

        // Reset story mode
        clearLayers();
        lastBoundingBox = {};
        EarthlapseUI.Stories.Timeline.setLabels(museumModeThemeStoryDict[requestedThemeId][requestedStoryId].data.timelineLabels, museumModeThemeStoryDict[requestedThemeId][requestedStoryId].data.timeFormat, museumModeThemeStoryDict[requestedThemeId][requestedStoryId].data.showMidLabels);
        // Load appropriate waypoint slider
        $("#story_" + storyId).trigger("click");
        // Rewind story
        try {
          timelapse.warpTo(timelapse.getHomeView());
        } catch(e) {
          console.log("Failed to load HomeView()", e);
        }
        goToKeyframe(0);
    }

    function finishStory() {
        resetIndex();
        EarthlapseUI.trigger("storyfinished", {
            storyId: storyId
        });
    }

    function getStoryId() {
        return storyId;
    }

    function getStoryThemeId() {
        return themeId;
    }

    function setIndex(newIndex) {
        index = newIndex;

        if (!snaplapseForPresentationSlider || !snaplapseViewerForPresentationSlider) {
          snaplapseForPresentationSlider = gEarthTime.timelapse.getSnaplapseForPresentationSlider();
          if (!snaplapseForPresentationSlider) return;
          snaplapseViewerForPresentationSlider = snaplapseForPresentationSlider.getSnaplapseViewer();
          if (!snaplapseViewerForPresentationSlider) return;
        }
        snaplapseViewerForPresentationSlider.setCurrentWaypointIndex(newIndex);
    }

    async function goToKeyframe(newIndex) {
        if (EarthlapseUI.Modes.getCurrentMode() != "story") return;

        // Check keyframe index bounds
        if (newIndex < 0 || newIndex > museumModeThemeStoryDict[themeId][storyId].data.keyframes.length - 1) {
            throw "[Earthlapse.Stories] Keyframe index " + newIndex + " is out of bounds";
        }

        setIndex(newIndex);
        var keyframe = museumModeThemeStoryDict[themeId][storyId].data.keyframes[index];

        //console.log('goToKeyframe');

        // Notify DOM listeners that the current keyframe has changed
        // e.g. so that they can show/hide buttons
        EarthlapseUI.trigger("storykeyframechanged", {
            text: keyframe["Text"],
            media: keyframe["Media"],
            title: museumModeThemeStoryDict[themeId][storyId].data["title"],
            length: museumModeThemeStoryDict[themeId][storyId].data.keyframes.length,
            index: index,
            isFirstKeyframe: index - 1 < 0,
            isLastKeyframe: index + 1 > museumModeThemeStoryDict[themeId][storyId].data.keyframes.length - 1
        });

        // Prepare scene
        //EarthlapseUI.Stories.Viewport.clear();
        clearLayers();

        setLayers(keyframe["Layers"].concat(keyframe["Map"]));

        await asyncCheckTimelineReady(10, 1000);

        flyToBox(keyframe['BoundingBox'], keyframe['DoWarp'], !keyframe['Pause']);

        var startFrame;

        //if ((lastBoundingBox != keyframe['BoundingBox'] && JSON.stringify(lastSetOfLayers) != JSON.stringify(keyframe["Layers"])) || keyframe['Pause']) {
          var playbackTime;
          if (keyframe['BeginTime']) {
            playbackTime = timelapse.playbackTimeFromShareDate(keyframe['BeginTime']);
          } else {
            playbackTime = Math.min(timelapse.getDuration(),keyframe['StartTime']);
          }
          // StartFrame is capture time, not frame number
          startFrame = timelapse.getCaptureTimes()[timelapse.timeToFrameNumber(playbackTime)];
        //}
        if (keyframe['BeginTime'] && keyframe['EndTime']) {
          timelapse.handleShareViewTimeLoop(keyframe['BeginTime'], keyframe['EndTime'], keyframe['StartDwell'], keyframe['EndDwell']);
        }
        lastBoundingBox = keyframe['BoundingBox'];
        lastSetOfLayers = keyframe["Layers"];

        EarthlapseUI.Stories.Timeline.setStartFrame(startFrame, keyframe['Pause'], keyframe['LoopRange']);
        EarthlapseUI.Stories.Viewport.setStartFrame(startFrame, keyframe['LoopRange']);
        EarthlapseUI.Stories.Timeline.setPlaybackSpeed(keyframe['PlaybackSpeed']);

        EarthlapseUI.Stories.Timeline.build();
    }

    const asyncCheckTimelineReady = async (ms, triesLeft) => {
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          if (gEarthTime.timeline() == gEarthTime.currentlyShownTimeline && gEarthTime.layerDB.loadedLayers().length == gEarthTime.layerDB.visibleLayers.length) {
            resolve();
            clearInterval(interval);
          } else if (triesLeft < 1) {
            reject();
            clearInterval(interval);
          }
          triesLeft--;
        }, ms);
      });
    };

    function nextKeyframe() {
        goToKeyframe(index + 1);
    }

    function prevKeyframe() {
        goToKeyframe(index - 1);
    }

    function getKeyframe() {
        return index;
    }

    function getLayers() {
        return layers;
    }

    function resetIndex() {
        setIndex(0);
    }

    function flyToBox(boundingBox, newDoWarp, newDoPlay) {
        if (newDoWarp != null) {
          doWarp = newDoWarp;
        } else {
          doWarp = false;
        }

        EarthlapseUI.Stories.Viewport.setBoundingBox(boundingBox);

        // if (lastBoundingBox && lastBoundingBox.xmin == boundingBox.xmin && lastBoundingBox.xmax == boundingBox.xmax && lastBoundingBox.ymin == boundingBox.ymin && lastBoundingBox.ymax == boundingBox.ymax) {
        //   //console.log('same location')
        //   EarthlapseUI.Stories.Viewport.refresh();
        //   return;
        // }

        timelapse.stopParabolicMotion();
        timelapse.setNewView({ bbox: boundingBox }, doWarp, newDoPlay);
    }

    EarthlapseUI.bind("init", async function() {
        layers = {};
        await gEarthTime.layerDBPromise;
        $(".map-layer-div").find("input").each(function(idx, elm) {
          var layerShareId = $(elm).parent().get(0).getAttribute("name");
          layers[layerShareId] = { $dom: $("#" + elm.id) };
        });

        await gEarthTime.storiesLoadedPromise;
        waypointJSONList = gEarthTime.getStories();

        timelapse.addTimelineUIChangeListener(function(info) {
          if (EarthlapseUI.Modes.getCurrentMode() == "explore" || !themeId || !storyId) return;
          gEarthTime.waypointTimelineUIChangeListener(info);
        });

        EarthlapseUI.layersAndStoriesReadyResolver(null);
    });

    // Expose Story Mode API
    EarthlapseUI.Stories = {
        // setMap: setMap,
        setLayers: setLayers,
        getStoryId: getStoryId,
        getStoryThemeId: getStoryThemeId,
        getKeyframe: getKeyframe,
        nextKeyframe: nextKeyframe,
        prevKeyframe: prevKeyframe,
        startStory: startStory,
        finishStory: finishStory,
        getLayers: getLayers,
        resetIndex: resetIndex
    };
} (jQuery));
