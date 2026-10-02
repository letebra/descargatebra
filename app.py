import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
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
MAX_BATCH = 50
MAX_LIST = 200
SITE = "https://descarga.letebra.com"
# Optional cookies.txt (Netscape format) to download content that needs login.
# On Render: Environment -> Secret Files -> cookies.txt
COOKIES = next((p for p in (os.environ.get("COOKIES_FILE"), "/etc/secrets/cookies.txt", str(BASE / "cookies.txt"))
                if p and os.path.isfile(p)), None)
LOGIN_HINTS = ("login", "log in", "sign in", "401", "403", "private", "checkpoint")

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

QUALITIES = ("best", "1080", "720", "480", "small")


def video_format(quality: str) -> str:
    # MP4 (H.264 + AAC) first so the file plays everywhere; fall back to anything and remux.
    if quality == "best":
        return "bv*+ba/b"
    if quality == "small":
        return "wv*[height>=240][ext=mp4]+wa[ext=m4a]/w[ext=mp4]/wv*+wa/w"
    q = f"[height<={quality}]"
    return f"bv*{q}[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b{q}[ext=mp4]/bv*{q}+ba/b{q}/b"


# Landing pages per platform: same page, only <title>/description change (SEO).
SEO_PAGES = {
    "instagram": ("Descargar vídeos de Instagram en MP4 — Reels, posts y fotos", "Descarga Reels, vídeos, fotos y carruseles de Instagram en MP4 gratis, sin registro y en segundos."),
    "tiktok": ("Descargar vídeos de TikTok en MP4 y MP3", "Descarga vídeos de TikTok en MP4 o su audio en MP3 gratis, sin registro y en segundos."),
    "youtube": ("Descargar vídeos de YouTube en MP4 y MP3", "Descarga vídeos de YouTube en MP4 hasta 4K o en MP3 gratis y sin registro."),
    "shorts": ("Descargar YouTube Shorts en MP4", "Descarga YouTube Shorts en MP4 o MP3 gratis, sin registro y en segundos."),
    "x": ("Descargar vídeos de X (Twitter) en MP4", "Descarga vídeos, GIFs e imágenes de X (Twitter) en MP4 gratis y sin registro."),
    "facebook": ("Descargar vídeos de Facebook en MP4", "Descarga vídeos y Reels de Facebook en MP4 o MP3 gratis y sin registro."),
    "twitch": ("Descargar clips de Twitch en MP4", "Descarga clips y vídeos de Twitch en MP4 gratis y sin registro."),
    "reddit": ("Descargar vídeos de Reddit en MP4 con audio", "Descarga vídeos de Reddit en MP4 con sonido gratis y sin registro."),
    "pinterest": ("Descargar vídeos e imágenes de Pinterest", "Descarga vídeos e imágenes de Pinterest en alta calidad gratis y sin registro."),
}

app = FastAPI(title="DescargaTebra")


class Item(BaseModel):
    url: str
    platform: str
    format: str = "mp4"
    quality: str = "1080"


class JobRequest(BaseModel):
    items: list[Item]
    zip: bool = False


class Job:
    def __init__(self, count: int):
        self.id = uuid.uuid4().hex
        self.created = time.time()
        self.workdir = tempfile.mkdtemp(prefix="dt_")
        self.status = "queued"  # queued | downloading | processing | done | error
        self.count, self.current, self.failed = count, 0, []
        self.downloaded = self.total = self.speed = self.eta = None
        self.error = None
        self.result = None  # (path, filename, media_type, multi)

    def hook(self, d: dict):
        if d["status"] == "downloading":
            frag, frags = d.get("fragment_index"), d.get("fragment_count")
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            self.status = "downloading"
            self.downloaded, self.speed, self.eta = d.get("downloaded_bytes"), d.get("speed"), d.get("eta")
            self.total = total or (self.downloaded * frags / frag if frag and frags and self.downloaded else None)
        elif d["status"] == "finished":
            self.status = "processing"

    def pp_hook(self, d: dict):
        if d["status"] == "started":
            self.status = "processing"

    def state(self) -> dict:
        pct = round(100 * self.downloaded / self.total) if self.downloaded and self.total else None
        return {"status": self.status, "pct": min(pct, 100) if pct is not None else None, "downloaded": self.downloaded,
                "total": self.total, "speed": self.speed, "eta": self.eta, "current": self.current,
                "count": self.count, "failed": self.failed, "error": self.error}


JOBS: dict[str, Job] = {}


def host_ok(platform: str, host: str) -> bool:
    if platform == "pinterest" and re.search(r"(^|\.)pinterest\.[a-z.]+$", host):
        return True
    return any(host == h or host.endswith("." + h) for h in PLATFORM_HOSTS[platform])


def validate(item: Item) -> str:
    url = item.url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    if item.platform not in PLATFORM_HOSTS or item.format not in ("mp4", "mp3") or item.quality not in QUALITIES:
        raise HTTPException(400, "invalid")
    if not host_ok(item.platform, (urlparse(url).hostname or "").lower()):
        raise HTTPException(400, "mismatch")
    return url


