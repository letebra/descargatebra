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

- `POST /api/job` `{"items": [{"url", "platform", "format": "mp4|mp3", "quality": "best|1080|720|480|small"}], "zip": false}` → `{"id"}` (máx. 50 con `zip`)
- `GET /api/job/{id}` → estado y progreso (`status`, `pct`, `downloaded`, `total`, `speed`, `eta`, `current`, `count`, `failed`, `error`)
- `GET /api/job/{id}/file` → el archivo (ZIP con cabecera `X-Multi: 1` si un post tiene varios archivos)
- `GET /api/info?url=...&platform=...` → vista previa (vídeo o lista)
- `GET /api/list?url=...&platform=...` → enlaces de una playlist / canal / perfil (máx. 200)
- `GET /api/meta?url=...&platform=...` → todos los datos (título, autor, fechas, visitas, likes, tags, hashtags, descripción, miniatura HD)
- `GET /api/thumb?url=...&name=...` → descarga de la miniatura

Opciones por elemento en `/api/job`: `start`/`end` (recorte, segundos), `target_mb` (comprimir). `merge: true` une todos en un vídeo (máx. 20).

Monetización y estadísticas: `static/config.js`.

## Cookies (contenido que pide iniciar sesión)

Para fotos/carruseles de Instagram, vídeos con restricción de edad o cuando YouTube bloquea el servidor,
sube un `cookies.txt` (formato Netscape) en Render → Environment → Secret Files con el nombre `cookies.txt`.
Se usa automáticamente con yt-dlp y gallery-dl. No lo subas nunca al repositorio.
