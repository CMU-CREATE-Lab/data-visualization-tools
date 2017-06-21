
//Todo: Expert mode must load expert presentation bar on the bottom of the screen.
$( window ).load(function() {
    // disableTimeMachine();
    //   $(".presentationSlider").hide();
    

var introview= {center:{"lat":25.343,"lng":38.48112},"zoom":2.837}
timelapse.setNewView(introview,true)

var introdiv1=""
introdiv1+='<div class="explainborder" id="popupdiv">'
////////////////////////////////////   #initial is set as 300% to have 3 different screens
introdiv1+='<div class="explainborderhead">'
introdiv1+= "<button class='expertmodeButton' onclick='startExpert()'>Expert</button>"
introdiv1+='</div>'
introdiv1+='<div class="explainborderleft" onclick="goback()">'
introdiv1+='&#10094'
introdiv1+='</div>'
introdiv1+='<div class="explainborderright" onclick="goforward()">'
introdiv1+='&#10095 '
introdiv1+='</div>'
introdiv1+=     '<div class="explain blender" id="initial">'
introdiv1+=         '<div class="row">'
introdiv1+=             '<div class="colz-4" id="firstinitial">'
introdiv1+=                 'EARTH </br> Timelapse </br>'
introdiv1+=                 '<button class="gbutton" id="explorebutton" style="margin-top:50px;" onclick="exploreclicked()"> Explore &nbsp &#10095</button></a>'
introdiv1+=             '</div>'
introdiv1+=             '<div class="colz-4" style="overflow:scroll">'
introdiv1+=                 '<div class="colz-12 storieshead">Explore</div>'
introdiv1+=                 '<div id="video_div_here"></div>'
introdiv1+=             '</div>'
introdiv1+=                 '<div class="colz-4" id="secondinitial">'
introdiv1+=             '</div>'
introdiv1+=         '</div>'
introdiv1+=     '</div>'
introdiv1+='<div class="explainborderbottom">'
introdiv1+='</div>'
introdiv1+='</div>'


// var directionnav=""
// directionnav+='<div class="bottomDirectionNav ">'
// directionnav+='<div style="text-align:center;">'
// directionnav+=             '<button class="jcpnavbutton" id="backbutton" onclick="goback()" style="margin-top:-100px"> &#10094 </button>'
// directionnav+=             '<button class="jcpnavbutton" id="introopenclosebutton" onclick="hide_intro()" style="margin-top:-100px">- </button>'
// directionnav+=             '<button class="jcpnavbutton" id="forwardbutton" onclick="goforward()" style="margin-top:-100px"> &#10095 </button>'
// directionnav+='</div>'
// directionnav+='</div>'

$("#timeMachine").append(introdiv1)
$(".explainborderleft").hide();
// $("#timeMachine").append(directionnav) 


$(".explainborderright").height()
$(".explainborderright").css("padding-top","40px;")

function createStoryDiv(){
    var col=STORIES_CONFIG.column_numbers;
    var stories=STORIES_CONFIG.story_lists;
   
    for (key in stories){
        console.log(key);
        var s=key+"_video_div"
        window[s]="";
        window[s]+='<div class="colz-'+String(12/col)+'">'
        window[s]+='<div class="vidContainer" id="'+key+'_vid_button" >'
        window[s]+=    '<div class="videotext blender">'+STORIES_CONFIG.story_lists[key].heading_text +'</div>'
        window[s]+=    '<video id="'+key+'video" poster="jcpassets/pandemics.jpg" onclick=storyclicked("'+String(key) +'") loop >'
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
    var introbutton=""
        introbutton+="<button class='intro_button'onclick='show_intro()'>Show Intro</button>"
    if ($("#layers-list").hasClass("hide-layers-list")){
        console.log("closed")
         $(".relatableContent").remove();
        // show_intro();
        // $(".intro_button").remove();
    }
    else{
        console.log("open");
         $(".relatableContent").remove();
        //  expertSlide("https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=0")
        // hide_intro();
        // $(".intro_button").remove();
        // $("#timeMachine").append(introbutton);
    }    
})



// show intro button next to the share button
var intro_show_button=""
intro_show_button+="<button class='show_intro_button'onclick='show_intro()'>Show Intro</button>";
$("#timeMachine").append(intro_show_button);

// Full Screen button next to show intro button
var full_screen_button=""
full_screen_button+="<button class='full_screen_button'onclick='fullScreenMode()'>Full Screen</button>";
// $("#timeMachine").append(full_screen_button);

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
    }, 500);
    $(".explainborderleft").show();
    $(".explainborder").css("overflow-y","scroll")
    // $(".explainborderright").hide();
}

