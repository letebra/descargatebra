import hashlib
import html
import json
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
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request as UrlRequest, urlopen

import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.background import BackgroundTask
from starlette.middleware.gzip import GZipMiddleware

BASE = Path(__file__).parent
STATIC = BASE / "static"
SITE = os.environ.get("SITE_URL", "https://tools.letebra.com").rstrip("/")
LEGACY_HOSTS = {"descarga.letebra.com"}
# Set LEGACY_REDIRECT=1 on Render once tools.letebra.com works, to send descarga.letebra.com there (301).
LEGACY_REDIRECT = os.environ.get("LEGACY_REDIRECT") == "1"
DATA = json.loads((STATIC / "data" / "site.json").read_text(encoding="utf-8"))
TOOLS = {t["slug"]: t for t in DATA["tools"]}
PAGES = DATA["pages"]
PLATFORM_PAGES = DATA["platforms"]

MAX_BATCH = 50
MAX_LIST = 200
MAX_MERGE = 20
MAX_UPLOAD = 500 * 1024 * 1024
MAX_GIF = 30  # seconds
VIDEO_EXT = {".mp4", ".mkv", ".webm", ".mov", ".m4v"}
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
UPLOAD_DIR = Path(tempfile.mkdtemp(prefix="uploads_"))
FONT = next((f for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                         "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf") if os.path.isfile(f)), None)
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
QUALITY_CAP = {"1080": 1080, "720": 720, "480": 480, "small": 360}  # max size of the video's short side
CONVERT_TO = ("mp4", "mov", "webm", "mkv", "mp3", "wav", "m4a")
WM_POS = ("tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br")


def video_format(quality: str) -> str:
    # MP4 (H.264 + AAC) first so the file plays everywhere; fall back to anything and remux.
    if quality == "best":
        return "bv*+ba/b"
    if quality == "small":
        return "wv*[height>=240][ext=mp4]+wa[ext=m4a]/w[ext=mp4]/wv*+wa/w"
    q = f"[height<={quality}]"
    return f"bv*{q}[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b{q}[ext=mp4]/bv*{q}+ba/b{q}/b"


class SelectiveGZip:
    """Gzip pages and assets, but never API responses (videos would burn CPU for nothing)."""

    def __init__(self, app):
        self.app, self.gzip = app, GZipMiddleware(app, minimum_size=1024)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and not scope["path"].startswith("/api/"):
            return await self.gzip(scope, receive, send)
        return await self.app(scope, receive, send)


app = FastAPI(title="Letebra Tools")
app.add_middleware(SelectiveGZip)


@app.middleware("http")
async def headers_and_legacy(request: Request, call_next):
    host = (request.headers.get("host") or "").split(":")[0].lower()
    path = request.url.path
    if LEGACY_REDIRECT and host in LEGACY_HOSTS and path != "/ping" and not path.startswith("/api/"):
        target = "/descargar" if path == "/" else path
        query = f"?{request.url.query}" if request.url.query else ""
        return RedirectResponse(SITE + target + query, status_code=301)
    resp = await call_next(request)
    ctype = resp.headers.get("content-type", "")
    if path.startswith(("/vendor/", "/img/")) or (request.query_params.get("v") == ASSET_V and path.startswith(("/js/", "/css/", "/config.js"))):
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif ctype.startswith(("text/html", "text/javascript", "application/javascript", "text/css", "application/json")):
        # Pages, scripts and styles revalidate on every visit so updates show up without Ctrl+F5.
        resp.headers["Cache-Control"] = "no-cache"
    return resp


class Item(BaseModel):
    url: str | None = None
    file_id: str | None = None  # uploaded with /api/upload (instead of url)
    platform: str | None = None
    format: str = "mp4"
    quality: str = "1080"
    start: float | None = None  # trim / gif, seconds
    end: float | None = None
    target_mb: float | None = None  # compress to at most this size
    vertical: str | None = None  # 9:16 background: blur | black | crop
    mute: bool = False
    normalize: bool = False
    speed: float | None = None  # 0.5 - 2.0
    op: str | None = None  # convert | gif | frame | watermark
    to: str | None = None  # convert target
    fps: int | None = None  # gif
    width: int | None = None  # gif (0 = original)
    at: float | None = None  # frame, seconds
    image: str = "png"  # frame: png | jpg
    wm_file: str | None = None  # watermark image (upload id)
    wm_text: str | None = None
    wm_pos: str = "br"
    wm_size: float = 18  # image: % of video width · text: % of video height
    wm_opacity: float = 0.85
    wm_margin: float = 3  # % of the short side
    wm_color: str = "#ffffff"


class JobRequest(BaseModel):
    items: list[Item]
    zip: bool = False
    merge: bool = False


class Job:
    def __init__(self, count: int):
        self.id = uuid.uuid4().hex
        self.created = time.time()
        self.workdir = tempfile.mkdtemp(prefix="dt_")
        self.status = "queued"  # queued | downloading | processing | done | error
        self.count, self.current, self.failed = count, 0, []
        self.downloaded = self.total = self.speed = self.eta = None
        self.error = None
        self.stage, self.proc_pct = None, None  # ffmpeg step: trim | compress | merge | ...
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
        if self.status == "processing" and self.proc_pct is not None:
            pct = round(self.proc_pct)
        return {"status": self.status, "pct": min(pct, 100) if pct is not None else None, "downloaded": self.downloaded,
                "total": self.total, "speed": self.speed, "eta": self.eta, "current": self.current,
                "count": self.count, "failed": self.failed, "error": self.error,
                "stage": self.stage if self.status == "processing" else None}


