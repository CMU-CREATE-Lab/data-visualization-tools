function Visualization() {
}
Visualization.prototype.defaults = {
  zoom: "4",
  lat: "39.3",
  lon: "-95.8",
  length: "80000",
  offset: "15",
  maxoffset: "29",
  animations: "point",
  timeresolution: 60*60*24
}
Visualization.prototype.resize = function() {
  var visualization = this;

  var width = visualization.canvasLayer.canvas.width;
  var height = visualization.canvasLayer.canvas.height;

  visualization.gl.viewport(0, 0, width, height);

  // matrix which maps pixel coordinates to WebGL coordinates
  visualization.pixelsToWebGLMatrix.set([2/width, 0, 0, 0, 0, -2/height, 0, 0,
      0, 0, 0, 0, -1, 1, 0, 1]);
}
Visualization.prototype.update = function() {
  var visualization = this;

  var daySlider = $('#day-slider')
  var min = parseFloat(daySlider.attr("data-min"));
  var max = parseFloat(daySlider.attr("data-max"));
  var fraction;

  if (!visualization.dataLoaded) return;

  visualization.stats.begin();

  if (!visualization.dataLoadedUntilTimeToSet || visualization.manualTimeslide || visualization.paused) {
    visualization.totalElapsedTime = undefined;
  } else if (!visualization.manualTimeslide && !visualization.paused) {
    var timeNow = new Date().getTime();
    if (visualization.totalElapsedTime == undefined) {
      visualization.current_time = daySlider.val();
      fraction = (visualization.current_time - min) / (max - min);
      visualization.totalElapsedTime = fraction * visualization.totalTime;
      visualization.elapsedTimeFromChange = 0;
    } else if (visualization.lastTime != 0) {
      var elapsed = timeNow - visualization.lastTime;
      visualization.totalElapsedTime += elapsed;
      visualization.elapsedTimeFromChange += elapsed;
    }
    visualization.lastTime = timeNow;

    if (visualization.elapsedTimeFromChange > 100) {
      visualization.elapsedTimeFromChange = 0;
      fraction = (visualization.totalElapsedTime / visualization.totalTime) % 1;
      visualization.current_time = Math.floor(min + (max - min)  * fraction);

      daySlider.val(visualization.current_time);
      daySlider.trigger("change");
    }
  }

  /**
   * We need to create a transformation that takes world coordinate
   * points in the pointArrayBuffer to the coodinates WebGL expects.
   * 1. Start with second half in pixelsToWebGLMatrix, which takes pixel
   *     coordinates to WebGL coordinates.
   * 2. Scale and translate to take world coordinates to pixel coords
   * see https://developers.google.com/maps/documentation/javascript/maptypes#MapCoordinate
   */

  var mapProjection = visualization.map.getProjection();

  // copy pixel->webgl matrix
  visualization.mapMatrix.set(visualization.pixelsToWebGLMatrix);

  var scale = visualization.canvasLayer.getMapScale();
  scaleMatrix(visualization.mapMatrix, scale, scale);

  var translation = visualization.canvasLayer.getMapTranslation();
  translateMatrix(visualization.mapMatrix, translation.x, translation.y);


  visualization.gl.clear(visualization.gl.COLOR_BUFFER_BIT);
  visualization.animations.map(function (animation) { animation.draw(); });

  visualization.stats.end();
}
Visualization.prototype.loadData = function(source, headerloaded) {
  var visualization = this;

  var row_count;
  var timeToSet;

  loadTypedMatrix({
    url: source,
    header: function (data) {
      visualization.header = data;
      row_count = 0;
      
      visualization.animations.map(function (animation) { animation.header(visualization.header); });

      // Set default values for parameters from file header config
      if (visualization.header.options) {
        for (var key in visualization.header.options) {
          var val = visualization.header.options[key];
          if (getParameter(key) == "") {
            setParameter(key, val.toString());
          }
        }
      }

      timeToSet = getParameter("time") || undefined;
      if (timeToSet) {
        timeToSet = new Date(timeToSet);
      } else {
        visualization.dataLoadedUntilTimeToSet = true;
      }

      headerloaded && headerloaded();
    },
    row: function (data) {
      visualization.animations.map(function (animation) { animation.row(row_count, data); });
      row_count++;
    },
    batch: function () {
      visualization.glInitialized.wait(function (cb) {
        visualization.animations.map(function (animation) { animation.batch(); });

        visualization.dataLoaded = true;
        $("#loading .message").hide();
        $("#loading").css({
          bottom: "auto",
          left: "auto"
        });
        $("#loading").animate({
          width: "80px",
          right: "5px",
          top: "30px"
        }, 500);
        document.getElementById('loading').className = "done";
        $('#day-slider').attr({"data-min": visualization.header.colsByName.datetime.min, "data-max": visualization.header.colsByName.datetime.max});
        if (timeToSet && new Date(visualization.header.colsByName.datetime.max * 1000) > timeToSet) {
          visualization.dataLoadedUntilTimeToSet = true;
          $("#day-slider").val((timeToSet.getTime() / 1000).toString());
        }
        $('#day-slider').trigger("change");
      });
    },
    done: function () {
      $("#loading").hide();
    },
    error: function (exception) {
      throw exception;
    },
  });
}
Visualization.prototype.initData = function(cb) {
  var visualization = this;

  // Start loading data, and continue initializing as soon as we have loaded the header...
  visualization.loadData(getParameter("source"), cb);
}
Visualization.prototype.initLogo = function(cb) {
  var visualization = this;

  var logo_img = getParameter("logoimg");
  var logo_url = getParameter("logourl");

  if (logo_img) {
    var logo = $("<a class='logo'><img></a>");
    logo.find("img").attr({src:logo_img});
    logo.attr({href:logo_url});
    $("body").append(logo);
  }
  cb();
}
Visualization.prototype.initAnimationSliders = function(cb) {
  var visualization = this;

  $(".control").slider();

  var daySlider = $('#day-slider');
  var offsetSlider = $('#offset-slider');

  daySlider.attr({"data-step": (visualization.header.timeresolution || visualization.defaults.timeresolution).toString()});

  $("#animate-button input").change(function () {
    visualization.paused = $("#animate-button input").val() == "true";
    if (visualization.paused) {
      if (visualization.dataLoadedUntilTimeToSet) {
        setParameter("time", new Date(parseInt(daySlider.val()) * 1000).rfcstring());
      }
      setParameter("paused", "true");
    } else {
      setParameter("paused");
    }
  });

  daySlider.change(function(event) {
    visualization.current_time = parseInt(this.value);
    var date = new Date(visualization.current_time * 1000);
    // setParameter("time", date.rfcstring());
    $('#current-date').html(date.rfcstring(" "));
  });

  var handle = daySlider.parent(".control").find(".handle");
  handle.mousedown(function(event) {
    visualization.manualTimeslide = true;
  });

  handle.mouseup(function(event) {
    visualization.manualTimeslide = false;
  });

  offsetSlider.change(function(event) {
    visualization.currentOffset = parseInt(this.value);
    setParameter("offset", visualization.currentOffset.toString());
    $('#current-offset').html(visualization.currentOffset.toString() + " days");

    var limitedOffset = Math.min(visualization.currentOffset, (visualization.header.colsByName.datetime.max - visualization.header.colsByName.datetime.min) / (24 * 60 * 60));
    daySlider.attr({"data-min": visualization.header.colsByName.datetime.min + limitedOffset * 24 * 60 * 60});
    if (visualization.current_time < visualization.header.colsByName.datetime.min + limitedOffset * 24 * 60 * 60) {
      visualization.current_time = limitedOffset;
      daySlider.val(visualization.current_time.toString());
    }
    daySlider.trigger("change");
  });
  cb();
}
Visualization.prototype.initAnimation = function (cb) {
  var visualization = this;

  $("#animate-button input").val(getParameter("paused") == "true" ? "true" : "false");
  $("#animate-button input").trigger("change");

  var zoom = parseInt(getParameter("zoom") || visualization.defaults.zoom);
  var lat = parseFloat(getParameter("lat") || visualization.defaults.lat);
  var lon = parseFloat(getParameter("lon") || visualization.defaults.lon);

  visualization.totalTime = parseFloat(getParameter("length") || visualization.defaults.length);
  $("#offset-slider").val(parseFloat(getParameter("offset") || visualization.defaults.offset));
  $("#offset-slider").attr({"data-max": parseFloat(getParameter("maxoffset") || visualization.defaults.maxoffset)});
  $("#offset-slider").trigger("change");

  // initialize the map
  var mapOptions = {
    zoom: zoom,
    center: new google.maps.LatLng(lat, lon),
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
  visualization.map = new google.maps.Map(mapDiv, mapOptions);

  if (getParameter("overlay")) {
    var kmlLayer = new google.maps.KmlLayer({url: getParameter("overlay"), preserveViewport: true});
    kmlLayer.setMap(visualization.map);
  }

  // initialize the canvasLayer
  var canvasLayerOptions = {
    map: visualization.map,
    resizeHandler: function () { visualization.resize() },
    animate: true,
    updateHandler: function () { visualization.update(); }
  };
  visualization.canvasLayer = new CanvasLayer(canvasLayerOptions);

  window.addEventListener('resize', function () {  google.maps.event.trigger(visualization.map, 'resize') }, false);

  google.maps.event.addListener(visualization.map, 'center_changed', function() {
    setParameter("lat", visualization.map.getCenter().lat().toString());
    setParameter("lon", visualization.map.getCenter().lng().toString());
  });
  google.maps.event.addListener(visualization.map, 'zoom_changed', function() {
    setParameter("zoom", visualization.map.getZoom().toString());
  });

  // initialize WebGL
  visualization.gl = visualization.canvasLayer.canvas.getContext('experimental-webgl');
  if (!visualization.gl) {
    var failover = getParameter('nowebgl');
    if (failover) {
      window.location = failover;
    } else {
      $("#loading td").html("<div style='color: red;'><div>Loading failed:</div><div>Your browser does not support WebGL.</div></div>");
    }
    return;
  }
  visualization.gl.enable(visualization.gl.BLEND);
  visualization.gl.blendFunc(visualization.gl.SRC_ALPHA, visualization.gl.ONE);

  async.map(
    visualization.animations,
    function (animation, cb) { animation.initGl(visualization.gl, cb); },
    function(err, results){
      if (getParameter("stats") == 'true') {
        document.body.appendChild(stats.domElement);
      }
      visualization.glInitialized.set();
      cb();
    }
  );
}
Visualization.prototype.initToggleButtons = function(cb) {
  var visualization = this;

  $("#animate-button").click(function () {
    val = $("#animate-button input").val() == "true";
    $("#animate-button input").val(val ? "false" : "true");
    $("#animate-button input").trigger("change");
  });
  $("#animate-button input").change(function () {
    if ($("#animate-button input").val() == "true") {
      $("#animate-button").find("i").removeClass("glyphicon-pause").addClass("glyphicon-play");
    } else {
      $("#animate-button").find("i").removeClass("glyphicon-play").addClass("glyphicon-pause");
    }
  });
  cb();
}
Visualization.prototype.init = function () {
  var visualization = this;

  /* bgein stats */
  visualization.stats = new Stats();
  visualization.stats.setMode(0); // 0: fps, 1: ms
  // Align top-left
  visualization.stats.domElement.style.position = 'absolute';
  visualization.stats.domElement.style.left = '0px';
  visualization.stats.domElement.style.top = '0px';
  /* end stats */

  visualization.dataLoaded = false;
  visualization.dataLoadedUntilTimeToSet = false;
  visualization.glInitialized = new Condition();
  visualization.map = undefined;
  visualization.canvasLayer = undefined;
  visualization.gl = undefined;

  visualization.pixelsToWebGLMatrix = new Float32Array(16);
  visualization.mapMatrix = new Float32Array(16);

  visualization.currentOffset = undefined;

  visualization.manualTimeslide = false;
  visualization.paused = true;

  visualization.totalTime = undefined; // In ms

  visualization.lastTime = 0;
  visualization.elapsedTimeFromChange = 0;
  visualization.totalElapsedTime = 0;
  visualization.header = undefined;

  var animationClasses = getParameter("animations") || visualization.defaults.animations;
  animationClasses = animationClasses.split(",").map(
    function (name) { return Animation.animationClasses[name]; }
  );

  visualization.animations = animationClasses.map(function (cls) {
    var animation = new cls();
    animation.init(visualization);
    return animation;
  });

  async.series([
    function (cb) { visualization.initData(cb); },
    function (cb) { visualization.initLogo(cb); },
    function (cb) { visualization.initToggleButtons(cb); },
    function (cb) { visualization.initAnimationSliders(cb); },
    function (cb) { visualization.initAnimation(cb); }
  ]);
}

$(document).ready(function () {
  visualization = new Visualization();
  visualization.init();
});
