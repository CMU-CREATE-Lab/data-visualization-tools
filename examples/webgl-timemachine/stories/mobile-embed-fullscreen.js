const EARTHTIME_DOMAIN = 'https://earthtime.org';

const scriptDependencies = [
   '/config-local.js',
   '/js/papaparse.min.js',
   '/js/d3.min.js',
   '/js/handlebars-v4.0.11.js',
   '/js/blazy.min.js',
   '/js/noframework.waypoints.min.js',
   '/timemachine/js/org/gigapan/util.js',
   '/m/stories/Thumbnailer.js'
];

const handlebarsTemplates = {
   'related-item-template' : '<div class="gi-related__item">' +
                             '  <a href="{{url}}">' +
                             '    <img class="b-lazy" data-src="{{filename}}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">' +
                             '    <h5>{{title}}</h5>' +
                             '    {{#if author}}' +
                             '      <div class="gi-related__subhead">{{{author}}}</div>' +
                             '    {{/if}}' +
                             '  </a>' +
                             '</div>',
   'video-template' : '<span class="gi-card__media no-tint" data-media="{{idx}}">' +
                      '  <span class="gi-card__bg">' +
                      '    <span class="gi-card__video-parent" data-video-autoplay="true" data-video-contain="false" data-video-filename="{{filename}}" data-video-loop="true" data-video-portrait="true" data-video-poster="{{filename}}"> </span>' +
                      '  </span>' +
                      '  {{#if credit}}' +
                      '    <div class="gi-card__attribution">{{credit}}</div>' +
                      '  {{/if}}' +
                      '</span>',
   'title-video-template' : '<span class="gi-card__media light-tint active showing" data-media="{{idx}}">' +
                            '  <span class="gi-card__bg">' +
                            '    <span class="gi-card__video-parent" data-video-autoplay="true" data-video-contain="false" data-video-filename="{{filename}}" data-video-loop="true" data-video-portrait="true" data-video-poster="{{filename}}"> </span>' +
                            '  </span>' +
                            '</span>',
   'video-caption-template' : '<div class="gi-card__content js-gi-media" data-media-target="{{idx}}" data-media-type="{{data_media_type}}">' +
                              '  <div class="gi-card__caption gi-lazy--inner gi-card__caption--left gi-card__caption--lg ">' +
                              '    <p class=" gi-card__caption--parent">' +
                              '      <span class="gi-card__caption--bg">' +
                              '      {{#if title}}' +
                              '          <strong>{{title}}</strong><br/>' +
                              '      {{/if}}' +
                              '      {{caption}}' +
                              '      </span>' +
                              '    </p>' +
                              '  </div>' +
                              '</div>',
   'title-video-caption-template' : '<div class="gi-card__content-title">' +
                                    '  <div class="gi-card__content-title__block">' +
                                    '    <h1 class="gi-card__content-title__headline">' +
                                    '      <span>{{title}}</span>' +
                                    '    </h1>' +
                                    '    <div class="gi-card__content-title__rule"> </div>' +
                                    '    <p class="gi-card__content-title_deck">{{caption}}</p>' +
                                    '    <div class="gi-card__content-title__meta">' +
                                    '    {{#if author}}' +
                                    '      <div class="gi-card__content-title__meta-author">' +
                                    '        <span>' +
                                    '          {{{author}}}' +
                                    '        </span>' +
                                    '      </div>' +
                                    '    {{/if}}' +
                                    '    {{#if dateline}}' +
                                    '      <div class="gi-card__content-title__meta-dateline">' +
                                    '        <span>Published </span> <time itemprop="dateCreated">{{{dateline}}} </time>' +
                                    '      </div>' +
                                    '    {{/if}}' +
                                    '    </div>' +
                                    '  </div>' +
                                    '</div>' +
                                    '<div class="gi-card__content js-gi-media" data-media-target="{{idx}}" data-media-type="video">' +
                                    '  <div class="gi-card__caption gi-lazy--inner gi-card__caption-trigger ">' +
                                    '    <p class=" "> </p>' +
                                    '  </div>' +
                                    '</div>',
   'picture-template' : '<span class="gi-card__media no-tint" data-media="{{idx}}">' +
                        '  <picture>' +
                        '    <source data-srcset="{{filename_landscape}}" media="(min-width: 1024px) and (orientation: landscape)">' +
                        '    <source data-srcset="{{filename_landscape}}" media="(orientation: landscape)">' +
                        '    <source data-srcset="{{filename_portrait}}" media="(min-width: 768px) and (orientation: portrait)">' +
                        '    <source data-srcset="{{filename_portrait}}" media="(orientation: portrait)">' +
                        '    <img class="gi-card__asset no-tint b-lazy-manual" data-src="{{filename_landscape}}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">' +
                        '  </picture>' +
                        '  {{#if credit}}' +
                        '    <div class="gi-card__attribution">{{credit}}</div>' +
                        '  {{/if}}' +
                        '</span>'
};

