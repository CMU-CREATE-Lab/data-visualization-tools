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
    var self = this;

    self.state = new Values(self.paramspec);
    self.params = new Parameters(self.state, self.paramspec);

    self.tiles = new TileManager(getParameter("source"));
    self.animations = new AnimationManager(self);
    self.ui = new VisualizationUI(self);

    async.series([
      // self.tiles.init.bind(self.tiles),
      self.ui.init.bind(self.ui),
      self.animations.init.bind(self.animations)
    ]);
  }
});

$(document).ready(function () {
  visualization = new Visualization();
});
