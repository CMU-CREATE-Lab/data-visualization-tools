(function(){
  // performance.now polyfill from Paul Irish
  //
  // Date.now() is supported everywhere except IE8.
  // As Safari 6 doesn't have support for NavigationTiming, we use a Date.now() timestamp for relative values.
  if ("performance" in window == false) {
    window.performance = {};
  }

  Date.now = (Date.now || function () {  // thanks IE8
    return new Date().getTime();
  });

  if ("now" in window.performance == false){
    var nowOffset = Date.now();

    if (performance.timing && performance.timing.navigationStart){
      nowOffset = performance.timing.navigationStart
    }

    window.performance.now = function now(){
      return Date.now() - nowOffset;
    }
  }

  if (!String.prototype.startsWith) {
      String.prototype.startsWith = function(searchString, position){
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
  }
})();

// For IE Math.log2 support
Math.log2 = Math.log2 || function(x){return Math.log(x)*Math.LOG2E;};

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(search, this_len) {
    if (this_len === undefined || this_len > this.length) {
      this_len = this.length;
    }
    return this.substring(this_len - search.length, this_len) === search;
  };
}