def safe_name(title: str, ext: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\n\r\t]+', " ", title or "video").strip()
    return (name[:80].strip() or "video") + "." + ext


def cookie_copy(workdir: str) -> str | None:
    # yt-dlp writes cookies back on exit and /etc/secrets is read-only: use a private copy.
    if not COOKIES:
        return None
    dst = os.path.join(workdir, ".cookies.txt")
    shutil.copy(COOKIES, dst)
    return dst


def ydl_error(e: Exception) -> HTTPException:
    msg = str(e).lower()
    if "private" in msg or "login" in msg or "sign in" in msg:
        return HTTPException(403, "private")
    if "unavailable" in msg or "not found" in msg or "404" in msg:
        return HTTPException(404, "notfound")
    return HTTPException(422, "failed")


def fetch_ytdlp(url: str, fmt: str, quality: str, workdir: str, job: Job | None) -> list[tuple[Path, str]]:
    opts = {
        "outtmpl": os.path.join(workdir, "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "max_filesize": 2 * 1024**3,
        "socket_timeout": 20,
        "retries": 2,
        "cookiefile": cookie_copy(workdir),
        "playlistend": 1,  # a pure playlist URL downloads only its first item (lists go through /api/list)
        "progress_hooks": [job.hook] if job else [],
        "postprocessor_hooks": [job.pp_hook] if job else [],
    }
    if fmt == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]
    else:
        opts["format"] = video_format(quality)
        opts["merge_output_format"] = "mp4"
        opts["remuxvideo"] = "mp4"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    if info.get("entries") is not None:
        info = next((e for e in info["entries"] if e), None)
        if not info:
            raise HTTPException(404, "notfound")
    files = sorted(Path(workdir).glob(f"{info['id']}*.{fmt}"))
    if not files:
        raise HTTPException(500, "nofile")
    return [(files[0], safe_name(info.get("title") or info["id"], fmt))]


def fetch_gallery(url: str, workdir: str) -> tuple[list[tuple[Path, str]], str]:
    """Photos, carousels and image posts (gallery-dl). Returns (files, error output)."""
    cmd = [sys.executable, "-m", "gallery_dl", "-q", "-D", workdir,
           "--sleep-request", "0", "-R", "1", "--http-timeout", "20"]
    cookies = cookie_copy(workdir)
    if cookies:
        cmd += ["-C", cookies]
    try:
        err = subprocess.run(cmd + [url], timeout=90, capture_output=True, text=True).stderr
    except subprocess.TimeoutExpired:
        err = "timeout"
    files = sorted(p for p in Path(workdir).iterdir()
                   if p.is_file() and not p.name.startswith(".") and not p.name.endswith((".part", ".json")))
    return [(p, p.name) for p in files], err.lower()


def fetch(url: str, platform: str, fmt: str, quality: str, workdir: str, job: Job | None = None) -> list[tuple[Path, str]]:
    gallery_err = None
    # Instagram posts (/p/) can be carousels with photos: try gallery-dl first.
    if fmt == "mp4" and platform == "instagram" and "/p/" in url:
        files, gallery_err = fetch_gallery(url, tempfile.mkdtemp(dir=workdir))
        if files:
            return files
    try:
        return fetch_ytdlp(url, fmt, quality, workdir, job)
    except HTTPException as e:
        # No video in the post (photo, image tweet, pin...): fall back to images (once).
        if fmt == "mp4" and e.detail == "failed" and gallery_err is None:
            files, gallery_err = fetch_gallery(url, tempfile.mkdtemp(dir=workdir))
            if files:
                return files
        if gallery_err and any(h in gallery_err for h in LOGIN_HINTS):
            raise HTTPException(403, "private")
        if fmt == "mp3" and e.detail == "failed":
            raise HTTPException(422, "noaudio")
        raise


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
    tmp = tempfile.mkdtemp(prefix="dt_")
    opts = {"noplaylist": True, "quiet": True, "no_warnings": True, "skip_download": True,
            "socket_timeout": 15, "retries": 1, "cookiefile": cookie_copy(tmp)}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False, process=False)
            for _ in range(2):  # short links / channel roots redirect to the real page
                if data.get("_type") not in ("url", "url_transparent") or not data.get("url"):
                    break
                data = ydl.extract_info(data["url"], download=False, process=False)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if data.get("_type") in ("playlist", "multi_video"):
        return {"type": "playlist", "title": data.get("title") or "", "uploader": data.get("uploader") or "",
                "count": data.get("playlist_count")}
    thumb = data.get("thumbnail") or next((t.get("url") for t in reversed(data.get("thumbnails") or []) if t.get("url")), None)
    return {
        "type": "video",
        "title": data.get("title") or data.get("description") or "",
        "uploader": data.get("uploader") or data.get("channel") or "",
        "duration": data.get("duration"),
        "thumbnail": thumb,
    }


