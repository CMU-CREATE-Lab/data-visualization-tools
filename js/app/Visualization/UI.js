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


      self.timeline = new Timeline(self.timelineNode, new Date('1970-01-01'), new Date('1970-01-2'), 10);
      self.timeline.events.on({
        'set-range': function (e) {
          updating = true;
          self.visualization.state.setValue("time", e.end);
          self.visualization.state.setValue("offset", (e.end - e.start) / (24 * 60 * 60 * 1000));
          updating = false;
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
        var end = self.visualization.state.getValue("time");
        var offset = self.visualization.state.getValue("offset");

        if (end == undefined) return;
        if (offset == undefined) return;

        offset *= 24 * 60 * 60 * 1000;

        var start = new Date(end.getTime() - offset);

        var adjusted = false;

        if (self.timeline.max != undefined && self.timeline.min != undefined) {
          if (end > self.timeline.max) {
            end = self.timeline.max;
            start = new Date(end.getTime() - offset);
            adjusted = true;
          }
          if (start < self.timeline.min) {
            start = self.timeline.min;
            end = new Date(start.getTime() + offset);
            adjusted = true;
          }
          if (end > self.timeline.max) {
            end = self.timeline.max;
            adjusted = true;
          }
        }

        if (adjusted) {
          updating = false;
          self.visualization.state.setValue("time", end);
          self.visualization.state.setValue("offset", (end - start) / (24 * 60 * 60 * 1000));
        } else {
          if (updating) return;
          self.timeline.setRange(start, end);
        }
      };

      self.visualization.state.events.on({
        time: daySliderUpdateValue,
        offset: daySliderUpdateValue
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
