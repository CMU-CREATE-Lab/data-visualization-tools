Bounds = Class({
  initialize: function (left, bottom, right, top) {
    this.left = left;
    this.bottom = bottom;
    this.right = right;
    this.top = top;
  },

  getWidth: function () {
    return this.right - this.left;
  },

  getHeight: function () {
    return this.top - this.bottom;
  },

  toBBOX: function () {
    return this.left + "," + this.bottom + "," + this.right + "," + this.top;
  }
});
