// QR generator: link, text, Wi-Fi, email or phone; brand colors / gradient, dot & corner styles, center logo, PNG or SVG.
import {$, $$, t, esc, addStrings, store, history, kofiNudge} from '../core.js';
import {icon} from '../icons.js';
import {h, field, seg, bindSeg, mediaInput, rangeBind} from './kit.js';

addStrings({
  es: {qr_type: 'Contenido', qr_url: 'Enlace', qr_text: 'Texto', qr_wifi: 'Wi-Fi', qr_mail: 'Email', qr_tel: 'Teléfono', qr_ssid: 'Nombre de la red', qr_pass: 'Contraseña', qr_sec: 'Seguridad',
    qr_to: 'Para', qr_subj: 'Asunto', qr_body: 'Mensaje', qr_dots: 'Estilo de puntos', qr_corners: 'Esquinas', qr_c1: 'Color', qr_c2: 'Segundo color', qr_grad: 'Degradado', qr_bg: 'Fondo',
    qr_transp: 'Fondo transparente', qr_logo: 'Logo en el centro (opcional)', qr_logo_s: 'Tamaño del logo', qr_png: 'Descargar PNG', qr_svg: 'Descargar SVG', qr_tip: 'Prueba siempre a escanearlo antes de imprimirlo, sobre todo con logo o colores claros.',
    qr_upl: 'Sube tu logo'},
  en: {qr_type: 'Content', qr_url: 'Link', qr_text: 'Text', qr_wifi: 'Wi-Fi', qr_mail: 'Email', qr_tel: 'Phone', qr_ssid: 'Network name', qr_pass: 'Password', qr_sec: 'Security',
    qr_to: 'To', qr_subj: 'Subject', qr_body: 'Message', qr_dots: 'Dot style', qr_corners: 'Corners', qr_c1: 'Color', qr_c2: 'Second color', qr_grad: 'Gradient', qr_bg: 'Background',
    qr_transp: 'Transparent background', qr_logo: 'Center logo (optional)', qr_logo_s: 'Logo size', qr_png: 'Download PNG', qr_svg: 'Download SVG', qr_tip: 'Always test-scan it before printing, especially with a logo or light colors.',
    qr_upl: 'Upload your logo'},
});
export const faq = {
  es: [['¿Caduca el QR?', 'No. Es un QR estático: el contenido va dentro del propio código y funciona para siempre.'], ['¿Puedo usarlo para mi negocio o merch?', 'Sí, libremente. En SVG lo puedes ampliar sin perder calidad para imprimir.']],
  en: [['Does the QR expire?', 'No. It\'s a static QR: the content is inside the code itself and works forever.'], ['Can I use it for my business or merch?', 'Yes, freely. As SVG you can scale it up for print without losing quality.']],
};
const wesc = s => String(s).replace(/([\\;,:"])/g, '\\$1');

export async function mount(root, {handoff}) {
  const s = {type: 'url', dots: 'rounded', corners: 'extra-rounded', c1: '#6d5efc', c2: '#ff5ca8', grad: true, bg: '#ffffff', transp: false, logoSize: .3, ...store.get('lt_qr', {})};
  const logo = mediaInput({modes: ['file'], kinds: ['image'], uploadFiles: false, paste: false, onChange: () => upd()});
  $('.drop b', logo.el).textContent = t('qr_upl');
  const el = h(`<div class="panel glass strong"><div class="tool-layout">
    <div class="stack">
      ${field(t('qr_type'), seg('type', [['url', t('qr_url')], ['text', t('qr_text')], ['wifi', t('qr_wifi')], ['mail', t('qr_mail')], ['tel', t('qr_tel')]], s.type))}
      <div data-f="url"><input class="inp" data-i="url" placeholder="https://…" value="https://tools.letebra.com"></div>
      <div data-f="text" hidden><textarea class="area" data-i="text" rows="3" style="min-height:90px"></textarea></div>
      <div data-f="wifi" class="grid3" hidden><input class="inp" data-i="ssid" placeholder="${t('qr_ssid')}"><input class="inp" data-i="pass" placeholder="${t('qr_pass')}"><select class="sel" data-i="sec"><option>WPA</option><option>WEP</option><option value="nopass">—</option></select></div>
      <div data-f="mail" class="stack" style="gap:10px" hidden><input class="inp" data-i="to" type="email" placeholder="${t('qr_to')}"><input class="inp" data-i="subj" placeholder="${t('qr_subj')}"><textarea class="area" data-i="body" rows="2" style="min-height:70px" placeholder="${t('qr_body')}"></textarea></div>
      <div data-f="tel" hidden><input class="inp" data-i="tel" type="tel" placeholder="+34 600 000 000"></div>
      ${field(t('qr_dots'), seg('dots', [['square', '■'], ['dots', '●'], ['rounded', '▢'], ['extra-rounded', '◯'], ['classy-rounded', '◆']], s.dots))}
      ${field(t('qr_corners'), seg('corners', [['square', '■'], ['extra-rounded', '▢'], ['dot', '●']], s.corners))}
      <div class="row" style="gap:18px"><label class="row" style="gap:8px"><input type="color" class="wm-color" data-c="c1" value="${s.c1}">${t('qr_c1')}</label>
        <label class="row" style="gap:8px" data-c2><input type="color" class="wm-color" data-c="c2" value="${s.c2}">${t('qr_c2')}</label>
        <label class="row" style="gap:8px"><input type="color" class="wm-color" data-c="bg" value="${s.bg}">${t('qr_bg')}</label></div>
      <div class="row" style="gap:22px"><label class="switch"><input type="checkbox" data-s="grad" ${s.grad ? 'checked' : ''}><span class="track"></span>${t('qr_grad')}</label>
        <label class="switch"><input type="checkbox" data-s="transp" ${s.transp ? 'checked' : ''}><span class="track"></span>${t('qr_transp')}</label></div>
      ${field(t('qr_logo'), '<div data-logo></div>')}
      ${field(t('qr_logo_s'), '<input type="range" class="range" min="0.15" max="0.45" step="0.01" data-ls>')}
    </div>
    <div class="stack"><div class="qr-stage ${s.transp ? 'checker' : ''}"></div>
      <div class="stack" style="gap:10px"><button type="button" class="btn primary block" data-dl="png">${icon('download')}${t('qr_png')}</button><button type="button" class="btn ghost block" data-dl="svg">${icon('download')}${t('qr_svg')}</button></div>
      <small class="muted" style="font-size:12.5px">${t('qr_tip')}</small></div></div></div>`);
  $('[data-logo]', el).append(logo.el);
  root.append(el);
  const QR = (await import('/vendor/qr.js')).default;
  const v = k => $(`[data-i=${k}]`, el).value;
  function data() {
    switch (s.type) {
      case 'text': return v('text');
      case 'wifi': return `WIFI:T:${v('sec')};S:${wesc(v('ssid'))};P:${wesc(v('pass'))};;`;
      case 'mail': return `mailto:${v('to')}?subject=${encodeURIComponent(v('subj'))}&body=${encodeURIComponent(v('body'))}`;
      case 'tel': return 'tel:' + v('tel').replace(/[^\d+]/g, '');
      default: return v('url');
    }
  }
  const opts = (size, type = 'canvas') => {
    const lg = logo.get();
    const color = s.grad ? {gradient: {type: 'linear', rotation: Math.PI / 4, colorStops: [{offset: 0, color: s.c1}, {offset: 1, color: s.c2}]}} : {color: s.c1};
    return {width: size, height: size, type, data: data() || ' ', margin: Math.round(size / 25), qrOptions: {errorCorrectionLevel: lg ? 'H' : 'M'},
      image: lg ? lg.objectURL : undefined, imageOptions: {crossOrigin: 'anonymous', margin: Math.round(size / 80), imageSize: s.logoSize, hideBackgroundDots: true},
      dotsOptions: {type: s.dots, ...color}, cornersSquareOptions: {type: s.corners, ...color}, cornersDotOptions: {type: s.corners === 'dot' ? 'dot' : 'square', ...color},
      backgroundOptions: {color: s.transp ? 'rgba(0,0,0,0)' : s.bg}};
  };
  const qr = new QR(opts(300));
  qr.append($('.qr-stage', el));
  let tm;
  function upd() {
    clearTimeout(tm);
    tm = setTimeout(() => {
      store.set('lt_qr', {type: s.type, dots: s.dots, corners: s.corners, c1: s.c1, c2: s.c2, grad: s.grad, bg: s.bg, transp: s.transp, logoSize: s.logoSize});
      $('[data-c2]', el).hidden = !s.grad;
      $('.qr-stage', el).classList.toggle('checker', s.transp);
      qr.update(opts(300));
    }, 120);
  }
  bindSeg(el, 'type', x => { s.type = x; $$('[data-f]', el).forEach(f => { f.hidden = f.dataset.f !== x; }); upd(); });
  bindSeg(el, 'dots', x => { s.dots = x; upd(); });
  bindSeg(el, 'corners', x => { s.corners = x; upd(); });
  $$('[data-i]', el).forEach(i => i.oninput = upd);
  $$('[data-c]', el).forEach(i => i.oninput = () => { s[i.dataset.c] = i.value; upd(); });
  $$('[data-s]', el).forEach(i => i.onchange = () => { s[i.dataset.s] = i.checked; upd(); });
  const ls = $('[data-ls]', el); ls.value = s.logoSize; rangeBind(ls, x => { s.logoSize = x; upd(); });
  $$('[data-f]', el).forEach(f => { f.hidden = f.dataset.f !== s.type; });
  $$('[data-dl]', el).forEach(b => b.onclick = async () => {
    const ext = b.dataset.dl, big = new QR(opts(ext === 'svg' ? 1000 : 1200, ext === 'svg' ? 'svg' : 'canvas'));
    await big.download({name: 'qr-letebra-tools', extension: ext});
    history.add({tool: 'qr', title: data().slice(0, 80), detail: ext.toUpperCase()});
    kofiNudge();
  });
  if (handoff?.text) { const isUrl = /^https?:\/\//.test(handoff.text.trim()); $(`[data-seg=type] [data-v=${isUrl ? 'url' : 'text'}]`, el).click(); $(`[data-i=${isUrl ? 'url' : 'text'}]`, el).value = handoff.text.trim(); }
  if (handoff?.url) $('[data-i=url]', el).value = handoff.url;
  upd();
}
