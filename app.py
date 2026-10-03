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
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.background import BackgroundTask

BASE = Path(__file__).parent
STATIC = BASE / "static"
MAX_BATCH = 50
MAX_LIST = 200
MAX_MERGE = 20
VIDEO_EXT = {".mp4", ".mkv", ".webm", ".mov", ".m4v"}
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".ogg", ".opus"}
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
QUALITY_CAP = {"1080": 1080, "720": 720, "480": 480, "small": 360}  # max size of the video's short side


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
    start: float | None = None  # trim, seconds
    end: float | None = None
    target_mb: float | None = None  # compress to at most this size
    vertical: str | None = None  # 9:16 background: blur | black | crop
    mute: bool = False
    normalize: bool = False
    speed: float | None = None  # 0.5 - 2.0


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
        self.stage, self.proc_pct = None, None  # ffmpeg step: trim | compress | merge
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
# One extraction at a time: for YouTube each one runs Deno to solve the player's JS, and two at once
# (e.g. preview + download) don't fit in a 512 MB instance. Downloads themselves run in parallel.
EXTRACT = threading.Lock()


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
    if (item.start is not None and item.start < 0) or (item.end is not None and item.end <= (item.start or 0)):
        raise HTTPException(400, "badtrim")
    if item.target_mb is not None and not 1 <= item.target_mb <= 4000:
        raise HTTPException(400, "invalid")
    if item.vertical not in (None, "blur", "black", "crop") or (item.speed is not None and not 0.5 <= item.speed <= 2):
        raise HTTPException(400, "invalid")
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
        with EXTRACT, yt_dlp.YoutubeDL(opts) as ydl:
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


HASHTAG = re.compile(r"#[^\s#.,!?¡¿;:()\[\]\"']+")


