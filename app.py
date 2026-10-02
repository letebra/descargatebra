import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import quote, urlparse

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.background import BackgroundTask

BASE = Path(__file__).parent
STATIC = BASE / "static"
MAX_BATCH = 25
SITE = "https://descarga.letebra.com"

PLATFORM_HOSTS = {
    "instagram": ("instagram.com",),
    "tiktok": ("tiktok.com",),
    "youtube": ("youtube.com", "youtu.be"),
    "shorts": ("youtube.com", "youtu.be"),
    "twitter": ("x.com", "twitter.com"),
    "facebook": ("facebook.com", "fb.watch", "fb.com"),
    "twitch": ("twitch.tv",),
    "reddit": ("reddit.com", "redd.it"),
    "pinterest": ("pin.it",),
}

# MP4 (H.264 + AAC) first so the file plays everywhere; fall back to anything and remux.
FORMATS = {
    "youtube": "bv*[height<=1080][ext=mp4][vcodec^=avc]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b",
    "default": "bv*[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
}

# Landing pages per platform: same page, only <title>/description change (SEO).
SEO_PAGES = {
    "instagram": ("Descargar vídeos de Instagram en MP4 — Reels, posts y fotos", "Descarga Reels, vídeos, fotos y carruseles de Instagram en MP4 gratis, sin registro y en segundos."),
    "tiktok": ("Descargar vídeos de TikTok en MP4 y MP3", "Descarga vídeos de TikTok en MP4 o su audio en MP3 gratis, sin registro y en segundos."),
    "youtube": ("Descargar vídeos de YouTube en MP4 y MP3", "Descarga vídeos de YouTube en MP4 hasta 1080p o en MP3 gratis y sin registro."),
    "shorts": ("Descargar YouTube Shorts en MP4", "Descarga YouTube Shorts en MP4 o MP3 gratis, sin registro y en segundos."),
    "x": ("Descargar vídeos de X (Twitter) en MP4", "Descarga vídeos, GIFs e imágenes de X (Twitter) en MP4 gratis y sin registro."),
    "facebook": ("Descargar vídeos de Facebook en MP4", "Descarga vídeos y Reels de Facebook en MP4 o MP3 gratis y sin registro."),
    "twitch": ("Descargar clips de Twitch en MP4", "Descarga clips y vídeos de Twitch en MP4 gratis y sin registro."),
    "reddit": ("Descargar vídeos de Reddit en MP4 con audio", "Descarga vídeos de Reddit en MP4 con sonido gratis y sin registro."),
    "pinterest": ("Descargar vídeos e imágenes de Pinterest", "Descarga vídeos e imágenes de Pinterest en alta calidad gratis y sin registro."),
}

app = FastAPI(title="Descargatebra")


class Item(BaseModel):
    url: str
    platform: str
    format: str = "mp4"


class Batch(BaseModel):
    items: list[Item]


def host_ok(platform: str, host: str) -> bool:
    if platform == "pinterest" and re.search(r"(^|\.)pinterest\.[a-z.]+$", host):
        return True
    return any(host == h or host.endswith("." + h) for h in PLATFORM_HOSTS[platform])


def validate(item: Item) -> str:
    url = item.url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    if item.platform not in PLATFORM_HOSTS or item.format not in ("mp4", "mp3"):
        raise HTTPException(400, "invalid")
    if not host_ok(item.platform, (urlparse(url).hostname or "").lower()):
        raise HTTPException(400, "mismatch")
    return url


def safe_name(title: str, ext: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\n\r\t]+', " ", title or "video").strip()
    return (name[:80].strip() or "video") + "." + ext


def ydl_error(e: Exception) -> HTTPException:
    msg = str(e).lower()
    if "private" in msg or "login" in msg or "sign in" in msg:
        return HTTPException(403, "private")
    if "unavailable" in msg or "not found" in msg or "404" in msg:
        return HTTPException(404, "notfound")
    return HTTPException(422, "failed")


def fetch_ytdlp(url: str, platform: str, fmt: str, workdir: str) -> list[tuple[Path, str]]:
    opts = {
        "outtmpl": os.path.join(workdir, "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "max_filesize": 2 * 1024**3,
    }
    if fmt == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]
    else:
        opts["format"] = FORMATS["youtube"] if platform in ("youtube", "shorts") else FORMATS["default"]
        opts["merge_output_format"] = "mp4"
        opts["remuxvideo"] = "mp4"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    files = sorted(Path(workdir).glob(f"{info['id']}*.{fmt}"))
    if not files:
        raise HTTPException(500, "nofile")
    return [(files[0], safe_name(info.get("title") or info["id"], fmt))]


def fetch_gallery(url: str, workdir: str) -> list[tuple[Path, str]]:
    """Photos, carousels and image posts (gallery-dl)."""
    try:
        subprocess.run(
            [sys.executable, "-m", "gallery_dl", "-q", "-D", workdir, url],
            timeout=180, capture_output=True,
        )
    except subprocess.TimeoutExpired:
        pass
    files = sorted(p for p in Path(workdir).iterdir() if p.is_file() and not p.name.endswith((".part", ".json")))
    return [(p, p.name) for p in files]


