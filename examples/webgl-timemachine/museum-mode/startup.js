"use strict";

function doEarthlapseStartup() {
    var startupConnectionThreshold = (typeof(EARTH_TIMELAPSE_CONFIG.startupConnectionThreshold) !== "number") ? 0 : EARTH_TIMELAPSE_CONFIG.startupConnectionThreshold;

    var earthTimeReadyCheckInterval;

    var oSplash = document.createElement("DIV");
    oSplash.id = "earthlapse-ui-splash";

    // Create animation
    var oAnimContainer = document.createElement("DIV");
    oAnimContainer.className = "cssload-container";
    var oAnimZenith = document.createElement("DIV");
    oAnimZenith.className = "cssload-zenith";
    oAnimContainer.appendChild(oAnimZenith);
    oSplash.appendChild(oAnimContainer);

    // Create loading message
    var oLogo = document.createElement("H1");
    oLogo.appendChild(document.createTextNode("EarthTime"));
    oSplash.appendChild(oLogo);
    var oStatus = document.createElement("H2");
    oStatus.appendChild(document.createTextNode("Starting up - please wait..."));
    oSplash.appendChild(oStatus);

    // Show splash screen
    var oScreen = document.createElement("DIV");
    oScreen.id = "earthlapse-ui-splash-overlay";
    oScreen.appendChild(oSplash);
    document.body.appendChild(oScreen);

    // Status messages


    oStatus.innerHTML = "Checking network connection...";

    var threshold = startupConnectionThreshold;
    var succeeded = -1;

    var oTestImage = document.createElement("IMG");

    function enqueueNetworkTest() {
        var setImageSrc = function () {
            oTestImage.src = "http://thumbnails.cmucreatelab.org/thumbnail?root=http://earthengine.google.org/timelapse/data/20130507&boundsLTRB=239833.73508091227,522897.15176901396,243314.48721083216,524958.4096709508&width=264&height=204&frameTime=2.1&now=" + Math.random();
        };

        if (succeeded < 0) {
            succeeded = 0;
            setImageSrc();
        } else {
            setTimeout(setImageSrc, 1000);
        }
    }

    function waitForNetwork() {
        if (threshold <= 0 || succeeded >= threshold) {
            oStatus.innerHTML = "Starting up...";
            prepareInterface();
            return;
        }

        if (succeeded > 0) {
            var progress = Math.round(100 * succeeded / threshold);
            oStatus.innerHTML = "Checking network connectivity... " + progress + "%";
        } else {
            oStatus.innerHTML = "Waiting for network connection...";
        }
        enqueueNetworkTest();
    }

    async function prepareInterface() {
        oStatus.innerHTML = "Preparing user interface...";
        await EarthlapseUI.layersAndStoriesReadyPromise;

        // Load Earthlapse modes
        await EarthlapseUI.Modes.loadScreen("default");
        await EarthlapseUI.Modes.loadScreen("menu");
        await EarthlapseUI.Modes.loadScreen("menu2");
        await EarthlapseUI.Modes.loadScreen("story");
        oScreen.className = "earthlapse-ui-splash-complete";
        EarthlapseUI.Modes.resetRevertTimeout();
     
    }

    oTestImage.onabort = oTestImage.onerror = function () {
        succeeded = 0;
        waitForNetwork();
    };
    oTestImage.onload = function () {
        succeeded++;
        waitForNetwork();
    };

    waitForNetwork();
}

(function () {
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        doEarthlapseStartup();
    } else {
        document.addEventListener("DOMContentLoaded", doEarthlapseStartup);
    }
})();
