@echo off

:: Earth Timelapse Config Changer ::
:: Version 1.1 ::

SETLOCAL EnableExtensions
SETLOCAL EnableDelayedExpansion

:: Check that we have proper permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

if '%errorlevel%' neq '0' (
  echo The program needs to be run as Administrator.
  echo Please click yes in the pop-up to continue.
  goto :UAC_PROMPT
) else ( call :HAVE_PERMISSION )

:: Diskpart script files ::
set DISKPART1="%tmp%\dp1.txt"
set DISKPART2="%tmp%\dp2.txt"
set DISKPART3="%tmp%\dp3.txt"

:: Globals ::
set UPDATER_PATH=%~dp0
set SSED_PATH=%UPDATER_PATH%..\app\libs\ssed\ssed.exe
set WGET_PATH=%UPDATER_PATH%..\app\libs\wget\wget.exe
set CONFIG_PATH=%UPDATER_PATH%..\config.js
set TMP_CONFIG_PATH=%UPDATER_PATH%..\config.jse
set APP_PATH=%UPDATER_PATH%..\app\data-visualization-tools
set LOCAL_WAYPOINT_PATH=%APP_PATH%\examples\webgl-timemachine
set WAYPOINT_COLLECTION=""

echo This program allows you to change the waypoint Google Spreadsheet link.

echo(
set /P "c=Are you sure you want to continue [Y/N]? "
echo(
if /I "%c%" equ "y" goto :UPDATE_CONFIG
if /I "%c%" equ "yes" goto :UPDATE_CONFIG
goto :UPDATE_CANCEL

:UPDATE_CONFIG
  SET /P "WAYPOINT_PATH=Please paste in the Google Spreadsheet link: "
  call :CLEAR_READ_ONLY_STATE
  :: Remove leading and trailing whitespaces
  set WAYPOINT_PATH=%WAYPOINT_PATH: =%
  echo(
  SET /P "STORE_LOCALLY=Store spreadsheet locally rather than pull from online? [Y/N]? "
  if /I "%STORE_LOCALLY%" equ "y" (
    set "DOWNLOAD_WAYPOINT_PATH=%WAYPOINT_PATH:edit#gid=export?format=tsv&gid%"
    %WGET_PATH% -q --no-check-certificate "!DOWNLOAD_WAYPOINT_PATH!" -O "%LOCAL_WAYPOINT_PATH%\waypoints.tsv"
    set WAYPOINT_PATH=waypoints.tsv
  )
  :: Escape slashes
  SET "WAYPOINT_PATH=%WAYPOINT_PATH:/=\/%"
  :: String replace using SSED
  %SSED_PATH% -ie "s/\"waypointSliderContentPath\".*\"/\"waypointSliderContentPath\" : \"%WAYPOINT_PATH%\"/g" %CONFIG_PATH%
  if %errorlevel% neq 0 goto :UPDATE_FAILED /b %errorlevel%
  del %TMP_CONFIG_PATH%
  call :SET_READ_ONLY_STATE
  goto :UPDATE_SUCCESSFUL

:CLEAR_READ_ONLY_STATE
  echo(
  echo Preparing...
  echo list volume > "%DISKPART1%"
  if not exist "%DISKPART1%" goto :CANNOT_WRITE_TO_TMP
  for /f "delims=*" %%a in ('diskpart /s "%DISKPART1%"') do (
    for /f "tokens=2" %%i in ('echo %%a ^| findstr /i "EarthTime"') do set VOLUME_NUM=%%i
  )
  if [%VOLUME_NUM%] == [] goto :DRIVE_NOT_DETECTED
  (
    echo select volume %VOLUME_NUM%
    echo attributes disk clear readonly
    echo attributes disk clear readonly
    echo exit
  ) > "%DISKPART2%"
  diskpart /s "%DISKPART2%" > nul 2>&1
  goto :EOF

:SET_READ_ONLY_STATE
  echo(
  echo Cleaning up...
  (
    echo select volume %VOLUME_NUM%
    echo attributes disk set readonly
    echo attributes disk set readonly
    echo exit
  ) > "%DISKPART3%"
  diskpart /s "%DISKPART3%" > nul 2>&1
  goto :EOF

:CLEAN_CONFIG_ATTRIBUTE
  set %~1=%~2
  set %~1=!%~1:~2!
  set %~1=!%~1:,=!
  set %~1=!%1:" "==!
  goto :EOF

:SET_CHOICE
  set %~1=%~2
  goto :EOF

:UPDATE_FAILED
  echo(
  if not defined FAILED_MSG (set FAILED_MSG=See above)
  echo EarthTimelapse drive could not be updated.
  echo Reason: %FAILED_MSG%
  echo Please contact info@earthtimelapse.org with a screenshot or copy of the above.
  echo(
  pause
  goto :DONE

:UPDATE_CANCEL
  echo(
  echo Process canceled.
  echo(
  pause
  goto :DONE

:UPDATE_SUCCESSFUL
  echo(
  echo config.js was successfully updated.
  echo(
  pause
  goto :DONE

:DONE
  goto CLEANUP

:CLEANUP
  if exist "%DISKPART1%" del "%DISKPART1%"
  if exist "%DISKPART2%" del "%DISKPART2%"
  if exist "%DISKPART3%" del "%DISKPART3%"
  exit

:UAC_PROMPT
  echo set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
  set params = %*:"=""
  echo UAC.ShellExecute "cmd.exe", "/c %~s0 %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

  "%temp%\getadmin.vbs"
  del "%temp%\getadmin.vbs"
  exit /B

:HAVE_PERMISSION
  pushd "%cd%"
  cd /D "%~dp0"
  goto :EOF
