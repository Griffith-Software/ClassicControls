// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Makes the Chrome Web Store images for a release (dev tool; needs Playwright and internet):
//   release/v<version>/shared/icon/icon-source.svg, master-1024.png
//   release/v<version>/chrome/listing/icon-128.png, promo-small-440x280.png
//   release/v<version>/chrome/listing/screenshots/01-…, 02-…, 03-… (1280×800, live YouTube, signed out)
//   release/v<version>/website/assets/classic-controls-icon.png (96 px) and the screenshots for the product page
// The Subscriptions list view needs a signed-in account, so that screenshot is captured by hand
// (see chrome/listing/shot-list.md).
//
//   node scripts/make-store-art.mjs            # everything
//   node scripts/make-store-art.mjs --no-shots # icons and promo tile only
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './files.mjs';
import { launch, passConsent } from '../tests/lib/launch.mjs';

const { version } = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const rel = path.join(ROOT, 'release', `v${version}`);
const iconDir = path.join(rel, 'shared', 'icon');
const listing = path.join(rel, 'chrome', 'listing');
const shots = path.join(listing, 'screenshots');
const site = path.join(rel, 'website', 'assets');
for (const d of [iconDir, listing, shots, site]) await mkdir(d, { recursive: true });

const svg = await readFile(path.join(ROOT, 'art', 'icon.svg'), 'utf8');
const sized = (n) => svg.replace('<svg ', `<svg width="${n}" height="${n}" `);
const QUERY = process.env.CC_SHOT_QUERY || 'sourdough bread';
const QUERY2 = process.env.CC_SHOT_QUERY2 || 'bread recipe';

// ---------- Icons and promo tile ----------
const browser = await chromium.launch({ channel: 'chromium' });
async function render(html, width, height, file, transparent = false) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
}

await copyFile(path.join(ROOT, 'art', 'icon.svg'), path.join(iconDir, 'icon-source.svg'));
// Opaque master: the icon on white, for places that don't accept transparency.
await render(`<body style="margin:0;background:#fff">${sized(1024)}</body>`, 1024, 1024, path.join(iconDir, 'master-1024.png'));
await copyFile(path.join(ROOT, 'icons', 'icon-128.png'), path.join(listing, 'icon-128.png'));
await render(`<body style="margin:0;background:transparent">${sized(96)}</body>`, 96, 96, path.join(site, 'classic-controls-icon.png'), true);

await render(`<!doctype html><html><head><style>
  body{margin:0;width:440px;height:280px;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;
    background:#0b3f3e;color:#fff;font-family:"Segoe UI Variable Display","Segoe UI",Roboto,Arial,sans-serif}
  .icon svg{display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35))}
  h1{margin:0;font-size:36px;line-height:1.05;font-weight:700;letter-spacing:-.5px}
  p{margin:10px 0 0;font-size:16px;line-height:1.35;color:#cfe9e8}
  .by{margin-top:14px;font-size:13px;color:#9fd0ce}
</style></head><body><div class="icon">${sized(118)}</div><div>
  <h1>Classic<br>Controls</h1>
  <p>Hover queue buttons, newest&#8209;first search and a list&#8209;view Subscriptions feed.</p>
  <p class="by">by Griffith Software</p></div></body></html>`, 440, 280, path.join(listing, 'promo-small-440x280.png'));
await browser.close();
console.log('Icons and promo tile written.');

if (process.argv.includes('--no-shots')) process.exit(0);

// ---------- Screenshots on live YouTube ----------
const { context, worker, extensionId } = await launch();
const page = context.pages()[0] || (await context.newPage());
await page.setViewportSize({ width: 1280, height: 800 });

