import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faq, guides } from '../content/guides.mjs';
import { tiers, validateRegistry, listCodes } from './registry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'dist');
const analytics = process.argv.includes('--analytics');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const now = Date.now();
const registry = validateRegistry(await json('content/codes.json'), now);
const { active, archive } = listCodes(registry, now);
const arg = process.argv.find(value => value.startsWith('--origin='));
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
const absolute = path => origin ? new URL(path, origin).href : path;
const h = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const schema = data => JSON.stringify(data).replace(/</g, '\\u003c');
const dateFormat = new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata' });
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour:'numeric', minute:'2-digit', timeZone:'Asia/Kolkata' });
const date = value => dateFormat.format(new Date(value));
const deadline = value => `${date(value)}, ${timeFormat.format(new Date(value))} IST`;
const time = (value, formatter = date) => `<time datetime="${h(value)}">${h(formatter(value))}</time>`;

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
};
const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const guideLink = guide => `/guides/${guide.slug}/`;
const brand = () => `<a href="/" class="brand" aria-label="Jaiho91 Codes home"><img src="/assets/mark.png" alt="" width="38" height="38"><span>Jaiho<span class="brand-number">91</span><small>CODES</small></span></a>`;
const sourceChannel = 'https://t.me/s/jaiho91official';
const apkUrl = 'https://d1i9jwkbb2057y.cloudfront.net/jaiho91_SEO_6BV0FPZR264.apk';
const androidPath = '/guides/android-app/';
const downloadButton = () => `<a class="button download-button" href="${h(apkUrl)}" data-track="download_apk" rel="external noreferrer">${icon('download')} Download APK</a>`;
const links = [['/', 'Home'], ['/codes/', 'Promo codes'], [androidPath, 'Android APK'], ['/guides/', 'Guides']];
const pages = [];

function layout({ path, title, description, body, article, breadcrumb, index = true }) {
  const url = absolute(path);
  const pageId = url + '#page';
  const siteId = absolute('/#website');
  const publisherId = absolute('/#publisher');
  const page = {
    '@type': path === '/guides/' ? 'CollectionPage' : 'WebPage',
    '@id':pageId, url, name:title, description, inLanguage:'en-IN', isPartOf:{'@id':siteId},
  };
  const graph = [
    { '@type':'Organization', '@id':publisherId, name:'Jaiho91 Codes', url:absolute('/about/') },
    { '@type':'WebSite', '@id':siteId, url:absolute('/'), name:'Jaiho91 Codes', inLanguage:'en-IN', publisher:{'@id':publisherId} },
    page,
  ];
  if (article) graph.push({
    '@type':'Article', '@id':url + '#article', headline:article, description, inLanguage:'en-IN',
    author:{'@id':publisherId}, publisher:{'@id':publisherId}, mainEntityOfPage:{'@id':pageId},
  });
  if (path !== '/' && index) {
    const parents = article ? [['/guides/', 'Guides']] : [];
    const breadcrumbId = url + '#breadcrumbs';
    page.breadcrumb = {'@id':breadcrumbId};
    graph.push({ '@type':'BreadcrumbList', '@id':breadcrumbId, itemListElement:[['/', 'Home'], ...parents, [path, breadcrumb]].map(([item, name], i) => ({
      '@type':'ListItem', position:i + 1, name, item:absolute(item),
    })) });
  }
  const canIndex = allowIndexing && index;
  const socialImage = h(absolute('/assets/social.jpg'));
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(title)}</title>
<meta name="description" content="${h(description)}">
<meta name="robots" content="${canIndex ? 'index,follow' : 'noindex,follow'}">
<meta name="theme-color" content="#100d15">
${canIndex ? `<link rel="canonical" href="${h(url)}">` : ''}
<meta property="og:type" content="${article ? 'article' : 'website'}">
<meta property="og:locale" content="en_IN">
<meta property="og:site_name" content="Jaiho91 Codes">
<meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(description)}">
${origin ? `<meta property="og:url" content="${h(url)}">` : ''}
<meta property="og:image" content="${socialImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Jaiho91 Codes, an independent code tracker">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(title)}">
<meta name="twitter:description" content="${h(description)}">
<meta name="twitter:image" content="${socialImage}">
<meta name="twitter:image:alt" content="Jaiho91 Codes, an independent code tracker">
<link rel="icon" href="/assets/mark.png" type="image/png">
<link rel="preload" href="/assets/manrope.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
${canIndex ? `<script type="application/ld+json">${schema({'@context':'https://schema.org','@graph':graph})}</script>` : ''}
</head>
<body${analytics && index ? ' data-analytics' : ''}>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap header-inner">
${brand()}
<button class="menu-button" type="button" hidden aria-expanded="false" aria-controls="nav" aria-label="Toggle navigation">${icon('menu')}</button>
<nav id="nav" aria-label="Main navigation">${links.map(([href, label]) => {
  const current = href === path || (href !== '/' && path.startsWith(href));
  return `<a href="${href}"${current ? ` aria-current="${href === path ? 'page' : 'location'}"` : ''}>${label}</a>`;
}).join('')}</nav>
<a class="button small header-cta" data-track="check_codes" href="${path === '/codes/' || path === '/' ? '#code-status' : '/codes/#code-status'}">Check codes ${icon('out')}</a>
</div></header>
<main id="main" tabindex="-1">${body}</main>
<footer class="site-footer"><div class="wrap footer-grid"><div>${brand()}<p>Independent Jaiho91 code tracking and app guides.</p></div>
<nav aria-label="Footer navigation"><a href="/codes/">Promo codes</a><a href="${androidPath}">Android APK</a><a href="/guides/">Guides</a><a href="/about/">Editorial policy</a><a href="/privacy/">Privacy</a></nav></div>
<div class="wrap footer-bottom"><span>Jaiho91 Codes · India edition · Times in IST</span><span>Informational coverage · 18+</span></div></footer>
</body>
</html>
`;
}

function guideCard(guide) {
  return `<article class="guide-card">
