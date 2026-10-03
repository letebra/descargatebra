# Letebra Tools

**tools.letebra.com** — todas las herramientas que un creador necesita, en un solo sitio. Gratis, sin registro y sin anuncios.

23 herramientas en 6 categorías, cada una en su propia página:

- **Descargar**: vídeos/fotos de Instagram, TikTok, YouTube, Shorts, X, Facebook, Twitch, Reddit y Pinterest (MP4/MP3, lotes, ZIP, listas), subtítulos `.srt`, datos y miniatura.
- **Vídeo**: recortar, comprimir, unir, vertical 9:16, convertir formato, GIF, fotograma, marca de agua.
- **Audio**: velocidad, silenciar, normalizar.
- **Imagen**: quitar fondo (IA en el navegador), redimensionar para redes, comprimir/convertir, zonas seguras.
- **Texto**: fuentes para bio, contador de caracteres, duración de guion.
- **Utilidades**: teleprompter, grabador de pantalla y cámara, QR, calculadora de ganancias.

Backend: FastAPI + [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [gallery-dl](https://github.com/mikf/gallery-dl) + ffmpeg.
Frontend sin paso de compilación: `static/app.html` (plantilla), `static/js/` (módulos ES), `static/css/ui.css`, `static/data/site.json`
(categorías, herramientas, textos SEO — fuente única para el servidor y la web). Librerías en `static/vendor/` (Three.js, qr-code-styling,
@imgly/background-removal, JSZip).

## Ejecutar en local

Requiere Python 3.10+ y `ffmpeg`.

```bash
pip install -r requirements.txt
uvicorn app:app --port 8000
```

## Despliegue (Render, Docker)

```bash
docker build -t letebra-tools .
docker run -p 8000:8000 letebra-tools
```

Variables opcionales: `SITE_URL` (por defecto `https://tools.letebra.com`), `LEGACY_REDIRECT=1` (redirige `descarga.letebra.com` → `SITE_URL`),
`COOKIES_FILE`. Mantén yt-dlp actualizado: las plataformas cambian a menudo.

## API

- `POST /api/upload?name=archivo.mp4` (cuerpo = el archivo, máx. 500 MB) → `{file_id, name, size, kind, duration, width, height}`. Se borra en 1 h.
- `POST /api/job` `{"items": [...], "zip": false, "merge": false}` → `{"id"}`. Cada elemento: `url`+`platform` **o** `file_id`, `format` (`mp4|mp3`),
  `quality` (`best|1080|720|480|small`) y opciones: `start`/`end`, `target_mb`, `vertical` (`blur|black|crop`), `speed`, `mute`, `normalize`,
  `op` (`convert|gif|frame|watermark`) con `to`, `fps`, `width`, `at`, `image`, `wm_text|wm_file`, `wm_pos`, `wm_size`, `wm_opacity`, `wm_margin`, `wm_color`.
- `GET /api/job/{id}` → progreso · `GET /api/job/{id}/file` → resultado (cabecera `X-File-Id` para encadenar herramientas; `X-Multi: 1` si es un ZIP de carrusel).
- `GET /api/info`, `/api/list`, `/api/meta`, `/api/thumb`, `/api/subs`, `/api/subs/file` (`?url=...&platform=...`).

Ajustes sin tocar código (Ko-fi, correo, redes, afiliados, estadísticas): `static/config.js`.

## Cookies (contenido que pide iniciar sesión)

Para carruseles de Instagram, vídeos con restricción de edad o cuando YouTube bloquea el servidor, sube un `cookies.txt` (formato Netscape)
en Render → Environment → Secret Files con el nombre `cookies.txt`. No lo subas nunca al repositorio.
