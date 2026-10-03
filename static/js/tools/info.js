// Info & thumbnail: title, description, tags, hashtags, stats and the HD thumbnail of a video.
import {$, $$, t, lang, esc, addStrings, api, nf, fmtDur, copyText, history} from '../core.js';
import {icon} from '../icons.js';
import {h, mediaInput, goButton} from './kit.js';

addStrings({
  es: {in_go: 'Ver datos', in_loading: 'Leyendo los datos…', in_thumb: 'Descargar miniatura HD', in_all: 'Copiar todo', in_copy: 'Copiar',
    md_title: 'Título', md_author: 'Autor', md_followers: 'Seguidores', md_date: 'Publicado', md_duration: 'Duración', md_views: 'Visualizaciones', md_likes: 'Me gusta',
    md_comments: 'Comentarios', md_reposts: 'Compartidos', md_res: 'Resolución', md_cat: 'Categoría', md_lang: 'Idioma', md_music: 'Música', md_age: 'Edad mínima', md_id: 'ID',
    md_url: 'Enlace', md_hashtags: 'Hashtags', md_tags: 'Etiquetas (tags)', md_desc: 'Descripción'},
  en: {in_go: 'Get info', in_loading: 'Reading the info…', in_thumb: 'Download HD thumbnail', in_all: 'Copy all', in_copy: 'Copy',
    md_title: 'Title', md_author: 'Author', md_followers: 'Followers', md_date: 'Published', md_duration: 'Duration', md_views: 'Views', md_likes: 'Likes',
    md_comments: 'Comments', md_reposts: 'Shares', md_res: 'Resolution', md_cat: 'Category', md_lang: 'Language', md_music: 'Music', md_age: 'Age limit', md_id: 'ID',
    md_url: 'Link', md_hashtags: 'Hashtags', md_tags: 'Tags', md_desc: 'Description'},
});
export const howto = {
  es: [['Pega el enlace', 'De YouTube, TikTok, Instagram, X…'], ['Mira los datos', 'Título, descripción, etiquetas, hashtags y estadísticas.'], ['Copia o descarga', 'Copia cada dato con un clic o baja la miniatura en HD.']],
  en: [['Paste the link', 'From YouTube, TikTok, Instagram, X…'], ['See the info', 'Title, description, tags, hashtags and stats.'], ['Copy or download', 'Copy any field with one click or grab the HD thumbnail.']],
};
export const faq = {
  es: [['¿Puedo ver las etiquetas ocultas de YouTube?', 'Sí, aparecen en "Etiquetas (tags)" y puedes copiarlas todas de una vez.']],
  en: [['Can I see YouTube\'s hidden tags?', 'Yes, they show under "Tags" and you can copy them all at once.']],
};

export function mount(root, {tool, handoff}) {
  const out = h('<div class="stack" style="gap:14px;margin-top:18px"></div>');
  const go = goButton(t('in_go'), 'info');
  const mi = mediaInput({modes: ['url'], preview: false, onPasteUrl: () => show()});
  const panel = h('<div class="panel glass strong"><div class="stack"></div></div>');
  $('.stack', panel).append(mi.el, go);
  panel.append(out);
  root.append(panel);

  async function show() {
    const src = mi.get();
    if (!src) return (out.innerHTML = `<div class="err-box">${esc(t('k_need_src'))}</div>`);
    out.innerHTML = `<div class="progress"><div class="progress-top"><span>${t('in_loading')}</span></div><div class="bar indet"><i></i></div></div>`;
    go.disabled = true;
    try { render(await api(`/api/meta?url=${encodeURIComponent(src.url)}&platform=${src.platform}`), src); }
    catch (e) { out.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
    go.disabled = false;
  }
  go.onclick = show;

  function render(d, src) {
    const rows = [['md_title', d.title], ['md_author', d.uploader], ['md_followers', nf(d.followers)], ['md_date', d.date ? new Date(d.date).toLocaleDateString(lang) : ''],
      ['md_duration', fmtDur(d.duration)], ['md_views', nf(d.views)], ['md_likes', nf(d.likes)], ['md_comments', nf(d.comments)], ['md_reposts', nf(d.reposts)],
      ['md_res', d.resolution], ['md_cat', (d.categories || []).join(', ')], ['md_lang', d.language], ['md_music', d.music], ['md_age', d.age_limit ? d.age_limit + '+' : ''],
      ['md_id', d.id], ['md_url', d.url]].filter(([, v]) => v);
    const tags = d.tags || [], hashtags = d.hashtags || [];
    const all = [...rows.map(([k, v]) => `${t(k)}: ${v}`), hashtags.length ? `${t('md_hashtags')}: ${hashtags.join(' ')}` : '',
      tags.length ? `${t('md_tags')}: ${tags.join(', ')}` : '', d.description ? `${t('md_desc')}:\n${d.description}` : ''].filter(Boolean).join('\n');
    const thumbHref = d.thumbnail_hd ? `/api/thumb?url=${encodeURIComponent(d.thumbnail_hd)}&name=${encodeURIComponent(d.title || 'miniatura')}` : '';
    const cb = (v) => `<button type="button" class="cbtn" data-c="${esc(v)}" title="${t('in_copy')}" aria-label="${t('in_copy')}">${icon('copy')}</button>`;
    const block = (k, text, body) => `<div class="sub-panel"><div class="opt-row" style="margin-bottom:10px"><b>${t(k)}</b><button type="button" class="btn ghost sm" data-c="${esc(text)}">${icon('copy')}${t('in_copy')}</button></div>${body}</div>`;
    out.innerHTML = `${d.thumbnail_hd ? `<div class="result-media" style="border-radius:18px"><img src="${esc(d.thumbnail_hd)}" alt="" referrerpolicy="no-referrer" style="width:100%;max-height:none"></div>` : ''}
      <div class="row">${thumbHref ? `<a class="btn primary" href="${thumbHref}">${icon('download')}${t('in_thumb')}</a>` : ''}<button type="button" class="btn ghost" data-all>${icon('copy')}${t('in_all')}</button></div>
      <div class="sub-panel"><dl class="mrows">${rows.map(([k, v]) => `<dt>${t(k)}</dt><dd>${k === 'md_url' || (k === 'md_author' && d.uploader_url) ? `<a href="${esc(k === 'md_url' ? v : d.uploader_url)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)}</dd>${cb(v)}`).join('')}</dl></div>
      ${hashtags.length ? block('md_hashtags', hashtags.join(' '), `<div class="chips">${hashtags.map(x => `<span>${esc(x)}</span>`).join('')}</div>`) : ''}
      ${tags.length ? block('md_tags', tags.join(', '), `<div class="chips">${tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>`) : ''}
      ${d.description ? block('md_desc', d.description, `<div class="desc-box">${esc(d.description)}</div>`) : ''}`;
    const img = $('img', out);
    if (img) img.onerror = () => { if (d.thumbnail && img.src !== d.thumbnail) img.src = d.thumbnail; else img.parentElement.remove(); };
    $$('[data-c]', out).forEach(b => b.onclick = () => copyText(b.dataset.c));
    $('[data-all]', out).onclick = () => copyText(all);
    history.add({tool: tool.id, url: src.url, platform: src.platform, title: d.title || src.url, thumb: d.thumbnail || '', detail: d.uploader || ''});
  }
  mi.intake(handoff).then(ok => ok && show());
}
