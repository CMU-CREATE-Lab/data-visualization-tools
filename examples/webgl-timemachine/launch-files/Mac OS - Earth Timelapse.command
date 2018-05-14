#!/bin/sh

NUMBER_OF_PROCESSORS=$(sysctl -n hw.ncpu)
ROOT_PATH=$(dirname "$0")
if [ $ROOT_PATH = '.' ]
then
  ROOT_PATH=$(pwd)
fi
BROWSER_SCALE_FACTOR=`sed -n 's/"browserScaleFactor" : //p' $ROOT_PATH/config.js | sed "s/,.*//"`
BROWSER_SCALE_FACTOR=$((BROWSER_SCALE_FACTOR+0))

LAUNCH_MODE=`sed -n 's/"launchMode" : //p' $ROOT_PATH/config.js | sed "s/,.*//"`
if [ $LAUNCH_MODE == "kiosk" ]
then
  EXTENSION_ARGS=--load-extension=%cd%/app/libs/virtual-keyboard/1.12.8_1,%cd%/app/libs/ohnoyoudidnt/1.0.3
  LAUNCH_MODE=--kiosk
else
  EXTENSION_ARGS=
  LAUNCH_MODE=--start-maximized
fi

LAUNCH_PATH="file:///$ROOT_PATH/app/data-visualization-tools/examples/webgl-timemachine/index.html"
ARGS="--video-threads=$NUMBER_OF_PROCESSORS --allow-file-access-from-files $LAUNCH_MODE --device-scale-factor=$BROWSER_SCALE_FACTOR --user-data-dir=/tmp --no-first-run $EXTENSION_ARGS --ignore-gpu-blacklist --enable-font-antialiasing"

if [ -d "/Applications/Google Chrome.app/" ]
then
  echo Launching user installed Chrome.
  open -a "Google Chrome" -n --args --app=$LAUNCH_PATH $ARGS
else
  echo Error. User does not have Chrome.
  osascript -e 'tell app "System Events" to display dialog "Chrome is not installed. Go to www.google.com/chrome to download it. Once installed, run this file again."'
fi

exit
