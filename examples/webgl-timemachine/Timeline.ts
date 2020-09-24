// If startDate == endDate, you don't really need to display a timeline

import { Utils } from "./Utils";

//////////////////
// The last layer in the ordering with a timeline with non-zero duration wins
//////////////////

// Layer without any timestamp returns timeline() of null
// Layer with a single timestamp but no duration returns timeline() with startDate == endDate
// Layer with a range of times returns full timeline

export type TimelineType = "customUI" | "defaultUI";

// TODO: make this work right for Timemachine layer
//           be able to pass in all timestamps
//           is there a time where we have a Timemachine layer but not yet know its capture times, before tm.json loaded?

export class Timeline {
    timelineType: TimelineType;
    startDate: string;
    endDate: string;
    step: number;
    private cachedCaptureTimes: string[];
    // The "Fast" playback rate value. TimeMachine will use this to figure out medium and slow speeds (e.g. 0.5x and 0.25x of this value)
    masterPlaybackRate: number;
    // The playback rate used on initial draw. Should be a slow/medium/fast value based on above.
    playbackRate: number;

    constructor(timelineType: TimelineType, options: {[key:string]: any}) {
        this.timelineType = timelineType;
        this.startDate = options.startDate as string;
        this.endDate = options.endDate as string;
        this.step = options.step as number;
        this.masterPlaybackRate = options.masterPlaybackRate as number || 1.0;
        this.playbackRate = options.playbackRate as number || 0.5;
        this.cachedCaptureTimes = options.cachedCaptureTimes as string[];
    }

    getCaptureTimes(): {"capture-times": string[]} {
        if (!this.cachedCaptureTimes) {
            var captureTimes = [];

            var sm = getDateRegexMatches(this.startDate) || [];
            var em = getDateRegexMatches(this.endDate) || [];

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

            if (typeof(startMonth) != "undefined" && typeof(startDay) != "undefined" && typeof(endMonth) != "undefined" && typeof(endDay) != "undefined") { // generate yyyy-mm-dd (HH::MM:SS)
                var mDateStr = parseDateStrToISODateStr(this.startDate);
                var nDateStr = parseDateStrToISODateStr(this.endDate);
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
                    tomorrow.setSeconds(tomorrow.getSeconds() + this.step);
                } else if (typeof startMinute != "undefined") {
                    tomorrow.setMinutes(tomorrow.getMinutes() + this.step);
                } else if (typeof startHour != "undefined") {
                    tomorrow.setHours(tomorrow.getHours() + this.step);
                } else {
                    tomorrow.setDate(tomorrow.getDate() + this.step);
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
                for (var j = beginMonth; j <= stopMonth; j+=this.step) { // Increment based on supplied this.step
                    captureTimes.push(padLeft(i.toString(), 2) + "-" + padLeft(j.toString(), 2));
                }
                }
            } else  { // generate yyyy
                for (var i = startYearInt; i < endYearInt + 1; i+=this.step) {
                captureTimes.push(i.toString());
                }
            }
            this.cachedCaptureTimes = captureTimes;
        }
        return {"capture-times": this.cachedCaptureTimes};
    }
}