<span class="glyph">${icon(guide.icon)}</span><span class="guide-category">${h(guide.category)}</span>
<h3><a href="${guideLink(guide)}" data-track="open_guide">${h(guide.title)}</a></h3><p>${h(guide.description)}</p>
<a class="text-link" href="${guideLink(guide)}" data-track="open_guide" aria-label="Read guide: ${h(guide.title)}">Read guide ${icon('arrow')}</a></article>`;
}

function codeCard(entry, expired = false) {
  const label = entry.withdrawnAt ? 'Withdrawn' : expired ? 'Expired' : 'Source checked';
  return `<article class="code-card" data-tier="${h(entry.tier)}" data-expires="${h(entry.expiresAt)}"${expired ? ' data-archived' : ''}>
<div class="card-top"><h3><span class="glyph">${icon('ticket')}</span> ${h(entry.tier)}</h3><span class="badge${expired ? ' muted' : ''}" data-status>${expired ? icon('clock') : icon('check')} <span>${label}</span></span></div>
<div class="code-value"><code>${h(entry.code)}</code>${expired ? '' : `<button class="copy" type="button" hidden aria-label="Copy code for ${h(entry.tier)}"><span class="copy-symbol">${icon('copy')}${icon('check')}</span><span data-copy-label>Copy code</span></button>`}</div>
<div class="code-meta"><span>${icon('clock')} Deadline ${time(entry.expiresAt, deadline)}</span><a href="${h(entry.sourceUrl)}" data-track="source_click" rel="external noreferrer">Source post ${icon('out')}</a></div>
<details class="code-terms"><summary>Eligibility and verification</summary><p>${h(entry.terms)} Source reviewed ${time(entry.verifiedAt)}. Redemption depends on the account and current availability.</p></details></article>`;
}

function tracker({ full = false } = {}) {
  return `<section id="code-status" class="wrap section tracker" aria-labelledby="status-title">
<div class="section-heading"><div><h2 id="status-title">Latest code status</h2><p>Check your VIP tier, source post and expiry time in IST.</p></div><span class="review">${icon('clock')} Last checked ${time(registry.lastReviewedAt, deadline)}</span></div>
<div class="status-grid"><div>
${active.length ? `<fieldset class="tier-switch" data-code-filters hidden><legend class="sr-only">Choose your VIP tier</legend><div>${tiers.map(tier => `<label><input type="radio" name="vip-tier" value="${h(tier)}"${tier === active[0].tier ? ' checked' : ''}><span>${h(tier)}</span></label>`).join('')}</div></fieldset>` : ''}
<div class="code-list" data-code-list>${active.map(entry => codeCard(entry)).join('')}</div>
<div class="empty" data-code-empty${active.length ? ' hidden' : ''}><span class="glyph">${icon('ticket')}</span><h3>No source-checked code available</h3><p>Check the latest Jaiho91 announcement for your tier. New entries appear here after review.</p><a class="text-link" href="${sourceChannel}" data-track="source_click" rel="external noreferrer">View announcements ${icon('out')}</a></div>
<p class="sr-only" role="status" data-code-feedback></p>
<p class="code-note">This tracker confirms what the source posted. Check the in-app terms for account eligibility and claim limits.</p>
${full ? '' : '<a class="text-link" href="/codes/#code-history">View code history ' + icon('arrow') + '</a>'}
</div>
<aside class="aside-card"><span class="glyph">${icon('shield')}</span><h3>Before you redeem</h3><ol><li>Confirm your VIP tier.</li><li>Copy the entry exactly as written.</li><li>Check the deadline and in-app terms.</li></ol><a class="text-link" href="/guides/how-to-redeem/" data-track="open_guide">How to redeem ${icon('arrow')}</a><div class="aside-foot"><a href="${sourceChannel}" data-track="source_click" rel="external noreferrer">Jaiho91 announcements ${icon('out')}</a></div></aside>
</div>
</section>`;
}

function pageIntro(pathLabel, heading, intro, parent) {
  return `<div class="wrap page-intro"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span>${parent ? '<a href="/guides/">Guides</a><span aria-hidden="true">/</span>' : ''}<span aria-current="page">${h(pathLabel)}</span></nav><h1>${h(heading)}</h1><p>${h(intro)}</p></div>`;
}

pages.push({
  path:'/', title:'Jaiho91 Promo Codes & Android APK Download | India',
  description:'Check Jaiho91 promo codes for VIP 0 and VIP 1–20, see expiry times in IST, and find the Android APK download and redeem code guide.',
  body:`<section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><p class="eyebrow"><span></span> INDEPENDENT CODE TRACKER</p>
