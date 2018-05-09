@echo off

SETLOCAL EnableExtensions
SETLOCAL EnableDelayedExpansion

set BROWSER_SCALE_FACTOR=1
set LAUNCH_MODE=""
set USE_FROZEN_CHROME=0
set SHOW_GFW=0

:: When you run a batch file as administrator under windows vista+, the current directory gets set to C:\windows\system32.
:: This will change the current directory to the location of the .bat file.
cd /d "%~dp0"

for /f "tokens=2 delims=:, " %%a in (' find "browserScaleFactor" ^< "config.js" ') do (
  set BROWSER_SCALE_FACTOR=%%~a
)

for /f "tokens=2 delims=:, " %%a in (' find "launchMode" ^< "config.js" ') do (
  set LAUNCH_MODE=%%~a
)

for /f "tokens=2 delims=:, " %%a in (' find "useFrozenChrome" ^< "config.js" ') do (
  set USE_FROZEN_CHROME=%%~a
)

for /f "tokens=2 delims=:, " %%a in (' find "showGFW" ^< "config.js" ') do (
  set SHOW_GFW=%%~a
)

for /f "tokens=2 delims=:, " %%a in (' find "clearProfile" ^< "config.js" ') do (
  if %%~a == true (
    :: Keep the Local Storage directory because Timelapse localStorage values may still be needed across loads
    for /d %%I in ("%tmp%\et\Default\*") do (
      if /i not "%%~nxI" equ "Local Storage" rmdir /q /s "%%~I"
    )
    del /q "%tmp%\et\Default\*
    for /d %%I in ("%tmp%\et\*") do (
      if /i not "%%~nxI" equ "Default" rmdir /q /s "%%~I"
    )
    del /q "%tmp%\et\*
  )
)

if %LAUNCH_MODE% == kiosk (
  set EXTENSION_ARGS=--load-extension=%cd%/app/libs/virtual-keyboard/1.11.1_0
  set LAUNCH_MODE=--kiosk
) else (
  set EXTENSION_ARGS=
  set LAUNCH_MODE=--start-maximized
)

if %USE_FROZEN_CHROME% == true (
  set CHROME_LAUNCH_PATH=%cd%\app\libs\GoogleChromePortable57\GoogleChromePortable.exe
) else (
  set CHROME_LAUNCH_PATH=chrome
)

if %SHOW_GFW% == true (
  set GFW_ARGS=--ignore-certificate-errors  --ignore-urlfetcher-cert-requests
  taskkill /f /im "mongoose-webserver.exe"
  start /d "%cd\%app\extras\gfw-legacy-china" mongoose-webserver.exe
) else (
  set GFW_ARGS=
)

set LAUNCH_PATH=%cd%/app/data-visualization-tools/examples/webgl-timemachine/index.html
set ARGS="--video-threads=%NUMBER_OF_PROCESSORS% --allow-file-access-from-files %LAUNCH_MODE% --device-scale-factor=%BROWSER_SCALE_FACTOR% --user-data-dir=%tmp%/et --no-first-run %EXTENSION_ARGS% %GFW_ARGS% --ignore-gpu-blacklist"

echo Launching user installed Chrome.
start "Chrome" %CHROME_LAUNCH_PATH% --app="%LAUNCH_PATH%" "%ARGS%" || goto :USER_DOES_NOT_HAVE_CHROME
goto :DONE

:USER_DOES_NOT_HAVE_CHROME
  echo Error. User does not have Chrome.
  msg %username% /time:0 Chrome is not installed. Go to www.google.com/chrome to download it. Once installed, run this file again.
  goto :DONE

:DONE
  exit
