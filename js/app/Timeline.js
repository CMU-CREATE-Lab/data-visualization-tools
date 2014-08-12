define(['app/Class', 'app/Events', 'jQuery', 'less', 'app/LangExtensions'], function (Class, Events, $, less) {

  var lessnode = $('<link rel="stylesheet/less" type="text/css" href="' + require.toUrl('app/Timeline.less') + '" />');
  $('head').append(lessnode);
  less.sheets.push(lessnode[0]);
  less.refresh(true);

  return Class({
    name: 'Timeline',

    zoomSize: 1.2,
    hiddenContext: 2, // total space, as a multiple of visible size
    context: 0.5, // visible space on each side of the window (multiples of window size)
    stepLabelStyle: "fullDate",
    windowStart: new Date('1970-01-01'),
    windowEnd: new Date('1970-01-02'),
    steps: 10,
    snapZoomToTickmarks: true,
    minWindowSize: 1000*60*60,
    maxWindowSize: 1000*60*60*24*365,

    steplengths: {
      second: 1000,
      secfiver: 1000*5,
      secquarter: 1000*15,
      minute: 1000*60,
      fiver: 1000*60*5,
      quarter: 1000*60*15,
      hour: 1000*60*60,
      morning: 1000*60*60*3,
      day: 1000*60*60*24,
      week: 1000*60*60*24*7,
      month: 1000*60*60*24*30,
      year: 1000*60*60*24*365
    },

    initialize: function (args) {
      var self = this;

      $.extend(self, args);

      self.node = $(self.node);

      self.events = new Events('Timeline');

      self.node.addClass('timeline');

      self.node.append(
        "<div class='overlay'>" +
        "  <div class='leftFrame'></div>" +
        "  <div class='window'>" +
        "    <div class='startLabel'><span></span></div>" +
        "    <div class='lengthLabel'><span></span></div>" +
        "    <div class='endLabel'><span></span></div>" +
        "  </div>" +
        "  <div class='rightFrame'></div>" +
        "</div>" +
        "<div class='line-visibility'>" +
        "  <div class='line'></div>" +
        "</div>" +
        "<a class='zoomIn'><i class='fa fa-plus-square'></i></a>" +
        "<a class='zoomOut'><i class='fa fa-minus-square'></i></a>"
      );

      self.overlayNode = self.node.find('.overlay');
      self.lineVisibilityNode = self.node.find('.line-visibility');
      self.zoomInNode = self.node.find('.zoomIn');
      self.zoomOutNode = self.node.find('.zoomOut');
      self.leftFrameNode = self.node.find('.leftFrame');
      self.windowNode = self.node.find('.window');
      self.rightFrameNode = self.node.find('.rightFrame');
      self.startLabel = self.node.find('.startLabel span');
      self.lengthLabel = self.node.find('.lengthLabel span');
      self.endLabel = self.node.find('.endLabel span');
      self.lineNode = self.node.find('.line');

      self.zoomInNode.click(self.zoomIn.bind(self));
      self.zoomOutNode.click(self.zoomOut.bind(self));
      self.zoomInNode.mousedown(function (e) { self.eatEvent(e); });
      self.zoomOutNode.mousedown(function (e) { self.eatEvent(e); });

      self.lineNode.css({'width': self.hiddenContext * 100.0 + '%'});

      self.leftFrameNode.css({
        'width': 100.0 * self.context / (self.context * 2 + 1) + '%',
      });
      self.windowNode.css({
        'width': 100.0 * 1 / (self.context * 2 + 1) + '%',
      });
      self.rightFrameNode.css({
        'width': 100.0 * self.context / (self.context * 2 + 1) + '%',
      });

      self.node.mousedown(self.dragStart.bind(self));
      $(document).mousemove(self.drag.bind(self));
      $(document).mouseup(self.dragEnd.bind(self));

      self.node.mousewheel(function(event, delta, deltaX, deltaY) {
        if (deltaY > 0) {
          self.zoomIn(event);
        } else if (deltaY < 0) {
          self.zoomOut(event);
        }
        else
          self.eatEvent(event);
      });

      self.node.attr('unselectable', 'on').css('user-select', 'none').on('selectstart', false);

      self.setRange(self.windowStart, self.windowEnd);
    },

    pad: function (n, width, z) {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    },

    intervalToLabel: function (i) {
      var self = this;
      var unitNames = ['year', 'week', 'day', 'hour', 'minute'];

      res = [];

      unitNames.map(function (unitName) {
        var unit = self.steplengths[unitName];
        var value = Math.floor(i / unit);
        if (value != 0) {
          var s = value.toString() + " " + unitName;
          if (value > 1) s += 's';
          res.push(s);
        }
        i = i % unit;
      });

      if (i > 0) {
        i = i / 1000.0;
        var s = i.toString() + " second";
        if (i > 1) s += 's';
        res.push(s);
      }

      return res.join(", ");
    },

    dateToSteplengthLabel: function (d) {
      var self = this;

      return self["dateToSteplengthLabel_" + self.stepLabelStyle](d);
    },

    dateToSteplengthLabel_fullDate: function (d) {
      var self = this;

      var iso = d.toISOString().split('Z')[0].replace('T', ' ');

      if (self.steplength >= self.steplengths.month) {
        return iso.split(' ')[0].split('-').slice(0, -1).join('-')
      } else if (self.steplength >= self.steplengths.day) {
        return iso.split(' ')[0]
      } else if (self.steplength >= self.steplengths.minute) {
        var res = iso.split(' ')[1].split(':').slice(0, -1).join(':');
        if (res != '00:00') return res;
        return iso.split(':').slice(0, -1).join(':');
      } else if (self.steplength >= self.steplengths.second) {
        var res = iso.split(' ')[1].split('.')[0];
        if (res != '00:00:00') return res;
        return iso.split('.')[0];
      } else {
        var res = iso.split(' ')[1]
        if (res != '000') return res;
        var res = iso.split(' ')[1]
        if (res != '00:00:00.000') return res;
          return iso;
      }
    },

    dateToSteplengthLabel_fluid: function (d) {
      var self = this;

      var t = [
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() - 1,
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
        d.getUTCMilliseconds()
      ];
      var s = ['', '-', '-', ' ', ':', ':', '.'];
      var l = [4, 2, 2, 2, 2, 2, 3];

      var start = 0;
      if (self.steplength < self.steplengths.second) {
        start = 6;
      } else if (self.steplength < self.steplengths.minute) {
        start = 5;
      } else if (self.steplength < self.steplengths.hour) {
        start = 4;
      } else if (self.steplength < self.steplengths.day) {
        start = 3;
      } else if (self.steplength < self.steplengths.month) {
        start = 2;
      } else if (self.steplength < self.steplengths.year) {
        start = 1;
      }
      var end = start+2;

      while (start > 0 && t[start] == 0) {
        start--;
      }

      t[1] += 1;
      t[2] += 1;

      for (var i = 0; i < t.length; i++) {
        t[i] = self.pad(t[i], l[i]);
      }

      return _.flatten(_.zip(s.slice(start, end), t.slice(start, end))).join('');
   },

    roundTimeToSteplength: function (d) {
      var self = this;

      return new Date(d.getTime() - d.getTime() % self.steplength);
    },

    roundSteplength: function (steplength) {
      var self = this;

      if (steplength < self.steplengths.second / 10) {
        return Math.pow(10, Math.ceil(Math.log(steplength, 10)));
      } else if (steplength > self.steplengths.year) {
        return Math.pow(10, Math.ceil(Math.log(steplength / self.steplengths.year, 10))) * self.steplengths.year;
      }

      return Math.min.apply(Math,
        Object.values(self.steplengths).filter(function (x) {
          return x > steplength;
        })
      );
    },

    stepToSubsteps: function (steplength) {
      var self = this;

      if (steplength <= self.steplengths.second) {
        return 10;
      } else if (steplength > self.steplengths.year) {
        return steplength / (Math.pow(10, Math.ceil(Math.log(steplength / self.steplengths.year, 10)) - 1) * self.steplengths.year);
      }

      return steplength / Math.max.apply(Math,
        Object.values(self.steplengths).filter(function (x) {
          return x < steplength;
        })
      );
    },

    eatEvent: function (e) {
      if (e == undefined) return;
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    },

    zoomOut: function (e) {
      var self = this;
      self.zoom(self.zoomSize);
      self.eatEvent(e);
    },

    zoomIn: function (e) {
      var self = this;
      self.zoom(1 / self.zoomSize);
      self.eatEvent(e);
    },

    zoom: function (factor) {
      var self = this;

      var middle = self.windowStart.getTime() + self.windowSize / 2;
      var windowSize = Math.max(1, Math.floor(self.windowSize * factor));

      if (self.maxWindowSize != undefined && self.maxWindowSize < windowSize) {
        windowSize = self.maxWindowSize;
      }
      if (self.minWindowSize != undefined && self.minWindowSize > windowSize) {
        windowSize = self.minWindowSize;
      }

      if (self.snapZoomToTickmarks) {
        var stepLength = self.roundSteplength(windowSize / self.steps);
        if (stepLength >= windowSize) {
          stepLength = stepLength / self.stepToSubsteps(stepLength);
        }
        var steps = windowSize / stepLength;
        
        if (factor > 1) {
          steps = Math.ceil(steps);
        } else {
          steps = Math.floor(steps);
        }
        windowSize = stepLength * steps;
      }

      self.start = undefined;
      self.end = undefined;
      self.setRange(new Date(middle - windowSize / 2), new Date(middle + windowSize / 2));
    },

    setRangeFromOffset: function (offset, type) {
      var self = this;
      self.offset = offset;

      self.visibleStart = new Date(self.start.getTime() + self.offset);
      self.visibleEnd = new Date(self.visibleStart.getTime() + self.windowSize * (self.context + 1 + self.context));

      self.windowStart = new Date(self.visibleStart.getTime() + self.windowSize * self.context);
      self.windowEnd = new Date(self.windowStart.getTime() + self.windowSize);

/*
      console.log(  "START:  " + self.start.toISOString() +
                  "\nVSTART: " + self.visibleStart.toISOString() +
                  "\nWSTART: " + self.windowStart.toISOString() +
                  "\nWEND:   " + self.windowEnd.toISOString() +
                  "\nVEND:   " + self.visibleEnd.toISOString() +
                  "\nEND:    " + self.end.toISOString());
*/

      self.updateRange();

      self.events.triggerEvent(type || 'set-range', {start: self.windowStart, end: self.windowEnd});
    },

    setContextFromVisibleContext: function() {
      var self = this;
      self.contextSize = self.visibleContextSize * self.hiddenContext;

      self.start = self.roundTimeToSteplength(new Date(self.visibleStart.getTime() - (self.visibleContextSize * self.context / 2)));
      self.end = new Date(self.start.getTime() + self.contextSize);

      self.offset = self.visibleStart - self.start;

      self.lineNode.find('.quanta').remove();

      self.stepCount = 0;
      self.stepsEnd = self.start;
      for (; self.stepsEnd <= self.end; self.stepsEnd = new Date(self.stepsEnd.getTime() + self.steplength)) {
        self.stepCount++;
        var stepNode = $("<div class='quanta'><div class='label'><span></span></div></div>");
        stepNode.find("span").html(self.dateToSteplengthLabel(self.stepsEnd));
        self.lineNode.append(stepNode);
        for (var subPos = 0; subPos < self.substeps - 1; subPos++) {
          self.lineNode.append("<div class='quanta small'></div>");
        }
      }
      self.stepsSize = (self.stepsEnd - self.start) / (self.end - self.start)

      self.stepWidth = 100.0 * self.stepsSize / (self.stepCount * self.substeps);
      self.lineNode.find('.quanta').css({'margin-right': self.stepWidth + '%'});

      if (self.dragStartX != undefined) {
        self.dragStartX = self.dragX;
        self.dragStartOffset = self.offset;
      }
    },

    setVisibleContextFromRange: function() {
      var self = this;
      self.visibleStart = new Date(self.windowStart.getTime() - self.windowSize * self.context);
      self.visibleEnd = new Date(self.windowEnd.getTime() + self.windowSize * self.context);

      self.visibleContextSize = self.visibleEnd - self.visibleStart;
      if (self.start != undefined) {
        self.offset = self.visibleStart - self.start;
      }
    },

    setRange: function (windowStart, windowEnd, type) {
      var self = this;
      self.windowStart = windowStart;
      self.windowEnd = windowEnd;
      self.windowSize = self.windowEnd - self.windowStart;

      self.steplength = self.roundSteplength(self.windowSize / self.steps);
      self.substeps = self.stepToSubsteps(self.steplength);

      self.setVisibleContextFromRange();
      if (self.start == undefined) {
        self.setContextFromVisibleContext();
      }

      self.updateRange();

      self.events.triggerEvent(type || 'set-range', {start: self.windowStart, end: self.windowEnd});
    },

    updateRange: function () {
      var self = this;

      if (   self.visibleStart <= self.start 
          || self.visibleEnd >= self.end) {
        self.setContextFromVisibleContext();
      }

      self.percentOffset = 100.0 * self.hiddenContext * self.offset / self.contextSize;
      self.lineNode.css({'left': -(self.percentOffset) + '%'});
      self.startLabel.html(self.windowStart.toISOString().replace("T", " ").replace("Z", ""));
      self.lengthLabel.html(self.intervalToLabel(self.windowEnd - self.windowStart));
      self.endLabel.html(self.windowEnd.toISOString().replace("T", " ").replace("Z", ""));
    },

    dragStart: function (e) {
      var self = this;
      self.dragStartX = e.pageX;
      self.dragStartOffset = self.offset;
      self.eatEvent(e);
    },

    drag: function (e) {
      var self = this;

      if (self.dragStartX == undefined) return;

      self.dragX = e.pageX;

      var pixelOffset = self.dragStartX - self.dragX;
      var pixelWidth = self.lineVisibilityNode.innerWidth();
      var percentOffset = 100.0 * pixelOffset / pixelWidth;
      var offset = percentOffset * self.visibleContextSize / 100.0;

      self.setRangeFromOffset(self.dragStartOffset + offset, 'temporary-range');

      self.eatEvent(e);
    },

    dragEnd: function (e) {
      var self = this;

      if (self.dragStartX == undefined) return;

      self.dragStartX = undefined;
      self.events.triggerEvent('set-range', {start: self.windowStart, end: self.windowEnd});
      self.eatEvent(e);
    }
  });
});