<h1>Jaiho91 <em>promo codes</em></h1><p class="hero-description">Check the latest Jaiho91 gift codes for your VIP level, see when they expire in IST, or download the app for Android.</p>
<div class="hero-actions">${downloadButton()}<a class="button secondary" href="#code-status" data-track="check_codes">Check codes ${icon('arrow')}</a></div>
<a class="text-link hero-help" href="${androidPath}">Android download help ${icon('arrow')}</a></div>
<div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="spark spark-one">✦</span><span class="spark spark-two">✦</span><span class="spark spark-three">✧</span><img src="/assets/jaiho91-badge.webp" srcset="/assets/jaiho91-badge-small.webp 420w, /assets/jaiho91-badge.webp 720w" sizes="(max-width: 640px) 135px, 344px" alt="" width="720" height="720" decoding="async"></div></div></section>
${tracker()}
<section class="section guide-section"><div class="wrap"><div class="section-heading"><div><h2>Jaiho91 guides</h2><p>Redemption, troubleshooting and account safety.</p></div><a class="text-link" href="/guides/">All guides ${icon('arrow')}</a></div><div class="guide-grid">${guides.slice(0,3).map(guideCard).join('')}</div></div></section>
<section class="wrap section faq"><div><h2>Common questions</h2><p>What to know before using a Jaiho91 code.</p></div><div>${faq.map(([question, answer]) => `<details><summary>${h(question)}</summary><p>${h(answer)}</p></details>`).join('')}</div></section>`,
});
pages.push({
  path:'/codes/', title:'Jaiho91 Gift Code Today: VIP Status & Expiry in IST', breadcrumb:'Promo codes',
  description:'Check whether a Jaiho91 gift code is available today for VIP 0 or VIP 1–20. See the original announcement, eligibility, expiry in IST and past codes.',
  body:`${pageIntro('Promo codes', 'Jaiho91 gift code status', 'Check today’s code status for your VIP level and look up earlier announcements.')}${tracker({full:true})}
<section class="wrap section history" id="code-history"><div class="section-heading"><div><h2>Code history</h2><p>Expired or withdrawn entries from earlier announcements.</p></div></div><div class="code-list" data-archive>${archive.map(entry => codeCard(entry, true)).join('')}</div><p data-archive-empty${archive.length ? ' hidden' : ''}>No archived entries yet.</p></section>`,
});
pages.push({
  path:'/guides/', title:'Jaiho91 Help: Redeem Codes, Android APK & Login', breadcrumb:'Guides',
  description:'Find out where to enter a Jaiho91 redeem code, why a gift code might fail, how to download the Android APK, and what to do if your login OTP is delayed.',
  body:`${pageIntro('Guides', 'Jaiho91 guides', 'Find help with promo codes, Android, sign-in and account safety.')}
<section class="wrap section guide-index" aria-label="Browse guides">
<div class="guide-search" data-guide-search hidden><label for="guide-query">Search guides</label><div>${icon('search')}<input id="guide-query" type="search" placeholder="Try “OTP” or “redeem”"></div></div>
<p class="sr-only" role="status" data-guide-count></p><div class="guide-grid" data-guide-grid>${guides.map(guideCard).join('')}</div><p data-guide-empty hidden>No guides match your search.</p></section>`,
});
for (const guide of guides) {
  pages.push({
    path:guideLink(guide), title:guide.searchTitle ?? guide.title + ' | Jaiho91 Codes',
    description:guide.description, article:guide.title, breadcrumb:guide.title,
    body:`${pageIntro(guide.title, guide.title, guide.description, true)}
