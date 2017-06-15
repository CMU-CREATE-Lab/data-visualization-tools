////// THIS IS WHERE ALL THE WINDOW LOAD STARTS
$( window ).load(function() {
    // disableTimeMachine();

var introview= {center:{"lat":25.343,"lng":38.48112},"zoom":2.837}
timelapse.setNewView(introview,true)




var introdiv1=""
introdiv1+='<div class="explainborder" id="popupdiv">'
////////////////////////////////////   #initial is set as 300% to have 3 different screens
introdiv1+='<div class="explainborderhead">'
introdiv1+='</div>'
introdiv1+='<div class="explainborderleft">'
introdiv1+='</div>'
introdiv1+='<div class="explainborderright"> &#10095'
introdiv1+='</div>'
introdiv1+=     '<div class="explain blender" id="initial">'
introdiv1+=         '<div class="row">'
introdiv1+=             '<div class="colz-4" id="firstinitial">'
introdiv1+=                 'EARTH </br> Timelapse </br>'
introdiv1+=                 '<button class="gbutton" id="explorebutton" style="margin-top:50px;" onclick="exploreclicked()"> Explore &nbsp &#10095</button></a>'
introdiv1+=             '</div>'
introdiv1+=             '<div class="colz-4" >'
introdiv1+=                 '<div class="colz-12 storieshead">Explore</div>'
introdiv1+=                 '<div id="video_div_here"></div>'
// introdiv1+=                 storydiv;
introdiv1+=             '</div>'
introdiv1+=                 '<div class="colz-4" id="secondinitial">'
introdiv1+=             '</div>'
introdiv1+=         '</div>'
introdiv1+=     '</div>'
introdiv1+='<div class="explainborderbottom">'
introdiv1+='</div>'
introdiv1+='</div>'


var directionnav=""

directionnav+='<div class="bottomDirectionNav ">'
directionnav+='<div style="text-align:center;">'
directionnav+=             '<button class="jcpnavbutton" onclick="goback()" style="margin-top:-100px"> &#10094 </button>'
directionnav+=             '<button class="jcpnavbutton" onclick="hide_intro()" style="margin-top:-100px">close intro </button>'
directionnav+=             '<button class="jcpnavbutton" onclick="goforward()" style="margin-top:-100px"> &#10095 </button>'
directionnav+='</div>'
directionnav+='</div>'

$("#timeMachine").append(introdiv1)
$("#timeMachine").append(directionnav)





function createStoryDiv(){
    var col=STORIES_CONFIG.column_numbers;
    var stories=STORIES_CONFIG.story_lists;
   
    for (key in stories){
        console.log(key);
        var s=key+"_video_div"
        window[s]="";
        window[s]+='<div class="colz-'+String(12/col)+'">'
        window[s]+='<div class="vidContainer" id="'+key+'_vid_button" onclick=storyclicked("'+String(key) +'")>'
        window[s]+=    '<div class="videotext blender">'+STORIES_CONFIG.story_lists[key].heading_text +'</div>'
        window[s]+=    '<video id="'+key+'video" poster="/static/img/earth.png" loop >'
        window[s]+=        '<source src="'+STORIES_CONFIG.story_lists[key].vid_url+'" type="video/ogg"/>'
        window[s]+=    '</video>'
        window[s]+='</div>'
        window[s]+='</div>'
        // console.log(window[s])
        $("#video_div_here").append(window[s]);
        document.getElementById(key+"video").play();
        var vidbutton=key+"_vid_button"
       
    }
}
createStoryDiv();


$(".toggleLayerPanelBtn").click(); 
$(".toggleLayerPanelBtn").click(function(){
    alert("wow")
    var introbutton=""
    introbutton+="<button class='intro_button'onclick='show_intro()'>Show Intro</button>"
    $("#timeMachine").append(introbutton);
})



// show intro button next to the share button
var intro_show_button=""
intro_show_button+="<button class='show_intro_button'onclick='show_intro()'>Show Intro</button>";
$("#timeMachine").append(intro_show_button);

// Full Screen button next to show intro button
var full_screen_button=""
full_screen_button+="<button class='full_screen_button'onclick='fullScreenMode()'>Full Screen</button>";
$("#timeMachine").append(full_screen_button);

});





