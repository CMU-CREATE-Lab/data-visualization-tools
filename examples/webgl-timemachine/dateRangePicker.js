/* dateRangePicker.js
* Dependencies: jQuery UI and date picker widget
* Lauren Zhang (laurenz@andrew.cmu.edu)
* Treat date in spreadsheet as GMT time, display calendar and timeline in local time
* Print statements left commented out in case date conventions change(GMT vs local)
*/

"use strict";

var DateRangePicker = function DateRangePicker(){
  this.calendarLayersList = [];
  this.ignoreDefaults = false;
  this.shareLinkLayerIds = [];
  this.openIcon = "custom-calendar-icon";
  this.closeIcon = "custom-close-icon";

  // on document load
  var that = this;
  $(function(){ 
    that.datepickerObj = $(".datepicker");
    that.input1 = $("#input1");
    that.input2 = $("#input2");

    setupDatepicker(that);
    setupCalendarToggle();
    //calendar options and layer data handled by calls form index.html

    //update layers when you click "refresh". Assume don't need to update calendarLayersList
    $( "#update-date-button").click(function(event){
      that.updateCalendarLayers();
    });
  });

  // Set up how calendar button changes when toggled
  function setupCalendarToggle(){
    $( "#calendar-button" ).click( function( event ) {
      event.preventDefault();
      var menu = document.getElementById("datepicker-menu");
      menu.style.display = (menu.style.display == "inline-block" ? "none" : "inline-block");
      $( "#calendar-button" ).button({
        icons: {primary: (menu.style.display == "inline-block" ? that.closeIcon : that.openIcon)}
      });
    });

    // initial
    $( "#calendar-button" ).button({
      icons: {primary: that.openIcon}
    });
  }

  // Setup jQuery datepicker and extra features. minDate is required input
  // Defaults: max date is current day
  function setupDatepicker(that){
    $('.datepicker').datepicker({
      changeMonth: true,
      changeYear: true,
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

    //when date range is modified via text box, update highlighted range to match
    $("#input1").change(function(){
      var date1 = that.getDate1();
      var date2 = that.getDate2();
      if (date2 && (date1 > date2)){
        $("#input2").val($("#input1").val());
      }
      $('.datepicker').datepicker("setDate",date1)
      //console.log("change date1",date1);
    });
    $("#input2").change(function(){
      var date1 = that.getDate1();
      var date2 = that.getDate2();
      if (date1 && (date1 > date2)){
        $("#input1").val($("#input2").val());
      }
      $('.datepicker').datepicker("setDate",date2)
      //console.log("change date2",date2);
    });
  }
};

// Handle calendar from page load or new layer added/removed (from data library)
DateRangePicker.prototype.handleCalendarLayers = function handleCalendarLayers(fromShareLink,layers){
  this.updateCalendarLayersList(layers); //uses activeEarthTimeLayers if layers undefined

  if (fromShareLink){ //assume layers defined
    if (this.calendarLayersList.length > 0){
      this.ignoreDefaults = true; //initially turning on layers won't override date range from link
      this.shareLinkLayerIds = layers; //need all layers to load before calling updateCalendarLayers
      // doesn't update layers until updateCalendarLayers called elsewhere for the first time
    } 
  }
  else{
    updateCalendarOptions(this); // hide/show calendar
    if (this.calendarLayersList.length > 0){
      this.updateCalendarLayers("fromDataLibrary");
    }
  }

  // Called when you add/delete layers from Data Library and when page first loads
  // Changes date range on calendar and determines whether calendar should be shown
  // Assume already updated which active layers have calendar function
  function updateCalendarOptions(that){
    if (that.calendarLayersList.length == 0){ //hide button if no calendar layers
      // clear vals
      $('.datepicker').datepicker('setDate', null);
      $("#input1").val("");
      $("#input2").val("");
      $("#lock-daterange-checkbox").prop('checked', false);

      $("#calendar-button").hide();
      $("#datepicker-menu").hide();
    }
    else{ // show button and update date range on calendar
      var lastLayer = that.calendarLayersList[that.calendarLayersList.length - 1];
      $( "#calendar-button" ).button({ icons: {primary: that.openIcon}});
      $("#calendar-button").show();
      var minDate = lastLayer.setDataOptions.minDate; // required
      var maxDate = lastLayer.setDataOptions.maxDate || 0;
      $('.datepicker').datepicker("option","minDate", minDate);
      $('.datepicker').datepicker("option","maxDate", maxDate);
    }
  }
}

// Update layer(calendar + data) with new date range, based on state: fromShareLink, fromDataLibray, undefined
// Called when:
//   * a new date range is selected and refresh button clicked (undefined, "fromCalendar")
//   * page first loaded ("fromDataLibrary")
//   * layer turned on from data library ("fromDataLibrary")
//   * page loaded from share link ("fromShareLink")
DateRangePicker.prototype.updateCalendarLayers = function updateCalendarLayers(origin){
  var newStartDate, newEndDate;
  //console.log("update layers " + (origin || "fromCalendar"), "ignore defaults=",this.ignoreDefaults )

  // If coming from share link, first time we turn on a layer we ignore its defaults
  if(this.ignoreDefaults){
    // do not reset ignoreDefaults unless all share link layers have been turned on
    for (var i=0; i< this.shareLinkLayerIds.length; i++){
      if (!activeEarthTimeLayers.includes(this.shareLinkLayerIds[i])){
        //console.log("not all share link layers on", activeEarthTimeLayers, this.shareLinkLayerIds)
        return;
      }
    }
    //console.log("all share link layers on")
    this.ignoreDefaults = false;
    this.updateCalendarLayers("fromShareLink"); //fix timeline if noncalendar layer loaded last
  }
  else{
    if (origin=="fromShareLink"){ // date range from url hash
      var vals = UTIL.getUnsafeHashVars();
      //assume hash dates are in local time, convert to GMT to pass to updateLayersData
      newStartDate = vals['bt'];
      newEndDate = vals['et'];
      //console.log("from share link  new dates" , newStartDate, newEndDate);

      updateHighlightedRange(newStartDate, newEndDate);
      updateCalendarLayersData(newStartDate, newEndDate, this);
    }
    else if (origin=="fromDataLibrary"){ // date range from last selected layer
      // if date range lock checked, treat as if clicking refresh calendar button
      var lastCalLayer = this.calendarLayersList[this.calendarLayersList.length-1];
      var lastActiveId = activeEarthTimeLayers[activeEarthTimeLayers.length -1];

      if (lastCalLayer.layerId != lastActiveId){
        // if last selected layer is not a calendar layer
        var lastActive = getLayer(lastActiveId);
        console.log("last active layer not calendar",activeEarthTimeLayers,lastActive)

        // last active layer is bkgd layer
        if (!lastActive){
          return;
        }

        // last layer has no start/end dates
        if (!lastActive.layerDef["Start date"] || !lastActive.layerDef["End date"]){
          return;
        }

        newStartDate = lastActive.layerDef["Start date"];
        newEndDate = lastActive.layerDef["End date"];
      }
      else{
        // last layer is calendar layer
        if ($("#lock-daterange-checkbox").prop('checked')){
          this.updateCalendarLayersList();
          if (this.calendarLayersList.length > 0){
            this.updateCalendarLayers("fromCalendar");
          }
          return;
        }
        else{
          newStartDate = lastCalLayer.layerDef["Start date"];
          newEndDate = lastCalLayer.layerDef["End date"];
        }
        updateHighlightedRange(newStartDate, newEndDate);
        updateCalendarLayersData(newStartDate, newEndDate, this);
      }
    }
    else{ // "fromCalendar"
      var date1 = this.getDate1();
      var date2 = this.getDate2();
      if (!date1 || !date2){
        console.log("Invalid date range. No layers updated.");
        alert("Invalid date range. No layers updated.");
        return;
      } 
      date2.setHours(date2.getHours() + 23, date2.getMinutes() + 59);
      // convert calendar dates to GMT
      newStartDate = this.toGMTEarthtimeDate(date1);
      newEndDate = this.toGMTEarthtimeDate(date2);
      //console.log("(local)", date1, date2, "(utc)", newStartDate, newEndDate);

      updateHighlightedRange(newStartDate, newEndDate);
      updateCalendarLayersData(newStartDate, newEndDate, this);
    }
  }

  // Call function to update layers' data
  // dpr = DateRangePicker object
  function updateCalendarLayersData(newStartDate, newEndDate, drp){
    for(var i=0; i<drp.calendarLayersList.length; i++){
      var layer = drp.calendarLayersList[i];
      var refreshData = parseDateStr(layer.startDate) > parseDateStr(newStartDate) || 
          parseDateStr(layer.endDate) < parseDateStr(newEndDate);
      var isLast = (i == (drp.calendarLayersList.length - 1));
      csvFileLayers.updateLayerData(layer.layerId, newStartDate, newEndDate, undefined, refreshData, isLast);
    }
  }

  // Make calendar highlight range start to end
  // start/end in form YYYYMMDDHHMMSS, treat as UTC time, will show up in calendar as local time
  function updateHighlightedRange(start, end){
    $.datepicker._clearDate($('.datepicker'));

    // assume start/end in GMT, want startDate/endDate in local
    var startDate = new Date(parseDateStr(start) * 1000);
    var endDate = new Date(parseDateStr(end) * 1000);

    //console.log("update highlighted range (utc)", start, end, "(local)", startDate.toLocaleString(), endDate.toLocaleString());

    $("#input1").val($.datepicker.formatDate("mm/dd/yy", startDate));
    $("#input2").val($.datepicker.formatDate("mm/dd/yy", endDate));
    $('.datepicker').datepicker("setDate",startDate)
    $('.datepicker').datepicker("setDate",endDate);
  }
}

// Update list of calendar layers stored in DateRangePicker object
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

// Takes Date obj, returns str YYYYMMDDHHMM format
// Converts date to GMT first, then pulls out year, month, etc.
DateRangePicker.prototype.toGMTEarthtimeDate = function(d){
  var pad = function(n){ return (n < 10 ? '0' : '') + n.toString(); }
  return d.getFullYear() + pad(parseInt(d.getUTCMonth()) + 1) + 
    pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes());
}

// Takes Date obj, returns str YYYYMMDDHHMM format
// Pulls out year, month, etc.
DateRangePicker.prototype.toEarthtimeDate = function(d){
  var pad = function(n){ return (n < 10 ? '0' : '') + n.toString(); }
  return d.getFullYear() + pad(parseInt(d.getMonth()) + 1) + 
    pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
}

// Takes YYYYMMDDHHMM date string, returns same but w timezone offset added to HH
DateRangePicker.prototype.toLocalEarthtimeDate = function(ds){
  return this.toEarthtimeDate(new Date(parseDateStr(ds)*1000));
}

// Assume start/end date in GMT time in spreadsheet, show timeline as local time
DateRangePicker.prototype.fixForLocalTimeline = function fixForLocalTimeline(date){
  return this.toLocalEarthtimeDate(this.toLocalEarthtimeDate(date));
}

// Assume start/end date in GMT time in spreadsheet, show timeline as GMT time
DateRangePicker.prototype.fixForGMTTimeline = function fixForGMTTimeline(date){
  return this.toLocalEarthtimeDate(date);
}

// Get date from calendar input box 1
DateRangePicker.prototype.getDate1 = function getDate1(){
  return $.datepicker.parseDate($.datepicker._defaults.dateFormat, $("#input1").val());
}

// Get date from calendar input box 2
DateRangePicker.prototype.getDate2 = function getDate2(){
  return $.datepicker.parseDate($.datepicker._defaults.dateFormat, $("#input2").val());
}