def fetch(url: str, platform: str, fmt: str, workdir: str) -> list[tuple[Path, str]]:
    # Instagram posts (/p/) can be carousels with photos: try gallery-dl first.
    if fmt == "mp4" and platform == "instagram" and "/p/" in url:
        files = fetch_gallery(url, tempfile.mkdtemp(dir=workdir))
        if files:
            return files
    try:
        return fetch_ytdlp(url, platform, fmt, workdir)
    except HTTPException as e:
        # No video in the post (photo, image tweet, pin...): fall back to images.
        if fmt == "mp4" and e.detail == "failed":
            files = fetch_gallery(url, tempfile.mkdtemp(dir=workdir))
            if files:
                return files
        if fmt == "mp3" and e.detail == "failed":
            raise HTTPException(422, "noaudio")
        raise


def attachment(path: Path, filename: str, workdir: str, media_type: str, multi: bool = False) -> FileResponse:
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    if multi:
        headers["X-Multi"] = "1"
    return FileResponse(path, media_type=media_type, headers=headers,
                        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True))


def add_unique(zf: zipfile.ZipFile, path: Path, name: str, used: set):
    stem, ext = os.path.splitext(name)
    i = 2
    while name in used:
        name, i = f"{stem} ({i}){ext}", i + 1
    used.add(name)
    zf.write(path, name)


@app.get("/api/info")
def info(url: str, platform: str):
    url = validate(Item(url=url, platform=platform))
    opts = {"noplaylist": True, "quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False, process=False)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    thumb = data.get("thumbnail") or next((t.get("url") for t in reversed(data.get("thumbnails") or []) if t.get("url")), None)
    return {
        "title": data.get("title") or data.get("description") or "",
        "uploader": data.get("uploader") or data.get("channel") or "",
        "duration": data.get("duration"),
        "thumbnail": thumb,
    }


@app.post("/api/download")
def download(item: Item):
    url = validate(item)
    workdir = tempfile.mkdtemp(prefix="dt_")
    try:
        files = fetch(url, item.platform, item.format, workdir)
        if len(files) == 1:
            path, name = files[0]
            return attachment(path, name, workdir, mimetypes.guess_type(name)[0] or "application/octet-stream")
        zip_path = Path(workdir) / "descargatebra.zip"
        used = set()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
            for path, name in files:
                add_unique(zf, path, name, used)
        return attachment(zip_path, "descargatebra.zip", workdir, "application/zip", multi=True)
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise


ERR_TXT = {"private": "privado o requiere iniciar sesión", "notfound": "no encontrado", "noaudio": "sin audio",
           "failed": "no se pudo descargar", "nofile": "no se generó el archivo"}


@app.post("/api/zip")
def download_zip(batch: Batch):
    if not batch.items:
        raise HTTPException(400, "empty")
    if len(batch.items) > MAX_BATCH:
        raise HTTPException(400, "toomany")
    urls = [(validate(i), i.platform, i.format) for i in batch.items]
    workdir = tempfile.mkdtemp(prefix="dt_")
    zip_path = Path(workdir) / "descargatebra.zip"
    used, failed = set(), []
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
            for n, (url, platform, fmt) in enumerate(urls, 1):
                sub = tempfile.mkdtemp(dir=workdir)
                try:
                    files = fetch(url, platform, fmt, sub)
                except HTTPException as e:
                    failed.append(f"{n}. {url} -> {ERR_TXT.get(e.detail, e.detail)}")
                    continue
                for path, name in files:
                    add_unique(zf, path, name, used)
                shutil.rmtree(sub, ignore_errors=True)
            if failed:
                zf.writestr("ERRORES.txt", "\n".join(failed))
        if not used:
            raise HTTPException(422, "allfailed")
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    return attachment(zip_path, "descargatebra.zip", workdir, "application/zip")


def seo_page(slug: str) -> str:
    title, desc = SEO_PAGES[slug]
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"<title>.*?</title>", f"<title>{title} | Descargatebra</title>", html, count=1)
    html = re.sub(r'(<meta name="description" content=")[^"]*', rf"\g<1>{desc}", html, count=1)
    return html.replace(f'<link rel="canonical" href="{SITE}/">', f'<link rel="canonical" href="{SITE}/{slug}">')


for _slug in SEO_PAGES:
    app.add_api_route(f"/{_slug}", (lambda s: lambda: HTMLResponse(seo_page(s)))(_slug),
                      methods=["GET"], include_in_schema=False)


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    urls = [f"{SITE}/"] + [f"{SITE}/{s}" for s in SEO_PAGES]
    body = "".join(f"<url><loc>{u}</loc></url>" for u in urls)
    return PlainTextResponse(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>',
                             media_type="application/xml")


@app.get("/robots.txt", include_in_schema=False)
def robots():
    return PlainTextResponse(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {SITE}/sitemap.xml\n")


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
