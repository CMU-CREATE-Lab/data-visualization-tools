var magnitudeScale = 8;

/* bgein stats */
var stats = new Stats();
stats.setMode(0); // 0: fps, 1: ms
// Align top-left
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
/* end stats */

var dataLoaded = false;
var map;
var canvasLayer;
var gl;

var pointProgram;
var pointArrayBuffer;
var SERIES_COUNT;
var rawSeries;

var pixelsToWebGLMatrix = new Float32Array(16);
var mapMatrix = new Float32Array(16);

var currentOffset;

var animate = true;
var paused = true;

var totalTime; // In ms

var lastTime = 0;
var elapsedTimeFromChange = 0;
var totalElapsedTime = 0;
var header;

function resize() {
  var width = canvasLayer.canvas.width;
  var height = canvasLayer.canvas.height;

  gl.viewport(0, 0, width, height);

  // matrix which maps pixel coordinates to WebGL coordinates
  pixelsToWebGLMatrix.set([2/width, 0, 0, 0, 0, -2/height, 0, 0,
      0, 0, 0, 0, -1, 1, 0, 1]);
}

function update() {
  var daySlider = $('#day-slider')
  var min = parseFloat(daySlider.attr("data-min"));
  var max = parseFloat(daySlider.attr("data-max"));

  if (!dataLoaded) return;

  stats.begin();

  if (!animate || paused) {
    totalElapsedTime = undefined;
  } else if (animate && !paused) {
    var timeNow = new Date().getTime();
    if (totalElapsedTime == undefined) {
      current_time = daySlider.val();
      fraction = (current_time - min) / (max - min);
      totalElapsedTime = fraction * totalTime;
      elapsedTimeFromChange = 0;
    } else if (lastTime != 0) {
      var elapsed = timeNow - lastTime;
      totalElapsedTime += elapsed;
      elapsedTimeFromChange += elapsed;
    }
    lastTime = timeNow;

    if (elapsedTimeFromChange > 100) {
      elapsedTimeFromChange = 0;
      var fraction = (totalElapsedTime / totalTime) % 1;
      current_time = Math.floor(min + (max - min)  * fraction);

      daySlider.val(current_time);
      daySlider.trigger("change");
    }
  }

  gl.clear(gl.COLOR_BUFFER_BIT);

  // pointSize range [5,20], 21 zoom levels
  var pointSize = Math.max(
    Math.floor( ((20-5) * (map.zoom - 0) / (21 - 0)) + 5 ),
    getPixelDiameterAtLatitude(header.resolution || 1000, map.getCenter().lat(), map.zoom));
  gl.vertexAttrib1f(pointProgram.attributes.aPointSize, pointSize*1.0);

  var mapProjection = map.getProjection();

  /**
   * We need to create a transformation that takes world coordinate
   * points in the pointArrayBuffer to the coodinates WebGL expects.
   * 1. Start with second half in pixelsToWebGLMatrix, which takes pixel
   *     coordinates to WebGL coordinates.
   * 2. Scale and translate to take world coordinates to pixel coords
   * see https://developers.google.com/maps/documentation/javascript/maptypes#MapCoordinate
   */

  // copy pixel->webgl matrix
  mapMatrix.set(pixelsToWebGLMatrix);

  var scale = canvasLayer.getMapScale();
  scaleMatrix(mapMatrix, scale, scale);

  var translation = canvasLayer.getMapTranslation();
  translateMatrix(mapMatrix, translation.x, translation.y);


  // attach matrix value to 'mapMatrix' uniform in shader
  gl.uniformMatrix4fv(pointProgram.uniforms.mapMatrix, false, mapMatrix);

  gl.uniform1f(pointProgram.uniforms.startTime, current_time - (currentOffset * 24 * 60 * 60));
  gl.uniform1f(pointProgram.uniforms.endTime, current_time);

  for (var i = 0; i < SERIES_COUNT; i++) {
//gl.POINTS gl.LINE_STRIP
    gl.drawArrays(gl.LINE_STRIP, rawSeries[i], rawSeries[i+1]-rawSeries[i]);
  }
  stats.end();
}

