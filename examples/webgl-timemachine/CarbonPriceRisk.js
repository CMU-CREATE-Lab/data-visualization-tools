//CarbonPriceRisk.js
var CarbonPriceRisk = {};

CarbonPriceRisk.sectors = [
    { key: 'automobiles', value: 'Automobile manufacturing' },
    { key: 'chemicals', value: 'Chemicals' },
    { key: 'construction', value: 'Construction Materials' },
    { key: 'electric', value: 'Electric Utilities' },
    { key: 'mining', value: 'Mining' },
    { key: 'pharmaceuticals', value: 'Pharmaceuticals' },
    { key: 'telecommunications', value: 'Telecommunications' }
];

CarbonPriceRisk.levels = [
    { key: 'low', value: 'Low' },
    { key: 'medium', value: 'Medium' },
    { key: 'high', value: 'High' }
 ];

CarbonPriceRisk.regions = [
    { key: 'americas', value:'Americas' }, 
    { key: 'asia', value: 'Asia-Pacific' },
    { key: 'emea', value: 'EMEA' }
 ];

CarbonPriceRisk.getIndexByKey = function(arr, key) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].key == key) {
            return i;
        }
    }
    return  -1;
}

CarbonPriceRisk.getPoints = function(jsondata) {
    // Assumes data 
    points = [];
    return points;
}