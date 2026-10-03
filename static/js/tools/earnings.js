// Earnings calculator: YouTube (RPM by niche & audience), TikTok Creator Rewards, Twitch, engagement rate. Ranges, not promises.
import {$, $$, t, lang, esc, addStrings, store} from '../core.js';
import {h, field, seg, bindSeg} from './kit.js';

addStrings({
  es: {ea_tab_yt: 'YouTube', ea_tab_tt: 'TikTok', ea_tab_tw: 'Twitch', ea_tab_er: 'Engagement', ea_views: 'Visualizaciones al mes (vídeos largos)', ea_shorts: 'Visualizaciones al mes (Shorts)',
    ea_niche: 'Temática', ea_aud: 'Público principal', ea_month: 'Al mes', ea_year: 'Al año', ea_rpm: 'RPM estimado (por 1000 visualizaciones)',
    ea_disc: 'Estimación orientativa. Lo que cobres depende de la época del año, la duración, la retención, los anuncios que se muestren y los impuestos.',
    ea_tt_views: 'Visualizaciones cualificadas al mes (vídeos de más de 1 minuto)', ea_tt_note: 'Creator Rewards paga solo por vídeos de más de 1 minuto y visualizaciones "cualificadas" (más de 5 s, no de anuncios, etc.).',
    ea_subs: 'Suscriptores de pago', ea_split: 'Reparto de suscripción', ea_bits: 'Bits al mes', ea_viewers: 'Espectadores medios', ea_hours: 'Horas en directo al mes', ea_ads: 'Minutos de anuncios por hora',
    ea_tw_subs: 'Suscripciones', ea_tw_bits: 'Bits', ea_tw_ads: 'Anuncios', ea_followers: 'Seguidores', ea_likes: 'Me gusta (media por publicación)', ea_comments: 'Comentarios (media)',
    ea_shares: 'Compartidos (media)', ea_saves: 'Guardados (media)', ea_pviews: 'Visualizaciones (media, opcional)', ea_er_f: 'Engagement sobre seguidores', ea_er_v: 'Engagement sobre visualizaciones',
    ea_low: 'Bajo', ea_ok: 'Normal', ea_good: 'Bueno', ea_great: 'Excelente',
    n_ent: 'Entretenimiento / vlogs', n_game: 'Gaming', n_edu: 'Educación', n_tech: 'Tecnología', n_fin: 'Finanzas y negocios', n_fit: 'Salud y fitness', n_beauty: 'Belleza y moda',
    n_food: 'Cocina y viajes', n_music: 'Música', n_kids: 'Infantil',
    a_es: 'España', a_latam: 'Latinoamérica', a_us: 'EE. UU. y Canadá', a_eu: 'Resto de Europa', a_mix: 'Mezcla internacional'},
  en: {ea_tab_yt: 'YouTube', ea_tab_tt: 'TikTok', ea_tab_tw: 'Twitch', ea_tab_er: 'Engagement', ea_views: 'Monthly views (long videos)', ea_shorts: 'Monthly views (Shorts)',
    ea_niche: 'Niche', ea_aud: 'Main audience', ea_month: 'Per month', ea_year: 'Per year', ea_rpm: 'Estimated RPM (per 1000 views)',
    ea_disc: 'Rough estimate. What you earn depends on the season, length, retention, which ads run and taxes.',
    ea_tt_views: 'Qualified monthly views (videos over 1 minute)', ea_tt_note: 'Creator Rewards only pays for videos over 1 minute and "qualified" views (over 5 s, not from ads, etc.).',
    ea_subs: 'Paid subscribers', ea_split: 'Subscription split', ea_bits: 'Bits per month', ea_viewers: 'Average viewers', ea_hours: 'Hours live per month', ea_ads: 'Ad minutes per hour',
    ea_tw_subs: 'Subscriptions', ea_tw_bits: 'Bits', ea_tw_ads: 'Ads', ea_followers: 'Followers', ea_likes: 'Likes (average per post)', ea_comments: 'Comments (average)',
    ea_shares: 'Shares (average)', ea_saves: 'Saves (average)', ea_pviews: 'Views (average, optional)', ea_er_f: 'Engagement by followers', ea_er_v: 'Engagement by views',
    ea_low: 'Low', ea_ok: 'Average', ea_good: 'Good', ea_great: 'Excellent',
    n_ent: 'Entertainment / vlogs', n_game: 'Gaming', n_edu: 'Education', n_tech: 'Tech', n_fin: 'Finance & business', n_fit: 'Health & fitness', n_beauty: 'Beauty & fashion',
    n_food: 'Food & travel', n_music: 'Music', n_kids: 'Kids',
    a_es: 'Spain', a_latam: 'Latin America', a_us: 'US & Canada', a_eu: 'Rest of Europe', a_mix: 'International mix'},
});
export const faq = {
  es: [['¿Qué es el RPM?', 'Lo que ganas tú por cada 1000 visualizaciones, ya descontada la parte de YouTube. No confundir con el CPM, que es lo que paga el anunciante.'], ['¿Por qué un rango y no una cifra?', 'Porque varía muchísimo según el mes, el país y el tipo de vídeo. El rango te da una idea realista.']],
  en: [['What is RPM?', 'What you earn per 1000 views after YouTube\'s cut. Not to be confused with CPM, which is what advertisers pay.'], ['Why a range and not a number?', 'Because it varies a lot by month, country and type of video. The range gives a realistic idea.']],
};
// € per 1000 views (creator's share), for a Spanish audience; audience multipliers below
const NICHE = {ent: [.6, 2], game: [.5, 1.8], edu: [2, 6], tech: [2, 7], fin: [4, 12], fit: [1.5, 5], beauty: [1, 4], food: [1, 4], music: [.3, 1.2], kids: [.3, 1.2]};
const AUD = {es: 1, latam: .4, us: 1.9, eu: 1.15, mix: .8};
const eur = n => new Intl.NumberFormat(lang, {style: 'currency', currency: 'EUR', maximumFractionDigits: n < 100 ? 2 : 0}).format(n);
const range = ([a, b]) => a === b ? eur(a) : `${eur(a)} – ${eur(b)}`;

