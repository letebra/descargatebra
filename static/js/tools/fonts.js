// Bio fonts: ~25 Unicode styles that work in Instagram, TikTok, X… bios and captions. Click to copy.
import {$, $$, t, esc, lang as LANG, addStrings, copyText, store} from '../core.js';
import {h} from './kit.js';

addStrings({
  es: {fo_ph: 'Escribe tu texto…', fo_def: 'Letebra Tools', fo_tip: 'Pulsa cualquier estilo para copiarlo y pégalo en tu bio o descripción.', fo_copy: 'Copiar'},
  en: {fo_ph: 'Type your text…', fo_def: 'Letebra Tools', fo_tip: 'Tap any style to copy it and paste it in your bio or caption.', fo_copy: 'Copy'},
});
export const howto = {
  es: [['Escribe tu texto', 'Tu nombre, tu frase, lo que quieras.'], ['Elige un estilo', 'Negrita, cursiva, gótica, burbujas, tachado…'], ['Pega donde quieras', 'Funciona en Instagram, TikTok, X, YouTube, Twitch y WhatsApp.']],
  en: [['Type your text', 'Your name, a phrase, anything.'], ['Pick a style', 'Bold, italic, gothic, bubbles, strikethrough…'], ['Paste anywhere', 'Works on Instagram, TikTok, X, YouTube, Twitch and WhatsApp.']],
};
export const faq = {
  es: [['¿Por qué algunas letras no cambian?', 'Unicode no tiene todas las letras en todos los estilos (por ejemplo, la ñ o los acentos). Se dejan como están para que se lean.'], ['¿Afecta al SEO o a la accesibilidad?', 'Los lectores de pantalla pueden leerlas raro. Úsalas para detalles, no para todo el texto.']],
  en: [['Why don\'t some letters change?', 'Unicode doesn\'t have every letter in every style (accents, for example). They\'re kept as is so they stay readable.'], ['Does it affect accessibility?', 'Screen readers may read them oddly. Use them for accents, not for all your text.']],
};

const A = 65, a = 97, Z0 = 48;
const run = (s, f) => Array.from(s).map(f).join('');
function math(up, low, dig, ex = {}) {
  return s => run(s, ch => {
    if (ex[ch]) return ex[ch];
    const c = ch.codePointAt(0);
    if (c >= A && c < A + 26 && up != null) return String.fromCodePoint(up + c - A);
    if (c >= a && c < a + 26 && low != null) return String.fromCodePoint(low + c - a);
    if (c >= Z0 && c < Z0 + 10 && dig != null) return String.fromCodePoint(dig + c - Z0);
    return ch;
  });
}
const table = (from, to) => s => run(s, ch => { const i = from.indexOf(ch); return i >= 0 ? Array.from(to)[i] : ch; });
const comb = mark => s => run(s, ch => ch === ' ' ? ch : ch + mark);
const ABC = 'abcdefghijklmnopqrstuvwxyz';
const upper = f => s => f(s.toUpperCase());
const flip = s => Array.from(table(ABC + ABC.toUpperCase() + '0123456789.,!?\'"()[]{}<>_&',
  'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz' + '∀ꓭƆꓷƎℲ⅁HIſꓘ˥WNOԀꝹꓤSꓕ∩ꓥMX⅄Z' + '0ƖᄅƐㄣϛ9ㄥ86˙\'¡¿,„)(][}{><‾⅋')(s)).reverse().join('');

