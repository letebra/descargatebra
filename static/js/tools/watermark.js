// Watermark: your @ or your logo on a video, with a live preview you can drag (snaps to 9 positions).
import {$, $$, t, esc, addStrings, store} from '../core.js';
import {h, field, seg, bindSeg, serverTool, mediaInput, rangeBind, syncRange} from './kit.js';

addStrings({
  es: {wm_go: 'Poner marca de agua', wm_type: 'Tipo', wm_text: 'Texto', wm_logo: 'Logo (imagen)', wm_text_ph: '@tuusuario', wm_color: 'Color', wm_size: 'Tamaño', wm_op: 'Opacidad',
    wm_margin: 'Margen', wm_pos: 'Posición', wm_drag: 'Arrastra la marca en la vista previa o elige una casilla.', wm_need_t: 'Escribe el texto de la marca.', wm_need_i: 'Sube tu logo (PNG con transparencia queda mejor).',
    wm_up: 'Sube la imagen del logo'},
  en: {wm_go: 'Add watermark', wm_type: 'Type', wm_text: 'Text', wm_logo: 'Logo (image)', wm_text_ph: '@yourname', wm_color: 'Color', wm_size: 'Size', wm_op: 'Opacity',
    wm_margin: 'Margin', wm_pos: 'Position', wm_drag: 'Drag the mark on the preview or pick a cell.', wm_need_t: 'Type the watermark text.', wm_need_i: 'Upload your logo (a transparent PNG looks best).',
    wm_up: 'Upload the logo image'},
});
export const faq = {
  es: [['¿Puedo usar mi logo con transparencia?', 'Sí, sube un PNG con fondo transparente y se respeta. La opacidad la decides tú.']],
  en: [['Can I use a transparent logo?', 'Yes, upload a PNG with a transparent background and it\'s kept. You choose the opacity.']],
};
const POS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

