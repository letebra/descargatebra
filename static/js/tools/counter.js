// Character counter with each network's limits (YouTube, Instagram, TikTok, X, Twitch).
import {$, t, esc, lang as LANG, addStrings, store, copyText} from '../core.js';
import {icon} from '../icons.js';
import {h} from './kit.js';

addStrings({
  es: {ct_ph: 'Pega o escribe tu texto: título, descripción, bio, caption…', ct_chars: 'caracteres', ct_nospace: 'sin espacios', ct_words: 'palabras', ct_lines: 'líneas',
    ct_tags: 'hashtags', ct_ments: 'menciones', ct_emoji: 'emojis', ct_limits: 'Límites por red', ct_left: n => n >= 0 ? `quedan ${n}` : `sobran ${-n}`, ct_copy: 'Copiar', ct_clear: 'Borrar',
    ct_note: 'X cuenta los enlaces como 23 caracteres y algunos emojis como 2: el contador es una guía.'},
  en: {ct_ph: 'Paste or type your text: title, description, bio, caption…', ct_chars: 'characters', ct_nospace: 'no spaces', ct_words: 'words', ct_lines: 'lines',
    ct_tags: 'hashtags', ct_ments: 'mentions', ct_emoji: 'emojis', ct_limits: 'Limits per network', ct_left: n => n >= 0 ? `${n} left` : `${-n} over`, ct_copy: 'Copy', ct_clear: 'Clear',
    ct_note: 'X counts links as 23 characters and some emojis as 2: treat this as a guide.'},
});
export const faq = {
  es: [['¿Cuántos caracteres tiene la bio de Instagram?', '150. El título de YouTube, 100; su descripción, 5000; el caption de Instagram, 2200; el de TikTok, 4000; un post de X, 280.']],
  en: [['How many characters is an Instagram bio?', '150. A YouTube title is 100; its description 5000; an Instagram caption 2200; TikTok 4000; an X post 280.']],
};
const LIMITS = [['YouTube · título', 'YouTube · title', 100], ['YouTube · descripción', 'YouTube · description', 5000], ['Instagram · bio', 'Instagram · bio', 150],
  ['Instagram · caption', 'Instagram · caption', 2200], ['Instagram · hashtags', 'Instagram · hashtags', 30, 'tags'], ['TikTok · caption', 'TikTok · caption', 4000],
  ['TikTok · bio', 'TikTok · bio', 80], ['X · post', 'X · post', 280], ['Twitch · bio', 'Twitch · bio', 300]];

export function mount(root, {handoff}) {
  const el = h(`<div class="panel glass strong"><div class="stack">
    <textarea class="area" rows="7" placeholder="${esc(t('ct_ph'))}"></textarea>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost sm" data-clear>${icon('trash')}${t('ct_clear')}</button><button type="button" class="btn ghost sm" data-copy>${icon('copy')}${t('ct_copy')}</button></div>
    <div class="stats"></div><h3 style="font-size:16px;margin-top:6px">${t('ct_limits')}</h3><div class="limits"></div><small class="muted" style="font-size:12px">${t('ct_note')}</small></div></div>`);
  root.append(el);
  const ta = $('textarea', el), en = LANG === 'en' ? 1 : 0;
  const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null;
  const graphemes = s => seg ? [...seg.segment(s)].length : Array.from(s).length;
  function draw() {
    const s = ta.value;
    store.set('lt_counter', s);
    const st = {chars: graphemes(s), nospace: graphemes(s.replace(/\s/g, '')), words: (s.trim().match(/\S+/g) || []).length, lines: s ? s.split('\n').length : 0,
      tags: (s.match(/#[\p{L}\p{N}_]+/gu) || []).length, ments: (s.match(/@[\w.]+/g) || []).length, emoji: (s.match(/\p{Extended_Pictographic}/gu) || []).length};
    $('.stats', el).innerHTML = ['chars', 'nospace', 'words', 'lines', 'tags', 'ments', 'emoji'].map(k => `<div class="stat"><b>${st[k]}</b><span>${t('ct_' + k)}</span></div>`).join('');
    $('.limits', el).innerHTML = LIMITS.map(([es, eng, max, key]) => {
      const n = key ? st[key] : st.chars, over = n > max;
      return `<div class="limit ${over ? 'over' : ''}"><div class="limit-top"><span>${esc([es, eng][en])}</span><span>${n}/${max} · ${t('ct_left', max - n)}</span></div><div class="bar"><i style="width:${Math.min(100, n / max * 100)}%"></i></div></div>`;
    }).join('');
  }
  ta.oninput = draw;
  $('[data-clear]', el).onclick = () => { ta.value = ''; draw(); ta.focus(); };
  $('[data-copy]', el).onclick = () => copyText(ta.value);
  ta.value = handoff?.text || store.get('lt_counter', '');
  draw();
}
