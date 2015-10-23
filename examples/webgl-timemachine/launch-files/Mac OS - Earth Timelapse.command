#!/bin/sh

BROWSER_SCALE_FACTOR=`sed -n 's/"browserScaleFactor" : //p' config.js | sed "s/,.*//"`
BROWSER_SCALE_FACTOR=$((BROWSER_SCALE_FACTOR+0))
NUMBER_OF_PROCESSORS=$(sysctl -n hw.ncpu)
CHROME_PROCESSES=$(ps aux | grep "Google Chrome" | wc -l)
ROOT_PATH=$(dirname "$0")
if [ $ROOT_PATH = '.' ]
then
  ROOT_PATH=$(pwd)
fi
LAUNCH_PATH="$ROOT_PATH/app/data-visualization-tools/examples/webgl-timemachine/index.html"
PORTABLE_CHROME_PATH="$ROOT_PATH/libs/chrome-mac/Chromium.app"
ARGS="--video-threads=$NUMBER_OF_PROCESSORS --allow-file-access-from-files --start-maximized --device-scale-factor=$BROWSER_SCALE_FACTOR"

#launch_portable_chrome() {
#  open -a "$PORTABLE_CHROME_PATH" --args $ARGS
#}

if [ $((CHROME_PROCESSES - 1)) -gt 0 ]
then
  #echo Chrome already running, launching portable Chrome
  #launch_portable_chrome
  echo Chrome already running
  osascript -e 'tell app "System Events" to display dialog "Chrome is currently running. To use Earth Timelapse, you need to close Chrome completely. Close Chrome and run this file again."'
else
  if [ -d "/Applications/Google Chrome.app/" ]
  then
    echo Chrome not running, launching user installed Chrome
    open -a "Google Chrome" --args "$LAUNCH_PATH" $ARGS
  else
    #echo User does not have Chrome, launching portable Chrome
    #launch_portable_chrome
    echo User does not have Chrome
    osascript -e 'tell app "System Events" to display dialog "Chrome is not installed. Go to www.google.com/chrome to download it. Once installed, run this file again."'
  fi
fi
exit
