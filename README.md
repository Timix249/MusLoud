# MusLoud

Vaporwave-Musikstudio für Telefon und Desktop: öffentliche SoundCloud-Tracks suchen, einen Treffer und MP3 (320 kbps), WAV, FLAC oder OGG auswählen und herunterladen. Alternativ eigene Audiodateien konvertieren. Andere Plattformen werden nicht angenommen.

## Telefon

Die Oberfläche passt sich an schmale Displays an, verwendet große Touch-Flächen und 16-Pixel-Eingabefelder gegen automatisches Zoomen auf iOS. Nach der Konvertierung erscheint ein dauerhafter Link „Datei speichern“. Unterstützt der Browser Datei-Sharing, erscheint zusätzlich „Teilen / In Dateien sichern“. Diese Aktion öffnet das native Teilen-Menü direkt nach einem Fingertipp. Wenn Safari eine Audiodatei öffnet, kann sie über das Teilen-Menü in Dateien gesichert werden. Downloads bleiben auf der Seite verfügbar, bis eine neue Auswahl getroffen oder die Seite verlassen wird. Auf Desktop-Browsern mit Maus wird zusätzlich automatisch ein Download ausgelöst.

## Lokaler Start

Node.js 24, Python 3.11+ mit venv und FFmpeg werden benötigt.

```sh
python3 -m venv /workspace/musloud-tools
/workspace/musloud-tools/bin/pip install -r requirements-media.txt
npm ci --cache /tmp/musloud-npm
YTDLP_PATH=/workspace/musloud-tools/bin/yt-dlp npm start
```

`PORT` ist überschreibbar (Standard 3000); der Server bindet an `0.0.0.0`. `GET /api/health` liefert Status und Render-Revision. Das Dockerfile installiert yt-dlp und FFmpeg. Auf Render: Docker-Web-Service, Branch `main`, Health Check `/api/health`; Startbefehl nicht überschreiben.

Optional für einen lokalen Windows-PC mit gestartetem Docker Desktop: ZIP entpacken und `START-WINDOWS.cmd` öffnen. Der Browser startet nach dem Health Check. `STOP-WINDOWS.cmd` beendet den Dienst. Alternativ: `docker compose -p musloud-local up --build --detach --wait`. Der lokale Dienst ist nur auf dem PC erreichbar; die öffentliche Render-Version ist separat.

## Grenzen

- Nur Inhalte verwenden, für die die nötigen Rechte vorliegen.
- Einzelne öffentliche SoundCloud-Tracks bis 20 Minuten; keine Playlists, Livestreams, Anmeldung oder geschützten Inhalte. Direkte Track-Links müssen `https://soundcloud.com/artist/track` verwenden; gekürzte Share-Links werden nicht angenommen.
- Maximal 80 MB Upload/Quelldatei und 220 MB Ausgabe; temporäre Dateien werden nach Verarbeitung gelöscht.
- Eine Konvertierung und zwei Suchvorgänge gleichzeitig pro Serverprozess. Suchauswahlen sind signiert und 30 Minuten gültig; nach Serverneustart erneut suchen.
- Suchvorgänge laufen maximal 60 Sekunden, jeder Download-/Verarbeitungsschritt maximal 120 Sekunden. Abgebrochene Online-Anfragen beenden den laufenden Unterprozess.
- WAV und FLAC erhöhen nicht die Qualität einer komprimierten Quelle.
- SoundCloud kann Zugriffe blockieren. Ein erfolgreicher Track-Test bestätigt nicht die Verfügbarkeit jedes Titels. Cookies oder Anmeldedaten werden nicht verwendet.
- Benötigte Netzwerkziele: `soundcloud.com`, `*.soundcloud.com`, `*.sndcdn.com`.

## Tests und Diagnose

`npm test` prüft SoundCloud-URL-Validierung, Ablehnung anderer Quellen, signierte Auswahlen, Fehlertexte und den HTTP-Ablauf. Der Integrationstest ersetzt ausschließlich den externen Downloader durch eine lokale Fixture; FFmpeg verarbeitet echte Audiodaten und alle vier Ausgabe-Codecs werden mit ffprobe geprüft. Externe Plattformabrufe müssen zusätzlich auf dem Zielserver geprüft werden.

Die Oberfläche zeigt bei Plattformfehlern einen Code, etwa `RATE_LIMITED` oder `SOURCE_FORBIDDEN`. In den Render-Logs steht ein JSON-Eintrag mit `event: media_failure`, Vorgang, Code, Request-ID und Revision. Private Extractor-Ausgaben oder Media-URLs werden nicht protokolliert. Zugriffssperren werden nicht umgangen.

## Pool-Design und Anhören

Die Website verwendet einen lokal gespeicherten SVG-Poolhintergrund ohne Pflanzen und die selbst gehosteten Pixelschriften VT323 sowie Press Start 2P (Lizenzen unter `public/fonts`). Der Button „Musik im Web anhören“ ist nach Auswahl eines Tracks aktiv. Erst beim Anklicken wird der offizielle SoundCloud-Player geladen; es findet kein zusätzlicher serverseitiger Audio-Download für die Wiedergabe statt. SoundCloud kann die Wiedergabe einzelner Inhalte einschränken. Eigene Dateien werden über einen lokalen Blob-URL mit nativen Audiosteuerungen abgespielt. Player schließen, eine andere Auswahl oder der Wechsel zwischen Suche und Upload beendet die Wiedergabe.

## Regelmäßige Erreichbarkeitsprüfung

`.github/workflows/site-availability.yml` ruft den Health-Endpunkt der öffentlichen Render-Website alle zehn Minuten ab (Minuten 7, 17, 27, 37, 47 und 57 jeder Stunde). Die Prüfung wartet bei einem Kaltstart und kontrolliert die JSON-Antwort. Sie führt keine Musiksuche und keine Downloads aus. Der Workflow benötigt keine Secrets oder Repository-Berechtigungen und kann unter GitHub Actions manuell gestartet oder deaktiviert werden.

Geplante GitHub-Actions-Läufe können verzögert werden oder ausfallen. Bei öffentlichen Repositories deaktiviert GitHub Zeitpläne nach 60 Tagen ohne Repository-Aktivität. Plattformlimits sowie Render-Ausfallzeiten oder ausgeschöpfte kostenlose Instanzstunden bleiben bestehen. Dauerhafte garantierte Verfügbarkeit erfordert einen geeigneten dauerhaft laufenden Hosting-Tarif. Auf privaten Repositories zählen die Läufe zum jeweiligen Actions-Kontingent; vor Aktivierung Kosten und Limits prüfen.
