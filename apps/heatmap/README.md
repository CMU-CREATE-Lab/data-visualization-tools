# URL parameters

The URL parameters have the same syntax as normal URL query parameters, but are placed in the hash-part of the URL to be possible to update from JavaScript dynamically when you make changes in the UI / the animation runs.

    source = URL of the binary to load
    zoom = default zoom level
    lat / lon = default center latitude / longitude
    overlay = URL of a KML to overlay over the map
    time = Date to show. Default: First date in the dataset.
    paused = Wether to pause the animation. Default: false
    length = Animation loop time in ms. Default: 10000
    offset = Time windows size in days. Default: 15
    maxoffset = Max time window size in days (max position for the time window slider). Default: 29
    lines = Wether to draw lines or pointes. Default: false
    stats = Show rendering stats. Default: false

All of them apart from source are optional. Example:

    http://example.com/apps/heatmap#source=/data.bin&lat=5&lon=5&zoom=3&paused=true


# Source data
Details of the source data format can be found in the comment for
loadTypedMatrix in js/utils.js.

## Required columns

    datetime = Time of sample in seconds since epoch.
    latitude = Latitude of sample
    longitude = Longitude of sample

## Optional columns

    series = Grouping of samples used for drawing lines. Each value in this column will create a new line. Data must be sorted by this column if it is present.
    red, green, blue = Point color, all three must be present, or none of them. Range: ]0,255[
    alpha = Transparency. Only if red/green/blue are present. Range: ]0,255[
    magnitude = Point size. Range: ]0,255[

In addion to the column data, and the header values that goes with
them (see the binary format spec), there are some extra optional
header values available:

    timeresolution = The step value for the timeslider when the user clicks + / -, in seconds.
    options = a dictionary of default values for the URL parameters.

The default values will produce a nice orange visualization with
uniformly sized points.
