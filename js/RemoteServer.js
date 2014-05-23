var rpc = new easyXDM.Rpc({}, {
  local: {
    setIframeName: function(name, successFn, errorFn){
      rpc.iframeName = name;
    },
    run: function(args, successFn, errorFn) {
      var iframe = parent.frames[rpc.iframeName];
      var visualization = iframe.visualization;
      return eval(args);
    }
  },
  remote: {
    run: {}
  }
});
