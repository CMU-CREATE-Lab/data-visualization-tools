$( window ).load(function() {

    function deployslide(){
    var snaplapseForPresentationSlider = timelapse.getSnaplapseForPresentationSlider();
    if (snaplapseForPresentationSlider) {
        snaplapseViewerForPresentationSlider = snaplapseForPresentationSlider.getSnaplapseViewer();
    }
    var waypointSliderContentPath="https://docs.google.com/spreadsheets/d/1JLY9J4XYsWaz-lD8tzAIF1oBjaxIQbqe0AISt5Q48ro/edit#gid=0";
    snaplapseForPresentationSlider.gdocToJSON(waypointSliderContentPath, function(csvdata) {
        var waypointJSON = JSON.parse(snaplapseForPresentationSlider.CSVToJSON(csvdata));
        var waypointSliderContent = "#presentation=" + snaplapseForPresentationSlider.getAsUrlString(waypointJSON.snaplapse.keyframes);
        timelapse.loadSharedDataFromUnsafeURL(waypointSliderContent);
    });
    }
});

document.getElementsByClassName("snaplapse_keyframe_list").length




// custom layers list here:


// $( ".map-layer-checkbox" ).accordion();

// $(function() {
//   $(".research tr:not(.accordion)").hide();
//   $(".research tr:first-child").show();

//   $(".research tr.accordion").click(function(){
//       $(this).nextAll("tr").fadeToggle(500);
//   }).eq(0).trigger('click');
// });

// $(function() {
//   $(".map-layer-checkbox tr:not(.accordion)").hide();
//   $(".map-layer-checkbox tr:first-child").show();

//   $(".research tr.accordion").click(function(){
//       $(this).nextAll("tr").fadeToggle(500);
//   }).eq(0).trigger('click');
// });

// $('table').accordion({header: '.category' });


// $(function() {
//   $("tbody tr:not(.accordion)").hide();
//   $("tbody tr:first-child").show();

//   $("tbody tr.accordion").click(function(){
//       $(this).nextAll("tr").fadeToggle(500);
//   }).eq(0).trigger('click');
// });
// $("tbody").accordion();