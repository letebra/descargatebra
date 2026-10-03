// Shared runtime: data, i18n, storage, network (jobs/uploads), toasts, Ko-fi, history, favorites.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const SITE = JSON.parse(document.getElementById('site-data').textContent);
export const PAGE = (() => { try { return JSON.parse(document.body.dataset.page || '{}'); } catch { return {}; } })();
export const TOOLS = SITE.tools, CATS = SITE.categories;
export const toolById = id => TOOLS.find(t => t.id === id);
export const toolBySlug = s => TOOLS.find(t => t.slug === s);
export const catById = id => CATS.find(c => c.id === id);
export const toolsOfCat = id => TOOLS.filter(t => t.cat === id || (t.also || []).includes(id));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const cfg = (name, fallback) => (typeof window[name] !== 'undefined' ? window[name] : fallback);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* storage (every access guarded: private mode, blocked storage…) */
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export const session = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};

/* i18n */
function initialLang() {
  let saved; try { saved = localStorage.getItem('lt_lang'); } catch {}
  if (saved === 'es' || saved === 'en') return saved;
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}
export const lang = initialLang();
document.documentElement.lang = lang;
const DICT = {es: {}, en: {}};
export function addStrings(d) { for (const l of ['es', 'en']) Object.assign(DICT[l], d[l] || {}); }
export function t(k, ...a) { const v = DICT[lang][k] ?? DICT.es[k] ?? k; return typeof v === 'function' ? v(...a) : v; }
export const L = o => (o && (o[lang] ?? o.es)) ?? '';
export function setLang(l) { try { localStorage.setItem('lt_lang', l); } catch {} location.reload(); }

addStrings({
  es: {
    e_invalid: 'Enlace o datos no válidos.', e_mismatch: 'El enlace no es de la plataforma elegida.', e_private: 'El contenido es privado o la plataforma pide iniciar sesión para verlo.',
    e_notfound: 'No se ha encontrado o ya no está disponible.', e_failed: 'No se ha podido procesar este enlace. Comprueba que es público.', e_nofile: 'No se generó el archivo.',
    e_empty: 'No hay nada que procesar.', e_toomany: 'Demasiados elementos para hacerlo de una vez.', e_allfailed: 'No se pudo procesar ninguno.', e_noaudio: 'No tiene audio.',
    e_novideo: 'Esto no es un vídeo.', e_badtrim: 'Revisa los tiempos: el final debe ser mayor que el inicio.', e_toosmall: 'No cabe en ese tamaño ni a la mínima calidad.',
    e_procfail: 'Algo falló al procesarlo. Prueba con otro archivo o enlace.', e_nosubs: 'No hay subtítulos en ese idioma.', e_upload: 'El archivo ya no está en el servidor (se guardan 1 hora). Vuelve a subirlo.',
    e_toobig: 'El archivo es demasiado grande (máximo 500 MB).', e_ytbot: 'YouTube ha bloqueado temporalmente el servidor. Prueba más tarde.',
    e_restart: 'El servidor se reinició mientras trabajaba. Vuelve a intentarlo en un minuto.', e_offline: 'Sin conexión con el servidor.', e_generic: 'Algo ha fallado. Inténtalo de nuevo.',
    copied: 'Copiado al portapapeles', kofi_t: '¿Te ha ahorrado tiempo?', kofi_p: 'Letebra Tools es gratis y sin anuncios. Un café lo mantiene así ☕', kofi_btn: 'Invitar a un café', later: 'Ahora no',
  },
  en: {
    e_invalid: 'Invalid link or data.', e_mismatch: 'The link isn\'t from the selected platform.', e_private: 'The content is private or the platform requires login.',
    e_notfound: 'Not found or no longer available.', e_failed: 'Couldn\'t process this link. Make sure it\'s public.', e_nofile: 'The file wasn\'t generated.',
    e_empty: 'Nothing to process.', e_toomany: 'Too many items to do at once.', e_allfailed: 'None could be processed.', e_noaudio: 'It has no audio.',
    e_novideo: 'This isn\'t a video.', e_badtrim: 'Check the times: the end must be after the start.', e_toosmall: 'It doesn\'t fit in that size even at minimum quality.',
    e_procfail: 'Something failed while processing. Try another file or link.', e_nosubs: 'No subtitles in that language.', e_upload: 'The file is no longer on the server (kept 1 hour). Upload it again.',
    e_toobig: 'The file is too big (500 MB max).', e_ytbot: 'YouTube has temporarily blocked the server. Try again later.',
    e_restart: 'The server restarted while working. Try again in a minute.', e_offline: 'Can\'t reach the server.', e_generic: 'Something went wrong. Please try again.',
    copied: 'Copied to clipboard', kofi_t: 'Did it save you time?', kofi_p: 'Letebra Tools is free and ad-free. A coffee keeps it that way ☕', kofi_btn: 'Buy me a coffee', later: 'Not now',
  },
});
export const errText = code => (typeof code === 'string' && DICT.es['e_' + code] ? t('e_' + code) : t('e_generic'));