function populatestory(category){
    window[category+"_story_div"]=""
    window[category+"_story_div"]+='<div class="colz-12">'
    window[category+"_story_div"]+=STORIES_CONFIG.story_lists[category].heading_text
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<div class="colz-6">'
    window[category+"_story_div"]+='<img src="'+STORIES_CONFIG.story_lists[category].img_url +'"style="width:90%;height:auto;"/>'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<div class="colz-6">'
    window[category+"_story_div"]+='<div style="font-size:2vh;height:40vh;text-align:left; overflow-y: scroll;margin-right:10%;">'
    for (var i=0;i<STORIES_CONFIG.story_lists[category].img_descript.length;i++){ // this is in paragraph form. It uses array of "img_descript"
        window[category+"_story_div"]+=STORIES_CONFIG.story_lists[category].img_descript[i];
        if (i==STORIES_CONFIG.story_lists[category].img_descript.length-1){
            window[category+"_story_div"]+='</br>'
        }
    }
    window[category+"_story_div"]+='A pandemic (from Greek πᾶν pan "all" and δῆμος demos "people") is an epidemic of infectious disease that has spread through human populations across a large region; for instance multiple continents, or even worldwide. A widespread endemic disease that is stable in terms of how many people are getting sick from it is not a pandemic. Further, flu pandemics generally exclude recurrences of seasonal flu. Throughout history, there have been a number of pandemics, such as smallpox and tuberculosis. One of the most devastating pandemics was the Black Death, killing over 75 million people in 1350. The most recent pandemics include the HIV pandemic as well as the 1918 and 2009 H1N1 pandemics.'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='</div>'
    window[category+"_story_div"]+='<button class="tourButton" onClick="startTour('+"'"+category+"'" +')">Open Timelapse</button>'
    $("#secondinitial").html(window[category+"_story_div"])
}

function storyclicked(category){ // this uses storiesjcp.js configuration file
    $(".explainborder").scrollTop(0);
    $(".explainborder").css("overflow-y","hidden")
    populatestory(category);
    $( "#initial" ).animate({
        opacity: 1,
        left: "-=100%",
        }, 500);
        deploySlide(String(category));
}

function goback(){
    $(".explainborder").scrollTop(0);
    $(".explainborder").css("overflow-y","hidden")
    if ($("#initial").css("left")!="0px"){
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "+=100%",
                    // height: "toggle"
        }, 500,function(){

            if ($("#initial").css("left") == "0px"){
                $(".explainborderleft").hide();
                $(".explainborder").css("overflow-y","hidden")
            }
            else{
                $(".explainborder").css("overflow-y","scroll")
            }
            
            
        });
    }
}
function goforward(){
    $( "#initial" ).animate({
                    opacity: 1,
                    left: "-=100%",
                    // height: "toggle"
        }, 500,function(){
            console.log("complete");
            
        });
    $(".explainborderleft").show();
}
function hide_intro(){
   $(".explainborder").hide("slide", {direction: "up" }, "slow");
}
function show_intro(){
    $(".relatableContent").remove();
    $(".explainborder").show();
    if (!$("#layers-list").hasClass("hide-layers-list")){
        $(".toggleLayerPanelBtn").click(); 

    }
}

// var snaplapseForPresentationSlider = timelapse.getSnaplapseForPresentationSlider();
// snaplapseForPresentationSlider.addEventListener('snaplapse-loaded', function() {
//            $(".presentationSlider").hide();
// });

function deploySlide(gurl){

    gurl=STORIES_CONFIG.story_lists[gurl]
    gurl=gurl.slide_url;
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

function expertSlide(url){
    var snaplapseForPresentationSlider = timelapse.getSnaplapseForPresentationSlider();
    if (snaplapseForPresentationSlider) {
        snaplapseViewerForPresentationSlider = snaplapseForPresentationSlider.getSnaplapseViewer();
    }
    var waypointSliderContentPath=url;
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

// todo: relationship graph should go here instead of hardcoding everything. Use CONNECTION_CONFIG from storiesjcp.js
function startTour(category){
     hide_intro();
     $(".snaplapse_keyframe_list_item_thumbnail_overlay_presentation")[0].click();
     var relatableContent="";
     relatableContent+='<div class="relatableContent">'
     relatableContent+='<div class="relatableContentHead">How does '+category+' relate to...</div>'
     r_categories=CONNECTION_CONFIG[String(category)]
     console.log(r_categories)
     console.log(r_categories.length);
     for (var i=0;i<r_categories.length;i++){
         relatableContent+=     '<button class="contentButton"  onclick="getintroagain('+"'"+r_categories[i]+"'"+')">'+r_categories[i]+'</button></br>'
     }
    //  relatableContent+=     '<button class="contentButton"  onclick="getintroagain('+"'"+"refugee"+"'"+')">Refugee</button></br>'
    //  relatableContent+=     '<button class="contentButton"  onclick="getintroagain('+"'"+"pandemics"+"'"+')">Pandemics</button></br>'
    //  relatableContent+=     '<button class="contentButton" onclick="getintroagain('+"'"+"urbanization"+"'"+')">Urbanization</button></br>'
    //  relatableContent+='<button class="reopenButton" onclick="show_intro()">Back to Stories</button></br>'
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
     $(".relatableContent").remove();
    populatestory(category);
    show_intro();

    deploySlide(String(category));
}



function disableTimeMachine(){
    $(".player").css("pointer-events","none");
}
function enableTimeMachine(){
    $(".player").css("pointer-events","auto");
}

function startExpert(){
    hide_intro();
    expertSlide("https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=0")

}