export function mount(root, ctx) {
  const saved = store.get('lt_wm', {});
  const s = {type: 'text', text: saved.text || '', color: saved.color || '#ffffff', tsize: 5, isize: 18, op: .85, margin: 3, pos: saved.pos || 'br'};
  const logo = mediaInput({modes: ['file'], kinds: ['image'], paste: false, onChange: () => draw()});
  $('.drop b', logo.el).textContent = t('wm_up');
  const opts = h(`<div class="stack" style="gap:16px">
    <div class="wm-stage checker"><div class="wm-bg"></div><div class="wm-mark"></div></div>
    <small class="muted" style="font-size:12.5px;text-align:center">${t('wm_drag')}</small>
    ${field(t('wm_type'), seg('wt', [['text', t('wm_text')], ['image', t('wm_logo')]], 'text'))}
    <div data-for="text" class="grid2"><div class="opt"><input class="inp" data-k="text" maxlength="120" placeholder="${esc(t('wm_text_ph'))}" value="${esc(s.text)}"></div>
      <div class="row" style="flex-wrap:nowrap"><input type="color" data-k="color" value="${s.color}" class="wm-color" aria-label="${t('wm_color')}"><span class="muted">${t('wm_color')}</span></div></div>
    <div data-for="image" hidden></div>
    <div class="grid2">
      ${field(t('wm_size'), '<input type="range" class="range" data-r="size" min="1" max="40" step="0.5">', '<span class="opt-val" data-v="size"></span>')}
      ${field(t('wm_op'), '<input type="range" class="range" data-r="op" min="0.1" max="1" step="0.05">', '<span class="opt-val" data-v="op"></span>')}
      ${field(t('wm_margin'), '<input type="range" class="range" data-r="margin" min="0" max="15" step="0.5">', '<span class="opt-val" data-v="margin"></span>')}
      ${field(t('wm_pos'), `<div class="wm-grid">${POS.map(p => `<button type="button" data-p="${p}" aria-label="${p}"><i></i></button>`).join('')}</div>`)}
    </div></div>`);
  $('[data-for="image"]', opts).append(logo.el);
  const stage = $('.wm-stage', opts), bg = $('.wm-bg', opts), mark = $('.wm-mark', opts);
  const rSize = $('[data-r=size]', opts), rOp = $('[data-r=op]', opts), rMargin = $('[data-r=margin]', opts);
  let aspect = 16 / 9;

  bindSeg(opts, 'wt', v => { s.type = v; $('[data-for=text]', opts).hidden = v !== 'text'; $('[data-for=image]', opts).hidden = v !== 'image'; rSize.max = v === 'text' ? 20 : 60; rSize.value = v === 'text' ? s.tsize : s.isize; syncRange(rSize); draw(); });
  $('[data-k=text]', opts).oninput = e => { s.text = e.target.value; draw(); };
  $('[data-k=color]', opts).oninput = e => { s.color = e.target.value; draw(); };
  rSize.value = s.tsize; rOp.value = s.op; rMargin.value = s.margin;
  rangeBind(rSize, v => { s.type === 'text' ? s.tsize = v : s.isize = v; draw(); });
  rangeBind(rOp, v => { s.op = v; draw(); });
  rangeBind(rMargin, v => { s.margin = v; draw(); });
  $$('.wm-grid button', opts).forEach(b => b.onclick = () => { s.pos = b.dataset.p; draw(); });

  // the preview mirrors the server math: text size = % of height, logo width = % of width, margin = % of the short side
  function draw() {
    const W = stage.clientWidth || 600, H = W / aspect, m = Math.min(W, H) * s.margin / 100;
    stage.style.aspectRatio = aspect;
    $('[data-v=size]', opts).textContent = (s.type === 'text' ? s.tsize : s.isize) + '%';
    $('[data-v=op]', opts).textContent = Math.round(s.op * 100) + '%';
    $('[data-v=margin]', opts).textContent = s.margin + '%';
    $$('.wm-grid button', opts).forEach(b => b.classList.toggle('on', b.dataset.p === s.pos));
    const lg = logo.get();
    if (s.type === 'image') mark.innerHTML = lg ? `<img src="${lg.objectURL}" alt="" style="width:${W * s.isize / 100}px;display:block">` : '';
    else mark.innerHTML = `<span style="font-size:${Math.max(6, H * s.tsize / 100)}px;color:${s.color};text-shadow:${Math.max(1, H * s.tsize / 1800)}px ${Math.max(1, H * s.tsize / 1800)}px 0 rgba(0,0,0,.55)">${esc(s.text || t('wm_text_ph'))}</span>`;
    mark.style.opacity = s.op;
    const [v, hz] = s.pos;
    mark.style.left = hz === 'l' ? m + 'px' : hz === 'c' ? '50%' : 'auto';
    mark.style.right = hz === 'r' ? m + 'px' : 'auto';
    mark.style.top = v === 't' ? m + 'px' : v === 'm' ? '50%' : 'auto';
    mark.style.bottom = v === 'b' ? m + 'px' : 'auto';
    mark.style.transform = `translate(${hz === 'c' ? '-50%' : 0},${v === 'm' ? '-50%' : 0})`;
    store.set('lt_wm', {text: s.text, color: s.color, pos: s.pos});
  }
  mark.addEventListener('pointerdown', e => {
    e.preventDefault(); mark.setPointerCapture(e.pointerId);
    const r = stage.getBoundingClientRect(), mr = mark.getBoundingClientRect(), dx = e.clientX - mr.left, dy = e.clientY - mr.top;
    mark.classList.add('drag');
    const mv = ev => { mark.style.transform = 'none'; mark.style.right = mark.style.bottom = 'auto'; mark.style.left = (ev.clientX - r.left - dx) + 'px'; mark.style.top = (ev.clientY - r.top - dy) + 'px'; };
    mark.addEventListener('pointermove', mv);
    mark.addEventListener('pointerup', ev => {
      mark.removeEventListener('pointermove', mv); mark.classList.remove('drag');
      const b = mark.getBoundingClientRect(), cx = (b.left + b.width / 2 - r.left) / r.width, cy = (b.top + b.height / 2 - r.top) / r.height;
      s.pos = (cy < 1 / 3 ? 't' : cy < 2 / 3 ? 'm' : 'b') + (cx < 1 / 3 ? 'l' : cx < 2 / 3 ? 'c' : 'r');
      draw();
    }, {once: true});
  });
  new ResizeObserver(draw).observe(stage);

  serverTool(root, ctx, {
    kinds: ['video'], go: t('wm_go'), ic: 'watermark', options: [opts],
    onSource(src) {
      aspect = src?.width && src?.height ? src.width / src.height : 16 / 9;
      const img = src?.thumb || src?.info?.thumbnail;
      bg.innerHTML = src?.type === 'file' ? `<video src="${src.objectURL}" muted playsinline loop autoplay></video>` : img ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : '';
      draw();
    },
    async body() {
      const base = {op: 'watermark', wm_pos: s.pos, wm_opacity: s.op, wm_margin: s.margin, quality: '1080'};
      if (s.type === 'text') {
        if (!s.text.trim()) throw new Error(t('wm_need_t'));
        return {...base, wm_text: s.text.trim(), wm_color: s.color, wm_size: s.tsize};
      }
      if (!logo.get()) throw new Error(t('wm_need_i'));
      const lp = await logo.prepare();
      return {...base, wm_file: lp.file_id, wm_size: s.isize};
    },
  });
  draw();
}
