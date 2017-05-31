

$( window ).load(function() {
  // $(".presentationSlider").css("display","none");
/////////////////////////////////
  var logoplace=""
  var logoimg=""
  logoimg+='<img src="jcpassets/create.png" style="width:100%;height:100%;"/>'
  logoplace+="<div class='customLogo'>"
  logoplace+=logoimg
  logoplace+="</div>"

  buttonTemp="";
  buttonTemp+="<button class='buttonTemp'>"
  buttonTemp+='<i class="fa fa-location-arrow fa-2x" aria-hidden="true"></i>'
  buttonTemp+="</div>"
  $(".location_search_div").append(buttonTemp);
  $(".location_search_div").append(logoplace);

  var storylist=["Pandemics","Refugee",""];

  mapselector="";
  mapselector+="<div class='soflow'>"
  mapselector+="<select id= 'storyoptions'>";
  mapselector+="<option id='landsat-base' name='base-layers' value='landsat'>Free Mode</option>";
  mapselector+="<option id='light-base' name='base-layers' value='light'>Pandemics</option>";
  mapselector+="<option  id='dark-base' name='base-layers' value='dark'>Refugee</option>";
    mapselector+="<option  id='dark-base' name='base-layers' value='dark'>Urbanization</option>";
  mapselector+="</select>";
  mapselector+="</div>";

  $(".location_search_div").append(mapselector);



  var slidevis=true;
  $(".share").removeClass("customButton ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary");
  $(".share").addClass("jcpshare");
  $(".share").html('<i class="fa fa-link fa-2x" aria-hidden="true"></i>');
  var leftnav="";
  var leftButton1="";
  leftButton1="";
  leftButton1+="<button class='button1'>"
  leftButton1+='<img src="jcpassets/layers-2x.png" style="width:40px;height:30px;"/>'
  leftButton1+='<span id="buttonfont">Layer Selector</span>'
  leftButton1+="</button>"


  leftnav+="<div class='jcpLeftNav'>";
  leftnav+=leftButton1;
  // leftnav+=leftButton2;
  // leftnav+=leftButton3;
  // leftnav+=leftButton4;
  leftnav+="</div>";
  $("#timeMachine").append(leftnav);



  var otherbutton="";

  tempbuttonpressed=false;

  jcpScreen="";
  jcpScreen+="<div class='jcpScreen'>";
  jcpScreen+="wow";
  jcpScreen+="</div>";


  
////////////////
//layer button
var layerNav='';
layerNav+="<div class='layerNav'>";
var ebutton="";
  ebutton+="<button class='ebutton'>"
  // ebutton+='<i class="fa fa-globe fa-3x" aria-hidden="true" style="color:green"></i>'
  ebutton+="</button>"
   ebutton+="<button class='ebutton'>"
  // ebutton+='<i class="fa fa-globe fa-3x" aria-hidden="true" style="color:#aaa;"></i>'
  ebutton+="</button>"
   ebutton+="<button class='ebutton'>"
  // ebutton+='<i class="fa fa-globe fa-3x" aria-hidden="true" style="color:#000;"></i>'
  ebutton+="</button>"
  layerNav+=ebutton;
layerNav+="</div>"

 
 $(".location_search_div").append(layerNav);


//////////////




//  var toggleIconClose = "ui-icon-arrowthick-1-ne";
//   var toggleIconOpen = "ui-icon-arrowthick-1-sw";


$('.button1').click(function () {
  console.log("layers clicked");
  $("#layers-list").scrollTop(0);
  if ($("#layers-list").hasClass("hide-layers-list")) {
    $("#layers-list").removeClass("hide-layers-list");
    $(this).css("top", "3px");
  } 
  else {
    $("#layers-list").addClass("hide-layers-list");
    $(this).css("top", "0px");
  }
  
});







// presentationSlider


var map_html = '';


var landsat_base_str = '<label class="landsat-select" for="landsat-base" name="blsat"><input type="radio" id="landsat-base" name="base-layers" value="landsat"/>Earth Engine Timelapse<span class="credit"> (Google)</span></label>';
var landsat_base = '<td colspan="2">' + landsat_base_str + '</td>';
var light_base = '<td><label for="light-base" name="blte"><input type="radio" id="light-base" name="base-layers" value="light"/><span>Light Map</span></label></td>';
var dark_base = '<td><label for="dark-base" name="bdrk"><input type="radio" id="dark-base" name="base-layers" value="dark"/><span>Dark Map</span></label></td>';

map_html += '<div style="position:absolute;z-index:50;>';
map_html += ' <table cellspacing="3">';
map_html += '   <tr>';
map_html += landsat_base;
map_html += '   </tr>';
map_html += '   <tr>';
map_html += light_base;
map_html += '   </tr>';
map_html += '   <tr>';
map_html += dark_base;
map_html += '   </tr>';
map_html += '</table>';
map_html += '</div>';
// $("#timeMachine").append(map_html);


$("#layers-list").addClass("hide-layers-list");



//

      // Base layers
      $("input:radio[name=base-layers]").on("click", function() {
        visibleBaseMapLayer = $(this).val();
        if (visibleBaseMapLayer == "landsat" && previousVisibleBaseMapLayer != "landsat") {
          setActiveLayersWithTimeline(1);
          if (!showViirsLayer) {
            timelineType = "customUI";
          }
          $(".googleLogo").show();
        } else if (visibleBaseMapLayer != "landsat") {
          if (previousVisibleBaseMapLayer == "landsat")
            setActiveLayersWithTimeline(-1);
          timelineType = "none";
          $(".googleLogo").hide();
        }
        previousVisibleBaseMapLayer = visibleBaseMapLayer;
      });
// Set the starting base layer
      $('input:radio[name=base-layers][id=' + visibleBaseMapLayer + '-base]').prop('checked', true);

//





$(".base-map-radio").remove();
var introdiv1=""
introdiv1+='<div class="explainborder" id="popupdiv">'
introdiv1+='<div class="explain blender">'
introdiv1+='<div class="initial">'
introdiv1+='EARTH </br> Timelapse </br>'
introdiv1+='<button class="gbutton" id="explorebutton" style="margin-top:50px;" onclick="exploreclicked()"> Explore &nbsp &#10095</button></a>'
introdiv1+='</div>'
introdiv1+='</div>'
introdiv1+='</div>'

$("#timeMachine").append(introdiv1);




// $( "#explorebutton" ).click(); //for debugging, skips the explore button click part


/////// Intro Addition ///////

});

