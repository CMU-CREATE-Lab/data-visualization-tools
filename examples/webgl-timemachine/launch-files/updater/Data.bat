@echo off

:: Earth Timelapse Data Downloader ::
:: Version 1.0 ::

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
set LFTP_PATH=%UPDATER_PATH%..\app\libs\lftp\lftp.exe
set LFTP_DOWNLOAD_SCRIPT=et-download.lftp
set LFTP_DOWNLOAD_SCRIPT_PATH=%UPDATER_PATH%%LFTP_DOWNLOAD_SCRIPT%
set DATA_PATH=%UPDATER_PATH%..\app\data
set TMP_LFTP_DOWNLOAD_SCRIPT_PATH=%DATA_PATH%\%LFTP_DOWNLOAD_SCRIPT%

echo This program downloads the latest EarthTime data to be stored locally.

echo(
set /P "c=Are you sure you want to continue [Y/N]? "
echo(
if /I "%c%" equ "y" goto :DOWNLOAD_DATA
if /I "%c%" equ "yes" goto :DOWNLOAD_DATA
goto :UPDATE_CANCEL

:DOWNLOAD_DATA
  call :CLEAR_READ_ONLY_STATE
  cd /D %DATA_PATH%
  takeown /F ..
  takeown /F .
  echo Y| cacls . /c /g Everyone:F
  copy %LFTP_DOWNLOAD_SCRIPT_PATH% %DATA_PATH%
  %LFTP_PATH% -f %LFTP_DOWNLOAD_SCRIPT%
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
  echo data was successfully downloaded.
  echo(
  pause
  goto :DONE

:DONE
  goto CLEANUP

:CLEANUP
  if exist "%DISKPART1%" del "%DISKPART1%"
  if exist "%DISKPART2%" del "%DISKPART2%"
  if exist "%DISKPART3%" del "%DISKPART3%"
  if exist "%TMP_LFTP_DOWNLOAD_SCRIPT_PATH%" del "%TMP_LFTP_DOWNLOAD_SCRIPT_PATH%"
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