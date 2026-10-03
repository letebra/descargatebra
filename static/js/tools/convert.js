// Convert: video/audio to MP4, MOV, WEBM, MKV, MP3, WAV or M4A.
import {$$, t, addStrings} from '../core.js';
import {h, field, serverTool} from './kit.js';

addStrings({
  es: {cv_go: f => `Convertir a ${f}`, cv_to: 'Convertir a', cv_v: 'Vídeo', cv_a: 'Solo audio',
    cv_mp4: 'El que funciona en todas partes', cv_mov: 'Para iPhone, Mac y Final Cut', cv_webm: 'Ligero, para la web', cv_mkv: 'Contenedor flexible',
    cv_mp3: 'El audio universal', cv_wav: 'Sin compresión, para editar', cv_m4a: 'AAC, pequeño y con buena calidad'},
  en: {cv_go: f => `Convert to ${f}`, cv_to: 'Convert to', cv_v: 'Video', cv_a: 'Audio only',
    cv_mp4: 'Plays everywhere', cv_mov: 'For iPhone, Mac and Final Cut', cv_webm: 'Lightweight, for the web', cv_mkv: 'Flexible container',
    cv_mp3: 'The universal audio', cv_wav: 'Uncompressed, for editing', cv_m4a: 'AAC, small and good quality'},
});
export const faq = {
  es: [['¿Puedo sacar el audio de un vídeo?', 'Sí: elige MP3, WAV o M4A y te llevas solo el sonido.'], ['¿Se pierde calidad?', 'Si el formato lo permite copiamos el vídeo tal cual, sin recodificar. Si no, se convierte con alta calidad.']],
  en: [['Can I extract the audio from a video?', 'Yes: pick MP3, WAV or M4A and you get just the sound.'], ['Does it lose quality?', 'When the format allows it we copy the video as is, without re-encoding. Otherwise it converts at high quality.']],
};

export function mount(root, ctx) {
  let to = 'mp4';
  const p = f => `<button type="button" data-v="${f}" class="${f === to ? 'on' : ''}"><b>${f.toUpperCase()}</b><small>${t('cv_' + f)}</small></button>`;
  const opts = h(`<div class="stack" style="gap:12px">${field(t('cv_v'), `<div class="presets">${['mp4', 'mov', 'webm', 'mkv'].map(p).join('')}</div>`)}${field(t('cv_a'), `<div class="presets">${['mp3', 'wav', 'm4a'].map(p).join('')}</div>`)}</div>`);
  let btn;
  $$('.presets button', opts).forEach(b => b.onclick = () => { to = b.dataset.v; $$('.presets button', opts).forEach(x => x.classList.toggle('on', x === b)); btn.querySelector('span').textContent = t('cv_go', to.toUpperCase()); });
  ({btn} = serverTool(root, ctx, {go: t('cv_go', 'MP4'), ic: 'convert', options: [opts], body: () => ({op: 'convert', to, quality: 'best'})}));
}
