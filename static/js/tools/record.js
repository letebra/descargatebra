// Recorder: screen, camera or both (draggable round camera), mic + system audio, countdown, WebM → MP4 on the server.
import {$, $$, t, esc, addStrings, upload, fmtDur} from '../core.js';
import {icon} from '../icons.js';
import {h, field, seg, bindSeg, showResult, jobRunner} from './kit.js';

addStrings({
  es: {rc_mode: 'Qué grabar', rc_screen: 'Pantalla', rc_cam: 'Cámara', rc_both: 'Pantalla + cámara', rc_mic: 'Micrófono', rc_sys: 'Sonido del equipo', rc_count: 'Cuenta atrás',
    rc_start: 'Empezar a grabar', rc_stop: 'Parar', rc_pause: 'Pausa', rc_resume: 'Seguir', rc_mp4: 'Convertir a MP4', rc_idle: 'Elige qué grabar y pulsa Empezar.',
    rc_noscreen: 'Tu navegador no permite grabar la pantalla (en el móvil no suele estar disponible). Prueba en un ordenador con Chrome, Edge o Firefox.',
    rc_denied: 'No se dio permiso para grabar. Vuelve a intentarlo y acepta el aviso del navegador.', rc_drag: 'Arrastra la cámara para colocarla.',
    rc_tip: 'Para el sonido del equipo, al compartir marca "Compartir audio" (en Chrome, mejor compartiendo una pestaña o la pantalla completa).'},
  en: {rc_mode: 'What to record', rc_screen: 'Screen', rc_cam: 'Camera', rc_both: 'Screen + camera', rc_mic: 'Microphone', rc_sys: 'System sound', rc_count: 'Countdown',
    rc_start: 'Start recording', rc_stop: 'Stop', rc_pause: 'Pause', rc_resume: 'Resume', rc_mp4: 'Convert to MP4', rc_idle: 'Pick what to record and press Start.',
    rc_noscreen: 'Your browser can\'t record the screen (usually not available on phones). Try a computer with Chrome, Edge or Firefox.',
    rc_denied: 'Recording permission wasn\'t granted. Try again and accept the browser prompt.', rc_drag: 'Drag the camera to place it.',
    rc_tip: 'For system sound, tick "Share audio" when sharing (in Chrome, share a tab or the whole screen).'},
});
export const howto = {
  es: [['Elige qué grabar', 'Tu pantalla, tu cámara o las dos a la vez con la cámara en un círculo.'], ['Graba', 'Con cuenta atrás, micrófono y sonido del equipo. Sin instalar nada.'], ['Descarga', 'En WebM al momento, o conviértelo a MP4 con un clic.']],
  en: [['Pick what to record', 'Your screen, your camera, or both with the camera in a circle.'], ['Record', 'With countdown, mic and system sound. Nothing to install.'], ['Download', 'As WebM instantly, or convert it to MP4 in one click.']],
};
export const faq = {
  es: [['¿Se sube mi grabación?', 'No. Se graba y guarda en tu equipo. Solo se sube si pulsas "Convertir a MP4", y se borra del servidor en una hora.'], ['¿Hay límite de tiempo?', 'No, aunque grabaciones muy largas ocupan mucha memoria del navegador.']],
  en: [['Is my recording uploaded?', 'No. It\'s recorded and saved on your device. It\'s only uploaded if you press "Convert to MP4", and deleted from the server within an hour.'], ['Is there a time limit?', 'No, though very long recordings use a lot of browser memory.']],
};
const MIME = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

