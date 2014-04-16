define(["Class", "Bounds", "async", "Logging", "jQuery", "Visualization/Matrix", "CanvasLayer", "Stats", "Visualization/Animation/Animation", "Visualization/Animation/PointAnimation", "Visualization/Animation/LineAnimation" /* , "Visualization/Animation/ArrowAnimation" */], function(Class, Bounds, async, Logging, $, Matrix, CanvasLayer, Stats, Animation) {
  return Class({
    name: "AnimationManager",
    initialize: function (visualization) {
      var self = this;

      self.visualization = visualization;
      self.indrag = false;
      self.glInitialized = false;
    },

    init: function (cb) {
      var self = this;

      self.updateNeeded = false;
      self.lastUpdate = undefined;
      self.map = undefined;
      self.canvasLayer = undefined;
      self.gl = undefined;
      self.pixelsToWebGLMatrix = new Float32Array(16);
      self.mapMatrix = new Float32Array(16);

      async.series([
        self.initAnimations.bind(self),
        self.initMap.bind(self),
        self.initOverlay.bind(self),
        self.initCanvas.bind(self),
        self.initStats.bind(self),
        self.initAnimationsGL.bind(self),
        self.initUpdates.bind(self)
      ], cb);
    },

    initAnimations: function (cb) {
      var self = this;

      var animationClasses = self.visualization.state.getValue("animations").map(
        function (name) { return Animation.animationClasses[name]; }
      );

      self.animations = animationClasses.map(function (cls) {
        return new cls(self);
      });

      cb();
    },

    initStats: function (cb) {
      var self = this;

      /* bgein stats */
      self.stats = new Stats();
      self.stats.setMode(0); // 0: fps, 1: ms
      // Align top-left
      self.stats.domElement.style.position = 'absolute';
      self.stats.domElement.style.left = '0px';
      self.stats.domElement.style.top = '0px';
      /* end stats */

      if (self.visualization.state.getValue("stats") == 'true') {
        document.body.appendChild(self.stats.domElement);
      }

      cb();
    },

    initMap: function (cb) {
      var self = this;

      var mapOptions = {
        zoom: self.visualization.state.getValue("zoom"),
        center: new google.maps.LatLng(
          self.visualization.state.getValue("lat"),
          self.visualization.state.getValue("lon")),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'all',
            stylers: [
              {hue: '#0000b0'},
              {invert_lightness: 'true'},
              {saturation: -30}
            ]
          },
          {
            featureType: 'poi',
            stylers: [{visibility: 'off'}]
          }
        ]
      };
      var mapDiv = document.getElementById('map-div');
      self.map = new google.maps.Map(mapDiv, mapOptions);

      window.addEventListener('resize', self.windowSizeChanged.bind(self), false);
      google.maps.event.addListener(self.map, 'center_changed', self.centerChanged.bind(self));
      google.maps.event.addListener(self.map, 'zoom_changed', self.zoomChanged.bind(self));
      google.maps.event.addListener(self.map, 'bounds_changed', self.boundsChanged.bind(self));
      google.maps.event.addListener(self.map, 'dragstart', function () { self.indrag = true; });
      google.maps.event.addListener(self.map, 'dragend', function () { self.indrag = false; self.boundsChanged(); });

      cb();
    },

    initOverlay: function (cb) {
      var self = this;

      var overlay = self.visualization.state.getValue("overlay")
      if (overlay) {
        var kmlLayer = new google.maps.KmlLayer({url: overlay, preserveViewport: true});
        kmlLayer.setMap(self.map);
      }
      cb();
    },

    initCanvas: function (cb) {
      var self = this;

      var canvasLayerOptions = {
        map: self.map,
        resizeHandler: function () { self.canvasResize() },
        updateHandler: function () { self.update(); },
        animate: true
      };
      self.canvasLayer = new CanvasLayer(canvasLayerOptions);

      self.gl = self.canvasLayer.canvas.getContext('experimental-webgl');
      if (!self.gl) {
        var failover = self.visualization.state.getValue('nowebgl');
        if (failover) {
          window.location = failover;
        } else {
          $("#loading td").html("<div style='color: red;'><div>Loading failed:</div><div>Your browser does not support WebGL.</div></div>");
        }
        cb({msg: "Your browser does not support WebGL."});
      } else {
        self.gl.enable(self.gl.BLEND);
        self.gl.blendFunc(self.gl.SRC_ALPHA, self.gl.ONE);
        cb();
      }
    },


    initAnimationsGL: function (cb) {
      var self = this;
      async.map(
        self.animations,
        function (animation, cb) { animation.initGl(self.gl, cb); },
        function(err, results){
          self.glInitialized = true;
          cb();
        }
      );
    },

    initUpdates: function (cb) {
      var self = this;

      async.map(
        self.animations,
        function (animation, cb) { animation.initUpdates(cb); },
        function(err, results){
          self.visualization.state.events.on({set: self.triggerUpdate, scope: self});
          cb();
        }
      );
    },

    windowSizeChanged: function () {
      var self = this;
      google.maps.event.trigger(self.map, 'resize');
    },

    centerChanged: function() {
      var self = this;
      self.visualization.state.setValue("lat", self.map.getCenter().lat());
      self.visualization.state.setValue("lon", self.map.getCenter().lng());
      self.triggerUpdate();
    },

    zoomChanged: function() {
      var self = this;
      self.visualization.state.setValue("zoom", self.map.getZoom());
      self.triggerUpdate();
    },

    boundsChanged: function() {
      var self = this;
      if (self.indrag) return;
      var bounds = self.map.getBounds();
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();
      var latmin = sw.lat();
      var lonmin = sw.lng();
      var latmax = ne.lat();
      var lonmax = ne.lng();
      self.visualization.data.format.zoomTo(new Bounds(lonmin, latmin, lonmax, latmax));
    },

    canvasResize: function() {
      var self = this;

      var width = self.canvasLayer.canvas.width;
      var height = self.canvasLayer.canvas.height;

      self.gl.viewport(0, 0, width, height);

      // matrix which maps pixel coordinates to WebGL coordinates
      self.pixelsToWebGLMatrix.set([2/width, 0, 0, 0, 0, -2/height, 0, 0,
          0, 0, 0, 0, -1, 1, 0, 1]);

      self.updateNeeded = true;
    },

    updateTime: function (paused) {
      var self = this;

      self.stats.begin();

      if (paused) {
        self.lastUpdate = undefined;
      } else {
        var time = self.visualization.state.getValue("time");
        var min = self.visualization.data.format.header.colsByName.datetime.min;
        var max = self.visualization.data.format.header.colsByName.datetime.max;
        var timeNow = new Date().getTime();

        if (self.lastUpdate == undefined) {
          var fraction = (time - min) / (max - min);
          self.lastUpdate = timeNow - fraction * self.visualization.state.getValue("length");
        } else {
          var fraction = (timeNow - self.lastUpdate) / self.visualization.state.getValue("length");
          var time = (max - min) * fraction + min;
          self.visualization.state.setValue("time", time);
        }
      }
    },

    updateProjection: function () {
      var self = this;

      /**
       * We need to create a transformation that takes world coordinate
       * points in the pointArrayBuffer to the coodinates WebGL expects.
       * 1. Start with second half in pixelsToWebGLMatrix, which takes pixel
       *     coordinates to WebGL coordinates.
       * 2. Scale and translate to take world coordinates to pixel coords
       * see https://developers.google.com/maps/documentation/javascript/maptypes#MapCoordinate
       */

      var mapProjection = self.map.getProjection();

      // copy pixel->webgl matrix
      self.mapMatrix.set(self.pixelsToWebGLMatrix);

      var scale = self.canvasLayer.getMapScale();
      Matrix.scaleMatrix(self.mapMatrix, scale, scale);

      var translation = self.canvasLayer.getMapTranslation();
      Matrix.translateMatrix(self.mapMatrix, translation.x, translation.y);
    },

    update: function() {
      var self = this;

      if (!self.glInitialized) return;

      var time = self.visualization.state.getValue("time");
      var paused = self.visualization.state.getValue("paused");
      if (!self.visualization.data.format.header.colsByName.datetime) paused = true;
      if (!paused) {
        var min = self.visualization.data.format.header.colsByName.datetime.min;
        var max = self.visualization.data.format.header.colsByName.datetime.max;
        if (time < min || time > max) paused = true;
      }

      if (!self.updateNeeded && paused) {
        return;
      }
      self.updateNeeded = false;

      self.updateTime(paused);
      self.updateProjection();

      self.gl.clear(self.gl.COLOR_BUFFER_BIT);

      Logging.default.log("Visualization.Animation.AnimationManager.update", {
        toString: function () {
          return (this.time != undefined ? this.time.rfcstring(" ") : "undefined")
            + " [" + (this.offset != undefined ? this.offset.toString() : "undefined") + "]";
        },
        offset: self.visualization.state.getValue("offset"),
        time: time
      });

      self.animations.map(function (animation) { animation.draw(); });

      self.stats.end();
    },

    triggerUpdate: function (e) {
      var self = this;

      Logging.default.log("Visualization.Animation.AnimationManager.triggerUpdate", {msg: "Trigger update"});

      self.updateNeeded = true;
    }
  });
});
