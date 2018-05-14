@echo off

:: Landsat Downloader ::
:: Version 1.0 ::

SETLOCAL EnableExtensions
SETLOCAL EnableDelayedExpansion

:: Check that we have proper permissions
>nul 2>&1 "%SYSTEMROOT%\system32\icacls.exe" "%SYSTEMROOT%\system32\config\system"

if '%errorlevel%' neq '0' (
  echo The program needs to be run as Administrator.
  echo Please click yes in the pop-up to continue.
  goto :UAC_PROMPT
) else ( call :HAVE_PERMISSION )

:: When you run a batch file as administrator under windows vista+, the current directory gets set to C:\windows\system32.
:: This will change the current directory to the location of the .bat file.
cd /D "%~dp0"

:: Globals ::
set UPDATER_PATH=%~dp0
set ARIA2_PATH=%UPDATER_PATH%..\app\libs\aria2\aria2c.exe
set DATA_PATH=%UPDATER_PATH%..\app\data
set LANDSAT_TILE_LIST=landsat-tiles-list.txt
set LANDSAT_TILE_LIST_LOC="https://www.googleapis.com/drive/v3/files/1m00QXyJ0l868LmQh8-rjID79arDe-BuK/?key=AIzaSyCFnTxNmt2egFurFdnZETJU9JIZrEHyYLI&alt=media"

echo This will download the lastest Landsat tiles for Timelapse.
echo A fast Internet connection (wired preferred) is required to proceed.

call :DOWNLOAD_PROMPT

:DOWNLOAD_PROMPT
  echo(
  set /P "c=Are you sure you want to continue [Y/N]? "
  if /I "%c%" equ "y" goto :DOWNLOAD
  if /I "%c%" equ "yes" goto :DOWNLOAD
  goto :DOWNLOAD_CANCEL

:DOWNLOAD
  :: Change to data directory
  cd /D %DATA_PATH%
  echo(
  echo Downloading Landsat tile list...
  %ARIA2_PATH% -o landsat-tiles-list.txt --allow-overwrite="true" %LANDSAT_TILE_LIST_LOC%
  echo(
  echo Preparing to download tiles...
  %ARIA2_PATH% -c -i%LANDSAT_TILE_LIST% -j10
  if %errorlevel% neq 0 goto :DOWNLOAD_FAILED /b %errorlevel%
  goto :DOWNLOAD_SUCCESSFUL

:UAC_PROMPT
  echo set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
  set params = %*:"=""
  echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

  "%temp%\getadmin.vbs"
  del "%temp%\getadmin.vbs"
  exit /B

:HAVE_PERMISSION
  pushd "%cd%"
  cd /D "%~dp0"
  goto :EOF

:DOWNLOAD_SUCCESSFUL
  echo(
  echo Download was successful.
  echo(
  pause
  goto :DONE

:DOWNLOAD_FAILED
  echo(
  if not defined FAILED_MSG (set FAILED_MSG=See above)
  echo Timelapse tiles could not be downloaded
  echo Reason: %FAILED_MSG%
  echo Please contact support with a screenshot or copy of the above message.
  echo(
  pause
  goto :DONE

:DOWNLOAD_CANCEL
  echo(
  echo Download canceled.
  echo(
  pause
  goto :DONE

:DONE
  goto CLEANUP

:CLEANUP
  exit
