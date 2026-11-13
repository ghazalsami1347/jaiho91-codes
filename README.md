# Jaiho91 Codes

A responsive code tracker with five support guides, a searchable guide index, a code archive, and an editorial policy. The public pages are pre-rendered for fast loading and SEO. The included Node.js server adds first-party analytics and a private dashboard.

The public site defaults to Hindi. The Roman Hindi edition mirrors it under `/hi_en/`. The language switch links to the equivalent page in the other script. Both editions have their own canonicals and reciprocal language alternates.

## Edit tutorials and translations

Shared site labels live in `content/locales.mjs`, guide translations in `content/guides.mjs`, and screenshot captions in `content/tutorials.mjs`. Each tutorial uses one portrait MP4 and three WebP screenshots in `assets/tutorials/`. The filenames start with the tutorial slug, with `-1`, `-2` and `-3` for the stills. Videos load on demand, and screenshots use lazy loading. Include `localizedTerms.hi` and `localizedTerms.hi_en` when adding a code to provide its eligibility and deadline notes in both scripts.

## Run locally

Install Node.js 24 or later if needed. If an earlier version of the preview is open, press Ctrl+C in its terminal first. Open a terminal in this folder and run:

```sh
node scripts/preview.mjs
```

Open [the local preview](http://127.0.0.1:4173/) and [the analytics dashboard](http://127.0.0.1:4173/_admin/analytics/). The preview only listens on your computer. To pick up changes, restart the command and reload the browser. Press Ctrl+C in the preview terminal when you finish.

Run the checks with `node --test scripts/site.test.mjs`. The Motion mini bundle is self-hosted, and analytics uses the SQLite library included in Node.js. There are no package dependencies to install.

## Manage Jaiho91 codes

Edit [content/codes.json](content/codes.json). It is the single source for both the homepage and the full tracker.

1. Find a dated announcement from the provider. Confirm the exact code, tier, deadline, and any eligibility conditions. Record the direct public post URL and add its domain or channel to the approved source list if needed.
2. Add one record per public code and VIP tier. Use a unique `id`, a `tier` of `VIP 0` or `VIP 1–20`, the exact `code`, `sourceUrl`, and a short `terms` note. Enter `publishedAt`, `verifiedAt` and `expiresAt` as ISO timestamps with an explicit offset. India uses `+05:30`. Describe any deadline interpretation in the terms.
3. Update `lastReviewedAt` to the time you actually checked the source. Account-only, inbox-only and unconfirmed entries stay out of the public registry. An empty `codes` array is valid and renders the labelled empty state.
4. If an entry is withdrawn, add `withdrawnAt` with the time you confirmed the withdrawal, update `lastReviewedAt`, and rebuild. Expired and withdrawn records remain in the history. Older entries need no manual status edit.
5. Build and deploy after each update. The tier switcher shows the newest source-checked code for the selected VIP tier. Browsers with JavaScript hide expired entries and remove their copy controls at the deadline. Schedule a fresh build or server restart after expiry for crawlers and visitors with JavaScript disabled. Source reviews are manual.

The two initial records reproduce the public entries for VIP 0 and VIP 1–20 from 12 November 2026. “Source checked” means the entries and tiers matched the post. Redemption was not tested. The post gives 13 November at noon without naming a time zone, so the tracker interprets the deadline as IST and discloses that on each card. [Jaiho91 announcement](https://t.me/jaiho91official/723)

Guide content and FAQ entries live in [content/guides.mjs](content/guides.mjs). Styles, imagery and the small interaction script live in [assets](assets).

## Build and deploy

1. Set `origin` in [site.json](site.json) to your final HTTPS origin, without a path, query, or fragment. The production build uses it for canonical URLs, social metadata, structured data, `sitemap.xml` and `robots.txt`.
2. For the site and analytics together, deploy this folder to a Node.js 24+ host and use `node scripts/preview.mjs --production` as the start command. Set `JAIHO_ADMIN_PASSWORD` through the host's secret settings. Use a unique password with at least 16 characters. Start behind an HTTPS reverse proxy. The default listener is `127.0.0.1:4173`. Set `PORT` and, if the hosting platform requires it behind its HTTPS ingress, `HOST=0.0.0.0`. The proxy must pass the dashboard's Authorization header through.
3. Mount a persistent writable volume and set `JAIHO_ANALYTICS_DB` to a database file path on it, such as `/data/analytics.sqlite`. For a single instance on persistent local storage, the default is `.data/analytics.sqlite` in this project. Keep it outside the public `dist/` folder.
4. Open `/_admin/analytics/` on your domain. Log in with the username `admin` and the password you set. The dashboard shows daily page views, top pages, copies, VIP tier switches and selected link clicks. Use Refresh to update the totals or change the reporting window.
5. Verify HTTPS, `/codes/`, one guide, `/sitemap.xml`, and `/robots.txt` on the final domain. Submit the sitemap in Google Search Console after verifying the domain.

For **static hosting without analytics**, run `node scripts/build.mjs --production` and upload the contents of `dist/`. Serve folder indexes, preserve trailing-slash URLs, and serve `404.html` with an HTTP 404 response. The bundled `dist/` is a noindex preview.

### Deploy the public site to Vercel

Import this folder's GitHub repository as a new Vercel project. Select the folder containing `vercel.json` as the project root. Use Node.js 24.x and leave **Automatically expose System Environment Variables** enabled. The configuration sets the build command, output folder and trailing-slash routing. If `site.json` has a blank origin, the build uses Vercel's production domain automatically. Set the origin explicitly to prefer a specific custom domain. Vercel preview deployments carry `noindex`.

To publish a code update, push the revised `content/codes.json` to the connected production branch. The custom analytics dashboard requires the Node.js hosting setup above.

### What analytics counts

Page views count repeat visits and reloads. The dashboard also tracks successful copy actions, VIP switches, source links, code calls to action and guide links. Events are sent from the browser to this server. The database stores daily totals by page, action and, where applicable, VIP tier. It stores no visitor IDs, cookies, IP addresses, referrers or search terms. Privacy signals, disabled JavaScript and blocked requests can reduce the counts. Totals are retained for up to 90 days and pruned when the server starts or handles analytics.

## Live reference review

- **Structure and navigation.** The reference homepage opens with code and download actions, then a VIP code-status module, searchable recent articles, quick links for downloads and sign-in, and a FAQ. The navigation links to separate code, app guide, download, contact, and article pages. The reference also offers a Hindi locale.
- **Interactions.** The code module groups entries by VIP level and exposes copy, sharing, deadline, and redemption information. The article module offers topic filters and search. Historical announcements are marked expired.
- **Search.** The live homepage exposes a canonical URL, Indian locale metadata, English and Hindi alternates, social preview metadata, and WebSite, Organization, and WebPage JSON-LD. Its robots file points to an XML sitemap with locale alternates and image entries.
- **Jaiho91 implementation.** The site adopts the code-first layout, VIP filtering, copy controls, expiry history, guide search and FAQ. It uses its own chrome-and-magenta design and a single English India edition. Public source links and the review date sit alongside the codes. App installers, affiliate links and account actions are outside the site’s scope.

[Reference homepage](https://yonovipcodes.com/) · [Reference robots.txt](https://yonovipcodes.com/robots.txt) · [Reference sitemap](https://yonovipcodes.com/sitemap.xml)

## Artwork and verification

The supplied Jaiho91 badge was regenerated using built-in ImageGen. The 1254 × 1254 PNG master has a transparent exterior and is supplied separately. The homepage uses 420 px and 720 px WebP variants to avoid serving the master to every visitor. The favicon and social card use the same badge. Manrope is self-hosted and includes its Open Font License in the assets folder.

ImageGen prompt:

> Use case: precise-object-edit / background-extraction. Create a high-resolution square master (1536x1536 or 2048x2048 if supported) faithfully regenerating the supplied Jaiho91 chrome badge for a website. Preserve the exact uppercase word JAIHO, the magenta symbols ★ 9 1 ★ on four polished silver reel segments, the near-black internal panel, beveled chrome rounded-square border, and a restrained warm top specular highlight. Preserve the supplied layout and thick type. The enclosed black face remains fully opaque. Everything OUTSIDE the outer metal silhouette must be genuine transparent alpha, including all corners, without a rendered checkerboard, exterior shadow, black matte, or background. Keep a small even transparent margin and every part of the badge within the canvas. Crisp edges, accurate lettering, no other text or objects.

The homepage uses the self-hosted Motion mini build for the badge entrance, tier switches, copy feedback and guide cards. Animations respect the browser's reduced-motion setting. The bundled library notices are in [assets/LICENSE-Motion.txt](assets/LICENSE-Motion.txt).

The homepage and tracker were checked in the browser. Checks covered VIP switching with a pointer and keyboard, copy feedback, and analytics counts from real browser actions. Automated checks cover provenance, expiry, empty states, production metadata, analytics persistence and retention, and password-protected dashboard access.
