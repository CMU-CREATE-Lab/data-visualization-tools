@echo off

SETLOCAL EnableExtensions
SETLOCAL EnableDelayedExpansion

set BROWSER_SCALE_FACTOR=1
set LAUNCH_MODE=""

for /f "tokens=2 delims=:, " %%a in (' find "browserScaleFactor" ^< "config.js" ') do (
  set BROWSER_SCALE_FACTOR=%%~a
)

for /f "tokens=2 delims=:, " %%a in (' find "launchMode" ^< "config.js" ') do (
  set LAUNCH_MODE=%%~a
)

if %LAUNCH_MODE% == kiosk (
  set EXTENSION_ARGS=--load-extension=%cd%app/libs/virtual-keyboard/1.11.1_0
  set LAUNCH_MODE=--kiosk
) else (
  set EXTENSION_ARGS=
  set LAUNCH_MODE=--start-maximized
)

set LAUNCH_PATH=%cd%app/data-visualization-tools/examples/webgl-timemachine/index.html
set ARGS="--video-threads=%NUMBER_OF_PROCESSORS% --allow-file-access-from-files %LAUNCH_MODE% --device-scale-factor=%BROWSER_SCALE_FACTOR% --user-data-dir=%tmp% --no-first-run %EXTENSION_ARGS%"

echo Launching user installed Chrome.
start "Chrome" chrome --app="%LAUNCH_PATH%" "%ARGS%" || goto :USER_DOES_NOT_HAVE_CHROME
goto :DONE

:USER_DOES_NOT_HAVE_CHROME
  echo Error. User does not have Chrome.
  msg %username% /time:0 Chrome is not installed. Go to www.google.com/chrome to download it. Once installed, run this file again.
  goto :DONE

:DONE
  exit
