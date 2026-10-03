// Safe zones: see what TikTok, Reels and Shorts cover on top of your 9:16 video or image.
import {$, $$, t, addStrings, saveBlob, history} from '../core.js';
import {icon} from '../icons.js';
import {h, field, seg, bindSeg, mediaInput} from './kit.js';

addStrings({
  es: {sz_net: 'Red social', sz_ui: 'Ver botones y textos', sz_png: 'Descargar plantilla PNG (1080×1920)', sz_tip: 'Lo que quede en rojo lo tapa la interfaz: no pongas ahí texto ni caras.',
    sz_note: 'Medidas aproximadas: cada app cambia un poco según el móvil y la versión.', sz_empty: 'Sube un vídeo o imagen vertical para verlo con la interfaz encima.'},
  en: {sz_net: 'Network', sz_ui: 'Show buttons and text', sz_png: 'Download PNG template (1080×1920)', sz_tip: 'Anything in red is covered by the interface: keep text and faces out of it.',
    sz_note: 'Approximate sizes: each app varies a little by phone and version.', sz_empty: 'Upload a vertical video or image to see it under the interface.'},
});
export const howto = {
  es: [['Sube tu vídeo o imagen', 'En vertical 9:16. No se sube a ningún sitio.'], ['Elige la red', 'TikTok, Reels o Shorts: cada una tapa zonas distintas.'], ['Ajusta tu diseño', 'Mueve textos y caras fuera de lo rojo. Descarga la plantilla para tu editor.']],
  en: [['Upload your video or image', 'Vertical 9:16. It isn\'t uploaded anywhere.'], ['Pick the network', 'TikTok, Reels or Shorts: each covers different areas.'], ['Adjust your design', 'Move text and faces out of the red. Download the template for your editor.']],
};
// unsafe margins on a 1080×1920 canvas: top, bottom, left, right
const NETS = {tiktok: ['TikTok', 150, 380, 60, 150], reels: ['Reels', 230, 440, 60, 140], shorts: ['Shorts', 140, 480, 60, 190]};

function overlay(net, ui) {
  const [, top, bottom, left, right] = NETS[net];
  const r = 'rgba(239,68,68,.32)';
  const icons = net === 'shorts' ? 5 : net === 'reels' ? 5 : 5;
  const ix = 1080 - right / 2, iy0 = 1920 - bottom - 40;
  return `<svg class="overlay" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <path fill="${r}" fill-rule="evenodd" d="M0 0h1080v1920H0z M${left} ${top}h${1080 - left - right}v${1920 - top - bottom}H${left}z"/>
    <rect x="${left}" y="${top}" width="${1080 - left - right}" height="${1920 - top - bottom}" fill="none" stroke="#22c55e" stroke-width="4" stroke-dasharray="18 12"/>
    ${ui ? `<g fill="rgba(255,255,255,.88)">
      ${net === 'tiktok' ? '<text x="540" y="98" text-anchor="middle" font-size="40" font-weight="700" font-family="Inter,sans-serif">Siguiendo   Para ti</text>' : net === 'reels' ? '<text x="60" y="120" font-size="52" font-weight="800" font-family="Inter,sans-serif">Reels</text><circle cx="1010" cy="105" r="26"/>' : '<circle cx="1010" cy="90" r="24"/><circle cx="930" cy="90" r="24"/>'}
      ${Array.from({length: icons}, (_, i) => `<circle cx="${ix}" cy="${iy0 - i * 150}" r="${i === icons - 1 && net === 'tiktok' ? 50 : 38}" opacity=".9"/>`).join('')}
      <circle cx="${left + 40}" cy="${1920 - bottom + 90}" r="34"/>
      <rect x="${left + 90}" y="${1920 - bottom + 70}" width="280" height="38" rx="19"/>
      <rect x="${left}" y="${1920 - bottom + 150}" width="${1080 - left - right - 60}" height="30" rx="15" opacity=".8"/>
      <rect x="${left}" y="${1920 - bottom + 200}" width="${(1080 - left - right) * .6}" height="30" rx="15" opacity=".6"/>
      ${net === 'shorts' ? `<rect x="0" y="1850" width="1080" height="70" fill="rgba(0,0,0,.55)"/>` : `<rect x="0" y="1810" width="1080" height="110" fill="rgba(0,0,0,.55)"/>`}
    </g>` : ''}</svg>`;
}

export function mount(root, {tool, handoff}) {
  let net = 'tiktok', ui = true;
  const mi = mediaInput({modes: ['file'], kinds: ['image', 'video'], uploadFiles: false, onChange: src => {
    const m = $('.sz-media', el);
    m.innerHTML = !src ? `<div class="sz-empty">${icon('safezones')}<span>${t('sz_empty')}</span></div>` : src.kind === 'video' ? `<video src="${src.objectURL}" autoplay muted loop playsinline></video>` : `<img src="${src.objectURL}" alt="">`;
  }});
  const el = h(`<div class="panel glass strong"><div class="tool-layout">
    <div class="sz-stage"><div class="sz-media"></div><div class="sz-ov"></div></div>
    <div class="stack"><div data-mi></div>${field(t('sz_net'), seg('net', Object.entries(NETS).map(([k, v]) => [k, v[0]]), net))}
      <label class="switch"><input type="checkbox" checked data-ui><span class="track"></span>${t('sz_ui')}</label>
      <div class="info-box" style="margin:0">${t('sz_tip')}</div><small class="muted" style="font-size:12px">${t('sz_note')}</small>
      <button type="button" class="btn ghost block" data-png>${icon('download')}${t('sz_png')}</button></div></div></div>`);
  $('[data-mi]', el).append(mi.el);
  root.append(el);
  const draw = () => { $('.sz-ov', el).innerHTML = overlay(net, ui); };
  bindSeg(el, 'net', v => { net = v; draw(); });
  $('[data-ui]', el).onchange = e => { ui = e.target.checked; draw(); };
  $('[data-png]', el).onclick = async () => {
    const svg = overlay(net, ui).replace('class="overlay" ', 'width="1080" height="1920" ');
    const im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await im.decode();
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    c.getContext('2d').drawImage(im, 0, 0);
    c.toBlob(b => { saveBlob(b, `zonas-seguras-${net}.png`); history.add({tool: tool.id, title: `${NETS[net][0]} 1080×1920`, detail: 'PNG'}); }, 'image/png');
  };
  mi.clear();
  draw();
  mi.intake(handoff);
}
