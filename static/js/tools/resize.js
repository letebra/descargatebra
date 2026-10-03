// Resize for socials: presets (thumbnail, banner, post, story…), fit/fill/blur, drag to frame, PNG/JPG/WebP.
import {$, $$, t, L, esc, addStrings, store} from '../core.js';
import {h, field, seg, bindSeg, mediaInput, goButton, showResult, jobRunner, rangeBind} from './kit.js';

addStrings({
  es: {rs_go: 'Descargar imagen', rs_preset: 'Tamaño', rs_mode: 'Encaje', rs_fill: 'Rellenar', rs_fit: 'Ajustar', rs_blur: 'Fondo difuminado', rs_fmt: 'Formato', rs_q: 'Calidad',
    rs_bg: 'Color de fondo', rs_zoom: 'Zoom', rs_custom: 'Personalizado', rs_w: 'Ancho', rs_h: 'Alto', rs_drag: 'Arrastra la imagen para encuadrarla.'},
  en: {rs_go: 'Download image', rs_preset: 'Size', rs_mode: 'Fit', rs_fill: 'Fill', rs_fit: 'Fit', rs_blur: 'Blurred background', rs_fmt: 'Format', rs_q: 'Quality',
    rs_bg: 'Background color', rs_zoom: 'Zoom', rs_custom: 'Custom', rs_w: 'Width', rs_h: 'Height', rs_drag: 'Drag the image to frame it.'},
});
export const faq = {
  es: [['¿Qué medidas usa cada red?', 'Miniatura de YouTube 1280×720, banner 2560×1440, post de Instagram 1080×1080 o 1080×1350, historias, Reels y TikTok 1080×1920, banner de Twitch 1200×480 y cabecera de X 1500×500.']],
  en: [['What sizes does each network use?', 'YouTube thumbnail 1280×720, banner 2560×1440, Instagram post 1080×1080 or 1080×1350, stories, Reels and TikTok 1080×1920, Twitch banner 1200×480 and X header 1500×500.']],
};
const PRESETS = [
  ['yt', {es: 'Miniatura YouTube', en: 'YouTube thumbnail'}, 1280, 720], ['ytb', {es: 'Banner YouTube', en: 'YouTube banner'}, 2560, 1440],
  ['igs', {es: 'Post cuadrado', en: 'Square post'}, 1080, 1080], ['igp', {es: 'Post vertical (4:5)', en: 'Portrait post (4:5)'}, 1080, 1350],
  ['story', {es: 'Historia · Reel · TikTok', en: 'Story · Reel · TikTok'}, 1080, 1920], ['tw', {es: 'Banner Twitch', en: 'Twitch banner'}, 1200, 480],
  ['av', {es: 'Foto de perfil', en: 'Profile picture'}, 800, 800], ['x', {es: 'Cabecera X', en: 'X header'}, 1500, 500],
  ['og', {es: 'Vista previa de enlace', en: 'Link preview'}, 1200, 630], ['custom', {es: 'Personalizado', en: 'Custom'}, 1920, 1080],
];

