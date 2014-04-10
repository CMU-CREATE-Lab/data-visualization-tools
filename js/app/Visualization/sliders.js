define(["jQuery"], function($) {
  $.fn.slider = function () {
    this.each(function () {
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
          var val = parseFloat(input.val()) - parseFloat(input.attr("data-step"));
          if (val < size.min) val = size.min;
          input.val(val.toString())
          input.trigger("change");
        });
        plus.click(function (e) {
          var size = getSize();
          var val = parseFloat(input.val()) + parseFloat(input.attr("data-step"));
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
  }
});
