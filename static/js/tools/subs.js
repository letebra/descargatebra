// Subtitles: list the languages of a video (uploaded or automatic/translated) and download the .srt.
import {$, t, lang, esc, addStrings, api, saveBlob, errText, history, kofiNudge} from '../core.js';
import {h, field, mediaInput, goButton} from './kit.js';

addStrings({
  es: {sb_go: 'Descargar .srt', sb_lang: 'Idioma', sb_wait: 'Primero pega un enlace', sb_loading: 'Buscando subtítulos…', sb_none: 'Este vídeo no tiene subtítulos',
    sb_up: 'Subidos por el autor', sb_auto: 'Automáticos y traducidos', sb_ok: 'Subtítulos descargados'},
  en: {sb_go: 'Download .srt', sb_lang: 'Language', sb_wait: 'Paste a link first', sb_loading: 'Looking for subtitles…', sb_none: 'This video has no subtitles',
    sb_up: 'Uploaded by the author', sb_auto: 'Automatic and translated', sb_ok: 'Subtitles downloaded'},
});
export const howto = {
  es: [['Pega el enlace', 'De YouTube sobre todo; también otras plataformas con subtítulos.'], ['Elige el idioma', 'Los originales o una traducción automática de YouTube.'], ['Descarga el .srt', 'Listo para tu editor, para traducirlo o para subirlo a otra red.']],
  en: [['Paste the link', 'Mostly YouTube; other platforms with subtitles too.'], ['Pick the language', 'The originals or a YouTube automatic translation.'], ['Download the .srt', 'Ready for your editor, to translate or to upload elsewhere.']],
};
export const faq = {
  es: [['¿Puedo bajarlos traducidos?', 'Sí: en "Automáticos y traducidos" YouTube ofrece casi cualquier idioma traducido automáticamente.']],
  en: [['Can I get them translated?', 'Yes: under "Automatic and translated" YouTube offers almost any language, machine-translated.']],
};

export function mount(root, {tool, handoff}) {
  const sel = h(`<select class="sel"><option value="" disabled selected>${t('sb_wait')}</option></select>`);
  const mi = mediaInput({modes: ['url'], onChange: (src, why) => { if (why === 'url') load(src); }, onPasteUrl: () => {}});
  const go = goButton(t('sb_go'), 'subs'), out = h('<div></div>');
  const panel = h('<div class="panel glass strong"><div class="stack"></div></div>');
  const f = h(field(t('sb_lang'), ''));
  f.append(sel);
  $('.stack', panel).append(mi.el, f, go);
  panel.append(out);
  root.append(panel);
  const opt = (v, txt, dis) => Object.assign(document.createElement('option'), {value: v, textContent: txt, disabled: !!dis});
  let seq = 0, timer;
  function load(src) {
    clearTimeout(timer);
    const s = ++seq;
    if (!src) return sel.replaceChildren(opt('', t('sb_wait'), true));
    sel.replaceChildren(opt('', t('sb_loading'), true));
    timer = setTimeout(async () => {
      try {
        const d = await api(`/api/subs?url=${encodeURIComponent(src.url)}&platform=${src.platform}`);
        if (s !== seq) return;
        if (!d.langs.length) return sel.replaceChildren(opt('', t('sb_none'), true));
        const groups = [['sb_up', false], ['sb_auto', true]].map(([k, auto]) => {
          const g = Object.assign(document.createElement('optgroup'), {label: t(k)});
          g.append(...d.langs.filter(l => l.auto === auto).map(l => opt(`${auto ? 1 : 0}:${l.code}`, `${l.name} (${l.code})`)));
          return g;
        }).filter(g => g.children.length);
        sel.replaceChildren(...groups);
        const pick = ['0:' + lang, '0:', '1:' + lang].map(p => [...sel.options].find(o => o.value === p || (p.endsWith(':') && o.value.startsWith(p)))).find(Boolean);
        if (pick) sel.value = pick.value;
      } catch (e) { if (s === seq) sel.replaceChildren(opt('', e.message, true)); }
    }, 300);
  }
  go.onclick = async () => {
    const src = mi.get();
    out.innerHTML = '';
    if (!src) return (out.innerHTML = `<div class="err-box">${esc(t('k_need_src'))}</div>`);
    if (!sel.value) return load(src);
    const [auto, code] = [sel.value[0] === '1', sel.value.slice(2)];
    go.disabled = true;
    try {
      const res = await fetch(`/api/subs/file?url=${encodeURIComponent(src.url)}&platform=${src.platform}&lang=${encodeURIComponent(code)}&auto=${auto}`);
      if (!res.ok) { let d; try { d = (await res.json()).detail; } catch {} throw new Error(errText(d)); }
      const m = (res.headers.get('Content-Disposition') || '').match(/filename\*=UTF-8''([^;]+)/i);
      saveBlob(await res.blob(), m ? decodeURIComponent(m[1]) : `subs.${code}.srt`);
      out.innerHTML = `<div class="info-box">✓ ${t('sb_ok')} (${esc(code)})</div>`;
      history.add({tool: tool.id, url: src.url, platform: src.platform, title: src.info?.title || src.url, thumb: src.info?.thumbnail || '', detail: 'SRT · ' + code});
      kofiNudge();
    } catch (e) { out.innerHTML = `<div class="err-box">${esc(e.message === 'Failed to fetch' ? t('e_offline') : e.message)}</div>`; }
    go.disabled = false;
  };
  mi.intake(handoff);
}