${guideLink(guide) === androidPath ? `<div class="wrap download-panel">${downloadButton()}<p>Android phones and tablets only. The APK is hosted on an external server.</p></div>` : ''}
<article class="wrap section prose">${guide.sections.map(([heading, paragraph]) => `<h2>${h(heading)}</h2><p>${h(paragraph).replace(/\[([^\]]+)\]\((\/guides\/[a-z-]+\/)\)/g, '<a href="$2">$1</a>')}</p>`).join('')}
<div class="prose-actions"><a class="button" href="/codes/">Check code status ${icon('arrow')}</a><a class="text-link" href="/guides/">All guides ${icon('arrow')}</a></div></article>`,
  });
}
pages.push({
  path:'/about/', title:'Editorial and Verification Policy | Jaiho91 Codes', breadcrumb:'About',
  description:'How the independent Jaiho91 Codes tracker reviews public announcements, records deadlines and handles expiry.',
  body:`${pageIntro('About', 'How we check Jaiho91 codes', 'Jaiho91 Codes is an independent reference for promo-code announcements and app help.')}
<section class="wrap section prose"><h2>Source checks</h2><p>We compare the exact entry, VIP tier and deadline with a public announcement from Jaiho91. Each listed code links to the announcement. A source check confirms what was posted. It does not involve testing a redemption in a player account.</p>
<h2>Updates and expiry</h2><p>We record when a source was last reviewed and display dates in Indian Standard Time. When the announcement omits a time zone, the entry says how the deadline was interpreted. Expired and withdrawn entries move to the code history. The tracker may lag behind newly posted or withdrawn promotions.</p>
<h2>Account and app support</h2><p>For account issues or promotion questions, use the help option in your existing Jaiho91 app or account. This site is independent of the operator and has no account access.</p><a class="text-link" href="/codes/">Open the code tracker ${icon('arrow')}</a></section>`,
});
pages.push({
  path:'/privacy/', title:'Privacy | Jaiho91 Codes', breadcrumb:'Privacy',
  description:'Privacy information for the independent Jaiho91 Codes website.',
  body:`${pageIntro('Privacy', 'Privacy', 'How the Jaiho91 Codes site handles visits and interactions.')}
<section class="wrap section prose"><h2>Site features</h2><p>The site does not ask for an account or personal details. Tier switching and guide search run locally. Copying a code writes the selected text to your device clipboard.</p>
${analytics ? '<h2>Site analytics</h2><p>We count page views and selected actions, such as code copies, tier switches and link clicks. The dashboard stores daily totals by page and action. The analytics database contains no cookies, visitor IDs, IP addresses, referrers or search terms. Analytics respects Global Privacy Control and Do Not Track signals and keeps up to 90 days of totals.</p>' : ''}
<h2>Hosting and external links</h2><p>The site uses no third-party analytics or advertising trackers. Hosting and download providers may process standard request logs, such as IP addresses. External announcements and APK downloads are subject to the destination’s privacy terms.</p></section>`,
});
pages.push({
  path:'/404.html', title:'Page not found | Jaiho91 Codes', description:'Find the Jaiho91 code tracker and guides.',
  index:false, body:`${pageIntro('Page not found', 'Page not found', 'The link may be outdated.')}<div class="wrap section"><a class="button" href="/">Back to home ${icon('arrow')}</a></div>`,
});

await mkdir(out, { recursive:true });
await cp(resolve(root, 'assets'), resolve(out, 'assets'), { recursive:true });
for (const page of pages) {
  const file = resolve(out, page.path.slice(1), ...(page.path.endsWith('/') ? ['index.html'] : []));
  await mkdir(resolve(file, '..'), { recursive:true });
  await writeFile(file, layout(page));
}
const listed = allowIndexing ? pages.filter(page => page.index !== false) : [];
await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed.map(page => `  <url><loc>${h(absolute(page.path))}</loc></url>`).join('\n')}
</urlset>
`);
await writeFile(resolve(out, 'robots.txt'), allowIndexing ? `User-agent: *
Allow: /
Disallow: /_admin/
Disallow: /api/
Sitemap: ${absolute('/sitemap.xml')}
` : 'User-agent: *\nAllow: /\n');
console.log(`Built ${pages.length - 1} pages and a custom 404. ${active.length} current source entries, ${archive.length} archived. ${allowIndexing ? 'Indexing enabled.' : 'Preview pages carry noindex.'}`);

export const siteOrigin = origin?.origin;
export const publicPaths = new Set(pages.filter(page => page.index !== false).map(page => page.path));
