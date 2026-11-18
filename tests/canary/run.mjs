// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Scheduled YouTube test. Loads the built extension into a real Chromium, opens YouTube and
// checks that each fix appears and works. Writes <out>/results.json plus screenshots; the
// issue step (issues.mjs) reads that file.
//
//   node tests/canary/run.mjs [--out canary-results] [--force-fail <fixId>]
//   node tests/canary/run.mjs --signed-in --profile <folder>   (owner's PC, test account)
//
// YouTube still shows its own hover buttons to some users. So the hover check always runs
// against the version without them: this run's copy of the rules doesn't skip cards with
// YouTube's buttons, and those buttons are hidden on the page.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import path from 'node:path';
import { launch, tabStates, passConsent } from '../lib/launch.mjs';
import { ROOT } from '../../scripts/files.mjs';

const require = createRequire(import.meta.url);
const time = require('../../src/lib/time.js');
const order = require('../../src/lib/order.js');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const SIGNED_IN = args.includes('--signed-in');
const MODE = SIGNED_IN ? 'signed-in' : 'signed-out';
const OUT = path.resolve(opt('--out', path.join(ROOT, 'canary-results')));
const FORCE_FAIL = opt('--force-fail', process.env.FORCE_FAIL || '');
const PROFILE = opt('--profile', '');
const QUERIES = ['space news', 'guitar lesson', 'bread recipe'];

