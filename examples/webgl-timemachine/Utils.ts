(window as any).loadStartTime = (window as any).loadStartTime || new Date().getTime();

export class Utils {
  static arrayShallowEquals(a: any[], b: any[]): boolean {
    return a.length == b.length && a.every((val, index) => val == b[index]);
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
    return `[${((new Date().getTime() - (window as any).loadStartTime) / 1000).toFixed(2)}]`;
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
