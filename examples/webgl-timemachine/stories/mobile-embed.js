const EARTHTIME_DOMAIN = 'https://earthtime.org';

const storyRegistrations = [];

const scriptDependencies = [
   '/config-local.js',
   '/js/papaparse.min.js',
   '/js/handlebars-v4.0.11.js',
   '/timemachine/js/org/gigapan/util.js',
   '/m/stories/Thumbnailer.js'
];

const handlebarsTemplates = {
   'url-src' : 'https://docs-proxy.cmucreatelab.org/spreadsheets/d/{{id}}/export?format=csv&id={{id}}&gid={{gid}}',
   'video-template' : '<div class="earthtime-story-frame">' +
                      '   <div class="earthtime-story-frame-content-container" style="z-index:-{{idx}}">' +
                      '      <video class="earthtime-story-frame-content" loop muted playsinline ' +
                      '             poster="{{poster_src}}"' +
                      '             data-src-portrait="{{poster_src_portrait}}"' +
                      '             data-src-landscape="{{poster_src_landscape}}"' +
                      '             data-orientable-attribute="poster">' +
                      '         <source class="earthtime-orientable" ' +
                      '                 type="video/mp4" ' +
                      '                 src="{{video_src}}"' +
                      '                 data-src-portrait="{{video_src_portrait}}"' +
                      '                 data-src-landscape="{{video_src_landscape}}"' +
                      '                 data-orientable-attribute="src"/>' +
                      '      </video>' +
                      '      {{#if credit}}' +
                      '         <div class="earthtime-credit">{{credit}}</div>' +
                      '      {{/if}}' +
                      '   </div>' +
                      '</div>',
   'picture-template' : '<div class="earthtime-story-frame">' +
                        '   <div class="earthtime-story-frame-content-container" style="z-index:-{{idx}}">' +
                        '      <img class="earthtime-story-frame-content earthtime-orientable" ' +
                        '           src="{{src}}" ' +
                        '           data-src-portrait="{{src_portrait}}" ' +
                        '           data-src-landscape="{{src_landscape}}"' +
                        '           data-orientable-attribute="src">' +
                        '      {{#if credit}}' +
                        '         <div class="earthtime-credit">{{credit}}</div>' +
                        '      {{/if}}' +
                        '   </div>' +
                        '</div>',
   'caption-template' : '<div class="earthtime-caption">' +
                        '   {{#if title}}' +
                        '      <div class="earthtime-caption-title">{{title}}</div>' +
                        '   {{/if}}' +
                        '   <div class="earthtime-caption-text">{{caption}}</div>' +
                        '</div>',
   'title-caption-template' : '<div class="earthtime-title">' +
                              '   <div class="earthtime-title-headline"><h1>{{title}}</h1></div>' +
                              '   <div class="earthtime-title-rule"></div>' +
                              '   <div class="earthtime-title-caption">{{caption}}</div>' +
                              '   {{#if author}}' +
                              '      <div class="earthtime-title-author">{{{author}}}</div>' +
                              '   {{/if}}' +
                              '</div>'
};

