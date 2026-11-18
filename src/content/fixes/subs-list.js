// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Subscriptions list view: shows the Subscriptions feed one video per row, in upload-time
// order, by restyling the feed YouTube already loaded (no extra requests). A separate switch
// hides Shorts from the feed.
(function () {
  'use strict';
  const CC = globalThis.ClassicControls;

  let ctx = null;

  function anchors() {
    return ctx.rules.anchors;
  }

  function findGrid() {
    return CC.qa(document, anchors().grid).find(CC.isShown) || null;
  }

  function contentsOf(grid) {
    return Array.from(grid.children).find((c) => CC.matches(c, anchors().gridContents)) || CC.q(grid, anchors().gridContents);
  }

  function rows(contents) {
    const out = [];
    for (const child of contents.children) {
      if (child.tagName === 'YTD-RICH-GRID-ROW') {
        child.setAttribute('data-cc-flat', '');
        const inner = child.querySelector('#contents') || child;
        inner.setAttribute('data-cc-flat', '');
        for (const el of inner.children) out.push(el);
      } else {
        out.push(child);
      }
    }
    return out;
  }

  function isShortsItem(el) {
    return !!CC.q(el, anchors().shortsLink) && !el.querySelector('a[href*="/watch?v="]');
  }

  function clearList() {
    document.querySelectorAll('[data-cc-list]').forEach((el) => el.removeAttribute('data-cc-list'));
    document.querySelectorAll('[data-cc-flat]').forEach((el) => el.removeAttribute('data-cc-flat'));
    document.querySelectorAll('[data-cc-order]').forEach((el) => {
      el.style.order = '';
      el.removeAttribute('data-cc-order');
    });
  }

  function clearShorts() {
    document.querySelectorAll('[data-cc-hide-shorts]').forEach((el) => el.removeAttribute('data-cc-hide-shorts'));
  }

  function apply() {
    if (!ctx) return;
    const s = ctx.settings();
    const grid = findGrid();
    if (!grid) return;
    const contents = contentsOf(grid);
    if (!contents) return;

    if (s.hideShorts) {
      for (const el of CC.qa(contents, anchors().shortsSection)) el.setAttribute('data-cc-hide-shorts', '');
      for (const el of CC.qa(contents, anchors().item)) {
        if (isShortsItem(el)) el.setAttribute('data-cc-hide-shorts', '');
      }
    } else {
      clearShorts();
    }

    if (s.fixes.subsList) {
      grid.setAttribute('data-cc-list', '');
      const list = rows(contents);
      const items = list.map((el) => {
        if (CC.matches(el, anchors().continuation)) return { kind: 'end' };
        if (CC.matches(el, anchors().item)) return { kind: 'video', ...CC.cardAge(el, anchors()) };
        return { kind: 'other' };
      });
      const orders = CC.order.computeOrder(items);
      list.forEach((el, i) => {
        const v = String(orders[i]);
        if (el.style.order !== v) el.style.order = v;
        el.setAttribute('data-cc-order', '');
      });
    } else {
      clearList();
    }
  }

  CC.registerFix({
    id: 'subsList',
    enabled: (s) => s.fixes.subsList || s.hideShorts,
    start(c) {
      ctx = c;
    },
    stop() {
      clearList();
      clearShorts();
      ctx = null;
    },
    apply,
    check() {
      const grid = findGrid();
      const contents = grid && contentsOf(grid);
      if (!contents) return false;
      const items = CC.qa(contents, anchors().item);
      if (!items.length) return false;
      if (!ctx.settings().fixes.subsList) return true;
      return grid.hasAttribute('data-cc-list') && items.some((el) => CC.cardAge(el, anchors()).age != null);
    }
  });
})();
