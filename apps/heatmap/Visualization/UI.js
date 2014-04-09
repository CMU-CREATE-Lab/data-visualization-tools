define(["Class", "Visualization/sliders"], function(Class) {
  return Class({
    initialize: function (visualization) {
      var self = this;
      self.visualization = visualization;
    },

    init: function (cb) {
      var self = this;

      async.series([
        self.initLogo.bind(self),
        self.initSliders.bind(self),
        self.initDaySlider.bind(self),
        self.initOffsetSlider.bind(self),
        self.initToggleButtons.bind(self),
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
      cb();
    },

    daySliderUpdateMinMax: function() {
      var self = this;
      var daySlider = $('#day-slider');

      if (!self.visualization.tiles.header.colsByName.datetime) return;
      var min = self.visualization.tiles.header.colsByName.datetime.min;
      var max = self.visualization.tiles.header.colsByName.datetime.max;
      var offset = self.visualization.state.getValue("offset");

      offset = Math.min(offset, (max - min) / (24 * 60 * 60));

      daySlider.attr({"data-min": min + offset * 24 * 60 * 60});
      daySlider.attr({"data-max": max});

      if (self.visualization.state.getValue("time") < min + offset * 24 * 60 * 60) {
        self.visualization.state.setValue("time", offset);
      }
    },

    initDaySlider: function(cb) {
      var self = this;

      var daySlider = $('#day-slider');

      daySlider.attr({"data-step": self.visualization.state.getValue("timeresolution").toString()});

      daySlider.change(function(event) {
        var time = parseInt(this.value);
        var date = new Date(time * 1000);
        $('#current-date').html(date.rfcstring(" ", self.visualization.state.getValue("timeresolution")));
        self.visualization.state.setValue("time", time);
      });


      self.visualization.state.events.on({
        time: function (e) {
          daySlider.val(e.new.toString());
        },
        offset: self.daySliderUpdateMinMax.bind(self)
      });
      self.visualization.tiles.events.on({update: self.daySliderUpdateMinMax.bind(self)});


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
      var self = this;

      var offsetSlider = $('#offset-slider');
      offsetSlider.change(function(event) {
        var offset = parseInt(this.value);
        $('#current-offset').html(offset.toString() + " days");
        self.visualization.state.setValue("offset", offset);
      });

      self.visualization.state.events.on({
        offset: function (e) {
          offsetSlider.val(e.new.toString());
        },
        maxoffset: function (e) {
          $("#offset-slider").attr({"data-max": e.new});
        }
      });

      $("#offset-slider").val(self.visualization.state.getValue("offset"));
      $("#offset-slider").attr({"data-max": self.visualization.state.getValue("maxoffset")});
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
        self.visualization.state.setValue("paused", $("#animate-button input").val() == "true");
      });
      function setValue(e) {
        $("#animate-button input").val(e.new ? "true" : "false");
        if (e.new) {
          $("#animate-button").find("i").removeClass("glyphicon-pause").addClass("glyphicon-play");
        } else {
          $("#animate-button").find("i").removeClass("glyphicon-play").addClass("glyphicon-pause");
        }
      }
      self.visualization.state.events.on({paused: function (e) { setValue(e.new); }});
      setValue(self.visualization.state.getValue("paused"));

      cb();
    }
  });
});
