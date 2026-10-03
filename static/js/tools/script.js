// Script duration: how long your script takes to read aloud (slow / normal / fast), per paragraph.
import {$, t, esc, lang, addStrings, store, setHandoff, fmtDur} from '../core.js';
import {icon} from '../icons.js';
import {h, seg, bindSeg} from './kit.js';

addStrings({
  es: {sc_ph: 'Pega aquí tu guion. Separa las partes con una línea en blanco para ver cuánto dura cada una.', sc_slow: 'Pausado', sc_normal: 'Normal', sc_fast: 'Rápido',
    sc_wpm: n => `${n} palabras/min`, sc_words: n => `${n} palabras`, sc_parts: 'Por partes', sc_tp: 'Abrir en el teleprompter', sc_lang: 'Idioma del guion', sc_total: 'Duración estimada',
    sc_fits: 'Cabe en', sc_part: n => `Parte ${n}`},
  en: {sc_ph: 'Paste your script here. Separate sections with a blank line to see how long each one takes.', sc_slow: 'Slow', sc_normal: 'Normal', sc_fast: 'Fast',
    sc_wpm: n => `${n} words/min`, sc_words: n => `${n} words`, sc_parts: 'By section', sc_tp: 'Open in the teleprompter', sc_lang: 'Script language', sc_total: 'Estimated length',
    sc_fits: 'Fits in', sc_part: n => `Part ${n}`},
});
export const faq = {
  es: [['¿Cómo se calcula?', 'Con la velocidad media de lectura en voz alta: unas 150 palabras por minuto en español y 160 en inglés. Pausado y rápido cubren cómo hablas tú.']],
  en: [['How is it calculated?', 'With the average reading-aloud speed: about 150 words per minute in Spanish and 160 in English. Slow and fast cover your own pace.']],
};
const WPM = {es: [130, 150, 170], en: [140, 160, 180]};
const LIMITS = [['Shorts', 60], ['TikTok', 600], ['Reels', 180], ['X', 140]];

export function mount(root, {handoff}) {
  let sl = lang === 'en' ? 'en' : 'es';
  const el = h(`<div class="panel glass strong"><div class="stack">
    <textarea class="area" rows="10" placeholder="${esc(t('sc_ph'))}"></textarea>
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:8px"><span class="muted" style="font-size:13px">${t('sc_lang')}</span>${seg('sl', [['es', 'ES'], ['en', 'EN']], sl)}</div>
      <button type="button" class="btn ghost" data-tp>${icon('teleprompter')}${t('sc_tp')}</button></div>
    <div class="grid3" data-speeds></div><div data-parts></div></div></div>`);
  root.append(el);
  const ta = $('textarea', el);
  bindSeg(el, 'sl', v => { sl = v; draw(); });
  const words = s => (s.trim().match(/\S+/g) || []).length;
  function draw() {
    const s = ta.value, n = words(s), [slow, norm, fast] = WPM[sl];
    store.set('lt_script', s);
    const dur = w => w / norm * 60;
    $('[data-speeds]', el).innerHTML = [['sc_slow', slow], ['sc_normal', norm], ['sc_fast', fast]].map(([k, w], i) =>
      `<div class="stat" style="${i === 1 ? 'background:var(--grad-soft);box-shadow:inset 0 0 0 1px rgba(177,92,255,.45)' : ''}"><span>${t(k)} · ${t('sc_wpm', w)}</span><b class="${i === 1 ? 'bigtime' : ''}" style="${i === 1 ? '' : 'font-size:30px'}">${fmtDur(n / w * 60) || '0:00'}</b><span>${t('sc_words', n)}</span></div>`).join('');
    const parts = s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const fits = LIMITS.filter(([, sec]) => dur(n) <= sec).map(([x]) => x);
    $('[data-parts]', el).innerHTML = (fits.length && n ? `<div class="info-box" style="margin:0 0 14px">${t('sc_fits')}: ${fits.join(' · ')}</div>` : '') + (parts.length > 1 ? `<h3 style="font-size:16px;margin-bottom:10px">${t('sc_parts')}</h3><div class="hist">${parts.map((p, i) =>
      `<div class="hitem"><span class="hph" style="font-weight:800">${i + 1}</span><div class="hinfo"><b>${esc(p.slice(0, 90))}</b><small>${t('sc_words', words(p))}</small></div><b style="font-variant-numeric:tabular-nums">${fmtDur(dur(words(p)))}</b></div>`).join('')}</div>` : '');
  }
  ta.oninput = draw;
  $('[data-tp]', el).onclick = () => { setHandoff({text: ta.value}); location.href = '/teleprompter'; };
  ta.value = handoff?.text || store.get('lt_script', '');
  draw();
}
