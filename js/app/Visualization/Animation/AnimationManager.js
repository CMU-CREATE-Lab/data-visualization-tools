define(["app/Class", "app/Events", "app/Bounds", "async", "app/Logging", "jQuery", "app/Visualization/Matrix", "CanvasLayer", "Stats", "app/Visualization/Animation/Animation", "app/Visualization/Animation/PointAnimation", "app/Visualization/Animation/LineAnimation", "app/Visualization/Animation/TileAnimation", "app/Visualization/Animation/DebugAnimation", "app/Visualization/Animation/ArrowAnimation", "app/Visualization/Animation/MapsEngineAnimation"], function(Class, Events, Bounds, async, Logging, $, Matrix, CanvasLayer, Stats, Animation) {
  return Class({
    name: "AnimationManager",

    mapOptions: {
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: 'poi',
          stylers: [{visibility: 'off'}]
        }
      ]
    },

    initialize: function (visualization) {
      var self = this;

      self.events = new Events("AnimationManager");

      self.visualization = visualization;
      self.indrag = false;
      self.inPanZoom = false;
    },

    init: function (cb) {
      var self = this;

      self.animations = [];
      self.updateNeeded = false;
      self.lastUpdate = undefined;
      self.map = undefined;
      self.canvasLayer = undefined;
      self.gl = undefined;
      self.pixelsToWebGLMatrix = new Float32Array(16);
      self.mapMatrix = new Float32Array(16);

      async.series([
        self.initMap.bind(self),
        self.initOverlay.bind(self),
        self.initCanvas.bind(self),
        self.initStats.bind(self),
        self.initMouse.bind(self),
        self.initUpdates.bind(self)
      ], cb);
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

      var mapDiv = document.getElementById('map-div');
      self.map = new google.maps.Map(
        mapDiv,
        $.extend(
          {
            zoom: 1,
            center: {lat: 0, lng: 0}
          },
          self.mapOptions
        )
      );

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
        self.canvasResize();
        cb();
      }
    },

    initMouse: function(cb) {
      var self = this;

      var handleMouse = function (e, type) {
        var offset = $('#map-div').offset();

        for (var key in self.animations) {
          var animation = self.animations[key];
          if (animation.select(e.pageX - offset.left, e.pageY - offset.top, type, true)) {
            return animation.data_view;
          }
        }
        return false;
      };

      $('#map-div').mousemove(function (e) { handleMouse(e, 'hover'); });
      $('#map-div').click(function (e) { handleMouse(e, 'selected'); });
      google.maps.event.addListener(self.map, "rightclick", function(e) {
        e.pageX = e.pixel.x;
        e.pageY = e.pixel.y;
        var dataView = handleMouse(e, 'info')
        if (dataView) {
          console.log({series:dataView.selections.info.data.series[0]});
          dataView.getSelectionInfo('info', function (err, data) {
            var dialog;
            if (err) {
              dialog = $('<div class="modal fade" id="error" tabindex="-1" role="dialog" aria-labelledby="errorLabel" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"><div class="modal-header bg-danger text-danger"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 class="modal-title" id="errorLabel">Error</h4></div><div class="modal-body alert"></div><div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div></div></div></div>');
              dialog.find('.modal-body').html(err.toString());
            } else {
              dialog = $('<div class="modal fade" id="info" tabindex="-1" role="dialog" aria-labelledby="infoLabel" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"><div class="modal-header bg-success text-success"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 class="modal-title" id="infoLabel">Feature information</h4></div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div></div></div></div>');
              var table = $("<table>");
              for (var key in data) {
                if (typeof(data[key])=="string" && data[key].indexOf("://") != -1) {
                  table.append("<tr><td colsan='2'><a href='" + data[key] +  "'>" + key + "</a></td></tr>");
                } else {
                  table.append("<tr><td>" + key + "</td><td>" + data[key] + "</td></tr>");
                }
              }
              dialog.find('.modal-body').append(table);
            }
            $('body').append(dialog);
            dialog.modal();
            dialog.on('hidden.bs.modal', function (e) {
              dialog.detach();
            });
          });
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          return false;
        }
      });
      cb();
    },

    initUpdates: function (cb) {
      var self = this;

      self.visualization.state.events.on({
        set: self.triggerUpdate,
        lat: self.panZoom,
        lon: self.panZoom,
        zoom: self.panZoom,
        scope: self
      });
      cb();
    },

    addAnimationInstance: function (animationInstance, cb) {
      var self = this;

      animationInstance.addingToManager = true;
      animationInstance.initGl(self.gl, function () { 
        animationInstance.initUpdates(function () {
          if (animationInstance.addingToManager) {
            animationInstance.addingToManager = false;
            self.animations.push(animationInstance);
            self.triggerUpdate();
            self.events.triggerEvent("add", {animation: animationInstance});
          }
          cb(null, animationInstance);
        });
      });
    },

    addAnimation: function (animation, cb) {
      var self = this;
      self.addAnimationInstance(
        new Animation.animationClasses[animation.type](
          self, animation.args
        ),
        cb
      );
    },

    removeAnimation: function (animation) {
      var self = this;
      if (animation.addingToManager) {
        animation.addingToManager = false;
      } else {
        self.animations = self.animations.filter(function (a) { return a !== animation; });
        self.events.triggerEvent("remove", {animation: animation});
        animation.destroy();
        self.triggerUpdate();
      }
    },

    windowSizeChanged: function () {
      var self = this;
      google.maps.event.trigger(self.map, 'resize');
    },

    panZoom: function () {
      var self = this;

      if (!self.inPanZoom) {
        self.map.setCenter({
          lat: self.visualization.state.getValue("lat"),
          lng: self.visualization.state.getValue("lon")
        });
        self.map.setZoom(self.visualization.state.getValue("zoom"));
      }
    },

    centerChanged: function() {
      var self = this;
      self.inPanZoom = true;
      self.visualization.state.setValue("lat", self.map.getCenter().lat());
      self.visualization.state.setValue("lon", self.map.getCenter().lng());
      self.inPanZoom = false;
      self.triggerUpdate();
    },

    zoomChanged: function() {
      var self = this;
      self.inPanZoom = true;
      self.visualization.state.setValue("zoom", self.map.getZoom());
      self.inPanZoom = false;
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
      self.visualization.data.zoomTo(new Bounds(lonmin, latmin, lonmax, latmax));
    },

    canvasResize: function() {
      var self = this;

      if (!self.gl) return;

      var width = self.canvasLayer.canvas.width;
      var height = self.canvasLayer.canvas.height;

      self.gl.viewport(0, 0, width, height);

      // matrix which maps pixel coordinates to WebGL coordinates
      self.pixelsToWebGLMatrix.set([2/width, 0, 0, 0, 0, -2/height, 0, 0,
          0, 0, 0, 0, -1, 1, 0, 1]);

      self.updateNeeded = true;
    },

    updateTime: function (header, paused) {
      var self = this;

      self.stats.begin();

      if (paused) {
        self.lastUpdate = undefined;
      } else {
        var timeExtent = self.visualization.state.getValue("timeExtent");
        var time = self.visualization.state.getValue("time").getTime();
        var min = header.colsByName.datetime.min;
        var max = header.colsByName.datetime.max;
        var timeNow = new Date().getTime();
        var timePerTimeExtent = self.visualization.state.getValue("length");

        var timePerAnimationTime = timePerTimeExtent / timeExtent;

        if (self.lastUpdate != undefined) {
          var time = (timeNow - self.lastUpdate) / timePerAnimationTime + time;
          self.visualization.state.setValue("time", new Date(time));
        }
        self.lastUpdate = timeNow;
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

      if (!self.gl) return;

      self.visualization.data.useHeader(function (header, cb) {
        var time = self.visualization.state.getValue("time");
        var paused = self.visualization.state.getValue("paused");
        if (!header.colsByName.datetime) paused = true;
        if (!paused) {
          var min = header.colsByName.datetime.min;
          var max = header.colsByName.datetime.max;
          if (time < min || time > max) paused = true;
        }

        if (!self.updateNeeded && paused) {
          return;
        }
        self.updateNeeded = false;

        self.updateTime(header, paused);
        self.updateProjection();

        self.gl.clear(self.gl.COLOR_BUFFER_BIT);

        Logging.default.log("Visualization.Animation.AnimationManager.update", {
          toString: function () {
            return (this.time != undefined ? this.time.rfcstring(" ") : "undefined")
              + " [" + (this.timeExtent != undefined ? this.timeExtent.toString() : "undefined") + "]";
          },
          timeExtent: self.visualization.state.getValue("timeExtent"),
          time: time
        });

        self.animations.map(function (animation) { animation.draw(); });

        self.stats.end();
      });
    },

    triggerUpdate: function (e) {
      var self = this;

      Logging.default.log("Visualization.Animation.AnimationManager.triggerUpdate", {msg: "Trigger update"});

      self.updateNeeded = true;
    },

    setMapOptions: function (options) {
      var self = this;

      options = $.extend({}, options);
      delete options.zoom;
      delete options.center;

      self.mapOptions = options;
      self.map.setOptions(options);
    },

    load: function (animations, cb) {
      var self = this;
      self.animations.map(function (animation) {
        self.events.triggerEvent("remove", {animation: animation});
        animation.destroy();
      });
      self.animations = [];

      if (animations.options) {
        self.setMapOptions(animations.options);
      }

      async.map(animations.animations, self.addAnimation.bind(self), cb || function () {});
    },

    toJSON: function () {
      var self = this;

      return {animations:self.animations, options:self.mapOptions};
    }
  });
});
