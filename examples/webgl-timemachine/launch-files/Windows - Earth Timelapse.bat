@echo off

call:WINDOWS

:WINDOWS
SETLOCAL EnableExtensions
SETLOCAL EnableDelayedExpansion

for /f "tokens=2 delims=:, " %%a in (' find "browserScaleFactor" ^< "config.js" ') do (
  set BROWSER_SCALE_FACTOR=%%~a
)
set EXE=chrome.exe
set LAUNCH_PATH=%cd%app/data-visualization-tools/examples/webgl-timemachine/index.html
set PORTABLE_CHROME_PATH=%cd%libs/chrome-win32/chrome.exe
set ARGS="--video-threads=%NUMBER_OF_PROCESSORS% --allow-file-access-from-files --start-maximized --device-scale-factor=%BROWSER_SCALE_FACTOR%"

FOR /F %%x IN ('tasklist /NH /FI "IMAGENAME eq %EXE%"') DO IF %%x == %EXE% goto WINDOWS_CHROME_RUNNING
echo Launching user installed Chrome
start "Chrome" chrome "%LAUNCH_PATH%" "%ARGS%" || goto WINDOWS_USER_DOES_NOT_HAVE_CHROME
goto DONE

:WINDOWS_CHROME_RUNNING
echo Chrome already running, launching portable Chrome
msg %username% /time:0 Chrome is currently running. To use Earth Timelapse, you need to close Chrome completely. Close Chrome and run this file again.
GOTO WINDOWS_RUN_PORTABLE_CHROME

:WINDOWS_USER_DOES_NOT_HAVE_CHROME
echo User does not have Chrome, launching portable Chrome
msg %username% /time:0 Chrome is not installed. Go to www.google.com/chrome to download it. Once installed, run this file again.
goto WINDOWS_RUN_PORTABLE_CHROME

:WINDOWS_RUN_PORTABLE_CHROME
::start "Chrome" %PORTABLE_CHROME_PATH% "%LAUNCH_PATH%" "%ARGS%"
GOTO DONE

:DONE
exit
