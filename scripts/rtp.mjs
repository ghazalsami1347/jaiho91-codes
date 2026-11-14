import { normalizeGames } from '../assets/rtp/game-data.js';

const copy = {
  hi: {
    title:'Jaiho91 RTP और गेम सूची', short:'RTP', link:'RTP और गेम देखें',
    description:'Jaiho91 की डेमो RTP सूची देखें, गेम खोजें और अपने पसंदीदा गेम सहेजें। सूची रोज़ दोपहर 12 बजे IST पर बदलती है।',
    notice:'ये प्रतिशत डेमो के लिए बनाए जाते हैं। ये असली या लाइव RTP, जीत की संभावना या खेलने की सलाह नहीं हैं।',
    updated:'रोज़ दोपहर 12 बजे IST पर अपडेट', search:'गेम खोजें', category:'श्रेणी', all:'सभी', saved:'पसंदीदा',
    demo:'आज की डेमो सूची', catalog:'सभी गेम', empty:'कोई गेम नहीं मिला।', count:'गेम मिले:', save:'सहेजें', remove:'हटाएँ', demoValue:'डेमो RTP',
    explanation:'RTP का क्या मतलब है?', answer:'RTP (Return to Player) किसी गेम का लंबे समय का सैद्धांतिक औसत होता है। इससे किसी एक राउंड या सत्र का नतीजा पता नहीं चलता। इस सूची में असली RTP डेटा जुड़ा नहीं है।',
    themes:{Mythology:'पौराणिक',Animals:'जानवर',Cards:'कार्ड',Classics:'क्लासिक',Adventure:'एडवेंचर'},
  },
  hi_en: {
    title:'Jaiho91 RTP aur game list', short:'RTP', link:'RTP aur games dekhein',
    description:'Jaiho91 ki demo RTP list dekhein, games khojein aur favourites save karein. List roz dopahar 12 baje IST par badalti hai.',
    notice:'Yeh percentages demo ke liye bante hain. Yeh asli ya live RTP, jeetne ka chance ya khelne ki salah nahi hain.',
    updated:'Roz dopahar 12 baje IST par update', search:'Game khojein', category:'Category', all:'Sabhi', saved:'Favourites',
    demo:'Aaj ki demo list', catalog:'Sabhi games', empty:'Koi game nahi mila.', count:'Games mile:', save:'Save karein', remove:'Hataayein', demoValue:'Demo RTP',
    explanation:'RTP ka kya matlab hai?', answer:'RTP (Return to Player) kisi game ka lambe samay ka theoretical average hota hai. Isse ek round ya session ka nateeja pata nahi chalta. Is list mein asli RTP data juda nahi hai.',
    themes:{Mythology:'Mythology',Animals:'Animals',Cards:'Cards',Classics:'Classics',Adventure:'Adventure'},
  },
};

export const rtpCopy = locale => copy[locale.prefix ? 'hi_en' : 'hi'];

export function rtpCatalog(raw) {
  return normalizeGames(raw).games.map(game => {
    const image = game.image?.match(/^\.\/assets\/games\/([a-z0-9-]+-320\.webp)$/)?.[1];
    if (game.image && !image) throw new Error('Unsupported RTP cover for ' + game.id);
    return {id:game.id,name:game.name,theme:game.theme,aliases:game.aliases,image:image ? '/assets/rtp/games/' + image : null};
  });
}

export function rtpBody(c, games, h) {
  const options = [...new Set(games.map(game => game.theme))].map(theme =>
    `<option value="${h(theme)}">${h(c.themes[theme] ?? theme)}</option>`).join('');
  return `<section class="wrap rtp" data-rtp data-copy="${h(JSON.stringify(c))}">
<p class="rtp-notice" id="rtp-notice">${h(c.notice)}</p>
<div class="rtp-controls" hidden>
<label>${h(c.search)} <input type="search" data-rtp-search></label>
<label>${h(c.category)} <select data-rtp-category><option value="all">${h(c.all)}</option>${options}</select></label>
<label class="rtp-saved"><input type="checkbox" data-rtp-saved> ${h(c.saved)}</label>
</div>
<div class="rtp-results" data-rtp-demo hidden aria-describedby="rtp-notice">
<div class="section-heading"><div><h2>${h(c.demo)}</h2><p>${h(c.updated)}</p></div></div>
<div class="rtp-grid" data-rtp-ranked></div></div>
<div class="section-heading"><h2>${h(c.catalog)}</h2><p class="sr-only" data-rtp-count role="status"></p></div>
<div class="rtp-grid" data-rtp-catalog>
${games.map(game => `<article class="rtp-tile" data-game="${h(game.id)}" data-theme="${h(game.theme)}" data-search="${h([game.name, ...game.aliases].join(' ').toLowerCase())}">
${game.image ? `<img src="${h(game.image)}" width="320" height="480" alt="" loading="lazy" decoding="async">` : ''}
<div class="rtp-tile-copy"><h3>${h(game.name)}</h3><p>${h(c.themes[game.theme] ?? game.theme)}</p><button type="button" class="rtp-save" aria-pressed="false" hidden>${h(c.save)}</button></div></article>`).join('')}
</div><p data-rtp-empty hidden>${h(c.empty)}</p>
<details class="rtp-about"><summary>${h(c.explanation)}</summary><p>${h(c.answer)}</p></details>
</section>
<script src="/assets/rtp/catalog.js" type="module"></script>`;
}
