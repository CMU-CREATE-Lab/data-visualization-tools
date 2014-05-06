scriptRoot = document.querySelector('script[src$="deps.js"]').getAttribute('src').split("/").slice(0, -1).join("/");

dependencies = {
  stylesheets: [
    scriptRoot + "/libs/bootstrap.min.css",
    scriptRoot + "/libs/font-awesome-4.0.3/css/font-awesome.min.css",
    scriptRoot + "/libs/qunit-1.14.0.css",
    scriptRoot + "/libs/dojo-release-1.9.3/dijit/themes/claro/claro.css",

    scriptRoot + "/libs/dojo-release-1.9.3/dojox/layout/resources/FloatingPane.css",
    scriptRoot + "/libs/dojo-release-1.9.3/dojox/layout/resources/ResizeHandle.css",

    {url: scriptRoot + "/../style.less", rel:"stylesheet/less"}
  ],
  scripts: [
    {url: "http://maps.googleapis.com/maps/api/js?sensor=false&callback=googleMapsLoaded", handleCb: function (tag, cb) { googleMapsLoaded = cb; }},
    scriptRoot + "/libs/jquery-1.10.2.min.js",
    scriptRoot + "/libs/less-1.6.2.min.js",
    scriptRoot + "/libs/bootstrap.min.js",
    scriptRoot + "/libs/CanvasLayer.js",
    scriptRoot + "/libs/stats.min.js",
    scriptRoot + "/libs/qunit-1.14.0.js",
    scriptRoot + "/libs/async.js",
    scriptRoot + "/libs/stacktrace.js",
  ]
};

if (useDojo) {
  dependencies.scripts.push(scriptRoot + "/dojoconfig.js");
  dependencies.scripts.push(scriptRoot + "/libs/dojo-release-1.9.3/dojo/dojo.js");
} else {
  dependencies.scripts.push(scriptRoot + "/libs/require.js");
  dependencies.scripts.push(scriptRoot + "/requirejsconfig.js");
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