/* formatting */
export const fmtBytes = b => b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round((b || 0) / 1e3)) + ' KB';
export function fmtDur(s) {
  if (!s && s !== 0) return '';
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
export function fmtTime(s) { // m:ss.cc
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${sec}`;
}
export function parseTime(v) {
  v = String(v ?? '').trim().replace(',', '.');
  if (!v) return null;
  if (!/^\d+(\.\d+)?$|^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(v)) return NaN;
  return v.split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
}
export const nf = n => n == null ? '' : new Intl.NumberFormat(lang).format(n);
export function relTime(ts) {
  const rtf = new Intl.RelativeTimeFormat(lang, {numeric: 'auto'}), s = (ts - Date.now()) / 1000;
  for (const [u, n] of [['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return rtf.format(0, 'minute');
}

/* platforms */
export const PLATFORMS = {
  instagram: {label: 'Instagram', ph: 'https://www.instagram.com/reel/…'},
  tiktok: {label: 'TikTok', ph: 'https://www.tiktok.com/@user/video/…'},
  youtube: {label: 'YouTube', ph: 'https://www.youtube.com/watch?v=…'},
  shorts: {label: 'Shorts', ph: 'https://www.youtube.com/shorts/…'},
  twitter: {label: 'X', ph: 'https://x.com/user/status/…'},
  facebook: {label: 'Facebook', ph: 'https://www.facebook.com/watch?v=…'},
  twitch: {label: 'Twitch', ph: 'https://clips.twitch.tv/…'},
  reddit: {label: 'Reddit', ph: 'https://www.reddit.com/r/…/comments/…'},
  pinterest: {label: 'Pinterest', ph: 'https://www.pinterest.com/pin/…'},
};
export function detectPlatform(url) {
  let h;
  try { h = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).hostname.toLowerCase(); } catch { return null; }
  const is = d => h === d || h.endsWith('.' + d);
  if (is('instagram.com')) return 'instagram';
  if (is('tiktok.com')) return 'tiktok';
  if (is('x.com') || is('twitter.com')) return 'twitter';
  if (is('youtube.com') || is('youtu.be')) return url.includes('/shorts/') ? 'shorts' : 'youtube';
  if (is('facebook.com') || is('fb.watch') || is('fb.com')) return 'facebook';
  if (is('twitch.tv')) return 'twitch';
  if (is('reddit.com') || is('redd.it')) return 'reddit';
  if (/(^|\.)pinterest\.[a-z.]+$/.test(h) || is('pin.it')) return 'pinterest';
  return null;
}
export const extractUrl = text => (String(text || '').match(/https?:\/\/[^\s"'<>]+/) || [])[0] || null;

/* network */
export async function api(path, opts = {}) {
  let res;
  try { res = await fetch(path, opts); } catch { throw new Error(t('e_offline')); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(errText(data && data.detail));
  return data;
}
export const postJSON = (path, body) => api(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});

function filenameFrom(res, fallback) {
  const m = (res.headers.get('Content-Disposition') || '').match(/filename\*=UTF-8''([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : fallback;
}

// Server job: create → poll progress → stream the file to the browser (with progress too).
export async function runJob(body, onState = () => {}) {
  const {id} = await postJSON('/api/job', body);
  for (;;) {
    await sleep(650);
    let res;
    try { res = await fetch(`/api/job/${id}`); } catch { throw new Error(t('e_offline')); }
    if (res.status === 404) throw new Error(t('e_restart'));
    if (!res.ok) throw new Error(t('e_generic'));
    const st = await res.json();
    onState(st);
    if (st.status === 'error') throw new Error(errText(st.error));
    if (st.status === 'done') break;
  }
  const res = await fetch(`/api/job/${id}/file`);
  if (!res.ok) throw new Error(t('e_generic'));
  const total = +res.headers.get('Content-Length') || 0, reader = res.body.getReader(), chunks = [];
  let got = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onState({status: 'sending', pct: total ? Math.round(100 * got / total) : null, downloaded: got, total});
  }
  const type = res.headers.get('Content-Type') || '';
  return {blob: new Blob(chunks, {type}), type, name: filenameFrom(res, 'archivo'), multi: res.headers.get('X-Multi') === '1', fileId: res.headers.get('X-File-Id')};
}

// Raw-body upload with progress (XHR: fetch has no upload progress).
export function upload(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload?name=' + encodeURIComponent(file.name || 'archivo'));
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = null; try { data = JSON.parse(xhr.responseText); } catch {}
      xhr.status >= 200 && xhr.status < 300 ? resolve(data) : reject(new Error(errText(data && data.detail)));
    };
    xhr.onerror = () => reject(new Error(t('e_offline')));
    xhr.send(file);
  });
}

export function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
let jszip;
export function loadJSZip() {
  return jszip ||= new Promise((ok, ko) => {
    const s = Object.assign(document.createElement('script'), {src: '/vendor/jszip.min.js', onload: () => ok(window.JSZip), onerror: ko});
    document.head.append(s);
  });
}
// Posts with several files (carousels) arrive as a ZIP: unpack them as loose files.
export async function saveResult(r) {
  if (!r.multi) return saveBlob(r.blob, r.name);
  try {
    const zip = await (await loadJSZip()).loadAsync(r.blob);
    for (const f of Object.values(zip.files)) if (!f.dir) saveBlob(await f.async('blob'), f.name);
  } catch { saveBlob(r.blob, r.name); }
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('copied')); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), {value: text});
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(t('copied'));
  }
}

/* toasts */
let toastBox;
export function toast(msg, kind = 'ok', ms = 3200) {
  toastBox ||= Object.assign(document.createElement('div'), {className: 'toasts'});
  if (!toastBox.isConnected) document.body.append(toastBox);
  const el = document.createElement('div');
  el.className = `toast glass strong ${kind}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = `<span style="flex:1"></span><button class="x" aria-label="Cerrar">✕</button>`;
  el.firstChild.textContent = msg;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.querySelector('.x').onclick = close;
  toastBox.append(el);
  if (ms) setTimeout(close, ms);
  return el;
}

// Gentle Ko-fi nudge after finishing something: once per session, never again for 7 days if dismissed.
export function kofiNudge() {
  const url = cfg('SUPPORT_URL', '');
  if (!url || session.get('lt_kofi_shown', false) || Date.now() - store.get('lt_kofi_dismissed', 0) < 7 * 864e5) return;
  session.set('lt_kofi_shown', true);
  setTimeout(() => {
    toastBox ||= Object.assign(document.createElement('div'), {className: 'toasts'});
    if (!toastBox.isConnected) document.body.append(toastBox);
    const el = document.createElement('div');
    el.className = 'toast glass strong kofi';
    el.innerHTML = `<div class="t-row"><span class="cup">☕</span><div style="flex:1"><b>${esc(t('kofi_t'))}</b><div class="muted" style="font-size:13.5px;margin-top:2px">${esc(t('kofi_p'))}</div></div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-x>${esc(t('later'))}</button><a class="btn coffee sm" href="${esc(url)}" target="_blank" rel="noopener">${esc(t('kofi_btn'))}</a></div>`;
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.querySelector('[data-x]').onclick = () => { store.set('lt_kofi_dismissed', Date.now()); close(); };
    el.querySelector('a').onclick = close;
    toastBox.append(el);
    setTimeout(close, 9000);
  }, 1400);
}

/* favorites, recents, global history */
export const favs = {
  list: () => store.get('lt_favs', []),
  has: id => favs.list().includes(id),
  toggle(id) {
    const l = favs.list(), on = !l.includes(id);
    store.set('lt_favs', on ? [id, ...l] : l.filter(x => x !== id));
    dispatchEvent(new CustomEvent('lt:favs'));
    return on;
  },
};
export function markRecent(id) {
  store.set('lt_recent', [id, ...store.get('lt_recent', []).filter(x => x !== id)].slice(0, 8));
}
export const recents = () => store.get('lt_recent', []);
export const history = {
  list: () => store.get('lt_history', []),
  add(e) {
    const h = history.list().filter(x => !(x.tool === e.tool && x.url && x.url === e.url && x.format === e.format));
    h.unshift({...e, t: Date.now()});
    store.set('lt_history', h.slice(0, 60));
    dispatchEvent(new CustomEvent('lt:history'));
  },
  remove(i) { const h = history.list(); h.splice(i, 1); store.set('lt_history', h); dispatchEvent(new CustomEvent('lt:history')); },
  clear() { store.set('lt_history', []); dispatchEvent(new CustomEvent('lt:history')); },
};

/* hand-off between tools / from the lobby: small data in sessionStorage, Files in IndexedDB */
function idb() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('lt', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
export async function putHandoffFile(file) {
  try {
    const db = await idb();
    await new Promise((ok, ko) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(file, 'handoff'); tx.oncomplete = ok; tx.onerror = () => ko(tx.error); });
    return true;
  } catch { return false; }
}
export async function takeHandoffFile() {
  try {
    const db = await idb();
    return await new Promise(ok => {
      const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv'), g = st.get('handoff');
      g.onsuccess = () => { st.delete('handoff'); ok(g.result || null); };
      g.onerror = () => ok(null);
    });
  } catch { return null; }
}
export function setHandoff(data) { session.set('lt_handoff', data); }
export function takeHandoff() { const d = session.get('lt_handoff', null); session.del('lt_handoff'); return d; }

// Which tools make sense for an input: 'url' | 'video' | 'audio' | 'image' | 'text'.
export function toolsFor(kind) {
  return TOOLS.filter(t => (t.accepts || []).includes(kind));
}
