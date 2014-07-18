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

      self.proxiedObjects = {};
      self.proxiedObjectsCounter = 0;
      self.proxies = {};
      self.calls = {};
      self.callCounter = 0;

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

      if (self.worker.webkitPostMessage) {
        self.postMessage = self.worker.webkitPostMessage.bind(self.worker);
      } else {
        self.postMessage = self.worker.postMessage.bind(self.worker);
      }

      self.events = new Events("Webworker");
      self.events.on({
        __all__: self.sendMessage.bind(self),
        'send-dataset': self.handleSendDataset.bind(self),
        'request-dataset': self.handleRequestDataset.bind(self),
        'object-method-call': self.handleObjectMethodCall.bind(self),
        'object-dereference': self.handleObjectDereference.bind(self),
        'object-method-return': self.handleObjectMethodReturn.bind(self)
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
        self.postMessage(self.app);
      }
    },

    handleMessage: function (e) {
      var self = this;
      var msg = self.proxyDeserialize(e.data);
      //  console.log(app.name + ":handleMessage(" + JSON.stringify(msg) + ")");
      console.log(app.name + ":handleMessage(" + msg.type + ")");
      msg.received = true;
      self.events.triggerEvent(msg.type, msg);
    },

    sendMessage: function (e, type) {
      e.type = type;
      // console.log(app.name + ": sendMessage(" + JSON.stringify(e) + ")");
      var self = this;
      if (!e.received) {
        console.log(app.name + ": sendMessage(" + e.type + ")");
        self.postMessage(self.proxySerialize(e));
      }
    },


    proxySerialize: function (obj) {
      var self = this;

      if (typeof obj == 'object') {
        if (obj.map != undefined) {
          return obj.map(function (item) {
            return self.proxySerialize(item);
          });
        } else if (obj.constructor === Object) {
          var res = {};
          for (var key in obj) {
            res[key] = self.proxySerialize(obj[key]);
          }
          return res;
        } else {
          if (obj.__proxyObjectId__ == undefined) {
            obj.__proxyObjectId__ = self.proxiedObjectsCounter++
          }
          self.proxiedObjects[obj.__proxyObjectId__] = obj;
          return {__class__: ['WebworkerProxy'], object: obj.__proxyObjectId__};
        }
      } else {
        return obj;
      }
    },

    proxyDeserialize: function (obj) {
      var self = this;

      if (typeof obj == 'object') {
        if (obj.map != undefined) {
          return obj.map(function (item) {
            return self.proxyDeserialize(item);
          });
        } else if (obj.__class__ != undefined && obj.__class__[0] == 'WebworkerProxy') {
          if (!self.proxies[obj.object]) {
            self.proxies[obj.object]  = new Webworker.ObjectProxy(self, obj.object);
          }
          return self.proxies[obj.object];
        } else if (obj.constructor === Object) {
          var res = {};
          for (var key in obj) {
            res[key] = self.proxyDeserialize(obj[key]);
          }
          return res;
        } else {
          return obj;
        }
      } else {
        return obj;
      }
    },


    addDataset: function (dataset) {
      var self = this;
      self.data[dataset] = {
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
      self.postMessage(
        {type: 'send-dataset', dataset: dataset, data: self.data[dataset].data},
        Object.values(self.data[dataset].data)
      );
      self.data[dataset].ours = false;
    },

    requestDataset: function (dataset) {
      var self = this;
      self.postMessage({type: 'request-dataset', dataset: dataset});
    },

    handleSendDataset: function (e, type) {
      var self = this;
      if (!e.received) return;
      if (!self.data[e.dataset]) {
        self.addDataset(e.dataset);
      } else if (self.data[e.dataset].ours || self.data[e.dataset].usage > 0) {
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
        self.data[e.dataset].usage++;
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
      /* If it doesn't exist, assume it's owned by the other
       * thread. */
      if (!self.data[dataset]) {
        self.addDataset(dataset);
        self.data[dataset].ours = false;
      }
      if (self.data[dataset].ours) {
        self.data[dataset].usage++;
        cb();
      } else {
        self.data[dataset].queue.push(cb);
        self.events.triggerEvent('request-dataset', {dataset: dataset});
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

    withDataset: function (dataset, fn, cb) {
      var self = this;

      self.useDataset(dataset, function () {
        fn(self.data[dataset].data, function () {
          self.releaseDataset(dataset);
          if (cb) cb();
        });
      });
    },


    objectMethodCall: function (cb, objectId, name, args) {
      var self = this;
      var id = self.callCounter++;
      self.calls[id] = cb;
      self.events.triggerEvent("object-method-call", {
        object: objectId,
        id: id,
        name: name,
        arguments: args
      });
    },

    handleObjectMethodCall: function (e) {
      var self = this;
      if (!e.received) return;
      self.events.triggerEvent('object-method-return', {
        id: e.id,
        value: self.proxiedObjects[e.object][e.name].apply(
          self.proxiedObjects[e.object],
          e.arguments
        )
      });
    },

    handleObjectMethodReturn: function (e) {
      var self = this;
      if (!e.received) return;
      cb = self.calls[e.id];
      delete self.calls[e.id];
      cb(e.value);
    },

    handleObjectDereference: function (e) {
      if (!e.received) return;
      delete self.proxiedObjects[e.object];
    }
  });

  Webworker.ObjectProxy = Class({
    name: "WebworkerObjectProxy",

    initialize: function (worker, id) {
      var self = this;

      self.worker = worker;
      self.id = id;
      self.usage = 1;
    },

    call: function (cb, name) {
      var self = this;

      self.worker.objectMethodCall(
        cb, self.id, name, Array.prototype.slice.call(arguments, 2)
      );
    },

    dereference: function () {
      var self = this;
      self.usage--;
      if (self.usage < 1) {
        self.worker.events.triggerEvent("object-dereference", {object: self.id});
      }
    },

    reference: function () {
      var self = this;
      self.usage++;
    }
  });

  return Webworker;
});