JOBS: dict[str, Job] = {}
UPLOADS: dict[str, dict] = {}  # file_id -> {path, name, kind, created}
# One extraction at a time: for YouTube each one runs Deno to solve the player's JS, and two at once
# (e.g. preview + download) don't fit in a 512 MB instance. Downloads themselves run in parallel.
EXTRACT = threading.Lock()


def host_ok(platform: str, host: str) -> bool:
    if platform == "pinterest" and re.search(r"(^|\.)pinterest\.[a-z.]+$", host):
        return True
    return any(host == h or host.endswith("." + h) for h in PLATFORM_HOSTS[platform])


def validate(item: Item) -> str | None:
    """Checks the item; returns the normalized URL (None when the source is an uploaded file)."""
    if item.format not in ("mp4", "mp3") or item.quality not in QUALITIES:
        raise HTTPException(400, "invalid")
    if (item.start is not None and item.start < 0) or (item.end is not None and item.end <= (item.start or 0)):
        raise HTTPException(400, "badtrim")
    if item.target_mb is not None and not 1 <= item.target_mb <= 4000:
        raise HTTPException(400, "invalid")
    if item.vertical not in (None, "blur", "black", "crop") or (item.speed is not None and not 0.5 <= item.speed <= 2):
        raise HTTPException(400, "invalid")
    if item.op not in (None, "convert", "gif", "frame", "watermark"):
        raise HTTPException(400, "invalid")
    if item.op == "convert" and item.to not in CONVERT_TO:
        raise HTTPException(400, "invalid")
    if item.op == "watermark":
        if not (item.wm_file or (item.wm_text or "").strip()) or item.wm_pos not in WM_POS \
                or not re.fullmatch(r"#[0-9a-fA-F]{6}", item.wm_color) or not 0.05 <= item.wm_opacity <= 1 \
                or not 1 <= item.wm_size <= 60 or not 0 <= item.wm_margin <= 20:
            raise HTTPException(400, "invalid")
        if item.wm_file and item.wm_file not in UPLOADS:
            raise HTTPException(404, "upload")
    if item.file_id:
        if item.file_id not in UPLOADS:
            raise HTTPException(404, "upload")
        return None
    url = (item.url or "").strip()
    if not url or item.platform not in PLATFORM_HOSTS:
        raise HTTPException(400, "invalid")
    if not re.match(r"^https?://", url):
        url = "https://" + url
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
    print(f"[yt-dlp] {e}", file=sys.stderr, flush=True)  # visible in Render -> Logs
    if "not a bot" in msg or "confirm you" in msg:
        return HTTPException(403, "ytbot")
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
            with EXTRACT:
                info = ydl.extract_info(url, download=False)
            info = ydl.process_ie_result(info, download=True)
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


def fit_quality(files: list[tuple[Path, str]], fmt: str, quality: str, job: Job | None) -> list[tuple[Path, str]]:
    """Platforms like Instagram offer a single quality: downscale ourselves when it's above the chosen one."""
    cap = QUALITY_CAP.get(quality)
    if fmt != "mp4" or not cap:
        return files
    out = []
    for path, name in files:
        info = probe(path) if is_video(path) else None
        if info and min(info["width"], info["height"]) > cap:
            small = path.with_name(path.stem + f"_{cap}p.mp4")
            scale = f"scale=-2:{cap}" if info["width"] >= info["height"] else f"scale={cap}:-2"
            run_ffmpeg(["-i", str(path), "-vf", scale, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
                        "-c:a", "copy", "-movflags", "+faststart", str(small)], job or Job(1), info["duration"], "resize")
            path = small
        out.append((path, name))
    return out


def fetch(url: str, platform: str, fmt: str, quality: str, workdir: str, job: Job | None = None) -> list[tuple[Path, str]]:
    return fit_quality(_fetch(url, platform, fmt, quality, workdir, job), fmt, quality, job)


def _fetch(url: str, platform: str, fmt: str, quality: str, workdir: str, job: Job | None) -> list[tuple[Path, str]]:
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


def source(url: str | None, it: Item, workdir: str, job: Job) -> list[tuple[Path, str]]:
    """Input files of an item: downloaded from its URL, or the uploaded file."""
    if not it.file_id:
        return fetch(url, it.platform, it.format, it.quality, workdir, job)
    up = UPLOADS.get(it.file_id)
    if not up or not up["path"].exists():
        raise HTTPException(404, "upload")
    dst = Path(workdir) / ("src" + up["path"].suffix)
    try:
        os.link(up["path"], dst)
    except OSError:
        shutil.copy(up["path"], dst)
    return fit_quality([(dst, up["name"])], "mp4", it.quality, job)


def add_unique(zf: zipfile.ZipFile, path: Path, name: str, used: set):
    stem, ext = os.path.splitext(name)
    i = 2
    while name in used:
        name, i = f"{stem} ({i}){ext}", i + 1
    used.add(name)
    zf.write(path, name)


def extract_page(url: str) -> dict:
    """Metadata of a URL without downloading (follows short links / channel roots)."""
    tmp = tempfile.mkdtemp(prefix="dt_")
    opts = {"noplaylist": True, "quiet": True, "no_warnings": True, "skip_download": True,
            "socket_timeout": 15, "retries": 1, "cookiefile": cookie_copy(tmp)}
    try:
        with EXTRACT, yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False, process=False)
            for _ in range(2):
                if data.get("_type") not in ("url", "url_transparent") or not data.get("url"):
                    break
                data = ydl.extract_info(data["url"], download=False, process=False)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return data