export function mount(root, {tool}) {
  const canScreen = !!navigator.mediaDevices?.getDisplayMedia;
  let mode = canScreen ? 'both' : 'cam';
  const el = h(`<div class="panel glass strong"><div class="tool-layout">
    <div class="stack" style="gap:10px"><div class="rec-stage"><canvas></canvas><div class="sz-empty" data-idle>${icon('record')}<span>${t('rc_idle')}</span></div></div><small class="muted" data-drag style="font-size:12.5px;text-align:center" hidden>${t('rc_drag')}</small></div>
    <div class="stack">${field(t('rc_mode'), seg('mode', [['screen', t('rc_screen')], ['cam', t('rc_cam')], ['both', t('rc_both')]], mode))}
      <label class="switch"><input type="checkbox" data-o="mic" checked><span class="track"></span>${t('rc_mic')}</label>
      <label class="switch"><input type="checkbox" data-o="sys" checked><span class="track"></span>${t('rc_sys')}</label>
      <label class="switch"><input type="checkbox" data-o="count" checked><span class="track"></span>${t('rc_count')}</label>
      <small class="muted" style="font-size:12px">${t('rc_tip')}</small>
      <div class="row" data-ctrl><button type="button" class="btn primary lg block sheen" data-start>${icon('record')}${t('rc_start')}</button></div>
      ${canScreen ? '' : `<div class="info-box" style="margin:0">${t('rc_noscreen')}</div>`}</div></div><div data-out></div></div>`);
  root.append(el);
  const cv = $('canvas', el), cx = cv.getContext('2d'), stage = $('.rec-stage', el), out = $('[data-out]', el);
  const jr = jobRunner(tool);
  bindSeg(el, 'mode', v => { mode = v; });
  if (!canScreen) $$('[data-seg=mode] button', el).forEach(b => { if (b.dataset.v !== 'cam') b.disabled = true; });
  const opt = k => $(`[data-o=${k}]`, el).checked;

  let streams = [], rec, chunks = [], ac, timer, ticker, t0 = 0, paused = 0, pauseAt = 0, bubble = {x: .82, y: .78, r: .16};
  const vScreen = document.createElement('video'), vCam = document.createElement('video');
  [vScreen, vCam].forEach(v => { v.muted = true; v.playsInline = true; });

  function draw() {
    const W = cv.width, H = cv.height;
    cx.fillStyle = '#05050b'; cx.fillRect(0, 0, W, H);
    if (mode !== 'cam' && vScreen.videoWidth) cx.drawImage(vScreen, 0, 0, W, H);
    if (mode !== 'screen' && vCam.videoWidth) {
      if (mode === 'cam') { const s = Math.max(W / vCam.videoWidth, H / vCam.videoHeight), w = vCam.videoWidth * s, hh = vCam.videoHeight * s; cx.drawImage(vCam, (W - w) / 2, (H - hh) / 2, w, hh); }
      else {
        const r = bubble.r * H, x = bubble.x * W, y = bubble.y * H, s = Math.min(vCam.videoWidth, vCam.videoHeight);
        cx.save(); cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.closePath(); cx.clip();
        cx.drawImage(vCam, (vCam.videoWidth - s) / 2, (vCam.videoHeight - s) / 2, s, s, x - r, y - r, r * 2, r * 2); cx.restore();
        cx.lineWidth = Math.max(3, H / 180); cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.stroke();
      }
    }
    if (rec && rec.state !== 'inactive') {
      const s = (performance.now() - t0 - paused - (rec.state === 'paused' ? performance.now() - pauseAt : 0)) / 1000;
      $('[data-time]', stage) && ($('[data-time]', stage).lastChild.textContent = ' ' + fmtDur(s));
    }
  }
  // a worker clock keeps drawing while you're in another tab or window (rAF would stop)
  const clock = () => { const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),33)'], {type: 'text/javascript'}))); w.onmessage = draw; return w; };

  cv.addEventListener('pointerdown', e => {
    if (mode !== 'both' || !streams.length) return;
    const r = cv.getBoundingClientRect();
    cv.setPointerCapture(e.pointerId);
    const mv = ev => { bubble.x = Math.max(.08, Math.min(.92, (ev.clientX - r.left) / r.width)); bubble.y = Math.max(.12, Math.min(.88, (ev.clientY - r.top) / r.height)); };
    mv(e);
    cv.addEventListener('pointermove', mv);
    cv.addEventListener('pointerup', () => cv.removeEventListener('pointermove', mv), {once: true});
  });

  function cleanup() {
    streams.forEach(s => s.getTracks().forEach(tr => tr.stop())); streams = [];
    ticker?.terminate(); ticker = null; clearInterval(timer);
    ac?.close(); ac = null;
    $('[data-time]', stage)?.remove();
    $('[data-drag]', el).hidden = true;
  }
  function controls(state) {
    const c = $('[data-ctrl]', el);
    c.innerHTML = state === 'idle' ? `<button type="button" class="btn primary lg block sheen" data-start>${icon('record')}${t('rc_start')}</button>`
      : `<button type="button" class="btn ghost" data-pause>${icon(state === 'paused' ? 'play' : 'pause')}${t(state === 'paused' ? 'rc_resume' : 'rc_pause')}</button><button type="button" class="btn danger" data-stop style="flex:1">${icon('x')}${t('rc_stop')}</button>`;
    $('[data-start]', c)?.addEventListener('click', start);
    $('[data-stop]', c)?.addEventListener('click', () => rec?.stop());
    $('[data-pause]', c)?.addEventListener('click', () => { if (rec.state === 'recording') { rec.pause(); pauseAt = performance.now(); controls('paused'); } else { rec.resume(); paused += performance.now() - pauseAt; controls('rec'); } });
  }

  async function start() {
    out.innerHTML = ''; jr.clear();
    let screen = null, cam = null, mic = null;
    try {
      if (mode !== 'cam') screen = await navigator.mediaDevices.getDisplayMedia({video: {frameRate: 30}, audio: opt('sys')});
      if (mode !== 'screen') cam = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
      if (opt('mic')) mic = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}).catch(() => null);
    } catch (e) {
      [screen, cam, mic].forEach(s => s?.getTracks().forEach(tr => tr.stop()));
      out.innerHTML = `<div class="err-box">${esc(mode !== 'cam' && !canScreen ? t('rc_noscreen') : t('rc_denied'))}</div>`;
      return;
    }
    streams = [screen, cam, mic].filter(Boolean);
    if (screen) { vScreen.srcObject = screen; await vScreen.play(); }
    if (cam) { vCam.srcObject = cam; await vCam.play(); }
    const ref = screen ? vScreen : vCam, sc = Math.min(1, 1920 / Math.max(ref.videoWidth, 1));
    cv.width = Math.round((ref.videoWidth || 1280) * sc / 2) * 2; cv.height = Math.round((ref.videoHeight || 720) * sc / 2) * 2;
    $('[data-idle]', el).hidden = true;
    $('[data-drag]', el).hidden = mode !== 'both';
    ticker = clock();
    // mix every audio source into one track
    ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    let audio = false;
    for (const s of streams) if (s.getAudioTracks().length) { ac.createMediaStreamSource(s).connect(dest); audio = true; }
    const tracks = [cv.captureStream(30).getVideoTracks()[0], ...(audio ? dest.stream.getAudioTracks() : [])];
    const mimeType = MIME.find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';
    rec = new MediaRecorder(new MediaStream(tracks), {mimeType, videoBitsPerSecond: 6e6});
    chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => finish(mimeType);
    screen?.getVideoTracks()[0].addEventListener('ended', () => rec.state !== 'inactive' && rec.stop());
    controls('rec');
    if (opt('count')) for (const n of [3, 2, 1]) { stage.insertAdjacentHTML('beforeend', `<div class="prompter-count" style="position:absolute;font-size:120px" data-cd>${n}</div>`); await new Promise(r => setTimeout(r, 900)); $('[data-cd]', stage)?.remove(); }
    stage.insertAdjacentHTML('beforeend', `<span class="rec-time" data-time><i class="rec-dot"></i> 0:00</span>`);
    t0 = performance.now(); paused = 0;
    rec.start(1000);
  }
  function finish(mimeType) {
    cleanup();
    controls('idle');
    const type = (mimeType || 'video/webm').split(';')[0], ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, {type});
    const d = new Date(), name = `Grabación ${d.toLocaleDateString('es').replace(/\//g, '-')} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${ext}`;
    const box = h('<div></div>');
    out.replaceChildren(box);
    showResult(box, tool, {blob, name, type}, {saved: false, entry: {title: name, detail: ext.toUpperCase()}});
    if (ext !== 'mp4') {
      const b = h(`<button type="button" class="btn ghost block" style="margin-top:12px">${icon('convert')}${t('rc_mp4')}</button>`);
      out.append(b, jr.el);
      b.onclick = async () => {
        b.disabled = true;
        jr.el.innerHTML = `<div class="progress"><div class="progress-top"><span>${t('k_uploading')}</span><span data-p></span></div><div class="bar"><i></i></div></div>`;
        try {
          const up = await upload(new File([blob], name, {type}), p => { const i = $('.bar i', jr.el); if (i) i.style.width = p * 100 + '%'; $('[data-p]', jr.el) && ($('[data-p]', jr.el).textContent = Math.round(p * 100) + '%'); });
          await jr.run({items: [{file_id: up.file_id, op: 'convert', to: 'mp4', quality: 'best'}]}, {entry: {title: name.replace('.webm', '.mp4'), detail: 'MP4'}});
        } catch (e) { jr.error(e.message); }
        b.disabled = false;
      };
    }
    $('[data-idle]', el).hidden = false;
    cx.clearRect(0, 0, cv.width, cv.height);
  }
}
