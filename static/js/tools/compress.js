// Compress: fit a video under a target size (Discord, WhatsApp, email…).
import {$, t, addStrings, fmtBytes} from '../core.js';
import {h, field, seg, bindSeg, serverTool} from './kit.js';

addStrings({
  es: {cp_go: 'Comprimir', cp_size: 'Tamaño máximo', cp_custom: 'Otro', cp_mb: 'MB', cp_need: 'Escribe un tamaño de al menos 1 MB.', cp_orig: s => `Tu archivo pesa ${s}.`,
    cp_small: 'Ya pesa menos que eso: no hace falta comprimirlo.'},
  en: {cp_go: 'Compress', cp_size: 'Max size', cp_custom: 'Other', cp_mb: 'MB', cp_need: 'Type a size of at least 1 MB.', cp_orig: s => `Your file is ${s}.`,
    cp_small: 'It\'s already smaller than that: no need to compress.'},
});
export const howto = {
  es: [['Elige el vídeo', 'Sube tu archivo o pega un enlace.'], ['Elige el tamaño', 'Discord (10 MB), WhatsApp (16 MB), email (25 MB) o el que quieras.'], ['Descarga', 'Ajustamos la calidad para que quepa sin pasarse.']],
  en: [['Pick the video', 'Upload your file or paste a link.'], ['Pick the size', 'Discord (10 MB), WhatsApp (16 MB), email (25 MB) or any size.'], ['Download', 'We tune the quality so it fits without going over.']],
};
export const faq = {
  es: [['¿Cuánto se puede reducir?', 'Depende de la duración: un vídeo largo en muy pocos MB pierde nitidez. Si no cabe ni a la mínima calidad, te avisamos para que lo recortes.']],
  en: [['How small can it get?', 'It depends on the length: a long video in very few MB loses sharpness. If it won\'t fit even at minimum quality, we tell you so you can trim it.']],
};

export function mount(root, ctx) {
  const opts = h(`<div class="stack" style="gap:10px">${field(t('cp_size'), seg('mb', [['10', '10 MB · Discord'], ['16', '16 MB · WhatsApp'], ['25', '25 MB · Email'], ['50', '50 MB'], ['custom', t('cp_custom')]], '10'))}
    <div class="row" id="cp-custom" hidden><input class="inp" type="number" min="1" max="4000" step="1" value="100" style="max-width:160px"><span class="muted">${t('cp_mb')}</span></div>
    <small class="muted" id="cp-info" style="font-size:13px"></small></div>`);
  const getMb = bindSeg(opts, 'mb', v => { $('#cp-custom', opts).hidden = v !== 'custom'; info(); });
  const target = () => getMb() === 'custom' ? parseFloat($('#cp-custom input', opts).value) : +getMb();
  let size = 0;
  const info = () => { $('#cp-info', opts).textContent = size ? t('cp_orig', fmtBytes(size)) + (size <= target() * 1e6 * .98 ? ' ' + t('cp_small') : '') : ''; };
  $('#cp-custom input', opts).oninput = info;
  serverTool(root, ctx, {
    go: t('cp_go'), ic: 'compress', options: [opts],
    onSource: src => { size = src?.type === 'file' ? src.size : 0; info(); },
    body() { const mb = target(); if (!(mb >= 1)) throw new Error(t('cp_need')); return {target_mb: mb}; },
  });
}
