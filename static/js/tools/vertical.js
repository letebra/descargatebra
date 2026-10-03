// Vertical 9:16: horizontal video → TikTok/Reels/Shorts with blurred background, black bars or centered crop.
import {$, $$, t, esc, addStrings} from '../core.js';
import {h, field, serverTool, qualityField} from './kit.js';

addStrings({
  es: {vt_go: 'Pasar a vertical', vt_style: 'Fondo', vt_blur: 'Fondo difuminado', vt_black: 'Bandas negras', vt_crop: 'Recorte al centro',
    vt_blur_p: 'El vídeo entero sobre una copia ampliada y borrosa.', vt_black_p: 'El vídeo entero, con negro arriba y abajo.', vt_crop_p: 'Llena la pantalla cortando los lados.'},
  en: {vt_go: 'Make it vertical', vt_style: 'Background', vt_blur: 'Blurred background', vt_black: 'Black bars', vt_crop: 'Center crop',
    vt_blur_p: 'The whole video over a blurred, enlarged copy.', vt_black_p: 'The whole video with black above and below.', vt_crop_p: 'Fills the screen by cutting the sides.'},
});
export const faq = {
  es: [['¿Qué opción elijo?', 'El fondo difuminado es el más usado en TikTok y Reels: no se corta nada y no quedan bandas. El recorte al centro llena la pantalla pero pierdes los laterales.']],
  en: [['Which option should I pick?', 'Blurred background is the most used on TikTok and Reels: nothing is cut and there are no bars. Center crop fills the screen but you lose the sides.']],
};

export function mount(root, ctx) {
  let style = 'blur';
  const card = (v, ic) => `<button type="button" class="vt-card ${v === style ? 'on' : ''}" data-v="${v}"><span class="vt-ph vt-${v}"><i></i></span><b>${t('vt_' + v)}</b><small>${t('vt_' + v + '_p')}</small></button>`;
  const opts = h(`<div>${field(t('vt_style'), `<div class="vt-cards">${card('blur')}${card('black')}${card('crop')}</div>`)}</div>`);
  $$('.vt-card', opts).forEach(b => b.onclick = () => { style = b.dataset.v; $$('.vt-card', opts).forEach(x => x.classList.toggle('on', x === b)); });
  const qf = qualityField();
  const setThumb = url => $$('.vt-ph', opts).forEach(p => url ? p.style.setProperty('--img', `url("${esc(url)}")`) : p.style.removeProperty('--img'));
  serverTool(root, ctx, {
    kinds: ['video'], go: t('vt_go'), ic: 'vertical', options: [opts, qf.el],
    onSource: src => setThumb(src?.thumb || src?.info?.thumbnail || ''),
    body: () => ({vertical: style, quality: qf.get()}),
  });
}
