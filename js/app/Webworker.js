/*

  require(["app/Webworker"], function (Webworker)  {
    w = Webworker.create({main: "(function () { console.log('nanana'); })"});
  });

*/

define(["app/Class", "app/Events"], function(Class, Events) {
  var Webworker = Class({
    name: "Webworker",
    initialize: function (worker) {
      var self = this;
      var inWebworker = !worker;
      var isApp = worker && worker.constructor !== Worker;

      if (inWebworker) {
        worker = app.worker;
        app.worker = self;
      } else if (isApp) {
        self.app = worker;
        self.app.useDojo = false;

        self.app.workerMain = self.app.main;
        self.app.workerMainModule = self.app.mainModule;

        self.app.main = undefined;
        self.app.mainModule = 'app/Webworker';

        worker = new Worker(app.dirs.script + '/webworker.js');
      }

      self.worker = worker;
      self.events = new Events("Webworker");
      self.events.on({
        __all__: self.sendMessage.bind(self),
       'send-dataset': self.handleSendDataset.bind(self),
       'request-dataset': self.handleRequestDataset.bind(self)
      });
      self.data = {};
      self.worker.addEventListener('message', self.handleMessage.bind(self), false);

      if (inWebworker) {
        if (app.workerMain) app.workerMain = eval(app.workerMain);
        var main = app.workerMain;
        if (app.workerMainModule) {
          main = function () {
           require([app.workerMainModule], function (mainModule) {
             new mainModule();
           });
          }
        }
        main();
      } else if (isApp) {
        worker.postMessage(self.app);
      }
    },

    handleMessage: function (e) {
      var self = this;
      var msg = e.data;
      //  console.log(app.name + ":handleMessage(" + JSON.stringify(msg) + ")");
      msg.received = true;
      self.events.triggerEvent(msg.type, msg);
    },

    sendMessage: function (e, type) {
      e.type = type;
      // console.log(app.name + ": sendMessage(" + JSON.stringify(e) + ")");
      var self = this;
      if (!e.received) {
        self.worker.postMessage(e);
      }
    },


    addDataset: function (name) {
      var self = this;
      self.data[name] = {
        usage: 0,
        ours: true,
        requested: false,
        queue: [],
        data: {}
      };
    },

    sendDataset: function (dataset) {
      var self = this;
      if (!self.data[dataset].ours || self.data[dataset].ours.usage > 0) {
        throw {
          dataset: dataset,
          toString: function () {
            return "Attempt to send dataset that is in use, or isn't ours: " + this.dataset;
          }
        };
      }
      self.worker.postMessage(
        {type: 'send-dataset', dataset: dataset, data: self.data[dataset].data},
        Object.values(self.data[dataset].data)
      );
      self.data[dataset].ours = false;
    },

    requestDataset: function (dataset) {
      var self = this;
      self.worker.postMessage({type: 'request-dataset', dataset: dataset});
    },

    handleSendDataset: function (e, type) {
      var self = this;
      if (!e.received) return;
      if (self.data[dataset].ours || self.data[e.dataset].usage > 0) {
        throw {
          dataset: dataset,
          toString: function () {
            return "Attempt to receive dataset that is in use, or is ours: " + this.dataset;
          }
        };
      }

      self.data[e.dataset].data = e.data;
      self.data[e.dataset].ours = true;
      self.data[e.dataset].requested = false;
      self.data[e.dataset].queue.map(function (f) {
        self.data[dataset].usage++;
        f();
      });
      self.data[e.dataset].queue = [];
    },

    handleRequestDataset: function (e, type) {
      var self = this;
      if (!e.received) return;
      var dataset = e.dataset;
      if (!self.data[dataset]) {
        self.addDataset(dataset);
      }
      if (!self.data[dataset].ours) {
        throw {
          dataset: dataset,
          toString: function () {
            return "Attempt to request dataset that isn't ours: " + this.dataset;
          }
        };
      }
      if (self.data[dataset].usage == 0) {
        self.sendDataset(dataset);
      } else {
        self.data[dataset].requested = true;
      }
    },

    useDataset: function (dataset, cb) {
      var self = this;
      if (self.data[dataset].ours) {
        self.data[dataset].usage++;
        cb();
      } else {
        self.data[dataset].queue.push(cb);
        self.events.triggerEvent('request-datasetset', {name: dataset});
      }
    },

    releaseDataset: function (dataset) {
      var self = this;
      if (!self.data[dataset].ours || self.data[dataset].usage == 0) {
        throw {
          dataset: dataset,
          toString: function () {
            return "Attempt to release dataset that isn't ours or isn't in use: " + this.dataset;
          }
        };
      }
      self.data[dataset].usage--;
      if (self.data[dataset].usage == 0 && self.data[dataset].requested) {
        self.sendDataset(dataset);
      }
    },


    withDataset: function (dataset, cb) {
      var self = this;

      self.useDataset(dataset, function () {
        cb(self.releaseDataset.bind(self, dataset));
      });
    }
  });

  return Webworker;
});
