define([], function () {
  if (typeof LogglyTracker == "undefined") {
    return undefined;
  } else {
    return LogglyTracker;
  }
});
