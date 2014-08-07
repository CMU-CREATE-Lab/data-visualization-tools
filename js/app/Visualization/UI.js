define(["app/Class", "app/Timeline", "app/Visualization/AnimationManagerUI", "async", "jQuery", "app/Visualization/sliders"], function(Class, Timeline, AnimationManagerUI, async, $) {
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
        self.initTimeline.bind(self),
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

    initTimeline: function (cb) {
      var self = this;
      var updating = false;

      self.timelineNode = $('<div class="main-timeline">');
      $("body").append(self.timelineNode);

      self.timeline = new Timeline({node: self.timelineNode});
      self.timeline.events.on({
        'set-range': function (e) {
          if (updating) return;
          self.visualization.state.setValue("time", e.end);
          self.visualization.state.setValue("timeExtent", e.end - e.start);
        }
      });


      var daySliderUpdateMinMax = function() {
        if (updating) return;

        self.visualization.data.useHeader(function (header) {
          if (!header.colsByName.datetime) return;
          self.timeline.min = new Date(header.colsByName.datetime.min);
          self.timeline.max = new Date(header.colsByName.datetime.max);

          daySliderUpdateValue();
        });
      };

      var daySliderUpdateValue = function () {
        if (updating) return;

        var start;
        var end = self.visualization.state.getValue("time");
        var timeExtent = self.visualization.state.getValue("timeExtent");

        var adjusted = false;
        if (end == undefined || timeExtent == undefined) {
          if (self.timeline.max == undefined || self.timeline.min == undefined) return;

          start = self.timeline.min;
          if (timeExtent == undefined) {
            end = self.timeline.max;
          } else {
            end = new Date(start.getTime() + timeExtent);
          }
          adjusted = true;
        } else {
          start = new Date(end.getTime() - timeExtent);

          if (self.timeline.max != undefined && self.timeline.min != undefined) {
            if (end > self.timeline.max) {
              end = self.timeline.max;
              start = new Date(end.getTime() - timeExtent);
              adjusted = true;
            }
            if (start < self.timeline.min) {
              start = self.timeline.min;
              end = new Date(start.getTime() + timeExtent);
              adjusted = true;
            }
            if (end > self.timeline.max) {
              end = self.timeline.max;
              adjusted = true;
            }
          }
        }

        updating = true;
        if (adjusted) {
          self.visualization.state.setValue("time", end);
          self.visualization.state.setValue("timeExtent", end - start);
        }
        self.timeline.setRange(start, end);
        updating = false;
      };

      self.visualization.state.events.on({
        time: daySliderUpdateValue,
        timeExtent: daySliderUpdateValue
      });
      self.visualization.data.events.on({update: daySliderUpdateMinMax});
      daySliderUpdateValue();
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
