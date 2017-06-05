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
refugee_video_div+=    '<div class="videotext blender">Refugee Crisis</div>'
refugee_video_div+=    '<video id="refugeevideo" poster="/static/img/earth.png" style="height:100%;position:relative;z-index:1;width:100%;" loop >'
refugee_video_div+=        '<source src="http://img.timeinc.net/time/video/time-lapse/earth-time-lapse.ogg" type="video/ogg"/>'
refugee_video_div+=    '</video>'
refugee_video_div+='</div>'
refugee_video_div+='</div>'

var pandemics_video_div=""
pandemics_video_div+='<div class="colz-6">'
pandemics_video_div+='<div class="vidContainer" id="pandemics_vid_button" style="z-index:0;width:100%;height:100%;" align:"center" onclick="tester()">'
pandemics_video_div+=  '<div class="videotext blender">Pandemics</div>'
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
introdiv1+='<div class="explainborderhead">wow</div>'
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
introdiv1+= '<button class="gbutton" onclick="goback()" style="margin-top:-100px"> test </button>'
introdiv1+='</div>'

$("#timeMachine").append(introdiv1);


$( "#explorebutton" ).click(); //for debugging, skips the explore button click part
$(".toggleLayerPanelBtn").click(); //another debugging. closes down button


// All of my touchstart events. This is faster than onClick by 300ms



$("#refugee_vid_button").bind('touchstart click', function(){
    alert("refugee clicked")
    storyclicked('refugee')
})
$("#pandemics_vid_button").bind('touchstart click', function(){
    alert("pandemics clicked")
    storyclicked('pandemics')
})

// refugee_vid_button.bind('touchstart click', function(){
//     alert("wow")
// })


var refugee_story_div=""
refugee_story_div+='<div class="colz-12">'
refugee_story_div+='TEST WOW'
refugee_story_div+='</div>'



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
    }, 1000,function(){
        console.log("complete");
        // $('#initial').remove();
        // $("#explaindiv").append(testdiv);
    });
var refugeevid = document.getElementById("refugeevideo"),
    pandemicsvid=document.getElementById("pandemicsvideo");
refugeevid.playbackRate=1;
  refugeevid.play();

  pandemicsvid.playbackRate=1;
  pandemicsvid.play();
}

function storyclicked(category){
    if (category == 'refugee'){
        $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
        }, 1000,function(){
            console.log("complete");
            // $('#initial').remove();
            // $("#explaindiv").append(testdiv);
        });
        $("#secondinitial").html("REFUGEE WOWOWOW")

    }
    if (category == 'pandemics'){
        $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
        }, 1000,function(){
            console.log("complete");
            // $('#initial').remove();
            // $("#explaindiv").append(testdiv);
        });
        $("#secondinitial").html("WOW PENDEMICS")

    }
}
function goback(){
    alert("GOING BACK!!!");
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "+=100%",
                    // height: "toggle"
        }, 1000,function(){
            console.log("complete");
            
        });
}