export class Utils {
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
  static timelog(arg1, ...args) {
    console.log(`[${Math.round(new Date().getTime() - window.performance.timeOrigin)} ms] ${arg1}`, ...args);
  }
  static timelogPrefix() {
    return `[${Math.round(new Date().getTime() - window.performance.timeOrigin)} ms]`;
  }

  static timeZone: string;
  static getTimeZone(): string {
    if (typeof(Intl) != "undefined" && !Utils.timeZone) {
      Utils.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      Utils.timeZone = Utils.timeZone ? (" " + Utils.timeZone.replace("_"," ")) : "";
    }
    return Utils.timeZone;
  }
}
