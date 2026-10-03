// Frame: pick the exact moment and save it as PNG/JPG (files: in the browser at full resolution; links: on the server).
import {$, t, addStrings, fmtTime, parseTime, esc} from '../core.js';
import {icon} from '../icons.js';
import {h, field, seg, bindSeg, mediaInput, jobRunner, goButton, showResult} from './kit.js';

addStrings({
  es: {fr_go: 'Guardar fotograma', fr_at: 'Momento', fr_fmt: 'Formato', fr_prev: 'Fotograma anterior', fr_next: 'Fotograma siguiente', fr_bad: 'Escribe el momento como 1:23.45 o en segundos.',
    fr_url: 'Escribe el momento exacto que quieres (m:ss.cc). Si subes el archivo, podrás buscarlo viendo el vídeo.'},
  en: {fr_go: 'Save frame', fr_at: 'Moment', fr_fmt: 'Format', fr_prev: 'Previous frame', fr_next: 'Next frame', fr_bad: 'Type the moment as 1:23.45 or in seconds.',
    fr_url: 'Type the exact moment you want (m:ss.cc). Upload the file to scrub through the video instead.'},
});
export const faq = {
  es: [['¿A qué resolución sale?', 'A la resolución original del vídeo. PNG sin pérdida o JPG más ligero.']],
  en: [['What resolution is it?', 'The video\'s original resolution. Lossless PNG or lighter JPG.']],
};

export function mount(root, {tool, handoff}) {
  const jr = jobRunner(tool);
  const mi = mediaInput({kinds: ['video'], uploadFiles: false, onChange: sync});
  const opts = h(`<div class="stack" style="gap:14px">
    <div class="media-stage" hidden><video playsinline preload="auto" muted></video></div>
    <img class="fr-thumb" alt="" referrerpolicy="no-referrer" style="max-height:300px;border-radius:16px;margin:0 auto" hidden>
    <div class="fr-scrub" hidden><input type="range" class="range" min="0" max="1" step="0.01" value="0"></div>
    <div class="grid2">${field(t('fr_at'), `<div class="row" style="flex-wrap:nowrap;gap:6px"><button type="button" class="btn ghost icon" data-step="-1" title="${t('fr_prev')}" aria-label="${t('fr_prev')}" style="transform:scaleX(-1)">${icon('chevR')}</button><input class="inp" data-at inputmode="decimal" value="0:00.00" style="text-align:center;font-weight:700"><button type="button" class="btn ghost icon" data-step="1" title="${t('fr_next')}" aria-label="${t('fr_next')}">${icon('chevR')}</button></div>`)}
      ${field(t('fr_fmt'), seg('img', [['png', 'PNG'], ['jpg', 'JPG']], 'png'))}</div>
    <small class="muted fr-hint" style="font-size:12.5px" hidden>${t('fr_url')}</small></div>`);
  const vid = $('video', opts), stage = $('.media-stage', opts), scrub = $('.fr-scrub', opts), range = $('.range', opts), at = $('[data-at]', opts), thumb = $('.fr-thumb', opts);
  const fmt = bindSeg(opts, 'img');
  const go = goButton(t('fr_go'), 'frame');
  const panel = h('<div class="panel glass strong"><div class="stack"></div></div>');
  $('.stack', panel).append(mi.el, opts, go);
  panel.append(jr.el);
  root.append(panel);
  const local = () => mi.get()?.type === 'file';
  const syncRange = () => range.style.setProperty('--p', (range.max > 0 ? range.value / range.max * 100 : 0) + '%');

  function sync(src) {
    stage.hidden = scrub.hidden = !(src?.type === 'file');
    $('.fr-hint', opts).hidden = src?.type !== 'url';
    thumb.hidden = !(src?.type === 'url' && src.info?.thumbnail);
    if (src?.type === 'url' && src.info?.thumbnail) thumb.src = src.info.thumbnail;
    if (src?.type === 'file' && vid.src !== src.objectURL) vid.src = src.objectURL;
  }
  vid.onloadedmetadata = () => { range.max = vid.duration || 1; range.value = 0; syncRange(); };
  vid.ontimeupdate = () => { if (document.activeElement !== at) at.value = fmtTime(vid.currentTime); range.value = vid.currentTime; syncRange(); };
  vid.onseeked = vid.ontimeupdate;
  range.oninput = () => { vid.currentTime = +range.value; syncRange(); };
  at.onchange = () => { const v = parseTime(at.value); if (v != null && !Number.isNaN(v) && local()) vid.currentTime = v; };
  $$step(opts).forEach(b => b.onclick = () => {
    const d = +b.dataset.step / 30;
    if (local()) vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + d));
    else { const v = Math.max(0, (parseTime(at.value) || 0) + d); at.value = fmtTime(v); }
  });

  go.onclick = async () => {
    const src = mi.get();
    if (!src) return jr.error(t('k_need_src'));
    const sec = parseTime(at.value);
    if (sec == null || Number.isNaN(sec)) return jr.error(t('fr_bad'));
    const f = fmt();
    if (src.type === 'file') {
      if (!vid.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = vid.videoWidth; c.height = vid.videoHeight;
      c.getContext('2d').drawImage(vid, 0, 0);
      const blob = await new Promise(ok => c.toBlob(ok, f === 'jpg' ? 'image/jpeg' : 'image/png', .95));
      const name = `${src.name.replace(/\.[^.]+$/, '')} ${vid.currentTime.toFixed(2)}s.${f}`;
      showResult(jr.el, tool, {blob, name, type: blob.type}, {saved: false, entry: {title: name}});
      return;
    }
    go.disabled = true;
    await jr.run({items: [{url: src.url, platform: src.platform, op: 'frame', at: sec, image: f, quality: 'best'}]}, {entry: {url: src.url, platform: src.platform, title: src.info?.title, thumb: src.info?.thumbnail || ''}});
    go.disabled = false;
  };
  mi.intake(handoff);
}
const $$step = root => [...root.querySelectorAll('[data-step]')];
