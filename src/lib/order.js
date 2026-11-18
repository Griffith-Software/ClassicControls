// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Works out a CSS `order` value for each item in a list so videos show newest first.
// YouTube's elements are never moved, only given an order, so turning a fix off is
// just a matter of clearing the order values again.
(function (root) {
  'use strict';

  const END = 10000000;

  // items: [{ kind: 'video' | 'shelf' | 'other' | 'end', age: number | null, upcoming: boolean }]
  // in page order. Videos are ranked by age (newest first, then unknown ages, then upcoming
  // streams), keeping page order for ties. Shelves of extra videos ("People also watched") go
  // after the sorted videos. Anything else (ads, headers) keeps its place right after the video
  // it followed, and the "load more" spinner stays last.
  function computeOrder(items) {
    const videos = [];
    items.forEach((it, i) => { if (it.kind === 'video') videos.push({ i, it }); });
    const group = (it) => (it.age != null ? 0 : it.upcoming ? 2 : 1);
    videos.sort((a, b) => {
      const ga = group(a.it);
      const gb = group(b.it);
      if (ga !== gb) return ga - gb;
      if (ga === 0 && a.it.age !== b.it.age) return a.it.age - b.it.age;
      return a.i - b.i;
    });
    const orders = new Array(items.length).fill(0);
    videos.forEach((v, rank) => { orders[v.i] = rank + 1; });
    let last = 0;
    items.forEach((it, i) => {
      if (it.kind === 'video') last = orders[i];
      else if (it.kind === 'end') orders[i] = END;
      else if (it.kind === 'shelf') orders[i] = END - 1;
      else orders[i] = last;
    });
    return orders;
  }

  // True when the ages, read in display order, never get older then newer again.
  function isNewestFirst(ages) {
    const known = ages.filter((a) => a != null);
    for (let i = 1; i < known.length; i++) if (known[i] < known[i - 1]) return false;
    return true;
  }

  const api = { computeOrder, isNewestFirst, END };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.ClassicControls = root.ClassicControls || {}).order = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
