$( window ).load(function() {
var introview= {center:{"lat":25.343,"lng":38.48112},"zoom":2.837}
timelapse.setNewView(introview,true)



// testing out the right sidebar with hamburger
var sidebardiv='<div id="sidebar" style="position: fixed; display: inline-block; top: 0px; height: 100%; width: 200px; right: -200px; background-color:#ff0; transition: all 0.2s ease-in-out; z-index:98;"></div>'
$("#timeMachine").append(sidebardiv);
/////

var introdiv1=""
introdiv1+='<div class="explainborder" id="popupdiv">'
introdiv1+=     '<div class="explain blender" id="explaindiv">'
introdiv1+=         '<div id="initial">'
introdiv1+=             'EARTH </br> Timelapse </br>'
introdiv1+=             '<button class="gbutton" id="explorebutton" style="margin-top:50px;" onclick="exploreclicked()"> Explore &nbsp &#10095</button></a>'
introdiv1+=         '</div>'
introdiv1+=     '</div>'
introdiv1+='</div>'

$("#timeMachine").append(introdiv1);

// var test="<div class='explaincontainer'>z</div>"
// $("#timeMachine").append(test);




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
                    left: "-=50",
                    // height: "toggle"
    }, 1000,function(){
        console.log("complete");
        $('#initial').remove();
        $("#explaindiv").append(testdiv);
    });

}