const rules = JSON.parse(await readFile(path.join(ROOT, 'data', 'fixes.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
await mkdir(OUT, { recursive: true });

// Ads look like video cards and carry a watch link, but the extension leaves them alone on
// purpose, so the card checks skip them (same list as the extension's notCard rule).
const NOT_AD = `:not(:has(${rules.fixes.hoverButtons.anchors.notCard.join(', ')}))`;

const checks = [];
const anchors = {};
let shot = 0;

function record(fixId, name, ok, detail, extra = {}) {
  if (FORCE_FAIL && FORCE_FAIL === fixId && ok) {
    ok = false;
    detail = 'Forced failure (test of the issue automation): ' + detail;
  }
  checks.push({ fixId, fixName: rules.fixes[fixId].name, name, ok, detail, ...extra });
  console.log(`${ok === true ? 'ok  ' : ok === false ? 'FAIL' : 'skip'} [${fixId}] ${name}: ${detail}`);
}

async function evidence(page, selector) {
  const file = path.join(OUT, `shot-${++shot}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  const html = await page.evaluate((sel) => {
    const el = document.querySelector(sel) || document.querySelector('ytd-page-manager') || document.body;
    return el.outerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').replace(/\sstyle="[^"]*"/g, '').slice(0, 15000);
  }, selector).catch(() => '');
  return { screenshot: path.basename(file), html };
}

async function recordAnchors(page, kind) {
  const counts = await page.evaluate((fixes) => {
    const out = {};
    for (const [fixId, fix] of Object.entries(fixes)) {
      for (const [name, sels] of Object.entries(fix.anchors)) {
        for (const sel of sels) {
          let n = null;
          try { n = document.querySelectorAll(sel).length; } catch (_) { n = 'invalid'; }
          out[`${fixId}.${name} ${sel}`] = n;
        }
      }
    }
    return out;
  }, rules.fixes);
  anchors[kind] = counts;
}

const hasVideos = (page) => page.evaluate((sel) => !!document.querySelector(sel), rules.videoLinks);
const hideNative = (page) => page.addStyleTag({ content: 'yt-thumbnail-hover-overlay-toggle-actions-view-model, ytd-thumbnail-overlay-toggle-button-renderer { display: none !important; }' });

async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await passConsent(page);
  await page.waitForTimeout(rules.settleMs + 2500);
  await hideNative(page);
}

async function fixState(worker, fixId) {
  const all = await tabStates(worker);
  const tabs = Object.entries(all).filter(([k]) => k.includes('.tab.')).map(([, v]) => v);
  tabs.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return tabs[0] && tabs[0].fixes ? tabs[0].fixes[fixId] : undefined;
}

// Moves the pointer onto a card's thumbnail the way a person would. Playwright's own hover()
// waits for nothing to cover the card, but on the home page YouTube's inline preview pops up on
// top of the card being hovered, so it would wait forever.
async function pointAt(page, card) {
  await card.scrollIntoViewIfNeeded();
  const link = card.locator('a[href*="/watch?v="]').first();
  const box = (await link.boundingBox()) || (await card.boundingBox());
  if (!box) throw new Error('the card has no size on the page');
  await page.mouse.move(box.x + box.width * 0.3, box.y + Math.min(box.height * 0.5, 80), { steps: 3 });
}

// Clicks one of the extension's buttons for this card: the copy on YouTube's playing preview if
// that is on top, otherwise the card's own.
async function clickAction(page, card, action) {
  const target = await card.evaluate((el, act) => {
    const ids = Array.from(el.querySelectorAll('a[href*="/watch?v="]')).map((a) => new URL(a.href).searchParams.get('v'));
    const boxes = [el.querySelector('.cc-hover:not(.cc-in-preview)'),
      Array.from(document.querySelectorAll('.cc-in-preview')).find((b) => ids.includes(b.dataset.ccFor))];
    for (const box of boxes) {
      const b = box && box.querySelector(`.cc-btn[data-cc-action="${act}"]`);
      if (!b) continue;
      const r = b.getBoundingClientRect();
      const top = r.width && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && top.closest('.cc-btn') === b) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  }, action);
  if (!target) return false;
  await page.mouse.move(target.x, target.y, { steps: 2 });
  await page.mouse.click(target.x, target.y);
  return true;
}

// Hovers the first few cards and checks the two buttons appear on each.
async function checkHover(page, cardSel, where) {
  const cards = page.locator(cardSel);
  const n = Math.min(await cards.count(), 3);
  if (!n) return { ok: false, detail: `no video cards found on ${where}` };
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    // The two buttons show on the card, or on YouTube's preview once it starts playing on top.
    // A second try covers the page shifting under the pointer while ads or results load.
    let shown = null;
    for (let attempt = 0; attempt < 2 && (!shown || shown.best !== 2); attempt++) {
      await page.mouse.move(0, 0);
      await pointAt(page, card);
      shown = await card.evaluate(async (el) => {
        const visible = (box) => box ? Array.from(box.querySelectorAll('.cc-btn')).filter((b) => {
          const r = b.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return r.width && getComputedStyle(box).opacity !== '0' && top && top.closest('.cc-btn') === b;
        }).length : 0;
        let best = 0;
        for (let t = 0; t < 30 && best < 2; t++) {
          await new Promise((r) => setTimeout(r, 100));
          const ids = Array.from(el.querySelectorAll('a[href*="/watch?v="]')).map((a) => new URL(a.href).searchParams.get('v'));
          const preview = Array.from(document.querySelectorAll('.cc-in-preview')).find((b) => ids.includes(b.dataset.ccFor));
          best = Math.max(best, visible(el.querySelector('.cc-hover:not(.cc-in-preview)')), visible(preview));
        }
        if (best === 2) return { best };
        const box = el.querySelector('.cc-hover:not(.cc-in-preview)');
        const b = box && box.querySelector('.cc-btn');
        if (!b) return { best, why: 'no buttons were added to the card' };
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const path = [];
        for (let e = top; e && path.length < 4; e = e.parentElement) path.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''));
        return { best, why: `opacity ${getComputedStyle(box).opacity}, card hovered: ${el.matches(':hover')}, on top: ${path.join(' < ')}` };
      });
    }
    if (shown.best !== 2) return { ok: false, detail: `card ${i + 1} on ${where} showed ${shown.best} of 2 buttons on hover (${shown.why})` };
  }
  return { ok: true, detail: `buttons appeared on ${n} cards on ${where}` };
}

// Ages of the top-level results in the order they are shown.
async function shownAges(page, itemSel) {
  const texts = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel))
    .filter((el) => el.getClientRects().length && !el.closest('ytd-shelf-renderer, ytd-reel-shelf-renderer, ytd-horizontal-card-list-renderer, grid-shelf-view-model'))
    .map((el) => ({ top: el.getBoundingClientRect().top, left: el.getBoundingClientRect().left, texts: Array.from(el.querySelectorAll('#metadata-line span, [class*="ContentMetadataViewModelMetadataText"], #metadata span')).flatMap((s) => [s.getAttribute('aria-label') || '', s.textContent]) }))
    .sort((a, b) => a.top - b.top || a.left - b.left), itemSel);
  return texts.map((t) => ({ ...t, age: time.ageFromTexts(t.texts).age }));
}

async function signedOutRun(context, worker) {
  const page = await context.newPage();
  let hoverQuery = null;
  for (const q of QUERIES) {
    await open(page, 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
    if (!(await hasVideos(page))) {
      record('newestFirst', `search "${q}"`, null, 'YouTube showed no videos (sign-in wall or bot check), not checked');
      continue;
    }
    await recordAnchors(page, 'search:' + q);

    const cardSel = 'ytd-search :is(ytd-video-renderer, yt-lockup-view-model):has(a[href*="/watch?v="]):not(:is(ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-search-pyv-renderer) *)';
    const hover = await checkHover(page, cardSel, `search "${q}"`);
    record('hoverButtons', `buttons on search "${q}"`, hover.ok, hover.detail, hover.ok ? {} : await evidence(page, cardSel));

    if (hover.ok && !hoverQuery) hoverQuery = q;

    const toolbar = await page.locator('.cc-toolbar .cc-sort').count();
    if (!toolbar) {
      record('newestFirst', `Newest First on "${q}"`, false, 'the Newest First control did not appear', await evidence(page, 'ytd-search'));
      continue;
    }
    await page.click('.cc-toolbar .cc-sort');
    await page.waitForTimeout(800);
    const ages = await shownAges(page, 'ytd-search ytd-section-list-renderer :is(ytd-video-renderer, yt-lockup-view-model):not(:is(ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-search-pyv-renderer) *)');
    const known = ages.filter((a) => a.age != null).length;
    const sorted = order.isNewestFirst(ages.map((a) => a.age));
    const ok = known >= 3 && sorted;
    record('newestFirst', `Newest First on "${q}"`, ok, ok ? `${known} results in upload-time order` : `upload times read on ${known} of ${ages.length} results, in order: ${sorted}`, ok ? {} : await evidence(page, 'ytd-search'));
  }

  // Last, so the miniplayer it opens can't cover cards in the other checks.
  if (hoverQuery) {
    await open(page, 'https://www.youtube.com/results?search_query=' + encodeURIComponent(hoverQuery));
    const cardSel = 'ytd-search :is(ytd-video-renderer, yt-lockup-view-model):has(a[href*="/watch?v="]):not(:is(ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-search-pyv-renderer) *)';
    const card = page.locator(cardSel).first();

    // Resting on a thumbnail starts YouTube's inline preview, which covers the thumbnail.
    await card.scrollIntoViewIfNeeded();
    await card.locator('a[href*="/watch?v="]').first().hover();
    await page.waitForTimeout(3500);
    const preview = await page.evaluate(() => {
      const p = Array.from(document.querySelectorAll('ytd-video-preview')).find((el) => el.getClientRects().length && el.querySelector('a[href*="/watch?v="]'));
      if (!p) return null;
      const b = p.querySelector('.cc-in-preview .cc-btn');
      if (!b) return { ok: false };
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: !!(top && top.closest('.cc-btn')) };
    });
    if (!preview) record('hoverButtons', 'buttons on the inline preview', null, 'no inline preview played, not checked');
    else record('hoverButtons', 'buttons on the inline preview', preview.ok, preview.ok ? 'buttons show on top of the playing preview' : 'the playing preview covers the buttons', preview.ok ? {} : await evidence(page, 'ytd-video-preview'));

    let queued = false;
    let why = 'no queue appeared after clicking Add to Queue';
    try {
      // Use the preview's copy of the button when a preview is playing on top of the card.
      const inPreview = page.locator('ytd-video-preview .cc-in-preview .cc-btn[data-cc-action="queue"]');
      const usePreview = preview && preview.ok && (await inPreview.isVisible());
      if (!usePreview) {
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        await card.locator('.cc-btn').first().evaluate((b) => b.closest('[data-cc-card]')?.scrollIntoView({ block: 'center' }));
        await card.hover({ position: { x: 5, y: 5 } });
      }
      const btn = usePreview ? inPreview : card.locator('.cc-btn[data-cc-action="queue"]');
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.click({ timeout: 5000 });
      queued = await page.waitForFunction(() => {
        const m = document.querySelector('ytd-miniplayer');
        return !!(m && m.getClientRects().length && /queue/i.test(m.innerText));
      }, null, { timeout: 6000 }).then(() => true, () => false);
    } catch (err) {
      why = 'could not click Add to Queue: ' + String(err.message).split('\n')[0];
    }
    record('hoverButtons', 'Add to Queue adds the video', queued, queued ? 'the miniplayer queue opened with the video' : why, queued ? {} : await evidence(page, 'ytd-popup-container'));
    await page.evaluate(() => document.querySelector('ytd-miniplayer .ytp-miniplayer-close-button, ytd-miniplayer button[aria-label*="Close"]')?.click()).catch(() => {});
  }

  const state = await fixState(worker, 'newestFirst');
  record('newestFirst', 'self-check', state === 'working' ? true : state === 'changed' ? false : null, `extension reports "${state}"`);
  await page.close();
}

async function signedInRun(context, worker) {
  const page = await context.newPage();

  await open(page, 'https://www.youtube.com/');
  if (!(await page.locator('#avatar-btn, button#avatar-btn').count())) {
    record('hoverButtons', 'signed in', null, 'the test profile is not signed in; sign in once with --setup');
    await page.close();
    return;
  }
  await recordAnchors(page, 'home');
  const homeCards = 'ytd-browse[page-subtype="home"] ytd-rich-item-renderer:has(a[href*="/watch?v="])' + NOT_AD;
  const homeHover = await checkHover(page, homeCards, 'the home page');
  record('hoverButtons', 'buttons on the home page', homeHover.ok, homeHover.detail, homeHover.ok ? {} : await evidence(page, homeCards));

  if (homeHover.ok) {
    const card = page.locator(homeCards).first();
    const href = await card.locator('a[href*="/watch?v="]').first().getAttribute('href');
    const videoId = new URL(href, 'https://www.youtube.com').searchParams.get('v');
    await page.mouse.move(0, 0);
    await pointAt(page, card);
    await page.waitForTimeout(600);
    const clicked = await clickAction(page, card, 'watchLater');
    if (!clicked) console.log('     (the Watch Later button was not on top; checking the list anyway)');
    await page.waitForTimeout(2500);
    await open(page, 'https://www.youtube.com/playlist?list=WL');
    const item = page.locator(`ytd-playlist-video-renderer:has(a[href*="v=${videoId}"])`).first();
    const saved = (await item.count()) > 0;
    record('hoverButtons', 'Watch Later really adds the video', saved, saved ? `video ${videoId} is in Watch Later` : `video ${videoId} was not found in Watch Later`, saved ? {} : await evidence(page, 'ytd-playlist-video-list-renderer'));
    if (saved) {
      await item.hover({ force: true });
      await item.locator('button[aria-label="Action menu"], button[aria-label="More actions"]').first().click();
      const remove = page.locator('ytd-popup-container [role="menuitem"]:has-text("Remove from Watch later")').first();
      await remove.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      console.log('     (removed the test video from Watch Later again)');
    }
  }

  await open(page, 'https://www.youtube.com/feed/subscriptions');
  if (!(await hasVideos(page))) {
    record('subsList', 'subscriptions feed', null, 'the feed showed no videos (follow a few channels with the test account)');
  } else {
    await recordAnchors(page, 'subscriptions');
    const subCards = 'ytd-browse[page-subtype="subscriptions"] ytd-rich-item-renderer:has(a[href*="/watch?v="])' + NOT_AD;
    const subHover = await checkHover(page, subCards, 'the subscriptions feed');
    record('hoverButtons', 'buttons on the subscriptions feed', subHover.ok, subHover.detail, subHover.ok ? {} : await evidence(page, subCards));
    await page.evaluate(() => window.scrollTo(0, 0));
    const listOn = await page.locator('ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer[data-cc-list]').count();
    const ages = await shownAges(page, subCards);
    const lefts = new Set(ages.slice(0, 10).map((a) => Math.round(a.left)));
    const sorted = order.isNewestFirst(ages.map((a) => a.age));
    const known = ages.filter((a) => a.age != null).length;
    const ok = listOn > 0 && lefts.size === 1 && known >= 3 && sorted;
    record('subsList', 'list view in time order', ok, ok ? `${ages.length} rows, one per line, newest first` : `list attribute: ${listOn > 0}, columns: ${lefts.size}, times read: ${known}, in order: ${sorted}`, ok ? {} : await evidence(page, 'ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer'));
  }
  for (const fixId of ['hoverButtons', 'subsList']) {
    const state = await fixState(worker, fixId);
    if (state === 'changed') record(fixId, 'self-check', false, 'extension reports "changed"');
  }
  await page.close();
}

if (args.includes('--setup')) {
  // Opens the test profile in the same Chromium the test uses, but started on its own with no
  // automation attached: Google refuses sign-ins in a browser driven by test software. The
  // owner signs in to the test account by hand and closes the window; later runs reuse the
  // sign-in saved in the profile.
  if (!PROFILE) throw new Error('--setup needs --profile <folder>');
  const exe = chromium.executablePath();
  console.log('Sign in to the test Google account in the window that opens, then close it.');
  const child = spawn(exe, [`--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
    'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F'], { stdio: 'ignore' });
  await new Promise((resolve) => child.on('exit', resolve));
  process.exit(0);
}

const { context, worker } = await launch({
  userDataDir: PROFILE || undefined,
  headed: args.includes('--headed'),
  patchRules: (r) => { r.fixes.hoverButtons.anchors.nativeButtons = ['cc-never-matches']; }
});
const chromeVersion = context.browser() ? context.browser().version() : await worker.evaluate(() => navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown');

try {
  if (SIGNED_IN) await signedInRun(context, worker);
  else await signedOutRun(context, worker);
} catch (err) {
  console.error('The scheduled test stopped early:', err);
  record('hoverButtons', 'test run', null, 'the test stopped early: ' + String(err && err.message).slice(0, 300));
} finally {
  await context.close();
}

const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
const results = {
  mode: MODE,
  runAt: new Date().toISOString(),
  date: new Date().toISOString().slice(0, 10),
  chromeVersion,
  extensionVersion: manifest.version,
  runUrl,
  forcedFailure: FORCE_FAIL || null,
  checks,
  anchors
};
await writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = checks.filter((c) => c.ok === false).length;
console.log(`\n${checks.filter((c) => c.ok).length} passed, ${failed} failed, ${checks.filter((c) => c.ok == null).length} not checked. Results: ${path.join(OUT, 'results.json')}`);
