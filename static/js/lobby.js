// Lobby: hero (3D), search, smart paste/drop, favorites · recents · history, categories, Ko-fi.
import {$, $$, TOOLS, CATS, toolById, toolsOfCat, esc, t, L, lang, addStrings, cfg, favs, recents, history, relTime,
  detectPlatform, extractUrl, toolsFor, setHandoff, putHandoffFile, copyText} from './core.js';
import {icon, toolIcon, platformIcon} from './icons.js';
import {tile, catTile, palette, observeReveal, catColor, toolCard, bindStars} from './shell.js';
import {mountHero} from './hero3d.js';

addStrings({
  es: {
    eyebrow: 'Nuevo', eyebrow_t: n => `${n} herramientas en un solo sitio`,
    h1a: 'Todas las herramientas', h1b: 'que un creador necesita.', h1c: 'En un solo sitio.',
    lead: 'Descarga, edita, convierte y crea. Gratis, sin registro y sin anuncios.',
    hs_ph: 'Busca una herramienta o pega un enlace…', hs_ph_m: 'Busca o pega un enlace…', st_tools: 'herramientas', st_plat: 'plataformas', st_ads: 'anuncios',
    q_favs: 'Favoritas', q_recent: 'Recientes', q_hist: 'Historial', q_none_favs: 'Pulsa ☆ en cualquier herramienta para tenerla siempre aquí.',
    q_none_recent: 'Las herramientas que uses aparecerán aquí.', q_none_hist: 'Aquí verás lo que vayas descargando y creando.', q_clear: 'Borrar historial',
    all: 'Todas', count: n => `${n} herramientas`, open: 'Abrir', browser: 'En tu navegador', server: 'En el servidor',
    explore: 'Explora por categorías', explore_s: 'Cada herramienta hace una cosa y la hace bien. Elige y listo.',
    lb_kofi_h: 'Gratis, sin anuncios y sin registro.', lb_kofi_p: 'Letebra Tools existe gracias a quienes invitan a un café. Cada uno paga una parte del servidor y de las próximas herramientas.',
    lb_kofi_b: 'Invítame a un café', lb_kofi_more: 'Por qué no hay anuncios',
    why_h: 'Por qué Letebra Tools', w1: 'Sin anuncios', w1p: 'Nada de pop-ups, redirecciones ni banners. Solo herramientas.',
    w2: 'Sin registro', w2p: 'Ni cuentas ni correos. Entras, lo usas y te vas.', w3: 'Privado', w3p: 'Muchas herramientas funcionan en tu navegador y nada sale de tu equipo.',
    w4: 'Rápido de verdad', w4p: 'Progreso en tiempo real y resultados listos para publicar.',
    sg_url: '¿Qué quieres hacer con este enlace?', sg_file: '¿Qué quieres hacer con este archivo?', sg_text: '¿Qué quieres hacer con este texto?',
    drop_here: 'Suelta tu archivo', drop_sub: 'Te diremos qué puedes hacer con él', hist_open: 'Abrir de nuevo', hist_copy: 'Copiar enlace', hist_del: 'Quitar',
  },
  en: {
    eyebrow: 'New', eyebrow_t: n => `${n} tools in one place`,
    h1a: 'Every tool', h1b: 'a creator needs.', h1c: 'In one place.',
    lead: 'Download, edit, convert and create. Free, no sign-up and no ads.',
    hs_ph: 'Search a tool or paste a link…', hs_ph_m: 'Search or paste a link…', st_tools: 'tools', st_plat: 'platforms', st_ads: 'ads',
    q_favs: 'Favorites', q_recent: 'Recent', q_hist: 'History', q_none_favs: 'Tap ☆ on any tool to keep it here.',
    q_none_recent: 'Tools you use will show up here.', q_none_hist: 'What you download and create will show up here.', q_clear: 'Clear history',
    all: 'All', count: n => `${n} tools`, open: 'Open', browser: 'In your browser', server: 'On the server',
    explore: 'Explore by category', explore_s: 'Every tool does one thing and does it well. Pick one and go.',
    lb_kofi_h: 'Free, no ads, no sign-up.', lb_kofi_p: 'Letebra Tools exists thanks to people who buy a coffee. Each one pays part of the server and the next tools.',
    lb_kofi_b: 'Buy me a coffee', lb_kofi_more: 'Why there are no ads',
    why_h: 'Why Letebra Tools', w1: 'No ads', w1p: 'No pop-ups, redirects or banners. Just tools.',
    w2: 'No sign-up', w2p: 'No accounts, no emails. Come in, use it, leave.', w3: 'Private', w3p: 'Many tools run in your browser and nothing leaves your device.',
    w4: 'Actually fast', w4p: 'Real-time progress and results ready to post.',
    sg_url: 'What do you want to do with this link?', sg_file: 'What do you want to do with this file?', sg_text: 'What do you want to do with this text?',
    drop_here: 'Drop your file', drop_sub: 'We\'ll show what you can do with it', hist_open: 'Open again', hist_copy: 'Copy link', hist_del: 'Remove',
  },
});

