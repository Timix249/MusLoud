@echo off
setlocal
cd /d "%~dp0"
docker compose -p musloud-local stop
if errorlevel 1 (
 echo MusLoud konnte nicht gestoppt werden. Bitte Docker Desktop pruefen.
 pause
 exit /b 1
)
echo MusLoud ist gestoppt.
pause
