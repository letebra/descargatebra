// Teleprompter: fullscreen auto-scroll, speed, size, width, mirror, reading guide, countdown, keyboard shortcuts.
import {$, $$, t, esc, addStrings, store} from '../core.js';
import {icon} from '../icons.js';
import {h, field, rangeBind} from './kit.js';

addStrings({
  es: {tp_ph: 'Pega aquí tu guion…', tp_go: 'Empezar', tp_speed: 'Velocidad', tp_size: 'Tamaño de letra', tp_width: 'Ancho del texto', tp_mh: 'Espejo horizontal', tp_mv: 'Espejo vertical',
    tp_guide: 'Línea de lectura', tp_count: 'Cuenta atrás de 3 s', tp_keys: 'Teclas: espacio = pausa · ↑ ↓ velocidad · + − tamaño · Esc salir. En el móvil, toca para pausar.',
    tp_empty: 'Escribe o pega un guion primero.', tp_exit: 'Salir', tp_demo: 'Hola. Este es tu teleprompter.\n\nPega aquí tu guion, ajusta la velocidad y pulsa Empezar.\n\nMira a cámara y lee con calma.'},
  en: {tp_ph: 'Paste your script here…', tp_go: 'Start', tp_speed: 'Speed', tp_size: 'Font size', tp_width: 'Text width', tp_mh: 'Mirror horizontally', tp_mv: 'Mirror vertically',
    tp_guide: 'Reading line', tp_count: '3 s countdown', tp_keys: 'Keys: space = pause · ↑ ↓ speed · + − size · Esc exit. On phones, tap to pause.',
    tp_empty: 'Type or paste a script first.', tp_exit: 'Exit', tp_demo: 'Hi. This is your teleprompter.\n\nPaste your script here, set the speed and press Start.\n\nLook at the camera and read calmly.'},
});
export const howto = {
  es: [['Pega tu guion', 'Se guarda solo en este navegador para la próxima vez.'], ['Ajusta', 'Velocidad, tamaño, ancho y espejo si usas un cristal de teleprompter.'], ['Graba', 'Pantalla completa con cuenta atrás. Pausa con espacio o tocando.']],
  en: [['Paste your script', 'It\'s saved in this browser for next time.'], ['Adjust', 'Speed, size, width and mirror if you use teleprompter glass.'], ['Record', 'Fullscreen with countdown. Pause with space or a tap.']],
};