def entry_url(e: dict) -> str | None:
    u = e.get("webpage_url") or e.get("url")
    if u and u.startswith("http"):
        return u
    if e.get("ie_key") == "Youtube" and e.get("id"):
        return f"https://www.youtube.com/watch?v={e['id']}"
    return None


@app.get("/api/list")
def list_entries(url: str, platform: str):
    """Playlist / channel / profile -> list of item URLs (filled into bulk mode)."""
    url = validate(Item(url=url, platform=platform))
    tmp = tempfile.mkdtemp(prefix="dt_")
    opts = {"quiet": True, "no_warnings": True, "extract_flat": "in_playlist", "playlistend": MAX_LIST,
            "socket_timeout": 20, "retries": 1, "cookiefile": cookie_copy(tmp)}
    out = []
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
            entries = list(data.get("entries") or [])
            # Channel roots list their tabs (Videos, Shorts...): expand them one level.
            if entries and all(e.get("_type") in ("url", "playlist") and e.get("ie_key") == "YoutubeTab" for e in entries):
                tabs, entries = entries[:3], []
                for tab in tabs:
                    entries += list(ydl.extract_info(tab["url"], download=False).get("entries") or [])
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    for e in entries:
        u = entry_url(e or {})
        if u and u not in (o["url"] for o in out):
            out.append({"url": u, "title": e.get("title") or ""})
    if not out:
        raise HTTPException(404, "notfound")
    return {"title": data.get("title") or "", "entries": out[:MAX_LIST]}


ERR_TXT = {"private": "privado o requiere iniciar sesión", "notfound": "no encontrado", "noaudio": "sin audio",
           "failed": "no se pudo descargar", "nofile": "no se generó el archivo"}


def zip_files(files: list[tuple[Path, str]], zip_path: Path):
    used = set()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
        for path, name in files:
            add_unique(zf, path, name, used)


def run_job(job: Job, items: list[tuple[str, Item]], as_zip: bool):
    try:
        if not as_zip:
            url, it = items[0]
            files = fetch(url, it.platform, it.format, it.quality, job.workdir, job)
            if len(files) == 1:
                path, name = files[0]
                job.result = (path, name, mimetypes.guess_type(name)[0] or "application/octet-stream", False)
            else:
                zip_path = Path(job.workdir) / "descargatebra.zip"
                zip_files(files, zip_path)
                job.result = (zip_path, "descargatebra.zip", "application/zip", True)
        else:
            zip_path = Path(job.workdir) / "descargatebra.zip"
            used, errors = set(), []
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
                for n, (url, it) in enumerate(items):
                    job.current, job.status, job.downloaded, job.total = n, "downloading", None, None
                    sub = tempfile.mkdtemp(dir=job.workdir)
                    try:
                        files = fetch(url, it.platform, it.format, it.quality, sub, job)
                    except HTTPException as e:
                        job.failed.append(n)
                        errors.append(f"{n + 1}. {url} -> {ERR_TXT.get(e.detail, e.detail)}")
                        continue
                    for path, name in files:
                        add_unique(zf, path, name, used)
                    shutil.rmtree(sub, ignore_errors=True)
                if errors:
                    zf.writestr("ERRORES.txt", "\n".join(errors))
            if not used:
                raise HTTPException(422, "allfailed")
            job.current = len(items)
            job.result = (zip_path, "descargatebra.zip", "application/zip", False)
        job.status = "done"
    except HTTPException as e:
        job.status, job.error = "error", e.detail
    except Exception:
        job.status, job.error = "error", "failed"


def cleanup_jobs():
    for jid, job in list(JOBS.items()):
        if time.time() - job.created > 3600:
            shutil.rmtree(job.workdir, ignore_errors=True)
            JOBS.pop(jid, None)


@app.post("/api/job")
def create_job(req: JobRequest):
    if not req.items:
        raise HTTPException(400, "empty")
    if req.zip and len(req.items) > MAX_BATCH:
        raise HTTPException(400, "toomany")
    items = [(validate(i), i) for i in req.items]
    cleanup_jobs()
    job = Job(len(items))
    JOBS[job.id] = job
    threading.Thread(target=run_job, args=(job, items, req.zip), daemon=True).start()
    return {"id": job.id}


@app.get("/api/job/{jid}")
def job_state(jid: str):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404, "notfound")
    return job.state()


@app.get("/api/job/{jid}/file")
def job_file(jid: str):
    job = JOBS.get(jid)
    if not job or not job.result:
        raise HTTPException(404, "notfound")
    JOBS.pop(jid, None)
    path, name, media_type, multi = job.result
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"}
    if multi:
        headers["X-Multi"] = "1"
    return FileResponse(path, media_type=media_type, headers=headers,
                        background=BackgroundTask(shutil.rmtree, job.workdir, ignore_errors=True))


def seo_page(slug: str) -> str:
    title, desc = SEO_PAGES[slug]
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"<title>.*?</title>", f"<title>{title} | DescargaTebra</title>", html, count=1)
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
