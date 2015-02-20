/**
 * @fileoverview A CMU CREATE Lab Timemachine-esque timeslider.
 * @author Gabriel O'Donnell
 */

/**
 * A time slider for interacting with Google Maps based WebGL
 * visualizations.
 *
 * @constructor
 * @param  {object} config Options to set in this TimeSlider
 * @requires JQuery
 * @requires JQueryUI
 */
var TimeSlider = function (config) {
  /**
   * If true, time slider is in a state to accept animation requests
   * @type {boolean}
   * @private
   */
  this.animate_ = false;

  this.onChange_ = config.onChange;

  this.dwell_ = false;
  /**
   * Playback animationRates per increment for animation
   * In ms. I.e. 50 == 50ms
   * Helpful values: 60Hz = 16.67, 30Hz = 33.33, 15Hz = 66.67
   * @type {object}
   * @private
   */
  this.animationRate_ = config.animationRate || {
    fast: 30,
    medium: 60,
    slow: 120
  };

  /**
   * Dwell time at end of an animation loop in ms
   * @type {integer}
   * @private
   */
  this.dwellAnimationTime_ = config.dwellAnimationTime || 0;

  /**
   * Function for formatting the current context time
   * Must take a Date object and return a String
   * @type {function}
   * @private
   */
  this.formatCurrentTime_ = config.formatCurrentTime;


  /**
   * Current rate for animation
   * @type {string}
   * @private
   */
  this.currentAnimationRate_ = 'fast';

  /**
   * Numeric value for the specified start time
   * @type {integer}
   * @private
   */
  this.startTime_ = config.startTime || new Date(0).getTime();

  /**
   * Numeric value for the specified end time
   * @type {integer}
   * @private
   */
  this.endTime_ = config.endTime || new Date().getTime();

  /**
   * Numeric value for the specified span of time that is animated
   * @type {integer}
   * @private
   */
  this.span_ = config.span || 0;

  /**
   * Numeric value for the specified increment time
   * @type {integer}
   * @private
   */
  this.increment_ = config.increment || 24*60*60*1000;

  /**
   * Numeric value for the current time of the animation
   * @type {integer}
   * @private
   */
  this.currentTime_ = config.currentTime || (this.startTime_ + this.span_);

  /**
   * Numeric value in ms for the total time of the animation
   * @type {float}
   * @private
   */
  this.totalAnimationTime_;

  /**
   * Numeric value in ms for the elapsed time of the current animation
   * @type {float}
   * @private
   */
  this.elapsedAnimationTime_;

  /**
   * Numeric value in ms for the start time of the animation
   * @type {float}
   * @private
   */
  this.startAnimationTime_;


  /**
   * The id of the DOM element that will contain the time slider controls
   * @type {string}
   * @private
   */
  this.id_ = config.id || "time-slider-controls";

  /**
   * Basic HTML template the time slider
   * @type {string}
   * @private
   */
  this.template_ = '\
    <div class="captureTime" title="Capture time"> \
      <div class="currentCaptureTime"><div class="captureTimeMain"><div id="currentTime"></div></div></div> \
    </div> \
    <div class="controls"> \
      <div class="timelineSliderFiller"> \
        <div id="Tslider1" class="timelineSlider"></div> \
      </div> \
      <div title="Play" class="playbackButton"></div> \
      <a href="http://explorables.cmucreatelab.org" target="_blank"><div class="logo explorablesLogo"></div></a> \
      <button class="toggleSpeed" id="fastSpeed" title="Toggle playback speed">Fast</button> \
      <button class="toggleSpeed" id="mediumSpeed" title="Toggle playback speed">Medium</button> \
      <button class="toggleSpeed" id="slowSpeed" title="Toggle playback speed">Slow</button> \
    </div>';


    // Set the total animation time
    this.setTotalAnimationTime_();

    // Add the template to the DOM
    this.render_();

    // Add the JQueryUI functionality to the UI elements
    this.initUI_();

    // Play/pause on space bar
    document.addEventListener("keydown", function(event) {
      if (event.keyCode == 32 ) {
        $(".playbackButton").trigger("click");
      }
    });

  }


  /**
   * Set the animate state for the time slider and trigger a play event
   * @public
   */
  TimeSlider.prototype.play = function() {
    this.animate_ = true;
    $(".playbackButton").trigger("click");
  }


  /**
   * Set the total time for an animation
   * @private
   */
  TimeSlider.prototype.setTotalAnimationTime_ = function() {
    var totalIncrements = ((this.endTime_ - (this.startTime_ + this.span_)) / this.increment_);
    this.totalAnimationTime_ = totalIncrements * this.animationRate_[this.currentAnimationRate_];
  }

  /**
   * Set the start time for an animation.
   * @private
   */
  TimeSlider.prototype.setStartAnimationTime_ = function() {
    var ratio = (this.currentTime_ - this.getStartTime())/ (this.endTime_ - this.getStartTime());
    this.startAnimationTime_ = this.now_() - ratio * this.totalAnimationTime_;
  }

  /**
   * Set the animate state for the time slider
   * @param {boolean} bool
   */
  TimeSlider.prototype.setAnimateState = function(bool) {
    this.animate_ = bool;
  }

  /**
   * Set the current time of the time slider
   * @param {integer} val The value from 0 to N - 1 of possible steps in the slider
   */
  TimeSlider.prototype.setCurrentTime_ = function(val) {
    this.currentTime_ = val * this.increment_ + this.startTime_ + this.span_;
    if (this.onChange_) {
      this.onChange_(this, this.currentTime_);
    }
  }


  /**
   * Set the current animationRate of the time slider animation
   * @param {string} newanimationRate
   */

  TimeSlider.prototype.setcurrentAnimationRate_ = function(newanimationRate) {
    if (typeof this.animationRate_[newanimationRate] != "undefined") {
      this.currentAnimationRate_ = newanimationRate;
    }
  }



  /**
   * Insert the html template string for the time slider into the DOM
   */
  TimeSlider.prototype.render_ = function() {
    document.getElementById(this.id_).innerHTML = this.template_;
  }



  /**
   * Initialize the play/pause button
   * @private
   */
  TimeSlider.prototype.initPlaybackButton_ = function() {
    var $playbackButton = $(".playbackButton");
    var that = this;
    $playbackButton.button({
      icons: {
        secondary: "ui-icon-custom-play"
      },
      text: false
    }).on("click", function() {
      if ($playbackButton.attr("title") == "Play") {
        $playbackButton.removeClass("play").addClass("pause").attr("title", "Pause");
        $playbackButton.button({icons: {secondary: "ui-icon-custom-pause"}});
        that.setAnimateState(true);
        //that.startAnimationTime_ = that.now_();
        that.setStartAnimationTime_()
      } else {
        $playbackButton.removeClass("pause").addClass("play").attr("title", "Play");
        $playbackButton.button({icons: {secondary: "ui-icon-custom-play"}});
        that.setAnimateState(false);
        that.startAnimationTime_ = 0;
      }
    });
  }

  /**
   * Initialize the animationRate control button for fast speed
   * @private
   */
  TimeSlider.prototype.initFastSpeedButton_ = function() {
    var $fastSpeedButton = $("#fastSpeed");
    var $mediumSpeedButton = $("#mediumSpeed");
    var $controls = $(".controls");
    var that = this;

    $fastSpeedButton.button({
      text: true
    }).click(function() {
      $controls.prepend($mediumSpeedButton);
      $mediumSpeedButton.stop(true, true).show();
      $fastSpeedButton.slideUp(300);
      that.setcurrentAnimationRate_('medium');
      that.setTotalAnimationTime_();
      that.setStartAnimationTime_()
    });
    $fastSpeedButton.show();
  }

  /**
   * Initialize the animationRate control button for medium speed
   * @private
   */
  TimeSlider.prototype.initMediumSpeedButton_ = function() {
    var $mediumSpeedButton = $("#mediumSpeed");
    var $slowSpeedButton = $("#slowSpeed");
    var $controls = $(".controls");
    var that = this;

    $mediumSpeedButton.button({
      text: true
    }).click(function() {
      $controls.prepend($slowSpeedButton);
      $slowSpeedButton.stop(true, true).show();
      $mediumSpeedButton.slideUp(300);
      that.setcurrentAnimationRate_('slow');
      that.setTotalAnimationTime_();
      that.setStartAnimationTime_()
    });

  }

  /**
   * Initialize the animationRate control button for slow speed
   * @private
   */
  TimeSlider.prototype.initSlowSpeedButton_ = function() {
    var $slowSpeedButton = $("#slowSpeed");
    var $fastSpeedButton = $("#fastSpeed");
    var $controls = $(".controls");
    var that = this;

    $slowSpeedButton.button({
      text: true
    }).click(function() {
      $controls.prepend($fastSpeedButton);
      $fastSpeedButton.stop(true, true).show();
      $slowSpeedButton.slideUp(300);
      that.setcurrentAnimationRate_('fast');
      that.setTotalAnimationTime_();
      that.setStartAnimationTime_()
    });
  }


  /**
   * Initialize the time slider bar
   * @private
   */
  TimeSlider.prototype.initTimelineSlider_ = function() {
    var $timelineSlider = $(".timelineSlider");
    var that = this;
    $timelineSlider.slider({
      min: 0,
      max: (this.endTime_ - (this.startTime_ + this.span_)) / this.increment_, // this way the time scrubber goes exactly to the end of timeline
      range: "min",
      step: 1,
      slide: function(e, ui) {
        that.setCurrentTime_(ui.value);
        that.renderCurrentTime_();
        that.setStartAnimationTime_();

      }
    }).removeClass("ui-corner-all").children().removeClass("ui-corner-all");
    $(".timelineSlider .ui-slider-handle").attr("title", "Drag to go to a different point in time");
  }

  /**
   * Render the current time
   * @private
   */
  TimeSlider.prototype.renderCurrentTime_ = function() {
    //$("#currentTime").html(new Date(this.currentTime_).getUTCFullYear());
    $("#currentTime").html(this.formatCurrentTime_(new Date(this.currentTime_)));
  }


  /**
   * Initialize the UI elements of the time sliders
   * @private
   */
  TimeSlider.prototype.initUI_ = function() {
    this.initPlaybackButton_();
    this.initFastSpeedButton_();
    this.initMediumSpeedButton_();
    this.initSlowSpeedButton_();
    this.initTimelineSlider_();
    this.renderCurrentTime_();
  }

  TimeSlider.prototype.now_ =  function() {
    var time = window.performance.now ?
      (performance.now() + performance.timing.navigationStart) : Date.now();
    return time;
  }
  /**
   * Handle animation requests
   */

  TimeSlider.prototype.redraw_ = function() {
    $('.timelineSlider').slider("value",  Math.floor((this.currentTime_ - (this.startTime_ + this.span_)) / this.increment_));
    this.renderCurrentTime_();
  }

  TimeSlider.prototype.animate = function() {
    if (this.animate_) {
      this.elapsedAnimationTime_ = this.now_() - this.startAnimationTime_;
      if (this.dwell_) {
        if (this.elapsedAnimationTime_ > this.dwellAnimationTime_) {
          this.dwell_ = false;
          this.startAnimationTime_ = this.now_();
          this.elapsedAnimationTime_ = 0;
          this.currentTime_ = this.getStartTime();
        }
      }
      else {
        if (this.elapsedAnimationTime_ > this.totalAnimationTime_ && this.currentTime_ >= this.endTime_ ) {
          this.dwell_ = true;
          this.startAnimationTime_ = this.now_();
          this.elapsedAnimationTime_ = 0;
        } else {
          var ratio = this.elapsedAnimationTime_/this.totalAnimationTime_;
          this.currentTime_ = this.getStartTime() + ratio * (this.endTime_ - this.getStartTime());
          if (this.currentTime_ > this.endTime_) {
            this.currentTime_ = this.endTime_;
          }
        }
      }
      this.redraw_();
    }
  }


  /**
   * @return {integer} the current time of the time slider
   */
  TimeSlider.prototype.getCurrentTime = function() {
    return this.currentTime_;
  }


  /**
   * @return {integer} the current start time + the span
   */
  TimeSlider.prototype.getStartTime = function() {
    return this.startTime_ + this.span_;
  }
