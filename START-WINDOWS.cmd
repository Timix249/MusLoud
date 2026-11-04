@echo off
setlocal
cd /d "%~dp0"
where docker >nul 2>&1
if errorlevel 1 (
 echo Bitte zuerst Docker Desktop von https://www.docker.com/products/docker-desktop/ installieren und starten.
 pause
 exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
 echo Docker Desktop ist noch nicht bereit. Bitte starten und dieses Fenster danach erneut oeffnen.
 pause
 exit /b 1
)
docker compose version >nul 2>&1
if errorlevel 1 (
 echo Docker Compose fehlt. Bitte Docker Desktop aktualisieren.
 pause
 exit /b 1
)
echo MusLoud wird gestartet. Der erste Start kann mehrere Minuten dauern.
docker compose -p musloud-local up --build --detach --wait --wait-timeout 180
if errorlevel 1 (
 echo MusLoud konnte nicht gestartet werden. Die Fehlermeldung steht oben.
 echo Fuer Details: docker compose -p musloud-local logs --tail 80
 pause
 exit /b 1
)
start "" "http://localhost:3000"
echo MusLoud laeuft auf http://localhost:3000
 echo Zum Beenden STOP-WINDOWS.cmd oeffnen.
pause