const getOrientationName = function() {
   return (Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait');
};

const compileHandlebarsTemplates = function() {
   console.log("Compiling handlebars templates:");
   const templateIds = Object.keys(handlebarsTemplates);
   templateIds.forEach(function(templateId, index) {
      // overwrite the template with the compiled version
      handlebarsTemplates[templateId] = Handlebars.compile(handlebarsTemplates[templateId]);
      console.log("   (" + (index + 1) + "/" + templateIds.length + "): " + templateId);
   });
};

// got this from https://stackoverflow.com/a/950146/703200
const dynamicallyLoadScript = function(url, onloadCallback) {
   const script = document.createElement('script');  // create a script DOM node
   script.src = url;  // set its src to the provided URL

   if (typeof onloadCallback === 'function') {
      script.onload = function() {
         onloadCallback(url);
      };
   }

   document.head.appendChild(script);  // add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
};

const loadStory = function(storyName, containerElement, earthtimeDomain, config = {}) {
   console.log("Loading story [" + storyName + "]");

   const DEFAULT_SHARE_VIEW = "https://earthtime.org/#theme=big_picture_on_nature&story=default&v=4.56342,0,0.183,latLng&t=2.20&ps=50&l=blsat&bt=19840101&et=20161231";

   // get the spreadsheet url
   const rawUrl = config["waypointSliderContentPath"] || "https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=1596808134";
   const regexp = /d\/(.*)\/edit\#gid=(.*)/;
   const matchesArray = rawUrl.match(regexp);
   const url = handlebarsTemplates['url-src']({ 'id' : matchesArray[1], 'gid' : matchesArray[2] });

   Papa.parse(url, {
      download : true,
      header : true,
      complete : function(results) {
         const themes = [];
         let themeIdx;
         let storyIdx;
         let currentThemeIdx;
         let currentStoryIdx;
         let storyMode = false; // 'Matching title begins with ##'
         const story = [];
         const data = results["data"];
         let append = false;

         for (let i = 0; i < data.length; i++) {
            const title = data[i]['Waypoint Title'];

            if (title[0] === '#') {
               const sharelink = data[i]["Share View"].trim() === '' ? DEFAULT_SHARE_VIEW : data[i]["Share View"];
               const item = {
                  'url' : './' + title.replace(/ /g, '_').replace(/#/g, '').toLowerCase(),
                  'title' : title.replace(/#/g, ''),
                  'author' : data[i]["Author"],
                  'filename' : new Thumbnailer(sharelink).getPng()
               };

               if (title[1] == '#') {
                  themes[themeIdx]['stories'].push(item);
                  storyIdx = themes[themeIdx]['stories'].length - 1;
               }
               else {
                  item['stories'] = [];
                  themeIdx = themes.length;
                  themes.push(item);
                  storyIdx = null;
               }
            }

            // Stop appending?
            if (append && title[0] == '#' && (storyMode || title[1] != '#')) {
               append = false;
            }

            // Start appending?
            if (title.toLowerCase() == storyName.toLowerCase()) {
               append = true;
               currentThemeIdx = themeIdx;
            }
            else if (title.toLowerCase() == '#' + storyName.toLowerCase()) {
               append = true;
               storyMode = true;
               currentThemeIdx = themeIdx;
               currentStoryIdx = storyIdx;
            }

            if (append) {
               if (title !== '') {
                  story.push(data[i]);
               }
            }
         }

         // now insert story elements into the DOM
         containerElement.innerHTML = '<style type="text/css">' +
                                      '   @font-face {' +
                                      '      font-family: "EarthTime";' +
                                      '      src: url("' + earthtimeDomain + '/css/fonts/Exo2-Regular.woff") format("woff");' +
                                      '   }' +
                                      '</style>' +
                                      '<link href="' + earthtimeDomain + '/m/stories/mobile-embed.css?cache-bust=' + Date.now() + '" rel="stylesheet"/>' +
                                      '<div class="earthtime-story">' +
                                      '   <div class="earthtime-logo">' +
                                      '      <a href="https://earthtime.org">Earth<br/>Time</a>' +
                                      '   </div>' +
                                      '</div>';

         const storyElement = containerElement.querySelector('.earthtime-story');

         for (let i = 0; i < story.length; i++) {
            const isTitleItem = (i === 0);
            let shareView = story[i]["Share View"].trim();
            if (isTitleItem && shareView === '') {
               shareView = DEFAULT_SHARE_VIEW;
            }

            if (shareView.trim() !== '') {
               // create the appropriate caption element and go ahead and generate its HTML
               let captionContext = {
                  title : story[i]['Annotation Title'],
                  caption : story[i]['Annotation Text']
               };
               let captionTemplate;
               if (isTitleItem) {
                  captionContext['author'] = story[i]["Author"];
                  captionContext['dateline'] = story[i]["Dateline"];
                  captionTemplate = handlebarsTemplates['title-caption-template']
               }
               else {
                  captionTemplate = handlebarsTemplates['caption-template']
               }
               const captionHtml = captionTemplate(captionContext);

               // create the story frame (i.e. image/video) element
               const thumbnail = new Thumbnailer(shareView);
               const context = {
                  idx : i + 1,
                  credit : story[i]["Credits"]
               };
               let storyFrameTemplate;
               if (thumbnail.isPicture()) {
                  storyFrameTemplate = handlebarsTemplates['picture-template'];
                  context['src'] = thumbnail.getPng(getOrientationName());
                  context['src_portrait'] = thumbnail.getPng('portrait');
                  context['src_landscape'] = thumbnail.getPng('landscape');
               }
               else {
                  storyFrameTemplate = handlebarsTemplates['video-template'];
                  let currentOrientation = getOrientationName();
                  context['poster_src'] = thumbnail.getPng(currentOrientation);
                  context['poster_src_portrait'] = thumbnail.getPng('portrait');
                  context['poster_src_landscape'] = thumbnail.getPng('landscape');
                  context['video_src'] = thumbnail.getMp4(currentOrientation);
                  context['video_src_portrait'] = thumbnail.getMp4('portrait');
                  context['video_src_landscape'] = thumbnail.getMp4('landscape');
               }

               // insert the caption block if it's the story title
               if (isTitleItem) {
                  storyElement.insertAdjacentHTML('beforeend', captionHtml);
               }

               // insert the story frame
               storyElement.insertAdjacentHTML('beforeend', storyFrameTemplate(context));

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

         // set the videos playing
         const videos = containerElement.querySelectorAll('video');
         for (let i = 0; i < videos.length; i++) {
            videos[i].play();
         }
      }
   });
};

const createScrollHandler = function(storyContainerElement) {
   // props go to Randy for this magic :-)
   return function() {
      const storyframes = storyContainerElement.querySelectorAll('.earthtime-story-frame');
      let found = false;
      for (let i = storyframes.length - 1; i >= 0; i--) {
         const frame = storyframes[i];
         const child = frame.children[0];
         // Find the lowest frame that's started to scroll off the top of the screen and freeze it with position=fixed
         // The first frame will scroll until it starts to go off the top and then is fixed
         // The final is duplicated;  the final-final never is fixed and only scrolls
         if (!found && frame.getBoundingClientRect().top < 0) {
            if (i != storyframes.length - 1) {
               child.style.position = 'fixed';
               child.style.top = '0px';
            }
            found = true;
         }
         else {
            child.style.position = 'relative';
         }
      }
   };
};

export function registerStory(storyName, elementId) {
   console.log("Registering story [" + storyName + "] into element [" + elementId + "]");
   storyRegistrations.push({
                              name : storyName,
                              containerElementId : elementId,
                              containerElement : document.getElementById(elementId)
                           });
};

export function embedStories(earthtimeDomain = EARTHTIME_DOMAIN) {
   // initialize, then once that's done, create the scroll handler for this story and load the story
   let numLoaded = 0;
   const onDependenciesLoaded = function(url) {
      numLoaded++;
      console.log("   (" + numLoaded + "/" + scriptDependencies.length + "): " + url);
      if (numLoaded === scriptDependencies.length) {
         compileHandlebarsTemplates();

         console.log("Loading stories...");
         storyRegistrations.forEach(function(story) {
            window.addEventListener('scroll', createScrollHandler(story.containerElement));
            loadStory('#' + story.name, story.containerElement, earthtimeDomain, EARTH_TIMELAPSE_CONFIG);
         });
      }
   };

   console.log("Loading script dependencies:");
   scriptDependencies.forEach(function(scriptUrl) {
      dynamicallyLoadScript(earthtimeDomain + scriptUrl, onDependenciesLoaded)
   });
}
