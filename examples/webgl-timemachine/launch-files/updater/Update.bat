@echo off

:: Earth Timelapse Updater ::
:: Version 1.2 ::

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
set GIT_PATH=%UPDATER_PATH%../app/libs/git/win32/bin/git.exe
set APP_PATH=%UPDATER_PATH%../app/data-visualization-tools
set LAUNCH_FILES_PATH=%APP_PATH%/examples/webgl-timemachine/launch-files

echo This will update Earth Timelapse to the latest version.
echo An Internet connection is required to proceed.
echo If you made any manual changes to the app files, they WILL BE LOST.
echo Configuration changes to config.js will be preserved though.
echo(
echo If Earth Timelapse is currently running, please close it now.

call :UPDATE_PROMPT

:UPDATE_PROMPT
  echo(
  set /P "c=Are you sure you want to update [Y/N]? "
  if /I "%c%" equ "y" goto :UPDATE_APP
  if /I "%c%" equ "yes" goto :UPDATE_APP
  goto :UPDATE_CANCEL

:UPDATE_APP
  echo(
  call :CLEAR_READ_ONLY_STATE
  cd /D %APP_PATH%
  %GIT_PATH% fetch --all
  %GIT_PATH% reset --hard origin/master
  %GIT_PATH% submodule foreach --recursive git fetch --all
  %GIT_PATH% submodule foreach --recursive git reset --hard origin/master
  cd /D %UPDATER_PATH%
  xcopy /Y "%LAUNCH_FILES_PATH%" "%UPDATER_PATH%/.."
  call :FIX_FILE_PERMISSIONS
  if %errorlevel% neq 0 goto :UPDATE_FAILED /b %errorlevel%
  call :SET_READ_ONLY_STATE
  goto :UPDATE_SUCCESSFUL

:CLEAR_READ_ONLY_STATE
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

:FIX_FILE_PERMISSIONS
  echo(
  echo Checking integrity of files...
  cd /D %APP_PATH%
  cacls "%CD%" /t /e /c /g Everyone:F
  echo Integrity of files checked.
  goto :EOF

:UPDATE_SUCCESSFUL
  echo(
  echo Update was successful.
  echo(
  pause
  goto :DONE

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
  echo Update canceled.
  echo(
  pause
  goto :DONE

:DRIVE_NOT_DETECTED
  set FAILED_MSG=Drive not found in diskpart list.
  goto :UPDATE_FAILED

:CANNOT_WRITE_TO_TMP
  set FAILED_MSG=Cannot write to Windows TMP directory.
  goto :UPDATE_FAILED

:NOT_ADMIN
  ver | findstr /I /C:"Version 5" > nul
  if %errorlevel%==0 (set PROMPT_MSG_NUM=5) & (set PROMPT_MSG=a Computer Administrator account)
  ver | findstr /I /C:"Version 6" > nul
  if %errorlevel%==0 (set PROMPT_MSG_NUM=6) & (set PROMPT_MSG=an Elevated Command Prompt)
  echo This program must be run from %PROMPT_MSG%.
  if %PROMPT_MSG_NUM%==6 echo Please right click the file and choose 'Run as administrator'.
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
