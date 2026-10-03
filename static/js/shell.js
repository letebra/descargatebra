// Header, mega menu, mobile sheet, command palette (Ctrl+K), footer and the ambient effects.
import {$, $$, SITE, TOOLS, CATS, catById, toolsOfCat, esc, t, L, lang, setLang, addStrings, cfg, detectPlatform, extractUrl, toolsFor, setHandoff} from './core.js';
import {icon, toolIcon, gem, socialIcon} from './icons.js';

addStrings({
  es: {
    nav_tools: 'Herramientas', nav_faq: 'FAQ', search_ph: 'Buscar herramientas…', support: 'Apoyar', menu: 'Menú', close: 'Cerrar',
    pal_ph: 'Busca una herramienta o pega un enlace…', pal_tools: 'Herramientas', pal_pages: 'Páginas', pal_link: 'Con este enlace',
    pal_nav: 'navegar', pal_open: 'abrir', pal_close: 'cerrar', pal_empty: 'Nada por aquí. Prueba con “mp3”, “recortar” o “fondo”.',
    f_tag: 'Todas las herramientas que un creador necesita. Gratis, sin anuncios y sin registro.', f_cats: 'Categorías', f_top: 'Populares', f_res: 'Proyecto',
    f_legal: 'Legal', faq: 'Preguntas frecuentes', news: 'Novedades', support_p: 'Apoyar el proyecto', contact: 'Contacto',
    setup_t: 'Mi setup de creador', setup_s: 'Enlaces de afiliado: si compras, me llevo una pequeña comisión sin coste extra para ti.',
    legal_notice: 'Aviso legal', privacy: 'Privacidad', cookies: 'Cookies', terms: 'Términos de uso', made: 'Hecho con <span class="heart">♥</span> por Letebra',
    noads: 'Sin anuncios · Sin registro', all_tools: 'Ver todas', lang_l: 'Idioma',
    p_faq: 'Preguntas frecuentes', p_contact: 'Contacto', p_support: 'Apoyar el proyecto', p_news: 'Novedades', p_home: 'Inicio',
  },
  en: {
    nav_tools: 'Tools', nav_faq: 'FAQ', search_ph: 'Search tools…', support: 'Support', menu: 'Menu', close: 'Close',
    pal_ph: 'Search a tool or paste a link…', pal_tools: 'Tools', pal_pages: 'Pages', pal_link: 'With this link',
    pal_nav: 'navigate', pal_open: 'open', pal_close: 'close', pal_empty: 'Nothing here. Try “mp3”, “trim” or “background”.',
    f_tag: 'Every tool a creator needs. Free, no ads, no sign-up.', f_cats: 'Categories', f_top: 'Popular', f_res: 'Project',
    f_legal: 'Legal', faq: 'FAQ', news: 'What\'s new', support_p: 'Support the project', contact: 'Contact',
    setup_t: 'My creator setup', setup_s: 'Affiliate links: if you buy, I get a small commission at no extra cost to you.',
    legal_notice: 'Legal notice', privacy: 'Privacy', cookies: 'Cookies', terms: 'Terms of use', made: 'Made with <span class="heart">♥</span> by Letebra',
    noads: 'No ads · No sign-up', all_tools: 'See all', lang_l: 'Language',
    p_faq: 'FAQ', p_contact: 'Contact', p_support: 'Support the project', p_news: 'What\'s new', p_home: 'Home',
  },
});

