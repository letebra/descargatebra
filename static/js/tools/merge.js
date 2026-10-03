// Merge: join 2–20 clips (links and/or files) in the order you set.
import {$, $$, t, esc, addStrings, upload, detectPlatform, extractUrl, fmtBytes} from '../core.js';
import {icon, platformIcon} from '../icons.js';
import {h, jobRunner, goButton, qualityField, kindOf} from './kit.js';

addStrings({
  es: {mg_go: n => `Unir ${n} clips`, mg_add_url: 'Añadir enlace', mg_add_file: 'Añadir archivos', mg_need: 'Añade al menos 2 clips.', mg_wait: 'Espera a que terminen de subirse los archivos.',
    mg_hint: 'Arrastra ⠿ para cambiar el orden. Puedes mezclar enlaces y archivos.', mg_up: 'Subir', mg_down: 'Bajar', mg_rm: 'Quitar', mg_bad: 'Hay un enlace que no es válido.', mg_max: 'Máximo 20 clips.'},
  en: {mg_go: n => `Merge ${n} clips`, mg_add_url: 'Add link', mg_add_file: 'Add files', mg_need: 'Add at least 2 clips.', mg_wait: 'Wait for the files to finish uploading.',
    mg_hint: 'Drag ⠿ to reorder. You can mix links and files.', mg_up: 'Move up', mg_down: 'Move down', mg_rm: 'Remove', mg_bad: 'One of the links isn\'t valid.', mg_max: '20 clips max.'},
});
export const howto = {
  es: [['Añade los clips', 'Pega enlaces o sube archivos (o ambos), hasta 20.'], ['Ordénalos', 'Arrastra cada fila a su sitio o usa las flechas.'], ['Une y descarga', 'Se ajustan al mismo tamaño y se unen en un solo MP4.']],
  en: [['Add the clips', 'Paste links or upload files (or both), up to 20.'], ['Order them', 'Drag each row into place or use the arrows.'], ['Merge and download', 'They\'re matched to the same size and joined into one MP4.']],
};
export const faq = {
  es: [['¿Y si los vídeos tienen tamaños distintos?', 'Se adaptan al formato del primero, sin deformarse (con bandas si hace falta).']],
  en: [['What if the videos have different sizes?', 'They adapt to the first one\'s format without stretching (with bars if needed).']],
};

