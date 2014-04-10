/*
  require.config({
    baseUrl: window.location.pathname.split("/").slice(0, -3).concat(["js"]).join("/"),
    paths: {
      "heatmap": window.location.pathname.split("/").slice(0, -1).concat(["js"]).join("/"),
    }
  });
*/

var jsdir = window.location.pathname.split("/").slice(0, -3).concat(["js"]);
require.config({
  baseUrl: jsdir.concat(["app"]).join("/"),

  paths: {
    'less': jsdir.concat(['libs', 'less-1.6.2.min']).join('/'),
    'bootstrap': jsdir.concat(['libs', 'bootstrap.min']).join('/'),
    'jQuery': jsdir.concat(['libs', 'jquery-1.10.2.min']).join('/'),
    'CanvasLayer': jsdir.concat(['libs', 'CanvasLayer']).join('/'),
    'Stats': jsdir.concat(['libs', 'stats.min']).join('/'),
    'async': jsdir.concat(['libs', 'async']).join('/'),

    // AMD modules
    'stacktrace': jsdir.concat(['libs', 'stacktrace']).join('/'),
  },

  shim: {
    'jQuery': {exports: 'jQuery'},
    'bootstrap': {deps: ['jQuery']},
    'less': {exports: 'less'},
    'CanvasLayer': {exports: 'CanvasLayer'},
    'Stats': {exports: 'Stats'},
    'async': {exports: 'async'}
  }
});

require(['Visualization/Visualization', 'jQuery', "bootstrap", "less", "LangExtensions"], function (Visualization, $) {
  $(document).ready(function () {
    visualization = new Visualization();
  });
});