@app.get("/api/meta")
def meta(url: str, platform: str):
    """Everything we can read about a video: text, numbers, tags and the best thumbnail."""
    url = validate(Item(url=url, platform=platform))
    tmp = tempfile.mkdtemp(prefix="dt_")
    opts = {"noplaylist": True, "quiet": True, "no_warnings": True, "skip_download": True,
            "socket_timeout": 15, "retries": 1, "cookiefile": cookie_copy(tmp)}
    try:
        with EXTRACT, yt_dlp.YoutubeDL(opts) as ydl:
            d = ydl.extract_info(url, download=False, process=False)
            for _ in range(2):
                if d.get("_type") not in ("url", "url_transparent") or not d.get("url"):
                    break
                d = ydl.extract_info(d["url"], download=False, process=False)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
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
    url = validate(Item(url=url, platform=platform))
    tmp = tempfile.mkdtemp(prefix="dt_")
    opts = {"noplaylist": True, "quiet": True, "no_warnings": True, "skip_download": True,
            "socket_timeout": 15, "retries": 1, "cookiefile": cookie_copy(tmp)}
    try:
        with EXTRACT, yt_dlp.YoutubeDL(opts) as ydl:
            d = ydl.extract_info(url, download=False, process=False)
    except yt_dlp.utils.DownloadError as e:
        raise ydl_error(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
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
    opts = {"noplaylist": True, "quiet": True, "no_warnings": True, "skip_download": True,
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
def thumb(url: str, name: str = "miniatura"):
    """Downloads a thumbnail through the server (image CDNs block direct downloads)."""
    if not re.match(r"^https?://", url):
        raise HTTPException(400, "invalid")
    try:
        with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as r:
            ctype = r.headers.get("Content-Type", "").split(";")[0]
            data = r.read(20 * 1024 * 1024 + 1)
    except Exception:
        raise HTTPException(404, "notfound")
    if not ctype.startswith("image/") or len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "invalid")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(ctype, "jpg")
    fname = safe_name(name, ext)
    return Response(data, media_type=ctype, headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(fname)}"})


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
           "failed": "no se pudo descargar", "nofile": "no se generó el archivo",
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
    video = next((st for st in data.get("streams", []) if st.get("codec_type") == "video"
                  and not st.get("disposition", {}).get("attached_pic")), None)
    return {
        "duration": float(data.get("format", {}).get("duration") or 0),
        "width": int(video["width"]) if video else 0,
        "height": int(video["height"]) if video else 0,
        "audio": any(st.get("codec_type") == "audio" for st in data.get("streams", [])),
    }


def run_ffmpeg(args: list, job: Job, duration: float, stage: str):
    """Runs ffmpeg reporting progress (0-100) into the job."""
    job.status, job.stage, job.proc_pct = "processing", stage, 0
    proc = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", *args],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    for line in proc.stdout:
        if line.startswith("out_time_us=") and duration:
            try:
                job.proc_pct = min(99, int(line.split("=")[1]) / 1e6 / duration * 100)
            except ValueError:
                pass
    if proc.wait() != 0:
        raise HTTPException(500, "procfail")


def is_video(p: Path) -> bool:
    return p.suffix.lower() in VIDEO_EXT


def is_audio(p: Path) -> bool:
    return p.suffix.lower() in AUDIO_EXT


def trim(path: Path, start: float | None, end: float | None, job: Job) -> Path:
    if not (is_video(path) or is_audio(path)):
        return path
    out = path.with_name(path.stem + "_cut" + (".mp4" if is_video(path) else ".mp3"))
    length = (end - (start or 0)) if end else max(probe(path)["duration"] - (start or 0), 0)
    args = (["-ss", str(start)] if start else []) + ["-i", str(path)] + (["-t", str(length)] if end else [])
    if is_video(path):
        args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]
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
                        "-maxrate", f"{int(vbr * 1.2)}k", "-bufsize", f"{vbr * 2}k", *audio, "-movflags", "+faststart",
                        str(out)], job, dur, "compress")
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
        args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"] if speed != 1 else ["-c:v", "copy"]
    afilters = ([f"atempo={speed}"] if speed != 1 else []) + (["loudnorm=I=-14:TP=-1:LRA=11"] if it.normalize else [])
    if it.mute or not info["audio"]:
        args += ["-an"]
    else:
        args += (["-filter:a", ",".join(afilters)] if afilters else []) + (["-c:a", "aac", "-b:a", "192k"] if video else ["-c:a", "libmp3lame", "-b:a", "192k"])
    run_ffmpeg(args + (["-movflags", "+faststart"] if video else []) + [str(out)], job, info["duration"] / speed, "audio")
    return out


def finish(path: Path, name: str, it: Item, job: Job, allow_trim: bool) -> tuple[Path, str]:
    if allow_trim and (it.start or it.end):
        path = trim(path, it.start, it.end, job)
    if it.vertical:
        path = vertical(path, it.vertical, job)
    if it.mute or it.normalize or (it.speed and it.speed != 1):
        path = audio_fx(path, it, job)
    if it.target_mb:
        path = compress(path, it.target_mb, job)
    return path, Path(name).stem + path.suffix if path.suffix != Path(name).suffix else name


def run_job(job: Job, items: list[tuple[str, Item]], as_zip: bool, as_merge: bool):
    try:
        if as_merge:
            clips, errors = [], []
            for n, (url, it) in enumerate(items):
                job.current, job.status, job.downloaded, job.total = n, "downloading", None, None
                try:
                    files = fetch(url, it.platform, it.format, it.quality, tempfile.mkdtemp(dir=job.workdir), job)
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
            path, name = finish(path, f"DescargaTebra - unido{ext}", first, job, allow_trim=False)
            job.result = (path, name, mimetypes.guess_type(name)[0] or "application/octet-stream", False)
        elif not as_zip:
            url, it = items[0]
            files = fetch(url, it.platform, it.format, it.quality, job.workdir, job)
            files = [finish(p, name, it, job, allow_trim=len(files) == 1) for p, name in files]
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
                        files = [finish(p, name, it, job, allow_trim=False) for p, name in files]
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
    if (req.zip and len(req.items) > MAX_BATCH) or (req.merge and len(req.items) > MAX_MERGE):
        raise HTTPException(400, "toomany")
    items = [(validate(i), i) for i in req.items]
    cleanup_jobs()
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
