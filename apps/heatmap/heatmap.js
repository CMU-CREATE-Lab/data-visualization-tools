var magnitudeScale = 8;

function Animation () {
}
Animation.prototype.init = function(visualization) {
  var animation = this;
  animation.visualization = visualization;
}
Animation.prototype.initGl = function(gl, cb) {
  var animation = this;
  animation.gl = gl;
  createShaderProgramFromUrl(animation.gl, "vertexshader.shader", "fragmentshader.shader", function (program) {
    animation.program = program;

    animation.pointArrayBuffer = animation.gl.createBuffer();
    animation.colorArrayBuffer = animation.gl.createBuffer();
    animation.magnitudeArrayBuffer = animation.gl.createBuffer();
    animation.timeArrayBuffer = animation.gl.createBuffer();

    cb();
  });
}
Animation.prototype.header = function(header) {
  var animation = this;
  animation.series_count = 0;
  // For convenience we store POINT_COUNT in an element at the end
  // of the array, so that the length of each series is
  // rawSeries[i+1]-rawSeries[i].      
  animation.rawSeries = new Int32Array((header.series || 1) + 1);
  animation.rawSeries[0] = 0;
  animation.rawLatLonData = new Float32Array(header.length*2);
  animation.rawColorData = new Float32Array(header.length*4);
  animation.rawMagnitudeData = new Float32Array(header.length);
  animation.rawTimeData = new Float32Array(header.length);
  animation.lastSeries = function () {}; // Value we will never find in the data
}
Animation.prototype.row = function(rowidx, data) {
  var animation = this;
  if (animation.lastSeries != data.series) {
    animation.series_count++;
    animation.lastSeries = data.series;
  }

  var pixel = LatLongToPixelXY(data.latitude, data.longitude);
  animation.rawLatLonData[2*rowidx] = pixel.x;
  animation.rawLatLonData[2*rowidx+1] = pixel.y;

  if (   data.red != undefined
      && data.green != undefined
      && data.blue != undefined) {
    animation.rawColorData[4*rowidx + 0] = data.red / 256;
    animation.rawColorData[4*rowidx + 1] = data.green / 256;
    animation.rawColorData[4*rowidx + 2] = data.blue / 256;
  } else {
    animation.rawColorData[4*rowidx + 0] = 0.82
    animation.rawColorData[4*rowidx + 1] = 0.22;
    animation.rawColorData[4*rowidx + 2] = 0.07;
  }
  if (data.alpha != undefined) {
    animation.rawColorData[4*rowidx + 3] = data.alpha / 256;
  } else {
    animation.rawColorData[4*rowidx + 3] = 1;
  }

  if (data.magnitude != undefined) {
      animation.rawMagnitudeData[rowidx] = 1 + magnitudeScale * data.magnitude / 256;
  } else {
    animation.rawMagnitudeData[rowidx] = 1;
  }

  animation.rawTimeData[rowidx] = data.datetime;

  animation.rawSeries[animation.series_count] = rowidx + 1;
}
Animation.prototype.batch = function() {
  var animation = this;
  programLoadArray(animation.gl, animation.pointArrayBuffer, animation.rawLatLonData, animation.program, "worldCoord", 2, animation.gl.FLOAT);
  programLoadArray(animation.gl, animation.colorArrayBuffer, animation.rawColorData, animation.program, "color", 4, animation.gl.FLOAT);
  programLoadArray(animation.gl, animation.magnitudeArrayBuffer, animation.rawMagnitudeData, animation.program, "magnitude", 1, animation.gl.FLOAT);
  programLoadArray(animation.gl, animation.timeArrayBuffer, animation.rawTimeData, animation.program, "time", 1, animation.gl.FLOAT);
}
Animation.prototype.draw = function () {
  var animation = this;

  // pointSize range [5,20], 21 zoom levels
  var pointSize = Math.max(
    Math.floor( ((20-5) * (animation.visualization.map.zoom - 0) / (21 - 0)) + 5 ),
    getPixelDiameterAtLatitude(animation.visualization.header.resolution || 1000, animation.visualization.map.getCenter().lat(), animation.visualization.map.zoom));
  animation.gl.vertexAttrib1f(animation.program.attributes.aPointSize, pointSize*1.0);

  var mapProjection = animation.visualization.map.getProjection();

  /**
   * We need to create a transformation that takes world coordinate
   * points in the pointArrayBuffer to the coodinates WebGL expects.
   * 1. Start with second half in pixelsToWebGLMatrix, which takes pixel
   *     coordinates to WebGL coordinates.
   * 2. Scale and translate to take world coordinates to pixel coords
   * see https://developers.google.com/maps/documentation/javascript/maptypes#MapCoordinate
   */

  // copy pixel->webgl matrix
  animation.visualization.mapMatrix.set(animation.visualization.pixelsToWebGLMatrix);

  var scale = animation.visualization.canvasLayer.getMapScale();
  scaleMatrix(animation.visualization.mapMatrix, scale, scale);

  var translation = animation.visualization.canvasLayer.getMapTranslation();
  translateMatrix(animation.visualization.mapMatrix, translation.x, translation.y);


  // attach matrix value to 'mapMatrix' uniform in shader
  animation.gl.uniformMatrix4fv(animation.program.uniforms.mapMatrix, false, animation.visualization.mapMatrix);

  animation.gl.uniform1f(animation.program.uniforms.startTime, animation.visualization.current_time - (animation.visualization.currentOffset * 24 * 60 * 60));
  animation.gl.uniform1f(animation.program.uniforms.endTime, animation.visualization.current_time);

  var mode;
  if (getParameter("lines") == 'true') {
    mode = animation.gl.LINE_STRIP;
    animation.gl.uniform1i(animation.program.uniforms.doShade, 0);
  } else {
    mode = animation.gl.POINTS;
    animation.gl.uniform1i(animation.program.uniforms.doShade, 1);
  }
  for (var i = 0; i < animation.series_count; i++) {
    animation.gl.drawArrays(mode, animation.rawSeries[i], animation.rawSeries[i+1]-animation.rawSeries[i]);
  }
}



function Visualization() {
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
      fraction = (current_time - min) / (max - min);
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

  visualization.gl.clear(visualization.gl.COLOR_BUFFER_BIT);
  visualization.animation.draw();

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
      
      visualization.animation.header(visualization.header);

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
      visualization.animation.row(row_count, data);
      row_count++;
    },
    batch: function () {
      visualization.glInitialized.wait(function (cb) {
        visualization.animation.batch();

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

  daySlider.attr({"data-step": (visualization.header.timeresolution || 1).toString()});

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
    current_time = parseInt(this.value);
    var date = new Date(current_time * 1000);
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

  var zoom = parseInt(getParameter("zoom") || "4");
  var lat = parseFloat(getParameter("lat") || "39.3");
  var lon = parseFloat(getParameter("lon") || "-95.8");

  visualization.totalTime = parseFloat(getParameter("length") || "10000");
  $("#offset-slider").val(parseFloat(getParameter("offset") || "15"));
  $("#offset-slider").attr({"data-max": parseFloat(getParameter("maxoffset") || "29")});
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

  visualization.animation.initGl(visualization.gl, function () {
    if (getParameter("stats") == 'true') {
      document.body.appendChild(stats.domElement);
    }
    visualization.glInitialized.set();
    cb();
  });
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

  visualization.animation = new Animation();
  visualization.animation.init(visualization);

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