const insertHandlebarsTemplates = function() {
   Object.keys(handlebarsTemplates).forEach(function(templateId) {
      const script = document.createElement('script');
      script.setAttribute('id', templateId);
      script.setAttribute('type', 'text/x-handlebars-template');
      script.innerHTML = handlebarsTemplates[templateId];
      document.head.appendChild(script);
   });
};

const insertHtml = function(containerElementId, earthtimeDomain) {
   document.getElementById(containerElementId).innerHTML = '<div class="element element-rawhtml">' +
                                                           '  <article class="gi-article">' +
                                                           '    <header class="gi-header">' +
                                                           '      <div class="gi-header__content">' +
                                                           '        <div id="gi-header">' +
                                                           '        </div>' +
                                                           '      </div>' +
                                                           '      <div class="gi-header__logo">' +
                                                           '        <a href="https://earthtime.org">' +
                                                           '          Earth<br/>Time' +
                                                           '        </a>' +
                                                           '      </div>' +
                                                           '      <div class="gi-share" id="gi-share"></div>' +
                                                           '    </header>' +
                                                           '    <main class="gi-body active">' +
                                                           '      <div class="gi-body__wrapper">' +
                                                           '        <div class="gi-body__content" itemprop="articleBody">' +
                                                           '        <span id="gi-body">' +
                                                           '          <div class="gi-asset gi-asset--fb gi-asset--fixed gi-asset--overlay gi-asset--gallery gi-asset--fade no-margin-top ">' +
                                                           '            <div class="gi-fixed-wrapper" id="parent-media-list">' +
                                                           '              <div class="gi-card gi-card--fixed gi-card--title" id="media-list">' +
                                                           '              </div>' +
                                                           '            </div>' +
                                                           '          </div>' +
                                                           '        </span>' +
                                                           '        </div>' +
                                                           '      </div>' +
                                                           '    </main>' +
                                                           '    <footer class="gi-footer">' +
                                                           '      <div class="gi-footer__related">' +
                                                           '        <div class="gi-related">' +
                                                           '          <h3 class="gi-subhead">More related to this story </h3>' +
                                                           '          <div class="gi-related__items">' +
                                                           '          </div>' +
                                                           '        </div>' +
                                                           '        <div class="gi-footer__leaf">' +
                                                           '          <img height="40" src="' + earthtimeDomain + '/images/Blank_globe.svg" title="theglobeandmail.com" width="40">' +
                                                           '        </div>' +
                                                           '        <div class="gi-footer__credits">' +
                                                           '          <h3 class="gi-subhead">About</h3>' +
                                                           '          <div class="gi-footer__logos">' +
                                                           '            <img height="150" width="210" src="' + earthtimeDomain + '/images/CMU-CREATELab.svg">' +
                                                           '            <img height="150" width="150" src="' + earthtimeDomain + '/images/World_Economic_Forum_logo.svg">' +
                                                           '          </div>' +
                                                           '          <p>EarthTime is a partnership with Carnegie Mellon University\'s CREATE Lab and the World Economic Forum. The Forum draws on its expert network to provide data, author EarthTime stories, and present in its meetings.</p>' +
                                                           '          <p>EarthTime is underpinned by CREATE Lab\'s vision to promote data literacy, inspire meaningful dialogue, and democratize access to data for everyone in an inclusive and transparent way.</p>' +
                                                           '        </div>' +
                                                           '      </div>' +
                                                           '    </footer>' +
                                                           '  </article>' +
                                                           '</div>';
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

const loadStory = function(storyName) {
   var DEFAULT_SHARE_VIEW = "https://earthtime.org/#theme=big_picture_on_nature&story=default&v=4.56342,0,0.183,latLng&t=2.20&ps=50&l=blsat&bt=19840101&et=20161231";
   var source = document.getElementById("video-template").innerHTML;
   var videoTemplate = Handlebars.compile(source);
   var source = document.getElementById("video-caption-template").innerHTML;
   var videoCaptionTemplate = Handlebars.compile(source);
   var source = document.getElementById("title-video-template").innerHTML;
   var titleVideoTemplate = Handlebars.compile(source);
   var source = document.getElementById("title-video-caption-template").innerHTML;
   var titleVideoCaptionTemplate = Handlebars.compile(source);
   var source = document.getElementById("picture-template").innerHTML;
   var pictureTemplate = Handlebars.compile(source);
   var source = document.getElementById("related-item-template").innerHTML;
   var relatedItemTemplate = Handlebars.compile(source);

   var lochash = location.hash.substr(1);
   var mylocation = lochash.substr(lochash.indexOf('waypoints=')).split('&')[0].split('=')[1];

   var EARTH_TIMELAPSE_CONFIG = EARTH_TIMELAPSE_CONFIG || {};
   var rawUrl = EARTH_TIMELAPSE_CONFIG["waypointSliderContentPath"] || "https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=1596808134";
   var regexp = /d\/(.*)\/edit\#gid=(.*)/;
   var matchesArray = rawUrl.match(regexp);
   var urlSrc = "https://docs-proxy.cmucreatelab.org/spreadsheets/d/{{id}}/export?format=csv&id={{id}}&gid={{gid}}";
   var urlTemplate = Handlebars.compile(urlSrc);
   var url = urlTemplate({ 'id' : matchesArray[1], 'gid' : matchesArray[2] });

   if (mylocation) {
      url = urlTemplate({ 'id' : mylocation.split('.')[0], 'gid' : mylocation.split('.')[1] });
   }

   Papa.parse(url, {
      download : true,
      header : true,
      complete : function(results, file) {
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
            console.log(title);

            if (title[0] === '#') {
               const sharelink = data[i]["Share View"].trim() === '' ? DEFAULT_SHARE_VIEW : data[i]["Share View"];
               const item = {
                  'url' : './' + title.replace(/ /g, '_').replace(/#/g, '').toLowerCase(),
                  'title' : title.replace(/#/g, ''),
                  'author' : data[i]["Author"],
                  'filename' : new Thumbnailer(sharelink).getPng('landscape')
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

         var el = document.getElementById("media-list");
         // get the shareview: Old waypoint spreadsheets sometimes have no shareview specified for the theme
         const shareviewFilename = (story[0]["Share View"].trim() === '') ? DEFAULT_SHARE_VIEW : story[0]["Share View"];

         var html = titleVideoTemplate({ idx : 0, filename : shareviewFilename });

         el.insertAdjacentHTML('beforeend', html);

         for (var i = 1; i < story.length; i++) {
            var shareView = story[i]["Share View"];
            if (shareView.trim() != '') {
               var thumbnail = new Thumbnailer(shareView);
               var credit = story[i]["Credits"];
               let html;
               if (thumbnail.isPicture()) {
                  var f_portrait = thumbnail.getPng("portrait");
                  var f_landscape = thumbnail.getPng("landscape");
                  var pictureContext = {
                     idx : i,
                     filename_portrait : f_portrait,
                     filename_landscape : f_landscape,
                     credit : credit
                  };
                  html = pictureTemplate(pictureContext);
               } else {
                  html = videoTemplate({ idx : i, filename : thumbnail.sharelink, credit : credit })
               }
               el.insertAdjacentHTML('beforeend', html);
            }
         }

         var el2 = document.getElementById("parent-media-list");
         for (var i = story.length - 1; i > 0; i--) {
            var videoCaptionContext = {
               idx : i,
               title : story[i]["Annotation Title"],
               caption : story[i]["Annotation Text"],
               data_media_type : 'video'
            };
            if (story[i]["Share View"].trim() != '') {
               var thumbnail = new Thumbnailer(story[i]["Share View"]);
               if (thumbnail.isPicture()) {
                  videoCaptionContext['data_media_type'] = 'photo';
               }
               var html = videoCaptionTemplate(videoCaptionContext);
               el2.insertAdjacentHTML('afterend', html);
            }
         }

         var videoCaptionContext = {
            idx : 0,
            title : story[0]["Annotation Title"].replace(/#/g, ''),
            caption : story[0]["Annotation Text"],
            author : story[0]["Author"],
            dateline : story[0]["Dateline"]
         };
         var html = titleVideoCaptionTemplate(videoCaptionContext);
         el2.insertAdjacentHTML('afterend', html);

         var htmlCollection = document.getElementsByClassName("gi-related__items");
         if (themes[currentThemeIdx]['stories'].length > 1) {
            var relatedItems = [];
            while (relatedItems.length < Math.min(themes[currentThemeIdx]['stories'].length - 1, 2)) {
               var choice = Math.floor(Math.random() * themes[currentThemeIdx]['stories'].length);
               if (choice != currentStoryIdx && !(relatedItems.indexOf(choice) >= 0)) {
                  relatedItems.push(choice);
               }
            }
            for (var i = 0; i < relatedItems.length; i++) {
               var html = relatedItemTemplate(themes[currentThemeIdx]['stories'][relatedItems[i]]);
               htmlCollection[0].insertAdjacentHTML('afterend', html);
            }

         }
         else {
            if (themes.length == 2) { //there is at least 1 more theme
               var i = 0;
               if (currentThemeIdx == 0) {
                  i = 1;
               }
               for (var j = 0; j < 2; j++) {
                  var html = relatedItemTemplate(themes[i]['stories'][j]);
                  htmlCollection[0].insertAdjacentHTML('afterend', html);
               }
            }
            else if (themes.length > 2) { // there is >= 2 more themes
               var relatedItems = [];
               while (relatedItems.length < 2) {
                  var choice = Math.floor(Math.random() * themes.length);
                  if (choice != currentThemeIdx && !(relatedItems.indexOf(choice) >= 0)) {
                     relatedItems.push(choice);
                  }
               }
               for (var i = 0; i < relatedItems.length; i++) {
                  var html = relatedItemTemplate(themes[relatedItems[i]]);
                  htmlCollection[0].insertAdjacentHTML('beforeend', html);
               }
            }
         }
         giProject();
      }
   })
};

export function embed(storyName, elementId, earthtimeDomain = EARTHTIME_DOMAIN) {
   console.log("Will embed story [" + storyName + "] into element [" + elementId + "]");

   const loadStoryProcessor = function(){
      dynamicallyLoadScript(earthtimeDomain + '/m/stories/mobile-story.js', function(url) {
         console.log("Done loading [" + url + "], now loading the story...");
         loadStory('#' + storyName);
      });
   };

   let numLoaded = 0;
   const onDependenciesLoaded = function(url) {
      numLoaded++;
      console.log("Done loading [" + url + "] (loaded " + numLoaded + "/" + scriptDependencies.length + ")");

      if (numLoaded === scriptDependencies.length) {
         loadStoryProcessor();
      }
   };

   insertHandlebarsTemplates();

   insertHtml(elementId, earthtimeDomain);

   scriptDependencies.forEach(function(scriptUrl) {
      dynamicallyLoadScript(earthtimeDomain + scriptUrl, onDependenciesLoaded)
   });
}
