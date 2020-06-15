import { Thumbnailer } from './Thumbnailer.js';
import { GSheet } from './GSheet.js';
import { resolve } from 'path';

interface EmbedConfig {
  disableAutoFullscreen?: boolean,
  mediaFitStyle?: string,
  showEarthtimeAbout?:boolean
};

function esc(unsafe: string) {
  return unsafe
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}

function noscript(unsafe: string) {
  return unsafe
       .replace(/<\s*script/ig, '')
}

export class earthtime {
  static _DEFAULT_EARTHTIME_SPREADSHEET = "https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=1596808134";
  static _DEFAULT_SHARE_VIEW = "https://earthtime.org/#v=4.56342,0,0.183,latLng&t=2.20&ps=50&l=blsat&bt=19840101&et=20161231";
  static _STORY_AUTHOR_PRECEDING_TEXT = "Story by: ";
  static _DATA_CREDIT_PRECEDING_TEXT = "Data from: ";
  
  static _ROOT_SRC_URL = (function() {
    // @ts-ignore
    var pathOfCurrentScript = import.meta.url;
    var tmp = pathOfCurrentScript.substr(0, pathOfCurrentScript.indexOf('mobile-embed.js'));
    var rootUrl = tmp.substr(0, tmp.lastIndexOf('/') + 1);
    return rootUrl;
  })();
  
  static _storyRegistrations = {};
  static _verboseLogging = false;
  static _isFixedPosition = false;
  static _wasFixedPosition = null;
  static _fixedStoryFrameIdx = null;
  static _loadingMonitorInterval = null;
  
  static _currentOrientation: string;

  static _scriptDependencies = [
    earthtime._ROOT_SRC_URL + '../config-local.js', // Defines EARTH_TIMELAPSE_CONFIG
    earthtime._ROOT_SRC_URL + 'Thumbnailer.js'      // Defines Thumbnailer
  ];


  static download_csv_url(id: string, gid: string) {
    return `https://docs-proxy.cmucreatelab.org/spreadsheets/d/${id}/export?format=csv&id=${id}&gid=${gid}`
  }

  static video_template(a) {
    return (
      `<div class="earthtime-story-frame">
         <div class="earthtime-story-frame-content-container" style="z-index:-${esc(a.idx)}">
           <video class="earthtime-story-frame-content earthtime-orientable earthtime-media" loop muted playsinline
                  poster="${esc(a.poster_src)}"
                  data-src-portrait="${esc(a.poster_src_portrait)}"
                  data-src-landscape="${esc(a.poster_src_landscape)}"
                  data-orientable-attribute="poster">
             <source class="earthtime-orientable" 
                     type="video/mp4" 
                     src="${esc(a.video_src)}"
                     data-src-portrait="${esc(a.video_src_portrait)}"
                     data-src-landscape="${esc(a.video_src_landscape)}"/>
           </video>
           ${a.credit ? `<div class="earthtime-credit">${esc(a.credit)}</div>` : ''}
         </div>
       </div>`)
  }

  static picture_template(a) {
    return (
      `<div class="earthtime-story-frame">
         <div class="earthtime-story-frame-content-container" style="z-index:-${esc(a.idx)}">
           <img class="earthtime-story-frame-content earthtime-orientable earthtime-media"
                src="${esc(a.src)}"
                data-src-portrait="${esc(a.src_portrait)}"
                data-src-landscape="${esc(a.src_landscape)}">
           ${a.credit ? `<div class="earthtime-credit">${esc(a.credit)}</div>` : ''}
         </div>
       </div>`);
  }

  static caption_template(a) {
    return (
      `<div class="earthtime-caption">
          ${a.title ? `<div class="earthtime-caption-title">${esc(a.title)}</div>` : ''}
        </div>`);
  }

  static title_caption_template(a) {
    return (
      `<div class="earthtime-title">
          <div class="earthtime-title-headline"><h1>${esc(a.title)}</h1></div>
          <div class="earthtime-title-rule"></div>
          <div class="earthtime-title-caption">${noscript(a.caption)}</div>
          ${a.author ? `<div class="earthtime-title-author">${noscript(a.author)}</div>` : ''}
          <div class="earthtime-loading">0%</div>
        </div>`);
  }

