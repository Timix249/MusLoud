# MusLoud

Vaporwave-Musikstudio: Titel auf YouTube oder SoundCloud suchen, einen Treffer und MP3 (320 kbps), WAV, FLAC oder OGG auswählen und herunterladen. Alternativ eigene Audiodateien hochladen. Nur Inhalte verwenden, für die du die nötigen Rechte hast. Spotify wird nicht mehr als Quelle angeboten.

## Lokaler Start

Node.js 24, Python 3.11+ mit venv und FFmpeg werden benötigt.

```sh
python3 -m venv /workspace/musloud-tools
/workspace/musloud-tools/bin/pip install -r requirements-media.txt
npm ci --cache /tmp/musloud-npm
YTDLP_PATH=/workspace/musloud-tools/bin/yt-dlp npm start
```

`PORT` ist überschreibbar (Standard 3000); der Server bindet an `0.0.0.0`. `GET /api/health` liefert den Status. Das Dockerfile installiert yt-dlp, seine YouTube-JavaScript-Unterstützung und FFmpeg. Auf Render: Docker-Web-Service, Branch `main`, Health Check `/api/health`; Startbefehl nicht überschreiben.

## Grenzen

- Einzelne öffentliche Tracks bis 20 Minuten; keine Playlists, Livestreams, Anmeldung oder DRM-Umgehung.
- Maximal 80 MB Upload/Quelldatei und 220 MB Ausgabe; temporäre Dateien werden nach Verarbeitung gelöscht.
- Eine Konvertierung und zwei Suchvorgänge gleichzeitig pro Serverprozess. Suchauswahlen sind signiert und 30 Minuten gültig; nach Serverneustart erneut suchen.
- Suchvorgänge laufen maximal 60 Sekunden, jeder Download-/Verarbeitungsschritt maximal 120 Sekunden. Abgebrochene Online-Anfragen beenden den laufenden Unterprozess.
- WAV und FLAC erhöhen nicht die Qualität einer komprimierten Quelle.
- YouTube und SoundCloud können Zugriffe von Hosting-Rechenzentren blockieren. Ohne erfolgreiche Prüfung auf Render wird kein funktionierender Plattformabruf zugesichert. Cookies oder Anmeldedaten sind nicht erforderlich und werden nicht verwendet.
- Benötigte Netzwerkziele: `youtube.com`, `*.youtube.com`, `youtu.be`, `*.googlevideo.com`, `*.ytimg.com`, `soundcloud.com`, `*.soundcloud.com`, `*.sndcdn.com`.

## Tests

`npm test` prüft URL-Validierung, signierte Auswahlen, Fehlertexte und den HTTP-Ablauf. Der Integrationstest ersetzt ausschließlich den externen Downloader durch eine lokale Fixture; FFmpeg verarbeitet echte Audiodaten und alle vier Ausgabe-Codecs werden mit ffprobe geprüft. Diese Tests bestätigen keine Verfügbarkeit der externen Plattformen. Dafür auf dem Zielserver je einen bekannten erlaubten Track suchen und herunterladen.

## Fehler auf Render untersuchen

Die Oberfläche zeigt für Plattformfehler einen Code (z. B. `BOT_CHECK`, `SOURCE_FORBIDDEN`, `LOGIN_REQUIRED`, `EXTRACTOR_FAILED`). In den Render-Logs steht dazu ein JSON-Eintrag mit `event: media_failure`, Vorgang, Code, Request-ID und Revision; private Extractor-Ausgaben oder Media-URLs werden nicht protokolliert. `/api/health` zeigt die laufende Render-Commit-Revision. Bei einem Plattformfehler kann der Nutzer ausdrücklich eine neue Suche auf der anderen Plattform starten und dort einen Treffer auswählen. Das ist keine Zusicherung, dass der Titel dort existiert oder heruntergeladen werden kann. Bot-Prüfungen und Zugriffssperren werden nicht umgangen.

## Auf dem eigenen Windows-PC ausführen

Bei `BOT_CHECK` auf Render kann dieselbe Anwendung auf dem eigenen PC getestet werden. Damit laufen die Plattformabrufe über den Internetanschluss des PCs. Auch dort können Plattformen Zugriffe ablehnen; ein erfolgreicher Download ist nicht garantiert.

1. Docker Desktop von https://www.docker.com/products/docker-desktop/ installieren und starten.
2. Das Repository als ZIP herunterladen und vollständig entpacken.
3. `START-WINDOWS.cmd` doppelklicken. Beim ersten Start werden das Image und alle benötigten Programme gebaut. Der Browser öffnet sich erst nach erfolgreichem Health Check.
4. Musik auf der lokalen Website suchen und herunterladen. Docker Desktop muss dabei laufen.
5. Zum Beenden `STOP-WINDOWS.cmd` öffnen.

Der lokale Dienst ist ausschließlich auf diesem PC erreichbar. Die öffentliche Render-Website wird dadurch nicht mit dem PC verbunden; auf dem iPhone ist dieser lokale Dienst nicht erreichbar. Es werden keine Browser-Cookies kopiert und keine Zugriffs- oder TLS-Prüfungen abgeschaltet. Diese Windows-Startdateien wurden in der Linux-Entwicklungsumgebung erstellt; der erste tatsächliche Windows-Start und ein echter Plattformdownload müssen auf dem PC geprüft werden.

Alternativ auf einem Computer mit Docker Compose: `docker compose -p musloud-local up --build --detach --wait`. Beenden: `docker compose -p musloud-local stop`.
