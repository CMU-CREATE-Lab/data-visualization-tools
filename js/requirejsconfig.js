var jsdir = window.location.pathname.split("/").slice(0, -3).concat(["js"]);
require.config({
  baseUrl: jsdir.join("/"),

  paths: {
    'less': jsdir.concat(['libs', 'less-1.6.2.min']).join('/'),
    'bootstrap': jsdir.concat(['libs', 'bootstrap.min']).join('/'),
    'jQuery': jsdir.concat(['libs', 'jquery-1.10.2.min']).join('/'),
    'CanvasLayer': jsdir.concat(['libs', 'CanvasLayer']).join('/'),
    'Stats': jsdir.concat(['libs', 'stats.min']).join('/'),
    'async': jsdir.concat(['libs', 'async']).join('/'),
    'QUnit': jsdir.concat(['libs', 'qunit-1.14.0']).join('/'),

    // AMD modules
    'stacktrace': jsdir.concat(['libs', 'stacktrace']).join('/'),

    'app': jsdir.concat(['app']).join('/'),
  },

  shim: {
    'jQuery': {exports: 'jQuery'},
    'bootstrap': {deps: ['jQuery']},
    'less': {exports: 'less'},
    'CanvasLayer': {exports: 'CanvasLayer'},
    'Stats': {exports: 'Stats'},
    'async': {exports: 'async'},
    'QUnit': {exports: 'QUnit'}
  }
});