@app.get("/api/info")
def info(url: str, platform: str):
    data = extract_page(validate(Item(url=url, platform=platform)))
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


HASHTAG = re.compile(r"#[^\s#.,!?¡¿;:()\[\]\"']+")


@app.get("/api/meta")
def meta(url: str, platform: str):
    """Everything we can read about a video: text, numbers, tags and the best thumbnail."""
    url = validate(Item(url=url, platform=platform))
    d = extract_page(url)
    thumbs = [t for t in d.get("thumbnails") or [] if t.get("url")]
    best = max(thumbs, key=lambda t: (t.get("width") or 0) * (t.get("height") or 0) or t.get("preference") or 0, default=None)
    desc = d.get("description") or ""
    date = d.get("upload_date")
    heights = [f.get("height") for f in d.get("formats") or [] if f.get("height")]
    return {
        "title": d.get("title") or "",
        "uploader": d.get("uploader") or d.get("channel") or d.get("creator") or "",
        "uploader_url": d.get("uploader_url") or d.get("channel_url") or "",
        "followers": d.get("channel_follower_count"),
        "date": f"{date[:4]}-{date[4:6]}-{date[6:]}" if date and len(date) == 8 else None,
        "timestamp": d.get("timestamp"),
        "duration": d.get("duration"),
        "views": d.get("view_count"),
        "likes": d.get("like_count"),
        "comments": d.get("comment_count"),
        "reposts": d.get("repost_count"),
        "resolution": f"{max(heights)}p" if heights else None,
        "categories": d.get("categories") or [],
        "tags": d.get("tags") or [],
        "hashtags": list(dict.fromkeys(HASHTAG.findall(f"{d.get('title') or ''} {desc}"))),
        "description": desc,
        "language": d.get("language"),
        "age_limit": d.get("age_limit"),
        "music": " - ".join(x for x in (d.get("artist") or d.get("creator"), d.get("track")) if x) if d.get("track") else None,
        "thumbnail": d.get("thumbnail") or (best or {}).get("url"),
        "thumbnail_hd": (best or {}).get("url") or d.get("thumbnail"),
        "url": d.get("webpage_url") or url,
        "id": d.get("id"),
    }


@app.get("/api/subs")
def subs_list(url: str, platform: str):
    """Available subtitle languages: uploaded ones first, then automatic (incl. YouTube auto-translations)."""
    d = extract_page(validate(Item(url=url, platform=platform)))
    out = []
    for auto, key in ((False, "subtitles"), (True, "automatic_captions")):
        for code, fmts in (d.get(key) or {}).items():
            if code == "live_chat" or not fmts:
                continue
            out.append({"code": code, "name": next((f.get("name") for f in fmts if f.get("name")), code), "auto": auto})
    return {"title": d.get("title") or "", "langs": out}


@app.get("/api/subs/file")
def subs_file(url: str, platform: str, lang: str, auto: bool = False):
    url = validate(Item(url=url, platform=platform))
    workdir = tempfile.mkdtemp(prefix="dt_")
    opts = {"noplaylist": True, "skip_download": True,
            "writesubtitles": not auto, "writeautomaticsub": auto, "subtitleslangs": [lang],
            "subtitlesformat": "srt/vtt/best", "outtmpl": os.path.join(workdir, "%(id)s.%(ext)s"),
            # "before_dl": with skip_download the default stage never runs
            "postprocessors": [{"key": "FFmpegSubtitlesConvertor", "format": "srt", "when": "before_dl"}],
            "quiet": True, "no_warnings": True, "noprogress": True,
            "socket_timeout": 20, "retries": 1, "cookiefile": cookie_copy(workdir)}
    try:
        with EXTRACT, yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise ydl_error(e)
    files = sorted(Path(workdir).glob("*.srt"))
    if not files:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(404, "nosubs")
    name = safe_name(f"{info.get('title') or info.get('id')} [{lang}]", "srt")
    return FileResponse(files[0], media_type="application/x-subrip",
                        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
                        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True))


@app.get("/api/thumb")
def thumb(url: str, name: str = "miniatura", inline: bool = False):
    """Thumbnails through the server (image CDNs block direct downloads and canvas use)."""
    if not re.match(r"^https?://", url):
        raise HTTPException(400, "invalid")
    try:
        with urlopen(UrlRequest(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as r:
            ctype = r.headers.get("Content-Type", "").split(";")[0]
            data = r.read(20 * 1024 * 1024 + 1)
    except Exception:
        raise HTTPException(404, "notfound")
    if not ctype.startswith("image/") or len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "invalid")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(ctype, "jpg")
    disp = "inline" if inline else "attachment"
    return Response(data, media_type=ctype,
                    headers={"Content-Disposition": f"{disp}; filename*=UTF-8''{quote(safe_name(name, ext))}"})


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
        with EXTRACT, yt_dlp.YoutubeDL(opts) as ydl:
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
           "failed": "no se pudo descargar", "nofile": "no se generó el archivo", "novideo": "no es un vídeo",
           "toosmall": "no cabe en ese tamaño", "procfail": "error al procesar", "nosubs": "sin subtítulos"}


def zip_files(files: list[tuple[Path, str]], zip_path: Path):
    used = set()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
        for path, name in files:
            add_unique(zf, path, name, used)


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
                         capture_output=True, text=True).stdout
    data = json.loads(out or "{}")
    streams = data.get("streams", [])
    video = next((st for st in streams if st.get("codec_type") == "video"
                  and not st.get("disposition", {}).get("attached_pic")), None)
    audio = next((st for st in streams if st.get("codec_type") == "audio"), None)
    try:
        duration = float(data.get("format", {}).get("duration") or 0)
    except ValueError:
        duration = 0.0
    return {
        "duration": duration,
        "width": int(video["width"]) if video else 0,
        "height": int(video["height"]) if video else 0,
        "audio": audio is not None,
        "vcodec": video.get("codec_name") if video else None,
        "acodec": audio.get("codec_name") if audio else None,
    }


