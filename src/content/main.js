// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Runs the fixes on YouTube. YouTube is a single-page app, so the fixes rerun on its own
// navigation event and whenever new videos load. After each page load settles, every fix
// that applies checks itself and reports to the background (see Self-check in the README).
(function () {
  'use strict';
  const CC = globalThis.ClassicControls;
  const KEY = CC.settings.KEY;

  let rules = null;
  let settings = CC.settings.normalize(null);
  let page = 'other';
  let lastHref = '';
  let navSeq = 0;
  let settleTimer = null;
  let applyTimer = null;
  let settled = false;
  const active = new Set();
  const reported = {};

  function report(id, outcome) {
    reported[id] = outcome;
    CC.report(id, outcome, page);
  }

  function makeCtx(id) {
    return {
      rules: rules.fixes[id],
      all: rules,
      settings: () => settings,
      report: (outcome) => report(id, outcome)
    };
  }

  function safe(fn) {
    try { return fn(); } catch (err) { console.debug('[Classic Controls]', err); return undefined; }
  }

  function applyAll() {
    for (const id of active) {
      const fix = CC.fixes.get(id);
      safe(() => fix.apply());
      // Clear a warning as soon as the fix works again.
      if (settled && reported[id] !== 'ok' && safe(() => fix.check())) report(id, 'ok');
    }
  }

  function scheduleApply() {
    if (applyTimer) return;
    applyTimer = setTimeout(() => {
      applyTimer = null;
      if (location.href !== lastHref) onNavigate();
      else applyAll();
    }, 200);
  }

  function settleCheck(seq, attempt) {
    if (seq !== navSeq) return;
    applyAll();
    const hasVideos = !!document.querySelector(rules.videoLinks);
    if (!hasVideos && attempt < 1) {
      settleTimer = setTimeout(() => settleCheck(seq, attempt + 1), rules.settleMs);
      return;
    }
    settled = true;
    for (const id of active) {
      if (!hasVideos) report(id, 'novideo');
      else report(id, safe(() => CC.fixes.get(id).check()) ? 'ok' : 'miss');
    }
  }

  function onNavigate() {
    if (!rules) return;
    lastHref = location.href;
    navSeq++;
    settled = false;
    page = CC.pageKind(rules);
    for (const [id, fix] of CC.fixes) {
      const fixRules = rules.fixes[id];
      const applies = !!fixRules && fixRules.pages.includes(page);
      const enabled = !!fix.enabled(settings);
      if (applies && enabled) {
        if (!active.has(id)) {
          safe(() => fix.start(makeCtx(id)));
          active.add(id);
        }
      } else {
        if (active.has(id)) {
          safe(() => fix.stop());
          active.delete(id);
        }
        report(id, applies ? 'off' : 'na');
      }
    }
    applyAll();
    clearTimeout(settleTimer);
    const seq = navSeq;
    settleTimer = setTimeout(() => settleCheck(seq, 0), rules.settleMs);
  }

  async function init() {
    try {
      rules = await chrome.runtime.sendMessage({ type: 'cc-rules' });
    } catch (_) {
      rules = null;
    }
    if (!rules || !rules.fixes) return;
    try {
      const got = await chrome.storage.sync.get(KEY);
      settings = CC.settings.normalize(got[KEY]);
    } catch (_) { /* defaults */ }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes[KEY]) return;
      settings = CC.settings.normalize(changes[KEY].newValue);
      onNavigate();
    });
    document.addEventListener('yt-navigate-finish', () => onNavigate());
    new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });
    onNavigate();
  }

  init();
})();
