import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const actions = {
  page_view:'Page views',
  copy_code:'Successful copies',
  tier_switch:'VIP tier switches',
  source_click:'Source links',
  check_codes:'Check codes clicks',
  open_guide:'Guide clicks',
  download_apk:'APK download clicks',
};

const tiers = ['VIP 0', 'VIP 1–20'];
const dayLength = 86_400_000;
const istOffset = 19_800_000;
const dayAt = (time, daysAgo = 0) => new Date(time + istOffset - daysAgo * dayLength).toISOString().slice(0, 10);

export function openAnalytics(file, paths, now = Date.now) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive:true, mode:0o700 });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 2000;
    CREATE TABLE IF NOT EXISTS totals (
      day TEXT NOT NULL,
      path TEXT NOT NULL,
      action TEXT NOT NULL,
      tier TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (day, path, action, tier)
    ) WITHOUT ROWID;`);
  const write = db.prepare(`INSERT INTO totals (day, path, action, tier, count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(day, path, action, tier) DO UPDATE SET count = count + 1`);
  const prune = db.prepare('DELETE FROM totals WHERE day < ?');
  const byAction = db.prepare('SELECT action, SUM(count) AS total FROM totals WHERE day >= ? GROUP BY action');
  const byDay = db.prepare("SELECT day, SUM(count) AS total FROM totals WHERE day >= ? AND action = 'page_view' GROUP BY day ORDER BY day");
  const byPath = db.prepare(`SELECT path, SUM(CASE WHEN action = 'page_view' THEN count ELSE 0 END) AS views,
    SUM(CASE WHEN action != 'page_view' THEN count ELSE 0 END) AS clicks
    FROM totals WHERE day >= ? GROUP BY path ORDER BY views DESC, clicks DESC, path ASC`);
  const byTier = db.prepare(`SELECT tier, SUM(CASE WHEN action = 'copy_code' THEN count ELSE 0 END) AS copies,
    SUM(CASE WHEN action = 'tier_switch' THEN count ELSE 0 END) AS switches
    FROM totals WHERE day >= ? AND action IN ('copy_code', 'tier_switch') GROUP BY tier`);
  let lastPrunedDay;

  function pruneOld(time) {
    const day = dayAt(time);
    if (day === lastPrunedDay) return;
    prune.run(dayAt(time, 89));
    lastPrunedDay = day;
  }
  pruneOld(now());

  return {
    record(event) {
      if (!event || typeof event !== 'object' || !paths.has(event.path) ||
          typeof event.action !== 'string' || !Object.hasOwn(actions, event.action)) return false;
      const { path, action } = event;
      const usesTier = action === 'copy_code' || action === 'tier_switch';
      const validTier = tiers.includes(event.tier);
      if (usesTier && (!validTier || (path !== '/' && path !== '/codes/'))) return false;
      if (event.tier !== undefined && (!validTier || (!usesTier && action !== 'source_click'))) return false;
      const time = now();
      pruneOld(time);
      write.run(dayAt(time), path, action, event.tier ?? '');
      return true;
    },
    report(days) {
      const time = now();
      pruneOld(time);
      const since = dayAt(time, days - 1);
      const chartDays = Math.min(days, 14);
      const dailyCounts = new Map(byDay.all(dayAt(time, chartDays - 1)).map(row => [row.day, row.total]));
      return {
        totals:Object.fromEntries(byAction.all(since).map(row => [row.action, row.total])),
        daily:Array.from({ length:chartDays }, (_, index) => {
          const day = dayAt(time, chartDays - 1 - index);
          return { day, total:dailyCounts.get(day) ?? 0 };
        }),
        pages:byPath.all(since),
        tiers:byTier.all(since),
      };
    },
    close() { db.close(); },
  };
}
