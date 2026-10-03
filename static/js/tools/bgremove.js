// Remove background with AI, entirely in the browser (model downloaded once and cached).
import {$, $$, t, addStrings, esc} from '../core.js';
import {h, field, seg, bindSeg, mediaInput, goButton, showResult, jobRunner} from './kit.js';

addStrings({
  es: {bg_go: 'Quitar fondo', bg_dl: 'Descargar PNG', bg_model: 'Descargando la IA (solo la primera vez)…', bg_run: 'Recortando a la persona/objeto…', bg_bg: 'Fondo',
    bg_none: 'Transparente', bg_color: 'Color', bg_blur: 'Original difuminado', bg_fail: 'No se pudo procesar la imagen en este navegador. Prueba con Chrome o Edge actualizados.',
    bg_drag: 'Arrastra la barra para comparar antes / después.'},
  en: {bg_go: 'Remove background', bg_dl: 'Download PNG', bg_model: 'Downloading the AI (first time only)…', bg_run: 'Cutting out the subject…', bg_bg: 'Background',
    bg_none: 'Transparent', bg_color: 'Color', bg_blur: 'Blurred original', bg_fail: 'The image couldn\'t be processed in this browser. Try an up-to-date Chrome or Edge.',
    bg_drag: 'Drag the bar to compare before / after.'},
});
export const howto = {
  es: [['Sube la imagen', 'Una foto, un selfie, un producto… También puedes pegarla con Ctrl + V.'], ['La IA recorta', 'Funciona en tu navegador: tu foto no se sube a ningún sitio.'], ['Elige fondo y descarga', 'Transparente, de color o con el original difuminado.']],
  en: [['Upload the image', 'A photo, a selfie, a product… You can also paste it with Ctrl + V.'], ['The AI cuts it out', 'It runs in your browser: your photo isn\'t uploaded anywhere.'], ['Pick a background and download', 'Transparent, a color, or the original blurred.']],
};
export const faq = {
  es: [['¿Por qué tarda la primera vez?', 'Se descarga el modelo de IA (unos 40–80 MB). Después queda guardado y va mucho más rápido.'], ['¿Es privado?', 'Totalmente: todo ocurre en tu equipo.']],
  en: [['Why is the first time slower?', 'The AI model downloads (about 40–80 MB). Then it\'s cached and much faster.'], ['Is it private?', 'Completely: everything happens on your device.']],
};