export const catColor = tool => (catById(tool.cat) || {}).color || '#6d5efc';
export const tile = (tool, cls = '') => `<span class="ti ${cls}" style="--c:${catColor(tool)}">${toolIcon(tool)}</span>`;
export const catTile = (c, cls = '') => `<span class="ti ${cls}" style="--c:${c.color}">${icon(c.icon)}</span>`;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const kbdLabel = isMac ? '⌘K' : 'Ctrl K';
export const finePointer = matchMedia('(pointer:fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isChromium = !!(navigator.userAgentData?.brands?.some(b => /Chromium|Chrome|Edge|Opera/.test(b.brand))) || /Chrome\/\d+/.test(navigator.userAgent) && !/Firefox|FxiOS/.test(navigator.userAgent);

function megaContent(cls = 'mega-grid') {
  return `<div class="${cls}">${CATS.map(c => `<div style="--c:${c.color}"><h4><i>${icon(c.icon)}</i>${esc(L(c.name))}</h4>
    ${toolsOfCat(c.id).filter(x => x.cat === c.id).map(x => `<a href="/${x.slug}">${toolIcon(x)}<span>${esc(L(x.name))}</span></a>`).join('')}</div>`).join('')}</div>`;
}

function header() {
  const kofi = cfg('SUPPORT_URL', '');
  $('#hdr').innerHTML = `<div class="hdr-bar glass" data-refract>
    <a class="logo" href="/" aria-label="Letebra Tools">${gem()}<span>Letebra <b>Tools</b></span></a>
    <nav class="hdr-nav" aria-label="Principal">
      <button class="hdr-link" id="mega-btn" aria-expanded="false" aria-controls="mega">${icon('grid')}<span>${t('nav_tools')}</span>${icon('chevD')}</button>
      <a class="hdr-link" href="/faq">${icon('info')}<span>${t('nav_faq')}</span></a>
    </nav>
    <button class="hdr-search" id="search-btn" aria-label="${esc(t('search_ph'))}">${icon('search')}<span>${t('search_ph')}</span><span class="kbd">${kbdLabel}</span></button>
    <div class="hdr-right">
      ${kofi ? `<a class="btn coffee sm" href="${esc(kofi)}" target="_blank" rel="noopener" aria-label="${t('support')}">${icon('coffee')}<span>${t('support')}</span></a>` : ''}
      <div class="lang" role="group" aria-label="${t('lang_l')}"><button data-l="es" class="${lang === 'es' ? 'on' : ''}">ES</button><button data-l="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div>
      <button class="btn ghost icon sm hdr-burger" id="burger" aria-label="${t('menu')}">${icon('menu')}</button>
    </div>
  </div>
  <div class="mega glass strong" id="mega" role="menu">${megaContent()}</div>`;

  const hdr = $('#hdr'), mega = $('#mega'), btn = $('#mega-btn');
  const setMega = open => { mega.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); };
  btn.onclick = e => { e.stopPropagation(); setMega(!mega.classList.contains('open')); };
  document.addEventListener('click', e => { if (!mega.contains(e.target)) setMega(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMega(false); });
  $$('.lang button', hdr).forEach(b => b.onclick = () => b.dataset.l !== lang && setLang(b.dataset.l));
  $('#search-btn').onclick = () => palette.open();
  $('#burger').onclick = () => sheet();
  const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, {passive: true}); onScroll();
}