export function mount(root, {tool, handoff}) {
  const el = h(`<div class="panel glass strong"><div class="stack">
    <div class="rows" id="mg-rows"></div>
    <div class="row"><button type="button" class="btn ghost sm" data-add-url>${icon('link')}${t('mg_add_url')}</button>
      <label class="btn ghost sm" style="position:relative">${icon('upload')}${t('mg_add_file')}<input type="file" accept="video/*,audio/*" multiple style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div>
    <small class="muted" style="font-size:12.5px">${t('mg_hint')}</small>
    <div id="mg-q"></div><div id="mg-go"></div></div></div>`);
  root.append(el);
  const rowsEl = $('#mg-rows', el), qf = qualityField(), go = goButton(t('mg_go', 2), 'merge'), jr = jobRunner(tool);
  $('#mg-q', el).append(qf.el); $('#mg-go', el).append(go); el.append(jr.el);
  const rows = () => [...rowsEl.children];

  function frame(inner) {
    const row = h(`<div class="lrow" draggable="false"><span class="handle" title="⠿">${icon('drag')}</span><span class="n"></span>${inner}
      <button type="button" class="btn ghost icon sm" data-up title="${t('mg_up')}" aria-label="${t('mg_up')}">${icon('arrowUp')}</button>
      <button type="button" class="btn ghost icon sm" data-down title="${t('mg_down')}" aria-label="${t('mg_down')}" style="transform:rotate(180deg)">${icon('arrowUp')}</button>
      <button type="button" class="btn ghost icon sm" data-rm title="${t('mg_rm')}" aria-label="${t('mg_rm')}">${icon('x')}</button></div>`);
    $('[data-up]', row).onclick = () => { row.previousElementSibling?.before(row); renumber(); };
    $('[data-down]', row).onclick = () => { row.nextElementSibling?.after(row); renumber(); };
    $('[data-rm]', row).onclick = () => { row.remove(); if (rows().length < 2) addUrl(); renumber(); };
    const hd = $('.handle', row);
    hd.onpointerdown = () => { row.draggable = true; };
    row.addEventListener('dragstart', e => { row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); row.draggable = false; renumber(); });
    rowsEl.append(row);
    renumber();
    return row;
  }
  rowsEl.addEventListener('dragover', e => {
    const drag = $('.dragging', rowsEl);
    if (!drag) return;
    e.preventDefault();
    const after = rows().filter(r => r !== drag).find(r => e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
    after ? after.before(drag) : rowsEl.append(drag);
  });
  function addUrl(v = '') {
    if (rows().length >= 20) return;
    const row = frame(`<label class="urlbox"><span class="pf">${icon('link')}</span><input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…"></label>`);
    const inp = $('input', row);
    const on = () => { const url = extractUrl(inp.value) || inp.value.trim(), p = detectPlatform(url); $('.pf', row).innerHTML = p ? platformIcon(p) : icon('link'); $('.urlbox', row).classList.toggle('bad', !!inp.value.trim() && !p); row.dataset.url = p ? url : ''; row.dataset.platform = p || ''; label(); };
    inp.oninput = on; inp.value = v; on();
    return row;
  }
  function addFile(file) {
    const kind = kindOf(file);
    if (!['video', 'audio'].includes(kind)) return;
    if (rows().length >= 20) return jr.error(t('mg_max'));
    const empty = rows().find(r => r.dataset.url === '' && !r.dataset.file && !$('input', r)?.value.trim());
    const row = frame(`<div class="filecard" style="flex:1;padding:8px 12px;min-width:0"><div class="meta"><b>${esc(file.name)}</b><small>${fmtBytes(file.size)} · <span class="up-t">${t('k_uploading')} 0%</span></small><div class="upbar"><i></i></div></div></div>`);
    if (empty) { empty.replaceWith(row); renumber(); }
    row.dataset.file = '1'; row.dataset.kind = kind;
    row.uploading = upload(file, p => { $('.upbar i', row).style.width = p * 100 + '%'; $('.up-t', row).textContent = `${t('k_uploading')} ${Math.round(p * 100)}%`; })
      .then(r => { row.dataset.fileId = r.file_id; $('.up-t', row).textContent = '✓ ' + t('k_uploaded'); $('.upbar', row).remove(); label(); },
        e => { $('.up-t', row).innerHTML = `<span style="color:#fca5a5">${esc(e.message)}</span>`; row.dataset.err = e.message; });
    row.uploading.catch(() => {});
    label();
  }
  function renumber() { rows().forEach((r, i) => { $('.n', r).textContent = i + 1; }); label(); }
  const filled = () => rows().filter(r => r.dataset.url || r.dataset.file);
  function label() { $('span', go).textContent = t('mg_go', Math.max(2, filled().length)); }

  $('[data-add-url]', el).onclick = () => $('input', addUrl()).focus();
  $('input[type=file]', el).onchange = e => { [...e.target.files].forEach(addFile); e.target.value = ''; };
  addEventListener('dragover', e => { if (!$('.dragging', rowsEl)) e.preventDefault(); });
  addEventListener('drop', e => { if ($('.dragging', rowsEl)) return; e.preventDefault(); [...(e.dataTransfer?.files || [])].forEach(addFile); });
  document.addEventListener('paste', e => {
    if (e.target.closest?.('input,textarea')) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); return files.forEach(addFile); }
    const url = extractUrl(e.clipboardData?.getData('text') || '');
    if (url && detectPlatform(url)) { e.preventDefault(); const empty = rows().find(r => !r.dataset.file && !$('input', r).value.trim()); empty ? ($('input', empty).value = url, $('input', empty).dispatchEvent(new Event('input'))) : addUrl(url); }
  });

  go.onclick = async () => {
    if (jr.isBusy()) return;
    const list = filled();
    if (rows().some(r => !r.dataset.file && $('input', r).value.trim() && !r.dataset.url)) return jr.error(t('mg_bad'));
    if (list.length < 2) return jr.error(t('mg_need'));
    if (list.some(r => r.dataset.err)) return jr.error(list.find(r => r.dataset.err).dataset.err);
    if (list.some(r => r.dataset.file && !r.dataset.fileId)) { jr.error(t('mg_wait')); await Promise.allSettled(list.map(r => r.uploading)); if (list.some(r => !r.dataset.url && !r.dataset.fileId)) return; }
    const audioOnly = list.every(r => r.dataset.kind === 'audio');
    const items = list.map(r => ({...(r.dataset.fileId ? {file_id: r.dataset.fileId} : {url: r.dataset.url, platform: r.dataset.platform}), format: audioOnly ? 'mp3' : 'mp4', quality: qf.get()}));
    go.disabled = true;
    await jr.run({items, merge: true}, {entry: {title: `${items.length} clips`}});
    go.disabled = false;
  };

  addUrl(); addUrl();
  if (handoff?.url) { $('input', rows()[0]).value = handoff.url; $('input', rows()[0]).dispatchEvent(new Event('input')); }
  if (handoff?.file) import('../core.js').then(async m => { const f = await m.takeHandoffFile(); if (f) addFile(f); });
}
