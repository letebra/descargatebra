// A tool page: breadcrumbs, title, the tool itself, how-to, FAQ and related tools.
import {$, t, L, lang, esc, addStrings, SITE, toolById, catById, toolsOfCat, TOOLS, favs, markRecent, takeHandoff} from './core.js';
import {icon} from './icons.js';
import {tile, observeReveal} from './shell.js';
import {toolCard, bindStars} from './shell.js';

addStrings({
  es: {tp_home: 'Inicio', tp_how: 'Cómo funciona', tp_faq: 'Preguntas frecuentes', tp_rel: 'También te puede servir',
    tp_fav: 'Añadir a favoritas', tp_err: 'No se pudo cargar la herramienta. Recarga la página.',
    tp_g1: 'Elige tu archivo o enlace', tp_g1p: 'Pega un enlace o arrastra tu archivo. También puedes pegar con Ctrl + V.',
    tp_g2: 'Ajusta las opciones', tp_g2p: 'Todo viene con valores por defecto pensados para redes. Cambia lo que quieras.',
    tp_g3: 'Descarga el resultado', tp_g3p: 'Se guarda en tu equipo al momento, y puedes seguir con otra herramienta.',
    tp_f1: '¿Es gratis de verdad?', tp_f1a: 'Sí. Sin límites, sin registro y sin anuncios. Se mantiene gracias a quien invita a un café.',
    tp_f2: '¿Qué pasa con mis archivos?', tp_f2a: 'Si la herramienta funciona en tu navegador, nunca salen de tu equipo. Si se procesa en el servidor, se borran automáticamente en una hora como máximo.'},
  en: {tp_home: 'Home', tp_how: 'How it works', tp_faq: 'FAQ', tp_rel: 'You may also like',
    tp_fav: 'Add to favorites', tp_err: 'The tool couldn\'t load. Reload the page.',
    tp_g1: 'Pick your file or link', tp_g1p: 'Paste a link or drop your file. Ctrl + V works too.',
    tp_g2: 'Adjust the options', tp_g2p: 'Defaults are tuned for social media. Change whatever you want.',
    tp_g3: 'Download the result', tp_g3p: 'It saves to your device instantly, and you can continue with another tool.',
    tp_f1: 'Is it really free?', tp_f1a: 'Yes. No limits, no sign-up and no ads. It\'s kept alive by people who buy a coffee.',
    tp_f2: 'What happens to my files?', tp_f2a: 'If the tool runs in your browser, they never leave your device. If it runs on the server, they\'re deleted automatically within an hour.'},
});

const heading = (tool, page) => {
  const p = SITE.platforms?.[page.platform];
  if (p) return lang === 'en' ? `Download ${p.name} videos` : `Descargar vídeos de ${p.name}`;
  return L(tool.h1) || L(tool.name);
};

export async function render(app, page) {
  const tool = toolById(page.tool);
  const cat = catById(tool.cat);
  markRecent(tool.id);
  app.innerHTML = `<div class="wrap">
    <nav class="crumbs" aria-label="breadcrumb"><a href="/">${t('tp_home')}</a>${icon('chevR')}<a href="/#cat-${cat.id}">${esc(L(cat.name))}</a>${icon('chevR')}<span>${esc(L(tool.name))}</span></nav>
    <header class="tool-hero">${tile(tool)}<div style="min-width:0"><h1>${esc(heading(tool, page))}</h1><p>${esc(L(tool.desc))}</p></div>
      <button class="btn icon star ${favs.has(tool.id) ? 'on' : ''}" data-fav="${tool.id}" title="${t('tp_fav')}" aria-label="${t('tp_fav')}" aria-pressed="${favs.has(tool.id)}">${icon('star')}</button></header>
    <div id="tool-root"></div>
    <section class="section" id="howto"></section>
    <section class="section faq" id="faq"></section>
    <section class="section"><div class="sec-head reveal"><h2 class="sec-title">${t('tp_rel')}</h2></div><div class="related" id="related"></div></section>
  </div>`;
  bindStars(app);

  const root = $('#tool-root');
  let mod;
  try {
    mod = await import(`./tools/${tool.id}.js`);
    await mod.mount(root, {tool, page, handoff: takeHandoff(), params: new URLSearchParams(location.search)});
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="err-box">${t('tp_err')}</div>`;
  }

  const steps = mod?.howto?.[lang] || mod?.howto?.es || [[t('tp_g1'), t('tp_g1p')], [t('tp_g2'), t('tp_g2p')], [t('tp_g3'), t('tp_g3p')]];
  $('#howto').innerHTML = `<div class="sec-head reveal"><h2 class="sec-title">${t('tp_how')}</h2></div>
    <div class="howto">${steps.map(([h, p], i) => `<div class="glass reveal" style="--d:${i * 80}ms"><b>${i + 1}</b><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}</div>`;
  const faq = [...(mod?.faq?.[lang] || mod?.faq?.es || []), [t('tp_f1'), t('tp_f1a')], [t('tp_f2'), t('tp_f2a')]];
  $('#faq').innerHTML = `<div class="sec-head reveal"><h2 class="sec-title">${t('tp_faq')}</h2></div>
    ${faq.map(([q, a]) => `<details class="glass reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}`;
  const same = toolsOfCat(tool.cat).filter(x => x.id !== tool.id);
  const rel = [...same, ...TOOLS.filter(x => x.id !== tool.id && !same.includes(x))].slice(0, 3);
  $('#related').innerHTML = rel.map((x, i) => toolCard(x, i * 70)).join('');
  bindStars($('#related'));
  observeReveal(app);
}
