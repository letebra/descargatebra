// GIF: turn a clip (up to 30 s) into an optimized GIF.
import {t, addStrings} from '../core.js';
import {h, field, seg, bindSeg, serverTool, rangePicker} from './kit.js';

addStrings({
  es: {gf_go: 'Crear GIF', gf_fps: 'Fluidez (fotogramas por segundo)', gf_w: 'Ancho', gf_orig: 'Original', gf_need: 'Elige un trozo de hasta 30 segundos.', gf_tip: 'Consejo: 3–6 s a 480 px y 15 fps es lo ideal para chats y redes.'},
  en: {gf_go: 'Make GIF', gf_fps: 'Smoothness (frames per second)', gf_w: 'Width', gf_orig: 'Original', gf_need: 'Pick a part of up to 30 seconds.', gf_tip: 'Tip: 3–6 s at 480 px and 15 fps is ideal for chats and socials.'},
});
export const faq = {
  es: [['¿Por qué pesa tanto un GIF?', 'El formato GIF es antiguo y poco eficiente. Para que pese menos: menos segundos, menos ancho o menos fps.']],
  en: [['Why are GIFs so heavy?', 'GIF is an old, inefficient format. To make it lighter: fewer seconds, smaller width or fewer fps.']],
};

export function mount(root, ctx) {
  const rp = rangePicker({maxLen: 30, defLen: 5});
  const opts = h(`<div class="stack" style="gap:14px"><div class="grid2">${field(t('gf_fps'), seg('fps', [['10', '10'], ['15', '15'], ['20', '20'], ['25', '25']], '15'))}
    ${field(t('gf_w'), seg('w', [['320', '320'], ['480', '480'], ['640', '640'], ['0', t('gf_orig')]], '480'))}</div><small class="muted" style="font-size:12.5px">${t('gf_tip')}</small></div>`);
  const fps = bindSeg(opts, 'fps'), w = bindSeg(opts, 'w');
  serverTool(root, ctx, {
    kinds: ['video'], go: t('gf_go'), ic: 'gif', options: [rp.el, opts],
    onSource: (src, why, mi) => { if (why !== 'uploaded') rp.setSource(src, mi.duration()); },
    body() {
      const {start, end} = rp.get();
      if (!(end > start) || end - start > 30.001) throw new Error(t('gf_need'));
      return {op: 'gif', start, end, fps: +fps(), width: +w(), quality: '720'};
    },
  });
}
