var timelines = {}

// Takes in UTC time, returns ISO string date format
timelines.createISODateString = function(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
  var out = '';
  if (typeof yearStr !== "undefined") {
    out += yearStr;
  } else {
    return null;
  }

  if (typeof monthStr !== "undefined") {
    out += '-' + monthStr;
  } else {
    return out;
  }

  if (typeof dayStr !== "undefined") {
    out += '-' + dayStr;
  } else {
    return out;
  }

  if (typeof hourStr !== "undefined") {
    out += 'T' + hourStr;
  } else {
    return out + 'Z';
  }

  if (typeof minuteStr !== "undefined") {
    out += ':' + minuteStr;
  } else {
    out += ':00';
    return out + 'Z';
  }

  if (typeof secondStr !== "undefined") {
    out += ':' + secondStr;
    return out;
  } else {
    out += ':00';
    return out + 'Z';
  }
}

// layerId should be the share ID -- unique between layers
timelines.setTimeLine = function(layerId, startDate, endDate, step) {
  var captureTimes = [];

  var yyyymmddhhmm_re = /(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/;
  var sm = startDate.match(yyyymmddhhmm_re) || [];
  var em = endDate.match(yyyymmddhhmm_re) || [];
  var stepSize = parseInt(step, 10) || 1;
  var startYear = sm[1];
  var startMonth = sm[2];
  var startDay = sm[3];
  var startHour = sm[4];
  var startMinute = sm[5];
  var startSecond = sm[6];

  var endYear = em[1];
  var endMonth = em[2];
  var endDay = em[3];
  var endHour = em[4];
  var endMinute = em[5];
  var endSecond = em[6];

  function pad(n) {
    n = parseInt(n); // Ensure that n is an int and not a string
    return (n < 10) ? ("0" + n) : n;
  }

  var startYearInt = parseInt(startYear, 10);
  var endYearInt = parseInt(endYear, 10);

  // No valid years are given. Default to Landsat capture time range.
  // TODO: We really should give a warning when this happen to force users to include some start/end date for their data. Even if it's a geojson, at least
  // give a date for which the geojson corresponds to.
  if (isNaN(startYearInt) || isNaN(endYearInt)) {
    //console.log('ERROR: CsvFileLayer.prototype.setTimeLine unable to parse startDate or endDate for: ' + layerId + '. Using default capture time range.');
    captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    return;
  }

  if (typeof(startMonth) != "undefined" && typeof(startDay) != "undefined" && typeof(endMonth) != "undefined" && typeof(endDay) != "undefined") {
    var mDateStr = timelines.createISODateString(startYear, startMonth, startDay, startHour, startMinute, startSecond);
    var nDateStr = timelines.createISODateString(endYear, endMonth, endDay, endHour, endMinute, endSecond);
    var m = new Date(mDateStr);
    var n = new Date(nDateStr);
    var tomorrow = m;
    var timeZone = getTimeZone();
    while (tomorrow.getTime() <= n.getTime()) {
      var captureTimeStr = tomorrow.getFullYear() + '-' + pad((tomorrow.getMonth() + 1).toString()) + '-' + pad(tomorrow.getDate().toString());
      if (typeof startHour != "undefined") {
        captureTimeStr += ' ' + pad(tomorrow.getHours());
        if (typeof startMinute != "undefined") {
          captureTimeStr += ':' + pad(tomorrow.getMinutes());
          if (typeof startSecond != "undefined") {
            captureTimeStr += ':' + pad(tomorrow.getSeconds());
          }
        } else {
          captureTimeStr += ':' + '00';
        }
      }
      captureTimeStr += timeZone;
      captureTimes.push(captureTimeStr);
      if (typeof startSecond != "undefined") {
        tomorrow.setSeconds(tomorrow.getSeconds() + stepSize);
      } else if (typeof startMinute != "undefined") {
        tomorrow.setMinutes(tomorrow.getMinutes() + stepSize);
      } else if (typeof startHour != "undefined") {
        tomorrow.setHours(tomorrow.getHours() + stepSize);
      } else {
        tomorrow.setDate(tomorrow.getDate() + stepSize);
      }
    }
  } else if (typeof(startMonth) != "undefined" && typeof(endMonth) != "undefined") { // generate yyyy-mm
    for (var i = startYearInt; i <= endYearInt; i++) {
      var beginMonth = 1;
      var stopMonth = 12;
      if (i == startYearInt) {
        beginMonth = parseInt(startMonth); // Ensure beginMonth is an int and not a string
      }
      if (i == endYearInt) {
        stopMonth = parseInt(endMonth); // Ensure stopMonth is an int and not a string
      }
      for (var j = beginMonth; j <= stopMonth; j+=stepSize) { // Increment based on supplied stepSize
        captureTimes.push(pad(i.toString()) + "-" + pad(j.toString()));
      }
    }
  } else  { // generate yyyy
    for (var i = startYearInt; i < endYearInt + 1; i+=stepSize) {
      captureTimes.push(i.toString());
    }
  }
  cached_ajax[layerId + '.json'] = {"capture-times":  captureTimes};
};
