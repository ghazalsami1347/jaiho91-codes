import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCodes, validateRegistry } from './registry.mjs';
import { openAnalytics } from './analytics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = JSON.parse(await readFile(join(root, 'content', 'codes.json'), 'utf8'));
const review = Date.parse(registry.lastReviewedAt);

test('checks provenance and dates, and archives entries at the expiry boundary', () => {
  const fixture = {
    lastReviewedAt: '2026-01-02T13:00:00+05:30',
    sources: { 't.me/s/jaiho91official': 'Test source' },
    codes: [{
      id:'test-entry', tier:'VIP 0', code:'TEST-FIXTURE',
      sourceUrl:'https://t.me/jaiho91official/1',
      publishedAt:'2026-01-02T12:00:00+05:30',
      verifiedAt:'2026-01-02T12:30:00+05:30',
      expiresAt:'2026-01-03T12:00:00+05:30',
      terms:'Test fixture only.',
    }],
  };
  validateRegistry(registry, review);
  validateRegistry(fixture, Date.parse(fixture.lastReviewedAt));
  const entry = fixture.codes[0];
  const expiry = Date.parse(entry.expiresAt);
  assert.equal(listCodes(fixture, expiry - 1).active.length, 1);
  assert.equal(listCodes(fixture, expiry).archive.length, 1);
  for (const patch of [
    { sourceUrl:'https://t.me/different-channel/1' },
    { sourceUrl:'http://t.me/jaiho91official/1' },
    { expiresAt:'2026-02-30T12:00:00+05:30' },
    { expiresAt:'2026-01-03T12:00:00' },
    { code:'  whitespace  ' },
  ]) {
    assert.throws(() => validateRegistry({ ...fixture, codes:[{ ...entry, ...patch }] }, expiry));
  }
  const withdrawn = { ...fixture, codes:[{ ...entry, withdrawnAt:fixture.lastReviewedAt }] };
  validateRegistry(withdrawn, Date.parse(fixture.lastReviewedAt));
  assert.equal(listCodes(withdrawn, expiry - 1).archive.length, 1);
});

test('stores only daily counts, persists them and prunes the retention window', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'jaiho91-stats-'));
  t.after(() => rm(temp, { recursive:true, force:true }));
  const file = join(temp, 'analytics.sqlite');
  let now = Date.parse('2026-11-12T20:30:00Z');
  const paths = new Set(['/', '/codes/', '/hi_en/codes/']);
  const open = () => openAnalytics(file, paths, () => now);
  let analytics = open();
  try {
    assert.equal(analytics.record({ path:'/', action:'page_view' }), true);
    assert.equal(analytics.record({ path:'/', action:'page_view' }), true);
    assert.equal(analytics.record({ path:'/codes/', action:'copy_code', tier:'VIP 0' }), true);
    assert.equal(analytics.record({ path:'/hi_en/codes/', action:'tier_switch', tier:'VIP 0' }), true);
    assert.equal(analytics.record({ path:'/codes/', action:'copy_code', tier:'unknown' }), false);
    assert.equal(analytics.record({ path:'/unknown', action:'page_view' }), false);
  } finally { analytics.close(); }
  analytics = open();
  try {
    const report = analytics.report(7);
    assert.equal(report.totals.page_view, 2);
    assert.equal(report.totals.copy_code, 1);
    assert.deepEqual(report.daily.at(-1), { day:'2026-11-13', total:2 });
    assert.equal(report.tiers[0].tier, 'VIP 0');
    now += 90 * 86_400_000;
    assert.deepEqual(analytics.report(90).totals, {});
  } finally { analytics.close(); }
});