// Ads belong to other companies, and some profiles still get YouTube's own hover buttons;
// neither belongs in the listing.
const tidy = (hidePreview = true) => page.addStyleTag({ content: [
  'ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-search-pyv-renderer, ytd-promoted-video-renderer,',
  'ytd-display-ad-renderer, ytd-reel-shelf-renderer, grid-shelf-view-model, ytd-shelf-renderer,',
  'yt-thumbnail-hover-overlay-toggle-actions-view-model, ytd-thumbnail-overlay-toggle-button-renderer,',
  'tp-yt-paper-dialog, ytd-consent-bump-v2-lightbox, ytd-miniplayer { display: none !important; }',
  hidePreview ? 'ytd-video-preview { display: none !important; }' : ''
].join(' ') });

async function openSearch(hidePreview = true) {
  await page.goto('https://www.youtube.com/results?search_query=' + encodeURIComponent(QUERY), { waitUntil: 'domcontentloaded' });
  await passConsent(page);
  await page.waitForSelector('.cc-toolbar', { timeout: 30000 });
  await tidy(hidePreview);
  await page.waitForTimeout(3500);
}

// 01: the hover buttons on a search result.
// YouTube's inline preview carries its own copy of the buttons, so it stays visible here; the
// picture is taken before the preview starts, and only once the card's buttons are showing.
await openSearch(false);
let shot1 = false;
for (let attempt = 0; attempt < 4 && !shot1; attempt++) {
  await page.mouse.move(5, 795);
  await page.waitForTimeout(400);
  const card = page.locator('ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model').nth(attempt);
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const box = await card.locator('a[href*="/watch?v="]').first().boundingBox();
  if (!box || box.y + box.height > 800) continue;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.6, { steps: 4 });
  await page.waitForTimeout(500);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.cc-hover .cc-btn')]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= 800 && getComputedStyle(b.closest('.cc-hover')).opacity === '1'; }).length);
  if (shown >= 2) {
    await page.screenshot({ path: path.join(shots, '01-hover-buttons.png') });
    shot1 = true;
  }
}
if (!shot1) throw new Error('The hover buttons never showed for screenshot 01; nothing was saved for it.');

// 02: Newest First on (no upload-date filter, so it shows only what the sort itself does).
await page.mouse.move(5, 795);
await page.goto('https://www.youtube.com/results?search_query=' + encodeURIComponent(QUERY2), { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.cc-toolbar', { timeout: 30000 });
await tidy();
await page.waitForTimeout(3500);
await page.click('.cc-toolbar .cc-sort');
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: path.join(shots, '02-newest-first.png') });

// 03: the popup over the search page, showing each fix's status.
await openSearch();
await page.waitForTimeout(2500);
const bg = await page.screenshot();
const tabId = await worker.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' }).catch(() => []);
  if (tab) return tab.id;
  const all = await chrome.tabs.query({});
  return all.find((t) => t.active)?.id ?? all[0]?.id;
});
const pop = await context.newPage();
await pop.setViewportSize({ width: 360, height: 700 });
await pop.goto(`chrome-extension://${extensionId}/src/popup/popup.html?tab=${tabId}`);
await pop.waitForTimeout(1200);
const popPng = await pop.locator('body').screenshot();
await pop.close();
await page.bringToFront();
const compose = await context.newPage();
await compose.setViewportSize({ width: 1280, height: 800 });
await compose.setContent(`<body style="margin:0;position:relative;width:1280px;height:800px;overflow:hidden">
  <img src="data:image/png;base64,${bg.toString('base64')}" style="position:absolute;inset:0;width:1280px;height:800px">
  <img src="data:image/png;base64,${popPng.toString('base64')}" style="position:absolute;top:8px;right:16px;border-radius:8px;
    box-shadow:0 8px 28px rgba(0,0,0,.45)"></body>`);
await compose.waitForTimeout(300);
await compose.screenshot({ path: path.join(shots, '03-popup-status.png') });
await compose.close();

await context.close();
for (const [from, to] of [['01-hover-buttons.png', 'classic-controls-shot-1.png'], ['02-newest-first.png', 'classic-controls-shot-2.png'], ['03-popup-status.png', 'classic-controls-shot-3.png']]) {
  await copyFile(path.join(shots, from), path.join(site, to));
}
console.log(`Screenshots written to ${path.relative(ROOT, shots)} (search "${QUERY}").`);
