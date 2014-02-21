var totalTime = 10000; // in ms
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
var POINT_COUNT;

var pixelsToWebGLMatrix = new Float32Array(16);
var mapMatrix = new Float32Array(16);

var days = [];

var current_day_index = 0;
var currentOffset = 15;

var animate = true;
var paused = false;

var lastTime = 0;
var elapsedTimeFromChange = 0;
var totalElapsedTime = 0;
var header;

function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function init() {
  // initialize the map
  var mapOptions = {
    zoom: 4,
    center: new google.maps.LatLng(39.3, -95.8),
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

  // initialize the canvasLayer
  var canvasLayerOptions = {
    map: map,
    resizeHandler: resize,
    animate: true,
    updateHandler: update
  };
  canvasLayer = new CanvasLayer(canvasLayerOptions);

  window.addEventListener('resize', function () {  google.maps.event.trigger(map, 'resize') }, false);

  // initialize WebGL
  gl = canvasLayer.canvas.getContext('experimental-webgl');
  if (!gl) {
    var failover = getParameterByName('nowebgl');
    if (failover) {
      window.location = failover;
    } else {
      $("#loading td").html("<div style='color: red;'><div>Loading failed:</div><div>Your browser does not support WebGL.</div></div>");
    }
    return;
  }
  gl.enable(gl.BLEND);
  gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

  createShaderProgram();
  loadData(getParameterByName("source"));
  document.body.appendChild( stats.domElement );

}

var sliderInitialized = false;
function initSlider() {
  var daySlider = $('#day-slider');
  var offsetSlider = $('#offset-slider');

  daySlider.attr({"data-max": days.length - 1});

  if (!sliderInitialized) {
    sliderInitialized = true;

    $("#animate-button").click(function () {
      if (paused) {
        $(this).find("i").removeClass("glyphicon-play").addClass("glyphicon-pause");
        paused = false;
      } else {
        $(this).find("i").removeClass("glyphicon-pause").addClass("glyphicon-play");
        paused = true;
      }
    });

    daySlider.change(function(event) {
      current_day_index = parseInt(this.value);
      $('#current-date').html(days[current_day_index].date);
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
      $('#current-offset').html(currentOffset.toString() + " days");
      var limitedOffset = Math.min(currentOffset, days.length - 1);
      daySlider.attr({"data-min": limitedOffset});
      if (current_day_index < limitedOffset) {
        current_day_index = limitedOffset;
        daySlider.val(current_day_index.toString());
      }
      daySlider.trigger("change");
    });
  }
  offsetSlider.trigger("change");
}

function createShaderProgram() {
  // create vertex shader
  var vertexSrc = document.getElementById('pointVertexShader').text;
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSrc);
  gl.compileShader(vertexShader);

  // create fragment shader
  var fragmentSrc = document.getElementById('pointFragmentShader').text;
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSrc);
  gl.compileShader(fragmentShader);

  // link shaders to create our program
  pointProgram = gl.createProgram();
  gl.attachShader(pointProgram, vertexShader);
  gl.attachShader(pointProgram, fragmentShader);
  gl.linkProgram(pointProgram);

  gl.useProgram(pointProgram);

  gl.aPointSize = gl.getAttribLocation(pointProgram, "aPointSize");

}

function resize() {
  var width = canvasLayer.canvas.width;
  var height = canvasLayer.canvas.height;

  gl.viewport(0, 0, width, height);

  // matrix which maps pixel coordinates to WebGL coordinates
  pixelsToWebGLMatrix.set([2/width, 0, 0, 0, 0, -2/height, 0, 0,
      0, 0, 0, 0, -1, 1, 0, 1]);
}