const STYLES = [
  ['Negrita', 'Bold', math(0x1D400, 0x1D41A, 0x1D7CE)],
  ['Cursiva', 'Italic', math(0x1D434, 0x1D44E, null, {h: 'ℎ'})],
  ['Negrita cursiva', 'Bold italic', math(0x1D468, 0x1D482)],
  ['Sans negrita', 'Sans bold', math(0x1D5D4, 0x1D5EE, 0x1D7EC)],
  ['Sans cursiva', 'Sans italic', math(0x1D608, 0x1D622)],
  ['Sans negrita cursiva', 'Sans bold italic', math(0x1D63C, 0x1D656)],
  ['Sans', 'Sans', math(0x1D5A0, 0x1D5BA, 0x1D7E2)],
  ['Caligrafía', 'Script', math(0x1D49C, 0x1D4B6, null, {B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ'})],
  ['Caligrafía negrita', 'Bold script', math(0x1D4D0, 0x1D4EA)],
  ['Gótica', 'Gothic', math(0x1D504, 0x1D51E, null, {C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ'})],
  ['Gótica negrita', 'Bold gothic', math(0x1D56C, 0x1D586)],
  ['Doble trazo', 'Double-struck', math(0x1D538, 0x1D552, 0x1D7D8, {C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ'})],
  ['Máquina de escribir', 'Monospace', math(0x1D670, 0x1D68A, 0x1D7F6)],
  ['Burbujas', 'Bubbles', math(0x24B6, 0x24D0, null, {0: '⓪', 1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤', 6: '⑥', 7: '⑦', 8: '⑧', 9: '⑨'})],
  ['Burbujas negras', 'Black bubbles', upper(math(0x1F150, null, null, {0: '⓿', 1: '❶', 2: '❷', 3: '❸', 4: '❹', 5: '❺', 6: '❻', 7: '❼', 8: '❽', 9: '❾'}))],
  ['Cuadrados', 'Squares', upper(math(0x1F130))],
  ['Cuadrados negros', 'Black squares', upper(math(0x1F170))],
  ['Ancho completo', 'Wide', s => run(s, ch => { const c = ch.codePointAt(0); return c === 32 ? '　' : c > 32 && c < 127 ? String.fromCodePoint(c + 0xFEE0) : ch; })],
  ['Versalitas', 'Small caps', s => table(ABC, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ')(s.toLowerCase())],
  ['Al revés', 'Upside down', flip],
  ['Tachado', 'Strikethrough', comb('̶')],
  ['Subrayado', 'Underline', comb('̲')],
  ['Barra', 'Slashed', comb('̸')],
  ['Espaciado', 'Spaced', s => Array.from(s).join(' ')],
  ['Decorado', 'Fancy', s => `꧁༺ ${s} ༻꧂`],
  ['Destellos', 'Sparkles', s => `✦ ${math(0x1D5D4, 0x1D5EE, 0x1D7EC)(s)} ✦`],
  ['Corchetes', 'Brackets', s => `『${s}』`],
];

export function mount(root) {
  const el = h(`<div class="panel glass strong"><div class="stack">
    <textarea class="area" rows="2" style="min-height:90px;font-size:18px" maxlength="300" placeholder="${esc(t('fo_ph'))}"></textarea>
    <small class="muted" style="font-size:12.5px">${t('fo_tip')}</small>
    <div class="fontlist"></div></div></div>`);
  root.append(el);
  const ta = $('textarea', el), list = $('.fontlist', el);
  ta.value = store.get('lt_fonts', '') || t('fo_def');
  const lang = LANG === 'en' ? 1 : 0;
  function draw() {
    const s = ta.value || t('fo_def');
    store.set('lt_fonts', ta.value);
    list.innerHTML = STYLES.map(([es, en, f], i) => `<button type="button" class="fontitem" data-i="${i}" style="border:0;text-align:left;color:inherit;cursor:pointer"><div><small>${esc([es, en][lang])}</small><span>${esc(f(s))}</span></div><span class="cbtn" aria-hidden="true">⧉</span></button>`).join('');
    $$('[data-i]', list).forEach(b => b.onclick = () => { copyText(STYLES[+b.dataset.i][2](ta.value || t('fo_def'))); b.animate([{transform: 'scale(.97)'}, {transform: 'none'}], {duration: 220}); });
  }
  ta.oninput = draw;
  draw();
}
