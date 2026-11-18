// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Self-check rules. Each fix reports one outcome per page load:
//   ok      the fix found its anchors and applied
//   miss    the page has videos but the fix's anchors are missing
//   novideo the page has no videos (empty feed, signed-out home page)
//   na      the page doesn't use this fix
//   off     the user turned the fix off
// A warning needs two misses in a row, and clears as soon as the fix works again.
(function (root) {
  'use strict';

  const MISS_LIMIT = 2;
  const STATES = ['working', 'off', 'na', 'changed', 'checking'];

  // prevState: this tab's last state for the fix. misses: misses in a row for the fix (all tabs).
  function reduce(prevState, misses, outcome) {
    const m = Number.isFinite(misses) ? misses : 0;
    switch (outcome) {
      case 'ok':
        return { state: 'working', misses: 0 };
      case 'miss': {
        const next = m + 1;
        return { state: next >= MISS_LIMIT || prevState === 'changed' ? 'changed' : 'checking', misses: next };
      }
      case 'off':
        return { state: 'off', misses: m };
      case 'novideo':
      case 'na':
        return { state: 'na', misses: m };
      default:
        return { state: prevState || 'checking', misses: m };
    }
  }

  function anyChanged(tabStates) {
    return Object.values(tabStates || {}).some((s) => s === 'changed');
  }

  const api = { MISS_LIMIT, STATES, reduce, anyChanged };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.ClassicControls = root.ClassicControls || {}).state = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
