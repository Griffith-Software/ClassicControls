// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Starts Chromium with the extension loaded (a fresh copy of the shipped files).
import { chromium } from 'playwright';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyExtension } from '../../scripts/files.mjs';

export async function launch(opts = {}) {
  const work = await mkdtemp(path.join(os.tmpdir(), 'classic-controls-'));
  const ext = await copyExtension(path.join(work, 'ext'));
  if (opts.patchRules) {
    const file = path.join(ext, 'data', 'fixes.json');
    const rules = JSON.parse(await readFile(file, 'utf8'));
    opts.patchRules(rules);
    await writeFile(file, JSON.stringify(rules, null, 2));
  }
  const userDataDir = opts.userDataDir || path.join(work, 'profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: opts.headed ? false : true,
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
    ignoreDefaultArgs: ['--enable-automation'],
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--lang=en-US', '--autoplay-policy=user-gesture-required']
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).host;
  return { context, worker, extensionId, extPath: ext, work };
}

// Self-check state the extension recorded for a tab (read from the service worker).
export async function tabStates(worker) {
  return worker.evaluate(async () => {
    const all = await chrome.storage.session.get(null);
    return all;
  });
}

export async function setSettings(worker, settings) {
  await worker.evaluate(async (s) => {
    await chrome.storage.sync.set({ 'software.griffith.classiccontrols.settings': s });
  }, settings);
}

// Accepts or dismisses YouTube's cookie consent page if it appears (EU runners).
export async function passConsent(page) {
  if (!/consent\./.test(page.url())) return;
  let btn = page.locator('button:has-text("Reject all")').first();
  if (!(await btn.count())) btn = page.locator('button:has-text("Accept all")').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForLoadState('domcontentloaded');
  }
}
