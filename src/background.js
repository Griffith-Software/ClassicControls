// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Background service worker. Hands the page-matching rules to the content script, keeps each
// fix's self-check state for each tab in chrome.storage.session, and shows a small mark on the
// toolbar icon when YouTube has changed a page. It makes no network requests.
importScripts('lib/settings.js', 'lib/state.js');

const CC = globalThis.ClassicControls;
const PREFIX = CC.settings.PREFIX;
const MISSES_KEY = PREFIX + 'misses';
const tabKey = (tabId) => PREFIX + 'tab.' + tabId;

let rulesPromise = null;
function getRules() {
  if (!rulesPromise) {
    rulesPromise = fetch(chrome.runtime.getURL('data/fixes.json')).then((r) => r.json());
    rulesPromise.catch(() => { rulesPromise = null; });
  }
  return rulesPromise;
}

async function updateBadge(tabId, tab) {
  const changed = CC.state.anyChanged(tab && tab.fixes);
  try {
    await chrome.action.setBadgeText({ tabId, text: changed ? '!' : '' });
    if (changed) await chrome.action.setBadgeBackgroundColor({ tabId, color: '#B45309' });
    await chrome.action.setTitle({ tabId, title: changed ? 'Classic Controls: YouTube changed this page' : 'Classic Controls' });
  } catch (_) {
    // The tab closed before the badge could be set.
  }
}

async function handleReport(tabId, msg) {
  const key = tabKey(tabId);
  const got = await chrome.storage.session.get([key, MISSES_KEY]);
  const tab = got[key] || { page: null, fixes: {} };
  const misses = got[MISSES_KEY] || {};
  const next = CC.state.reduce(tab.fixes[msg.fixId], misses[msg.fixId], msg.outcome);
  tab.fixes[msg.fixId] = next.state;
  tab.page = msg.page || null;
  tab.updated = Date.now();
  misses[msg.fixId] = next.misses;
  await chrome.storage.session.set({ [key]: tab, [MISSES_KEY]: misses });
  await updateBadge(tabId, tab);
}

async function clearTab(tabId) {
  await chrome.storage.session.remove(tabKey(tabId));
  await updateBadge(tabId, null);
}

// Reports are handled one at a time so two fixes reporting together don't overwrite each other.
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(fn).catch(() => {});
  return queue;
}

const FIX_IDS = new Set(CC.settings.FIX_IDS);
const OUTCOMES = new Set(['ok', 'miss', 'novideo', 'na', 'off']);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === 'cc-rules') {
    getRules().then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg.type === 'cc-report' && sender.tab && sender.tab.id >= 0 && FIX_IDS.has(msg.fixId) && OUTCOMES.has(msg.outcome)) {
    const tabId = sender.tab.id;
    enqueue(() => handleReport(tabId, msg));
  }
  return false;
});

// Leaving YouTube in a tab clears that tab's status and mark.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'loading') return;
  if (!String(tab.url || '').startsWith('https://www.youtube.com/')) enqueue(() => clearTab(tabId));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => chrome.storage.session.remove(tabKey(tabId)));
});