def run_ffmpeg(args: list, job: Job, duration: float, stage: str):
    """Runs ffmpeg reporting progress (0-100) into the job."""
    job.status, job.stage, job.proc_pct = "processing", stage, 0
    proc = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1",
                             "-threads", "2", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    for line in proc.stdout:
        if line.startswith("out_time_us=") and duration:
            try:
                job.proc_pct = min(99, int(line.split("=")[1]) / 1e6 / duration * 100)
            except ValueError:
                pass
    if proc.wait() != 0:
        print(f"[ffmpeg:{stage}] {proc.stderr.read()[-800:]}", file=sys.stderr, flush=True)
        raise HTTPException(500, "procfail")


def is_video(p: Path) -> bool:
    return p.suffix.lower() in VIDEO_EXT


def is_audio(p: Path) -> bool:
    return p.suffix.lower() in AUDIO_EXT


H264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]


def trim(path: Path, start: float | None, end: float | None, job: Job) -> Path:
    if not (is_video(path) or is_audio(path)):
        return path
    out = path.with_name(path.stem + "_cut" + (".mp4" if is_video(path) else ".mp3"))
    length = (end - (start or 0)) if end else max(probe(path)["duration"] - (start or 0), 0)
    args = (["-ss", str(start)] if start else []) + ["-i", str(path)] + (["-t", str(length)] if end else [])
    if is_video(path):
        args += [*H264, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]
    else:
        args += ["-c:a", "libmp3lame", "-b:a", "192k"]
    run_ffmpeg(args + [str(out)], job, length, "trim")
    return out


def compress(path: Path, target_mb: float, job: Job) -> Path:
    """Re-encodes to fit in target_mb (MiB), lowering resolution when the bitrate gets small."""
    target = target_mb * 1024 * 1024
    if path.stat().st_size <= target or not (is_video(path) or is_audio(path)):
        return path
    info = probe(path)
    dur = info["duration"] or 1
    out = path.with_name(path.stem + "_small" + (".mp4" if is_video(path) else ".mp3"))
    budget = target * 8 / dur / 1000 * 0.92  # kbps for the whole file
    for _ in range(3):
        if is_audio(path):
            abr = int(max(32, min(320, budget)))
            run_ffmpeg(["-i", str(path), "-vn", "-c:a", "libmp3lame", "-b:a", f"{abr}k", str(out)], job, dur, "compress")
        else:
            abr = (128 if budget > 800 else 64 if budget > 200 else 32) if info["audio"] else 0
            vbr = int(budget - abr)
            if vbr < 40:
                raise HTTPException(422, "toosmall")
            cap = 1080 if vbr > 2500 else 720 if vbr > 1200 else 480 if vbr > 600 else 360 if vbr > 250 else 240
            w, h = info["width"], info["height"]
            vf = []
            if min(w, h) > cap:
                vf = ["-vf", f"scale=-2:{cap}" if w >= h else f"scale={cap}:-2"]
            audio = ["-c:a", "aac", "-b:a", f"{abr}k"] if abr else ["-an"]
            run_ffmpeg(["-i", str(path), *vf, "-c:v", "libx264", "-preset", "veryfast", "-b:v", f"{vbr}k",
                        "-maxrate", f"{int(vbr * 1.2)}k", "-bufsize", f"{vbr * 2}k", "-pix_fmt", "yuv420p", *audio,
                        "-movflags", "+faststart", str(out)], job, dur, "compress")
        size = out.stat().st_size
        if size <= target:
            return out
        budget *= target / size * 0.9  # overshot: retry a bit lower
    raise HTTPException(422, "toosmall")


def merge(paths: list[Path], job: Job, audio_only: bool, out: Path) -> Path:
    """Joins clips into one file; different sizes are letterboxed to the first clip's frame."""
    infos = [probe(p) for p in paths]
    total = sum(i["duration"] for i in infos)
    args, filters, labels = [], [], ""
    for p in paths:
        args += ["-i", str(p)]
    if audio_only:
        labels = "".join(f"[{i}:a]" for i in range(len(paths)))
        filters.append(f"{labels}concat=n={len(paths)}:v=0:a=1[a]")
        run_ffmpeg([*args, "-filter_complex", ";".join(filters), "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k",
                    str(out)], job, total, "merge")
        return out
    w, h = infos[0]["width"] or 1280, infos[0]["height"] or 720
    scale = min(1, 1920 / max(w, h))
    w, h = int(w * scale) // 2 * 2, int(h * scale) // 2 * 2
    extra = len(paths)
    for i, inf in enumerate(infos):
        filters.append(f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,"
                       f"setsar=1,fps=30,format=yuv420p[v{i}]")
        if inf["audio"]:
            filters.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo[a{i}]")
        else:  # silent track so every clip has audio for concat
            args += ["-f", "lavfi", "-t", str(inf["duration"] or 1), "-i", "anullsrc=r=44100:cl=stereo"]
            filters.append(f"[{extra}:a]aformat=channel_layouts=stereo[a{i}]")
            extra += 1
        labels += f"[v{i}][a{i}]"
    filters.append(f"{labels}concat=n={len(paths)}:v=1:a=1[v][a]")
    run_ffmpeg([*args, "-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]", "-c:v", "libx264",
                "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)],
               job, total, "merge")
    return out


def vertical(path: Path, style: str, job: Job) -> Path:
    """Horizontal -> 1080x1920 (TikTok/Shorts): blurred copy behind, black bars, or centre crop."""
    if not is_video(path):
        return path
    out = path.with_name(path.stem + "_vertical.mp4")
    if style == "crop":
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
    elif style == "black":
        vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1"
    else:  # background blurred at low resolution (cheap), then scaled up
        vf = ("split[a][b];[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,"
              "scale=1080:1920[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
              "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1")
    run_ffmpeg(["-i", str(path), "-filter_complex", vf + ",format=yuv420p", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)],
               job, probe(path)["duration"], "vertical")
    return out


