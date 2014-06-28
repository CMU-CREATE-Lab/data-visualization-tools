dojoConfig = {
  isDebug: true,
  async: true,
  baseUrl: app.paths.lib.concat(['dojo-release-1.9.3', 'dojo', '']).join('/'),
  packages: app.packages
};

/* WebWorker environment */
if (typeof importScripts != "undefined") {
  dojoConfig.has = {
    "host-browser" : 0,
    "dom" : 0,
    "dojo-has-api" : 1,
    "dojo-xhr-factory" : 0,
    "dojo-inject-api" : 1,
    "dojo-timeout-api" : 0,
    "dojo-trace-api" : 1,
    "dojo-loader-catches" : 1,
    "dojo-dom-ready-api" : 0,
    "dojo-dom-ready-plugin" : 0,
    "dojo-ready-api" : 1,
    "dojo-error-api" : 1,
    "dojo-publish-privates" : 1,
    "dojo-gettext-api" : 1,
    "dojo-sniff" : 0,
    "dojo-loader" : 1,
    "dojo-boot" : 1,
    "dojo-test-xd" : 0,
    "dojo-test-sniff" : 0
  };
  dojoConfig.locale = "en";
  dojoConfig.loaderPatch = {
    getText : function(url, async, onLoad) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + "", false);
      xhr.send(null);
      if (xhr.status == 200 || !xhr.status) {
        if (onLoad) {
          onLoad(xhr.responseText, async);
        }
      } else {
        throw new Error("xhrFailed: " + xhr.status);
      }
      return xhr.responseText;
    }
  };
}