test('production protects the dashboard and accepts only valid same-origin analytics requests', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'jaiho91-http-'));
  let child;
  t.after(async () => {
    if (child?.exitCode === null && !child.signalCode) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(temp, { recursive:true, force:true });
  });
  for (const path of ['scripts', 'assets', 'content', 'site.json']) {
    await cp(join(root, path), join(temp, path), { recursive:true });
  }
  const origin = 'https://jaiho91-preview.test';
  const args = ['scripts/preview.mjs', '--production', '--origin=' + origin];
  const env = { ...process.env, HOST:'127.0.0.1', PORT:'0', JAIHO_ADMIN_PASSWORD:'', JAIHO_ANALYTICS_DB:join(temp, 'qa.sqlite') };
  assert.notEqual(spawnSync(process.execPath, args, { cwd:temp, env }).status, 0);
  const password = 'test-only-dashboard-secret';
  child = spawn(process.execPath, args, { cwd:temp, env:{ ...env, JAIHO_ADMIN_PASSWORD:password }, stdio:['ignore', 'pipe', 'pipe'] });
  const lines = createInterface({ input:child.stdout });
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Analytics server did not start')), 5000);
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error('Analytics server exited with code ' + code));
    });
    lines.on('line', line => {
      const url = line.match(/^HTTP server: (http:\/\/\S+)/)?.[1];
      if (!url) return;
      clearTimeout(timeout);
      resolve(url);
    });
  });
  const url = path => new URL(path, address);
  const adminUrl = url('/_admin/analytics/');
  const denied = await fetch(adminUrl);
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('www-authenticate'), /^Basic /);
  const auth = { Authorization:'Basic ' + Buffer.from('admin:' + password).toString('base64') };
  const event = (headers, body = { path:'/', action:'page_view' }) => fetch(url('/api/events'), {
    method:'POST', headers:{ 'Content-Type':'application/json', ...headers }, body:JSON.stringify(body),
  });
  assert.equal((await event({ Origin:'https://different.test' })).status, 403);
  assert.equal((await event({ Origin:origin, 'Sec-GPC':'1' })).status, 204);
  assert.equal((await event({ Origin:origin }, { path:'/missing', action:'page_view' })).status, 400);
  assert.equal((await event({ Origin:origin }, { path:'/', action:'copy_code', tier:'VIP 0' })).status, 204);
  assert.equal((await event({ Origin:origin })).status, 204);
  const response = await fetch(adminUrl, { headers:auth });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /Page views<\/span><strong>1<\/strong>/);
  assert.match(html, /Successful copies<\/span><strong>1<\/strong>/);
  assert.equal((await fetch(url('/qa.sqlite'))).status, 404);
});

