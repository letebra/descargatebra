// Download: 9 platforms, MP4/MP3, quality, one or many links (separate files or ZIP), playlists/profiles, share target.
import {$, $$, t, L, esc, api, runJob, saveResult, saveBlob, fmtBytes, fmtDur, addStrings, detectPlatform, extractUrl, PLATFORMS,
  toast, kofiNudge, history, store, relTime, copyText, errText} from '../core.js';
import {icon, platformIcon} from '../icons.js';
import {h, seg, bindSeg, jobRunner, goButton} from './kit.js';

addStrings({
  es: {
    d_multi: 'Varios enlaces a la vez', d_sep: 'Archivos sueltos', d_zip: 'Todo en un ZIP', d_go_mp4: 'Descargar MP4', d_go_mp3: 'Descargar MP3', d_go_all: n => `Descargar ${n} enlaces`,
    d_list: n => `Añadir los ${n || ''} vídeos de la lista`, d_list_loading: 'Cargando la lista…', d_list_ok: n => `${n} enlaces añadidos. Pulsa descargar cuando quieras.`,
    d_okn: n => `${n} descargas completadas`, d_partial: (a, b) => `${a} de ${b} descargados. Revisa los marcados en rojo.`, d_zip_ok: 'ZIP descargado',
    st_ok: 'Listo', st_err: 'Error', st_zip: 'En el ZIP', st_badplat: 'Enlace no válido', d_hist: 'Tus descargas', d_hist_p: 'Se guardan solo en este navegador.',
    d_redo: 'Descargar otra vez', d_copy: 'Copiar enlace', d_del: 'Quitar', d_clear: 'Borrar', d_fmt_v: 'Vídeo · MP4', d_fmt_a: 'Audio · MP3',
    d_hint: 'Consejo: pega con Ctrl + V en cualquier parte de la página y empieza solo.', d_empty: 'Pega al menos un enlace.', d_remove: 'Quitar fila', d_ph_multi: 'Un enlace por fila…', d_ph_m: l => `Enlace de ${l}…`,
  },
  en: {
    d_multi: 'Several links at once', d_sep: 'Separate files', d_zip: 'All in a ZIP', d_go_mp4: 'Download MP4', d_go_mp3: 'Download MP3', d_go_all: n => `Download ${n} links`,
    d_list: n => `Add the ${n || ''} videos in the list`, d_list_loading: 'Loading the list…', d_list_ok: n => `${n} links added. Hit download when ready.`,
    d_okn: n => `${n} downloads completed`, d_partial: (a, b) => `${a} of ${b} downloaded. Check the ones in red.`, d_zip_ok: 'ZIP downloaded',
    st_ok: 'Done', st_err: 'Error', st_zip: 'In the ZIP', st_badplat: 'Invalid link', d_hist: 'Your downloads', d_hist_p: 'Stored only in this browser.',
    d_redo: 'Download again', d_copy: 'Copy link', d_del: 'Remove', d_clear: 'Clear', d_fmt_v: 'Video · MP4', d_fmt_a: 'Audio · MP3',
    d_hint: 'Tip: press Ctrl + V anywhere on the page and it starts by itself.', d_empty: 'Paste at least one link.', d_remove: 'Remove row', d_ph_multi: 'One link per row…', d_ph_m: l => `${l} link…`,
  },
});

export const howto = {
  es: [['Copia el enlace', 'En la app de TikTok, Instagram, YouTube… pulsa Compartir → Copiar enlace.'], ['Pégalo aquí', 'Detectamos la plataforma sola. Elige MP4 o MP3 y la calidad.'], ['Descarga', 'El archivo se guarda en tu equipo. Para muchos, activa "Varios enlaces" o pega una lista.']],
  en: [['Copy the link', 'In TikTok, Instagram, YouTube… tap Share → Copy link.'], ['Paste it here', 'We detect the platform. Pick MP4 or MP3 and the quality.'], ['Download', 'The file is saved to your device. For many, turn on "Several links" or paste a playlist.']],
};
export const faq = {
  es: [['¿Puedo descargar varios vídeos a la vez?', 'Sí: activa "Varios enlaces a la vez" (hasta 50) y elige archivos sueltos o un ZIP. Si pegas una lista de reproducción o un perfil, te ofrecemos añadir todos sus vídeos.'],
    ['¿Qué calidad tienen los vídeos?', 'La que elijas, desde "la más ligera" hasta 4K. Hasta 1080p se entrega en H.264, que se reproduce en cualquier sitio.'],
    ['¿Funciona con publicaciones de varias fotos?', 'Sí. Los carruseles de Instagram, TikTok o X se descargan con todas sus fotos y vídeos.'],
    ['¿Puedo compartir directamente desde el móvil?', 'Sí. Instala Letebra Tools como app (Añadir a pantalla de inicio) y aparecerá en el menú Compartir de Android.']],
  en: [['Can I download several videos at once?', 'Yes: turn on "Several links at once" (up to 50) and choose separate files or a ZIP. Paste a playlist or profile and we offer to add all its videos.'],
    ['What quality are the videos?', 'Whatever you pick, from "smallest" to 4K. Up to 1080p is delivered as H.264, which plays everywhere.'],
    ['Does it work with multi-photo posts?', 'Yes. Instagram, TikTok or X carousels download with all their photos and videos.'],
    ['Can I share straight from my phone?', 'Yes. Install Letebra Tools as an app (Add to Home screen) and it shows up in Android\'s Share menu.']],
};

