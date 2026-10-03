// Icon set (24×24, stroke = currentColor) + platform logos + the gem logo.
const P = {
  // ui
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  upload: '<path d="M12 16V4m0 0-5 5m5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  link: '<path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.2 1.2"/><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.2-1.2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2"/>',
  paste: '<rect x="8" y="3" width="8" height="4" rx="1.2"/><path d="M16 5h1.5A2.5 2.5 0 0 1 20 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-11A2.5 2.5 0 0 1 6.5 5H8"/>',
  play: '<path d="M7 4.5v15l13-7.5Z" fill="currentColor"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.5 3.6 4 7.1 4c2 0 3.4 1.1 4.9 3 1.5-1.9 2.9-3 4.9-3 3.5 0 5.7 3.5 4.4 6.8C19.5 15.4 12 20 12 20Z"/>',
  coffee: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5c-.6.8-.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  sparkle: '<path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  noads: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/>',
  camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/><circle cx="12" cy="13" r="3.5"/>',
  drag: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L3 9M4 13a8 8 0 0 0 14.6 4.5L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  wand: '<path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM4 20 14 10"/><path d="m19 13 .6 1.4L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6Z"/>',
  // tools
  download: '<path d="M12 3v12m0 0-5-5m5 5 5-5"/><path d="M4 16v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2"/>',
  subs: '<rect x="2.5" y="4.5" width="19" height="15" rx="3.5"/><path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3"/>',
  info_: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.6"/>',
  trim: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  merge: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.3 7.3C12 9 13 11 15.5 12M8.3 16.7C12 15 13 13 15.5 12"/>',
  vertical: '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.5h2M3 9v6M21 9v6"/>',
  convert: '<path d="M4 7.5h13l-3.5-3.5M20 16.5H7l3.5 3.5"/>',
  gif: '<rect x="2.5" y="5" width="19" height="14" rx="3.5"/><path d="M10 10H8.3a1.6 1.6 0 0 0-1.6 1.6v.8A1.6 1.6 0 0 0 8.3 14H10v-2H8.8M13 10v4M16 14v-4h2.5M16 12h2"/>',
  frame: '<path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"/><circle cx="12" cy="12" r="3.5"/>',
  watermark: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  audio: '<path d="M3 12h1.5M7 8.5v7M10.5 5v14M14 8v8M17.5 10v4M21 12h0"/>',
  bgremove: '<circle cx="11" cy="9" r="3.5"/><path d="M4 21a7 7 0 0 1 14 0"/><path d="m19 2 .8 1.7 1.7.8-1.7.8L19 7l-.8-1.7-1.7-.8 1.7-.8Z" fill="currentColor"/>',
  resize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3.5"/><circle cx="8.8" cy="8.8" r="1.8"/><path d="m21 15-5-5L5 21"/>',
  safezones: '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="m9.5 12.5 1.8 1.8 3.5-3.5"/>',
  fonts: '<path d="M3 19 8 5l5 14M4.8 14h6.4"/><path d="M15.5 10.5a2.7 2.7 0 0 1 5 1.4V19M20.5 14.2c-2.4-.3-5.5.4-5.5 2.3a1.6 1.6 0 0 0 1.7 1.6c1.8 0 3.8-1.3 3.8-3.6"/>',
  counter: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  script: '<path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M13 3l5 5v2.5M9 9h3M9 13h2.5"/><circle cx="17" cy="17" r="4"/><path d="M17 15.3V17l1.1 1.1"/>',
  teleprompter: '<rect x="2.5" y="3.5" width="19" height="13.5" rx="2.6"/><path d="M8 21h8M12 17v4M7 8h10M7 12h7"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><path d="M14 14h3v3h-3zM20.5 14v.01M14 20.5h.01M17 17h4v4h-4"/>',
  earnings: '<path d="M3 17l5.5-5.5 4 4L21 7"/><path d="M15 7h6v6"/>',
  // categories
  'cat-download': '<path d="M12 3v12m0 0-5-5m5 5 5-5"/><path d="M4 16v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2"/>',
  'cat-video': '<rect x="2.5" y="5" width="14.5" height="14" rx="3"/><path d="m17 10.2 4.5-2.6v8.8L17 13.8"/>',
  'cat-audio': '<path d="M9 18V5.5l11-2.2v12.4"/><circle cx="6.2" cy="18" r="2.8"/><circle cx="17.2" cy="15.7" r="2.8"/>',
  'cat-image': '<rect x="3" y="3" width="18" height="18" rx="3.5"/><circle cx="8.8" cy="8.8" r="1.8"/><path d="m21 15-5-5L5 21"/>',
  'cat-text': '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  'cat-utils': '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>',
};
const ALIAS = {'tool-info': 'info_'};

