import { actions } from './analytics.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const number = new Intl.NumberFormat('en-IN');
const format = value => number.format(value);
const date = new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', timeZone:'UTC' });

export function dashboard(report, days) {
  const { totals, daily, pages, tiers } = report;
  const max = Math.max(1, ...daily.map(row => row.total));
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Analytics | Jaiho91 Codes</title>
<link rel="icon" href="/assets/mark.png" type="image/png">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body class="admin">
<header class="site-header"><div class="wrap admin-header"><a class="brand" href="/"><img src="/assets/mark.png" alt="" width="38" height="38"><span>Jaiho<span class="brand-number">91</span><small>CODES</small></span></a><a href="/" class="text-link">View site</a></div></header>
<main class="wrap section">
<div class="section-heading admin-heading"><div><h1>Site analytics</h1><p>Page views and actions · India Standard Time</p></div>
<form method="get"><label for="range">Date range</label><select id="range" name="days">${[7, 30, 90].map(value => `<option value="${value}"${value === days ? ' selected' : ''}>Last ${value} days</option>`).join('')}</select><button class="button small" type="submit">Refresh</button></form></div>
<div class="metric-grid">${Object.entries(actions).map(([key, label]) => `<div class="metric"><span>${label}</span><strong>${format(totals[key] ?? 0)}</strong></div>`).join('')}</div>
<div class="admin-grid"><section class="admin-panel"><h2>Daily page views</h2><p>Last ${daily.length} days</p><ol class="chart">${daily.map(row => `<li><time datetime="${row.day}">${date.format(new Date(row.day + 'T00:00:00Z'))}</time><progress max="${max}" value="${row.total}" aria-label="Page views on ${row.day}"></progress><span>${format(row.total)}</span></li>`).join('')}</ol></section>
<div class="admin-stack"><section class="admin-panel"><h2>Top pages</h2>${pages.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Page</th><th scope="col">Views</th><th scope="col">Actions</th></tr></thead><tbody>${pages.map(row => `<tr><th scope="row"><a href="${escape(row.path)}">${escape(row.path)}</a></th><td>${format(row.views)}</td><td>${format(row.clicks)}</td></tr>`).join('')}</tbody></table></div>` : '<p>No page activity in this range.</p>'}</section>
<section class="admin-panel"><h2>VIP activity</h2>${tiers.length ? `<table><thead><tr><th scope="col">Tier</th><th scope="col">Copies</th><th scope="col">Switches</th></tr></thead><tbody>${tiers.map(row => `<tr><th scope="row">${escape(row.tier)}</th><td>${format(row.copies)}</td><td>${format(row.switches)}</td></tr>`).join('')}</tbody></table>` : '<p>No tier activity in this range.</p>'}</section></div></div>
<p class="admin-foot">Counts are events, so repeat views and clicks are included. Daily totals are kept for 90 days.</p>
</main></body></html>`;
}
