import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { stat, readFile } from 'node:fs/promises';
import { extname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openAnalytics } from './analytics.mjs';
import { dashboard } from './dashboard.mjs';

const production = process.argv.includes('--production');
const host = production ? (process.env.HOST || '127.0.0.1') : '127.0.0.1';
const port = Number(production ? (process.env.PORT || '4173') : (process.env.JAIHO_PREVIEW_PORT || '4173'));
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Use a valid server port.');
const password = process.env.JAIHO_ADMIN_PASSWORD;
if (production && (!password || password.length < 16)) {
  throw new Error('Set JAIHO_ADMIN_PASSWORD to a password of at least 16 characters before starting production.');
}
const hash = value => createHash('sha256').update(value).digest();
const adminCredential = password && hash('admin:' + password);
process.argv.push('--analytics');
const { siteOrigin, publicPaths } = await import('./build.mjs');

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const dbPath = process.env.JAIHO_ANALYTICS_DB || fileURLToPath(new URL('../.data/analytics.sqlite', import.meta.url));
const analytics = openAnalytics(dbPath, publicPaths);
const types = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.webp':'image/webp', '.woff2':'font/woff2',
  '.mp4':'video/mp4',
};

function isLocalHost(value) {
  const runningPort = server.address().port;
  return value === '127.0.0.1:' + runningPort || value === 'localhost:' + runningPort ||
    (runningPort === 80 && (value === '127.0.0.1' || value === 'localhost'));
}

function isSameOrigin(req) {
  if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return false;
  if (production) return req.headers.origin === siteOrigin;
  return isLocalHost(req.headers.host) && req.headers.origin === 'http://' + req.headers.host;
}

function isAdmin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!adminCredential) return !production && isLocalHost(req.headers.host);
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Basic ') || auth.length > 1024) return false;
  const supplied = Buffer.from(auth.slice(6), 'base64');
  return timingSafeEqual(hash(supplied), adminCredential);
}

async function readEvent(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn:false })) {
    size += chunk.length;
    if (size > 1024) {
      req.resume();
      return null;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return null; }
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  let url;
  let path;
  try {
    url = new URL(req.url, 'http://127.0.0.1');
    path = decodeURIComponent(url.pathname);
    if (path.includes('\\') || path.includes('\0') || path.startsWith('//')) throw new Error('Invalid path');
  } catch {
    res.writeHead(400).end('Invalid path');
    return;
  }

  if (path === '/api/events') {
    res.setHeader('Cache-Control', 'no-store');
    const reject = (status, headers) => { req.resume(); res.writeHead(status, headers).end(); };
    if (req.method !== 'POST') return reject(405, { Allow:'POST' });
    if (!isSameOrigin(req)) return reject(403);
    if (req.headers['sec-gpc'] === '1' || req.headers.dnt === '1') return reject(204);
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return reject(415);
    if (Number(req.headers['content-length']) > 1024) return reject(413);
    try {
      const event = await readEvent(req);
      res.writeHead(analytics.record(event) ? 204 : 400).end();
    } catch {
      if (!res.destroyed) res.writeHead(503).end();
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow:'GET, HEAD' }).end();
    return;
  }

  if (path === '/_admin/analytics/' || path === '/_admin/analytics') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!isAdmin(req)) {
      if (adminCredential && req.headers['sec-fetch-site'] !== 'cross-site') {
        res.writeHead(401, { 'WWW-Authenticate':'Basic realm="Jaiho91 analytics", charset="UTF-8"' }).end('Authentication required');
      } else res.writeHead(403).end('Access denied');
      return;
    }
    if (!path.endsWith('/')) {
      res.writeHead(308, { Location:'/_admin/analytics/' + url.search }).end();
      return;
    }
    try {
      const requested = Number(url.searchParams.get('days'));
      const days = [7, 30, 90].includes(requested) ? requested : 7;
      const html = dashboard(analytics.report(days), days);
      res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : html);
    } catch {
      res.writeHead(503).end('Analytics is temporarily unavailable.');
    }
    return;
  }

  let file = resolve(root, '.' + path);
  const fromRoot = relative(root, file);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    res.writeHead(400).end('Invalid path');
    return;
  }
  let status = 200;
  let contents;
  try {
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(308, { Location:encodeURI(path) + '/' + url.search }).end();
        return;
      }
      file = resolve(file, 'index.html');
    }
    contents = await readFile(file);
  } catch {
    status = 404;
    file = resolve(root, '404.html');
    contents = await readFile(file);
  }
  res.writeHead(status, {
    'Content-Type':types[extname(file)] ?? 'application/octet-stream',
    'Content-Length':contents.length,
    'Cache-Control':production && status === 200 ? (path.startsWith('/assets/') ? 'public,max-age=3600' : 'no-cache') : 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : contents);
});
server.on('close', () => analytics.close());
server.listen(port, host, () => {
  const address = `http://${host}:${server.address().port}`;
  console.log(`${production ? 'HTTP server' : 'Preview'}: ${address}/`);
  console.log(`Analytics: ${production ? siteOrigin : address}/_admin/analytics/`);
});