// Old one-page links (#recortar…) now live on their own URLs.
const OLD_HASH = {'#descargar': '/descargar', '#recortar': '/recortar', '#comprimir': '/comprimir', '#unir': '/unir', '#vertical': '/vertical', '#audio': '/audio', '#subtitulos': '/subtitulos', '#datos': '/datos'};

export function render(app) {
  if (OLD_HASH[location.hash]) return location.replace(OLD_HASH[location.hash]);
  const n = TOOLS.length;
  app.innerHTML = `
  <section class="hero"><div class="wrap hero-inner">
    <div class="hero-copy">
      <span class="eyebrow glass" style="animation:fade .5s var(--ease) both"><b>${t('eyebrow')}</b>${t('eyebrow_t', n)}</span>
      <h1><span class="line"><span style="--d:0s">${t('h1a')}</span></span><span class="line"><span class="grad-text" style="--d:.06s">${t('h1b')}</span></span><span class="line"><span style="--d:.12s">${t('h1c')}</span></span></h1>
      <p class="lead">${t('lead')}</p>
      <label class="hero-search glass" data-refract>${icon('search')}<input id="hero-q" type="text" placeholder="${esc(t(matchMedia('(max-width:600px)').matches ? 'hs_ph_m' : 'hs_ph'))}" autocomplete="off" spellcheck="false" aria-label="${esc(t('hs_ph'))}"><span class="kbd">/</span></label>
      <div class="hero-chips">
        <a class="chip" href="/descargar/tiktok">${platformIcon('tiktok').replace('<svg', '<svg width="15" height="15"')} TikTok</a>
        <a class="chip" href="/descargar/instagram">${platformIcon('instagram').replace('<svg', '<svg width="15" height="15"')} Reels</a>
        <a class="chip" href="/recortar">${icon('trim').replace('<svg', '<svg width="15" height="15"')} ${esc(L(toolById('trim').name))}</a>
        <a class="chip" href="/quitar-fondo">${icon('bgremove').replace('<svg', '<svg width="15" height="15"')} ${esc(L(toolById('bgremove').name))}</a>
        <a class="chip" href="/fuentes">${icon('fonts').replace('<svg', '<svg width="15" height="15"')} ${esc(L(toolById('fonts').name))}</a>
      </div>
      <div class="hero-stats"><div><b data-count="${n}">0</b><span>${t('st_tools')}</span></div><div><b data-count="9">0</b><span>${t('st_plat')}</span></div><div><b>0</b><span>${t('st_ads')}</span></div></div>
    </div>
    <div class="hero-visual" id="hero-3d"></div>
  </div></section>

  <div class="wrap">
    <section class="section" style="padding-top:20px"><div class="quick glass reveal" id="quick"></div></section>

    <section class="section" id="explore">
      <div class="sec-head reveal"><div><h2 class="sec-title">${t('explore')}</h2><p class="sec-sub">${t('explore_s')}</p></div></div>
      <nav class="catbar glass strong" id="catbar"><a class="chip on" href="#explore" data-c="all">${t('all')}</a>${CATS.map(c => `<a class="chip" href="#cat-${c.id}" data-c="${c.id}" style="--c:${c.color}"><i></i>${esc(L(c.name))}</a>`).join('')}</nav>
      ${CATS.map(c => {
        const list = toolsOfCat(c.id);
        return `<section class="cat" id="cat-${c.id}"><div class="cat-head reveal">${catTile(c)}<div><h2>${esc(L(c.name))}</h2><p>${esc(L(c.blurb))}</p></div><span class="count">${t('count', list.length)}</span></div>
          <div class="tgrid">${list.map((x, i) => toolCard(x, i * 60, c.color)).join('')}</div></section>`;
      }).join('')}
    </section>

    ${cfg('SUPPORT_URL', '') ? `<section class="section"><div class="kofi glass reveal">
      <div class="cupbox"><span class="steam"><i></i><i></i><i></i></span>☕</div>
      <div><h2>${t('lb_kofi_h')}</h2><p>${t('lb_kofi_p')}</p></div>
      <div class="stack" style="gap:10px;align-items:center"><a class="btn coffee lg sheen" href="${esc(cfg('SUPPORT_URL', ''))}" target="_blank" rel="noopener">${icon('coffee')}${t('lb_kofi_b')}</a><a class="chip" href="/apoyar">${t('lb_kofi_more')}</a></div>
    </div></section>` : ''}

    <section class="section"><div class="sec-head reveal"><h2 class="sec-title">${t('why_h')}</h2></div>
      <div class="why">${[['noads', 'w1'], ['user', 'w2'], ['shield', 'w3'], ['zap', 'w4']].map(([ic, k], i) => `<div class="glass reveal" style="--d:${i * 80}ms"><span class="wi">${icon(ic)}</span><h3>${t(k)}</h3><p>${t(k + 'p')}</p></div>`).join('')}</div>
    </section>
  </div>`;

  mountHero($('#hero-3d'));
  countUp();
  renderQuick();
  addEventListener('lt:favs', renderQuick);
  addEventListener('lt:history', renderQuick);
  bindStars(app);
  observeReveal(app);
  catbarSpy();
  heroSearch();
  smartPaste();
  if (location.hash.startsWith('#cat-')) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 60);
}