function update() {
  if (!dataLoaded) return;

  stats.begin();

  if (animate && !paused) {
    var timeNow = new Date().getTime();
    if (lastTime != 0 ) {
      var elapsed = timeNow - lastTime;
      totalElapsedTime += elapsed;
      elapsedTimeFromChange += elapsed;
    }
    lastTime = timeNow;

    if (elapsedTimeFromChange > 100) {
      elapsedTimeFromChange = 0;
      var daySlider = $('#day-slider')
      var fraction = (totalElapsedTime / totalTime) % 1;
      var min = parseFloat(daySlider.attr("data-min"));
      current_day_index = Math.floor(min + (days.length - min)  * fraction);

      $('current-date').html(days[current_day_index].date);
      daySlider.val(current_day_index);
      daySlider.trigger("change");
    }
  }

 var current_day = days[current_day_index];
 var first_day = days[Math.max(0, current_day_index - currentOffset)];

  gl.clear(gl.COLOR_BUFFER_BIT);

  // pointSize range [5,20], 21 zoom levels
  var pointSize = Math.max(
    Math.floor( ((20-5) * (map.zoom - 0) / (21 - 0)) + 5 ),
    getPixelDiameterAtLatitude(header.resolution || 1000, map.getCenter().lat(), map.zoom));
  gl.vertexAttrib1f(gl.aPointSize, pointSize*1.0);

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
  var matrixLoc = gl.getUniformLocation(pointProgram, 'mapMatrix');
  gl.uniformMatrix4fv(matrixLoc, false, mapMatrix);

  // draw!

  gl.drawArrays(gl.POINTS, first_day.index, current_day.index + current_day.length - first_day.index);
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
  var daydata;
  var day;
  var rawLatLonData;
  var rawColorData;
  var rawMagnitudeData;

  pointArrayBuffer = gl.createBuffer();
  colorArrayBuffer = gl.createBuffer();
  magnitudeArrayBuffer = gl.createBuffer();

  loadTypedMatrix({
    url: source,
    header: function (data) {
      header = data;
      POINT_COUNT = 0;
      rawLatLonData = new Float32Array(header.length*2);
      rawColorData = new Float32Array(header.length*4);
      rawMagnitudeData = new Float32Array(header.length);
    },
    row: function (data) {
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

      POINT_COUNT++;
    },
    batch: function () {
      //  Load lat/lons into worldCoord shader attribute
      var worldCoordLoc = gl.getAttribLocation(pointProgram, 'worldCoord');
      gl.bindBuffer(gl.ARRAY_BUFFER, pointArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawLatLonData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(worldCoordLoc);
      gl.vertexAttribPointer(worldCoordLoc, 2, gl.FLOAT, false, 0, 0);

      // Load colors into color shader attribute
      var colorLoc = gl.getAttribLocation(pointProgram, 'color');
      gl.bindBuffer(gl.ARRAY_BUFFER, colorArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawColorData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

      // Load magnitudes into magnitude shader attribute
      var magnitudeLoc = gl.getAttribLocation(pointProgram, 'magnitude');
      gl.bindBuffer(gl.ARRAY_BUFFER, magnitudeArrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rawMagnitudeData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(magnitudeLoc);
      gl.vertexAttribPointer(magnitudeLoc, 1, gl.FLOAT, false, 0, 0);

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
      initSlider();
    },
    done: function () {
      $("#loading").hide();
    },
    error: function (exception) {
      throw exception;
    },
  });
}

function scaleMatrix(matrix, scaleX, scaleY) {
  // scaling x and y, which is just scaling first two columns of matrix
  matrix[0] *= scaleX;
  matrix[1] *= scaleX;
  matrix[2] *= scaleX;
  matrix[3] *= scaleX;

  matrix[4] *= scaleY;
  matrix[5] *= scaleY;
  matrix[6] *= scaleY;
  matrix[7] *= scaleY;
}

function translateMatrix(matrix, tx, ty) {
  // translation is in last column of matrix
  matrix[12] += matrix[0]*tx + matrix[4]*ty;
  matrix[13] += matrix[1]*tx + matrix[5]*ty;
  matrix[14] += matrix[2]*tx + matrix[6]*ty;
  matrix[15] += matrix[3]*tx + matrix[7]*ty;
}

document.addEventListener('DOMContentLoaded', init, false);

$(document).ready(function () {
  $(".control").each(function () {
    (function (control) {
      var bar = control.find(".bar");
      var handle = control.find(".handle");
      var minus = control.find(".minus");
      var plus = control.find(".plus");
      var input = control.find("input");

      var horizontal = control.hasClass("horizontal");

      var getSize = function () {
        var res = {};
        res.minpos = horizontal ? 21 : 20;
        res.maxpos = horizontal ? bar.width() + 11 : bar.height() + 10;

        res.min = parseFloat(input.attr("data-min"));
        res.max = parseFloat(input.attr("data-max"));

        res.pixelspervalue = (res.max - res.min) / (res.maxpos - res.minpos);
        return res;
      };

      input.change(function () {
        var size = getSize();
        var fraction = (parseFloat(input.val()) - size.min) / (size.max - size.min);
        if (horizontal) {
          var pos = size.minpos + (size.maxpos - size.minpos) * fraction;
          handle.css({left: pos.toString() + "px"});          
        } else {
          var pos = size.maxpos - (size.maxpos - size.minpos) * fraction;
          handle.css({top: pos.toString() + "px"});
        }
      });

      minus.click(function (e) {
        var size = getSize();
        var val = parseFloat(input.val()) - 1;
        if (val < size.min) val = size.min;
        input.val(val.toString())
        input.trigger("change");
      });
      plus.click(function (e) {
        var size = getSize();
        var val = parseFloat(input.val()) + 1;
        if (val > size.max) val = size.max;
        input.val(val.toString())
        input.trigger("change");
      });

      var mousepos = undefined;

      control.mousedown(function (e) {
        mousepos = {x: e.pageX, y: e.pageY};
      });
      control.mouseup(function (e) {
        mousepos = undefined;
      });
      control.mousemove(function (e) {
        if (!mousepos) return;
        var newmousepos = {x: e.pageX, y: e.pageY};
        var diff;
        if (horizontal) {
          diff = newmousepos.x - mousepos.x;
        } else {
          diff = mousepos.y - newmousepos.y;
        }
        mousepos = newmousepos;
        var size = getSize();
        var val = parseFloat(input.val()) + size.pixelspervalue * diff;
        if (val < size.min) val = size.min;
        if (val > size.max) val = size.max;
        input.val(val.toString())
        input.trigger("change");
      });

      input.trigger("change");
    })($(this));
  });
});
