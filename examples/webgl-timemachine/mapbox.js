var map;

//$( document ).ready(function() {

function loadMapboxContent() {
  mapboxgl.accessToken = 'pk.eyJ1Ijoiamprb2hlciIsImEiOiJjanhtM3JncHIwMjY4M3BtbXV0Z2dvZzg0In0._o4vt3R-MDgSonaoHMmk8w';
  map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/jjkoher/cjy7cezat2fl81coxwgt2nfi6', // stylesheet location
    center: [-95.915, 38.573], // starting position [lng, lat]
    renderWorldCopies: false // don't show multiple earths when zooming out
  });

  var mapboxObj = map;

  var Year = "2000";
  var hoveredStateId = null;
  var layers = ['0-10%', '10-25%', '25-35%', '35-50%', '50-65%', '65-75%', '75-90%', '90-100%'];
  var colors = ["hsla(0, 91%, 44%, 0.85)",
    "hsla(0, 91%, 44%, 0.75)",
    "hsla(0, 91%, 44%, 0.65)",
    "hsla(0, 91%, 44%, 0.45)",
    "hsla(219, 78%, 53%, 0.45)",
    "hsla(219, 78%, 53%, 0.65)",
    "hsla(219, 78%, 53%, 0.75)",
    "hsla(219, 78%, 53%, 0.85)",
    "hsla(219, 78%, 53%, 0.85)"
  ];
  function outputUpdate(yr) {
    document.querySelector('#Election').value = yr;
  }


  map.on('load', function() {
    map.addSource('voting', {
      'type': 'vector',
      'url': 'mapbox://jjkoher.5yhiu5wn'
      //'generateId': true
    });

    map.addLayer({
      'id': 'votemap',
      'source': 'voting',
      'source-layer': '2000_2016',
      'type': 'fill',
      'paint': {
        'fill-color': createFillColor('2000'),
        "fill-opacity": ["case",
          ["boolean", ["feature-state", "hover"], false],
          .2,
          1
        ]
      }
    }, 'waterway-label');

    for (i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var color = colors[i];
      var item = document.createElement('div');
      var key = document.createElement('span');
      key.className = 'legend-key';
      key.style.backgroundColor = color;

      var value = document.createElement('span');
      value.innerHTML = layer;
      item.appendChild(key);
      item.appendChild(value);
      legend = document.getElementById('mapbox-legend');
      legend.appendChild(item);
    }

    $('#timeMachine_timelapse_dataPanes').mousemove(function(e) {
      console.log(e.offsetX, e.offsetY);
      var counties = map.queryRenderedFeatures([e.offsetX, e.offsetY], {
        layers: ['votemap']
      });
  
      if (counties.length > 0) {
        document.getElementById('pd').innerHTML = '<strong>' + counties[0].properties.NAMELSAD10 + ', ' + counties[0].properties.STCODE +
          '</strong><p><strong><em>' + (counties[0].properties[Year] * 100).toFixed(2) +
          '</strong>% Democratic vote</em></p>';
  
      } else {
        document.getElementById('pd').innerHTML = '<p>Hover over a county!</p>';
      }
    });
  
  });

  function createFillColor(year) {
    return [
      "step",
      ["get", year],
      "hsla(0, 91%, 44%, 0.85)",
      0.10,
      "hsla(0, 91%, 44%, 0.75)",
      0.25,
      "hsla(0, 91%, 44%, 0.65)",
      0.35,
      "hsla(0, 91%, 44%, 0.45)",
      0.5,
      "hsla(219, 78%, 53%, 0.45)",
      0.65,
      "hsla(219, 78%, 53%, 0.65)",
      0.75,
      "hsla(219, 78%, 53%, 0.75)",
      0.9,
      "hsla(219, 78%, 53%, 0.85)",
      1,
      "hsla(219, 78%, 53%, 0.85)"
    ];
  }

  function load_map(Year) {
    map.setPaintProperty('votemap', 'fill-color', createFillColor(Year));
  }

  document.getElementById('slider').addEventListener('input', function(e) {
    Year = e.target.value
    outputUpdate(Year)
    //console.log(Year)
    load_map(Year);
  });

  var time_step;

  function Advance() {
    time_step = setInterval(Step, 1500);
  }

  function Step() {
    if (parseInt(document.getElementById('slider').value) < 2016) {
      document.getElementById('slider').value = (String(parseInt(document.getElementById('slider').value) + 4));
      document.getElementById('slider').dispatchEvent(new Event('input'))
      console.log("It worked");
    } else {
      document.getElementById('slider').value = "2000";
      document.getElementById('slider').dispatchEvent(new Event('input'))
    }
  }

  function StopFunction() {
    clearInterval(time_step);
  }
  //document.getElementById('slider').value
  //document.getElementById('slider').dispatchEvent(new Event('input'))


  map.on('mousemove', function(e) {
    var counties = map.queryRenderedFeatures(e.point, {
      layers: ['votemap']
    });

    if (counties.length > 0) {
      document.getElementById('pd').innerHTML = '<h3><strong>' + counties[0].properties.NAMELSAD10 + ', ' + counties[0].properties.STCODE +
        '</strong></h3><p><strong><em>' + (counties[0].properties[Year] * 100).toFixed(2) +
        '</strong>% Democratic vote</em></p>';

    } else {
      document.getElementById('pd').innerHTML = '<p>Hover over a county!</p>';
    }
  });



  // When the user moves their mouse over the state-fill layer, we'll update the
  // feature state for the feature under the mouse.
  map.on("mousemove", "votemap", function(e) {
    if (e.features.length > 0) {
      if (hoveredStateId) {
        map.setFeatureState({ source: 'voting', sourceLayer: '2000_2016', id: hoveredStateId }, { hover: false });
      }
      hoveredStateId = e.features[0].id;
      map.setFeatureState({ source: 'voting', sourceLayer: '2000_2016', id: hoveredStateId }, { hover: true });
    }
  });

  // When the mouse leaves the state-fill layer, update the feature state of the
  // previously hovered feature.
  map.on("mouseleave", "votemap", function() {
    if (hoveredStateId) {
      map.setFeatureState({ source: 'voting', sourceLayer: '2000_2016', id: hoveredStateId }, { hover: false });
    }
    hoveredStateId = null;
  });
}
