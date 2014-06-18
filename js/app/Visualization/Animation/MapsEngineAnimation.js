define(["require", "app/Class", "app/Visualization/GeoProjection", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var MapsEngineAnimation = Class(Animation, {
    name: "MapsEngineAnimation",

    columns: {},
    programSpecs: {},
    transforms: {},

    initialize: function(manager, args) {
      var self = this;

      if (args) $.extend(self, args);
      self.manager = manager;
    },

    destroy: function () {
      var self = this;
      self.layer.setMap(null);
      // FIXME: DO we need to call destroy or something like that on self.layer?
    },

    initGl: function(gl, cb) {
      var self = this;

      self.layer = new google.maps.visualization.DynamicMapsEngineLayer({
        layerId: self.source.args.url,
        map: self.manager.map
      });

      cb();
    },

    initUpdates: function(cb) { cb(); },

      draw: function () {},


    select: function (x, y, type, replace) {},

    toJSON: function () {
      var self = this;
      return {
        args: {source: self.source},
        type: self.name
      };
    }
  });
  Animation.animationClasses.MapsEngineAnimation = MapsEngineAnimation;

  return MapsEngineAnimation;
});