def audio_fx(path: Path, it: Item, job: Job) -> Path:
    """Mute, loudness normalization (-14 LUFS, like YouTube/TikTok) and speed change."""
    if not (is_video(path) or is_audio(path)):
        return path
    info, speed = probe(path), it.speed or 1
    video = is_video(path)
    out = path.with_name(path.stem + "_fx" + (".mp4" if video else ".mp3"))
    args = ["-i", str(path)]
    if video:
        args += ["-filter:v", f"setpts=PTS/{speed}"] if speed != 1 else []
        args += H264 if speed != 1 else ["-c:v", "copy"]
    afilters = ([f"atempo={speed}"] if speed != 1 else []) + (["loudnorm=I=-14:TP=-1:LRA=11"] if it.normalize else [])
    if it.mute or not info["audio"]:
        args += ["-an"]
    else:
        args += (["-filter:a", ",".join(afilters)] if afilters else []) + (["-c:a", "aac", "-b:a", "192k"] if video else ["-c:a", "libmp3lame", "-b:a", "192k"])
    run_ffmpeg(args + (["-movflags", "+faststart"] if video else []) + [str(out)], job, info["duration"] / speed, "audio")
    return out


def convert(path: Path, to: str, job: Job) -> Path:
    """Changes container/codec; copies the streams when the target can hold them as they are."""
    info = probe(path)
    out = path.with_name(path.stem + "_conv." + to)
    if to in ("mp3", "wav", "m4a"):
        if not info["audio"]:
            raise HTTPException(422, "noaudio")
        codec = {"mp3": ["-c:a", "libmp3lame", "-b:a", "192k"], "wav": ["-c:a", "pcm_s16le"],
                 "m4a": ["-c:a", "aac", "-b:a", "192k"]}[to]
        args = ["-i", str(path), "-vn", *codec]
    elif not info["width"]:
        raise HTTPException(422, "novideo")
    elif to == "mkv":
        args = ["-i", str(path), "-map", "0:v:0", "-map", "0:a?", "-c", "copy"]
    elif to == "webm":
        args = ["-i", str(path), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime",
                "-cpu-used", "8", "-row-mt", "1", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "128k"]
    else:  # mp4 / mov
        copy_v = info["vcodec"] == "h264"
        copy_a = info["acodec"] in (None, "aac", "mp3")
        args = ["-i", str(path), "-map", "0:v:0", "-map", "0:a?", *(["-c:v", "copy"] if copy_v else H264),
                *(["-c:a", "copy"] if copy_a else ["-c:a", "aac", "-b:a", "192k"]), "-movflags", "+faststart"]
    run_ffmpeg(args + [str(out)], job, info["duration"], "convert")
    return out


def make_gif(path: Path, it: Item, job: Job) -> Path:
    """Two-pass palette GIF (sharp colors, small file) of a clip of up to MAX_GIF seconds."""
    info = probe(path)
    if not info["width"]:
        raise HTTPException(422, "novideo")
    start = it.start or 0
    end = it.end if it.end else min(info["duration"] or start + 5, start + 5)
    length = max(0.1, min(end - start, MAX_GIF))
    fps = it.fps if it.fps in (10, 12, 15, 20, 25) else 15
    width = it.width if it.width in (320, 480, 640, 800) else (min(info["width"], 1080) if it.width == 0 else 480)
    vf = (f"fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];"
          f"[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle")
    out = path.with_name(path.stem + "_anim.gif")
    run_ffmpeg(["-ss", str(start), "-t", str(length), "-i", str(path), "-filter_complex", vf, "-loop", "0", str(out)],
               job, length, "gif")
    return out


def grab_frame(path: Path, it: Item, job: Job) -> Path:
    info = probe(path)
    if not info["width"]:
        raise HTTPException(422, "novideo")
    at = max(0.0, min(it.at or 0, max(info["duration"] - 0.05, 0)))
    ext = "jpg" if it.image == "jpg" else "png"
    out = path.with_name(f"{path.stem}_frame.{ext}")
    run_ffmpeg(["-ss", f"{at:.3f}", "-i", str(path), "-frames:v", "1", *(["-q:v", "2"] if ext == "jpg" else []), str(out)],
               job, 1, "frame")
    return out


def overlay_xy(pos: str, m: int, w: str, h: str) -> tuple[str, str]:
    """overlay/drawtext coordinates for a 3x3 position; w/h are the overlay's own width/height names."""
    x = {"l": f"{m}", "c": f"(W-{w})/2", "r": f"W-{w}-{m}"}[pos[1]]
    y = {"t": f"{m}", "m": f"(H-{h})/2", "b": f"H-{h}-{m}"}[pos[0]]
    return x, y


