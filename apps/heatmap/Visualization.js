Visualization = Class({
  paramspec: {
    zoom: {default: 4, fromurl: Parameters.intFromUrl, tourl: Parameters.intToUrl, urlname: "zoom"},
    lat: {default: 39.3, fromurl: Parameters.floatFromUrl, tourl: Parameters.floatToUrl, precision: 100000, urlname: "lat"},
    lon: {default: -95.8, fromurl: Parameters.floatFromUrl, tourl: Parameters.floatToUrl, precision: 100000, urlname: "lon"},
    length: {default: 80000, fromurl: Parameters.intFromUrl, tourl: Parameters.intToUrl, urlname: "length"},
    offset: {default: 15, fromurl: Parameters.floatFromUrl, tourl: Parameters.floatToUrl, precision: 1000, urlname: "offset"},
    maxoffset: {default: 29, fromurl: Parameters.floatFromUrl, tourl: Parameters.floatToUrl, precision: 1000, urlname: "offset"},
    animations: {default: ["point"], fromurl: Parameters.stringArrayFromUrl, tourl: Parameters.stringArrayToUrl, urlname: "animations"},
    source: {urlname: "source"},
    nowebgl: {urlname: "nowebgl"},

    timeresolution: {default: 60*60*24}
  },

  initialize: function () {
    var visualization = this;

    visualization.state = new Values(visualization.paramspec);
    visualization.params = new Parameters(visualization.state, visualization.paramspec);

    visualization.tiles = new TileManager(getParameter("source"));
    visualization.animations = new AnimationManager();
    visualization.ui = new VisualizationUI();

    async.series([
      // function (cb) { visualization.tiles.init(cb); },
      function (cb) { visualization.ui.init(visualization, cb); },
      function (cb) { visualization.animations.init(visualization, cb); },
    ]);
  }
});

$(document).ready(function () {
  visualization = new Visualization();
});
