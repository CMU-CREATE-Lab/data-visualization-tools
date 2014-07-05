define(["app/Class", "app/Visualization/AnimationManagerUI", "async", "jQuery", "app/Visualization/sliders"], function(Class, AnimationManagerUI, async, $) {
  return Class({
    name: "UI",
    initialize: function (visualization) {
      var self = this;
      self.visualization = visualization;
    },

    init: function (cb) {
      var self = this;

      async.series([
        self.initLoadSpinner.bind(self),
        self.initLogo.bind(self),
        self.initSliders.bind(self),
        self.initDaySlider.bind(self),
        self.initOffsetSlider.bind(self),
        self.initToggleButtons.bind(self),
        self.initSaveButton.bind(self),
        self.initAnimationManagerUI.bind(self)
      ], function () { cb(); });
    },

    initLoadSpinner: function(cb) {
      var self = this;

      self.visualization.data.events.on({
        load: function () {
          $("#loading").fadeIn();
        },
        all: function () {
          $("#loading").fadeOut();
        },
        error: function (data) {
          var dialog = $('<div class="modal fade" id="error" tabindex="-1" role="dialog" aria-labelledby="errorLabel" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"><div class="modal-header bg-danger text-danger"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 class="modal-title" id="errorLabel">Error</h4></div><div class="modal-body alert"></div><div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div></div></div></div>');
          dialog.find('.modal-body').html(data.toString());
          $('body').append(dialog);
          dialog.modal();
          dialog.on('hidden.bs.modal', function (e) {
            dialog.detach();
          });
        }
      });
      cb();
    },

    initLogo: function(cb) {
      var self = this;

      var logo_img = self.visualization.state.getValue("logoimg");
      var logo_url = self.visualization.state.getValue("logourl");

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

    initDaySlider: function(cb) {
      var self = this;
      var updating = false;

      var daySlider = $('#day-slider');

      daySlider.attr({"data-step": self.visualization.state.getValue("timeresolution").toString()});

      daySlider.change(function(event) {
        var time = new Date(parseInt(this.value));
        $('#current-date').html(time.rfcstring(" ", self.visualization.state.getValue("timeresolution")));
        updating = true;
        self.visualization.state.setValue("time", time);
        updating = false;
      });


      var daySliderUpdateMinMax = function() {
        var daySlider = $('#day-slider');

        if (!self.visualization.data.header.colsByName.datetime) return;
        var min = self.visualization.data.header.colsByName.datetime.min;
        var max = self.visualization.data.header.colsByName.datetime.max;
        var offset = self.visualization.state.getValue("offset");

        offset = Math.min(offset, (max - min) / (24 * 60 * 60 * 1000));
        min = min + offset * 24 * 60 * 60 * 1000;

        daySlider.attr({"data-min": min});
        daySlider.attr({"data-max": max});

        if (self.visualization.state.getValue("time") == undefined || self.visualization.state.getValue("time").getTime() < min) {
          self.visualization.state.setValue("time", new Date(min));
        }
        daySlider.trigger("change");
      };

      var daySliderUpdateValue = function (e) {
        if (updating) return;
        if (self.visualization.state.getValue("time") == undefined) return;
        daySlider.val(self.visualization.state.getValue("time").getTime().toString());
        daySlider.trigger("change");
      };

      self.visualization.state.events.on({
        time: daySliderUpdateValue,
        offset: daySliderUpdateMinMax
      });
      self.visualization.data.events.on({update: daySliderUpdateMinMax});
      daySliderUpdateValue();


      var handle = daySlider.parent(".control").find(".handle");
      var old_paused;
      handle.mousedown(function(event) {
        old_paused = self.visualization.state.getValue("paused")
        self.visualization.state.setValue("paused", true);
      });
      handle.mouseup(function(event) {
        self.visualization.state.setValue("paused", old_paused);
      });

      cb();
    },

    initOffsetSlider: function (cb) {
      var self = this;
      var updating = false;

      var offsetSlider = $('#offset-slider');
      offsetSlider.change(function(event) {
        var offset = parseInt(this.value);
        $('#current-offset').html(offset.toString() + " days");
        updating = true;
        self.visualization.state.setValue("offset", offset);
        updating = false;
      });

      self.visualization.state.events.on({
        offset: function (e) {
          if (updating) return;
          offsetSlider.val(e.new.toString());
          offsetSlider.trigger("change");
        },
        maxoffset: function (e) {
          if (updating) return;
          offsetSlider.attr({"data-max": e.new});
        }
      });

      offsetSlider.val(self.visualization.state.getValue("offset"));
      offsetSlider.attr({"data-max": self.visualization.state.getValue("maxoffset")});
      updating = true;
      offsetSlider.trigger("change");
      updating = false;

      var handle = offsetSlider.parent(".control").find(".handle");
      var old_paused;
      handle.mousedown(function(event) {
        old_paused = self.visualization.state.getValue("paused")
        self.visualization.state.setValue("paused", true);
      });
      handle.mouseup(function(event) {
        self.visualization.state.setValue("paused", old_paused);
      });

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
      function setValue(value) {
        $("#animate-button input").val(value ? "true" : "false");
        if (value) {
          $("#animate-button").find("i").removeClass("fa-pause").addClass("fa-play");
        } else {
          $("#animate-button").find("i").removeClass("fa-play").addClass("fa-pause");
        }
      }
      self.visualization.state.events.on({paused: function (e) { setValue(e.new); }});
      setValue(self.visualization.state.getValue("paused"));

      cb();
    },

    initSaveButton: function(cb) {
      var self = this;

      $("#save-button").click(function () {
        self.visualization.save(function (url) {
          url = window.location.toString().split("#")[0] + "#workspace=" + escape(url);

          var dialog = $('<div class="modal fade" id="share" tabindex="-1" role="dialog" aria-labelledby="shareLabel" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"><div class="modal-header bg-success text-success"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 class="modal-title" id="shareLabel">Workspace saved</h4></div><div class="modal-body alert">Share this link: <input type="text" class="link" style="width: 300pt"></div><div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div></div></div></div>');
          dialog.find('.modal-body .link').val(url);
          $('body').append(dialog);
          dialog.modal();
          dialog.on('hidden.bs.modal', function (e) {
            dialog.detach();
          });
        });
      });

      cb();
    },

    initAnimationManagerUI: function (cb) {
      var self = this;

      self.animations = new AnimationManagerUI(self.visualization.animations);
      cb();
    }
  });
});
