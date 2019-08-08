/* dateRangePicker.js
* Dependencies: jQuery library
* Lauren Zhang (laurenz@andrew.cmu.edu)
* TODO: add msg about calendar being in local time so inital start data isn't gonna show correctly?
* currently date in spreadsheet treated as local time, and timeline displays gmt time
* Possible things: calendar option to show months and/or years only
* TODO: public/private stuff
* TODO: icon
*/

"use strict";

var DateRangePicker = function DateRangePicker(){
  this.calendarLayersList = [];
  this.ignoreDefaults = false;
  this.shareLinkLayerIds = [];
  this.lockDateRange = false;
  this.utcOffset = -4;

  // on document load
  var that = this;
  $(function(){ 
    that.datepickerObj = $(".datepicker");
    that.input1 = $("#input1");
    that.input2 = $("#input2");
    that.lockDateRange = $("#lock-daterange-checkbox").val();

    that.setupDatepicker();
    that.setupCalendarToggle();
    //calendar options and layer data handled by calls form index.html

    //update layers when you click "refresh". Assume don't need to update calendarLayersList
    $( "#update-date-button").click(function(event){
      that.updateCalendarLayers();
    });
  });
};

/* PUBLIC */

// Handle calendar from page load or new layer added/removed (from data library)
DateRangePicker.prototype.handleCalendarLayers = function handleCalendarLayers(fromShareLink,layers){
  this.updateCalendarLayersList(layers); //uses activeEarthTimeLayers if layers undefined

  if (fromShareLink){ //assume layers defined
    if (this.calendarLayersList.slength > 0){    
      this.ignoreDefaults = true; //make sure turning on layers to display doesn't override date range
      this.shareLinkLayerIds = layers; //need to wait for all layers to load(not just calendar ones) before unlocking updateCalendarLayers
      // doesn't update layers until updateCalendarLayers called elsewhere for the first time
    } 
  }
  else{
    this.updateCalendarOptions(); // handle if we need to show or hide calendar too
    if (this.calendarLayersList.length > 0){    
      this.updateCalendarLayers("fromDataLibrary");
    }
  }
  
}

/* PRIVATE */

// Update layer(calendar + data) with new date range, based on state: fromShareLink, fromDataLibray, undefined
// Called when:
//   * a new date range is selected(and refresh button pressed) (undefined)
//   * when page first loaded ("fromDataLibrary")
//   * when layer turned on from data library ("fromDataLibrary")
//   * when page loaded from share link ("fromShareLink")
DateRangePicker.prototype.updateCalendarLayers = function updateCalendarLayers(origin){
  var newStartDate, newEndDate;
  console.log("update layers " + (origin || "fromCalendar"), "ignore defaults=",this.ignoreDefaults )

  // If coming from share link, first time we turn on a layer we ignore its defaults
  if(this.ignoreDefaults){
    // do not reset ignoreDefaults unless all share link layers have been turned on
    for (var i=0; i< this.shareLinkLayerIds.length; i++){
      if (!activeEarthTimeLayers.includes(this.shareLinkLayerIds[i])){
        console.log("not all share link layers on", activeEarthTimeLayers, this.shareLinkLayerIds)
        return;
      }
    }
    console.log("all share link layers on")
    this.ignoreDefaults = false;
    this.updateCalendarLayers("fromShareLink"); //fix timeline if noncalendar layer loaded last
  }
  else{
    if (origin=="fromShareLink"){ // date range from url hash
      var vals = UTIL.getUnsafeHashVars();
      newStartDate = vals['bt']
      newEndDate = vals['et']

      this.updateHighlightedRange(newStartDate, newEndDate); 
      this.updateCalendarLayersData(newStartDate, newEndDate);
    }
    else if (origin=="fromDataLibrary"){ // date range from last selected layer
      // if date range lock checked, treat as if clicking refresh calendar button
      if ($("#lock-daterange-checkbox").prop('checked')){
        this.updateCalendarLayersList();
        if (this.calendarLayersList.length > 0){
          this.updateCalendarLayers("fromCalendar");
        }
        return;
      }
      else{
        //if last selected layer is not a calendar layer, update calendar and data differently
        var lastCalLayer = this.calendarLayersList[this.calendarLayersList.length-1];
        var lastActiveId = activeEarthTimeLayers[activeEarthTimeLayers.length -1];

        if (lastCalLayer.layerId != lastActiveId){
          var lastActive = getLayer(lastActiveId);
          console.log("last active layer not calendar",activeEarthTimeLayers,lastActive)
          if (!lastActive){ return; } // last active layer is bkgd layer
          newStartDate = lastActive.layerDef["Start date"];
          newEndDate = lastActive.layerDef["End date"];
        }
        else{
          newStartDate = lastCalLayer.layerDef["Start date"];
          newEndDate = lastCalLayer.layerDef["End date"];
        }
        this.updateHighlightedRange(newStartDate, newEndDate);
        this.updateCalendarLayersData(newStartDate, newEndDate);
      }
    }
    else{ // "fromCalendar"
      var date1 = this.getDate1();
      var date2 = this.getDate2();
      if (!date1 || !date2){ //TODO err msg
        alert("Invalid date range. No layers updated.");
        return;
      } 
      date2.setHours(date2.getHours() + 23, date2.getMinutes() + 59);
      // convert calendar dates to GMT
      newStartDate = this.toGMTEarthtimeDate(date1);
      newEndDate = this.toGMTEarthtimeDate(date2);
      console.log("(local)", date1, date2, "(utc)", newStartDate, newEndDate);

      this.updateHighlightedRange(newStartDate, newEndDate);
      this.updateCalendarLayersData(newStartDate, newEndDate);
    }
  }
}

