function VectorVisualRemote(iframeName, url) {
  var self = this;
  easyXDM.Rpc.call(self, {remote: url + "/remote.html"}, {
    local: {
      run: function(args, successFn, errorFn){
        return eval(args);
      }
    },
    remote: {
      run: {},
      setIframeName: {}
    }
  });
  self.setIframeName(iframeName);
}
