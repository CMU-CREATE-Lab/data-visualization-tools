app.paths = app.paths || {};
app.paths.page = window.location.pathname.split("/").slice(0, -1);
app.paths.script = document.querySelector('script[src$="deps.js"]').getAttribute('src').split("/").slice(0, -1);
if (app.paths.script[0] != "") {
  app.paths.script = app.paths.page.concat(app.paths.script);
}

app.paths.shim = app.paths.script.concat("shims");
app.paths.lib = app.paths.script.concat(['libs']);
app.paths.app = app.paths.script.concat(['app']);

app.dirs = app.dirs || {};
for (var name in app.paths) {
  app.dirs[name] = app.paths[name].join("/");
}

app.dependencies = app.dependencies || {};
app.dependencies.stylesheets = app.dependencies.stylesheets || [];
app.dependencies.stylesheets = app.dependencies.stylesheets.concat([
  app.dirs.lib + "/bootstrap.min.css",
  app.dirs.lib + "/font-awesome-4.0.3/css/font-awesome.min.css",
  app.dirs.lib + "/qunit-1.14.0.css",
  app.dirs.lib + "/dojo-release-1.9.3/dijit/themes/claro/claro.css",

  app.dirs.lib + "/dojo-release-1.9.3/dojox/layout/resources/FloatingPane.css",
  app.dirs.lib + "/dojo-release-1.9.3/dojox/layout/resources/ResizeHandle.css",

  {url: app.dirs.script + "/../style.less", rel:"stylesheet/less"}
]);
app.dependencies.scripts = app.dependencies.scripts || [];
app.dependencies.scripts = app.dependencies.scripts.concat([
  {url: "http://maps.googleapis.com/maps/api/js?sensor=false&callback=googleMapsLoaded", handleCb: function (tag, cb) { googleMapsLoaded = cb; }},
  app.dirs.lib + "/jquery-1.10.2.min.js",
  app.dirs.lib + "/less-1.6.2.min.js",
  app.dirs.lib + "/bootstrap.min.js",
  app.dirs.lib + "/CanvasLayer.js",
  app.dirs.lib + "/stats.min.js",
  app.dirs.lib + "/qunit-1.14.0.js",
  app.dirs.lib + "/async.js",
  app.dirs.lib + "/stacktrace.js",
]);

app.packages = app.packages || [];
app.packages = app.packages.concat([
  {name: 'bootstrap', location: app.dirs.shim, main: 'bootstrap'},
  {name: 'CanvasLayer', location: app.dirs.shim, main: 'CanvasLayer'},
  {name: 'Stats', location: app.dirs.shim, main: 'Stats'},
  {name: 'QUnit', location: app.dirs.shim, main: 'QUnit'},
  {name: 'jQuery', location: app.dirs.shim, main: 'jQuery'},
  {name: 'less', location: app.dirs.shim, main: 'less'},
  {name: 'async', location: app.dirs.shim, main: 'async'},
  {name: 'stacktrace', location: app.dirs.shim, main: 'stacktrace'},
  {name: 'app', location:app.dirs.app, main: 'app'}
]);

if (app.useDojo) {
  app.dependencies.scripts.push(app.dirs.script + "/dojoconfig.js");
  app.dependencies.scripts.push(app.dirs.lib + "/dojo-release-1.9.3/dojo/dojo.js");
} else {
  app.dependencies.scripts.push(app.dirs.lib + "/require.js");
  app.dependencies.scripts.push(app.dirs.script + "/requirejsconfig.js");
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

app.dependencies.stylesheets.map(addHeadStylesheet);
asyncmap(app.dependencies.scripts, addHeadScript, app.main);
