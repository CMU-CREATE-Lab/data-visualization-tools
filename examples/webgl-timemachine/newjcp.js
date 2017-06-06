$( window ).load(function() {
var introview= {center:{"lat":25.343,"lng":38.48112},"zoom":2.837}
timelapse.setNewView(introview,true)



// testing out the right sidebar with hamburger
var sidebardiv='<div id="sidebar" style="position: fixed; display: inline-block; top: 0px; height: 100%; width: 200px; right: -200px; background-color:#ff0; transition: all 0.2s ease-in-out; z-index:98;"></div>'
$("#timeMachine").append(sidebardiv);
/////





var storydiv="";
storydiv+='<div class="row">';

 // I am gonna try to implement a function for this //
var refugee_video_div=""
refugee_video_div+='<div class="colz-6">'
refugee_video_div+='<div class="vidContainer" id="refugee_vid_button" style="z-index:0;width:100%;height:100%;" align:"center">'
refugee_video_div+=    '<div class="videotext blender">Sample: Refugee</div>'
refugee_video_div+=    '<video id="refugeevideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
refugee_video_div+=        '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'
refugee_video_div+=    '</video>'
refugee_video_div+='</div>'
refugee_video_div+='</div>'

var pandemics_video_div=""
pandemics_video_div+='<div class="colz-6">'
pandemics_video_div+='<div class="vidContainer" id="pandemics_vid_button" style="z-index:0;width:100%;height:100%;" align:"center" onclick="tester()">'
pandemics_video_div+=  '<div class="videotext blender">Sample: Pandemics</div>'
pandemics_video_div+=  '<video id="pandemicsvideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
pandemics_video_div+=    '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'
pandemics_video_div+=  '</video>'
pandemics_video_div+='</div>'
pandemics_video_div+='</div>'



storydiv+='<div class="colz-12">CATEGORIES</div>'
storydiv+=refugee_video_div;
storydiv+=pandemics_video_div;




storydiv+='</div>'

var introdiv1=""
introdiv1+='<div class="explainborder" id="popupdiv">'
// introdiv1+='<div class="explainborderhead">wow</div>'
introdiv1+=     '<div class="explain blender" id="explaindiv">'
introdiv1+=         '<div id="initial">'
introdiv1+=             '<div class="row">'

introdiv1+=                 '<div class="colz-4" id="firstinitial">'
introdiv1+=             'EARTH </br> Timelapse </br>'
introdiv1+=             '<button class="gbutton" id="explorebutton" style="margin-top:50px;" onclick="exploreclicked()"> Explore &nbsp &#10095</button></a>'
introdiv1+=                 '</div>'
introdiv1+=                 '<div class="colz-4">'
introdiv1+=storydiv;
introdiv1+=                     '</div>'

introdiv1+=                 '<div class="colz-4" id="secondinitial">'

introdiv1+=                 '</div>'
introdiv1+=             '</div>'
introdiv1+=         '</div>'
introdiv1+=     '</div>'
// introdiv1+='<div class="explainborderhead">wow</div>'
introdiv1+= '<div style="text-align:center">'
introdiv1+= '<button class="jcpnavbutton" onclick="goback()" style="margin-top:-100px"> &#10094 </button>'
introdiv1+= '<button class="jcpnavbutton" onclick="hideintro()" style="margin-top:-100px">close intro </button>'
introdiv1+= '<button class="jcpnavbutton" onclick="goforward()" style="margin-top:-100px"> &#10095 </button>'
introdiv1+= '</div>'
introdiv1+='</div>'

$("#timeMachine").append(introdiv1);


// $( "#explorebutton" ).click(); //for debugging, skips the explore button click part

$(".toggleLayerPanelBtn").click(); //another debugging. closes down button


// All of my touchstart events. This is faster than onClick by 300ms



$("#refugee_vid_button").bind('touchstart click', function(){
    // alert("refugee clicked")
    storyclicked('refugee')
})
$("#pandemics_vid_button").bind('touchstart click', function(){
    // alert("pandemics clicked")
    storyclicked('pandemics')
})

// refugee_vid_button.bind('touchstart click', function(){
//     alert("wow")
// })




var intro_button=""
intro_button+="<button class='jcpButton'onclick='showintro()'>JCP Intro test</button>";
$("#timeMachine").append(intro_button);



//videos

var refugeevid = document.getElementById("refugeevideo"),
    pandemicsvid=document.getElementById("pandemicsvideo");
refugeevid.playbackRate=1;
  refugeevid.play();

  pandemicsvid.playbackRate=1;
  pandemicsvid.play();
});


function toggle_sidebar()
{
    var sidebar = document.getElementById("sidebar");        
    console.log(sidebar.style.left);
    if(sidebar.style.right == "-200px"){
        sidebar.style.right = "0px";
    }
    else{
        sidebar.style.right = "-200px";
    }
}

