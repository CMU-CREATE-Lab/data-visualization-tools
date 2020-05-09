// To use:
// var follower = ETLocationFollower(timelapse);
// follower.start();

function ETLocationFollower(timelapse) {
    console.log('GGGGG instantiating ETLocationFollower', timelapse);
    this.timelapse = timelapse;
};

ETLocationFollower.prototype._update = function() {
    this.requestPosition();
    this.goToView();
};

ETLocationFollower.prototype.goToView = function() {
    var view =  {center : {lat: this.lat, lng: this.lng}, 
                 zoom: this.timelapse.getCurrentZoom()};
    console.log('GGGGG goToView', JSON.stringify(view));

    var doWarp = true;
    timelapse.setNewView(view, doWarp);
};

ETLocationFollower.prototype._geoSuccess = function(position) {
    this.lat  = position.coords.latitude;
    this.lng = position.coords.longitude;

    console.log('GGGGG geoSuccess', 
        (new Date()).toLocaleTimeString(),
        this.lat, this.lng, 
        position);

    this.goToView();
};

ETLocationFollower.prototype._geoError = function(err) {
    console.log('GGGGG geoError', err);
};

ETLocationFollower.prototype.requestPosition = function() {
    console.log('GGGGG requestPosition');
    navigator.geolocation.getCurrentPosition(
        this._geoSuccess.bind(this),
        this._geoError.bind(this), 
        this._geoOptions);
};

ETLocationFollower.prototype.start = function() {
    console.log('GGGGG ETLocationFollower.start');
    this._geoOptions = {
        enableHighAccuracy: true,
    };
    navigator.geolocation.watchPosition(
        this._geoSuccess.bind(this),
        this._geoError.bind(this), 
        this._geoOptions);
    this.requestPosition();
    setInterval(this._update.bind(this), 3000);
};

ETLocationFollower.prototype.stop = function() {
    console.log('TODO: implement ETLocationFollowern.stop');
};

// var follower = ETLocationFollower(timelapse);
// follower.start();