function countUp() {
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count, t0 = performance.now() + 250;
    const step = now => { const p = Math.min(1, Math.max(0, (now - t0) / 900)); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

let quickTab = null;
function renderQuick() {
  const box = $('#quick');
  if (!box) return;
  const f = favs.list().map(toolById).filter(Boolean), r = recents().map(toolById).filter(Boolean), h = history.list();
  quickTab ||= f.length ? 'favs' : r.length ? 'recent' : h.length ? 'hist' : 'favs';
  const chip = x => `<a class="qitem" href="/${x.slug}">${tile(x)}<b>${esc(L(x.name))}</b></a>`;
  let body;
  if (quickTab === 'favs') body = f.length ? `<div class="quick-row">${f.map(chip).join('')}</div>` : `<div class="quick-empty">${icon('star')}${t('q_none_favs')}</div>`;
  else if (quickTab === 'recent') body = r.length ? `<div class="quick-row">${r.map(chip).join('')}</div>` : `<div class="quick-empty">${icon('clock')}${t('q_none_recent')}</div>`;
  else body = h.length ? `<div class="hist">${h.slice(0, 8).map((e, i) => {
    const tool = toolById(e.tool) || toolById('download');
    return `<div class="hitem">${e.thumb ? `<img src="${esc(e.thumb)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : `<span class="hph" style="background:${catColor(tool)}33">${toolIcon(tool)}</span>`}
      <div class="hinfo"><b>${esc(e.title || e.url || L(tool.name))}</b><small>${esc(L(tool.name))}${e.detail ? ' · ' + esc(e.detail) : ''} · ${esc(relTime(e.t))}</small></div>
      ${e.url ? `<button class="btn ghost icon sm" data-h-open="${i}" title="${t('hist_open')}">${icon('refresh')}</button><button class="btn ghost icon sm" data-h-copy="${i}" title="${t('hist_copy')}">${icon('link')}</button>` : ''}
      <button class="btn ghost icon sm" data-h-del="${i}" title="${t('hist_del')}">${icon('x')}</button></div>`;
  }).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn ghost sm" data-h-clear>${t('q_clear')}</button></div>`
    : `<div class="quick-empty">${icon('history')}${t('q_none_hist')}</div>`;
  box.innerHTML = `<div class="quick-tabs seg">${[['favs', 'q_favs', f.length], ['recent', 'q_recent', r.length], ['hist', 'q_hist', h.length]].map(([k, l, c]) =>
    `<button data-q="${k}" class="${quickTab === k ? 'on' : ''}">${t(l)}${c ? ` <span class="badge" style="margin-left:4px">${c}</span>` : ''}</button>`).join('')}</div>${body}`;
  $$('[data-q]', box).forEach(b => b.onclick = () => { quickTab = b.dataset.q; renderQuick(); });
  $$('[data-h-open]', box).forEach(b => b.onclick = () => { const e = h[+b.dataset.hOpen], tool = toolById(e.tool) || toolById('download'); setHandoff({url: e.url}); location.href = `/${tool.slug}`; });
  $$('[data-h-copy]', box).forEach(b => b.onclick = () => copyText(h[+b.dataset.hCopy].url));
  $$('[data-h-del]', box).forEach(b => b.onclick = () => history.remove(+b.dataset.hDel));
  box.querySelector('[data-h-clear]')?.addEventListener('click', () => history.clear());
}

function catbarSpy() {
  const chips = $$('#catbar .chip');
  const set = id => chips.forEach(c => c.classList.toggle('on', c.dataset.c === id));
  const obs = new IntersectionObserver(es => {
    const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis) set(vis.target.id.replace('cat-', ''));
  }, {rootMargin: '-35% 0px -55% 0px'});
  $$('.cat').forEach(s => obs.observe(s));
}