export function mount(root, {handoff}) {
  const cfg = {speed: 3, size: 54, width: 80, mh: false, mv: false, guide: true, count: true, ...store.get('lt_tp', {})};
  const el = h(`<div class="panel glass strong"><div class="stack">
    <textarea class="area" rows="9" placeholder="${esc(t('tp_ph'))}"></textarea>
    <div class="grid3">${field(t('tp_speed'), '<input type="range" class="range" min="1" max="10" step="0.5" data-k="speed">', '<span class="opt-val" data-v="speed"></span>')}
      ${field(t('tp_size'), '<input type="range" class="range" min="24" max="120" step="2" data-k="size">', '<span class="opt-val" data-v="size"></span>')}
      ${field(t('tp_width'), '<input type="range" class="range" min="40" max="100" step="5" data-k="width">', '<span class="opt-val" data-v="width"></span>')}</div>
    <div class="row" style="gap:22px">${['mh', 'mv', 'guide', 'count'].map(k => `<label class="switch"><input type="checkbox" data-c="${k}" ${cfg[k] ? 'checked' : ''}><span class="track"></span>${t('tp_' + k)}</label>`).join('')}</div>
    <button type="button" class="btn primary lg block sheen" data-go>${icon('play')}${t('tp_go')}</button>
    <small class="muted" style="font-size:12.5px;text-align:center">${t('tp_keys')}</small><div data-err></div></div></div>`);
  root.append(el);
  const ta = $('textarea', el);
  ta.value = handoff?.text || store.get('lt_script', '') || t('tp_demo');
  ta.oninput = () => store.set('lt_script', ta.value);
  const save = () => store.set('lt_tp', cfg);
  $$('[data-k]', el).forEach(r => { r.value = cfg[r.dataset.k]; rangeBind(r, v => { cfg[r.dataset.k] = v; $(`[data-v="${r.dataset.k}"]`, el).textContent = r.dataset.k === 'width' ? v + '%' : r.dataset.k === 'size' ? v + ' px' : v + '×'; save(); }); });
  $$('[data-c]', el).forEach(c => c.onchange = () => { cfg[c.dataset.c] = c.checked; save(); });

  const pr = h(`<div class="prompter" role="dialog" aria-modal="true"><div class="prompter-stage"><div class="prompter-guide"></div><div class="prompter-text"></div></div><div class="prompter-count"></div>
    <div class="prompter-bar glass strong"><button type="button" class="btn ghost icon sm" data-a="slow" aria-label="−">${icon('minus')}</button><button type="button" class="btn primary icon" data-a="play" aria-label="play">${icon('pause')}</button>
    <button type="button" class="btn ghost icon sm" data-a="fast" aria-label="+">${icon('plus')}</button><span class="opt-val" data-sp style="min-width:44px;text-align:center"></span>
    <button type="button" class="btn ghost sm" data-a="exit">${icon('x')}${t('tp_exit')}</button></div></div>`);
  document.body.append(pr);
  const txt = $('.prompter-text', pr), cnt = $('.prompter-count', pr);
  let y = 0, playing = false, raf = 0, last = 0, idle;
  const style = () => {
    txt.style.fontSize = cfg.size + 'px'; txt.style.width = cfg.width + '%';
    txt.style.transform = `translateX(-50%) translateY(${-y}px)`;
    $('.prompter-stage', pr).style.transform = `scale(${cfg.mh ? -1 : 1},${cfg.mv ? -1 : 1})`;
    $('.prompter-guide', pr).hidden = !cfg.guide;
    $('[data-sp]', pr).textContent = cfg.speed + '×';
    $('[data-a=play]', pr).innerHTML = icon(playing ? 'pause' : 'play');
  };
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (playing) { y += cfg.speed * 22 * dt * (cfg.size / 54); const max = txt.scrollHeight - innerHeight * .45; if (y >= max) { y = max; playing = false; } style(); }
    raf = requestAnimationFrame(tick);
  }
  async function start() {
    if (!ta.value.trim()) return ($('[data-err]', el).innerHTML = `<div class="err-box">${t('tp_empty')}</div>`);
    $('[data-err]', el).innerHTML = '';
    txt.textContent = ta.value;
    y = 0; playing = false;
    pr.classList.add('on');
    try { await pr.requestFullscreen?.(); } catch {}
    try { navigator.wakeLock?.request('screen'); } catch {}
    style();
    last = performance.now(); raf = requestAnimationFrame(tick);
    if (cfg.count) for (const n of [3, 2, 1]) { cnt.textContent = n; await new Promise(r => setTimeout(r, 900)); if (!pr.classList.contains('on')) return; }
    cnt.textContent = '';
    playing = true; style(); poke();
  }
  function exit() { playing = false; cancelAnimationFrame(raf); pr.classList.remove('on'); if (document.fullscreenElement) document.exitFullscreen?.(); }
  const poke = () => { pr.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => playing && pr.classList.add('idle'), 2200); };
  const speed = d => { cfg.speed = Math.max(.5, Math.min(10, cfg.speed + d)); save(); style(); };
  $('[data-go]', el).onclick = start;
  pr.addEventListener('pointermove', poke);
  pr.addEventListener('click', e => { if (e.target.closest('.prompter-bar')) return; playing = !playing; style(); poke(); });
  $$('[data-a]', pr).forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === 'exit') exit(); else if (a === 'play') { playing = !playing; style(); } else speed(a === 'fast' ? .5 : -.5); poke(); });
  addEventListener('keydown', e => {
    if (!pr.classList.contains('on')) return;
    if (e.key === ' ') { e.preventDefault(); playing = !playing; style(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); speed(.5); } else if (e.key === 'ArrowDown') { e.preventDefault(); speed(-.5); }
    else if (e.key === '+' || e.key === '=') { cfg.size = Math.min(140, cfg.size + 4); style(); } else if (e.key === '-') { cfg.size = Math.max(20, cfg.size - 4); style(); }
    else if (e.key === 'Escape') exit();
    poke();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && pr.classList.contains('on')) exit(); });
}