function sheet() {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-panel glass strong">
    <div class="sheet-top"><a class="logo" href="/">${gem()}<span>Letebra <b>Tools</b></span></a><button class="btn ghost icon sm" data-x aria-label="${t('close')}">${icon('x')}</button></div>
    ${megaContent('mega-grid')}
    <div class="row" style="margin-top:18px;justify-content:space-between">
      <div class="lang"><button data-l="es" class="${lang === 'es' ? 'on' : ''}">ES</button><button data-l="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div>
      <a class="btn ghost sm" href="/faq">${t('faq')}</a>
    </div></div>`;
  el.querySelector('.mega-grid').classList.add('mega');
  el.querySelector('.mega-grid').style.cssText = 'position:static;transform:none;opacity:1;pointer-events:auto;width:auto;padding:0';
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const close = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 350); };
  el.onclick = e => { if (e.target === el || e.target.closest('[data-x]')) close(); };
  $$('.lang button', el).forEach(b => b.onclick = () => b.dataset.l !== lang && setLang(b.dataset.l));
}

/* ─── command palette ─── */
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function scoreTool(tool, words) {
  const name = norm(L(tool.name)), alt = norm(tool.name[lang === 'es' ? 'en' : 'es']), desc = norm(L(tool.desc));
  const kws = [...tool.kw.es, ...tool.kw.en].map(norm);
  let total = 0;
  for (const q of words) {
    let s = 0;
    if (name.startsWith(q)) s = 100;
    else if (name.split(/\s+/).some(w => w.startsWith(q))) s = 85;
    else if (kws.some(k => k.startsWith(q))) s = 70;
    else if (name.includes(q) || alt.includes(q)) s = 60;
    else if (kws.some(k => k.includes(q))) s = 50;
    else if (desc.includes(q)) s = 35;
    else if (q.length > 2 && [...q].reduce((i, ch) => i < 0 ? -1 : name.indexOf(ch, i) >= 0 ? name.indexOf(ch, i) + 1 : -1, 0) > 0) s = 12;
    if (!s) return 0;
    total += s;
  }
  return total;
}
export function searchTools(query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return TOOLS.slice();
  return TOOLS.map(x => [x, scoreTool(x, words)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x);
}
const PAGES = () => [['/faq', t('p_faq'), 'info'], ['/contacto', t('p_contact'), 'mail'], ['/apoyar', t('p_support'), 'coffee'], ['/novedades', t('p_news'), 'sparkle'], ['/', t('p_home'), 'grid']];

export const palette = (() => {
  let el, input, list, items = [], idx = 0, lastFocus;
  function build() {
    el = document.createElement('div');
    el.className = 'palette';
    el.innerHTML = `<div class="palette-box glass strong" role="dialog" aria-modal="true" aria-label="${esc(t('search_ph'))}">
      <div class="palette-in">${icon('search')}<input type="text" placeholder="${esc(t('pal_ph'))}" aria-label="${esc(t('pal_ph'))}" autocomplete="off" spellcheck="false"><span class="kbd">Esc</span></div>
      <div class="palette-list" role="listbox"></div>
      <div class="palette-foot"><span><span class="kbd">↑</span><span class="kbd">↓</span>${t('pal_nav')}</span><span><span class="kbd">↵</span>${t('pal_open')}</span><span><span class="kbd">Esc</span>${t('pal_close')}</span></div></div>`;
    document.body.append(el);
    input = $('input', el); list = $('.palette-list', el);
    input.oninput = render;
    input.onkeydown = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Enter') { e.preventDefault(); items[idx]?.go(); }
      else if (e.key === 'Escape') close();
    };
    el.onclick = e => { if (e.target === el) close(); };
  }
  function move(d) { idx = (idx + d + items.length) % Math.max(items.length, 1); paint(); }
  function paint() {
    $$('.palette-item', list).forEach((n, i) => n.classList.toggle('on', i === idx));
    $$('.palette-item', list)[idx]?.scrollIntoView({block: 'nearest'});
  }
  function render() {
    const q = input.value.trim(), url = extractUrl(q);
    items = []; let html = '';
    const add = (group, rows) => {
      if (!rows.length) return;
      html += `<div class="palette-group">${esc(group)}</div>`;
      for (const r of rows) { html += `<a class="palette-item" href="${esc(r.href)}" data-i="${items.length}">${r.tile}<div><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>${icon('arrowR')}</a>`; items.push(r); }
    };
    if (url && detectPlatform(url)) {
      add(t('pal_link'), toolsFor('url').map(x => ({tile: tile(x), title: L(x.name), sub: L(x.desc), href: `/${x.slug}`,
        go() { setHandoff({url}); location.href = `/${x.slug}`; }})));
    } else {
      add(t('pal_tools'), searchTools(q).map(x => ({tile: tile(x), title: L(x.name), sub: L(x.desc), href: `/${x.slug}`, go() { location.href = `/${x.slug}`; }})));
      if (!q) add(t('pal_pages'), PAGES().map(([href, title, ic]) => ({tile: `<span class="ti" style="--c:#3a3a58">${icon(ic)}</span>`, title, sub: href, href, go() { location.href = href; }})));
    }
    list.innerHTML = html || `<div class="palette-empty">${esc(t('pal_empty'))}</div>`;
    idx = 0; paint();
    $$('.palette-item', list).forEach(n => {
      n.onclick = e => { e.preventDefault(); items[+n.dataset.i].go(); };
      n.onmousemove = () => { if (idx !== +n.dataset.i) { idx = +n.dataset.i; paint(); } };
    });
  }
  function open(prefill = '') {
    if (!el) build();
    lastFocus = document.activeElement;
    input.value = prefill; render();
    el.classList.add('open');
    setTimeout(() => input.focus(), 30);
  }
  function close() { el?.classList.remove('open'); lastFocus?.focus?.(); }
  return {open, close, get isOpen() { return el?.classList.contains('open'); }};
})();

/* ─── footer ─── */
function footer() {
  const kofi = cfg('SUPPORT_URL', ''), socials = cfg('SOCIALS', []), affs = cfg('AFFILIATES', []).filter(a => a.url);
  const top = ['descargar', 'recortar', 'quitar-fondo', 'comprimir', 'vertical', 'fuentes'].map(s => TOOLS.find(x => x.slug === s)).filter(Boolean);
  $('#ftr').innerHTML = `<div class="wrap"><div class="ftr-card glass strong">
    <div class="ftr-top">
      <div class="ftr-brand"><a class="logo" href="/">${gem()}<span>Letebra <b>Tools</b></span></a><p>${esc(t('f_tag'))}</p>
        <div class="socials">${socials.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener me" aria-label="${esc(s.name)}" title="${esc(s.name)}">${socialIcon(s.id)}</a>`).join('')}</div>
        ${kofi ? `<a class="btn coffee sm" style="margin-top:18px" href="${esc(kofi)}" target="_blank" rel="noopener">${icon('coffee')}${esc(t('support_p'))}</a>` : ''}</div>
      <div><h5>${t('f_cats')}</h5><ul>${CATS.map(c => `<li><a href="/#cat-${c.id}">${esc(L(c.name))}</a></li>`).join('')}</ul></div>
      <div><h5>${t('f_top')}</h5><ul>${top.map(x => `<li><a href="/${x.slug}">${esc(L(x.name))}</a></li>`).join('')}</ul></div>
      <div><h5>${t('f_res')}</h5><ul><li><a href="/faq">${t('faq')}</a></li><li><a href="/novedades">${t('news')}</a></li><li><a href="/apoyar">${t('support_p')}</a></li><li><a href="/contacto">${t('contact')}</a></li></ul></div>
      <div><h5>${t('f_legal')}</h5><ul><li><a href="/aviso-legal">${t('legal_notice')}</a></li><li><a href="/privacidad">${t('privacy')}</a></li><li><a href="/cookies">${t('cookies')}</a></li><li><a href="/terminos">${t('terms')}</a></li></ul></div>
    </div>
    ${affs.length ? `<div class="setup"><div class="setup-title"><b>${t('setup_t')}</b><small>${esc(t('setup_s'))}</small></div>
      <div class="setup-items">${affs.map(a => `<a href="${esc(a.url)}" target="_blank" rel="sponsored noopener"><i>${esc(a.icon)}</i><span><b>${esc(a.name)}</b><small>${esc(lang === 'en' && a.desc_en ? a.desc_en : a.desc)}</small></span></a>`).join('')}</div></div>` : ''}
    <div class="ftr-bottom"><span>© ${new Date().getFullYear()} Letebra Tools · ${t('noads')}</span><span>${t('made')}</span></div>
  </div></div>`;
}

/* ─── ambient effects ─── */
function effects() {
  // specular highlight that follows the pointer on glass surfaces
  let raf = 0, last;
  addEventListener('pointermove', e => {
    last = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const g = last.target.closest?.('.glass');
      if (g) { const r = g.getBoundingClientRect(); g.style.setProperty('--mx', `${last.clientX - r.left}px`); g.style.setProperty('--my', `${last.clientY - r.top}px`); }
      if (halo) halo.style.transform = `translate(${last.clientX}px,${last.clientY}px)`;
    });
  }, {passive: true});
  let halo = null;
  if (finePointer && !reduced) {
    halo = Object.assign(document.createElement('div'), {className: 'halo on'});
    document.body.append(halo);
  }
  if (isChromium) $$('[data-refract]').forEach(n => n.classList.add('refract'));
  observeReveal();
  // keyboard: Ctrl/Cmd+K or "/" opens the palette
  addEventListener('keydown', e => {
    const typing = e.target.closest?.('input,textarea,select,[contenteditable]');
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); palette.isOpen ? palette.close() : palette.open(); }
    else if (e.key === '/' && !typing && !palette.isOpen) { e.preventDefault(); palette.open(); }
  });
}
let revealObs;
export function observeReveal(root = document) {
  revealObs ||= new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); } }), {rootMargin: '0px 0px -8% 0px'});
  $$('.reveal:not(.in)', root).forEach(n => revealObs.observe(n));
  if (isChromium) $$('[data-refract]:not(.refract)', root).forEach(n => n.classList.add('refract'));
  if (finePointer && !reduced) $$('[data-tilt]:not([data-tilted])', root).forEach(tilt);
}
function tilt(el) {
  el.dataset.tilted = '1';
  let r;
  el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); el.style.transition = 'transform .15s ease-out,box-shadow .5s'; });
  el.addEventListener('pointermove', e => {
    if (!r) return;
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
  });
  el.addEventListener('pointerleave', () => { el.style.transition = ''; el.style.transform = ''; r = null; });
}

export function initShell() {
  header();
  footer();
  effects();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const gc = cfg('GOATCOUNTER', '');
  if (gc) {
    const s = Object.assign(document.createElement('script'), {async: true, src: 'https://gc.zgo.at/count.js'});
    s.dataset.goatcounter = `https://${gc}.goatcounter.com/count`;
    document.head.append(s);
  }
}