export function icon(name, cls = '') {
  const d = P[ALIAS[name] || name] || P.sparkle;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
// tool ids whose icon key clashes with ui names
export const toolIcon = t => icon(t.icon === 'info' ? 'tool-info' : t.icon);

// Platform logos (brand colors).
const PL = {
  instagram: '<defs><linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f9ce34"/><stop offset=".5" stop-color="#ee2a7b"/><stop offset="1" stop-color="#6228d7"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="url(#ig-g)" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="url(#ig-g)" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.1" fill="#ee2a7b"/>',
  tiktok: '<path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/>',
  youtube: '<path fill="#ff0033" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8z"/><path fill="#fff" d="m9.75 15.02 5.75-3.02-5.75-3.02z"/>',
  shorts: '<path fill="#ff0033" d="M17.8 9.6 16 8.6l1.6-.8a4.1 4.1 0 0 0-3.9-7.2L6.8 4.2a4.1 4.1 0 0 0-.6 7.2l1.8 1-1.6.8a4.1 4.1 0 0 0 3.9 7.2l6.9-3.6a4.1 4.1 0 0 0 .6-7.2Z"/><path fill="#fff" d="m10 15 5-3-5-3z"/>',
  twitter: '<path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"/>',
  facebook: '<circle cx="12" cy="12" r="11" fill="#1877f2"/><path fill="#fff" d="M15.5 8.1h-1.9c-.4 0-.6.3-.6.7v1.8h2.5l-.4 2.6H13V23h-2.8v-9.8H8.2v-2.6h2V8.4c0-1.8 1.1-2.9 2.9-2.9h2.4z"/>',
  twitch: '<path fill="#9146ff" d="M4.3 2 3 5.4v13.8h4.7V22h2.6l2.7-2.8h3.9L22 14V2zm16 11.2-3 3h-4.7l-2.6 2.6v-2.6H6V3.7h14.3zM17.4 7v5.2h-1.7V7zm-4.7 0v5.2H11V7z"/>',
  reddit: '<circle cx="12" cy="12" r="11" fill="#ff4500"/><ellipse cx="12" cy="14" rx="6.2" ry="4.2" fill="#fff"/><circle cx="9.6" cy="13.6" r="1" fill="#ff4500"/><circle cx="14.4" cy="13.6" r="1" fill="#ff4500"/><circle cx="16.6" cy="6.4" r="1.3" fill="#fff"/><path d="M12 9.8 13.1 5.6l3.5.8" stroke="#fff" stroke-width="1" fill="none"/>',
  pinterest: '<circle cx="12" cy="12" r="11" fill="#e60023"/><path fill="#fff" d="M12.3 5C8.4 5 6.4 7.8 6.4 10.1c0 1.4.5 2.7 1.7 3.1.2.1.4 0 .4-.2l.2-.7c.1-.2 0-.3-.1-.5-.3-.4-.6-1-.6-1.7 0-2.2 1.6-4.1 4.2-4.1 2.3 0 3.6 1.4 3.6 3.3 0 2.5-1.1 4.6-2.7 4.6-.9 0-1.6-.7-1.4-1.6.3-1.1.8-2.3.8-3.1 0-.7-.4-1.3-1.2-1.3-.9 0-1.7 1-1.7 2.3 0 .8.3 1.4.3 1.4l-1.1 4.6c-.3 1.4 0 3.1 0 3.2 0 .1.1.1.2 0 .1-.1 1-1.3 1.4-2.5l.5-2.1c.3.5 1.1 1 2 1 2.6 0 4.4-2.4 4.4-5.6C17.7 7.2 15.6 5 12.3 5z"/>',
};
export const platformIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${PL[id] || ''}</svg>`;

// Monochrome social logos (footer / contact).
const SO = {
  youtube: '<path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.75 15.02V8.98L15.5 12z"/>',
  twitch: '<path d="M4.3 2 3 5.4v13.8h4.7V22h2.6l2.7-2.8h3.9L22 14V2zm16 11.2-3 3h-4.7l-2.6 2.6v-2.6H6V3.7h14.3zM17.4 7v5.2h-1.7V7zm-4.7 0v5.2H11V7z"/>',
  instagram: '<path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21.9 8.2c-.1-1.6-.4-3-1.6-4.1-1.1-1.2-2.5-1.5-4.1-1.6C14.5 2.4 9.5 2.4 7.8 2.5c-1.6.1-3 .4-4.1 1.6C2.5 5.2 2.2 6.6 2.1 8.2 2 9.9 2 14.1 2.1 15.8c.1 1.6.4 3 1.6 4.1 1.1 1.2 2.5 1.5 4.1 1.6 1.7.1 6.7.1 8.4 0 1.6-.1 3-.4 4.1-1.6 1.2-1.1 1.5-2.5 1.6-4.1.1-1.7.1-5.9 0-7.6Zm-2.1 9.5a3.2 3.2 0 0 1-1.8 1.8c-1.3.5-4.3.4-5.7.4s-4.4.1-5.7-.4a3.2 3.2 0 0 1-1.8-1.8c-.5-1.3-.4-4.3-.4-5.7s-.1-4.4.4-5.7a3.2 3.2 0 0 1 1.8-1.8c1.3-.5 4.3-.4 5.7-.4s4.4-.1 5.7.4a3.2 3.2 0 0 1 1.8 1.8c.5 1.3.4 4.3.4 5.7s.1 4.4-.4 5.7Z"/>',
  tiktok: '<path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/>',
  x: '<path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"/>',
};
export const socialIcon = id => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SO[id] || ''}</svg>`;

// The logo: a faceted crystal gem (crown + pavilion) with brand gradients, lit from the top left.
let gemN = 0;
export function gem(cls = '') {
  const n = ++gemN, g = k => `url(#gm${n}${k})`;
  const stops = {a: ['#b9adff', '#7b6cff'], b: ['#f1eaff', '#bfa4ff'], c: ['#ffffff', '#dccbff'], d: ['#d3a6ff', '#9a5cff'],
    e: ['#9a66ff', '#6a3fe0'], f: ['#7d6dff', '#4a37d8'], g: ['#c070ff', '#7d3fe0'], h: ['#ff8cc8', '#c84fd8'], i: ['#ff5ca8', '#a8357f']};
  const defs = Object.entries(stops).map(([k, [s, e]]) =>
    `<linearGradient id="gm${n}${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s}"/><stop offset="1" stop-color="${e}"/></linearGradient>`).join('');
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs>${defs}</defs>
<g stroke="rgba(255,255,255,.55)" stroke-width=".7" stroke-linejoin="round">
<path d="M8 24 20 10 22 24Z" fill="${g('a')}"/><path d="M20 10 32 24H22Z" fill="${g('b')}"/><path d="M20 10H44L32 24Z" fill="${g('c')}"/>
<path d="M44 10 42 24H32Z" fill="${g('d')}"/><path d="M44 10 56 24H42Z" fill="${g('e')}"/>
<path d="M8 24H22L32 58Z" fill="${g('f')}"/><path d="M22 24H32V58Z" fill="${g('g')}"/><path d="M32 24H42L32 58Z" fill="${g('h')}"/><path d="M42 24H56L32 58Z" fill="${g('i')}"/></g>
<path d="M8 24 20 10H44L56 24 32 58Z" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M21.5 12.2h4.4L15.2 23.4h-4.4Z" fill="#fff" opacity=".55"/>
<path d="M54 3.5c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4Z" fill="#fff"/></svg>`;
}