let lib;
export function mount(root, {tool, handoff}) {
  const jr = jobRunner(tool);
  const mi = mediaInput({modes: ['file'], kinds: ['image'], uploadFiles: false, onChange: () => { cut = null; view.hidden = true; jr.clear(); }});
  const go = goButton(t('bg_go'), 'bgremove');
  const view = h(`<div class="stack" style="gap:14px" hidden>
    <div class="compare" style="--cut:50%"><img class="before" alt=""><div class="after"><img alt=""></div><span class="cut" role="slider" tabindex="0" aria-label="${t('bg_drag')}"></span></div>
    <small class="muted" style="font-size:12.5px;text-align:center">${t('bg_drag')}</small>
    <div class="grid2" style="align-items:end">${field(t('bg_bg'), seg('bg', [['none', t('bg_none')], ['color', t('bg_color')], ['blur', t('bg_blur')]], 'none'))}
      <div class="row" data-color hidden><input type="color" class="wm-color" value="#ffffff" aria-label="${t('bg_color')}"><div class="row" style="gap:6px">${['#ffffff', '#000000', '#6d5efc', '#ff5ca8', '#22c55e', '#f59e0b'].map(c => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div></div>
    <button type="button" class="btn primary lg block sheen" data-dl></button></div>`);
  const panel = h('<div class="panel glass strong"><div class="stack"></div></div>');
  $('.stack', panel).append(mi.el, go, view);
  panel.append(jr.el);
  root.append(panel);
  let cut = null, bgMode = 'none', color = '#ffffff', original = null;
  const cmp = $('.compare', view);
  const getBg = bindSeg(view, 'bg', v => { bgMode = v; $('[data-color]', view).hidden = v !== 'color'; compose(); });
  $('input[type=color]', view).oninput = e => { color = e.target.value; compose(); };
  $$('.sw', view).forEach(b => b.onclick = () => { color = b.dataset.c; $('input[type=color]', view).value = color; compose(); });

  async function compose(save) {
    if (!cut) return;
    const c = document.createElement('canvas');
    c.width = cut.width; c.height = cut.height;
    const x = c.getContext('2d');
    if (bgMode === 'color') { x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); }
    if (bgMode === 'blur') { x.filter = `blur(${Math.round(Math.max(c.width, c.height) / 60)}px)`; x.drawImage(original, -20, -20, c.width + 40, c.height + 40); x.filter = 'none'; }
    x.drawImage(cut, 0, 0);
    const type = bgMode === 'none' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(ok => c.toBlob(ok, type, .94));
    $('.after img', view).src = URL.createObjectURL(blob);
    $('[data-dl]', view).textContent = bgMode === 'none' ? t('bg_dl') : t('bg_dl').replace('PNG', 'JPG');
    $('[data-dl]', view).onclick = () => {
      const name = mi.get().name.replace(/\.[^.]+$/, '') + (bgMode === 'none' ? '-sin-fondo.png' : '-fondo.jpg');
      showResult(jr.el, tool, {blob, name, type}, {saved: false, preview: false, entry: {title: name}});
    };
  }

  go.onclick = async () => {
    const src = mi.get();
    if (!src) return jr.error(t('k_need_src'));
    go.disabled = true; view.hidden = true;
    jr.el.innerHTML = `<div class="progress"><div class="progress-top"><span class="pg-l">${t('bg_model')}</span><span class="pg-r"></span></div><div class="bar indet"><i></i></div></div>`;
    try {
      lib ||= await import('/vendor/bg-removal.js');
      const small = matchMedia('(pointer:coarse)').matches || (navigator.deviceMemory || 8) <= 4;
      const out = await lib.removeBackground(src.file, {
        model: small ? 'isnet_quint8' : 'isnet_fp16',
        progress: (key, cur, total) => {
          const fetching = String(key).startsWith('fetch');
          $('.pg-l', jr.el).textContent = fetching ? t('bg_model') : t('bg_run');
          const bar = $('.bar', jr.el);
          if (fetching && total) { bar.classList.remove('indet'); $('i', bar).style.width = Math.round(cur / total * 100) + '%'; $('.pg-r', jr.el).textContent = Math.round(cur / total * 100) + '%'; }
          else { bar.classList.add('indet'); $('.pg-r', jr.el).textContent = ''; }
        },
      });
      cut = await createImageBitmap(out);
      original = await createImageBitmap(src.file);
      $('.before', view).src = src.objectURL;
      jr.el.innerHTML = '';
      view.hidden = false;
      getBg();
      await compose();
    } catch (e) { console.error(e); jr.error(t('bg_fail')); }
    go.disabled = false;
  };

  // before/after slider
  const setCut = x => { const r = cmp.getBoundingClientRect(); cmp.style.setProperty('--cut', Math.max(0, Math.min(100, (x - r.left) / r.width * 100)) + '%'); };
  cmp.addEventListener('pointerdown', e => { cmp.setPointerCapture(e.pointerId); setCut(e.clientX); const mv = ev => setCut(ev.clientX); cmp.addEventListener('pointermove', mv); cmp.addEventListener('pointerup', () => cmp.removeEventListener('pointermove', mv), {once: true}); });
  $('.cut', view).addEventListener('keydown', e => { const v = parseFloat(getComputedStyle(cmp).getPropertyValue('--cut')) || 50; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') cmp.style.setProperty('--cut', Math.max(0, Math.min(100, v + (e.key === 'ArrowLeft' ? -5 : 5))) + '%'); });
  mi.intake(handoff);
}