export function mount(root, {tool, handoff}) {
  const jr = jobRunner(tool);
  let img = null, preset = store.get('lt_rs', 'yt'), W = 1280, H = 720, mode = 'fill', zoom = 1, ox = 0, oy = 0, bg = '#000000';
  const mi = mediaInput({modes: ['file'], kinds: ['image'], uploadFiles: false, onChange: async src => { img = src ? await createImageBitmap(src.file) : null; ox = oy = 0; draw(); }});
  const opts = h(`<div class="stack" style="gap:16px">
    ${field(t('rs_preset'), `<div class="presets">${PRESETS.map(([id, n, w, hh]) => `<button type="button" data-p="${id}"><b>${esc(L(n))}</b><small>${id === 'custom' ? '' : `${w} × ${hh}`}</small></button>`).join('')}</div>`)}
    <div class="grid2" data-custom hidden>${field(t('rs_w'), '<input class="inp" type="number" min="16" max="8000" data-w value="1920">')}${field(t('rs_h'), '<input class="inp" type="number" min="16" max="8000" data-h value="1080">')}</div>
    <div class="canvas-stage checker"><canvas></canvas></div>
    <small class="muted" style="font-size:12.5px;text-align:center" data-hint>${t('rs_drag')}</small>
    <div class="grid2">${field(t('rs_mode'), seg('mode', [['fill', t('rs_fill')], ['fit', t('rs_fit')], ['blur', t('rs_blur')]], 'fill'))}
      ${field(t('rs_zoom'), '<input type="range" class="range" min="1" max="3" step="0.01" value="1" data-zoom>')}
      ${field(t('rs_fmt'), seg('fmt', [['jpg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']], 'jpg'))}
      <div data-bgc>${field(t('rs_bg'), `<input type="color" class="wm-color" value="${bg}">`)}</div></div></div>`);
  const cv = $('canvas', opts), ctx = cv.getContext('2d');
  const go = goButton(t('rs_go'), 'download');
  const panel = h('<div class="panel glass strong"><div class="stack"></div></div>');
  $('.stack', panel).append(mi.el, opts, go);
  panel.append(jr.el);
  root.append(panel);

  function setPreset(id) {
    preset = id; store.set('lt_rs', id);
    const p = PRESETS.find(x => x[0] === id);
    $$('[data-p]', opts).forEach(b => b.classList.toggle('on', b.dataset.p === id));
    $('[data-custom]', opts).hidden = id !== 'custom';
    if (id === 'custom') { W = +$('[data-w]', opts).value || 1920; H = +$('[data-h]', opts).value || 1080; } else { W = p[2]; H = p[3]; }
    ox = oy = 0; draw();
  }
  $$('[data-p]', opts).forEach(b => b.onclick = () => setPreset(b.dataset.p));
  $$('[data-w],[data-h]', opts).forEach(i => i.oninput = () => setPreset('custom'));
  bindSeg(opts, 'mode', v => { mode = v; $('[data-bgc]', opts).hidden = v !== 'fit'; ox = oy = 0; draw(); });
  const getFmt = bindSeg(opts, 'fmt');
  rangeBind($('[data-zoom]', opts), v => { zoom = v; draw(); });
  $('[data-bgc] input', opts).oninput = e => { bg = e.target.value; draw(); };
  $('[data-bgc]', opts).hidden = true;

  // geometry of the main image inside W×H (fill = cover, fit = contain), plus zoom and pan
  function rect() {
    const s = (mode === 'fill' ? Math.max(W / img.width, H / img.height) : Math.min(W / img.width, H / img.height)) * zoom;
    const w = img.width * s, hh = img.height * s;
    const mx = Math.max(0, (w - W) / 2), my = Math.max(0, (hh - H) / 2);
    ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy));
    return [(W - w) / 2 + ox, (H - hh) / 2 + oy, w, hh];
  }
  function paint(c, x) {
    c.width = W; c.height = H;
    x.clearRect(0, 0, W, H);
    if (!img) { x.fillStyle = '#1b1b2e'; x.fillRect(0, 0, W, H); x.fillStyle = '#5c5c78'; x.font = `700 ${Math.round(H / 9)}px Inter,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${W} × ${H}`, W / 2, H / 2); return; }
    if (mode === 'fit') { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
    if (mode === 'blur') {
      const s = Math.max(W / img.width, H / img.height) * 1.1;
      x.filter = `blur(${Math.round(Math.max(W, H) / 40)}px) brightness(.8)`;
      x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      x.filter = 'none';
    }
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, ...rect());
  }
  function draw() { paint(cv, ctx); cv.style.aspectRatio = `${W}/${H}`; }

  cv.addEventListener('pointerdown', e => {
    if (!img) return;
    cv.setPointerCapture(e.pointerId);
    const k = W / cv.getBoundingClientRect().width;
    let lx = e.clientX, ly = e.clientY;
    const mv = ev => { ox += (ev.clientX - lx) * k; oy += (ev.clientY - ly) * k; lx = ev.clientX; ly = ev.clientY; draw(); };
    cv.addEventListener('pointermove', mv);
    cv.addEventListener('pointerup', () => cv.removeEventListener('pointermove', mv), {once: true});
  });

  go.onclick = async () => {
    const src = mi.get();
    if (!img) return jr.error(t('k_need_src'));
    const f = getFmt(), type = {jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp'}[f];
    const c = document.createElement('canvas');
    paint(c, c.getContext('2d'));
    const blob = await new Promise(ok => c.toBlob(ok, type, .92));
    const name = `${src.name.replace(/\.[^.]+$/, '')}-${W}x${H}.${f}`;
    showResult(jr.el, tool, {blob, name, type}, {saved: false, preview: false, entry: {title: name, detail: `${W}×${H}`}});
  };
  setPreset(preset);
  mi.intake(handoff);
}
