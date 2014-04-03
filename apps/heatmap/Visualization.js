Visualization = Class({
  params_defaults: {
    zoom: "4",
    lat: "39.3",
    lon: "-95.8",
    length: "80000",
    offset: "15",
    maxoffset: "29",
    animations: "point",
  },

  precisions: {
    lat: 100000,
    lon: 100000
  },

  state_defaults: {
    timeresolution: 60*60*24
  },

  initialize: function () {
    var visualization = this;

    visualization.params = new Parameters(visualization.params_defaults, visualization.precisions);
    visualization.state = new Values(visualization.state_defaults);

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