def watermark(path: Path, it: Item, job: Job) -> Path:
    info = probe(path)
    if not info["width"]:
        raise HTTPException(422, "novideo")
    W, H = info["width"], info["height"]
    m = int(min(W, H) * it.wm_margin / 100)
    out = path.with_name(path.stem + "_wm.mp4")
    audio = ["-map", "0:a?", "-c:a", "copy"]
    if it.wm_file:
        up = UPLOADS.get(it.wm_file)
        if not up:
            raise HTTPException(404, "upload")
        tw = max(8, int(W * it.wm_size / 100) // 2 * 2)
        x, y = overlay_xy(it.wm_pos, m, "w", "h")
        fc = (f"[1:v]scale={tw}:-1,format=rgba,colorchannelmixer=aa={it.wm_opacity:.2f}[wm];"
              f"[0:v][wm]overlay={x}:{y}:format=auto,format=yuv420p[v]")
        # a still image is a single frame: overlay repeats it until the video ends
        args = ["-i", str(path), "-i", str(up["path"]), "-filter_complex", fc, "-map", "[v]", *audio]
    else:
        if not FONT:
            raise HTTPException(500, "procfail")
        tf = Path(job.workdir) / "wm.txt"
        tf.write_text(it.wm_text.strip()[:120], encoding="utf-8")
        fs = max(10, int(H * it.wm_size / 100))
        x, y = overlay_xy(it.wm_pos, m, "tw", "th")
        x, y = x.replace("W", "w"), y.replace("H", "h")  # drawtext names the frame w/h and the text tw/th
        x, y = x.replace("tw", "text_w"), y.replace("th", "text_h")
        color = it.wm_color.lstrip("#")
        shadow = max(1, fs // 18)
        vf = (f"drawtext=fontfile={FONT}:textfile={tf}:fontsize={fs}:fontcolor=0x{color}@{it.wm_opacity:.2f}:"
              f"shadowcolor=black@{it.wm_opacity * 0.55:.2f}:shadowx={shadow}:shadowy={shadow}:x={x}:y={y},format=yuv420p")
        args = ["-i", str(path), "-vf", vf, "-map", "0:v:0", *audio]
    run_ffmpeg([*args, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", str(out)],
               job, info["duration"], "watermark")
    return out


def finish(path: Path, name: str, it: Item, job: Job, allow_trim: bool) -> tuple[Path, str]:
    if it.op == "convert":
        path = convert(path, it.to, job)
    elif it.op == "gif":
        path = make_gif(path, it, job)
    elif it.op == "frame":
        path = grab_frame(path, it, job)
        name = f"{Path(name).stem} {it.at or 0:.2f}s{path.suffix}"
    elif it.op == "watermark":
        path = watermark(path, it, job)
    else:
        if allow_trim and (it.start or it.end):
            path = trim(path, it.start, it.end, job)
        if it.vertical:
            path = vertical(path, it.vertical, job)
        if it.mute or it.normalize or (it.speed and it.speed != 1):
            path = audio_fx(path, it, job)
        if it.target_mb:
            path = compress(path, it.target_mb, job)
    return path, Path(name).stem + path.suffix if path.suffix != Path(name).suffix else name


def run_job(job: Job, items: list[tuple[str | None, Item]], as_zip: bool, as_merge: bool):
    try:
        if as_merge:
            clips = []
            for n, (url, it) in enumerate(items):
                job.current, job.status, job.downloaded, job.total = n, "downloading", None, None
                try:
                    files = source(url, it, tempfile.mkdtemp(dir=job.workdir), job)
                except HTTPException:
                    job.failed.append(n)
                    continue
                clips += [p for p, _ in files if (is_audio(p) if it.format == "mp3" else is_video(p))]
            if not clips:
                raise HTTPException(422, "allfailed")
            job.current = len(items)
            first = items[0][1]
            ext = ".mp3" if first.format == "mp3" else ".mp4"
            path = clips[0] if len(clips) == 1 else merge(clips, job, first.format == "mp3", Path(job.workdir) / f"merged{ext}")
            path, name = finish(path, f"Letebra Tools - unido{ext}", first.model_copy(update={"op": None}), job, allow_trim=False)
            job.result = (path, name, mimetypes.guess_type(name)[0] or "application/octet-stream", False)
        elif not as_zip:
            url, it = items[0]
            files = source(url, it, job.workdir, job)
            files = [finish(p, name, it, job, allow_trim=len(files) == 1) for p, name in files]
            if len(files) == 1:
                path, name = files[0]
                job.result = (path, name, mimetypes.guess_type(name)[0] or "application/octet-stream", False)
            else:
                zip_path = Path(job.workdir) / "letebra-tools.zip"
                zip_files(files, zip_path)
                job.result = (zip_path, "letebra-tools.zip", "application/zip", True)
        else:
            zip_path = Path(job.workdir) / "letebra-tools.zip"
            used, errors = set(), []
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
                for n, (url, it) in enumerate(items):
                    job.current, job.status, job.downloaded, job.total = n, "downloading", None, None
                    sub = tempfile.mkdtemp(dir=job.workdir)
                    try:
                        files = source(url, it, sub, job)
                        files = [finish(p, name, it, job, allow_trim=False) for p, name in files]
                    except HTTPException as e:
                        job.failed.append(n)
                        errors.append(f"{n + 1}. {url or it.file_id} -> {ERR_TXT.get(e.detail, e.detail)}")
                        continue
                    for path, name in files:
                        add_unique(zf, path, name, used)
                    shutil.rmtree(sub, ignore_errors=True)
                if errors:
                    zf.writestr("ERRORES.txt", "\n".join(errors))
            if not used:
                raise HTTPException(422, "allfailed")
            job.current = len(items)
            job.result = (zip_path, "letebra-tools.zip", "application/zip", False)
        job.status = "done"
    except HTTPException as e:
        job.status, job.error = "error", e.detail
    except Exception as e:
        print(f"[job] {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        job.status, job.error = "error", "failed"


def cleanup():
    """Jobs and uploads live one hour."""
    now = time.time()
    for jid, job in list(JOBS.items()):
        if now - job.created > 3600:
            shutil.rmtree(job.workdir, ignore_errors=True)
            JOBS.pop(jid, None)
    for fid, up in list(UPLOADS.items()):
        if now - up["created"] > 3600:
            up["path"].unlink(missing_ok=True)
            UPLOADS.pop(fid, None)


def kind_of(path: Path, info: dict) -> str:
    ext = path.suffix.lower()
    if ext in IMAGE_EXT and ext != ".gif":
        return "image"
    if info["width"] and info["duration"] > 0.1:
        return "video"
    if info["audio"]:
        return "audio"
    return "image" if info["width"] else "other"


def register_upload(path: Path, name: str) -> dict:
    fid = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{fid}{path.suffix.lower()}"
    shutil.move(str(path), dest)
    info = probe(dest)
    UPLOADS[fid] = {"path": dest, "name": name, "kind": kind_of(dest, info), "created": time.time()}
    return {"file_id": fid, "name": name, "size": dest.stat().st_size, "kind": UPLOADS[fid]["kind"],
            "duration": info["duration"], "width": info["width"], "height": info["height"]}


@app.post("/api/upload")
async def upload(request: Request, name: str = "archivo"):
    """Raw body upload (streamed to disk, max 500 MB). Files are kept one hour and can be reused by any tool."""
    cleanup()
    name = re.sub(r'[\\/:*?"<>|\n\r\t]+', " ", name).strip()[:120] or "archivo"
    suffix = re.sub(r"[^a-z0-9.]", "", Path(name).suffix.lower())[:8]
    tmp = UPLOAD_DIR / f"incoming_{uuid.uuid4().hex}{suffix}"
    size = 0
    try:
        with open(tmp, "wb") as f:
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_UPLOAD:
                    raise HTTPException(413, "toobig")
                f.write(chunk)
        if not size:
            raise HTTPException(400, "empty")
        return await run_in_threadpool(register_upload, tmp, name)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


@app.post("/api/job")
def create_job(req: JobRequest):
    if not req.items:
        raise HTTPException(400, "empty")
    if (req.zip and len(req.items) > MAX_BATCH) or (req.merge and len(req.items) > MAX_MERGE):
        raise HTTPException(400, "toomany")
    items = [(validate(i), i) for i in req.items]
    cleanup()
    job = Job(len(items))
    JOBS[job.id] = job
    threading.Thread(target=run_job, args=(job, items, req.zip, req.merge), daemon=True).start()
    return {"id": job.id}


@app.get("/api/job/{jid}")
def job_state(jid: str):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404, "notfound")
    return job.state()


@app.get("/api/job/{jid}/file")
def job_file(jid: str):
    """Sends the result. Single files stay one hour as an upload (X-File-Id) so other tools can reuse them."""
    job = JOBS.get(jid)
    if not job or not job.result:
        raise HTTPException(404, "notfound")
    JOBS.pop(jid, None)
    path, name, media_type, multi = job.result
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"}
    if multi:
        headers["X-Multi"] = "1"
    elif media_type != "application/zip":
        up = register_upload(path, name)
        path = UPLOADS[up["file_id"]]["path"]
        headers["X-File-Id"] = up["file_id"]
    return FileResponse(path, media_type=media_type, headers=headers,
                        background=BackgroundTask(shutil.rmtree, job.workdir, ignore_errors=True))


# ───────────────────────── pages ─────────────────────────

APP_HTML = STATIC / "app.html"
# One version for all scripts/styles: changes on every deploy that touches them, so they can be cached forever.
ASSET_V = hashlib.md5(b"".join(f.read_bytes() for f in sorted([*(STATIC / "js").rglob("*.js"), *(STATIC / "css").glob("*.css"),
                                                                 STATIC / "config.js"]))).hexdigest()[:10]
JS_FILES = sorted("/" + f.relative_to(STATIC).as_posix() for f in (STATIC / "js").rglob("*.js"))
# The import map points every module at its versioned URL; modulepreload fetches the page's modules in parallel.
IMPORT_MAP = json.dumps({"imports": {f: f"{f}?v={ASSET_V}" for f in JS_FILES}})
PAGE_JS = {"lobby": ["/js/lobby.js", "/js/hero3d.js"], "tool": ["/js/tool-page.js", "/js/tools/kit.js"], "page": ["/js/pages.js"]}


def head_js(page: str, tool: str | None) -> str:
    mods = ["/js/core.js", "/js/shell.js", "/js/icons.js", *PAGE_JS.get(page, []), *([f"/js/tools/{tool}.js"] if tool else [])]
    return (f'<script type="importmap">{IMPORT_MAP}</script>\n'
            + "".join(f'<link rel="modulepreload" href="{m}?v={ASSET_V}">\n' for m in mods)
            + f'<script type="module" src="/js/app.js?v={ASSET_V}"></script>')
LEGACY_PLATFORM_PATHS = list(PLATFORM_PAGES)  # old /tiktok, /instagram... landing pages


def esc(s: str) -> str:
    return html.escape(s or "", quote=True)


def render(page: str, title: str, desc: str, path: str, h1: str = "", lead: str = "", status: int = 200,
           extra: dict | None = None, jsonld: dict | None = None) -> HTMLResponse:
    doc = APP_HTML.read_text(encoding="utf-8")
    full_title = title if title.endswith("Letebra Tools") else f"{title} · Letebra Tools"
    data = {"page": page, **(extra or {})}
    ld = jsonld or {"@context": "https://schema.org", "@type": "WebSite", "name": "Letebra Tools", "url": SITE + "/"}
    repl = {
        "{{TITLE}}": esc(full_title), "{{DESC}}": esc(desc), "{{CANONICAL}}": esc(SITE + path),
        "{{OG_IMAGE}}": esc(SITE + "/img/og-image.png"), "{{H1}}": esc(h1 or title), "{{LEAD}}": esc(lead or desc),
        "{{PAGE_DATA}}": esc(json.dumps(data, ensure_ascii=False)),
        "{{JSONLD}}": json.dumps(ld, ensure_ascii=False).replace("</", "<\\/"),
        "{{SITE_DATA}}": json.dumps(DATA, ensure_ascii=False).replace("</", "<\\/"),
        "{{HEAD_JS}}": head_js(page, data.get("tool")), "{{V}}": ASSET_V,
    }
    for k, v in repl.items():
        doc = doc.replace(k, v)
    return HTMLResponse(doc, status_code=status)


def tool_ld(t: dict, path: str) -> dict:
    return {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": t["name"]["es"],
            "description": t["meta"]["es"], "url": SITE + path, "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
            "publisher": {"@type": "Person", "name": "Letebra"}}


@app.get("/", include_in_schema=False)
def lobby(request: Request):
    q = request.query_params
    host = (request.headers.get("host") or "").split(":")[0].lower()
    # Old links and the phone's share sheet point at the root: the downloader lives at /descargar now.
    if any(k in q for k in ("url", "text", "title")) or host in LEGACY_HOSTS:
        return RedirectResponse("/descargar" + (f"?{urlencode(list(q.multi_items()))}" if q else ""), status_code=302)
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": "Letebra Tools", "url": SITE + "/",
          "applicationCategory": "MultimediaApplication", "operatingSystem": "Web",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
          "description": "Herramientas gratis para creadores: descargar, recortar, comprimir, convertir, quitar fondos y más."}
    return render("lobby", "Letebra Tools — Todas las herramientas que un creador necesita",
                  "Descarga, edita, convierte y crea: más de 20 herramientas gratis para creadores y editores. Sin anuncios y sin registro.",
                  "/", h1="Todas las herramientas que un creador necesita.",
                  lead="Descarga, edita, convierte y crea. Gratis, sin registro y sin anuncios.", jsonld=ld)


def tool_route(slug: str):
    def handler():
        t = TOOLS[slug]
        return render("tool", t["title"]["es"], t["meta"]["es"], f"/{slug}", h1=t["name"]["es"], lead=t["desc"]["es"],
                      extra={"tool": t["id"]}, jsonld=tool_ld(t, f"/{slug}"))
    return handler


for _slug in TOOLS:
    app.add_api_route(f"/{_slug}", tool_route(_slug), methods=["GET"], include_in_schema=False)


@app.get("/descargar/{platform}", include_in_schema=False)
def download_platform(platform: str):
    p = PLATFORM_PAGES.get(platform)
    if not p:
        return not_found()
    t = TOOLS["descargar"]
    return render("tool", p["title"], p["meta"], f"/descargar/{platform}", h1=p["title"], lead=p["meta"],
                  extra={"tool": "download", "platform": platform}, jsonld=tool_ld(t, f"/descargar/{platform}"))


def legacy_platform(platform: str):
    return lambda: RedirectResponse(f"/descargar/{platform}", status_code=301)


for _p in LEGACY_PLATFORM_PATHS:
    app.add_api_route(f"/{_p}", legacy_platform(_p), methods=["GET"], include_in_schema=False)


def page_route(slug: str):
    def handler():
        p = PAGES[slug]
        return render("page", p["title"]["es"], p["meta"]["es"], f"/{slug}", extra={"slug": slug})
    return handler


for _slug in PAGES:
    app.add_api_route(f"/{_slug}", page_route(_slug), methods=["GET"], include_in_schema=False)


def not_found():
    return render("page", "Página no encontrada", "Esta página no existe, pero tenemos más de 20 herramientas esperándote.",
                  "/404", extra={"slug": "404"}, status=404)


@app.exception_handler(404)
async def handle_404(request: Request, exc):
    if request.url.path.startswith("/api/") or "text/html" not in request.headers.get("accept", ""):
        detail = getattr(exc, "detail", "notfound")
        return Response(json.dumps({"detail": detail if isinstance(detail, str) else "notfound"}), status_code=404,
                        media_type="application/json")
    return not_found()


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    paths = ["/"] + [f"/{s}" for s in TOOLS] + [f"/descargar/{p}" for p in PLATFORM_PAGES] + [f"/{s}" for s in PAGES]
    body = "".join(f"<url><loc>{SITE}{p}</loc></url>" for p in paths)
    return PlainTextResponse(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>',
                             media_type="application/xml")


@app.get("/ping", include_in_schema=False)
def ping():
    """Tiny response for uptime pings (cron-job.org) so the free instance never sleeps."""
    return PlainTextResponse("ok")


@app.get("/robots.txt", include_in_schema=False)
def robots():
    return PlainTextResponse(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {SITE}/sitemap.xml\n")


app.mount("/", StaticFiles(directory=STATIC), name="static")
