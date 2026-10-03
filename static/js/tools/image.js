// Compress / convert images in bulk: JPG, PNG, WebP, AVIF; quality; max width; one by one or ZIP.
import {$, $$, t, esc, addStrings, fmtBytes, saveBlob, loadJSZip, history, kofiNudge, takeHandoffFile} from '../core.js';
import {icon} from '../icons.js';
import {h, field, seg, bindSeg, rangeBind, kindOf} from './kit.js';

addStrings({
  es: {im_drop: 'Arrastra tus imágenes o haz clic', im_drop_s: 'Varias a la vez · PNG, JPG, WebP, AVIF, GIF…', im_fmt: 'Convertir a', im_same: 'Igual', im_q: 'Calidad', im_max: 'Ancho máximo',
    im_orig: 'Original', im_zip: 'Descargar todo (ZIP)', im_all: 'Descargar todas', im_clear: 'Vaciar', im_noavif: 'Tu navegador no puede crear AVIF; usa WebP (casi igual de ligero).',
    im_total: (a, b, p) => `${a} → ${b} (${p})`, im_png: 'PNG no tiene pérdida: la calidad no cambia el peso. Para que pese menos, usa WebP o JPG.'},
  en: {im_drop: 'Drag your images here or click', im_drop_s: 'Several at once · PNG, JPG, WebP, AVIF, GIF…', im_fmt: 'Convert to', im_same: 'Same', im_q: 'Quality', im_max: 'Max width',
    im_orig: 'Original', im_zip: 'Download all (ZIP)', im_all: 'Download all', im_clear: 'Clear', im_noavif: 'Your browser can\'t create AVIF; use WebP (almost as light).',
    im_total: (a, b, p) => `${a} → ${b} (${p})`, im_png: 'PNG is lossless: quality doesn\'t change the size. To make it lighter, use WebP or JPG.'},
});
export const howto = {
  es: [['Suelta tus imágenes', 'Todas las que quieras a la vez. No se suben a ningún sitio.'], ['Elige formato y calidad', 'WebP o AVIF pesan muchísimo menos que PNG o JPG.'], ['Descarga', 'Una a una o todas juntas en un ZIP.']],
  en: [['Drop your images', 'As many as you want. They\'re not uploaded anywhere.'], ['Pick format and quality', 'WebP or AVIF are far lighter than PNG or JPG.'], ['Download', 'One by one or all together in a ZIP.']],
};
const TYPES = {jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif'};
const EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif'};

export function mount(root, {tool, handoff}) {
  const el = h(`<div class="panel glass strong"><div class="stack">
    <label class="drop"><input type="file" accept="image/*" multiple>${icon('upload')}<b>${t('im_drop')}</b><small>${t('im_drop_s')}</small></label>
    <div class="grid3">${field(t('im_fmt'), seg('fmt', [['same', t('im_same')], ['jpg', 'JPG'], ['webp', 'WebP'], ['avif', 'AVIF'], ['png', 'PNG']], 'webp'))}
      ${field(t('im_q'), '<input type="range" class="range" min="0.3" max="1" step="0.01" value="0.8" data-q>', '<span class="opt-val" data-qv>80%</span>')}
      ${field(t('im_max'), `<select class="sel" data-max>${[['0', t('im_orig')], ['3840', '3840 px (4K)'], ['2560', '2560 px'], ['1920', '1920 px'], ['1280', '1280 px'], ['1080', '1080 px'], ['720', '720 px']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`)}</div>
    <small class="muted" data-note style="font-size:12.5px"></small>
    <div class="imglist"></div>
    <div class="row" data-actions hidden style="justify-content:space-between"><b data-total></b><div class="row"><button type="button" class="btn ghost sm" data-clear>${icon('trash')}${t('im_clear')}</button><button type="button" class="btn ghost" data-all>${icon('download')}${t('im_all')}</button><button type="button" class="btn primary" data-zip>${icon('download')}${t('im_zip')}</button></div></div>
  </div></div>`);
  root.append(el);
  const list = $('.imglist', el), items = [];
  let fmt = 'webp', q = .8, max = 0, seq = 0, timer;
  const getFmt = bindSeg(el, 'fmt', v => { fmt = v; schedule(); });
  rangeBind($('[data-q]', el), v => { q = v; $('[data-qv]', el).textContent = Math.round(v * 100) + '%'; schedule(); });
  $('[data-max]', el).onchange = e => { max = +e.target.value; schedule(); };

  function add(files) {
    for (const file of files) {
      if (kindOf(file) !== 'image') continue;
      const it = {file, url: URL.createObjectURL(file), out: null};
      it.row = h(`<div class="imgrow"><img src="${it.url}" alt=""><div class="grow"><b>${esc(file.name)}</b><small data-s>${fmtBytes(file.size)} → …</small></div>
        <button type="button" class="btn ghost icon sm" data-dl title="${t('k_again')}" aria-label="${t('k_again')}">${icon('download')}</button><button type="button" class="btn ghost icon sm" data-rm aria-label="✕">${icon('x')}</button></div>`);
      $('[data-dl]', it.row).onclick = () => it.out && saveBlob(it.out, outName(it));
      $('[data-rm]', it.row).onclick = () => { items.splice(items.indexOf(it), 1); it.row.remove(); totals(); };
      list.append(it.row);
      items.push(it);
      process(it, seq);
    }
    totals();
  }
  const outType = it => fmt === 'same' ? (TYPES[(it.file.type.split('/')[1] || '').replace('jpeg', 'jpg')] || 'image/png') : TYPES[fmt];
  const outName = it => it.file.name.replace(/\.[^.]+$/, '') + '.' + (EXT[it.out?.type] || 'png');
  async function process(it, my) {
    const bmp = await createImageBitmap(it.file);
    const s = max && bmp.width > max ? max / bmp.width : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const x = c.getContext('2d');
    const type = outType(it);
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.imageSmoothingQuality = 'high';
    x.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, type, q));
    if (my !== seq) return;
    it.out = blob;
    const diff = 1 - blob.size / it.file.size;
    $('[data-s]', it.row).innerHTML = `${fmtBytes(it.file.size)} → <b>${fmtBytes(blob.size)}</b> <span class="${diff > 0 ? 'saving' : ''}" style="${diff > 0 ? '' : 'color:#fca5a5'}">${diff > 0 ? '−' : '+'}${Math.abs(Math.round(diff * 100))}%</span> · ${c.width}×${c.height}${blob.type !== type ? ' · ' + (EXT[blob.type] || '').toUpperCase() : ''}`;
    totals();
  }
  function totals() {
    $('[data-actions]', el).hidden = !items.length;
    const a = items.reduce((s, i) => s + i.file.size, 0), b = items.reduce((s, i) => s + (i.out?.size || 0), 0);
    $('[data-total]', el).textContent = items.every(i => i.out) && items.length ? t('im_total', fmtBytes(a), fmtBytes(b), `${b < a ? '−' : '+'}${Math.abs(Math.round((1 - b / a) * 100))}%`) : '';
    const avifBad = fmt === 'avif' && items.some(i => i.out && i.out.type !== 'image/avif');
    $('[data-note]', el).textContent = avifBad ? t('im_noavif') : fmt === 'png' ? t('im_png') : '';
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { const my = ++seq; items.forEach(i => process(i, my)); totals(); }, 220); }

  const drop = $('.drop', el), inp = $('input', drop);
  inp.onchange = () => { add([...inp.files]); inp.value = ''; };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); add([...e.dataTransfer.files]); });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); add([...(e.dataTransfer?.files || [])]); });
  document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); add(f); } });
  $('[data-clear]', el).onclick = () => { items.splice(0).forEach(i => i.row.remove()); totals(); };
  $('[data-all]', el).onclick = () => { items.filter(i => i.out).forEach((i, n) => setTimeout(() => saveBlob(i.out, outName(i)), n * 250)); done(); };
  $('[data-zip]', el).onclick = async () => {
    const JSZip = await loadJSZip(), zip = new JSZip(), used = new Set();
    for (const i of items.filter(i => i.out)) { let n = outName(i), k = 2; while (used.has(n)) n = n.replace(/(\.\w+)$/, ` (${k++})$1`); used.add(n); zip.file(n, i.out); }
    saveBlob(await zip.generateAsync({type: 'blob'}), 'Letebra Tools - imagenes.zip');
    done();
  };
  function done() { history.add({tool: tool.id, title: `${items.length} ${items.length === 1 ? 'imagen' : 'imágenes'}`, detail: (getFmt() === 'same' ? '' : getFmt().toUpperCase())}); kofiNudge(); }
  if (handoff?.file) takeHandoffFile().then(f => f && add([f]));
}