function heroSearch() {
  const q = $('#hero-q');
  q.addEventListener('input', () => {
    const v = q.value;
    if (extractUrl(v) && detectPlatform(extractUrl(v))) { q.value = ''; return suggest({kind: 'url', url: extractUrl(v)}); }
    if (v.trim()) { q.value = ''; q.blur(); palette.open(v); }
  });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); palette.open(q.value); q.value = ''; } });
}

/* ─── smart paste & drop ─── */
const KIND_OF = f => f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : null;

function suggest({kind, url, file, text}) {
  const list = toolsFor(kind);
  if (!list.length) return;
  const el = document.createElement('div');
  el.className = 'suggest';
  const head = kind === 'url' ? {ic: platformIcon(detectPlatform(url) || 'youtube'), title: t('sg_url'), sub: url}
    : kind === 'text' ? {ic: icon('fonts'), title: t('sg_text'), sub: text.slice(0, 120)}
    : {ic: icon(kind === 'image' ? 'image' : kind === 'audio' ? 'audio' : 'cat-video'), title: t('sg_file'), sub: file.name};
  el.innerHTML = `<div class="suggest-box glass strong" role="dialog" aria-modal="true">
    <div class="suggest-head"><span class="ti" style="--c:#2c2b48">${head.ic}</span><div style="min-width:0;flex:1"><b>${esc(head.title)}</b><small>${esc(head.sub)}</small></div><button class="btn ghost icon sm" data-x aria-label="✕">${icon('x')}</button></div>
    <div class="suggest-grid">${list.map(x => `<a href="/${x.slug}" data-go="${x.slug}">${tile(x)}<b>${esc(L(x.name))}</b></a>`).join('')}</div></div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const close = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 300); };
  el.onclick = e => { if (e.target === el || e.target.closest('[data-x]')) close(); };
  addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc_); } });
  $$('[data-go]', el).forEach(a => a.onclick = async e => {
    e.preventDefault();
    if (kind === 'url') setHandoff({url});
    else if (kind === 'text') setHandoff({text});
    else { await putHandoffFile(file); setHandoff({file: true, kind}); }
    location.href = a.getAttribute('href');
  });
}

function smartPaste() {
  document.addEventListener('paste', e => {
    if (e.target.closest?.('input,textarea,[contenteditable]') && e.target.id !== 'hero-q') return;
    const file = [...(e.clipboardData?.files || [])][0];
    if (file && KIND_OF(file)) { e.preventDefault(); return suggest({kind: KIND_OF(file), file}); }
    const text = e.clipboardData?.getData('text') || '';
    const url = extractUrl(text);
    if (url && detectPlatform(url)) { e.preventDefault(); return suggest({kind: 'url', url}); }
    if (text.trim().length > 3 && e.target.id !== 'hero-q') { e.preventDefault(); suggest({kind: 'text', text: text.trim()}); }
  });
  const veil = document.createElement('div');
  veil.className = 'dropveil';
  veil.innerHTML = `<div>${icon('upload')}${t('drop_here')}<div class="muted" style="font-size:14px;font-weight:550;margin-top:6px">${t('drop_sub')}</div></div>`;
  document.body.append(veil);
  let depth = 0;
  addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { depth++; veil.classList.add('on'); } });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; veil.classList.remove('on'); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => {
    e.preventDefault(); depth = 0; veil.classList.remove('on');
    const file = e.dataTransfer?.files?.[0];
    if (file && KIND_OF(file)) suggest({kind: KIND_OF(file), file});
  });
}
