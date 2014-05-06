pagePath = window.location.pathname.split("/").slice(0, -1);
pageDir = pagePath.join("/");
scriptPath = document.querySelector('script[src$="deps.js"]').getAttribute('src').split("/").slice(0, -1);
if (scriptPath[0] != "") {
  scriptPath = pagePath.concat(scriptPath);
}
scriptDir = scriptPath.join("/");
shimPath = scriptPath.concat("shims");
shimDir = shimPath.join('/');
libPath = scriptPath.concat(['libs']);
libDir = libPath.join('/');
appPath = scriptPath.concat(['app']);
appDir = appPath.join('/');

dependencies = {
  stylesheets: [
    libDir + "/bootstrap.min.css",
    libDir + "/font-awesome-4.0.3/css/font-awesome.min.css",
    libDir + "/qunit-1.14.0.css",
    libDir + "/dojo-release-1.9.3/dijit/themes/claro/claro.css",

    libDir + "/dojo-release-1.9.3/dojox/layout/resources/FloatingPane.css",
    libDir + "/dojo-release-1.9.3/dojox/layout/resources/ResizeHandle.css",

    {url: scriptDir + "/../style.less", rel:"stylesheet/less"}
  ],
  scripts: [
    {url: "http://maps.googleapis.com/maps/api/js?sensor=false&callback=googleMapsLoaded", handleCb: function (tag, cb) { googleMapsLoaded = cb; }},
    libDir + "/jquery-1.10.2.min.js",
    libDir + "/less-1.6.2.min.js",
    libDir + "/bootstrap.min.js",
    libDir + "/CanvasLayer.js",
    libDir + "/stats.min.js",
    libDir + "/qunit-1.14.0.js",
    libDir + "/async.js",
    libDir + "/stacktrace.js",
  ]
};

packages = [
  {name: 'bootstrap', location: shimDir, main: 'bootstrap'},
  {name: 'CanvasLayer', location: shimDir, main: 'CanvasLayer'},
  {name: 'Stats', location: shimDir, main: 'Stats'},
  {name: 'QUnit', location: shimDir, main: 'QUnit'},
  {name: 'jQuery', location: shimDir, main: 'jQuery'},
  {name: 'less', location: shimDir, main: 'less'},
  {name: 'async', location: shimDir, main: 'async'},
  {name: 'stacktrace', location: shimDir, main: 'stacktrace'},
  {name: 'app', location:appDir, main: 'app'}
]

if (useDojo) {
  dependencies.scripts.push(scriptDir + "/dojoconfig.js");
  dependencies.scripts.push(libDir + "/dojo-release-1.9.3/dojo/dojo.js");
} else {
  dependencies.scripts.push(libDir + "/require.js");
  dependencies.scripts.push(scriptDir + "/requirejsconfig.js");
}


/* Code to load the above dependencies */

function asyncmap (lst, fn, cb) {
  var res = [];
  var asyncmap = function (lst, fn, i) {
    if (i >= lst.length) {
      cb(null, res);
    } else {
      fn(lst[i], function (err, value) {
        if (err) {
          cb(err);
        } else {
          res.push(value);
          asyncmap(lst, fn, i+1);
        }
      });
    }
  }
  asyncmap(lst, fn, 0);
}

function addHeadScript(script, cb) {
  if (typeof(script) == "string") script = {url: script};
  var head = document.getElementsByTagName('head')[0];
  var tag = document.createElement('script');
  tag.type = script.type || 'text/javascript';
  tag.src = script.url;
  if (script.handleCb) {
    script.handleCb(tag, cb);
  } else {
    tag.onload = function () { cb(); };
  }
  head.appendChild(tag);
}

function addHeadStylesheet(stylesheet) {
  if (typeof(stylesheet) == "string") stylesheet = {url: stylesheet};
  var head = document.getElementsByTagName('head')[0];
  var link = document.createElement('link');
  link.rel = stylesheet.rel || 'stylesheet';
  link.type = stylesheet.type || 'text/css';
  link.href = stylesheet.url;
  head.appendChild(link);
}

dependencies.stylesheets.map(addHeadStylesheet);
asyncmap(dependencies.scripts, addHeadScript, appmain);
