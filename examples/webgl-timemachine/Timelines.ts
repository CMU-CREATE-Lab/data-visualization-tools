declare var cached_ajax:any;

import { Utils } from './Utils'

export class Timelines {
// layerId should be the share ID -- unique between layers
  static setTimeLine(layerId: string, startDate, endDate, step) {
    var captureTimes = [];

    var sm = getDateRegexMatches(startDate) || [];
    var em = getDateRegexMatches(endDate) || [];

    var startYear = sm[1];
    var startMonth = sm[2];
    var startDay = sm[3];
    var startHour = sm[4];
    var startMinute = sm[5];
    var startSecond = sm[6];

    var endYear = em[1];
    var endMonth = em[2];
    var endDay = em[3];

    var startYearInt = parseInt(startYear, 10);
    var endYearInt = parseInt(endYear, 10);
    var stepSize = parseInt(step, 10) || 1;

    // No valid years are given. Default to Landsat capture time range.
    // TODO: We really should give a warning when this happen to force users to include some start/end date for their data. Even if it's a geojson, at least
    // give a date for which the geojson corresponds to.
    if (isNaN(startYearInt) || isNaN(endYearInt)) {
      //console.log('ERROR: CsvFileLayer.prototype.setTimeLine unable to parse startDate or endDate for: ' + layerId + '. Using default capture time range.');
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
      return;
    }

    if (typeof(startMonth) != "undefined" && typeof(startDay) != "undefined" && typeof(endMonth) != "undefined" && typeof(endDay) != "undefined") { // generate yyyy-mm-dd (HH::MM:SS)
      var mDateStr = parseDateStrToISODateStr(startDate);
      var nDateStr = parseDateStrToISODateStr(endDate);
      var m = new Date(mDateStr);
      var n = new Date(nDateStr);
      var tomorrow = m;
      var timeZone = Utils.getTimeZone();
      while (tomorrow.getTime() <= n.getTime()) {
        var captureTimeStr = tomorrow.getFullYear() + '-' + padLeft((tomorrow.getMonth() + 1).toString(), 2) + '-' + padLeft(tomorrow.getDate().toString(), 2);
        if (typeof startHour != "undefined") {
          captureTimeStr += ' ' + padLeft(tomorrow.getHours().toString(), 2);
          if (typeof startMinute != "undefined") {
            captureTimeStr += ':' + padLeft(tomorrow.getMinutes().toString(), 2);
            if (typeof startSecond != "undefined") {
              captureTimeStr += ':' + padLeft(tomorrow.getSeconds().toString(), 2);
            }
          } else {
            captureTimeStr += ':' + '00';
          }
          captureTimeStr += timeZone;
        }
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
          captureTimes.push(padLeft(i.toString(), 2) + "-" + padLeft(j.toString(), 2));
        }
      }
    } else  { // generate yyyy
      for (var i = startYearInt; i < endYearInt + 1; i+=stepSize) {
        captureTimes.push(i.toString());
      }
    }
    cached_ajax[layerId + '.json'] = {"capture-times":  captureTimes};
  }
}