// takes Date obj, returns str YYYYMMDDHHMM format
// converts date to GMT first, then pulls out year, month, etc.
DateRangePicker.prototype.toGMTEarthtimeDate = function(d){
  var pad = function(n){ return (n < 10 ? '0' : '') + n.toString(); }
  return d.getFullYear() + pad(parseInt(d.getUTCMonth()) + 1) + 
    pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes());
}

// takes Date obj, returns str YYYYMMDDHHMM format
// pulls out year, month, etc.
DateRangePicker.prototype.toEarthtimeDate = function(d){
  var pad = function(n){ return (n < 10 ? '0' : '') + n.toString(); }
  return d.getFullYear() + pad(parseInt(d.getMonth()) + 1) + 
    pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
}

// takes YYYYMMDDHHMM date string, returns same but w timezone offset added to HH
DateRangePicker.prototype.toLocalEarthtimeDate = function(ds){
  var date = new Date(parseDateStr(ds)*1000)
  return this.toEarthtimeDate(date);
}

// Call function to update layers' data
// forceLast bool forces last layer to update its data(if selected from data library for the first time)
DateRangePicker.prototype.updateCalendarLayersData = function updateCalendarLayersData(newStartDate, newEndDate){
  console.log("update layers data");
  for(var i=0; i<this.calendarLayersList.length; i++){
    var layer = this.calendarLayersList[i];
    var refreshData = parseDateStr(layer.startDate) > parseDateStr(newStartDate) || 
        parseDateStr(layer.endDate) < parseDateStr(newEndDate);
    var isLast = (i == (this.calendarLayersList.length - 1));
    csvFileLayers.updateLayerData(layer.layerId, newStartDate, newEndDate, undefined, refreshData, isLast);
  }
}

// Update list of layers using the calendar based on layerList passed in
DateRangePicker.prototype.updateCalendarLayersList = function updateCalendarLayersList(layerList){
  layerList = layerList || activeEarthTimeLayers;
  this.calendarLayersList = [];
  for (var i=0; i< layerList.length; i++){
    var layer = getLayer(layerList[i]);
    if(layer && layer.setDataOptions && layer.setDataOptions.hasExtendedData){
      this.calendarLayersList.push(layer);
    }
  }
}

// if start and end date are in GMT time in spreadsheet, option to show timeline as local time
DateRangePicker.prototype.fixForLocalTimeline = function fixForLocalTimeline(date){
  date = this.toLocalEarthtimeDate(this.toLocalEarthtimeDate(date));
  return date;
}

// if start and end date are in GMT time in spreadsheet, option to show timeline as GMT time
DateRangePicker.prototype.fixForGMTTimeline = function fixForGMTTimeline(date){
  date = this.toLocalEarthtimeDate(date);
  return date;
}

// Called when you add/delete layers from Data Library and when page first loads
// Changes date range on calendar and determines whether calendar should be shown
// Assume already updated which active layers have calendar function
DateRangePicker.prototype.updateCalendarOptions = function updateCalendarOptions(){
  if (this.calendarLayersList.length == 0){ //hide button if no calendar layers
    // clear vals
    $('.datepicker').datepicker('setDate', null);
    $("#input1").val("");
    $("#input2").val("");
    $("#lock-daterange-checkbox").prop('checked', false);

    $("#calendar-button").hide();
    $("#datepicker-menu").hide();
  }
  else{ // show button and update date range on calendar
    var lastLayer = this.calendarLayersList[this.calendarLayersList.length - 1];
    $("#calendar-button").show();
    var minDate = lastLayer.setDataOptions.minDate; // required
    var maxDate = lastLayer.setDataOptions.maxDate || 0;
    $('.datepicker').datepicker("option","minDate", minDate);
    $('.datepicker').datepicker("option","maxDate", maxDate);
  }
}

