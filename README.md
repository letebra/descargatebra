# DescargaTebra

Web para descargar vídeos de **Instagram, TikTok, YouTube (largo), YouTube Shorts, X (Twitter), Facebook, Twitch, Reddit y Pinterest**, en MP4 o MP3 (incluye fotos y carruseles) en MP4.
Descarga individual o múltiple (archivos sueltos o todo en un ZIP).

Backend: FastAPI + [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [gallery-dl](https://github.com/mikf/gallery-dl) (fotos) + ffmpeg. Frontend: `static/index.html` (HTML/CSS/JS sin dependencias).

## Ejecutar en local

Requiere Python 3.10+ y `ffmpeg` instalado.

```bash
pip install -r requirements.txt
uvicorn app:app --port 8000
```

Abre http://localhost:8000

## Docker / despliegue

```bash
docker build -t descargatebra .
docker run -p 8000:8000 descargatebra
```

Funciona en cualquier hosting que ejecute contenedores (Render, Railway, Fly.io, un VPS…). No sirve hosting estático (Netlify/GitHub Pages): la descarga necesita el servidor.

Mantén yt-dlp actualizado (`pip install -U yt-dlp`): las plataformas cambian a menudo y las versiones antiguas dejan de funcionar.

## API

- `POST /api/download` `{"url": "...", "platform": "instagram|tiktok|youtube|shorts|twitter|facebook|twitch|reddit|pinterest", "format": "mp4|mp3"}` → archivo (ZIP con cabecera `X-Multi: 1` si el post tiene varios)
- `POST /api/zip` `{"items": [{"url": "...", "platform": "..."}]}` → ZIP (máx. 25)
- `GET /api/info?url=...&platform=...` → título, miniatura, autor y duración (vista previa)

Monetización y estadísticas: `static/config.js`.