function loadData(source) {
  function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
      str = '0' + str;
    }
    return str;
  }

  function formatDate(dt) {
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1, 2) + '-' + pad(dt.getDate(), 2);
  }

  days = [];
  // var daydata;
  // var day;
  daydata = undefined;
  day = undefined;
  var rawLatLonData;
  var rawColorData;
  var rawMagnitudeData;
  var rawTimeData;
  var lastSeries = function () {}; // Value we will never find in the data
  var POINT_COUNT;

  pointArrayBuffer = gl.createBuffer();
  colorArrayBuffer = gl.createBuffer();
  magnitudeArrayBuffer = gl.createBuffer();
  timeArrayBuffer = gl.createBuffer();

  var timeToSet = getParameter("time") || undefined;
  if (timeToSet) {
    timeToSet = new Date(timeToSet); animate = false;
  }

  loadTypedMatrix({
    url: source,
    header: function (data) {
      header = data;
      POINT_COUNT = 0;
      SERIES_COUNT = 0;
      // For convenience we store POINT_COUNT in an element at the end
      // of the array, so that the length of each series is
      // rawSeries[i+1]-rawSeries[i].      
      rawSeries = new Int32Array((header.series || 1) + 1);
      rawSeries[0] = 0;
      rawLatLonData = new Float32Array(header.length*2);
      rawColorData = new Float32Array(header.length*4);
      rawMagnitudeData = new Float32Array(header.length);
      rawTimeData = new Float32Array(header.length);
    },
    row: function (data) {
      if (lastSeries != data.series) {
        SERIES_COUNT++;
        lastSeries = data.series;
      }

      var rowday = Math.floor(data.datetime / (24 * 60 * 60));
      if (day != rowday) {
        day = rowday;
        var index = 0;
        if (daydata) index = daydata.index + daydata.length;
        daydata = {date: formatDate(new Date(data.datetime*1000)), length: 0, index: index};
        days.push(daydata);
      }
      daydata.length++;

      var pixel = LatLongToPixelXY(data.latitude, data.longitude);
      rawLatLonData[2*POINT_COUNT] = pixel.x;
      rawLatLonData[2*POINT_COUNT+1] = pixel.y;

      if (   data.red != undefined
          && data.green != undefined
          && data.blue != undefined) {
        rawColorData[4*POINT_COUNT + 0] = data.red / 256;
        rawColorData[4*POINT_COUNT + 1] = data.green / 256;
        rawColorData[4*POINT_COUNT + 2] = data.blue / 256;
      } else {
        rawColorData[4*POINT_COUNT + 0] = 0.82
        rawColorData[4*POINT_COUNT + 1] = 0.22;
        rawColorData[4*POINT_COUNT + 2] = 0.07;
      }
      if (data.alpha != undefined) {
        rawColorData[4*POINT_COUNT + 3] = data.alpha / 256;
      } else {
        rawColorData[4*POINT_COUNT + 3] = 1;
      }

      if (data.magnitude != undefined) {
          rawMagnitudeData[POINT_COUNT] = 1 + magnitudeScale * data.magnitude / 256;
      } else {
        rawMagnitudeData[POINT_COUNT] = 1;
      }

      rawTimeData[POINT_COUNT] = data.datetime;

      POINT_COUNT++;
      rawSeries[SERIES_COUNT] = POINT_COUNT;
    },
    batch: function () {
      //  Load lat/lons into worldCoord shader attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, pointArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawLatLonData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(pointProgram.attributes.worldCoord);
      gl.vertexAttribPointer(pointProgram.attributes.worldCoord, 2, gl.FLOAT, false, 0, 0);

      // Load colors into color shader attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, colorArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawColorData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(pointProgram.attributes.color);
      gl.vertexAttribPointer(pointProgram.attributes.color, 4, gl.FLOAT, false, 0, 0);

      // Load magnitudes into magnitude shader attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, magnitudeArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawMagnitudeData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(pointProgram.attributes.magnitude);
      gl.vertexAttribPointer(pointProgram.attributes.magnitude, 1, gl.FLOAT, false, 0, 0);

      // Load times into time shader attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, timeArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawTimeData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(pointProgram.attributes.time);
      gl.vertexAttribPointer(pointProgram.attributes.time, 1, gl.FLOAT, false, 0, 0);

      dataLoaded = true;
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
      $('#day-slider').attr({"data-min": header.colsByName.datetime.min, "data-max": header.colsByName.datetime.max});
      if (timeToSet && new Date(header.colsByName.datetime.max * 1000) > timeToSet) {
        $("#day-slider").val((timeToSet.getTime() / 1000).toString());
        animate = true;
      }
      $('#day-slider').trigger("change");
    },
    done: function () {
      $("#loading").hide();
    },
    error: function (exception) {
      throw exception;
    },
  });
}

