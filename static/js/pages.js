// Content pages: FAQ, contact, support, changelog, legal notice, privacy, cookies, terms and 404.
import {$, $$, t, lang, esc, addStrings, cfg, copyText, toolById, TOOLS} from './core.js';
import {icon, socialIcon} from './icons.js';
import {palette, observeReveal} from './shell.js';
import {toolCard, bindStars} from './lobby.js';

addStrings({
  es: {pg_home: 'Inicio', pg_updated: 'Última actualización: octubre de 2026', pg_copy: 'Copiar', pg_write: 'Escribir un correo', pg_search: 'Buscar una herramienta', pg_popular: 'Las más usadas'},
  en: {pg_home: 'Home', pg_updated: 'Last updated: October 2026', pg_copy: 'Copy', pg_write: 'Write an email', pg_search: 'Search a tool', pg_popular: 'Most used'},
});

const MAIL = () => cfg('CONTACT_EMAIL', 'contacto@letebra.com');
const KOFI = () => cfg('SUPPORT_URL', '');
const P = (...x) => x.map(p => `<p>${p}</p>`).join('');
const UL = (...x) => `<ul>${x.map(i => `<li>${i}</li>`).join('')}</ul>`;
const mail = () => `<a href="mailto:${esc(MAIL())}">${esc(MAIL())}</a>`;

const FAQ = {
  es: [
    ['¿Letebra Tools es gratis?', 'Sí, todo. Sin límites de uso, sin registro y sin versiones "premium". Se mantiene gracias a quienes invitan a un café en Ko-fi.'],
    ['¿Por qué no hay anuncios?', 'Porque las webs de herramientas suelen estar llenas de pop-ups, redirecciones y botones falsos. Aquí no: prefiero que sea cómoda y que la apoye quien quiera.'],
    ['¿Necesito crear una cuenta?', 'No. Entras, usas la herramienta y te vas. Tus favoritas, recientes e historial se guardan solo en tu navegador.'],
    ['¿Qué pasa con mis archivos?', 'Las herramientas marcadas "en tu navegador" (imagen, texto, grabador, QR…) no suben nada. Las de vídeo procesan en el servidor y los archivos se borran automáticamente en una hora como máximo.'],
    ['¿De qué plataformas puedo descargar?', 'Instagram, TikTok, YouTube, YouTube Shorts, X (Twitter), Facebook, Twitch, Reddit y Pinterest. Incluye carruseles de fotos, listas de reproducción y perfiles.'],
    ['¿Hay límites?', 'Archivos de hasta 500 MB, hasta 50 enlaces por lote, hasta 20 clips al unir y GIF de hasta 30 segundos. Si el servidor está muy ocupado puede tardar un poco más.'],
    ['¿Funciona en el móvil?', 'Sí. Y puedes instalarla como app: en Android, menú ⋮ → "Instalar app"; en iPhone, Compartir → "Añadir a pantalla de inicio". En Android aparece además en el menú Compartir.'],
    ['¿Es legal descargar vídeos?', 'Descarga solo contenido tuyo, libre o del que tengas permiso. Los derechos de cada vídeo son de su autor y tú eres responsable del uso que hagas.'],
    ['Un enlace no funciona, ¿por qué?', 'Suele ser porque el contenido es privado, se ha borrado o la plataforma pide iniciar sesión. A veces YouTube bloquea temporalmente el servidor: prueba un rato después.'],
    ['¿Puedo pedir una herramienta nueva?', 'Claro. Escríbeme a ' + 'contacto@letebra.com' + ' con tu idea; muchas de las herramientas actuales salieron así.'],
  ],
  en: [
    ['Is Letebra Tools free?', 'Yes, all of it. No usage limits, no sign-up and no "premium" tiers. It\'s kept alive by people who buy a coffee on Ko-fi.'],
    ['Why are there no ads?', 'Because tool sites are usually full of pop-ups, redirects and fake buttons. Not here: I\'d rather it be pleasant and supported by whoever wants to.'],
    ['Do I need an account?', 'No. Come in, use the tool, leave. Your favorites, recents and history are stored only in your browser.'],
    ['What happens to my files?', 'Tools marked "in your browser" (image, text, recorder, QR…) upload nothing. Video tools process on the server and files are deleted automatically within an hour.'],
    ['Which platforms can I download from?', 'Instagram, TikTok, YouTube, YouTube Shorts, X (Twitter), Facebook, Twitch, Reddit and Pinterest. Photo carousels, playlists and profiles included.'],
    ['Are there limits?', 'Files up to 500 MB, up to 50 links per batch, up to 20 clips when merging and GIFs up to 30 seconds. When the server is busy it may take a bit longer.'],
    ['Does it work on phones?', 'Yes. You can install it as an app: on Android, menu ⋮ → "Install app"; on iPhone, Share → "Add to Home Screen". On Android it also shows up in the Share menu.'],
    ['Is downloading videos legal?', 'Only download your own content, free content or content you have permission for. Each video\'s rights belong to its creator and you\'re responsible for how you use it.'],
    ['A link doesn\'t work, why?', 'Usually the content is private, deleted, or the platform requires login. Sometimes YouTube temporarily blocks the server: try again later.'],
    ['Can I request a new tool?', 'Sure. Email contacto@letebra.com with your idea; many of the current tools started that way.'],
  ],
};

