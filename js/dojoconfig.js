var appdir = window.location.pathname.split('/').slice(0, -1);
var jsdir = appdir.slice(0, -2).concat(['js']);
var shimdir = jsdir.concat("shims").join('/');
var libdir = jsdir.concat(['libs']).join('/');
var dojoConfig = {
  isDebug: true,
  async: true,
  baseUrl: jsdir.concat(['libs', 'dojo-release-1.9.3', 'dojo', '']).join('/'),
  packages: [
    {name: 'libs', location: libdir},
    {name: 'bootstrap', location: shimdir, main: 'bootstrap'},
    {name: 'CanvasLayer', location: shimdir, main: 'CanvasLayer'},
    {name: 'Stats', location: shimdir, main: 'Stats'},
    {name: 'QUnit', location: shimdir, main: 'QUnit'},
    {name: 'jQuery', location: shimdir, main: 'jQuery'},
    {name: 'less', location: shimdir, main: 'less'},
    {name: 'async', location: shimdir, main: 'async'},
    {name: 'stacktrace', location: shimdir, main: 'stacktrace'},

    // AMD modules

    {name: 'app', location:jsdir.concat(['app']).join('/'), main: 'app'}
  ]
};
