import { normalizeGames } from '../assets/rtp/game-data.js';
import { cycleAt, rankFeaturedGames, percent } from '../assets/rtp/core.js';
import { arcadeStrings, arcadeUi } from '../content/rtp-locales.mjs';

const copy = {
  hi: {
    title:'Jaiho91 Live RTP का प्रीव्यू', short:'Live RTP',
    description:'Jaiho91 Live RTP का प्रीव्यू। टॉप 10 गेम की सूची रोज़ दोपहर 12 बजे IST पर बदलती है। 96% से 99% तक के प्रतिशत उदाहरण हैं।',
    noticeLabel:'प्रीव्यू',
    notice:'अभी 96% से 99% तक के सिम्युलेटेड RTP प्रतिशत दिख रहे हैं। असली डेटा फ़ीड बाद में जुड़ेगी।',
  },
  hi_en: {
    title:'Jaiho91 Live RTP Preview', short:'Live RTP',
    description:'Jaiho91 Live RTP ka preview. Top 10 games ki list roz dopahar 12 baje IST par badalti hai. 96% se 99% tak ke percentages misaal hain.',
    noticeLabel:'PREVIEW',
    notice:'96% se 99% tak ke RTP numbers simulated hain. Asli data feed baad mein judegi.',
  },
};

export const rtpCopy = locale => copy[locale.prefix ? 'hi_en' : 'hi'];

export function rtpCatalog(raw) {
  function localCover(path, id) {
    if (!path) return null;
    const prefix = './assets/games/';
    const filename = path.slice(prefix.length);
    if (!path.startsWith(prefix) || ![128, 320, 640].some(size => filename === id + '-' + size + '.webp')) {
      throw new Error('Unsupported RTP cover for ' + id);
    }
    return '/assets/rtp/games/' + filename;
  }
  return normalizeGames(raw).games.map(game => ({
    id:game.id, name:game.name, theme:game.theme, aliases:game.aliases, description:game.description,
    image:localCover(game.thumbnail, game.id),
    imageSmall:localCover(game.thumbnailSmall, game.id),
    imageLarge:localCover(game.thumbnailLarge, game.id),
  }));
}

export function rtpBody(template, locale, games, h, now) {
  const c = rtpCopy(locale);
  const language = locale.prefix ? 1 : 0;
  for (const [original, translation] of Object.entries(arcadeStrings)) {
    template = template.replaceAll(original, translation[language]);
  }
  const featured = rankFeaturedGames(games, cycleAt(now).key);
  const card = game => `<article class="game-card${game.rank <= 3 ? ' top-game' : ''}" id="game-${game.id}">
<div class="cover-wrap">${game.image ? `<img class="game-art" src="${h(game.image)}" width="320" height="320" alt="" loading="lazy" decoding="async">` : '<div class="game-art placeholder"></div>'}<span class="cover-rank${game.rank <= 3 ? ' is-top' : ''}">#${game.rank}</span></div>
<div class="card-body"><span class="game-theme">${h(game.theme)}</span><h3>${h(game.name)}</h3><div class="card-rtp"><span>RTP</span><strong>${percent(game.basisPoints)}</strong></div></div></article>`;
  return template
    .replace('{{ui}}', h(JSON.stringify(Object.fromEntries(
      Object.entries(arcadeUi).map(([key, values]) => [key, values[language]]),
    ))))
    .replace('{{noticeLabel}}', h(c.noticeLabel))
    .replace('{{notice}}', h(c.notice))
    .replace('{{games}}', featured.map(card).join('\n'));
}
