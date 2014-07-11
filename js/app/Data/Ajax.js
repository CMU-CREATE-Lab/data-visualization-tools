/* Ajax helper functions */
define(["app/Class", "app/Events"], function(Class, Events) {
  var Ajax = Class({
    name: "Ajax"
  });
  Ajax.setHeaders = function(request, headers) {
    for (var key in headers) {
      var values = headers[key]
      if (typeof(values) == "string") values = [values];
      for (var i = 0; i < values.length; i++) {
        request.setRequestHeader(key, values[i]);
      }
    }
  };
  Ajax.isSuccess = function (request, url) {
    /* HTTP reports success with a 200 status. The file protocol
       reports success with zero. HTTP returns zero as a status
       code for forbidden cross domain requests.
       https://developer.mozilla.org/En/Using_XMLHttpRequest */
    var isFileUri = url.indexOf("file://") == 0;
    return request.status == 200 || (isFileUri && request.status == 0);
  };
  Ajax.makeError = function (request, url, name) {
    return {
      url: url,
      status: request.status,
      name: name,
      toString: function () {
        var name = "";
        if (this.name) {
          name = this.name + " ";
        }
        return 'Could not load ' + name + this.url + ' due to HTTP status ' + this.status;
      }
    };
  };
  return Ajax;
});
