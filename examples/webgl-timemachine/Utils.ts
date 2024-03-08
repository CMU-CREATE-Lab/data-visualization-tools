import { dbg } from "./dbg";

(window as any).loadStartTime = (window as any).loadStartTime || new Date().getTime();

export class Utils {
  static arrayShallowEquals(a: any[], b: any[]): boolean {
    return a.length == b.length && a.every((val, index) => val == b[index]);
  }

  static deepEquals(a: any, b: any): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length == b.length && a.every((val, index) => this.deepEquals(val, b[index]));
    } else if (typeof a === 'object' && typeof b === 'object') {
      for (const [key, val] of Object.entries(a)) {
        if (!(key in b)) return false;
        if (!this.deepEquals(val, b[key])) return false;
      }
      return Object.keys(a).length == Object.keys(b).length;
    } else {
      return a == b;
    }
  }

  // Retry fetch forever
  // TODO(rsargent): bring up a spinner or "network problems" dialog if failing for a while
  static async fetchWithRetry(url: string) {
    var maxRetries = 3;
    for (var i = 0; i < maxRetries; i++) {
      var response = await fetch(url);
      if (response.ok) return response;
      console.log(`fetch ${url} failed with code ${response.status}, retrying`);
      await new Promise(r => setTimeout(r, 1000));
    }
    throw Error(`Unabled to fetch ${url} after ${maxRetries} tries`)
  }
  // Display time since load
  static logPrefix() {
    let date = new Date();
    return `[${((date.getTime() - (window as any).loadStartTime) / 1000).toFixed(2)} ${date.toLocaleDateString()} ${date.toLocaleTimeString()}]`;
  }

  static timeZone: string;
  static getTimeZone(): string {
    if (typeof(Intl) != "undefined" && !Utils.timeZone) {
      Utils.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      Utils.timeZone = Utils.timeZone ? (" " + Utils.timeZone.replace("_"," ")) : "";
    }
    return Utils.timeZone;
  }

  // Return index i where array[i] == value
  // array must be sorted in monotonically increasing order (no duplicates)
  // If value is less than first element, return 0
  // If value is greater than last element, return last index (array.length - 1)
  // If value is in-between successive array elements, linearly interpolate to return fractional index.
  static findInterpolatedIndexFromSortedArray(value: number, array: number[]) {
    if (value <= array[0]) return 0;
    if (value >= array[array.length - 1]) return array.length - 1;
    for (let i = 1; i < array.length; i++) {
      if (value <= array[i]) {
        return (i - 1) + (value - array[i - 1]) / (array[i] - array[i - 1])
      }
    }
  }

  static grablogElements: string[] = [];

  static clearGrablog() {
    this.grablogElements = [];
  }
  static grablog(msg: string) {
    this.grablogElements.push(msg);
  }
  static getGrablog(): string[] {
    return this.grablogElements;
  }


  // Loads one or more scripts (including stylesheets)
  // in their respective index order, synchronously.
  static Loader = {
    queue: [] as any[],
    loadJsCss: function(src: string, oload) {
        var ext = src.toLowerCase().substring(src.length - 3, src.length);
        if (ext == '.js') {
            var scrNode = document.createElement("script");
            scrNode.type = 'text/javascript';
            scrNode.onload = function() { oload(); };
            scrNode.src = src;
            document.head.appendChild(scrNode);
        } else if (ext == 'css') {
            var cssNode = document.createElement("link");
            cssNode.rel = 'stylesheet';
            cssNode.type = 'text/css';
            cssNode.href = src;
            document.head.appendChild(cssNode);
            oload();
        }
    },
    add: function(data:{src: string[], onload: any}) {
      for (var i = 0; i < data.src.length; i++) {
        Utils.Loader.queue.push({
          src: data.src[i],
          onload: function() {
            if (Utils.Loader.next() == false) {
              data.onload();
              return;
            }
          }
        })
      }
      Utils.Loader.next();
    },
    next: function() {
      if (Utils.Loader.queue.length == 0) {
        return false;
      }
      var scr = Utils.Loader.queue.shift();
      Utils.Loader.loadJsCss(scr.src, scr.onload);
    }
  };
}

dbg.Utils = Utils;

