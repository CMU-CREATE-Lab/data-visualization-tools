VisualizationUI = Class({
  init: function (visualization, cb) {
    var self = this;

    self.visualization = visualization;

    async.series([
      function (cb) { self.initLogo(cb); },
      function (cb) { self.initSliders(cb); },
      function (cb) { self.initDaySlider(cb); },
      function (cb) { self.initOffsetSlider(cb); },
      function (cb) { self.initToggleButtons(cb); },
    ], function () { cb(); });
  },

  initLogo: function(cb) {
    var self = this;

    var logo_img = getParameter("logoimg");
    var logo_url = getParameter("logourl");

    if (logo_img) {
      var logo = $("<a class='logo'><img></a>");
      logo.find("img").attr({src:logo_img});
      logo.attr({href:logo_url});
      $("body").append(logo);
    }
    cb();
  },

  initSliders: function(cb) {
    $(".control").slider();
  },

  initDaySlider: function(cb) {
    var self = this;

    var daySlider = $('#day-slider');

    daySlider.attr({"data-step": (self.visualization.state.getValue("timeresolution").toString()});

    daySlider.change(function(event) {
      var time = parseInt(this.value);
      var date = new Date(time * 1000);
      $('#current-date').html(date.rfcstring(" ", self.visualization.state.getValue("timeresolution")));
      self.visualization.state.setValue("time", time);
    });

    self.visualization.state.on({set: function (e) {
      daySlider.val(e.new.toString());
      // Don't trigger a change event as that would lead to a loop!
    });

    var handle = daySlider.parent(".control").find(".handle");
    handle.mousedown(function(event) {
      self.visualization.state.incValue("paused");
    });

    handle.mouseup(function(event) {
      self.visualization.state.decValue("paused");
    });

    cb();
  },

  initOffsetSlider: function (cb) {
    var offsetSlider = $('#offset-slider');
    offsetSlider.change(function(event) {
      var offset = parseInt(this.value);
      $('#current-offset').html(offset.toString() + " days");
      self.visualization.state.setValue("offset", offset);

      var min = self.visualization.tiles.header.colsByName.datetime.min;
      var max = self.visualization.tiles.header.colsByName.datetime.max;
      var limitedOffset = Math.min(offset, (max - min) / (24 * 60 * 60));

      daySlider.attr({"data-min": min + limitedOffset * 24 * 60 * 60});

      if (self.visualization.state.getValue("time") < min + limitedOffset * 24 * 60 * 60) {
        self.visualization.state.setValue("time", limitedOffset);
      }
    });

    $("#offset-slider").val(self.params.getValue("offset"));
    $("#offset-slider").attr({"data-max": self.params.getValue("maxoffset")});
    $("#offset-slider").trigger("change");

    cb();
  },

  initToggleButtons: function(cb) {
    var self = this;

    $("#animate-button").click(function () {
      val = $("#animate-button input").val() == "true";
      $("#animate-button input").val(val ? "false" : "true");
      $("#animate-button input").trigger("change");
    });
    $("#animate-button input").change(function () {
      var paused = $("#animate-button input").val() == "true";
      if (paused) {
        $("#animate-button").find("i").removeClass("glyphicon-pause").addClass("glyphicon-play");
      } else {
        $("#animate-button").find("i").removeClass("glyphicon-play").addClass("glyphicon-pause");
      }
      self.visualization.params.setValue("paused", paused);
    });


  }
}
