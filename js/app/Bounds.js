define(["Class"], function(Class) {
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
    }
  });
});
