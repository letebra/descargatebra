// Audio: speed (0.50–2.00, in 0.01 steps), mute and loudness normalization.
import {$, $$, t, addStrings} from '../core.js';
import {h, field, serverTool, qualityField, syncRange} from './kit.js';

addStrings({
  es: {au_go: 'Aplicar', au_speed: 'Velocidad', au_mute: 'Quitar el sonido', au_norm: 'Normalizar volumen (−14 LUFS, como en redes)',
    au_need: 'Cambia la velocidad o activa alguna opción.', au_bad: 'La velocidad va de 0,50 a 2,00.'},
  en: {au_go: 'Apply', au_speed: 'Speed', au_mute: 'Remove the sound', au_norm: 'Normalize loudness (−14 LUFS, like socials)',
    au_need: 'Change the speed or turn on an option.', au_bad: 'Speed goes from 0.50 to 2.00.'},
});
export const faq = {
  es: [['¿Cambia el tono al acelerar?', 'No: la velocidad cambia sin que la voz suene aguda o grave.'], ['¿Qué hace normalizar?', 'Iguala el volumen al estándar de las redes para que no suene ni flojo ni saturado.']],
  en: [['Does the pitch change when speeding up?', 'No: speed changes without making voices sound high or low.'], ['What does normalize do?', 'It levels the loudness to the social media standard so it isn\'t too quiet or clipping.']],
};

export function mount(root, ctx) {
  const opts = h(`<div class="stack" style="gap:16px">
    ${field(t('au_speed'), `<input type="range" class="range" min="0.5" max="2" step="0.01" value="1"><div class="row" style="gap:8px"><input class="inp" id="au-n" inputmode="decimal" value="1.00" style="max-width:110px;text-align:center;font-weight:750"><span class="muted">×</span>
      ${['0.5', '0.75', '1', '1.25', '1.5', '2'].map(s => `<button type="button" class="chip" data-s="${s}">${s}×</button>`).join('')}</div>`)}
    <label class="switch"><input type="checkbox" id="au-mute"><span class="track"></span>${t('au_mute')}</label>
    <label class="switch"><input type="checkbox" id="au-norm"><span class="track"></span>${t('au_norm')}</label></div>`);
  const r = $('.range', opts), n = $('#au-n', opts);
  const set = v => { r.value = v; n.value = Number(v).toFixed(2); syncRange(r); $$('[data-s]', opts).forEach(c => c.classList.toggle('on', +c.dataset.s === +r.value)); };
  r.oninput = () => set(r.value);
  n.onchange = () => set(Math.min(2, Math.max(.5, parseFloat(n.value.replace(',', '.')) || 1)));
  $$('[data-s]', opts).forEach(c => c.onclick = () => set(c.dataset.s));
  set(1);
  const qf = qualityField();
  serverTool(root, ctx, {
    go: t('au_go'), ic: 'audio', options: [opts, qf.el],
    body() {
      const sp = Math.round(parseFloat(n.value.replace(',', '.')) * 100) / 100;
      if (!(sp >= .5 && sp <= 2)) throw new Error(t('au_bad'));
      const v = {speed: sp, mute: $('#au-mute', opts).checked, normalize: $('#au-norm', opts).checked, quality: qf.get()};
      if (sp === 1 && !v.mute && !v.normalize) throw new Error(t('au_need'));
      return v;
    },
  });
}