export function mount(root) {
  const s = {tab: 'yt', views: 100000, shorts: 0, niche: 'ent', aud: 'es', tt: 200000, subs: 50, split: '50', bits: 2000, viewers: 30, hours: 60, ads: 3,
    fol: 10000, likes: 400, com: 25, sh: 10, sav: 15, pv: 0, ...store.get('lt_earn', {})};
  const num = (k, label) => field(label, `<input class="inp" type="number" min="0" step="1" data-n="${k}" value="${s[k]}">`);
  const el = h(`<div class="panel glass strong"><div class="stack">
    ${seg('tab', [['yt', t('ea_tab_yt')], ['tt', t('ea_tab_tt')], ['tw', t('ea_tab_tw')], ['er', t('ea_tab_er')]], s.tab)}
    <div data-t="yt" class="stack"><div class="grid2">${num('views', t('ea_views'))}${num('shorts', t('ea_shorts'))}
      ${field(t('ea_niche'), `<select class="sel" data-n="niche">${Object.keys(NICHE).map(k => `<option value="${k}" ${k === s.niche ? 'selected' : ''}>${t('n_' + k)}</option>`).join('')}</select>`)}
      ${field(t('ea_aud'), `<select class="sel" data-n="aud">${Object.keys(AUD).map(k => `<option value="${k}" ${k === s.aud ? 'selected' : ''}>${t('a_' + k)}</option>`).join('')}</select>`)}</div></div>
    <div data-t="tt" class="stack">${num('tt', t('ea_tt_views'))}<small class="muted" style="font-size:12.5px">${t('ea_tt_note')}</small></div>
    <div data-t="tw" class="stack"><div class="grid3">${num('subs', t('ea_subs'))}${field(t('ea_split'), `<select class="sel" data-n="split"><option value="50" ${s.split === '50' ? 'selected' : ''}>50 / 50</option><option value="60" ${s.split === '60' ? 'selected' : ''}>60 / 40</option><option value="70" ${s.split === '70' ? 'selected' : ''}>70 / 30</option></select>`)}${num('bits', t('ea_bits'))}
      ${num('viewers', t('ea_viewers'))}${num('hours', t('ea_hours'))}${num('ads', t('ea_ads'))}</div></div>
    <div data-t="er" class="stack"><div class="grid3">${num('fol', t('ea_followers'))}${num('likes', t('ea_likes'))}${num('com', t('ea_comments'))}${num('sh', t('ea_shares'))}${num('sav', t('ea_saves'))}${num('pv', t('ea_pviews'))}</div></div>
    <div data-res></div><small class="muted" style="font-size:12px">${t('ea_disc')}</small></div></div>`);
  root.append(el);
  bindSeg(el, 'tab', v => { s.tab = v; calc(); });
  $$('[data-n]', el).forEach(i => i.oninput = () => { s[i.dataset.n] = i.tagName === 'SELECT' ? i.value : Math.max(0, +i.value || 0); calc(); });
  const stat = (label, val, big) => `<div class="stat" style="${big ? 'background:var(--grad-soft);box-shadow:inset 0 0 0 1px rgba(177,92,255,.45)' : ''}"><span>${label}</span><b style="font-size:${big ? 30 : 22}px">${val}</b></div>`;
  function calc() {
    store.set('lt_earn', s);
    $$('[data-t]', el).forEach(x => { x.hidden = x.dataset.t !== s.tab; });
    let html = '';
    if (s.tab === 'yt') {
      const m = AUD[s.aud], rpm = NICHE[s.niche].map(x => x * m), sr = [.02 * m, .08 * m];
      const mo = [s.views / 1000 * rpm[0] + s.shorts / 1000 * sr[0], s.views / 1000 * rpm[1] + s.shorts / 1000 * sr[1]];
      html = stat(t('ea_month'), range(mo), true) + stat(t('ea_year'), range(mo.map(x => x * 12))) + stat(t('ea_rpm'), range(rpm));
    } else if (s.tab === 'tt') {
      const mo = [s.tt / 1000 * .35, s.tt / 1000 * .9];
      html = stat(t('ea_month'), range(mo), true) + stat(t('ea_year'), range(mo.map(x => x * 12))) + stat(t('ea_rpm'), range([.35, .9]));
    } else if (s.tab === 'tw') {
      const net = 4.99 / 1.21 * (+s.split / 100), subs = s.subs * net, bits = s.bits * .01;
      const ads = [s.viewers * s.hours * s.ads * 2 * 2.5 / 1000 * .55, s.viewers * s.hours * s.ads * 2 * 4.5 / 1000 * .55];
      const mo = [subs + bits + ads[0], subs + bits + ads[1]];
      html = stat(t('ea_month'), range(mo), true) + stat(t('ea_tw_subs'), eur(subs)) + stat(t('ea_tw_bits'), eur(bits)) + stat(t('ea_tw_ads'), range(ads));
    } else {
      const inter = s.likes + s.com + s.sh + s.sav, f = s.fol ? inter / s.fol * 100 : 0, v = s.pv ? inter / s.pv * 100 : null;
      const lvl = x => t(x < 1 ? 'ea_low' : x < 3 ? 'ea_ok' : x < 6 ? 'ea_good' : 'ea_great');
      html = stat(t('ea_er_f'), `${f.toFixed(2)}% · ${lvl(f)}`, true) + (v != null ? stat(t('ea_er_v'), `${v.toFixed(2)}% · ${lvl(v)}`) : '');
    }
    $('[data-res]', el).innerHTML = `<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${html}</div>`;
  }
  calc();
}
