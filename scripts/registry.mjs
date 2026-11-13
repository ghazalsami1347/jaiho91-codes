import assert from 'node:assert/strict';

export const tiers = ['VIP 0', 'VIP 1–20'];

function readTime(value) {
  const match = typeof value === 'string' &&
    value.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
  const time = Date.parse(value);
  assert(match && Number.isFinite(time) &&
    new Date(match[1] + 'T00:00:00Z').toISOString().startsWith(match[1]), 'Use a valid ISO date with an explicit time zone');
  return time;
}

export function validateRegistry(registry, now) {
  const reviewed = readTime(registry.lastReviewedAt);
  assert(reviewed <= now, 'Review timestamp is in the future');
  assert(registry.sources && typeof registry.sources === 'object', 'Add an approved source list');
  assert(Array.isArray(registry.codes), 'Codes must be an array');
  const ids = new Set();
  for (const entry of registry.codes) {
    assert(typeof entry.id === 'string' && /^[a-z0-9-]+$/.test(entry.id) && !ids.has(entry.id), 'Each entry needs a unique slug');
    ids.add(entry.id);
    assert(tiers.includes(entry.tier), 'Unknown VIP tier');
    for (const field of ['code', 'terms']) {
      assert(typeof entry[field] === 'string' && entry[field].trim() && entry[field].trim() === entry[field], `Missing or malformed ${field}`);
    }
    assert(entry.code.length <= 120 && !/\s/.test(entry.code), 'Code text must be a single token of at most 120 characters');
    const source = new URL(entry.sourceUrl);
    const approved = Object.keys(registry.sources).some(key => {
      const rule = new URL('https://' + key);
      const prefix = rule.pathname.replace(/\/$/, '').replace(/^\/s\//, '/');
      const path = source.pathname.replace(/^\/s\//, '/');
      return source.origin === rule.origin && (prefix ? path.startsWith(prefix + '/') : path !== '/');
    });
    assert(approved && !source.username && !source.password && !source.hash, 'Use a direct post or page from an approved source');
    const published = readTime(entry.publishedAt);
    const verified = readTime(entry.verifiedAt);
    const expires = readTime(entry.expiresAt);
    assert(published <= verified && verified <= reviewed && verified < expires, 'Expected publication ≤ verification ≤ last review, and verification before expiry');
    if (entry.withdrawnAt) {
      const withdrawn = readTime(entry.withdrawnAt);
      assert(withdrawn >= verified && withdrawn <= reviewed, 'Withdrawal must follow verification and precede the latest review');
    }
  }
  return registry;
}

export function listCodes(registry, now) {
  const active = [];
  const archive = [];
  const sorted = [...registry.codes].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || tiers.indexOf(a.tier) - tiers.indexOf(b.tier));
  for (const entry of sorted) {
    if (entry.withdrawnAt || Date.parse(entry.expiresAt) <= now) archive.push(entry);
    else active.push(entry);
  }
  return { active, archive };
}