const CHANGES = {
  es: [
    ['Octubre 2026', 'Nace Letebra Tools', ['23 herramientas para creadores en un solo sitio, cada una en su página.', 'Nuevas: convertir formato, crear GIF, extraer fotograma, marca de agua, quitar fondo con IA, redimensionar para redes, comprimir imágenes, zonas seguras, fuentes para bio, contador de caracteres, duración de guion, teleprompter, grabador de pantalla y cámara, generador de QR y calculadora de ganancias.', 'Todas las herramientas de vídeo aceptan tu propio archivo, no solo enlaces.', 'Buscador con Ctrl + K, favoritas, recientes e historial.', 'Pega o arrastra cualquier cosa en la portada y te sugerimos qué hacer.', 'Adiós a los anuncios.']],
    ['2026', 'DescargaTebra', ['Descargas de 9 plataformas en MP4 y MP3, por lotes y en ZIP.', 'Listas de reproducción, perfiles y carruseles de fotos.', 'Selector de calidad hasta 4K.', 'Recortar, comprimir, unir, vertical 9:16, audio, subtítulos y datos del vídeo.', 'App instalable y compartir desde el móvil.']],
  ],
  en: [
    ['October 2026', 'Letebra Tools is born', ['23 creator tools in one place, each on its own page.', 'New: convert format, make GIF, extract frame, watermark, AI background removal, resize for socials, image compression, safe zones, bio fonts, character counter, script length, teleprompter, screen & webcam recorder, QR generator and earnings calculator.', 'Every video tool accepts your own file, not just links.', 'Ctrl + K search, favorites, recents and history.', 'Paste or drop anything on the home page and we suggest what to do.', 'Goodbye ads.']],
    ['2026', 'DescargaTebra', ['Downloads from 9 platforms as MP4 and MP3, in bulk and as ZIP.', 'Playlists, profiles and photo carousels.', 'Quality picker up to 4K.', 'Trim, compress, merge, vertical 9:16, audio, subtitles and video info.', 'Installable app and share from your phone.']],
  ],
};