function initAnimationSliders() {
  var daySlider = $('#day-slider');
  var offsetSlider = $('#offset-slider');

  $("#animate-button input").change(function () {
    paused = $("#animate-button input").val() == "true";
    if (paused) {
      setParameter("paused", "true");
    } else {
      setParameter("paused");
    }
  });

  daySlider.change(function(event) {
    current_time = parseInt(this.value);
    var date = new Date(current_time * 1000);
    setParameter("time", date.rfcstring());
    $('#current-date').html(date.rfcstring(" "));
  });

  var handle = daySlider.parent(".control").find(".handle");
  handle.mousedown(function(event) {
    animate = false;
  });

  handle.mouseup(function(event) {
    animate = true;
  });

  offsetSlider.change(function(event) {
    currentOffset = parseInt(this.value);
    setParameter("offset", currentOffset.toString());
    $('#current-offset').html(currentOffset.toString() + " days");

      if (typeof(rawTimeData) == "undefined") return; 
    var limitedOffset = Math.min(currentOffset, (header.colsByName.datetime.max - header.colsByName.datetime.min) / (24 * 60 * 60));
    daySlider.attr({"data-min": header.colsByName.datetime.min + limitedOffset * 24 * 60 * 60});
    if (current_time < header.colsByName.datetime.min + limitedOffset * 24 * 60 * 60) {
      current_time = limitedOffset;
      daySlider.val(current_time.toString());
    }
    daySlider.trigger("change");
  });
}

function initAnimation() {
  $("#animate-button input").val(getParameter("paused") == "true" ? "true" : "false");
  $("#animate-button input").trigger("change");

  var zoom = parseInt(getParameter("zoom") || "4");
  var lat = parseFloat(getParameter("lat") || "39.3");
  var lon = parseFloat(getParameter("lon") || "-95.8");

  totalTime = parseFloat(getParameter("length") || "10000");
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
  map = new google.maps.Map(mapDiv, mapOptions);

  if (getParameter("overlay")) {
    var kmlLayer = new google.maps.KmlLayer({url: getParameter("overlay"), preserveViewport: true});
    kmlLayer.setMap(map);
  }

  // initialize the canvasLayer
  var canvasLayerOptions = {
    map: map,
    resizeHandler: resize,
    animate: true,
    updateHandler: update
  };
  canvasLayer = new CanvasLayer(canvasLayerOptions);

  window.addEventListener('resize', function () {  google.maps.event.trigger(map, 'resize') }, false);

  google.maps.event.addListener(map, 'center_changed', function() {
    setParameter("lat", map.getCenter().lat().toString());
    setParameter("lon", map.getCenter().lng().toString());
  });
  google.maps.event.addListener(map, 'zoom_changed', function() {
    setParameter("zoom", map.getZoom().toString());
  });

  // initialize WebGL
  gl = canvasLayer.canvas.getContext('experimental-webgl');
  if (!gl) {
    var failover = getParameter('nowebgl');
    if (failover) {
      window.location = failover;
    } else {
      $("#loading td").html("<div style='color: red;'><div>Loading failed:</div><div>Your browser does not support WebGL.</div></div>");
    }
    return;
  }
  gl.enable(gl.BLEND);
  gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

  pointProgram = createShaderProgram(gl, "#pointVertexShader", "#pointFragmentShader");

  loadData(getParameter("source"));
  document.body.appendChild(stats.domElement);
}

function initToggleButtons() {
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
}

$(document).ready(function () {
  initToggleButtons();
  $(".control").slider();
  initAnimationSliders();
  initAnimation();
});
