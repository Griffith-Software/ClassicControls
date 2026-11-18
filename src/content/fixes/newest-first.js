// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Newest First on the search results page. YouTube no longer sorts search results by upload
// date, so this sorts the results YouTube has loaded by their upload time, newest at the top,
// and keeps sorting as more load. The upload-time chips apply YouTube's own upload-date filter
// (including Last Hour, which YouTube still supports but no longer shows).
(function () {
  'use strict';
  const CC = globalThis.ClassicControls;

  const CHIPS = [
    { label: 'Any Time', value: null },
    { label: 'Last Hour', value: 1 },
    { label: 'Today', value: 2 },
    { label: 'This Week', value: 3 },
    { label: 'This Month', value: 4 },
    { label: 'This Year', value: 5 }
  ];

  let ctx = null;
  let sorted = false;
  let lastDefault = null;
  let toolbar = null;

  function anchors() {
    return ctx.rules.anchors;
  }

  function currentSp() {
    return new URLSearchParams(location.search).get('sp') || '';
  }

  function goToUploadDate(value) {
    const sp = currentSp();
    let next = CC.sp.setUploadDate(sp, value);
    if (next == null) next = value == null ? '' : CC.sp.setUploadDate('', value);
    const url = new URL(location.href);
    if (next) url.searchParams.set('sp', next);
    else url.searchParams.delete('sp');
    location.assign(url.toString());
  }

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'cc-toolbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Classic Controls');

    const sortBtn = document.createElement('button');
    sortBtn.type = 'button';
    sortBtn.className = 'cc-chip cc-sort';
    sortBtn.textContent = 'Newest First';
    sortBtn.title = 'Sort the results YouTube has loaded by upload time, newest first';
    sortBtn.addEventListener('click', () => {
      sorted = !sorted;
      apply();
    });
    bar.appendChild(sortBtn);

    const sep = document.createElement('span');
    sep.className = 'cc-sep';
    bar.appendChild(sep);

    const label = document.createElement('span');
    label.className = 'cc-label';
    label.textContent = 'Uploaded:';
    bar.appendChild(label);

    for (const chip of CHIPS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cc-chip cc-date';
      b.textContent = chip.label;
      b.dataset.value = chip.value == null ? '' : String(chip.value);
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-pressed') === 'true') return;
        goToUploadDate(chip.value);
      });
      bar.appendChild(b);
    }
    return bar;
  }

  function placeToolbar() {
    const results = CC.q(document, anchors().results);
    if (!results) return false;
    const search = results.closest('ytd-search') || document;
    const after = CC.q(search, anchors().toolbarAfter);
    if (!toolbar) toolbar = buildToolbar();
    if (after && after.parentNode) {
      if (after.nextElementSibling !== toolbar) after.insertAdjacentElement('afterend', toolbar);
    } else {
      const list = results.parentElement;
      if (list && list.parentNode && list.previousElementSibling !== toolbar) list.parentNode.insertBefore(toolbar, list);
    }
    const date = CC.sp.getUploadDate(currentSp());
    toolbar.querySelector('.cc-sort').setAttribute('aria-pressed', String(sorted));
    toolbar.querySelectorAll('.cc-date').forEach((b) => {
      const v = b.dataset.value === '' ? null : Number(b.dataset.value);
      b.setAttribute('aria-pressed', String(v === date));
    });
    return true;
  }

  // Every element that becomes a row once sections are flattened, in page order.
  function rows(results) {
    const out = [];
    for (const child of results.children) {
      if (CC.matches(child, anchors().section)) {
        child.setAttribute('data-cc-flat', '');
        for (const part of child.children) {
          if (CC.matches(part, anchors().sectionContents)) {
            part.setAttribute('data-cc-flat', '');
            for (const el of part.children) out.push(el);
          } else {
            out.push(part);
          }
        }
      } else {
        out.push(child);
      }
    }
    return out;
  }

  function sortResults(results) {
    results.setAttribute('data-cc-newest', '');
    const list = rows(results);
    const items = list.map((el) => {
      if (CC.matches(el, anchors().continuation)) return { kind: 'end' };
      if (CC.matches(el, anchors().video)) return { kind: 'video', ...CC.cardAge(el, anchors()) };
      if (CC.matches(el, anchors().shelf)) return { kind: 'shelf' };
      return { kind: 'other' };
    });
    const orders = CC.order.computeOrder(items);
    list.forEach((el, i) => {
      const v = String(orders[i]);
      if (el.style.order !== v) el.style.order = v;
      el.setAttribute('data-cc-order', '');
    });
  }

  function unsort() {
    document.querySelectorAll('[data-cc-newest]').forEach((el) => el.removeAttribute('data-cc-newest'));
    document.querySelectorAll('[data-cc-flat]').forEach((el) => el.removeAttribute('data-cc-flat'));
    document.querySelectorAll('[data-cc-order]').forEach((el) => {
      el.style.order = '';
      el.removeAttribute('data-cc-order');
    });
  }

  function apply() {
    if (!ctx) return;
    const def = ctx.settings().newestFirstDefault;
    if (def !== lastDefault) {
      sorted = def;
      lastDefault = def;
    }
    if (!placeToolbar()) return;
    const results = CC.q(document, anchors().results);
    if (sorted) sortResults(results);
    else unsort();
  }

  CC.registerFix({
    id: 'newestFirst',
    enabled: (s) => s.fixes.newestFirst,
    start(c) {
      ctx = c;
      lastDefault = null;
    },
    stop() {
      unsort();
      if (toolbar) toolbar.remove();
      toolbar = null;
      ctx = null;
    },
    apply,
    check() {
      const results = CC.q(document, anchors().results);
      if (!results || !toolbar || !toolbar.isConnected) return false;
      const videos = CC.qa(results, anchors().video);
      return videos.some((v) => CC.cardAge(v, anchors()).age != null);
    },
    // For the scheduled test.
    isSorted: () => sorted
  });
})();
