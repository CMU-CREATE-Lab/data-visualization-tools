/* Bounds code adapted from OpenLayers; Published under the 2-clause
 * BSD license. See license.txt in the OpenLayers distribution.
 *
 * This is a minimalistic subset of the Openlayers.Bounds API. */
define(["app/Class"], function(Class) {
  return Class({
    name: "Bounds",
    initialize: function (left, bottom, right, top) {
      var self = this;
      self.left = left;
      self.bottom = bottom;
      self.right = right;
      self.top = top;
    },

    getWidth: function () {
      var self = this;
      return self.right - self.left;
    },

    getHeight: function () {
      var self = this;
      return self.top - self.bottom;
    },

    toBBOX: function () {
      var self = this;
      return self.left + "," + self.bottom + "," + self.right + "," + self.top;
    },

    contains:function(x, y, inclusive) {
      if (inclusive == undefined) {
        inclusive = true;
      }

      if (inclusive) {
        return ((x >= this.left) && (x <= this.right) && 
                (y >= this.bottom) && (y <= this.top));
      } else {
        return ((x > this.left) && (x < this.right) && 
                (y > this.bottom) && (y < this.top));
      }
    },

    /* Extensions on top of what OpenLayers support */
    toString: function () {
      var self = this;
      return self.toBBOX();
    },

    toJSON: function () {
      var self = this;
      return {left:self.left, right:self.right, top:self.top, bottom:self.bottom}
    }
  });
});
