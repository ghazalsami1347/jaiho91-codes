import { normalizeGames } from '../assets/rtp/game-data.js';
import { cycleAt, rankFeaturedGames, percent } from '../assets/rtp/core.js';
import { pathFor, locales } from '../content/locales.mjs';
import { arcadeStrings, arcadeUi } from '../content/rtp-locales.mjs';

const copy = {
  hi: {
    title:'Jaiho91 RTP और गेम सूची', short:'RTP', link:'RTP और गेम देखें',
    description:'Jaiho91 के टॉप 10 डेमो गेम देखें। डेमो RTP 96% से 99% के बीच है और सूची रोज़ दोपहर 12 बजे IST पर बदलती है।',
    notice:'ये प्रतिशत डेमो के लिए बनाए जाते हैं। ये असली या लाइव RTP, जीत की संभावना या खेलने की सलाह नहीं हैं।',
    demoValue:'डेमो RTP',
  },
  hi_en: {
    title:'Jaiho91 RTP aur game list', short:'RTP', link:'RTP aur games dekhein',
    description:'Jaiho91 ke top 10 demo games dekhein. Demo RTP 96% se 99% ke beech hai aur list roz dopahar 12 baje IST par badalti hai.',
    notice:'Yeh percentages demo ke liye bante hain. Yeh asli ya live RTP, jeetne ka chance ya khelne ki salah nahi hain.',
    demoValue:'Demo RTP',
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

export function rtpBody(template, locale, games, h, now, apkUrl) {
  const c = rtpCopy(locale);
  const language = locale.prefix ? 1 : 0;
  for (const [original, translation] of Object.entries(arcadeStrings)) {
    template = template.replaceAll(original, translation[language]);
  }
  const featured = rankFeaturedGames(games, cycleAt(now).key);
  const card = game => `<article class="game-card${game.rank <= 3 ? ' top-game' : ''}" id="game-${game.id}">
<div class="cover-wrap">${game.image ? `<img class="game-art" src="${h(game.image)}" width="320" height="320" alt="" loading="lazy" decoding="async">` : '<div class="game-art placeholder"></div>'}<span class="cover-rank${game.rank <= 3 ? ' is-top' : ''}">#${game.rank}</span></div>
<div class="card-body"><span class="game-theme">${h(game.theme)}</span><h3>${h(game.name)}</h3><div class="card-rtp"><span>${h(c.demoValue)}</span><strong>${percent(game.basisPoints)}</strong></div></div></article>`;
  const siteLinks = [
    ...[['/codes/', locale.codes], ['/tutorials/', locale.tutorials]]
      .map(([path, label]) => `<a href="${pathFor(locale, path)}">${h(label)}</a>`),
    ...Object.values(locales).map(other => `<a href="${pathFor(other, '/rtp/')}" lang="${other.lang}"${other === locale ? ' aria-current="page"' : ''}>${h(other.label)}</a>`),
  ].join('');
  return template
    .replaceAll('{{home}}', pathFor(locale, '/'))
    .replaceAll('{{apk}}', h(apkUrl))
    .replace('{{navLabel}}', language ? 'Jaiho91 links aur bhasha' : 'Jaiho91 लिंक और भाषा')
    .replace('{{ui}}', h(JSON.stringify({
      ...Object.fromEntries(Object.entries(arcadeUi).map(([key, values]) => [key, values[language]])),
      demo:c.demoValue,
    })))
    .replace('{{siteLinks}}', siteLinks)
    .replace('{{notice}}', h(c.notice))
    .replace('{{games}}', featured.map(card).join('\n'));
}
