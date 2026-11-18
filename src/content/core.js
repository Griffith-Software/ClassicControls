// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Shared helpers for the content script: selector lists from data/fixes.json, page kind,
// reading upload times from a card, and reporting each fix's self-check to the background.
(function () {
  'use strict';
  const CC = globalThis.ClassicControls;
  CC.fixes = new Map();
  CC.registerFix = (fix) => CC.fixes.set(fix.id, fix);

  const validCache = new Map();
  function valid(sel) {
    if (!validCache.has(sel)) {
      let ok = true;
      try { document.createDocumentFragment().querySelector(sel); } catch (_) { ok = false; }
      validCache.set(sel, ok);
    }
    return validCache.get(sel);
  }
  function joined(sels) {
    return (sels || []).filter(valid).join(', ');
  }

  // First element matching any selector in the list, trying them in list order.
  CC.q = function (root, sels) {
    if (!root) return null;
    for (const s of sels || []) {
      if (!valid(s)) continue;
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  // All elements matching any selector in the list, in page order.
  CC.qa = function (root, sels) {
    const sel = joined(sels);
    return root && sel ? Array.from(root.querySelectorAll(sel)) : [];
  };

  CC.matches = function (el, sels) {
    const sel = joined(sels);
    return !!(el && el.nodeType === 1 && sel && el.matches(sel));
  };

  CC.closest = function (el, sels) {
    const sel = joined(sels);
    return el && el.nodeType === 1 && sel ? el.closest(sel) : null;
  };

  CC.pageKind = function (rules) {
    const path = location.pathname;
    for (const [kind, pattern] of Object.entries(rules.pages || {})) {
      try { if (new RegExp(pattern).test(path)) return kind; } catch (_) { /* bad rule */ }
    }
    return 'other';
  };

  CC.isShown = function (el) {
    return !!(el && el.isConnected && el.getClientRects().length);
  };

  // Upload age of a card in seconds (0 for live), read from its time text and badges.
  CC.cardAge = function (card, anchors) {
    if (CC.q(card, anchors.liveBadge)) return { age: 0, upcoming: false };
    const texts = [];
    for (const el of CC.qa(card, anchors.timeText)) {
      const label = el.getAttribute('aria-label');
      if (label) texts.push(label);
      texts.push(el.textContent);
    }
    return CC.time.ageFromTexts(texts);
  };

  CC.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  CC.waitFor = async function (fn, timeout, step) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return null;
      await CC.sleep(step || 50);
    }
  };

  CC.report = function (fixId, outcome, page) {
    try {
      chrome.runtime.sendMessage({ type: 'cc-report', fixId, outcome, page }).catch(() => {});
    } catch (_) {
      // The extension was reloaded or removed; this old content script can't report any more.
    }
  };

  CC.svg = function (pathD) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  };
})();