function legal(slug) {
  const es = lang !== 'en';
  const parts = {
    'aviso-legal': es ? [
      ['Titular', P(`Este sitio web (tools.letebra.com) lo gestiona <b>Letebra</b>. Contacto: ${mail()}.`)],
      ['Objeto', P('Letebra Tools ofrece de forma gratuita herramientas online para creadores de contenido: descargar, editar y convertir vídeo, audio, imagen y texto.')],
      ['Uso del contenido de terceros', P('Las herramientas trabajan con enlaces y archivos que aporta el usuario. Letebra Tools no aloja ni distribuye esos contenidos. Cada usuario es responsable de tener los derechos o permisos necesarios sobre lo que descarga o edita, y de respetar las condiciones de cada plataforma.')],
      ['Propiedad intelectual', P('El diseño, el código, el logotipo y los textos de Letebra Tools pertenecen a su titular. Las marcas de plataformas (YouTube, TikTok, Instagram, etc.) son de sus propietarios y se citan solo para indicar compatibilidad; Letebra Tools no está afiliada a ellas.')],
      ['Responsabilidad', P('Las herramientas se ofrecen "tal cual", sin garantía de disponibilidad continua ni de resultados concretos. El titular no se hace responsable del uso indebido de las herramientas ni de daños derivados de su uso.')],
      ['Enlaces externos y afiliados', P('El sitio enlaza a webs de terceros (Ko-fi, redes sociales, tiendas). Algunos enlaces de la sección "Mi setup de creador" son de afiliado: si compras, el titular puede recibir una comisión sin coste adicional para ti.')],
      ['Legislación', P('Este aviso se rige por la legislación española.')],
    ] : [
      ['Owner', P(`This website (tools.letebra.com) is run by <b>Letebra</b>. Contact: ${mail()}.`)],
      ['Purpose', P('Letebra Tools offers free online tools for content creators: download, edit and convert video, audio, images and text.')],
      ['Third-party content', P('The tools work with links and files provided by the user. Letebra Tools does not host or distribute that content. Each user is responsible for having the rights or permissions for what they download or edit, and for following each platform\'s terms.')],
      ['Intellectual property', P('The design, code, logo and texts of Letebra Tools belong to its owner. Platform trademarks (YouTube, TikTok, Instagram, etc.) belong to their owners and are mentioned only to indicate compatibility; Letebra Tools is not affiliated with them.')],
      ['Liability', P('The tools are provided "as is", with no guarantee of continuous availability or specific results. The owner is not liable for misuse of the tools or damages arising from their use.')],
      ['External and affiliate links', P('The site links to third-party sites (Ko-fi, social networks, shops). Some links in "My creator setup" are affiliate links: if you buy, the owner may earn a commission at no extra cost to you.')],
      ['Law', P('This notice is governed by Spanish law.')],
    ],
    privacidad: es ? [
      ['Resumen', P('Letebra Tools no tiene cuentas de usuario, no pide tu correo y no usa cookies de seguimiento. Casi todo lo que usas se queda en tu navegador.')],
      ['Responsable', P(`Letebra · ${mail()}`)],
      ['Qué datos se tratan', UL('<b>Archivos que subes</b> a herramientas de vídeo: se procesan en el servidor y se borran automáticamente en una hora como máximo. No se revisan ni se comparten.',
        '<b>Enlaces que pegas</b>: se usan solo para obtener y procesar ese contenido.',
        '<b>Herramientas en tu navegador</b> (imagen, texto, QR, grabador, teleprompter…): tus archivos y textos no salen de tu equipo.',
        '<b>Registros técnicos</b>: como cualquier servidor, el proveedor de alojamiento puede registrar temporalmente la IP y las peticiones por seguridad y para evitar abusos.',
        '<b>Preferencias</b> (idioma, favoritas, recientes, historial): se guardan en el almacenamiento local de tu navegador y puedes borrarlas cuando quieras.')],
      ['Servicios de terceros', UL('Alojamiento del servidor: Render (Render Services, Inc.).', 'Tipografía: Google Fonts, que recibe tu IP al cargar la fuente.', 'Quitar fondo: el modelo de IA se descarga de los servidores de IMG.LY; la imagen se procesa en tu equipo.', 'Ko-fi, redes sociales y enlaces de afiliado: solo si haces clic, con sus propias políticas.', 'Miniaturas de vídeos: se cargan desde la plataforma de origen.')],
      ['Tus derechos', P(`Puedes pedir acceso, rectificación o supresión de cualquier dato escribiendo a ${mail()}. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`)],
    ] : [
      ['Summary', P('Letebra Tools has no user accounts, doesn\'t ask for your email and uses no tracking cookies. Almost everything you use stays in your browser.')],
      ['Controller', P(`Letebra · ${mail()}`)],
      ['What data is handled', UL('<b>Files you upload</b> to video tools: processed on the server and deleted automatically within an hour. They are not reviewed or shared.',
        '<b>Links you paste</b>: used only to fetch and process that content.',
        '<b>In-browser tools</b> (image, text, QR, recorder, teleprompter…): your files and texts never leave your device.',
        '<b>Technical logs</b>: like any server, the hosting provider may temporarily log IPs and requests for security and abuse prevention.',
        '<b>Preferences</b> (language, favorites, recents, history): stored in your browser\'s local storage; you can clear them any time.')],
      ['Third-party services', UL('Server hosting: Render (Render Services, Inc.).', 'Fonts: Google Fonts, which receives your IP when loading the font.', 'Background removal: the AI model downloads from IMG.LY servers; the image is processed on your device.', 'Ko-fi, social networks and affiliate links: only if you click, under their own policies.', 'Video thumbnails: loaded from the source platform.')],
      ['Your rights', P(`You can request access, correction or deletion of any data by emailing ${mail()}. You may also complain to the Spanish Data Protection Agency (aepd.es).`)],
    ],
    cookies: es ? [
      ['Sin cookies de seguimiento', P('Letebra Tools no usa cookies propias ni de terceros para publicidad, analítica o seguimiento. Por eso no verás ningún banner de cookies.')],
      ['Almacenamiento local', P('Para recordar tus preferencias usamos el almacenamiento local de tu navegador (no son cookies y no se envían a ningún servidor):'), UL('<code>lt_lang</code>: idioma.', '<code>lt_favs</code>, <code>lt_recent</code>: favoritas y recientes.', '<code>lt_history</code>: historial de lo que descargas o creas.', 'Ajustes de cada herramienta (calidad, textos del guion, estilo del QR…).', 'Un aviso de Ko-fi que, si lo cierras, no vuelve en 7 días.')],
      ['Cómo borrarlo', P('Desde la configuración de tu navegador → Privacidad → Borrar datos de sitios. También puedes vaciar el historial desde la portada.')],
      ['Webs externas', P('Si visitas Ko-fi, redes sociales o tiendas desde nuestros enlaces, esas webs aplican sus propias cookies.')],
    ] : [
      ['No tracking cookies', P('Letebra Tools uses no first- or third-party cookies for ads, analytics or tracking. That\'s why you won\'t see a cookie banner.')],
      ['Local storage', P('To remember your preferences we use your browser\'s local storage (not cookies, never sent to any server):'), UL('<code>lt_lang</code>: language.', '<code>lt_favs</code>, <code>lt_recent</code>: favorites and recents.', '<code>lt_history</code>: history of what you download or create.', 'Each tool\'s settings (quality, script text, QR style…).', 'A Ko-fi notice that, once closed, stays away for 7 days.')],
      ['How to clear it', P('From your browser settings → Privacy → Clear site data. You can also clear the history from the home page.')],
      ['External sites', P('If you visit Ko-fi, social networks or shops through our links, those sites apply their own cookies.')],
    ],
    terminos: es ? [
      ['Uso del servicio', P('Letebra Tools es gratuito y no requiere registro. Al usarlo aceptas estas condiciones.')],
      ['Uso responsable', UL('Usa las herramientas solo con contenido tuyo, libre o del que tengas permiso.', 'Respeta los derechos de autor y las condiciones de cada plataforma.', 'No uses el servicio para contenido ilegal ni para dañar a terceros.', 'No automatices peticiones masivas ni intentes saturar el servidor.')],
      ['Disponibilidad', P('El servicio se ofrece "tal cual". Puede haber cortes, límites temporales o cambios en las herramientas sin previo aviso, por ejemplo si una plataforma cambia su funcionamiento.')],
      ['Límites técnicos', P('Archivos de hasta 500 MB, 50 enlaces por lote, 20 clips al unir y GIF de hasta 30 s. Los archivos se borran del servidor en una hora.')],
      ['Responsabilidad', P('El titular no responde del uso que hagas de las herramientas ni del contenido que proceses con ellas.')],
      ['Cambios', P(`Estas condiciones pueden actualizarse. Dudas: ${mail()}.`)],
    ] : [
      ['Use of the service', P('Letebra Tools is free and needs no sign-up. By using it you accept these terms.')],
      ['Responsible use', UL('Use the tools only with your own content, free content or content you have permission for.', 'Respect copyright and each platform\'s terms.', 'Don\'t use the service for illegal content or to harm others.', 'Don\'t automate mass requests or try to overload the server.')],
      ['Availability', P('The service is provided "as is". There may be outages, temporary limits or changes to the tools without notice, for example when a platform changes how it works.')],
      ['Technical limits', P('Files up to 500 MB, 50 links per batch, 20 clips when merging and GIFs up to 30 s. Files are deleted from the server within an hour.')],
      ['Liability', P('The owner is not responsible for how you use the tools or for the content you process with them.')],
      ['Changes', P(`These terms may be updated. Questions: ${mail()}.`)],
    ],
  };
  return parts[slug].map(([h2, body]) => `<h2>${h2}</h2>${body}`).join('') + `<p class="muted" style="margin-top:30px;font-size:13px">${t('pg_updated')}</p>`;
}

