import { normalizeGames } from '../assets/rtp/game-data.js';
import { cycleAt, featuredGames, percent } from '../assets/rtp/core.js';
import { arcadeStrings, arcadeUi } from '../content/rtp-locales.mjs';

const copy = {
  hi: {
    title:'Jaiho91 Live RTP का प्रीव्यू', short:'Live RTP',
    description:'Jaiho91 का RTP प्रीव्यू देखें। टॉप 10 गेम की सूची रोज़ दोपहर 12 बजे IST पर बदलती है।',
    dataNotice:'Live RTP',
    publishedTitle:'Jaiho91 Live RTP और गेम सूची',
    publishedDescription:'Jaiho91 गेम की प्रकाशित RTP सूची देखें। RTP लंबे समय का औसत है और किसी राउंड में जीत की गारंटी नहीं है।',
  },
  hi_en: {
    title:'Jaiho91 Live RTP Preview', short:'Live RTP',
    description:'Jaiho91 ka RTP preview dekhein. Top 10 games ki list roz dopahar 12 baje IST par badalti hai.',
    dataNotice:'Live RTP',
    publishedTitle:'Jaiho91 Live RTP aur game list',
    publishedDescription:'Jaiho91 games ki published RTP list dekhein. RTP lambe samay ka average hai. Har round ka nateeja alag ho sakta hai.',
  },
};

const localeKey = locale => locale.prefix ? 'hi_en' : 'hi';
export function rtpCopy(locale, published = false) {
  const text = copy[localeKey(locale)];
  return published ? { ...text, title:text.publishedTitle, description:text.publishedDescription } : text;
}

export function rtpCatalog(raw, percentages) {
  function localCover(path, id) {
    if (!path) return null;
    const prefix = './assets/games/';
    const filename = path.slice(prefix.length);
    if (!path.startsWith(prefix) || ![128, 320, 640].some(size => filename === id + '-' + size + '.webp')) {
      throw new Error('Unsupported RTP cover for ' + id);
    }
    return '/assets/rtp/games/' + filename;
  }
  const { games } = normalizeGames(raw);
  if (!percentages || typeof percentages !== 'object' || Array.isArray(percentages)) {
    throw new Error('In content/rtp.json, "percentages" should be an object. Use {} for the demo.');
  }
  for (const [id, value] of Object.entries(percentages)) {
    if (!games.some(game => game.id === id)) throw new Error('Unknown game ID in content/rtp.json: ' + id);
    if (typeof value !== 'number' || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) {
      throw new Error('Use a non-negative number without a % sign in content/rtp.json for ' + id);
    }
  }
  return games.map(game => ({
    id:game.id, name:game.name, theme:game.theme, aliases:game.aliases, description:game.description,
    image:localCover(game.thumbnail, game.id),
    imageSmall:localCover(game.thumbnailSmall, game.id),
    imageLarge:localCover(game.thumbnailLarge, game.id),
    ...(Object.hasOwn(percentages, game.id) ? { basisPoints:Math.round(percentages[game.id] * 100) } : {}),
  }));
}

export function rtpBody(template, locale, games, settings, h, now) {
  const published = Object.keys(settings.percentages).length > 0;
  const c = rtpCopy(locale, published);
  const { label, text } = settings.notice?.[localeKey(locale)] ?? {};
  if (typeof label !== 'string' || !label.trim() || typeof text !== 'string' || !text.trim()) {
    throw new Error('In content/rtp.json, add a notice label and text for ' + localeKey(locale));
  }
  const language = locale.prefix ? 1 : 0;
  for (const [original, translation] of Object.entries(arcadeStrings)) {
    template = template.replaceAll(original, (published && translation[language + 2]) || translation[language]);
  }
  const featured = featuredGames(games, cycleAt(now).key);
  const card = game => `<article class="game-card${game.rank <= 3 ? ' top-game' : ''}" id="game-${game.id}">
<div class="cover-wrap">${game.image ? `<img class="game-art" src="${h(game.image)}" width="320" height="320" alt="" loading="lazy" decoding="async">` : '<div class="game-art placeholder"></div>'}<span class="cover-rank${game.rank <= 3 ? ' is-top' : ''}">#${game.rank}</span></div>
<div class="card-body"><span class="game-theme">${h(game.theme)}</span><h3>${h(game.name)}</h3><div class="card-rtp"><span>RTP</span><strong>${percent(game.basisPoints)}</strong></div></div></article>`;
  return template
    .replace('{{ui}}', () => h(JSON.stringify({
      ...Object.fromEntries(Object.entries(arcadeUi).map(([key, values]) => [key, values[language]])),
      published,
      detailsNotice:published ? text : c.dataNotice,
    })))
    .replace('{{noticeLabel}}', () => h(label))
    .replace('{{notice}}', () => h(text))
    .replace('{{dataNotice}}', published ? '' : `<span class="rtp-data-notice">${h(c.dataNotice)}</span>`)
    .replaceAll('{{demoOnly}}', published ? ' hidden' : '')
    .replaceAll('{{count}}', String(featured.length))
    .replace('{{games}}', featured.map(card).join('\n'));
}