  static no_story_template() {
    return (
      `<div class="earthtime-nostory-frame">
          <p>No story found with that name.</p>' +
        </div>`);
  }

  static _disableAutoFullscreen: any;
  static _mediaFitStyle: string;
  static Handlebars: any;
  
  /**
  * Wrapper to console.log to make logging easy to turn on/off
  */
  static _printLogging(str) {
    if (earthtime._verboseLogging) {
      console.log(str);
    }
  };
  
  /**
  * Recompute orientation landscape vs. portrait.  If orientation has changed, modify img and video src to match.
  */
  static _updateOrientation() {
    var newOrientation = window.innerWidth > window.innerHeight * 0.75 ? 'landscape' : 'portrait';
    if (earthtime._currentOrientation != newOrientation) {
      // After changing orientation, we might be in a different location and need to change which image/video
      // is displaying
      window.setTimeout(earthtime._updateScrollPos, 200);
      earthtime._printLogging('Changing to ' + newOrientation + ' orientation');
      earthtime._currentOrientation = newOrientation;
      
      // Loop over each story, updating img and video src to match new orientation
      for (var elementId in earthtime._storyRegistrations) {
        if (earthtime._storyRegistrations.hasOwnProperty(elementId)) {
          
          // Change orientation for story
          var story = earthtime._storyRegistrations[elementId];
          var storyContainerElement = story.containerElement;
          story.waitingFor = storyContainerElement.querySelectorAll('.earthtime-media');
          story.numElements = story.waitingFor.length;
          
          // get an array of all orientable elements
          var orientableElements = storyContainerElement.querySelectorAll('.earthtime-orientable');
          for (var i = 0; i < orientableElements.length; i++) {
            var element = orientableElements[i];
            // Get the name of the attribute we're going to modify, if defined.  Here's the deal: for <img> and <source>,
            // we need to modify the "src" attribute, so we'll just assume that as the default unless this element has an
            // attribute named "data-orientable-attribute" defined.  If it does, get the value of that attribute, which
            // specifies the name of the attribute we want to set here.  This allows us to set the "poster" attribute of
            // the <video> element.
            var orientableAttributeName = element.hasAttribute('data-orientable-attribute') ? element.getAttribute('data-orientable-attribute') : "src";
            var newSrc = element.getAttribute('data-src-' + earthtime._currentOrientation);
            element.setAttribute(orientableAttributeName, newSrc);
            if (element.nodeName == 'VIDEO') {
              element.load(); // load() is required for browser to recognize changed video src
            }
            earthtime._printLogging(element);
          }
        }
      }
      if (!earthtime._loadingMonitorInterval) {
        earthtime._loadingMonitorInterval = setInterval(earthtime._updateLoadingStatus, 500);
      }
    }
  };
  
  static _updateLoadingStatus() {
    var stillLoading = false;
    var story = earthtime._storyRegistrations[elementId];
    for (var elementId in earthtime._storyRegistrations) {
      if (earthtime._storyRegistrations.hasOwnProperty(elementId)) {
        var story = earthtime._storyRegistrations[elementId];
        var stillWaitingFor = []
        for (var i = 0; i < story.waitingFor.length; i++) {
          var element = story.waitingFor[i];
          if (element.nodeName == 'VIDEO' ? element.readyState < 1 : !element.complete) {
            stillWaitingFor.push(element);
          }
        }
        story.waitingFor = stillWaitingFor;
        
        var msg = '';
        var pct = Math.floor(100 - 100 * story.waitingFor.length / Math.max(1, story.numElements));
        if (pct < 100) {
          stillLoading = true;
          msg = 'Loading: ' + pct + ' % ';
        } else {
          msg = 'Loaded ';
        }
        
        msg += '(' + earthtime._currentOrientation[0].toUpperCase() + ')';
        var loadingDiv = story.containerElement.getElementsByClassName('earthtime-loading')[0];
        if (loadingDiv) {
          loadingDiv.innerText = msg;
        } else {
          stillLoading = true;
        }
      }
    }

    if (!stillLoading && earthtime._loadingMonitorInterval) {
      clearInterval(earthtime._loadingMonitorInterval);
      earthtime._loadingMonitorInterval = null;
    }
  };
  
