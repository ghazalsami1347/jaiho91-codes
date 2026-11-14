import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locales, pathFor } from '../content/locales.mjs';
import { localGuides } from '../content/guides.mjs';
import { tutorials } from '../content/tutorials.mjs';
import { rtpBody, rtpCatalog, rtpCopy } from './rtp.mjs';
import { tiers, validateRegistry, listCodes } from './registry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'dist');
const analytics = process.argv.includes('--analytics');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const now = Date.now();
const registry = validateRegistry(await json('content/codes.json'), now);
const rtpSettings = await json('content/rtp.json');
const games = rtpCatalog(await json('content/rtp-games.json'), rtpSettings.percentages);
const rtpTemplate = await readFile(resolve(root, 'content/rtp-template.html'), 'utf8');
const { active, archive } = listCodes(registry, now);
const arg = process.argv.find(value => value.startsWith('--origin='));
const basePath = process.argv.find(value => value.startsWith('--base-path='))?.slice('--base-path='.length) ?? '';
if (basePath && (!/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(basePath) || basePath.split('/').some(part => part === '.' || part === '..'))) {
  throw new Error('Set --base-path to a site subdirectory without a trailing slash.');
}
const vercelBuild = process.argv.includes('--vercel');
const production = process.argv.includes('--production') || (vercelBuild && process.env.VERCEL_ENV === 'production');
const vercelDomain = vercelBuild && process.env.VERCEL_PROJECT_PRODUCTION_URL;
const configuredOrigin = arg?.slice('--origin='.length) ?? (
  (await json('site.json')).origin || (vercelDomain ? 'https://' + vercelDomain : '')
);
const origin = configuredOrigin ? new URL(configuredOrigin) : null;
if (origin && (origin.protocol !== 'https:' || origin.href !== origin.origin + '/' || /^(localhost|127\.|.*\.example$|example\.com$)/i.test(origin.hostname))) {
  throw new Error('Set origin to your real HTTPS site origin without a path, query or fragment.');
}
if (production && !origin) throw new Error('Set the production origin in site.json or enable Vercel System Environment Variables.');
const allowIndexing = !!origin && (!vercelBuild || production);
const publicPath = path => basePath + path;
const absolute = path => origin ? new URL(publicPath(path), origin).href : publicPath(path);
const h = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const schema = data => JSON.stringify(data).replace(/</g, '\\u003c');
const alternates = path => [
  ...Object.values(locales).map(locale => [locale.lang, absolute(pathFor(locale, path))]),
  ['x-default', absolute(path)],
];
function mountHtml(html) {
  if (!basePath) return html;
  return html.replace(/\b(href|src|poster|srcset)="([^"]*)"/g, (attribute, name, value) => {
    if (!/^\/(?!\/)/.test(value)) return attribute;
    const url = name === 'srcset' ? value.replace(/(^|,\s*)\/(?!\/)/g, '$1' + basePath + '/') : publicPath(value);
    return `${name}="${url}"`;
  });
}
function displayTime(locale, value, withTime = false) {
  const options = { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata' };
  if (withTime) Object.assign(options, { hour:'numeric', minute:'2-digit' });
  const label = new Intl.DateTimeFormat(locale.prefix ? 'en-IN' : locale.lang, options).format(new Date(value));
  return `<time datetime="${h(value)}">${h(label)}${withTime ? ' IST' : ''}</time>`;
}

const paths = {
  ticket:'M3 8V5h18v3a4 4 0 0 0 0 8v3H3v-3a4 4 0 0 0 0-8Zm11-2v2m0 3v2m0 3v2',
  shield:'M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Zm-3-10 2 2 4-4',
  help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3-13a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01',
  phone:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm4 17h2',
  key:'M14 7a5 5 0 1 1-2 4L4 19H2v-3l8-8m6-3h.01',
  arrow:'M4 12h15m-6-6 6 6-6 6',
  out:'M7 17 17 7M7 7h10v10',
  copy:'M8 8h12v12H8zM16 4H4v12',
  check:'m5 12 4 4L19 6',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2',
  menu:'M4 6h16M4 12h16M4 18h16',
  search:'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5 0 5 5',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
  close:'m6 6 12 12M18 6 6 18',
};
const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const guideLink = guide => `/guides/${guide.slug}/`;
const brand = l => `<a href="${pathFor(l, '/')}" class="brand" aria-label="Jaiho91 · ${l.home}"><img src="/assets/mark.png" alt="" width="38" height="38"><span>Jaiho<span class="brand-number">91</span></span></a>`;
const sourceChannel = 'https://t.me/s/jaiho91official';
const apkUrl = 'https://d1i9jwkbb2057y.cloudfront.net/jaiho91_SEO_6BV0FPZR264.apk';
const androidPath = '/guides/android-app/';
const downloadButton = l => `<a class="button download-button" href="${h(apkUrl)}" data-track="download_apk" rel="external noreferrer">${icon('download')} ${l.download}</a>`;

function installPopup(l) {
  return `<section class="install-popup" data-install-popup aria-labelledby="install-title" hidden>
<img src="/assets/mark.png" width="44" height="44" alt="">
<div class="install-copy"><strong id="install-title">${l.installTitle}</strong><small>Android APK</small></div>
<a class="install-action" href="${h(apkUrl)}" data-track="download_apk" rel="external noreferrer" aria-label="${l.installAction} · Android APK">${l.installAction}</a>
<button class="install-dismiss" type="button" aria-label="${l.dismissInstall}">${icon('close')}</button>
</section>`;
}

function layout(l, { path, title, description, body, article, breadcrumb, lastmod, index = true }) {
  const arcade = path === '/rtp/';
  const local = pathFor(l, path);
  const url = absolute(local);
  const siteId = absolute('/#website');
  const publisherId = absolute('/#publisher');
  const page = {
    '@type': ['/guides/', '/tutorials/', '/rtp/'].includes(path) ? 'CollectionPage' : 'WebPage',
    '@id':url + '#page', url, name:title, description, inLanguage:l.lang, isPartOf:{'@id':siteId},
    ...(lastmod ? {dateModified:lastmod} : {}),
  };
  const graph = [
    { '@type':'Organization', '@id':publisherId, name:'Jaiho91', url:absolute('/about/') },
    { '@type':'WebSite', '@id':siteId, url:absolute('/'), name:'Jaiho91', inLanguage:Object.values(locales).map(locale => locale.lang), publisher:{'@id':publisherId} },
    page,
  ];
  if (article) graph.push({
    '@type':'Article', '@id':url + '#article', headline:article, description, inLanguage:l.lang,
    author:{'@id':publisherId}, publisher:{'@id':publisherId}, mainEntityOfPage:{'@id':page['@id']},
  });
  if (path !== '/' && index) {
    const parents = article ? [['/guides/', l.guides]] : [];
    page.breadcrumb = {'@id':url + '#breadcrumbs'};
    graph.push({ '@type':'BreadcrumbList', '@id':url + '#breadcrumbs', itemListElement:[['/', l.home], ...parents, [path, breadcrumb]].map(([item, name], i) => ({
      '@type':'ListItem', position:i + 1, name, item:absolute(pathFor(l, item)),
    })) });
  }
  const canIndex = allowIndexing && index;
  const alternate = alternates(path).map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${h(href)}">`).join('\n');
  const socialImage = h(absolute(path === '/rtp/' ? '/assets/rtp/share.jpg' : '/assets/social.jpg'));
  const languageSwitch = Object.values(locales).map(locale => {
    const target = pathFor(locale, index ? path : '/');
    return `<a href="${target}" lang="${locale.lang}"${locale === l ? ' aria-current="true"' : ''}>${locale.label}</a>`;
  }).join('');
  const primary = [['/rtp/', rtpCopy(l).short], ['/codes/', l.codes]];
  const utility = [[androidPath, l.android], ['/tutorials/', l.tutorials], ['/guides/', l.guides]];
  const navLinks = links => links.map(([href, label]) => `<a href="${pathFor(l, href)}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const feedback = Object.fromEntries(['expired','copy','copied','selected','noTier','showing','copiedFor','copyFallback','found'].map(key => [key, l[key]]));
  return `<!doctype html>
<html lang="${l.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(title)}</title>
<meta name="description" content="${h(description)}">
<meta name="robots" content="${canIndex ? 'index,follow' : 'noindex,follow'}">
<meta name="theme-color" content="#100d15">
${canIndex ? `<link rel="canonical" href="${h(url)}">
${alternate}` : ''}
<meta property="og:type" content="${article ? 'article' : 'website'}">
<meta property="og:locale" content="hi_IN">
<meta property="og:site_name" content="Jaiho91">
<meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(description)}">
${origin ? `<meta property="og:url" content="${h(url)}">` : ''}
<meta property="og:image" content="${socialImage}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${h(l.footer)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(title)}">
<meta name="twitter:description" content="${h(description)}">
<meta name="twitter:image" content="${socialImage}">
<meta name="twitter:image:alt" content="${h(l.footer)}">
<link rel="icon" href="/assets/mark.png" type="image/png" sizes="76x76">
<link rel="preload" href="/assets/manrope.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script type="module" src="/assets/site.js"></script>
${arcade ? `<link rel="stylesheet" href="/assets/rtp/arcade.css">
<link rel="stylesheet" href="/assets/rtp/integration.css">
<script type="module" src="/assets/rtp/app.js"></script>` : ''}
${canIndex ? `<script type="application/ld+json">${schema({'@context':'https://schema.org','@graph':graph})}</script>` : ''}
</head>
<body data-ui="${h(JSON.stringify(feedback))}"${analytics && index ? ' data-analytics' : ''}>
<a class="skip" href="#main">${l.skip}</a>
<header class="site-header"><div class="wrap header-inner">
${brand(l)}
<button class="menu-button" type="button" hidden aria-expanded="false" aria-controls="utility-nav" aria-label="${l.menu}">${icon('menu')}</button>
<nav id="nav" aria-label="${l.prefix ? 'Main navigation' : 'मुख्य नेविगेशन'}">
<div class="primary-nav">${navLinks(primary)}</div>
<div class="utility-nav" id="utility-nav">${navLinks(utility)}</div>
</nav>
<nav class="language-switch" aria-label="${l.prefix ? 'Bhasha' : 'भाषा'}">${languageSwitch}</nav>
</div></header>
${path === '/' || path === androidPath ? installPopup(l) : ''}
<main id="main" tabindex="-1">${body}</main>
<footer class="site-footer"><div class="wrap footer-grid"><div>${brand(l)}<p>${l.footer}</p></div>
<nav aria-label="${l.prefix ? 'Footer links' : 'फ़ुटर लिंक'}">${navLinks([...primary, ...utility])}<a href="${pathFor(l, '/about/')}">${l.about}</a><a href="${pathFor(l, '/privacy/')}">${l.privacy}</a></nav></div>
<div class="wrap footer-bottom"><span>Jaiho91 · ${l.india}</span><span>${l.adults}</span></div></footer>
</body>
</html>
`;
}

function guideCard(l, guide) {
  const url = pathFor(l, guideLink(guide));
  return `<article class="guide-card"><span class="glyph">${icon(guide.icon)}</span><span class="guide-category">${h(guide.category)}</span>
<h3><a href="${url}" data-track="open_guide">${h(guide.title)}</a></h3><p>${h(guide.description)}</p>
<a class="text-link" href="${url}" data-track="open_guide" aria-label="${l.read}: ${h(guide.title)}">${l.read} ${icon('arrow')}</a></article>`;
}

function codeCard(l, entry, expired = false) {
  const label = entry.withdrawnAt ? l.withdrawn : expired ? l.expired : l.checked;
  const terms = entry.localizedTerms?.[l.prefix ? 'hi_en' : 'hi'] ?? entry.terms;
  return `<article class="code-card" data-tier="${h(entry.tier)}" data-expires="${h(entry.expiresAt)}"${expired ? ' data-archived' : ''}>
<div class="card-top"><h3><span class="glyph">${icon('ticket')}</span> ${h(entry.tier)}</h3><span class="badge${expired ? ' muted' : ''}" data-status>${expired ? icon('clock') : icon('check')} <span>${label}</span></span></div>
<div class="code-value"><code>${h(entry.code)}</code>${expired ? '' : `<button class="copy" type="button" hidden aria-label="${l.copyFor} ${h(entry.tier)}"><span class="copy-symbol">${icon('copy')}${icon('check')}</span><span data-copy-label>${l.copy}</span></button>`}</div>
<div class="code-meta"><span>${icon('clock')} ${l.deadline} ${displayTime(l, entry.expiresAt, true)}</span><a href="${h(entry.sourceUrl)}" data-track="source_click" rel="external noreferrer">${l.source} ${icon('out')}</a></div>
<details class="code-terms"><summary>${l.eligibility}</summary><p>${h(terms)} ${l.sourceReviewed} ${displayTime(l, entry.verifiedAt)}. ${l.codeTerms}</p></details></article>`;
}

function tracker(l) {
  return `<section id="code-status" class="wrap section tracker" aria-labelledby="status-title">
<div class="section-heading"><div><h2 id="status-title">${l.status}</h2><p>${l.statusIntro}</p></div><span class="review">${icon('clock')} ${l.reviewed} ${displayTime(l, registry.lastReviewedAt, true)}</span></div>
<div class="status-grid"><div>
${active.length ? `<fieldset class="tier-switch" data-code-filters hidden><legend class="sr-only">${l.choose}</legend><div>${tiers.map(tier => `<label><input type="radio" name="vip-tier" value="${h(tier)}"${tier === active[0].tier ? ' checked' : ''}><span>${h(tier)}</span></label>`).join('')}</div></fieldset>` : ''}
<div class="code-list" data-code-list>${active.map(entry => codeCard(l, entry)).join('')}</div>
<div class="empty" data-code-empty${active.length ? ' hidden' : ''}><span class="glyph">${icon('ticket')}</span><h3>${l.noCode}</h3><p>${l.noCodeIntro}</p><a class="text-link" href="${sourceChannel}" data-track="source_click" rel="external noreferrer">${l.announcements} ${icon('out')}</a></div>
<p class="sr-only" role="status" data-code-feedback></p><p class="code-note">${l.termsNote}</p>
</div>
<aside class="aside-card"><span class="glyph">${icon('shield')}</span><h3>${l.before}</h3><ol><li>${l.stepTier}</li><li>${l.stepCopy}</li><li>${l.stepTerms}</li></ol>
<a class="text-link" href="${pathFor(l, '/guides/how-to-redeem/')}" data-track="open_guide">${l.redeem} ${icon('arrow')}</a><div class="aside-foot"><a href="${sourceChannel}" data-track="source_click" rel="external noreferrer">${l.announcements} ${icon('out')}</a></div></aside>
</div></section>`;
}

function pageIntro(l, pathLabel, heading, intro, parent = false) {
  return `<div class="wrap page-intro"><nav class="breadcrumbs" aria-label="${l.prefix ? 'Breadcrumb' : 'पेज का रास्ता'}"><a href="${pathFor(l, '/')}">${l.home}</a><span aria-hidden="true">/</span>${parent ? `<a href="${pathFor(l, '/guides/')}">${l.guides}</a><span aria-hidden="true">/</span>` : ''}<span aria-current="page">${h(pathLabel)}</span></nav><h1>${h(heading)}</h1><p>${h(intro)}</p></div>`;
}

const sectionText = sections => sections.map(([heading, paragraph]) => `<h2>${h(heading)}</h2><p>${h(paragraph)}</p>`).join('');
const tutorialsPath = '/tutorials/';
const tutorialMenu = (l, items, n) => `<ul class="tutorial-menu">${items.map(item => `<li><a href="#${item.slug}">${h(item.title[n])}</a></li>`).join('')}</ul>`;
function tutorialCard(l, item, n) {
  const base = '/assets/tutorials/' + item.slug;
  const title = h(item.title[n]);
  return `<section class="tutorial-card" id="${item.slug}" aria-labelledby="${item.slug}-title">
<h2 id="${item.slug}-title">${title}</h2>
<details class="tutorial-player"><summary>${l.tutorialVideo}</summary>
<video controls playsinline preload="none" poster="${base}-1.webp" width="540" height="960" aria-label="${title}"><source src="${base}.mp4" type="video/mp4"><a href="${base}.mp4">${l.tutorialFallback}</a></video></details>
<h3>${l.tutorialSteps}</h3>
<ol class="tutorial-steps">${item.steps.map((step, i) => `<li><figure><a href="${base}-${i + 1}.webp"><img src="${base}-${i + 1}.webp" width="480" height="854" loading="lazy" decoding="async" alt="${h(step[n])}"></a><figcaption><span aria-hidden="true">${i + 1}</span>${h(step[n])}</figcaption></figure></li>`).join('')}</ol>
</section>`;
}

function localizedPages(l) {
  const guides = localGuides(l);
  const rtp = rtpCopy(l, Object.keys(rtpSettings.percentages).length > 0);
  const n = l.prefix ? 1 : 0;
  const lastmod = registry.lastReviewedAt;
  const homeTitle = l.prefix ? 'Jaiho91 RTP, Promo Codes aur Android APK' : 'Jaiho91 RTP, प्रोमो कोड और Android APK';
  const result = [{
    path:'/', title:homeTitle, description:l.heroMeta,
    body:`<section class="hero"><div class="wrap hero-grid"><div class="hero-copy">
<h1>Jaiho91</h1><p class="hero-description">${l.heroIntro}</p>
<div class="hero-actions"><a class="button" href="${pathFor(l, '/rtp/')}">${rtp.short} ${icon('arrow')}</a><a class="button secondary" href="${pathFor(l, '/codes/')}" data-track="check_codes">${l.codes} ${icon('arrow')}</a></div>
<div class="hero-help"><a class="text-link" href="${h(apkUrl)}" data-track="download_apk" rel="external noreferrer">${icon('download')} ${l.download}</a><a class="text-link" href="${pathFor(l, tutorialsPath)}">${l.tutorialLink} ${icon('arrow')}</a></div></div>
<div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="spark spark-one">✦</span><span class="spark spark-two">✦</span><span class="spark spark-three">✧</span><img src="/assets/jaiho91-badge.webp" srcset="/assets/jaiho91-badge-small.webp 420w, /assets/jaiho91-badge.webp 720w" sizes="(max-width: 640px) 135px, 344px" alt="" width="720" height="720" decoding="async"></div></div></section>
<section class="section guide-section"><div class="wrap"><div class="section-heading"><div><h2>${l.guideTitle}</h2><p>${l.guideHomeIntro}</p></div><a class="text-link" href="${pathFor(l, '/guides/')}">${l.allGuides} ${icon('arrow')}</a></div><div class="guide-grid">${guides.slice(0,3).map(guide => guideCard(l, guide)).join('')}</div></div></section>
<section class="wrap section faq"><div><h2>${l.questions}</h2><p>${l.questionsIntro}</p></div><div>${l.faq.map(([question, answer]) => `<details><summary>${h(question)}</summary><p>${h(answer)}</p></details>`).join('')}</div></section>`,
  }, {
    path:'/rtp/', title:rtp.title + ' | Jaiho91', breadcrumb:rtp.short, description:rtp.description,
    body:rtpBody(rtpTemplate, l, games, rtpSettings, h, now),
  }, {
    path:'/codes/', title:l.codeTitle + ' | Jaiho91 Codes', breadcrumb:l.codes, description:l.codeMeta, lastmod,
    body:`${pageIntro(l, l.codes, l.codeTitle, l.codeIntro)}${tracker(l)}
<section class="wrap section history" id="code-history"><div class="section-heading"><div><h2>${l.history}</h2><p>${l.historyIntro}</p></div></div><div class="code-list" data-archive>${archive.map(entry => codeCard(l, entry, true)).join('')}</div><p data-archive-empty${archive.length ? ' hidden' : ''}>${l.noHistory}</p></section>`,
  }, {
    path:'/guides/', title:l.guideTitle + ' | Android APK, OTP', breadcrumb:l.guides, description:l.guideMeta,
    body:`${pageIntro(l, l.guides, l.guideTitle, l.guideIntro)}
<section class="wrap section guide-index" aria-label="${l.guides}">
<a class="text-link" href="${pathFor(l, tutorialsPath)}">${l.tutorialLink} ${icon('arrow')}</a>
<div class="guide-search" data-guide-search hidden><label for="guide-query">${l.search}</label><div>${icon('search')}<input id="guide-query" type="search" placeholder="${l.example}"></div></div>
<p class="sr-only" role="status" data-guide-count></p><div class="guide-grid" data-guide-grid>${guides.map(guide => guideCard(l, guide)).join('')}</div><p data-guide-empty hidden>${l.noGuides}</p></section>`,
  }, {
    path:tutorialsPath, title:l.tutorialTitle + ' | Jaiho91 Codes', breadcrumb:l.tutorials, description:l.tutorialMeta,
    body:`${pageIntro(l, l.tutorials, l.tutorialTitle, l.tutorialIntro)}
<div class="wrap tutorials"><p class="tutorial-note">${l.tutorialNote}</p>${tutorialMenu(l, tutorials, n)}
${tutorials.map(item => tutorialCard(l, item, n)).join('')}</div>`,
  }];
  for (const guide of guides) {
    const path = guideLink(guide);
    result.push({
      path, title:guide.title + ' | Jaiho91 Codes', description:guide.description, article:guide.title, breadcrumb:guide.title,
      body:`${pageIntro(l, guide.title, guide.title, guide.description, true)}
${path === androidPath ? `<div class="wrap download-panel">${downloadButton(l)}<p>${l.apkNote}</p></div>` : ''}
<article class="wrap section prose">${sectionText(guide.sections)}
<div class="prose-actions"><a class="button" href="${pathFor(l, '/codes/')}">${l.check} ${icon('arrow')}</a>
${guide.slug === 'how-to-redeem' ? `<a class="text-link" href="${pathFor(l, tutorialsPath)}#promo-voucher">${l.tutorialLink} ${icon('arrow')}</a>` : `<a class="text-link" href="${pathFor(l, '/guides/')}">${l.allGuides} ${icon('arrow')}</a>`}</div></article>`,
    });
  }
  result.push({
    path:'/about/', title:l.aboutTitle + ' | Jaiho91 Codes', breadcrumb:l.about, description:l.aboutIntro,
    body:`${pageIntro(l, l.about, l.aboutTitle, l.aboutIntro)}<section class="wrap section prose">${sectionText(l.aboutSections)}</section>`,
  }, {
    path:'/privacy/', title:l.privacy + ' | Jaiho91 Codes', breadcrumb:l.privacy, description:l.privacyIntro,
    body:`${pageIntro(l, l.privacy, l.privacy, l.privacyIntro)}<section class="wrap section prose">${sectionText(l.privacySections)}${analytics ? `<h2>Analytics</h2><p>${l.analyticsPrivacy}</p>` : ''}</section>`,
  });
  return result;
}

const pages = Object.values(locales).flatMap(locale => localizedPages(locale).map(page => ({ ...page, locale })));
pages.push({
  locale:locales.hi, path:'/404.html', title:locales.hi.missing + ' | Jaiho91 Codes', description:locales.hi.missingIntro, index:false,
  body:`${pageIntro(locales.hi, locales.hi.missing, locales.hi.missing, locales.hi.missingIntro)}
<div class="wrap section"><a class="button" href="/">${locales.hi.back} ${icon('arrow')}</a></div>`,
});

await mkdir(out, { recursive:true });
await cp(resolve(root, 'assets'), resolve(out, 'assets'), { recursive:true });
const artworkFields = ['image', 'imageSmall', 'imageLarge'];
const publicGames = games.map(game => ({
  ...game,
  ...Object.fromEntries(artworkFields.map(field => [field, game[field] ? publicPath(game[field]) : null])),
}));
await writeFile(resolve(out, 'assets/rtp/games.json'), JSON.stringify(publicGames));
for (const page of pages) {
  const path = pathFor(page.locale, page.path);
  const file = resolve(out, path.slice(1), ...(path.endsWith('/') ? ['index.html'] : []));
  await mkdir(resolve(file, '..'), { recursive:true });
  await writeFile(file, mountHtml(layout(page.locale, page)));
}
const listed = allowIndexing ? pages.filter(page => page.index !== false) : [];
await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${listed.map(page => `  <url>
    <loc>${h(absolute(pathFor(page.locale, page.path)))}</loc>
${page.lastmod ? `    <lastmod>${h(page.lastmod)}</lastmod>\n` : ''}${alternates(page.path).map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${h(href)}"/>`).join('\n')}
  </url>`).join('\n')}
</urlset>
`);
await writeFile(resolve(out, 'robots.txt'), allowIndexing ? `User-agent: *
Allow: /
Disallow: ${publicPath('/_admin/')}
Disallow: ${publicPath('/api/')}
Sitemap: ${absolute('/sitemap.xml')}
` : 'User-agent: *\nAllow: /\n');
console.log(`Built ${pages.length - 1} localized pages and a custom 404. ${active.length} current source entries, ${archive.length} archived. ${allowIndexing ? 'Indexing enabled.' : 'Preview pages carry noindex.'}`);

export const siteOrigin = origin?.origin;
export const publicPaths = new Set(pages.filter(page => page.index !== false).map(page => pathFor(page.locale, page.path)));