const ph = p => matchMedia('(max-width:600px)').matches ? t('d_ph_m', PLATFORMS[p].label) : PLATFORMS[p].ph;
const ORDER = ['instagram', 'tiktok', 'youtube', 'shorts', 'twitter', 'facebook', 'twitch', 'reddit', 'pinterest'];

export function mount(root, {tool, page, handoff, params}) {
  let platform = page.platform && PLATFORMS[page.platform] ? page.platform : 'instagram';
  let fmt = 'mp4', busy = false, multi = false;
  const info = {};
  const el = h(`<div class="panel glass strong">
    <div class="ptabs" role="tablist">${ORDER.map(p => `<button type="button" role="tab" data-p="${p}" class="${p === platform ? 'on' : ''}">${platformIcon(p)}<span>${PLATFORMS[p].label}</span></button>`).join('')}</div>
    <div class="rows" id="rows"></div>
    <div class="preview" id="pv" hidden></div>
    <button type="button" class="btn ghost block" id="listbtn" style="margin-top:12px" hidden></button>
    <div class="grid2" style="margin-top:18px;align-items:end">
      <div class="opt">${seg('fmt', [['mp4', t('d_fmt_v')], ['mp3', t('d_fmt_a')]], 'mp4')}</div>
      <div class="opt" id="qbox"><select class="sel" id="q">${['best', '1080', '720', '480', 'small'].map(q => `<option value="${q}">${t('q_' + q)}</option>`).join('')}</select></div>
    </div>
    <div class="row" style="margin-top:16px;justify-content:space-between">
      <label class="switch"><input type="checkbox" id="multi"><span class="track"></span>${t('d_multi')}</label>
      <div id="modebox" hidden>${seg('mode', [['sep', t('d_sep')], ['zip', t('d_zip')]], 'sep')}</div>
    </div>
    <div id="go-slot"></div>
    <small class="muted" style="display:block;text-align:center;margin-top:10px;font-size:12.5px">${t('d_hint')}</small>
    <div id="out"></div>
  </div>`);
  root.append(el);
  const rowsEl = $('#rows', el), pv = $('#pv', el), listBtn = $('#listbtn', el), q = $('#q', el), out = $('#out', el);
  q.value = store.get('lt_dq', '1080');
  q.onchange = () => store.set('lt_dq', q.value);
  const go = goButton(t('d_go_mp4'), 'download');
  $('#go-slot', el).append(go);
  const jr = jobRunner(tool);
  out.append(jr.el);
  const msg = h('<div></div>');
  out.append(msg);
  const say = (kind, text) => { msg.innerHTML = text ? `<div class="${kind === 'err' ? 'err-box' : 'info-box'}">${esc(text)}</div>` : ''; };

  function setPlatform(p) {
    platform = p;
    $$('.ptabs button', el).forEach(b => b.classList.toggle('on', b.dataset.p === p));
    $$('input', rowsEl).forEach(i => { i.placeholder = multi ? t('d_ph_multi') : ph(p); });
  }
  $$('.ptabs button', el).forEach(b => b.onclick = () => { setPlatform(b.dataset.p); rowsEl.querySelector('input')?.focus(); });
  const getFmt = bindSeg(el, 'fmt', v => { fmt = v; $('#qbox', el).style.visibility = v === 'mp4' ? '' : 'hidden'; label(); });
  const getMode = bindSeg(el, 'mode', () => label());
  $('#multi', el).onchange = e => { multi = e.target.checked; $('#modebox', el).hidden = !multi; pv.hidden = true; listBtn.hidden = true; ensureBlank(); renumber(); setPlatform(platform); label(); };

  function label() {
    if (busy) return;
    const n = filled().length;
    $('span', go).textContent = multi && n > 1 ? t('d_go_all', n) : t(fmt === 'mp3' ? 'd_go_mp3' : 'd_go_mp4');
  }

  /* rows */
  function makeRow(value = '') {
    const row = h(`<div class="lrow"><span class="n"></span><label class="urlbox"><span class="pf">${icon('link')}</span>
      <input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${esc(multi ? t('d_ph_multi') : ph(platform))}"><span class="status"></span>
      <button type="button" class="btn ghost sm" data-paste>${icon('paste')}<span>${t('k_paste')}</span></button><i class="rowbar"></i></label>
      <button type="button" class="btn ghost icon sm" data-del title="${t('d_remove')}" aria-label="${t('d_remove')}">${icon('x')}</button></div>`);
    const input = $('input', row);
    input.value = value;
    input.addEventListener('input', () => onInput(row));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
    $('[data-paste]', row).onclick = async () => { try { input.value = (await navigator.clipboard.readText()).trim(); onInput(row); } catch { input.focus(); } };
    $('[data-del]', row).onclick = () => { row.remove(); ensureBlank(); renumber(); label(); };
    rowsEl.append(row);
    if (value) onInput(row);
    renumber();
    return row;
  }
  const rows = () => [...rowsEl.children];
  const filled = () => rows().filter(r => $('input', r).value.trim());
  function setStatus(row, kind, text = '') {
    const s = $('.status', row);
    s.className = 'status ' + kind;
    s.innerHTML = kind === 'run' ? `<span class="spin"></span>${esc(text)}` : kind === 'ok' ? `${icon('check').replace('<svg', '<svg width="14" height="14"')}${esc(text)}` : esc(text);
    $('[data-paste]', row).hidden = !!kind;
    if (kind !== 'run') $('.rowbar', row).style.width = '0';
  }
  function onInput(row) {
    const input = $('input', row), v = input.value.trim(), url = extractUrl(v) || v, p = v ? detectPlatform(url) : null;
    $('.urlbox', row).classList.toggle('bad', !!v && !p);
    $('.pf', row).innerHTML = p ? platformIcon(p) : icon('link');
    row.dataset.platform = p || '';
    setStatus(row, '');
    say();
    if (p && !multi && p !== platform) setPlatform(p);
    ensureBlank();
    label();
    if (!multi) schedulePreview(url, p);
  }
  function ensureBlank() {
    if (!multi) { rows().slice(1).forEach(r => r.remove()); if (!rows().length) makeRow(); return; }
    const empty = rows().filter(r => !$('input', r).value.trim());
    if (!empty.length) makeRow();
    else empty.slice(0, -1).forEach(r => { if (!r.contains(document.activeElement)) r.remove(); });
  }
  function renumber() {
    rows().forEach((r, i) => {
      $('.n', r).textContent = multi ? i + 1 : '';
      $('.n', r).hidden = !multi;
      $('[data-del]', r).hidden = !multi || rows().length < 2;
    });
  }

  /* preview + playlists (single link) */
  let pvTimer, pvSeq = 0;
  function schedulePreview(url, p) {
    clearTimeout(pvTimer);
    const s = ++pvSeq;
    pv.hidden = true; listBtn.hidden = true;
    if (!p) return;
    pvTimer = setTimeout(async () => {
      try {
        const d = await api(`/api/info?url=${encodeURIComponent(url)}&platform=${p}`);
        info[url] = d;
        if (s !== pvSeq || !(d.title || d.thumbnail || d.type === 'playlist')) return;
        const list = d.type === 'playlist';
        pv.innerHTML = `${d.thumbnail ? `<img src="${esc(d.thumbnail)}" alt="" referrerpolicy="no-referrer">` : ''}<div class="pv-meta"><b>${esc((list ? '📃 ' : '') + (d.title || PLATFORMS[p].label))}</b><small>${esc([d.uploader, list ? (d.count ? t('k_items', d.count) : '') : fmtDur(d.duration)].filter(Boolean).join(' · '))}</small></div>`;
        $('img', pv)?.addEventListener('error', e => e.target.remove());
        pv.hidden = false;
        if (list) { listBtn.innerHTML = `${icon('plus')}<span>${esc(t('d_list', d.count))}</span>`; listBtn.hidden = false; listBtn.disabled = false; }
      } catch {}
    }, 450);
  }
  async function loadList(url) {
    listBtn.disabled = true; listBtn.innerHTML = `<span class="spin"></span>${t('d_list_loading')}`;
    try {
      const d = await api(`/api/list?url=${encodeURIComponent(url)}&platform=${detectPlatform(url)}`);
      if (!multi) { $('#multi', el).checked = true; $('#multi', el).onchange({target: {checked: true}}); }
      rowsEl.replaceChildren();
      d.entries.forEach(e => makeRow(e.url));
      ensureBlank(); renumber(); label();
      say('info', t('d_list_ok', d.entries.length));
    } catch (e) { listBtn.disabled = false; listBtn.innerHTML = `${icon('plus')}<span>${esc(t('d_list', ''))}</span>`; say('err', e.message); }
  }
  listBtn.onclick = () => loadList(extractUrl($('input', rows()[0]).value) || $('input', rows()[0]).value.trim());

  /* run */
  const qLabel = () => fmt === 'mp3' ? 'MP3' : 'MP4 ' + ({best: '4K', small: t('q_small')}[q.value] || q.value + 'p');
  const item = it => ({url: it.url, platform: it.platform, format: fmt, quality: q.value});
  function rowProgress(row, st) {
    const bar = $('.rowbar', row);
    if (st.status === 'queued') return setStatus(row, 'run', t('st_queue'));
    if (st.status === 'processing') { setStatus(row, 'run', (st.stage ? t('stage_' + st.stage) : t('st_proc')) + (st.pct != null ? ` ${st.pct}%` : '')); bar.style.width = (st.pct ?? 100) + '%'; return; }
    setStatus(row, 'run', st.pct != null ? `${st.pct}%` : st.status === 'sending' ? t('st_send') : t('st_dl'));
    bar.style.width = (st.pct ?? 0) + '%';
  }
  const addHist = (it, title) => history.add({tool: 'download', url: it.url, platform: it.platform, title: info[it.url]?.title || title || it.url,
    thumb: info[it.url]?.thumbnail || '', format: fmt, quality: q.value, detail: qLabel()});

  async function start() {
    if (busy) return;
    say();
    const items = [];
    for (const row of filled()) {
      const v = $('input', row).value.trim(), url = extractUrl(v) || v, p = detectPlatform(url);
      if (!p) { $('.urlbox', row).classList.add('bad'); setStatus(row, 'err', t('st_badplat')); return say('err', t('k_badurl')); }
      items.push({row, url, platform: p});
    }
    if (!items.length) { rows()[0] && $('input', rows()[0]).focus(); return say('err', t('d_empty')); }
    if (!multi && info[items[0].url]?.type === 'playlist') return loadList(items[0].url);
    busy = true; go.disabled = true; $('span', go).textContent = t('st_proc');
    try {
      if (!multi || items.length === 1) {
        const it = items[0];
        setStatus(it.row, 'run', t('st_queue'));
        const r = await jr.run({items: [item(it)]}, {entry: {url: it.url, platform: it.platform, title: info[it.url]?.title, thumb: info[it.url]?.thumbnail || '', format: fmt, quality: q.value, detail: qLabel()}, preview: false});
        setStatus(it.row, r ? 'ok' : 'err', t(r ? 'st_ok' : 'st_err'));
        if (r) renderHist();
      } else if (getMode() === 'zip') {
        items.forEach(i => setStatus(i.row, 'run', t('st_queue')));
        const r = await runJob({items: items.map(item), zip: true}, st => {
          items.forEach((it, i) => {
            if (st.failed?.includes(i)) setStatus(it.row, 'err', t('st_err'));
            else if (i < st.current || st.status === 'sending') setStatus(it.row, 'ok', t('st_zip'));
            else if (i === st.current) rowProgress(it.row, st);
          });
          say('info', st.status === 'sending' ? `${t('st_send')} ${st.pct ?? ''}%` : t('k_of', Math.min(st.current + 1, st.count), st.count));
        });
        saveBlob(r.blob, r.name);
        items.forEach(it => { if (!$('.status.err', it.row)) { setStatus(it.row, 'ok', t('st_zip')); addHist(it); } });
        say('info', t('d_zip_ok'));
        kofiNudge(); renderHist();
      } else {
        let ok = 0;
        for (const [n, it] of items.entries()) {
          setStatus(it.row, 'run', t('st_queue'));
          say('info', t('k_of', n + 1, items.length));
          try {
            const r = await runJob({items: [item(it)]}, st => rowProgress(it.row, st));
            await saveResult(r);
            setStatus(it.row, 'ok', t('st_ok')); ok++;
            addHist(it, r.name.replace(/\.[^.]+$/, ''));
          } catch (e) {
            setStatus(it.row, 'err', t('st_err'));
            $('.status', it.row).title = e.message;
            $('.urlbox', it.row).classList.add('bad');
          }
        }
        say(ok === items.length ? 'info' : 'err', ok === items.length ? t('d_okn', ok) : t('d_partial', ok, items.length));
        if (ok) kofiNudge();
        renderHist();
      }
    } catch (e) {
      items.forEach(i => { if ($('.status.run', i.row)) setStatus(i.row, 'err', t('st_err')); });
      say('err', e.message);
    } finally { busy = false; go.disabled = false; label(); }
  }
  go.onclick = start;

  /* paste anywhere (outside fields): fills the link and starts */
  document.addEventListener('paste', e => {
    if (e.target.closest?.('input,textarea,select,[contenteditable]') || busy) return;
    const url = extractUrl(e.clipboardData?.getData('text') || '');
    if (!url || !detectPlatform(url)) return;
    e.preventDefault();
    const row = multi ? rows().find(r => !$('input', r).value.trim()) || makeRow() : rows()[0];
    $('input', row).value = url;
    onInput(row);
    if (!multi) start();
  });

  /* your downloads (this browser) */
  const histBox = h(`<div class="panel glass" id="dl-hist" hidden><div class="opt-row" style="margin-bottom:12px"><div><b style="font-size:16px">${t('d_hist')}</b><div class="muted" style="font-size:12.5px">${t('d_hist_p')}</div></div><button type="button" class="btn ghost sm" data-clear>${t('d_clear')}</button></div><div class="hist"></div></div>`);
  root.append(histBox);
  function renderHist() {
    const all = history.list(), mine = all.map((e, i) => [e, i]).filter(([e]) => e.tool === 'download' && e.url).slice(0, 10);
    histBox.hidden = !mine.length;
    $('.hist', histBox).innerHTML = mine.map(([e, i]) => `<div class="hitem">${e.thumb ? `<img src="${esc(e.thumb)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : `<span class="hph">${platformIcon(e.platform || 'youtube')}</span>`}
      <div class="hinfo"><b>${esc(e.title || e.url)}</b><small>${esc([PLATFORMS[e.platform]?.label, e.detail, relTime(e.t)].filter(Boolean).join(' · '))}</small></div>
      <button type="button" class="btn ghost icon sm" data-redo="${i}" title="${t('d_redo')}" aria-label="${t('d_redo')}">${icon('download')}</button>
      <button type="button" class="btn ghost icon sm" data-copy="${i}" title="${t('d_copy')}" aria-label="${t('d_copy')}">${icon('link')}</button>
      <button type="button" class="btn ghost icon sm" data-rm="${i}" title="${t('d_del')}" aria-label="${t('d_del')}">${icon('x')}</button></div>`).join('');
    $$('img', histBox).forEach(img => img.onerror = () => img.replaceWith(h(`<span class="hph">${icon('play')}</span>`)));
    $$('[data-redo]', histBox).forEach(b => b.onclick = () => redo(all[+b.dataset.redo]));
    $$('[data-copy]', histBox).forEach(b => b.onclick = () => copyText(all[+b.dataset.copy].url));
    $$('[data-rm]', histBox).forEach(b => b.onclick = () => { history.remove(+b.dataset.rm); renderHist(); });
  }
  $('[data-clear]', histBox).onclick = () => { store.set('lt_history', history.list().filter(e => e.tool !== 'download')); dispatchEvent(new CustomEvent('lt:history')); renderHist(); };
  function redo(e) {
    if (busy || !e) return;
    if (multi) { $('#multi', el).checked = false; $('#multi', el).onchange({target: {checked: false}}); }
    $(`[data-seg="fmt"] [data-v="${e.format === 'mp3' ? 'mp3' : 'mp4'}"]`, el).click();
    if (e.quality) q.value = e.quality;
    $('input', rows()[0]).value = e.url;
    onInput(rows()[0]);
    el.scrollIntoView({behavior: 'smooth', block: 'center'});
    start();
  }

  makeRow();
  setPlatform(platform);
  renderHist();
  label();
  // shared from another app (?url= / ?text=), from the lobby or from history: fill in and start
  const shared = extractUrl([params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ')) || handoff?.url;
  if (shared && detectPlatform(shared)) {
    $('input', rows()[0]).value = shared;
    onInput(rows()[0]);
    try { window.history.replaceState(null, '', location.pathname); } catch {}
    start();
  }
}
