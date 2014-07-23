/* Bounds code adapted from OpenLayers; Published under the 2-clause
 * BSD license. See license.txt in the OpenLayers distribution.
 *
 * This is a minimalistic subset of the Openlayers.Bounds API. */
define(["app/Class"], function(Class) {
  return Class({
    name: "Bounds",
    initialize: function (left, bottom, right, top) {
      var self = this;
      if (left.length) {
        self.left = left[0];
        self.bottom = left[1];
        self.right = left[2];
        self.top = left[3];
      } else {
        self.left = left;
        self.bottom = bottom;
        self.right = right;
        self.top = top;
      }
    },

    clone: function() {
      var self = this;
      return new self.constructor(self.left, self.bottom, self.right, self.top);
    },

    getWidth: function () {
      var self = this;
      return self.right - self.left;
    },

    getHeight: function () {
      var self = this;
      return self.top - self.bottom;
    },

    toArray: function() {
      return [this.left, this.bottom, this.right, this.top];
    },

    toBBOX: function () {
      var self = this;
      return self.left + "," + self.bottom + "," + self.right + "," + self.top;
    },

    contains: function(x, y, inclusive) {
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

    containsBounds:function(bounds, partial, inclusive) {
      if (partial == null) {
        partial = false;
      }
      if (inclusive == null) {
        inclusive = true;
      }
      var bottomLeft  = this.contains(bounds.left, bounds.bottom, inclusive);
      var bottomRight = this.contains(bounds.right, bounds.bottom, inclusive);
      var topLeft  = this.contains(bounds.left, bounds.top, inclusive);
      var topRight = this.contains(bounds.right, bounds.top, inclusive);

      return (partial) ? (bottomLeft || bottomRight || topLeft || topRight)
                       : (bottomLeft && bottomRight && topLeft && topRight);
    },

    intersectsBounds:function(bounds, options) {
      if (typeof options === "boolean") {
        options =  {inclusive: options};
      }
      options = options || {};
      if (options.worldBounds) {
        var self = this.wrapDateLine(options.worldBounds);
        bounds = bounds.wrapDateLine(options.worldBounds);
      } else {
        self = this;
      }
      if (options.inclusive == null) {
        options.inclusive = true;
      }
      var intersects = false;
      var mightTouch = (
        self.left == bounds.right ||
        self.right == bounds.left ||
        self.top == bounds.bottom ||
        self.bottom == bounds.top
      );

      // if the two bounds only touch at an edge, and inclusive is false,
      // then the bounds don't *really* intersect.
      if (options.inclusive || !mightTouch) {
        // otherwise, if one of the boundaries even partially contains another,
        // inclusive of the edges, then they do intersect.
        var inBottom = (
          ((bounds.bottom >= self.bottom) && (bounds.bottom <= self.top)) ||
          ((self.bottom >= bounds.bottom) && (self.bottom <= bounds.top))
        );
        var inTop = (
          ((bounds.top >= self.bottom) && (bounds.top <= self.top)) ||
          ((self.top > bounds.bottom) && (self.top < bounds.top))
        );
        var inLeft = (
          ((bounds.left >= self.left) && (bounds.left <= self.right)) ||
          ((self.left >= bounds.left) && (self.left <= bounds.right))
        );
        var inRight = (
          ((bounds.right >= self.left) && (bounds.right <= self.right)) ||
          ((self.right >= bounds.left) && (self.right <= bounds.right))
        );
        intersects = ((inBottom || inTop) && (inLeft || inRight));
      }
      // document me
      if (options.worldBounds && !intersects) {
        var world = options.worldBounds;
        var width = world.getWidth();
        var selfCrosses = !world.containsBounds(self);
        var boundsCrosses = !world.containsBounds(bounds);
        if (selfCrosses && !boundsCrosses) {
          bounds = bounds.add(-width, 0);
          intersects = self.intersectsBounds(bounds, {inclusive: options.inclusive});
        } else if (boundsCrosses && !selfCrosses) {
          self = self.add(-width, 0);
          intersects = bounds.intersectsBounds(self, {inclusive: options.inclusive});                
        }
      }
      return intersects;
    },

    /* Extensions on top of what OpenLayers support */
    /* Move right and left edges whole revolutions around the globe so
     * that they are within world bounds. */
    rewrapDateLine: function(world) {
      var self = this;
      if (self.left >= world.left && self.right <= world.right) {
        return self;
      }
      var worldWidth =  world.getWidth();
      var res = self.clone();
      while (res.left < world.left) {
        res.left += worldWidth;
      }
      while (res.left > world.right) {
        res.left -= worldWidth;
      }
      while (res.right < world.left) {
        res.right += worldWidth;
      }
      while (res.right > world.right) {
        res.right -= worldWidth;
      }
      return res;
    },

    /* Move the right edge whole revolutions around the globe until
     * right > left (numerically). */
    unwrapDateLine: function(world) {
      var self = this;
      if (self.left <= self.right) {
        return self;
      }
      var res = self.clone();
      while (res.left > res.right) {
        res.right += world.getWidth();
      }
      return res;
    },

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