var testdiv="<div id='try'>test</div>"
function exploreclicked(){
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
    }, 500,function(){
        console.log("complete");
        // $('#initial').remove();
        // $("#explaindiv").append(testdiv);
    });

}


var refugee_story_div=""
refugee_story_div+='<div class="colz-12">'
refugee_story_div+="Refugee Crisis"
refugee_story_div+='</div>'
refugee_story_div+='<div class="colz-6">'
refugee_story_div+='<img src="jcpassets/refugee.jpg" style="width:90%;height:auto;"/>'
refugee_story_div+='</div>'
refugee_story_div+='<div class="colz-6">'
refugee_story_div+='<div style="font-size:1vw;text-align:left;">'
refugee_story_div+='Refugee crisis can refer to movements of large groups of displaced persons, who could be either internally displaced persons, refugees or other migrants. It can also refer to incidents in the country of origin or departure, to large problems whilst on the move or even after arrival in a safe country that involve large groups of displaced persons.'
refugee_story_div+="Back in 2006, there were 8.4 million UNHCR registered refugees worldwide, which was the lowest number since 1980. At the end of 2015, there were 16.1 million refugees worldwide. When adding the 5.2 million Palestinian refugees who are under UNRWA's mandate there are 21.3 million refugees worldwide. The overall forced displacement worldwide has reached to a total of 65.3 million displaced persons in the end of 2015, while it was 59.5 million 12 months earlier. One in every 113 people globally is an asylum seeker or a refugee. In 2015, the total number of displaced people worldwide, including refugees, asylum seekers and internally displaced persons, was at its highest level on record."
refugee_story_div+='</div>'
refugee_story_div+='</div>'

var pandemics_story_div=""
pandemics_story_div+='<div class="colz-12">'
pandemics_story_div+="Pandemics"
pandemics_story_div+='</div>'
pandemics_story_div+='<div class="colz-6">'
pandemics_story_div+='<img src="jcpassets/pandemics.jpg" style="width:90%;height:auto;"/>'
pandemics_story_div+='</div>'
pandemics_story_div+='<div class="colz-6">'
pandemics_story_div+='<div style="font-size:1vw;text-align:left;">'
pandemics_story_div+='A pandemic (from Greek πᾶν pan "all" and δῆμος demos "people") is an epidemic of infectious disease that has spread through human populations across a large region; for instance multiple continents, or even worldwide. A widespread endemic disease that is stable in terms of how many people are getting sick from it is not a pandemic. Further, flu pandemics generally exclude recurrences of seasonal flu. Throughout history, there have been a number of pandemics, such as smallpox and tuberculosis. One of the most devastating pandemics was the Black Death, killing over 75 million people in 1350. The most recent pandemics include the HIV pandemic as well as the 1918 and 2009 H1N1 pandemics.'
pandemics_story_div+='</div>'
pandemics_story_div+='</div>'

function storyclicked(category){
    if (category == 'refugee'){
        $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
        }, 500,function(){
            console.log("complete");
            // $('#initial').remove();
            // $("#explaindiv").append(testdiv);
        });
        $("#secondinitial").html(refugee_story_div)


    }
    if (category == 'pandemics'){
        $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
        }, 500,function(){
            console.log("complete");
            // $('#initial').remove();
            // $("#explaindiv").append(testdiv);
        });
        $("#secondinitial").html(pandemics_story_div)

    }
}
function goback(){
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "+=100%",
                    // height: "toggle"
        }, 500,function(){
            console.log("complete");
            
        });
}
function goforward(){
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
        }, 500,function(){
            console.log("complete");
            
        });
}
function hideintro(){
    $(".explainborder").hide();
}
function showintro(){
    $(".explainborder").show();
}

//hiding .presentationSlider
function hide_presentationSlider(){
    $(".presentationSlider").hide();
    // $(".player").css("bottom","0px")
    // $("#timeMachine_timelapse").css("bottom")
}
function show_presentationSlider(){
    $(".presentationSlider").show();
}

////

// implement fullscreen mode?

// implement hide intro custom button here




// implement show intro custom button here

// "waypointSliderContentPath":"https://docs.google.com/spreadsheets/d/1JLY9J4XYsWaz-lD8tzAIF1oBjaxIQbqe0AISt5Q48ro/edit#gid=1186806884", //very faster loading purpose
//  "waypointSliderContentPath":"https://docs.google.com/spreadsheets/d/1JLY9J4XYsWaz-lD8tzAIF1oBjaxIQbqe0AISt5Q48ro/edit#gid=1769400286", // bit faster loading purpose


// bottom div story stuff here


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


// document.getElementsByClassName("snaplapse_keyframe_list").length


