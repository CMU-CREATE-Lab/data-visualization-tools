//ships-worker.js
self.addEventListener('message', function(e) {
    var idx = e.data['idx'];
    var url = e.data['url'];
    getBin(url, idx, function(idx, data) {
        self.postMessage({'array': data.buffer, 'idx': idx}, [data.buffer]);        
    });

}, false);

var getBin = function(url, i, callback) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open('get', url, true);
    xhr.onload = function () {
      var float32Array = new Float32Array(this.response);
      callback(i, float32Array);
    };
    xhr.send();
}

var crude_flows_index = [
  {'filename': '0-crude-flows.bin', 'max_epoch': 1362803764.439162, 'min_epoch': 1344196740.0},
  {'filename': '1-crude-flows.bin', 'max_epoch': 1368630850.6254642, 'min_epoch': 1356352440.0},
  {'filename': '2-crude-flows.bin', 'max_epoch': 1375477977.755611, 'min_epoch': 1363526454.6067417},
  {'filename': '3-crude-flows.bin', 'max_epoch': 1382008440.0, 'min_epoch': 1365473760.0},
  {'filename': '4-crude-flows.bin', 'max_epoch': 1392493649.7164462, 'min_epoch': 1371392040.0},
  {'filename': '5-crude-flows.bin', 'max_epoch': 1393598774.858223, 'min_epoch': 1382677171.011236},
  {'filename': '6-crude-flows.bin', 'max_epoch': 1399832731.587473, 'min_epoch': 1385223928.5822306},
  {'filename': '7-crude-flows.bin', 'max_epoch': 1406034129.6090713, 'min_epoch': 1392063240.0},
  {'filename': '8-crude-flows.bin', 'max_epoch': 1413160440.0, 'min_epoch': 1400939343.3707864},
  {'filename': '9-crude-flows.bin', 'max_epoch': 1418089195.8662152, 'min_epoch': 1404994380.0},
  {'filename': '10-crude-flows.bin', 'max_epoch': 1424125799.774436, 'min_epoch': 1413165780.0},
  {'filename': '11-crude-flows.bin', 'max_epoch': 1442046780.0, 'min_epoch': 1417092012.1348314},
  {'filename': '12-crude-flows.bin', 'max_epoch': 1437058019.1022444, 'min_epoch': 1421189963.6363637},
  {'filename': '13-crude-flows.bin', 'max_epoch': 1443465644.3032672, 'min_epoch': 1425812640.0},
  {'filename': '14-crude-flows.bin', 'max_epoch': 1448988823.6228287, 'min_epoch': 1436904887.2727273},
  {'filename': '15-crude-flows.bin', 'max_epoch': 1455260843.3774915, 'min_epoch': 1445261237.9165041},
  {'filename': '16-crude-flows.bin', 'max_epoch': 1463993410.909091, 'min_epoch': 1450881160.140802},
  {'filename': '17-crude-flows.bin', 'max_epoch': 1467755612.9371564, 'min_epoch': 1457289194.0186915},
  {'filename': '18-crude-flows.bin', 'max_epoch': 1474374616.3636363, 'min_epoch': 1463748721.8181818},
  {'filename': '19-crude-flows.bin', 'max_epoch': 1481250173.6283185, 'min_epoch': 1469280227.0160873},
  {'filename': '20-crude-flows.bin', 'max_epoch': 1487025440.549273, 'min_epoch': 1474853520.0},
  {'filename': '21-crude-flows.bin', 'max_epoch': 1492642858.041543, 'min_epoch': 1483774740.0},
  {'filename': '22-crude-flows.bin', 'max_epoch': 1503923820.0, 'min_epoch': 1482323820.0},
  {'filename': '23-crude-flows.bin', 'max_epoch': 1508006340.0, 'min_epoch': 1492941696.4485981},
  {'filename': '24-crude-flows.bin', 'max_epoch': 1509999715.9048486, 'min_epoch': 1497947778.504673}
 ];

