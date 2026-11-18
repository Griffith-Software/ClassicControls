// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Browser test of the built extension against stand-in YouTube pages (no real YouTube).
// Covers the self-check rules, the toolbar mark, turning fixes off without a reload,
// hover buttons using the page's own menu, export and import, and "no requests of its own".
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launch, tabStates, setSettings } from '../lib/launch.mjs';
import { searchPage } from './fixture.mjs';

const KEY = 'software.griffith.classiccontrols.settings';
const DEFAULTS = { fixes: { hoverButtons: true, newestFirst: true, subsList: true }, hideShorts: false, newestFirstDefault: false };
let broken = false;
const outside = [];
const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push(['ok', name]);
    console.log('ok   ' + name);
  } catch (err) {
    results.push(['FAIL', name]);
    console.log('FAIL ' + name + '\n     ' + String(err && err.message).split('\n').join('\n     '));
  }
}

const { context, worker, extensionId } = await launch({ patchRules: (r) => { r.settleMs = 400; } });
context.on('request', (req) => {
  const u = req.url();
  if (!u.startsWith('https://www.youtube.com/') && !u.startsWith('chrome-extension://') && !u.startsWith('data:') && !u.startsWith('blob:')) outside.push(u);
});
await context.route('https://www.youtube.com/**', (route) => {
  route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: searchPage({ broken }) });
});