// Setup jQuery datepicker and extra features
// Defaults: max date is current day
DateRangePicker.prototype.setupDatepicker = function setupDatepicker(){
  var that = this;
  $('.datepicker').datepicker({
    changeMonth: true,
    changeYear: true,
    //  minDate: 0,
    //  numberOfMonths: [1, 1],
    maxDate: 0,
    beforeShowDay: function(date) {
      var date1 = that.getDate1();
      var date2 = that.getDate2();
      var isHightlight =
          date1 && ((date.getTime() == date1.getTime()) || (date2 && date >= date1 && date <= date2));
      return [true, isHightlight ? "dp-highlight" : ""];
    },
    onSelect: function(dateText, inst) {
      var date1 = that.getDate1();
      var date2 = that.getDate2();
      var selectedDate = $.datepicker.parseDate($.datepicker._defaults.dateFormat, dateText);
      if (!date1 || date2) {
        $("#input1").val(dateText);
        $("#input2").val("");
        date2 = null;
      } else if (selectedDate < date1) {
        $("#input2").val($("#input1").val());
        $("#input1").val(dateText);
      } else {
        $("#input2").val(dateText);
      }
      $(this).datepicker();
    }
  });

  var that = this;
  //when date range is modified via text box, update highlighted range to match
  $("#input1").change(function(){
    var date1 = that.getDate1();
    var date2 = that.getDate2();
    if (date2 && (date1 > date2)){
      $("#input2").val($("#input1").val());
    }
    $('.datepicker').datepicker("setDate",date1)
    console.log("change date1",date1);
  });

  $("#input2").change(function(){
    var date1 = that.getDate1();
    var date2 = that.getDate2();
    if (date1 && (date1 > date2)){
      $("#input1").val($("#input2").val());
    }
    $('.datepicker').datepicker("setDate",date2)
    console.log("change date2",date2);
  });

}

DateRangePicker.prototype.getDate1 = function getDate1(){
  return $.datepicker.parseDate($.datepicker._defaults.dateFormat, $("#input1").val());
}

DateRangePicker.prototype.getDate2 = function getDate2(){
  return $.datepicker.parseDate($.datepicker._defaults.dateFormat, $("#input2").val());
}

// Set up how calendar button changes when toggled
DateRangePicker.prototype.setupCalendarToggle = function setupCalendarToggle(){
  //  var openIcon = "ui-icon-calendar";
  //  var closeIcon = "ui-icon-closethick";
  var openIcon = "custom-calendar-icon";
  var closeIcon = "custom-close-icon";
  $( ".widget input[type=submit], .widget a, .widget button" ).button();
  $( "#calendar-button" ).click( function( event ) {
    event.preventDefault();
    var menu = document.getElementById("datepicker-menu");
    menu.style.display = (menu.style.display == "inline-block" ? "none" : "inline-block");
    $( "#calendar-button" ).button({
      icons: {primary: (menu.style.display == "inline-block" ? closeIcon : openIcon)}
    });
  });

  // initial
  $( "#calendar-button" ).button({
    icons: {primary: openIcon}
  });
}

// Make calendar highlight range start to end
// start/end in form YYYYMMDDHHMMSS, treat as UTC time, will show up in calendar as local time
DateRangePicker.prototype.updateHighlightedRange = function updateHighlightedRange(start, end){
  $.datepicker._clearDate($('.datepicker'));

  // converts start/end in GMT, startDate/endDate in local
  var startDate = new Date(parseDateStr(start) * 1000);
  var endDate = new Date(parseDateStr(end) * 1000);

  console.log("update highlighted range (utc)", start, end, "(local)", startDate.toLocaleString(), endDate.toLocaleString());

  //TODO see if manually setting input is necessary
  $("#input1").val($.datepicker.formatDate("mm/dd/yy", startDate));
  $("#input2").val($.datepicker.formatDate("mm/dd/yy", endDate));
  $('.datepicker').datepicker("setDate",startDate)
  $('.datepicker').datepicker("setDate",endDate);
}