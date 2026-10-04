// Shared building blocks for tool pages: media input, job runner, result box, range picker, small fields.
import {$, $$, t, L, esc, api, upload, runJob, saveResult, saveBlob, fmtBytes, fmtDur, fmtTime, parseTime, addStrings,
  detectPlatform, extractUrl, PLATFORMS, toast, kofiNudge, history, toolsFor, setHandoff, putHandoffFile, takeHandoffFile, store} from '../core.js';
import {icon, platformIcon, toolIcon} from '../icons.js';

addStrings({
  es: {
    k_link: 'Enlace', k_file: 'Archivo', k_paste: 'Pegar', k_url_ph: 'Pega aquí el enlace…', k_drop: 'Arrastra tu archivo o haz clic', k_drop_img: 'Arrastra tu imagen o haz clic',
    k_drop_sub_v: 'MP4, MOV, WEBM, MKV, MP3, WAV… hasta 500 MB', k_drop_sub_i: 'PNG, JPG, WEBP, AVIF…', k_change: 'Quitar', k_uploading: 'Subiendo…', k_uploaded: 'Listo',
    k_badurl: 'Ese enlace no es de una plataforma compatible.', k_badfile: 'Ese tipo de archivo no sirve para esta herramienta.', k_items: n => `${n} elementos`,
    k_need_src: 'Primero pega un enlace o sube un archivo.', k_q: 'Calidad de salida',
    q_best: 'Máxima (hasta 4K)', q_1080: '1080p · Full HD', q_720: '720p · HD', q_480: '480p', q_small: 'La más ligera',
    st_queue: 'En cola…', st_fetch: 'Analizando el enlace…', st_dl: 'Descargando…', st_proc: 'Procesando…', st_send: 'Descargando el resultado…', k_eta: 'quedan', k_of: (a, b) => `${a} de ${b}`,
    stage_trim: 'Recortando', stage_compress: 'Comprimiendo', stage_merge: 'Uniendo', stage_vertical: 'Pasando a vertical', stage_audio: 'Procesando audio',
    stage_resize: 'Ajustando calidad', stage_convert: 'Convirtiendo', stage_gif: 'Creando el GIF', stage_frame: 'Sacando el fotograma', stage_watermark: 'Poniendo la marca',
    k_done: '¡Listo! Ya está en tu equipo', k_done_direct: '¡Listo! Se está descargando', k_again: 'Descargar', k_next: 'Sigue con:',
    k_start: 'Inicio', k_end: 'Final', k_len: 'Duración', k_play: 'Reproducir selección', k_tl_hint: 'Arrastra los tiradores o escribe los tiempos (m:ss.cc). Con ↑ ↓ ajustas de 0,01 s en 0,01 s.',
    k_tl_url: 'Para ver la línea de tiempo con imágenes, sube el archivo. Con enlace, escribe los tiempos.',
  },
  en: {
    k_link: 'Link', k_file: 'File', k_paste: 'Paste', k_url_ph: 'Paste the link here…', k_drop: 'Drag your file here or click', k_drop_img: 'Drag your image here or click',
    k_drop_sub_v: 'MP4, MOV, WEBM, MKV, MP3, WAV… up to 500 MB', k_drop_sub_i: 'PNG, JPG, WEBP, AVIF…', k_change: 'Remove', k_uploading: 'Uploading…', k_uploaded: 'Ready',
    k_badurl: 'That link isn\'t from a supported platform.', k_badfile: 'That file type doesn\'t work with this tool.', k_items: n => `${n} items`,
    k_need_src: 'Paste a link or upload a file first.', k_q: 'Output quality',
    q_best: 'Max (up to 4K)', q_1080: '1080p · Full HD', q_720: '720p · HD', q_480: '480p', q_small: 'Smallest',
    st_queue: 'Queued…', st_fetch: 'Reading the link…', st_dl: 'Downloading…', st_proc: 'Processing…', st_send: 'Downloading the result…', k_eta: 'left', k_of: (a, b) => `${a} of ${b}`,
    stage_trim: 'Trimming', stage_compress: 'Compressing', stage_merge: 'Merging', stage_vertical: 'Making it vertical', stage_audio: 'Processing audio',
    stage_resize: 'Adjusting quality', stage_convert: 'Converting', stage_gif: 'Making the GIF', stage_frame: 'Grabbing the frame', stage_watermark: 'Adding the watermark',
    k_done: 'Done! It\'s on your device', k_done_direct: 'Done! It\'s downloading', k_again: 'Download', k_next: 'Continue with:',
    k_start: 'Start', k_end: 'End', k_len: 'Length', k_play: 'Play selection', k_tl_hint: 'Drag the handles or type the times (m:ss.cc). ↑ ↓ nudge by 0.01 s.',
    k_tl_url: 'Upload the file to see the timeline with frames. With a link, type the times.',
  },
});