const page = await context.newPage();
const URL = 'https://www.youtube.com/results?search_query=test';
const settle = () => page.waitForTimeout(1300);
const states = async () => {
  const all = await tabStates(worker);
  const tab = Object.entries(all).find(([k]) => k.includes('.tab.'));
  return tab ? tab[1].fixes : {};
};
const tabId = async () => worker.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/*' }))[0].id);
const badge = async () => worker.evaluate(async (id) => chrome.action.getBadgeText({ tabId: id }), await tabId());
const visualOrder = () => page.evaluate(() => Array.from(document.querySelectorAll('ytd-video-renderer'))
  .map((el) => [el.getBoundingClientRect().top, el.dataset.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]));

await page.goto(URL);
await settle();

await step('fixes report Working on a normal search page', async () => {
  const s = await states();
  assert.equal(s.hoverButtons, 'working');
  assert.equal(s.newestFirst, 'working');
  assert.equal(s.subsList, 'na');
  assert.equal(await badge(), '');
});

await step('Newest First sorts the loaded results by upload time', async () => {
  assert.deepEqual(await visualOrder(), ['a1', 'a2', 'a3', 'a4', 'a5']);
  await page.click('.cc-sort');
  await page.waitForTimeout(300);
  assert.deepEqual(await visualOrder(), ['a2', 'a4', 'a3', 'a1', 'a5']);
  const spinnerLast = await page.evaluate(() => {
    const s = document.querySelector('ytd-continuation-item-renderer').getBoundingClientRect().top;
    return Array.from(document.querySelectorAll('ytd-video-renderer')).every((v) => v.getBoundingClientRect().top < s);
  });
  assert.ok(spinnerLast, 'load-more spinner stays at the bottom');
});

await step('Last Hour chip applies YouTube\'s own upload-date filter', async () => {
  await page.click('.cc-date:has-text("Last Hour")');
  await page.waitForLoadState('domcontentloaded');
  assert.equal(new globalThis.URL(page.url()).searchParams.get('sp'), 'EgIIAQ==');
  await settle();
  assert.equal(await page.getAttribute('.cc-date:has-text("Last Hour")', 'aria-pressed'), 'true');
  await page.goto(URL);
  await settle();
});

await step('hover buttons use the page\'s own menu, out of sight', async () => {
  const card = page.locator('ytd-video-renderer[data-id="a3"]');
  await card.hover();
  await page.waitForTimeout(500);
  await card.locator('.cc-btn[data-cc-action="queue"]').click();
  await page.waitForFunction(() => document.body.dataset.lastAction);
  assert.equal(await page.evaluate(() => document.body.dataset.lastAction), 'queue:a3');
  assert.equal(await page.evaluate(() => document.body.dataset.menuOpacity), '0');
  await card.locator('.cc-btn[data-cc-action="watchLater"]').click();
  await page.waitForFunction(() => document.body.dataset.lastAction === 'wl:a3');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-cc-menu-hidden')), false);
});

await step('turning a fix off removes its changes without a reload', async () => {
  await setSettings(worker, { ...DEFAULTS, fixes: { ...DEFAULTS.fixes, newestFirst: false, hoverButtons: false } });
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => ({
    toolbar: document.querySelectorAll('.cc-toolbar').length,
    ordered: document.querySelectorAll('[data-cc-order], [data-cc-newest], [data-cc-flat]').length,
    hover: document.querySelectorAll('.cc-hover, [data-cc-card]').length
  }));
  assert.deepEqual(left, { toolbar: 0, ordered: 0, hover: 0 });
  assert.deepEqual(await visualOrder(), ['a1', 'a2', 'a3', 'a4', 'a5']);
  const s = await states();
  assert.equal(s.newestFirst, 'off');
  assert.equal(s.hoverButtons, 'off');
  await setSettings(worker, DEFAULTS);
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.cc-toolbar').count(), 1);
});

await step('one load with anchors missing does not warn', async () => {
  broken = true;
  await page.reload();
  await settle();
  const s = await states();
  assert.equal(s.newestFirst, 'checking');
  assert.equal(await badge(), '');
});

await step('second load in a row warns, other fixes keep working, icon is marked', async () => {
  await page.reload();
  await settle();
  const s = await states();
  assert.equal(s.newestFirst, 'changed');
  assert.equal(s.hoverButtons, 'working');
  assert.equal(await badge(), '!');
});

await step('popup shows the YouTube Changed This Page message', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html?tab=${await tabId()}`);
  await popup.waitForTimeout(500);
  const fix = popup.locator('.fix[data-fix="newestFirst"]');
  assert.equal(await fix.locator('.status-text').innerText(), 'YouTube Changed This Page');
  assert.equal(await fix.locator('.notice').isVisible(), true);
  const text = await fix.locator('.notice').innerText();
  assert.match(text, /The Newest First control can't be added right now because YouTube changed how this page is built\./);
  assert.match(text, /usually spotted quickly/);
  assert.equal(await fix.locator('a').first().getAttribute('href'), 'https://github.com/Griffith-Software/ClassicControls/issues?q=label%3Ayoutube-change');
  assert.equal(await fix.locator('a').nth(1).getAttribute('href'), 'https://griffith.software/feedback.html');
  assert.equal(await popup.locator('.fix[data-fix="hoverButtons"] .status-text').innerText(), 'Working');
  assert.equal(await popup.locator('.fix[data-fix="hoverButtons"] .notice').isVisible(), false);
  assert.equal(await popup.locator('.fix[data-fix="subsList"] .status').isVisible(), false);
  assert.match(await popup.locator('#about-line').textContent(), /^Classic Controls · by Griffith Software · 1\.0\.0 · © 2026 Griffith Software · Apache 2\.0 with Commons Clause · https:\/\/griffith\.software$/);
  await popup.close();
});

await step('message clears by itself when the anchors return', async () => {
  broken = false;
  await page.reload();
  await settle();
  const s = await states();
  assert.equal(s.newestFirst, 'working');
  assert.equal(await badge(), '');
});

await step('settings export then import restores everything', async () => {
  const mine = { fixes: { hoverButtons: false, newestFirst: true, subsList: false }, hideShorts: true, newestFirstDefault: true };
  await setSettings(worker, mine);
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extensionId}/src/popup/options.html`);
  await opts.waitForTimeout(300);
  const [download] = await Promise.all([opts.waitForEvent('download'), opts.click('#export')]);
  const file = await download.path();
  const data = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(data.generator, 'Classic Controls by Griffith Software');
  assert.equal(data.appVersion, '1.0.0');
  assert.equal(data.schemaVersion, 1);
  await setSettings(worker, DEFAULTS);
  await opts.setInputFiles('#import-file', file);
  await opts.waitForTimeout(500);
  const stored = await worker.evaluate(async (k) => (await chrome.storage.sync.get(k))[k], KEY);
  assert.deepEqual(stored, mine);
  assert.equal(await opts.locator('#tools-msg').innerText(), 'Settings imported.');
  assert.equal(await opts.locator('.fix[data-fix="hoverButtons"] .fix-toggle').isChecked(), false);
  await opts.close();
  await setSettings(worker, DEFAULTS);
});

await step('the extension made no requests to any other origin', async () => {
  assert.deepEqual(outside, []);
});

await context.close();
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