test('generates crawlable pages, working internal routes and an empty state with no code data', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'jaiho91-check-'));
  t.after(() => rm(temp, { recursive:true, force:true }));
  for (const path of ['scripts', 'assets', 'content', 'site.json']) {
    await cp(join(root, path), join(temp, path), { recursive:true });
  }
  const run = (...args) => spawnSync(process.execPath, ['scripts/build.mjs', ...args], { cwd:temp, encoding:'utf8' });
  const runVercel = environment => spawnSync(process.execPath, ['scripts/build.mjs', '--vercel'], {
    cwd:temp, encoding:'utf8',
    env:{ ...process.env, VERCEL_ENV:environment, VERCEL_PROJECT_PRODUCTION_URL:'jaiho91-preview.test' },
  });
  const page = path => readFile(join(temp, 'dist', path), 'utf8');
  const emptyRegistry = { ...registry, codes:[] };
  await writeFile(join(temp, 'content', 'codes.json'), JSON.stringify(emptyRegistry));
  const preview = run('--origin=');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(await page('index.html'), /noindex,follow/);
  assert.match(await page('index.html'), /कोई सत्यापित कोड उपलब्ध नहीं/);
  assert.match(await page('hi_en/index.html'), /Abhi koi verified code available nahi hai/);
  assert.doesNotMatch(await page('index.html'), /class="copy"/);
  assert.notEqual(run('--origin=', '--production').status, 0);

  const site = 'https://jaiho91-preview.test';
  const production = run('--production', '--origin=' + site);
  assert.equal(production.status, 0, production.stderr);
  assert.match(await page('robots.txt'), /Sitemap: https:\/\/jaiho91-preview\.test\/sitemap\.xml/);
  const routes = [...(await page('sitemap.xml')).matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]));
  assert.equal(routes.length, 24);
  assert.equal(new Set(routes.map(url => url.pathname)).size, 24);
  const apk = 'https://d1i9jwkbb2057y.cloudfront.net/jaiho91_SEO_6BV0FPZR264.apk';
  for (const path of ['index.html', 'guides/android-app/index.html', 'hi_en/index.html', 'hi_en/guides/android-app/index.html']) {
    assert.ok((await page(path)).includes('href="' + apk + '" data-track="download_apk"'));
  }
  assert.match(await page('404.html'), /noindex,follow/);
  const titles = new Set();
  const descriptions = new Set();
  for (const url of routes) {
    const html = await page(url.pathname.slice(1) + 'index.html');
    assert.equal(url.origin, site);
    assert.ok(html.includes(`rel="canonical" href="${url.href}"`));
    const roman = url.pathname.startsWith('/hi_en/');
    const hindiPath = roman ? url.pathname.slice('/hi_en'.length) : url.pathname;
    assert.match(html, roman ? /<html lang="hi-Latn-IN">/ : /<html lang="hi-IN">/);
    assert.ok(html.includes('hreflang="hi-IN" href="' + site + hindiPath + '"'));
    assert.ok(html.includes('hreflang="hi-Latn-IN" href="' + site + '/hi_en' + hindiPath + '"'));
    assert.ok(html.includes('hreflang="x-default" href="' + site + hindiPath + '"'));
    if (hindiPath === '/rtp/') {
      const featured = html.split('<div id="games"')[1].split('<div id="empty"')[0];
      assert.equal([...featured.matchAll(/class="game-card(?: top-game)?"/g)].length, 10);
      assert.equal([...featured.matchAll(/class="card-rtp"><span>RTP<\/span><strong>(\d+\.\d+)%/g)].filter(match => Number(match[1]) >= 96 && Number(match[1]) <= 99).length, 10);
      assert.match(html, /<h1 id="hero-title">Jaiho91<br><span>Live RTP<\/span><\/h1>/);
      assert.match(html, roman
        ? /id="rtp-notice-title">PREVIEW<\/strong>[^<]+simulated/
        : /id="rtp-notice-title">प्रीव्यू<\/strong>[^<]+सिम्युलेटेड/);
      assert.match(html, /<meta property="og:title" content="Jaiho91 Live RTP/);
      assert.match(html, /href="\/assets\/rtp\/arcade\.css"/);
      assert.match(html, /id="hero-deck"/);
      assert.match(html, /id="leaders"/);
      assert.match(html, /id="countdown"/);
      assert.match(html, /<dialog id="game-dialog"[^>]+aria-describedby="dialog-preview"/);
    }
    if (hindiPath === '/tutorials/') {
      assert.equal([...html.matchAll(/<video controls playsinline preload="none"/g)].length, 7);
      assert.equal([...html.matchAll(/<figcaption>/g)].length, 21);
    }
    assert.equal([...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length, 1);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    descriptions.add(html.match(/<meta name="description" content="([^"]+)">/)[1]);
    const structured = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
    assert.ok(JSON.parse(structured)['@graph'].some(node => node.url === url.href));
    for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      const local = new URL(match[1], site).pathname;
      const file = local.slice(1) + (local.endsWith('/') ? 'index.html' : '');
      assert.ok((await stat(join(temp, 'dist', file))).isFile(), match[1]);
    }
  }
  assert.equal(titles.size, routes.length);
  assert.equal(descriptions.size, routes.length);
  const mount = '/jaiho91-codes';
  const pages = run('--production', '--origin=' + site, '--base-path=' + mount);
  assert.equal(pages.status, 0, pages.stderr);
  const sitemap = await page('sitemap.xml');
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, routes.length);
  assert.equal([...sitemap.matchAll(/<xhtml:link /g)].length, 3 * routes.length);
  assert.ok((await page('robots.txt')).includes('Sitemap: ' + site + mount + '/sitemap.xml'));
  for (const route of routes) {
    const path = route.pathname;
    const html = await page(path.slice(1) + 'index.html');
    const url = site + mount + path;
    assert.ok(html.includes('rel="canonical" href="' + url + '"'));
    assert.ok(html.includes('property="og:url" content="' + url + '"'));
    assert.ok(html.includes('name="twitter:image" content="' + site + mount + '/assets/'));
    assert.ok(sitemap.includes('<loc>' + url + '</loc>'));
    const structured = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.ok(structured['@graph'].some(node => node.url === url));
    if (path !== '/' && path !== '/hi_en/') {
      const crumbs = structured['@graph'].find(node => node['@type'] === 'BreadcrumbList');
      assert.equal(crumbs.itemListElement.at(-1).item, url);
    }
    for (const match of html.matchAll(/(?:href|src|poster)="(\/[^"]*)"/g)) {
      assert.ok(match[1].startsWith(mount + '/'), match[1]);
      const target = new URL(match[1], site).pathname.slice(mount.length + 1);
      assert.ok((await stat(join(temp, 'dist', target + (target.endsWith('/') || !target ? 'index.html' : '')))).isFile(), match[1]);
    }
  }
  const gameList = JSON.parse(await page('assets/rtp/games.json'));
  assert.ok(gameList.length >= 10);
  for (const game of gameList) {
    for (const field of ['image','imageSmall','imageLarge']) {
      if (!game[field]) continue;
      assert.ok(game[field].startsWith(mount + '/assets/rtp/games/'));
      assert.ok((await stat(join(temp, 'dist', game[field].slice(mount.length + 1)))).isFile());
    }
  }
  const vercelPreview = runVercel('preview');
  assert.equal(vercelPreview.status, 0, vercelPreview.stderr);
  assert.match(await page('index.html'), /noindex,follow/);
  assert.doesNotMatch(await page('sitemap.xml'), /<loc>/);
  const vercelProduction = runVercel('production');
  assert.equal(vercelProduction.status, 0, vercelProduction.stderr);
  assert.match(await page('index.html'), /rel="canonical" href="https:\/\/jaiho91-preview\.test\/"/);
  assert.match(await page('robots.txt'), /Sitemap: https:\/\/jaiho91-preview\.test\/sitemap\.xml/);
});