  /**
  * Recompute story container offsets on the page to ensure a full screen experience
  */
  static _updateFullscreenOffsets() {
    if (!earthtime._isFixedPosition) return;
    earthtime._resetFullscreenOffsets(true);
    // Loop over each story, updating img and video src to match new orientation
    for (var elementId in earthtime._storyRegistrations) {
      if (earthtime._storyRegistrations.hasOwnProperty(elementId)) {
        var story = earthtime._storyRegistrations[elementId];
        var storyContainerElement = story.containerElement;
        if (!earthtime._disableAutoFullscreen) {
          var storyLeftOffset = parseFloat(storyContainerElement.style.marginLeft) || 0;
          storyLeftOffset -= storyContainerElement.getBoundingClientRect().left;
          
          var newWidth = document.documentElement.clientWidth || document.body.clientWidth;
          
          storyContainerElement.style.marginLeft = Math.round(storyLeftOffset - 0.001) + "px";
          storyContainerElement.style.width = newWidth + "px";
          // Force a redraw for the element currently in fixed position. This is a hack for Safari, because it doesn't consistently
          // draw the element in fixed position after modifying the container margins/width above.
          // @ts-ignore
          document.getElementsByClassName("earthtime-story-frame")[earthtime._fixedStoryFrameIdx].children[0].style.top = "-1px";
        } else {
          var widthOfStoryContainerParent = storyContainerElement.getBoundingClientRect().width;
          var storyframeContentContainers = storyContainerElement.querySelectorAll('.earthtime-story-frame-content-container');
          for (var i = 0; i < storyframeContentContainers.length; i++) {
            storyframeContentContainers[i].style.width = widthOfStoryContainerParent + "px";
            if (earthtime._mediaFitStyle == "cover") {
              storyframeContentContainers[i].classList.add("cover");
            }
          }

          if (earthtime._mediaFitStyle == "contain") {
            var storyMedia = storyContainerElement.getElementsByClassName('earthtime-story-frame-content');
            for (var i = 0; i < storyMedia.length; i++) {
              storyMedia[i].classList.add("contain");
              // Videos seem to extend out 1px when in fixed position?
              if (storyMedia[i].nodeName == 'VIDEO') {
                storyMedia[i].style.width = (widthOfStoryContainerParent - 1) + "px";
              } else {
                storyMedia[i].style.width = widthOfStoryContainerParent + "px";
              }
            }
          }
        }
      }
    }
  };
  
  static _resetFullscreenOffsets(forceReset=false) {
    if (earthtime._isFixedPosition && !forceReset) return;
    // Loop over each story, updating img and video src to match new orientation
    for (var elementId in earthtime._storyRegistrations) {
      if (earthtime._storyRegistrations.hasOwnProperty(elementId)) {
        var story = earthtime._storyRegistrations[elementId];
        var storyContainerElement = story.containerElement;
        
        storyContainerElement.style.marginLeft = "unset";
        storyContainerElement.style.width = "100%";
      }
    }
  };
    
  /**
  * Dynamically load the script from the given <code>url</code>, and called the given <code>onloadCallback</code>
  * function once loaded (if defined).
  *
  * Based on code from https://stackoverflow.com/a/950146/703200
  *
  * @param {string} url The URL of the script to be loaded
  * @param {function} [onloadCallback] optional callback function to be called once the script is loaded
  */
  static _dynamicallyLoadScript(url, onloadCallback) {
    var script = document.createElement('script');
    script.src = url;
    
    if (typeof onloadCallback === 'function') {
      script.onload = function() {
        onloadCallback(url);
      };
    }
    document.head.appendChild(script);
  };
  
  /**
  * Dynamically load the stylesheet from the given <code>url</code>, and called the given <code>onloadCallback</code>
  * function once loaded (if defined).
  *
  * Based on code from https://stackoverflow.com/a/950146/703200
  *
  * @param {string} url The URL of the stylesheet to be loaded
  * @param {function} [onloadCallback] optional callback function to be called once the stylesheet is loaded
  */
  static _dynamicallyLoadStylesheet(url, onloadCallback) {
    var element = document.createElement('link');
    element.setAttribute('href', url);
    element.setAttribute('rel', 'stylesheet');
    
    if (typeof onloadCallback === 'function') {
      element.onload = function() {
        onloadCallback(url);
      };
    }
    
    document.head.appendChild(element);
  };
  