/////////////////////////////////
function hide_presentationSlider(){
    $(".presentationSlider").hide();

}
function show_presentationSlider(){
    $(".presentationSlider").show();
}
function hide_customControl(){
    $(".customControl").hide();
    // $(".player").css("bottom","0px")
    // $("#timeMachine_timelapse").css("bottom")
}
function show_customControl(){
    $(".customControl").show();
}
var fullscreenstat=0;
function fullScreenMode(){
    if (fullscreenstat==0){
         $(".full_screen_button").html("Exit Full Screen");
         fullscreenstat=1;
         enter_fullScreenMode();

    }
    else {
         $(".full_screen_button").html("Full Screen")
         exit_fullScreenMode();
         fullscreenstat=0;
    }
}
function enter_fullScreenMode(){
    hide_presentationSlider();
    hide_customControl();
    hide_intro();

}
function exit_fullScreenMode(){
    show_presentationSlider();
    show_customControl();
}




function exploreclicked(){
    hide_presentationSlider();
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
    }, 500,function(){
        console.log("complete");

    });

}

function storyclicked(category){ // this uses storiesjcp.js configuration file
    window[category+"_story_div"]=""
    window[category+"_story_div"]+='<div class="colz-12">'
    window[category+"_story_div"]+=STORIES_CONFIG.story_lists[category].heading_text
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<div class="colz-6">'
    window[category+"_story_div"]+='<img src="'+STORIES_CONFIG.story_lists[category].img_url +'"style="width:90%;height:auto;"/>'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<div class="colz-6">'
    window[category+"_story_div"]+='<div style="font-size:1vw;height:50vh;text-align:left; overflow-y: scroll;">'
    for (var i=0;i<STORIES_CONFIG.story_lists[category].img_descript.length;i++){ // this is in paragraph form. It uses array of "img_descript"
        window[category+"_story_div"]+=STORIES_CONFIG.story_lists[category].img_descript[i];
        if (i==STORIES_CONFIG.story_lists[category].img_descript.length-1){
            window[category+"_story_div"]+='</br>'
        }
    }
    window[category+"_story_div"]+='A pandemic (from Greek πᾶν pan "all" and δῆμος demos "people") is an epidemic of infectious disease that has spread through human populations across a large region; for instance multiple continents, or even worldwide. A widespread endemic disease that is stable in terms of how many people are getting sick from it is not a pandemic. Further, flu pandemics generally exclude recurrences of seasonal flu. Throughout history, there have been a number of pandemics, such as smallpox and tuberculosis. One of the most devastating pandemics was the Black Death, killing over 75 million people in 1350. The most recent pandemics include the HIV pandemic as well as the 1918 and 2009 H1N1 pandemics.'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<button class="tourButton" onClick="startTour('+"'"+category+"'" +')">Start Tour</button>'


    $( "#initial" ).animate({
        opacity: 1,
        left: "-=100%",
        }, 500);
        $("#secondinitial").html(window[category+"_story_div"])
        deploySlide(window[category+"_url"])
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
function hide_intro(){
    $(".explainborder").hide();
}
function show_intro(){
    $(".relatableContent").remove();
    $(".explainborder").show();
}

//hiding .presentationSlider


////

// implement fullscreen mode?



//////// bottom presentation slider deployment with different google doc urls
var refugee_url="https://docs.google.com/spreadsheets/d/1JLY9J4XYsWaz-lD8tzAIF1oBjaxIQbqe0AISt5Q48ro/edit#gid=1769400286";
var pandemics_url="https://docs.google.com/spreadsheets/d/1JLY9J4XYsWaz-lD8tzAIF1oBjaxIQbqe0AISt5Q48ro/edit#gid=0";

function deploySlide(gurl){
    var snaplapseForPresentationSlider = timelapse.getSnaplapseForPresentationSlider();
    if (snaplapseForPresentationSlider) {
        snaplapseViewerForPresentationSlider = snaplapseForPresentationSlider.getSnaplapseViewer();
    }
    var waypointSliderContentPath=gurl;
    org.gigapan.Util.gdocToJSON(waypointSliderContentPath, function(csvdata) {
        var waypointJSON = JSON.parse(snaplapseForPresentationSlider.CSVToJSON(csvdata));
        var waypointSliderContent = "#presentation=" + snaplapseForPresentationSlider.getAsUrlString(waypointJSON.snaplapse.keyframes);
        timelapse.loadSharedDataFromUnsafeURL(waypointSliderContent);
    });
}

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
function startTour(category){
     $(".explainborder").hide();
     $(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation")[0].click();
     var relatableContent="";
     relatableContent+='<div class="relatableContent">'
     relatableContent+='<div class="relatableContentHead">How does '+category+' relate to...</div>'
    //  relatableContent+='<div '
     relatableContent+=     '<button class="contentButton"  onclick="getintroagain('+"'"+"refugee"+"'"+')">Refugee</button></br>'
     relatableContent+=     '<button class="contentButton"  onclick="getintroagain('+"'"+"pandemics"+"'"+')">Pandemics</button></br>'
     relatableContent+=     '<button class="contentButton" onclick="getintroagain('+"'"+"urbanization"+"'"+')">Urbanization</button></br>'
     relatableContent+='<button class="reopenButton" onclick="show_intro()">Back to Stories</button></br>'
     relatableContent+='</div>'
     $("#timeMachine").append(relatableContent);
    $(".relatableContent").animate({height:"300px"},500);
     $(".relatableContentHead").click(function(){
         if ($(".relatableContent").css("height")!="40px"){
            $(".relatableContent").animate({height:"40px"},500);
         }
         else{
             $(".relatableContent").animate({height:"300px"},500);
         }
        
     })

}


function getintroagain(category){ // this uses storiesjcp.js configuration file
    // alert(category);
     $(".relatableContent").remove();
    show_intro();
    window[category+"_story_div"]=""
    window[category+"_story_div"]+='<div class="colz-12">'
    window[category+"_story_div"]+=STORIES_CONFIG.story_lists[category].heading_text
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<div class="colz-6">'
    window[category+"_story_div"]+='<img src="'+STORIES_CONFIG.story_lists[category].img_url +'"style="width:90%;height:auto;"/>'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<div class="colz-6">'
    window[category+"_story_div"]+='<div style="font-size:1vw;height:50vh;text-align:left; overflow-y: scroll;">'
    for (var i=0;i<STORIES_CONFIG.story_lists[category].img_descript.length;i++){ // this is in paragraph form. It uses array of "img_descript"
        window[category+"_story_div"]+=STORIES_CONFIG.story_lists[category].img_descript[i];
        if (i==STORIES_CONFIG.story_lists[category].img_descript.length-1){
            window[category+"_story_div"]+='</br>'
        }
    }
    window[category+"_story_div"]+='A pandemic (from Greek πᾶν pan "all" and δῆμος demos "people") is an epidemic of infectious disease that has spread through human populations across a large region; for instance multiple continents, or even worldwide. A widespread endemic disease that is stable in terms of how many people are getting sick from it is not a pandemic. Further, flu pandemics generally exclude recurrences of seasonal flu. Throughout history, there have been a number of pandemics, such as smallpox and tuberculosis. One of the most devastating pandemics was the Black Death, killing over 75 million people in 1350. The most recent pandemics include the HIV pandemic as well as the 1918 and 2009 H1N1 pandemics.'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<button class="tourButton" onClick="startTour('+"'"+category+"'" +')">Start Tour</button>'

 $("#secondinitial").html(window[category+"_story_div"])
 deploySlide(window[category+"_url"])
}



function disableTimeMachine(){
    $(".player").css("pointer-events","none");
}
function enableTimeMachine(){
    $(".player").css("pointer-events","auto");
}