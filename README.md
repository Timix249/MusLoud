# MusLoud

Responsive Vaporwave-Musikstudio mit Spotify-Suche/Links und echter Konvertierung eigener Audiodateien in MP3 (320 kbps), WAV, FLAC und OGG. Spotify-Audio wird nicht heruntergeladen.

## Start

Node.js 24 und FFmpeg werden benötigt.

```sh
npm ci --cache /tmp/musloud-npm
npm start
```

Der Server lauscht auf Port 3000 (überschreibbar mit `PORT`). `GET /api/health` prüft den Server. Uploads sind auf 80 MB begrenzt und werden nach Verarbeitung gelöscht. Konvertierungen werden nach 120 Sekunden beendet.

Für einen öffentlichen Betrieb einen HTTPS-Reverse-Proxy, Zugriffslimits und eine Begrenzung gleichzeitiger Konvertierungen ergänzen. Diese Entwicklungsinstanz stellt noch keinen öffentlichen Hosting-Link bereit.