const PAGE_TITLES = {
  faq: ['Preguntas frecuentes', 'FAQ', 'Todo lo que necesitas saber, en corto.', 'Everything you need to know, briefly.'],
  contacto: ['Contacto', 'Contact', '¿Una idea, un error o una colaboración? Escríbeme.', 'An idea, a bug or a collab? Write to me.'],
  apoyar: ['Apoya Letebra Tools', 'Support Letebra Tools', 'Gratis, sin anuncios y sin registro. Así se mantiene.', 'Free, no ads, no sign-up. Here\'s how it stays that way.'],
  novedades: ['Novedades', 'What\'s new', 'Lo último que ha llegado a Letebra Tools.', 'The latest in Letebra Tools.'],
  'aviso-legal': ['Aviso legal', 'Legal notice', '', ''],
  privacidad: ['Política de privacidad', 'Privacy policy', 'Corta y clara: casi no tratamos datos.', 'Short and clear: we handle almost no data.'],
  cookies: ['Política de cookies', 'Cookie policy', 'Spoiler: no usamos cookies de seguimiento.', 'Spoiler: no tracking cookies.'],
  terminos: ['Términos de uso', 'Terms of use', '', ''],
};

export function render(app, page) {
  const slug = page.slug || '404';
  if (slug === '404') return notFound(app);
  const [tes, ten, les, len] = PAGE_TITLES[slug] || [slug, slug, '', ''];
  const en = lang === 'en';
  let body = '';
  if (slug === 'faq') body = `<div class="faq">${FAQ[en ? 'en' : 'es'].map(([q, a]) => `<details class="glass reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    <div class="panel glass reveal" style="margin-top:24px;text-align:center"><p style="color:var(--muted)">${en ? 'Didn\'t find your answer?' : '¿No está tu pregunta?'}</p><a class="btn primary" style="margin-top:12px" href="/contacto">${icon('mail')}${en ? 'Contact me' : 'Escríbeme'}</a></div>`;
  else if (slug === 'contacto') {
    const socials = cfg('SOCIALS', []);
    body = `<div class="panel glass strong reveal"><div class="contact-mail">${icon('mail')}<span>${esc(MAIL())}</span></div>
      <div class="row" style="margin-top:18px"><a class="btn primary" href="mailto:${esc(MAIL())}">${icon('mail')}${t('pg_write')}</a><button type="button" class="btn ghost" data-copy>${icon('copy')}${t('pg_copy')}</button></div>
      <p style="margin-top:18px">${en ? 'Reporting a bug? Include the tool, the link (if any) and what happened. I reply as soon as I can.' : '¿Un error? Dime la herramienta, el enlace (si lo hay) y qué pasó. Respondo lo antes posible.'}</p></div>
      ${socials.length ? `<h2>${en ? 'Socials' : 'Redes'}</h2><div class="row">${socials.map(s => `<a class="btn ghost" href="${esc(s.url)}" target="_blank" rel="noopener">${socialIcon(s.id).replace('<svg', '<svg width="18" height="18"')}${esc(s.name)}</a>`).join('')}</div>` : ''}`;
  } else if (slug === 'apoyar') {
    const affs = cfg('AFFILIATES', []).filter(a => a.url);
    body = `<div class="kofi glass reveal"><div class="cupbox"><span class="steam"><i></i><i></i><i></i></span>☕</div>
      <div><h2 style="margin:0">${en ? 'Buy me a coffee' : 'Invítame a un café'}</h2><p>${en ? 'Each coffee pays part of the server and the time to build new tools. One-off, no account needed.' : 'Cada café paga una parte del servidor y del tiempo para crear herramientas nuevas. Pago único, sin cuenta.'}</p></div>
      ${KOFI() ? `<a class="btn coffee lg sheen" href="${esc(KOFI())}" target="_blank" rel="noopener">${icon('coffee')}${en ? 'Buy me a coffee' : 'Invítame a un café'}</a>` : ''}</div>
      <h2>${en ? 'Why no ads?' : '¿Por qué sin anuncios?'}</h2>${P(en ? 'Ads on tool sites mean pop-ups, redirects and fake download buttons. They make everything slower and less trustworthy. I\'d rather keep Letebra Tools clean and let whoever finds it useful chip in.' : 'Los anuncios en webs de herramientas son pop-ups, redirecciones y botones falsos. Lo hacen todo más lento y menos fiable. Prefiero que Letebra Tools sea limpia y que la apoye quien la encuentre útil.')}
      <h2>${en ? 'Other ways to help (free)' : 'Otras formas de ayudar (gratis)'}</h2>${UL(...(en ? ['Share it with other creators.', 'Tell me ideas or bugs on the <a href="/contacto">contact page</a>.', 'Follow me on social media.'] : ['Compártela con otros creadores.', 'Cuéntame ideas o errores en <a href="/contacto">contacto</a>.', 'Sígueme en redes.']), ...(affs.length ? [en ? 'Use my affiliate links when you were going to buy anyway:' : 'Usa mis enlaces de afiliado si ibas a comprar igualmente:'] : []))}
      ${affs.length ? `<div class="row" style="margin-top:10px">${affs.map(a => `<a class="btn ghost sm" href="${esc(a.url)}" target="_blank" rel="noopener sponsored">${esc(a.icon || '')} ${esc(a.name)}</a>`).join('')}</div>` : ''}`;
  } else if (slug === 'novedades') body = `<div class="changelog">${CHANGES[en ? 'en' : 'es'].map(([d, title, items]) => `<div class="panel glass reveal"><div class="ver"><span class="badge">${esc(d)}</span><b>${esc(title)}</b></div>${UL(...items.map(esc))}</div>`).join('')}</div>`;
  else body = legal(slug);
  app.innerHTML = `<div class="wrap"><article class="doc"><nav class="crumbs"><a href="/">${t('pg_home')}</a>${icon('chevR')}<span>${esc(en ? ten : tes)}</span></nav>
    <h1>${esc(en ? ten : tes)}</h1>${(en ? len : les) ? `<p class="lead">${esc(en ? len : les)}</p>` : ''}${body}</article></div>`;
  $('[data-copy]', app)?.addEventListener('click', () => copyText(MAIL()));
  observeReveal(app);
}

function notFound(app) {
  const en = lang === 'en';
  const pop = ['download', 'trim', 'bgremove', 'compress', 'fonts', 'vertical'].map(toolById).filter(Boolean);
  app.innerHTML = `<div class="wrap"><div class="notfound"><div class="big grad-text">404</div>
    <h1 style="font-size:clamp(24px,4vw,36px);margin-top:10px">${en ? 'This page doesn\'t exist' : 'Esta página no existe'}</h1>
    <p class="muted" style="margin-top:8px">${en ? `But there are ${TOOLS.length} tools waiting for you.` : `Pero hay ${TOOLS.length} herramientas esperándote.`}</p>
    <div class="row" style="justify-content:center;margin-top:22px"><a class="btn primary" href="/">${icon('grid')}${t('pg_home')}</a><button type="button" class="btn ghost" data-s>${icon('search')}${t('pg_search')}</button></div></div>
    <section class="section"><div class="sec-head"><h2 class="sec-title">${t('pg_popular')}</h2></div><div class="tgrid">${pop.map((x, i) => toolCard(x, i * 60)).join('')}</div></section></div>`;
  $('[data-s]', app).onclick = () => palette.open('');
  bindStars(app);
  observeReveal(app);
}