  static _unpackVars(str, keepNullOrUndefinedVars=false) {
    var vars = {};
    if (str) {
      var keyvals = str.split(/[#?&]/);
      for (var i = 0; i < keyvals.length; i++) {
        var keyval = keyvals[i].split('=');
        vars[keyval[0]] = keyval[1];
      }
    }
    // Delete keys with null/undefined values
    if (!keepNullOrUndefinedVars) {
      var keys = Object.keys(vars);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (vars[key] == null || key == "") {
          delete vars[key];
        }
      }
    }
    return vars;
  };
  
  static _generateAuthorText(author) {
    if (!author) return;
    // If non Latin characters are being used for the prefix of the author text, skip all the extra author prefixing below.
    var rNonLatin = /[^\u0000-\u007f]/;
    if (rNonLatin.test(author[0]) || author.trim().toLowerCase().indexOf("story ") == 0) return author;
    var authorAndDataCreditArray = author.split("<br>");
    author = authorAndDataCreditArray[0].trim();
    var dataCredit = authorAndDataCreditArray[1] ? authorAndDataCreditArray[1].trim() : "";
    var finalAuthorAndDataCreditString = "";
    if (author) {
      author = (author.indexOf(earthtime._STORY_AUTHOR_PRECEDING_TEXT) == 0) ? author : earthtime._STORY_AUTHOR_PRECEDING_TEXT + author;
      finalAuthorAndDataCreditString += author;
    }
    if (dataCredit) {
      dataCredit = (dataCredit.indexOf(earthtime._DATA_CREDIT_PRECEDING_TEXT) == 0) ? dataCredit : earthtime._DATA_CREDIT_PRECEDING_TEXT + dataCredit;
      finalAuthorAndDataCreditString += " <br>" + dataCredit;
    }
    return finalAuthorAndDataCreditString;
  };
  
  static _updateScrollPos() {
    earthtime._wasFixedPosition = earthtime._isFixedPosition;
    earthtime._isFixedPosition = false;
    // Loop over each story
    for (var elementId in earthtime._storyRegistrations) {
      if (earthtime._storyRegistrations.hasOwnProperty(elementId)) {
        // Handle scroll for story
        var story = earthtime._storyRegistrations[elementId];
        var storyContainerElement = story.containerElement;
        var storyframes = storyContainerElement.querySelectorAll('.earthtime-story-frame');
        var lastFrame = storyframes[storyframes.length - 1];
        var titlePageOverlay = document.getElementsByClassName("earthtime-story-title-overlay")[0];
        var found = false;
        for (var i = storyframes.length - 1; i >= 0; i--) {
          var frame = storyframes[i];
          var child = frame.children[0];
          var video = child.children[0].nodeName == 'VIDEO' ? child.children[0] : null;
          
          if (titlePageOverlay) {
            titlePageOverlay.classList.add("enabled");
          }
          
          // Find the lowest frame that's started to scroll off the top of the screen and
          // freeze it with position=fixed
          // The first frame will scroll until it starts to go off the top and then is fixed
          // The final is duplicated;  the final-final never is fixed and only scrolls
          var previousCaption = earthtime._getElementSibling(frame, "previous", ".earthtime-caption");
          var captionHeight = previousCaption ? previousCaption.getBoundingClientRect().height : 0;
          if (!found && (lastFrame.getBoundingClientRect().top <= 0 || frame.getBoundingClientRect().top + captionHeight <= 0)) {
            if (i != storyframes.length - 1) {
              earthtime._isFixedPosition = true;
              child.style.position = 'fixed';
              child.style.top = '0px';
              earthtime._fixedStoryFrameIdx = i;
              var currentCaption = earthtime._getElementSibling(frame, "next", ".earthtime-caption");
              if (currentCaption) {
                currentCaption.style.visibility = "visible";
              }
            }
            found = true;
            
            if (titlePageOverlay) {
              if (i == 0) {
                titlePageOverlay.classList.add("enabled");
              } else {
                titlePageOverlay.classList.remove("enabled");
              }
            }
            
            if (video) {
              if (lastFrame.getBoundingClientRect().bottom < 0 && !video.paused) {
                // Special case for the last frame
                earthtime._printLogging('Pausing ' + elementId + ':' + i);
                video.pause();
                video.currentTime = 0;
              } else if (video.paused) {
                // If currently shown is a video, make sure it's playing
                earthtime._printLogging('Playing ' + elementId + ':' + i);
                video.play();
              }
            }
          } else {
            child.style.position = 'relative';
            if (previousCaption && lastFrame.getBoundingClientRect().top > 0) {
              previousCaption.style.visibility = "hidden";
            }
            // For videos playing but not currently shown, pause and seek to beginning
            if (video && !video.paused) {
              earthtime._printLogging('Pausing ' + elementId + ':' + i);
              video.pause();
              video.currentTime = 0;
            }
          }
        }
        if (storyframes.length) {
          if (earthtime._isFixedPosition) {
            storyContainerElement.getElementsByClassName("earthtime-logo")[0].style.position = 'fixed';
          } else {
            storyContainerElement.getElementsByClassName("earthtime-logo")[0].style.position = 'absolute';
          }
        }
      }
      if (earthtime._isFixedPosition) {
        break;
      }
    }
    
    if (!earthtime._wasFixedPosition && earthtime._isFixedPosition) {
      // Entering a story
      earthtime._updateFullscreenOffsets();
    } else if (earthtime._wasFixedPosition && !earthtime._isFixedPosition) {
      // Leaving a story
      earthtime._resetFullscreenOffsets();
    }
  };
  
  static _getElementSibling(elem, direction, selector) {
    var sibling;
    if (direction == "previous") {
      sibling = elem.previousElementSibling;
    } else {
      sibling = elem.nextElementSibling;
    }
    // If there's no selector, return the first sibling
    if (!selector) return sibling;
    // If the sibling matches our selector, use it
    // If not, jump to the next sibling and continue the loop
    while (sibling) {
      var matches = sibling.matches || sibling.msMatchesSelector || sibling.webkitMatchesSelector;
      if (sibling.matches) {
        if (sibling.matches(selector)) return sibling;
      } else if (sibling.msMatchesSelector) {
        if (sibling.msMatchesSelector(selector)) return sibling;
      } else {
        if (sibling.webkitMatchesSelector(selector)) return sibling;
      }
      if (direction == "previous") {
        sibling = sibling.previousElementSibling;
      } else {
        sibling = sibling.nextElementSibling;
      }
    }
  };
  
  /**
  * Registers the story specified by the given <code>storyName</code> for insertion into the DOM element specified by the
  * given <code>elementId</code>.  This function merely takes note of the desire for the story to be loaded.  You must
  * call <code>embedStories()</code> (once and only once!) to actually load the stories into the page.
  *
  * @param {string} storyName the name of the story
  * @param {string} elementId the ID of the DOM element into which the story should be inserted
  */
  static registerStory(storyName, elementId) {
    if (storyName) {
      storyName = storyName.replace(/_/g, ' ').replace(/#/g, '').toLowerCase();
    }
    earthtime._printLogging("Registering story [" + storyName + "] into element [" + elementId + "]");
    earthtime._storyRegistrations[elementId] = {
      name: storyName,
      containerElementId: elementId,
      containerElement: document.getElementById(elementId)
    };
  };
  
  /**
  * Loads all stylesheet and script dependencies into the page and then loads all stories which have previously been
  * registered for embedding via calls to the <code>registerStory</code> function.  This function must only be called
  * once.
  *
  * @param {object} [config] optional config params that will set to default values if not specified
  */


  static embedStories(config:EmbedConfig={}) {
    var numScriptsLoaded = 0;
    
    var onScriptDependenciesLoaded = function(url) {
      numScriptsLoaded++;
      earthtime._printLogging("   (" + numScriptsLoaded + "/" + earthtime._scriptDependencies.length + "): " + url);
      
      // if we're done loading all the script dependencies, then compile the templates then load the stories
      if (numScriptsLoaded === earthtime._scriptDependencies.length) {
        // Set config options 
        // @ts-ignore
        window.EARTH_TIMELAPSE_CONFIG = window.EARTH_TIMELAPSE_CONFIG || {};
        // Precedence is story editor public link, config-local.js/config.js located where this file is hosted from, or lastly a hardcoded default spreadsheet URL
        // @ts-ignore 
        var waypointsIdentifierUrl = config.earthtimeSpreadsheet || window.EARTH_TIMELAPSE_CONFIG.waypointSliderContentPath || earthtime._DEFAULT_EARTHTIME_SPREADSHEET;
        var showAboutSection = config.showEarthtimeAbout || false;
        earthtime._disableAutoFullscreen = config.disableAutoFullscreen || false;
        earthtime._mediaFitStyle = config.mediaFitStyle || "cover";
        
        earthtime._updateOrientation();
        earthtime._updateFullscreenOffsets();
        
        // create handlers for the story
        window.addEventListener('scroll', earthtime._updateScrollPos);
        window.addEventListener('resize', earthtime._updateOrientation);
        window.addEventListener('resize', earthtime._updateFullscreenOffsets);
        
        earthtime._printLogging("Loading stories:");
        for (var elementId in earthtime._storyRegistrations) {
          if (earthtime._storyRegistrations.hasOwnProperty(elementId)) {
            var story = earthtime._storyRegistrations[elementId];
            var storyOptions = {
              waypointsIdentifierUrl: waypointsIdentifierUrl,
              showAboutSection: showAboutSection
            };
            earthtime._loadStory(story.name, story.containerElement, storyOptions);
            earthtime._printLogging("   " + elementId + ": " + story.name);
          }
        }
      }
    };
    
    // load the stylesheet first, then script dependencies
    earthtime._printLogging("Loading stylesheets:");
    earthtime._dynamicallyLoadStylesheet(earthtime._ROOT_SRC_URL + 'mobile-embed.css', function(url) {
      earthtime._printLogging("   (1/1): " + url);
      
      earthtime._printLogging("Loading script dependencies:");
      for (var i = 0; i < earthtime._scriptDependencies.length; i++) {
        var scriptUrl = earthtime._scriptDependencies[i];
        earthtime._dynamicallyLoadScript(scriptUrl, onScriptDependenciesLoaded);
      }
    });
  }


  /**
  * Loads the story specified by the given <code>storyName</code> into the given <code>containerElement</code>.
  *
  * @param {string} storyName the story name
  * @param containerElement the DOM element into which the story will be inserted
  * @param {object} storyOptions a hash containing various options like the waypoint URL, whether to show the About section, etc
  */
  static _loadStory(storyName, containerElement, storyOptions) {
    var regexp;
    var rawUrl = storyOptions.waypointsIdentifierUrl;
    var urlParams: {waypoints?:string} = earthtime._unpackVars(rawUrl);
    if (urlParams.waypoints) {
      regexp = /waypoints=(.*?)\.(.*?)(?=&|$)/;
    } else {
      regexp = /d\/(.*)\/edit\#gid=(.*)/;
    }
    var matchesArray = rawUrl.match(regexp);
    var url = new GSheet(matchesArray[1], matchesArray[2]).get_csv_export_url();
    // TODO: call GSheet.read_csv

    // @ts-ignore
    Papa.parse(url, {
      download: true,
      header: true,
      complete: function(results) {
        var story = [];
        var data = results["data"];
        var append = false;
        var isIframe = window && (window.self !== window.top);
        var navigatorUserAgent = navigator.userAgent;
        var isMSIEUserAgent = navigatorUserAgent.match(/MSIE|Trident|Edge/) != null;
        
        for (var i = 0; i < data.length; i++) {
          var title = data[i]['Waypoint Title'];
          if (title == "") continue;
          // Found a new theme while appending for a story, exit
          if (append && title[0] == "#" && title[1] != "#") break;
          // Found a story, not a theme
          if (title[0] == "#" && title[1] == "#") {
            var cleanTitle = title.replace(/_/g, ' ').replace(/#/g, '').toLowerCase();
            if (cleanTitle == storyName) {
              append = true;
            } else {
              if (append) {
                break;
              } else {
                continue;
              }
            }
          }
          if (append) {
            story.push(data[i]);
          }
        }
        
        if (story.length >= 2 && story[1]['Waypoint Title'][0] == '#') {
          // If the theme and story names are the same and we picked them both up,
          // remove the theme waypoint
          story.shift();
        }
        
        // now insert story elements into the DOM, starting with the logo
        containerElement.innerHTML = '<div class="earthtime-story">' +
        '   <div class="earthtime-logo">' +
        '      <a href="https://earthtime.org" target="_blank">Earth<br/>Time</a>' +
        '   </div>' +
        '</div>';
        
        var storyElement = containerElement.querySelector('.earthtime-story');
        
        if (isIframe) {
          storyElement.classList.add("iframe");
          document.documentElement.classList.add("overflow-hidden");
        } else {
          containerElement.classList.add("overflow-scrolling");
        }
        
        for (var i = 0; i < story.length; i++) {
          var isTitleItem = (i === 0);
          
          // If no mobile landscape view is defined, use the standard share view column
          var landscapeShareView = (story[i]['Mobile Share View Landscape'] || story[i]["Share View"]).trim();
          // If we are the title screen and no view is set, skip showing it. We do this because:
          // 1) It is the same behavior as a waypoint that does not include a view
          // 2) It gives us a way to not have a title screen if we are embedding and only want to show waypoint content
          if (isTitleItem && landscapeShareView === '') continue;
          // If no mobile portrait share view is defined, use the landscape view
          var portraitShareView = (story[i]['Mobile Share View Portrait'] || landscapeShareView).trim();
          
          if (landscapeShareView !== '') {
            // create the appropriate caption element and go ahead and generate its HTML
            var captionContext = {
              title: story[i]['Annotation Title'],
              caption: story[i]['Annotation Text']
            };
            var captionTemplate;
            if (isTitleItem) {
              captionContext['author'] = earthtime._generateAuthorText(story[i]["Author"]);
              captionTemplate = earthtime.title_caption_template;
            } else {
              captionTemplate = earthtime.caption_template;
            }
            var captionHtml = captionTemplate(captionContext);
            
            // create the story frame (i.e. image/video) element
            var landscapeThumbnail = new Thumbnailer(landscapeShareView);
            var portraitThumbnail = new Thumbnailer(portraitShareView);
            var context = {
              idx: i + 1,
              credit: story[i]["Credits"]
            };
            var storyFrameTemplate;
            var currentOrientation = earthtime._currentOrientation;
            if (landscapeThumbnail.isPicture()) {
              storyFrameTemplate = earthtime.picture_template;
              context['src_portrait'] = portraitThumbnail.getImage('portrait');
              context['src_landscape'] = landscapeThumbnail.getImage('landscape');
              context['src'] = currentOrientation == 'portrait' ? context['src_portrait'] : context['src_landscape'];
            } else {
              storyFrameTemplate = earthtime.video_template;
              context['poster_src_portrait'] = portraitThumbnail.getImage('portrait');
              context['poster_src_landscape'] = landscapeThumbnail.getImage('landscape');
              context['poster_src'] = currentOrientation == 'portrait' ? context['poster_src_portrait'] : context['poster_src_landscape'];
              context['video_src_portrait'] = portraitThumbnail.getMp4('portrait');
              context['video_src_landscape'] = landscapeThumbnail.getMp4('landscape');
              context['video_src'] = currentOrientation == 'portrait' ? context['video_src_portrait'] : context['video_src_landscape'];
            }
            
            // insert the caption block if it's the story title
            if (isTitleItem) {
              storyElement.insertAdjacentHTML('beforeend', captionHtml);
            }
            
            // insert the story frame
            storyElement.insertAdjacentHTML('beforeend', storyFrameTemplate(context));
            
            // insert overlay for title slide to darken it
            if (i == 0) {
              var storyTitlePageOverlay = "<div class='earthtime-story-title-overlay'></div>";
              var firstEntry = containerElement.querySelector('.earthtime-story-frame-content-container');
              firstEntry.insertAdjacentHTML('beforeend', storyTitlePageOverlay);
            }
            
            // don't include a separate caption element if this is the title, since it's already been included above
            if (!isTitleItem) {
              storyElement.insertAdjacentHTML('beforeend', captionHtml);
            }
            
            // if we're at the end, then duplicate the last frame
            if (i === story.length - 1) {
              context.idx++;
              storyElement.insertAdjacentHTML('beforeend', storyFrameTemplate(context));
            }
          }
        }
        
        // If no story was found by name passed in, inform the user
        if (story.length == 0) {
          storyElement.insertAdjacentHTML('beforeend', earthtime.no_story_template());
        }
        
        // Show an about section if specified. By default we use this for our full screen embeds
        if (storyOptions.showAboutSection) {
          var aboutSectionContent = '<div class="earthtime-about">' +
          '<h3 class="earthtime-about-heading">About</h3>' +
          '<div class="earthtime-about-logos">' +
          '<img height="150" width="210" src="' + earthtime._ROOT_SRC_URL + '../../../images/CMU-CREATELab.svg">' +
          '<img height="150" width="150" src="' + earthtime._ROOT_SRC_URL + '../../../images/World_Economic_Forum_logo.svg">' +
          '</div>' +
          '<p>EarthTime is a partnership with Carnegie Mellon University\'s CREATE Lab and the World Economic Forum. The Forum draws on its expert network to provide data, author EarthTime stories, and present in its meetings.</p>' +
          '<p>EarthTime is underpinned by CREATE Lab\'s vision to promote data literacy, inspire meaningful dialogue, and democratize access to data for everyone in an inclusive and transparent way.</p>' +
          '</div>';
          
          storyElement.insertAdjacentHTML('beforeend', aboutSectionContent);
        }
        
        // If an MS browser, remove our WebKit position workaround
        if (isMSIEUserAgent) {
          var divs = containerElement.querySelectorAll('.earthtime-story-frame-content');
          for (var i = 0; i < divs.length; i++) {
            divs[i].classList.remove('earthtime-media');
          }
        }
        
        // Trigger an initial scroll update, since full screen will show the first slide but not auto trigger playback, if the title screen is a video
        earthtime._updateScrollPos();
        
        // Scroll event that is attached to the window has no effect when in an iframe and running Safari
        if (isIframe) {
          var elm = document.getElementsByClassName("earthtime-story")[0];
          elm.addEventListener('scroll', earthtime._updateScrollPos);
        }
      }
    });
  }

  static findStory(csv, storyName: string) {
    var story = [];
    var append = false;
    for (var rec of csv) {
      var title = rec['Waypoint Title'];
      if (title == "") continue;
      // Found a new theme while appending for a story, exit
      if (append && title[0] == "#" && title[1] != "#") break;
      // Found a story, not a theme
      if (title[0] == "#" && title[1] == "#") {
        var cleanTitle = title.replace(/_/g, ' ').replace(/#/g, '').toLowerCase();
        if (cleanTitle == storyName.toLowerCase()) {
          append = true;
        } else {
          if (append) {
            break;
          } else {
            continue;
          }
        }
      }
      if (append) {
        story.push(rec);
      }
    }
    if (story.length >= 2 && story[1]['Waypoint Title'][0] == '#') {
      // If the theme and story names are the same and we picked them both up,
      // remove the theme waypoint
      story.shift();
    }
    return story || null;
  }

  static async embedExport(divID: string, waypoints: GSheet, storyName: string) {
    var widthPx = 1400;
    var heightPx = 720
    var csv = await waypoints.read_csv();
    console.log(`Loaded ${csv.length} rows from ${waypoints.url()}`);
    var story = this.findStory(csv, storyName);
    if (!story) {
      console.log(`Story ${storyName} not found`);
      return;
    }
    console.log(`Story ${storyName} has ${story.length} rows`);

    var htmlElts = [];

    for (var rec of story) {
      console.log(rec);
      // If no mobile landscape view is defined, use the standard share view column
      var landscapeShareView = (rec['Mobile Share View Landscape'] || rec["Share View"]).trim();
      // If we are the title screen and no view is set, skip showing it. We do this because:
      // 1) It is the same behavior as a waypoint that does not include a view
      // 2) It gives us a way to not have a title screen if we are embedding and only want to show waypoint content
      if (landscapeShareView === '') continue;
      
      var thumb = new Thumbnailer(landscapeShareView);
      htmlElts.push(`<p>${rec['Annotation Title'] || rec['Waypoint Title']}</p>`);
      if (thumb.isPicture()) {
        htmlElts.push(`<img src="${thumb.getImageWithSize(widthPx, heightPx)}">`)
      } else {
        // skip video for now
        console.log('skipping video');
      }
    }
    var html = htmlElts.join('\n');
    document.getElementById(divID).innerHTML = html;
  }
}