function tester(){
  alert("wow")
}
var storydiv="";
storydiv+='<div class="row">';


var refugeediv=""
refugeediv+='<div class="colz-3">'
refugeediv+='<div class="vidContainer" style="z-index:0;width:100%;height:100%;" align:"center">'
refugeediv+=  '<div class="videotext blender" style="position:absolute; text-align:center; z-index:10;">Refugee Crisis</div>'
refugeediv+=  '<video id="refugeevideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
refugeediv+=    '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'

refugeediv+=    '<source src="jcpassets/mov/sea-level-rise-4c.mp4" type="video/ogg"/>'

refugeediv+=  '</video>'
refugeediv+='</div>'
refugeediv+='</div>'

var pandemicsdiv=""
pandemicsdiv+='<div class="colz-3">'
// pandemicsdiv+='<a href = "">'
pandemicsdiv+='<div class="vidContainer" style="z-index:0;width:100%;height:100%;" align:"center" onclick="tester()">'
pandemicsdiv+=  '<div class="videotext blender" style="position:absolute; text-align:center; z-index:10;">Pandemics</div>'
pandemicsdiv+=  '<video id="pandemicsvideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
pandemicsdiv+=    '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'
pandemicsdiv+=    '<source src="jcpassets/mov/refugee.mp4" type="video/ogg"/>'
pandemicsdiv+=  '</video>'
pandemicsdiv+='</div>'
// pandemicsdiv+='</a>'
pandemicsdiv+='</div>'

var urbanizationdiv=""
urbanizationdiv+='<div class="colz-3">'
urbanizationdiv+='<div class="vidContainer" style="z-index:0;width:100%;height:100%;" align:"center">'
urbanizationdiv+=  '<div class="videotext blender" style="position:absolute; text-align:center; z-index:10;">Urbanization</div>'
urbanizationdiv+=  '<video id="urbanizationvideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
urbanizationdiv+=    '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'
urbanizationdiv+=  '</video>'
urbanizationdiv+='</div>'
urbanizationdiv+='</div>'

var climatediv=""
climatediv+='<div class="colz-3">'
climatediv+='<div class="vidContainer" style="z-index:0;width:100%;height:100%;" align:"center">'
climatediv+=  '<div class="videotext blender" style="position:absolute; text-align:center; z-index:10;">Climate</div>'
climatediv+=  '<video id="climatevideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
climatediv+=    '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'
climatediv+=  '</video>'
climatediv+='</div>'
climatediv+='</div>'


storydiv+='<div class="colz-12">Hello World</div>'
storydiv+=pandemicsdiv;
storydiv+=refugeediv;
storydiv+=urbanizationdiv;
storydiv+=climatediv;
// storydiv+=window["testdiv"];

for (var i = 0;i<8;i++){
  window[i]=climatediv;
  storydiv+=window[i];
}

storydiv+='</div>'



function exploreclicked(){
  $(".explain").html(storydiv)
  // $(".explain").append(pandemicsdiv)
  var refugeevid = document.getElementById("refugeevideo"),
    pandemicsvid=document.getElementById("pandemicsvideo"),
    urbanizationvid=document.getElementById("urbanizationvideo");
    climatevid=document.getElementById("climatevideo");
  refugeevid.playbackRate=1;
  refugeevid.play();

  pandemicsvid.playbackRate=1;
  pandemicsvid.play();

  urbanizationvid.playbackRate=1;
  urbanizationvid.play();

  climatevid.playbackRate=1;
  climatevid.play();
  // $(".explain").remove();
  // $("#timeMachine").append(storydiv);
  console.log("wow")
}
