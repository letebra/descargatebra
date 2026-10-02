import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import quote, urlparse

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.background import BackgroundTask

BASE = Path(__file__).parent
MAX_BATCH = 25

PLATFORM_HOSTS = {
    "instagram": ("instagram.com",),
    "tiktok": ("tiktok.com",),
    "youtube": ("youtube.com", "youtu.be"),
    "shorts": ("youtube.com", "youtu.be"),
}

# MP4 (H.264 + AAC) first so the file plays everywhere; fall back to anything and remux.
FORMATS = {
    "youtube": "bv*[height<=1080][ext=mp4][vcodec^=avc]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b",
    "default": "bv*[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
}

app = FastAPI(title="Descargatebra")


class Item(BaseModel):
    url: str
    platform: str


class Batch(BaseModel):
    items: list[Item]


def detect_platform(url: str) -> str | None:
    host = (urlparse(url).hostname or "").lower()
    if host.endswith("instagram.com"):
        return "instagram"
    if host.endswith("tiktok.com"):
        return "tiktok"
    if host.endswith("youtube.com") or host == "youtu.be":
        return "shorts" if "/shorts/" in url else "youtube"
    return None


def validate(item: Item) -> str:
    url = item.url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    if item.platform not in PLATFORM_HOSTS:
        raise HTTPException(400, "Plataforma no válida.")
    host = (urlparse(url).hostname or "").lower()
    if not any(host == h or host.endswith("." + h) for h in PLATFORM_HOSTS[item.platform]):
        raise HTTPException(400, "El enlace no corresponde a la plataforma seleccionada.")
    return url


def safe_name(title: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\n\r\t]+', " ", title or "video").strip()
    return (name[:80].strip() or "video") + ".mp4"


def fetch(url: str, platform: str, workdir: str) -> tuple[Path, str]:
    fmt = FORMATS["youtube"] if platform in ("youtube", "shorts") else FORMATS["default"]
    opts = {
        "format": fmt,
        "merge_output_format": "mp4",
        "remuxvideo": "mp4",
        "outtmpl": os.path.join(workdir, "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "max_filesize": 2 * 1024**3,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e).lower()
        if "private" in msg or "login" in msg or "sign in" in msg:
            raise HTTPException(403, "El vídeo es privado o requiere iniciar sesión.")
        if "unavailable" in msg or "not found" in msg or "404" in msg:
            raise HTTPException(404, "Vídeo no encontrado o no disponible.")
        raise HTTPException(422, "No se pudo descargar este enlace. Comprueba que es un vídeo público.")
    files = sorted(Path(workdir).glob(f"{info['id']}*.mp4"))
    if not files:
        raise HTTPException(500, "No se generó el archivo MP4.")
    return files[0], safe_name(info.get("title") or info["id"])


def attachment(path: Path, filename: str, workdir: str, media_type: str) -> FileResponse:
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )


@app.get("/api/detect")
def detect(url: str):
    return {"platform": detect_platform(url)}


@app.post("/api/download")
def download(item: Item):
    url = validate(item)
    workdir = tempfile.mkdtemp(prefix="dt_")
    try:
        path, name = fetch(url, item.platform, workdir)
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    return attachment(path, name, workdir, "video/mp4")


@app.post("/api/zip")
def download_zip(batch: Batch):
    if not batch.items:
        raise HTTPException(400, "No hay enlaces.")
    if len(batch.items) > MAX_BATCH:
        raise HTTPException(400, f"Máximo {MAX_BATCH} enlaces por ZIP.")
    urls = [(validate(i), i.platform) for i in batch.items]
    workdir = tempfile.mkdtemp(prefix="dt_")
    zip_path = Path(workdir) / "descargatebra.zip"
    used, failed = set(), []
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
            for n, (url, platform) in enumerate(urls, 1):
                sub = tempfile.mkdtemp(dir=workdir)
                try:
                    path, name = fetch(url, platform, sub)
                except HTTPException as e:
                    failed.append(f"{n}. {url} -> {e.detail}")
                    continue
                stem, i = name[:-4], 2
                while name in used:
                    name, i = f"{stem} ({i}).mp4", i + 1
                used.add(name)
                zf.write(path, name)
                shutil.rmtree(sub, ignore_errors=True)
            if failed:
                zf.writestr("ERRORES.txt", "\n".join(failed))
        if not used:
            raise HTTPException(422, "No se pudo descargar ninguno de los enlaces.")
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    return attachment(zip_path, "descargatebra.zip", workdir, "application/zip")


app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