export const h = html => { const tp = document.createElement('template'); tp.innerHTML = html.trim(); return tp.content.firstElementChild; };
export const kindOf = f => f?.type?.startsWith('image/') ? 'image' : f?.type?.startsWith('video/') ? 'video' : f?.type?.startsWith('audio/') ? 'audio'
  : /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f?.name || '') ? 'video' : /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(f?.name || '') ? 'audio' : null;
const inField = e => e.target.closest?.('input,textarea,select,[contenteditable]');

/* ─── option fields ─── */
export const field = (label, control, val = '') => `<div class="opt"><div class="opt-row"><label>${label}</label>${val}</div>${control}</div>`;
export const seg = (name, opts, on) => `<div class="seg full" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === on ? 'on' : ''}">${l}</button>`).join('')}</div>`;
export function bindSeg(root, name, cb = () => {}) {
  const box = $(`[data-seg="${name}"]`, root);
  $$('button', box).forEach(b => b.onclick = () => { $$('button', box).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
  return () => $('button.on', box)?.dataset.v;
}
export function syncRange(r) { const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', p + '%'); }
export function rangeBind(r, cb) { const f = () => { syncRange(r); cb?.(+r.value); }; r.addEventListener('input', f); f(); }

export function qualityField(key = 'lt_tq', def = '1080') {
  const v = store.get(key, def);
  const el = h(field(t('k_q'), `<select class="sel">${['best', '1080', '720', '480', 'small'].map(q => `<option value="${q}" ${q === v ? 'selected' : ''}>${t('q_' + q)}</option>`).join('')}</select>`));
  const sel = $('select', el);
  sel.onchange = () => store.set(key, sel.value);
  return {el, get: () => sel.value, set: q => { sel.value = q; }};
}

export function goButton(label, ic = 'sparkle') {
  return h(`<button type="button" class="btn primary lg block go-btn sheen">${icon(ic)}<span>${esc(label)}</span></button>`);
}

/* ─── media input: link or file (uploaded to the server when the tool runs there) ─── */
export function mediaInput({modes = ['url', 'file'], kinds = ['video', 'audio'], uploadFiles = true, preview = true, paste = true, onChange = () => {}, onPasteUrl, placeholder} = {}) {
  const imgOnly = kinds.length === 1 && kinds[0] === 'image';
  const el = h(`<div class="mi">
    ${modes.length > 1 ? `<div class="seg mi-tabs">${modes.map((m, i) => `<button type="button" data-m="${m}" class="${i ? '' : 'on'}">${icon(m === 'url' ? 'link' : 'upload')}${t(m === 'url' ? 'k_link' : 'k_file')}</button>`).join('')}</div>` : ''}
    <div data-pane="url" ${modes[0] === 'url' ? '' : 'hidden'}>
      <label class="urlbox"><span class="pf">${icon('link')}</span><input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder || t('k_url_ph'))}"><button type="button" class="btn ghost sm" data-paste>${icon('paste')}<span>${t('k_paste')}</span></button></label>
      <div class="mi-msg"></div><div class="preview" hidden></div>
    </div>
    <div data-pane="file" ${modes[0] === 'file' ? '' : 'hidden'}>
      <label class="drop"><input type="file" accept="${kinds.map(k => k + '/*').join(',')}">${icon('upload')}<b>${t(imgOnly ? 'k_drop_img' : 'k_drop')}</b><small>${t(imgOnly ? 'k_drop_sub_i' : 'k_drop_sub_v')}</small></label>
      <div class="filecard" hidden></div>
    </div></div>`);
  let src = null, seq = 0, timer;
  const inp = $('input[type=url]', el), box = $('.urlbox', el), pf = $('.pf', el), pv = $('.preview', el), msg = $('.mi-msg', el);
  const fileIn = $('input[type=file]', el), drop = $('.drop', el), card = $('.filecard', el);
  const emit = why => onChange(src, why);

  function switchMode(m) {
    $$('.mi-tabs button', el).forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $$('[data-pane]', el).forEach(p => { p.hidden = p.dataset.pane !== m; });
    if (m === 'url' ? src?.type === 'file' : src?.type === 'url') { src = null; emit('mode'); }
    if (m === 'url' && inp.value.trim()) onUrl();
  }
  $$('.mi-tabs button', el).forEach(b => b.onclick = () => switchMode(b.dataset.m));

  function onUrl() {
    const v = inp.value.trim(), url = extractUrl(v) || v, p = v ? detectPlatform(url) : null;
    box.classList.toggle('bad', !!v && !p);
    pf.innerHTML = p ? platformIcon(p) : icon('link');
    msg.textContent = v && !p ? t('k_badurl') : '';
    src = p ? {type: 'url', url, platform: p, info: null} : null;
    pv.hidden = true;
    emit('url');
    clearTimeout(timer);
    if (!p || !preview) return;
    const s = ++seq;
    timer = setTimeout(async () => {
      try {
        const d = await api(`/api/info?url=${encodeURIComponent(url)}&platform=${p}`);
        if (s !== seq || src?.url !== url) return;
        src.info = d;
        const list = d.type === 'playlist';
        if (!(d.title || d.thumbnail || list)) return emit('info');
        pv.innerHTML = `${d.thumbnail ? `<img src="${esc(d.thumbnail)}" alt="" referrerpolicy="no-referrer">` : ''}<div class="pv-meta"><b>${esc((list ? '📃 ' : '') + (d.title || PLATFORMS[p].label))}</b><small>${esc([d.uploader, list ? (d.count ? t('k_items', d.count) : '') : fmtDur(d.duration)].filter(Boolean).join(' · '))}</small></div>`;
        $('img', pv)?.addEventListener('error', e => e.target.remove());
        pv.hidden = false;
        emit('info');
      } catch (e) { if (s === seq) msg.textContent = e.message; }
    }, 450);
  }
  inp.addEventListener('input', onUrl);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onPasteUrl?.(); } });
  $('[data-paste]', el).onclick = async () => {
    try { inp.value = (await navigator.clipboard.readText()).trim(); onUrl(); } catch { inp.focus(); }
  };

  function setUrl(url) { switchMode('url'); inp.value = url; onUrl(); }

  async function probeLocal(s) {
    if (s.kind === 'image') {
      await new Promise(ok => { const im = new Image(); im.onload = () => { s.width = im.naturalWidth; s.height = im.naturalHeight; ok(); }; im.onerror = ok; im.src = s.objectURL; });
      s.thumb = s.objectURL;
      return;
    }
    const m = document.createElement(s.kind === 'audio' ? 'audio' : 'video');
    m.muted = true; m.preload = 'metadata'; m.src = s.objectURL;
    await new Promise(ok => { m.onloadedmetadata = ok; m.onerror = ok; setTimeout(ok, 8000); });
    if (isFinite(m.duration)) s.duration = m.duration;
    if (s.kind !== 'video' || !m.videoWidth) return;
    s.width = m.videoWidth; s.height = m.videoHeight;
    m.currentTime = Math.min(1, (s.duration || 2) / 3);
    await new Promise(ok => { m.onseeked = ok; setTimeout(ok, 4000); });
    try {
      const c = document.createElement('canvas'), w = 168;
      c.width = w; c.height = Math.round(w * m.videoHeight / m.videoWidth);
      c.getContext('2d').drawImage(m, 0, 0, c.width, c.height);
      s.thumb = c.toDataURL('image/jpeg', .7);
    } catch {}
    m.removeAttribute('src'); m.load();
  }

  function renderCard() {
    const s = src;
    if (!s || s.type !== 'file') return;
    const up = uploadFiles && !s.fileId && !s.error;
    card.innerHTML = `<span class="thumb">${s.thumb ? `<img src="${s.thumb}" alt="" style="width:100%;height:100%;object-fit:cover">` : icon(s.kind === 'audio' ? 'audio' : s.kind === 'image' ? 'image' : 'play')}</span>
      <div class="meta"><b>${esc(s.name)}</b><small>${[fmtBytes(s.size), s.duration ? fmtDur(s.duration) : '', s.width ? `${s.width}×${s.height}` : ''].filter(Boolean).join(' · ')}${
        s.error ? ` · <span style="color:#fca5a5">${esc(s.error)}</span>` : uploadFiles ? ` · <span class="up-t">${s.fileId ? '✓ ' + t('k_uploaded') : t('k_uploading') + ' ' + Math.round((s.pct || 0) * 100) + '%'}</span>` : ''}</small>
      ${up ? `<div class="upbar"><i style="width:${Math.round((s.pct || 0) * 100)}%"></i></div>` : ''}</div>
      <button type="button" class="btn ghost icon sm" data-x title="${t('k_change')}" aria-label="${t('k_change')}">${icon('x')}</button>`;
    $('[data-x]', card).onclick = clear;
  }

  async function setFile(file, pre = {}) {
    const kind = kindOf(file);
    if (!kind || !kinds.includes(kind)) return toast(t('k_badfile'), 'err');
    if (modes.includes('file')) switchMode('file');
    if (src?.objectURL) URL.revokeObjectURL(src.objectURL);
    const s = src = {type: 'file', file, name: file.name || 'archivo', size: file.size, kind, objectURL: URL.createObjectURL(file), fileId: pre.fileId || null, pct: 0};
    drop.hidden = true; card.hidden = false;
    renderCard();
    emit('file');
    if (uploadFiles && !s.fileId) {
      s.uploading = upload(file, p => {
        s.pct = p;
        if (src !== s) return;
        const i = $('.upbar i', card), tx = $('.up-t', card);
        if (i) i.style.width = Math.round(p * 100) + '%';
        if (tx) tx.textContent = t('k_uploading') + ' ' + Math.round(p * 100) + '%';
      }).then(r => { s.fileId = r.file_id; s.meta = r; if (src === s) { renderCard(); emit('uploaded'); } return r; },
        e => { s.error = e.message; if (src === s) renderCard(); throw e; });
      s.uploading.catch(() => {});
    }
    await probeLocal(s);
    if (src === s) { renderCard(); emit('meta'); }
  }
  fileIn.onchange = () => { if (fileIn.files[0]) setFile(fileIn.files[0]); fileIn.value = ''; };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) setFile(f); });

  function clear() {
    if (src?.objectURL) URL.revokeObjectURL(src.objectURL);
    src = null; card.hidden = true; drop.hidden = false; card.innerHTML = '';
    inp.value = ''; box.classList.remove('bad'); pv.hidden = true; msg.textContent = ''; pf.innerHTML = icon('link');
    emit('clear');
  }

  if (paste) {
    document.addEventListener('paste', e => {
      if (inField(e) || !el.isConnected) return;
      const f = [...(e.clipboardData?.files || [])][0];
      if (f && kinds.includes(kindOf(f)) && modes.includes('file')) { e.preventDefault(); return setFile(f); }
      const url = extractUrl(e.clipboardData?.getData('text') || '');
      if (url && detectPlatform(url) && modes.includes('url')) { e.preventDefault(); setUrl(url); onPasteUrl?.(); }
    });
    addEventListener('dragover', e => e.preventDefault());
    addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f && el.isConnected && modes.includes('file')) setFile(f); });
  }

  return {
    el, setUrl, setFile, clear,
    get: () => src,
    duration: () => src?.info?.duration || src?.duration || src?.meta?.duration || null,
    async prepare() {
      if (!src) throw new Error(t('k_need_src'));
      if (src.type === 'url') return {url: src.url, platform: src.platform};
      if (!uploadFiles) return {file: src.file};
      if (src.error) throw new Error(src.error);
      if (!src.fileId) await src.uploading;
      return {file_id: src.fileId};
    },
    async intake(hd) {
      if (!hd) return false;
      if (hd.url && modes.includes('url')) { setUrl(hd.url); return true; }
      if (hd.file && modes.includes('file')) { const f = await takeHandoffFile(); if (f && kinds.includes(kindOf(f))) { setFile(f, {fileId: hd.fileId}); return true; } }
      return false;
    },
  };
}

/* ─── job runner: progress → automatic download → result with "continue with" ─── */
export function jobRunner(tool) {
  const el = h('<div class="jr" aria-live="polite"></div>');
  let busy = false;
  function update(st) {
    const label = st.status === 'queued' ? t('st_queue') : st.status === 'fetching' ? t('st_fetch') : st.status === 'processing' ? (st.stage ? t('stage_' + st.stage) : t('st_proc'))
      : st.status === 'sending' ? t('st_send') : t('st_dl');
    const bar = $('.bar', el), pct = st.pct;
    if (!bar) return;
    bar.classList.toggle('indet', pct == null);
    $('i', bar).style.width = (pct ?? 0) + '%';
    $('.pg-l', el).textContent = (st.count > 1 && st.status !== 'sending' ? `${t('k_of', Math.min((st.current || 0) + 1, st.count), st.count)} · ` : '') + label;
    $('.pg-r', el).textContent = pct != null ? pct + '%' : '';
    const d = [];
    if (st.downloaded) d.push(st.total ? `${fmtBytes(st.downloaded)} / ${fmtBytes(st.total)}` : fmtBytes(st.downloaded));
    if (st.speed && st.status === 'downloading') d.push(fmtBytes(st.speed) + '/s');
    if (st.eta && st.status === 'downloading') d.push(`${t('k_eta')} ${fmtDur(st.eta)}`);
    $('.pg-d', el).textContent = d.join(' · ');
  }
  async function run(body, {entry = {}, preview = true, save = true, direct = false} = {}) {
    if (busy) return null;
    busy = true;
    el.innerHTML = `<div class="progress"><div class="progress-top"><span class="pg-l">${t('st_queue')}</span><span class="pg-r"></span></div><div class="bar indet"><i></i></div><small class="pg-d"></small></div>`;
    el.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    try {
      const r = await runJob(body, update, {direct});
      if (r.direct) {
        el.innerHTML = `<div class="result"><div class="result-top"><span class="okdot">${icon('check')}</span><div><b>${t('k_done_direct')}</b><small>${esc(r.name)}${r.size ? ' · ' + fmtBytes(r.size) : ''}</small></div></div></div>`;
        history.add({tool: tool.id, format: (r.name.split('.').pop() || '').toLowerCase(), ...entry, title: entry.title || r.name});
        kofiNudge();
        return r;
      }
      if (save) await saveResult(r);
      showResult(el, tool, r, {preview, entry});
      return r;
    } catch (e) {
      el.innerHTML = `<div class="err-box">${esc(e.message)}</div>`;
      return null;
    } finally { busy = false; }
  }
  return {el, run, isBusy: () => busy, clear: () => { if (!busy) el.innerHTML = ''; }, error: m => { el.innerHTML = `<div class="err-box">${esc(m)}</div>`; }};
}

// Result card (also used by browser tools): name, size, preview, download again, hand-off to the next tool.
export function showResult(el, tool, r, {preview = true, entry = {}, saved = true} = {}) {
  const type = r.type || r.blob.type || '', kind = type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : type.startsWith('image/') ? 'image' : null;
  const url = URL.createObjectURL(r.blob);
  const next = !r.multi && kind ? toolsFor(kind).filter(x => x.id !== tool.id && (x.engine === 'browser' || r.fileId || !r.server)).slice(0, 6) : [];
  el.innerHTML = `<div class="result"><div class="result-top"><span class="okdot">${icon('check')}</span><div><b>${t('k_done')}</b><small>${esc(r.name)} · ${fmtBytes(r.blob.size)}</small></div>
      <button type="button" class="btn ghost sm" data-again>${icon('download')}<span>${t('k_again')}</span></button></div>
    ${preview && kind && !r.multi ? `<div class="result-media ${kind === 'image' ? 'checker' : ''}">${kind === 'video' ? `<video src="${url}" controls playsinline></video>` : kind === 'audio' ? `<audio src="${url}" controls style="width:calc(100% - 28px);margin:14px"></audio>` : `<img src="${url}" alt="">`}</div>` : ''}
    ${next.length ? `<div class="result-next"><span>${t('k_next')}</span>${next.map(x => `<a class="chip" href="/${x.slug}" data-next>${toolIcon(x).replace('<svg', '<svg width="14" height="14"')}${esc(L(x.name))}</a>`).join('')}</div>` : ''}</div>`;
  $('[data-again]', el).onclick = () => saveResult(r);
  $$('[data-next]', el).forEach(a => a.onclick = async e => {
    e.preventDefault();
    await putHandoffFile(new File([r.blob], r.name, {type}));
    setHandoff({file: true, fileId: r.fileId || null});
    location.href = a.getAttribute('href');
  });
  if (!saved) saveBlob(r.blob, r.name);
  history.add({tool: tool.id, format: (r.name.split('.').pop() || '').toLowerCase(), detail: (r.name.split('.').pop() || '').toUpperCase(), ...entry, title: entry.title || r.name});
  kofiNudge();
}

/* ─── range picker (trim / gif): timeline with draggable handles, 0.01 s precision ─── */
export function rangePicker({maxLen = null, defLen = null, video = true} = {}) {
  const el = h(`<div class="rp stack" style="gap:12px">
    ${video ? '<div class="media-stage" hidden><video playsinline preload="metadata"></video></div>' : ''}
    <div class="timeline"><div class="frames"></div><div class="sel"></div><span class="h" data-h="a" tabindex="0" role="slider" aria-label="${t('k_start')}"></span><span class="h" data-h="b" tabindex="0" role="slider" aria-label="${t('k_end')}"></span><span class="ph"></span></div>
    <div class="grid3">
      ${field(t('k_start'), '<input class="inp" data-t="a" inputmode="decimal" value="0:00.00">')}
      ${field(t('k_end'), '<input class="inp" data-t="b" inputmode="decimal" value="0:00.00">')}
      ${field(t('k_len'), `<div class="row" style="flex-wrap:nowrap"><b class="opt-val rp-len" style="font-size:18px;flex:1">0:00.00</b><button type="button" class="btn ghost icon sm" data-play title="${t('k_play')}" aria-label="${t('k_play')}">${icon('play')}</button></div>`)}
    </div><small class="muted rp-hint" style="font-size:12.5px">${t('k_tl_hint')}</small></div>`);
  const tl = $('.timeline', el), sel = $('.sel', el), ha = $('[data-h=a]', el), hb = $('[data-h=b]', el), ph = $('.ph', el);
  const ia = $('[data-t=a]', el), ib = $('[data-t=b]', el), len = $('.rp-len', el), vid = $('video', el), stage = $('.media-stage', el);
  let dur = 0, a = 0, b = 0, playingSel = false, frameSeq = 0;
  const r2 = x => Math.round(x * 100) / 100;
  function draw() {
    const pa = dur ? a / dur * 100 : 0, pb = dur ? b / dur * 100 : 100;
    sel.style.left = pa + '%'; sel.style.width = (pb - pa) + '%';
    ha.style.left = pa + '%'; hb.style.left = pb + '%';
    if (document.activeElement !== ia) ia.value = fmtTime(a);
    if (document.activeElement !== ib) ib.value = fmtTime(b);
    len.textContent = fmtTime(b - a);
    ha.setAttribute('aria-valuenow', a); hb.setAttribute('aria-valuenow', b);
  }
  function set(na, nb, moved) {
    if (!dur) { a = r2(Math.max(0, na)); b = r2(Math.max(0, nb)); return draw(); }
    na = r2(Math.max(0, Math.min(na, dur || na))); nb = r2(Math.max(0, Math.min(nb, dur || nb)));
    if (nb - na < .1) { if (moved === 'a') na = Math.max(0, nb - .1); else nb = Math.min(dur || nb + .1, na + .1); }
    if (maxLen && nb - na > maxLen) { if (moved === 'a') nb = r2(na + maxLen); else na = r2(nb - maxLen); }
    a = na; b = nb; draw();
  }
  function setDuration(d) {
    dur = d || 0;
    tl.style.opacity = dur ? 1 : .45;
    set(0, defLen ? Math.min(dur, defLen) : dur);
  }
  const posToTime = x => { const r = tl.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * dur; };
  for (const hd of [ha, hb]) {
    hd.addEventListener('pointerdown', e => {
      if (!dur) return;
      e.preventDefault(); e.stopPropagation(); hd.setPointerCapture(e.pointerId);
      const mv = ev => { const tt = posToTime(ev.clientX); hd === ha ? set(tt, b, 'a') : set(a, tt, 'b'); if (vid && stage && !stage.hidden) vid.currentTime = hd === ha ? a : b; };
      hd.addEventListener('pointermove', mv);
      hd.addEventListener('pointerup', () => hd.removeEventListener('pointermove', mv), {once: true});
    });
    hd.addEventListener('keydown', e => {
      const st = e.shiftKey ? 1 : .01, d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? st : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -st : 0;
      if (!d) return;
      e.preventDefault(); hd === ha ? set(a + d, b, 'a') : set(a, b + d, 'b');
    });
  }
  tl.addEventListener('pointerdown', e => { if (dur && vid && !stage.hidden) vid.currentTime = posToTime(e.clientX); });
  for (const [inp, which] of [[ia, 'a'], [ib, 'b']]) {
    inp.addEventListener('change', () => { const v = parseTime(inp.value); if (v != null && !Number.isNaN(v)) which === 'a' ? set(v, b, 'a') : set(a, v, 'b'); else draw(); });
    inp.addEventListener('keydown', e => {
      const st = e.shiftKey ? 1 : .01, d = e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0;
      if (e.key === 'Enter') inp.blur();
      if (!d) return;
      e.preventDefault(); which === 'a' ? set(a + d, b, 'a') : set(a, b + d, 'b'); inp.value = fmtTime(which === 'a' ? a : b);
    });
    inp.addEventListener('blur', draw);
  }
  if (vid) {
    vid.addEventListener('timeupdate', () => {
      ph.style.left = (dur ? vid.currentTime / dur * 100 : 0) + '%';
      if (playingSel && vid.currentTime >= b) { vid.pause(); playingSel = false; }
    });
    $('[data-play]', el).onclick = () => {
      if (stage.hidden) return;
      if (!vid.paused) { vid.pause(); playingSel = false; return; }
      vid.currentTime = a; playingSel = true; vid.play();
    };
  } else $('[data-play]', el).remove();

  async function frames(url) {
    const box = $('.frames', tl), my = ++frameSeq, n = Math.max(6, Math.min(12, Math.round(tl.clientWidth / 70)));
    box.innerHTML = '';
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = url;
    await new Promise(ok => { v.onloadeddata = ok; v.onerror = ok; setTimeout(ok, 6000); });
    if (!v.videoWidth) return;
    for (let i = 0; i < n && my === frameSeq; i++) {
      v.currentTime = Math.min(dur - .05, (i + .5) * dur / n);
      await new Promise(ok => { v.onseeked = ok; setTimeout(ok, 2500); });
      const c = document.createElement('canvas');
      c.height = 64; c.width = Math.round(64 * v.videoWidth / v.videoHeight);
      try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); } catch {}
      box.append(c);
    }
    v.removeAttribute('src'); v.load();
  }

  return {
    el,
    // src from mediaInput: a local file shows the video + frames; a link only needs the duration.
    setSource(src, duration) {
      frameSeq++;
      $('.frames', tl).innerHTML = '';
      const local = src?.type === 'file' && src.kind === 'video';
      if (stage) { stage.hidden = !local; if (local) vid.src = src.objectURL; else vid.removeAttribute('src'); }
      $('.rp-hint', el).textContent = !src || local || src.kind === 'audio' ? t('k_tl_hint') : t('k_tl_url');
      setDuration(duration || 0);
      if (local) frames(src.objectURL);
    },
    get: () => ({start: a, end: b, dur}),
  };
}

/* ─── the usual server tool: source → options → button → job ─── */
export function serverTool(root, {tool, handoff}, {kinds = ['video', 'audio'], modes, go, ic = 'sparkle', options = [], body = () => ({}), onSource} = {}) {
  const jr = jobRunner(tool);
  const panel = h('<div class="panel glass strong"><div class="stack"></div></div>');
  const stack = $('.stack', panel);
  const mi = mediaInput({kinds, modes, onChange: (src, why) => onSource?.(src, why, mi)});
  const btn = goButton(go, ic);
  stack.append(mi.el, ...options, btn);
  panel.append(jr.el);
  root.append(panel);
  btn.onclick = async () => {
    if (jr.isBusy()) return;
    let fields;
    try { fields = {...await mi.prepare(), ...await body(mi.get(), mi)}; } catch (e) { return jr.error(e.message); }
    const src = mi.get();
    btn.disabled = true;
    await jr.run({items: [{quality: '1080', ...fields}]}, {entry: {url: src.url, platform: src.platform, title: src.info?.title || src.name, thumb: src.info?.thumbnail || ''}});
    btn.disabled = false;
  };
  mi.intake(handoff);
  return {mi, jr, panel, btn};
}
