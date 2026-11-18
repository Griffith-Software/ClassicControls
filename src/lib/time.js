// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Reads YouTube's relative upload times ("2d ago", "55 min ago", "Streamed 4 days ago")
// and turns them into an age in seconds. English YouTube interface only in 1.0.0.
(function (root) {
  'use strict';

  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const UNITS = [
    [/^(s|sec|secs|second|seconds)$/, 1],
    [/^(m|min|mins|minute|minutes)$/, MINUTE],
    [/^(h|hr|hrs|hour|hours)$/, HOUR],
    [/^(d|day|days)$/, DAY],
    [/^(w|wk|wks|week|weeks)$/, 7 * DAY],
    [/^(mo|mos|month|months)$/, 30 * DAY],
    [/^(y|yr|yrs|year|years)$/, 365 * DAY]
  ];

  function clean(text) {
    return String(text == null ? '' : text).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function unitSeconds(unit) {
    for (const [re, secs] of UNITS) if (re.test(unit)) return secs;
    return null;
  }

  // Seconds since upload, 0 for a stream that is live now, or null when the text isn't an upload time.
  function parseAge(text) {
    const t = clean(text);
    if (!t) return null;
    if (/^live( now)?$/.test(t) || /^[\d.,]+[km]? watching$/.test(t) || /\bstreaming now\b/.test(t)) return 0;
    const m = t.match(/(?:^|\s)(\d+(?:[.,]\d+)?|an?|one)\s*([a-z]+)\s+ago\b/);
    if (!m) return null;
    const secs = unitSeconds(m[2]);
    if (secs == null) return null;
    const n = /^(an?|one)$/.test(m[1]) ? 1 : Number(m[1].replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * secs);
  }

  // True for scheduled streams and premieres that haven't started yet.
  function isUpcoming(text) {
    const t = clean(text);
    return /^(premieres|scheduled for|upcoming)\b/.test(t) || /\bwaiting\b/.test(t);
  }

  // Picks the first age found in a list of candidate texts (aria-labels and visible text).
  function ageFromTexts(texts) {
    let upcoming = false;
    for (const text of texts) {
      const age = parseAge(text);
      if (age != null) return { age, upcoming: false };
      if (isUpcoming(text)) upcoming = true;
    }
    return { age: null, upcoming };
  }

  const api = { parseAge, isUpcoming, ageFromTexts };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.ClassicControls = root.ClassicControls || {}).time = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
