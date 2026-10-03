// Trim: keep a segment of a video/audio (link or file), with a frame timeline and 0.01 s handles.
import {t, addStrings} from '../core.js';
import {serverTool, rangePicker, qualityField} from './kit.js';

addStrings({
  es: {tr_go: 'Recortar', tr_need: 'Elige el trozo: el final tiene que ser mayor que el inicio.'},
  en: {tr_go: 'Trim', tr_need: 'Pick the part: the end must be after the start.'},
});
export const howto = {
  es: [['Sube o pega el vídeo', 'Un archivo de tu equipo o el enlace de TikTok, YouTube, Instagram…'], ['Marca el trozo', 'Arrastra los tiradores en la línea de tiempo o escribe los tiempos con centésimas.'], ['Descarga el recorte', 'Te llega en MP4 (o MP3 si era audio), listo para subir.']],
  en: [['Upload or paste the video', 'A file from your device or a TikTok, YouTube, Instagram… link.'], ['Mark the part', 'Drag the handles on the timeline or type the times with hundredths.'], ['Download the clip', 'You get an MP4 (or MP3 for audio), ready to post.']],
};
export const faq = {
  es: [['¿Pierde calidad al recortar?', 'Se vuelve a codificar con alta calidad para que el corte sea exacto al fotograma. Puedes elegir la calidad de salida.'], ['¿Hay un límite de duración?', 'No hay límite de duración; el archivo subido puede pesar hasta 500 MB.']],
  en: [['Does trimming lose quality?', 'It re-encodes at high quality so the cut is frame-accurate. You can choose the output quality.'], ['Is there a length limit?', 'No length limit; uploaded files can be up to 500 MB.']],
};

export function mount(root, ctx) {
  const rp = rangePicker();
  const qf = qualityField();
  serverTool(root, ctx, {
    go: t('tr_go'), ic: 'trim', options: [rp.el, qf.el],
    onSource: (src, why, mi) => { if (why !== 'uploaded') rp.setSource(src, mi.duration()); },
    body() {
      const {start, end, dur} = rp.get();
      if (!(end > start)) throw new Error(t('tr_need'));
      return {start: start || null, end: dur && end >= dur - .005 ? null : end, quality: qf.get()};
    },
  });
}
