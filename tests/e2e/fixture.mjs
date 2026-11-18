// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// A small stand-in for YouTube's search page, served at https://www.youtube.com/ during the
// browser test. It uses YouTube's element names so the real rules in data/fixes.json apply.
// `broken: true` leaves out the results list the Newest First fix needs (its "anchor").

const VIDEOS = [
  ['a1', 'Older video', '3 weeks ago', '3w ago'],
  ['a2', 'Newest video', '5 minutes ago', '5 min ago'],
  ['a3', 'Middle video', '2 days ago', '2d ago'],
  ['a4', 'Recent video', '7 hours ago', '7h ago'],
  ['a5', 'Old video', '1 year ago', '1y ago']
];

function card([id, title, label, short]) {
  return `
  <ytd-video-renderer data-id="${id}">
    <div id="dismissible">
      <ytd-thumbnail style="display:block;position:relative;width:240px;height:135px;background:#888">
        <a id="thumbnail" href="/watch?v=${id}" style="display:block;width:100%;height:100%"></a>
      </ytd-thumbnail>
      <div class="text">
        <a id="video-title" href="/watch?v=${id}">${title}</a>
        <div id="metadata-line"><span>1K views</span><span aria-label="${label}">${short}</span></div>
        <div id="menu"><ytd-menu-renderer><yt-icon-button id="button"><button aria-label="Action menu">⋮</button></yt-icon-button></ytd-menu-renderer></div>
      </div>
    </div>
  </ytd-video-renderer>`;
}

export function searchPage({ broken = false } = {}) {
  const items = VIDEOS.map(card).join('\n');
  const results = broken
    ? `<div id="moved-results">${items}</div>`
    : `<ytd-section-list-renderer><div id="contents">
         <ytd-item-section-renderer><div id="contents">${items}</div></ytd-item-section-renderer>
         <ytd-continuation-item-renderer>Loading…</ytd-continuation-item-renderer>
       </div></ytd-section-list-renderer>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>test - YouTube</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; }
  ytd-video-renderer { display: block; margin: 8px 0; }
  ytd-video-renderer #dismissible { display: flex; gap: 12px; }
  tp-yt-iron-dropdown { position: fixed; top: 10px; left: 10px; background: #fff; border: 1px solid #ccc; }
</style></head>
<body>
<ytd-app>
  <ytd-page-manager>
    <ytd-search>
      <ytd-search-header-renderer><div>Filters</div></ytd-search-header-renderer>
      ${results}
    </ytd-search>
  </ytd-page-manager>
  <ytd-popup-container></ytd-popup-container>
</ytd-app>
<script>
  // Three-dot menu: opens a dropdown with the same item wording as YouTube.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[aria-label="Action menu"]');
    if (!btn) return;
    const id = btn.closest('ytd-video-renderer').dataset.id;
    const host = document.querySelector('ytd-popup-container');
    host.innerHTML = '<tp-yt-iron-dropdown><ytd-menu-popup-renderer>' +
      '<tp-yt-paper-item role="menuitem" data-act="queue">Add to queue</tp-yt-paper-item>' +
      '<tp-yt-paper-item role="menuitem" data-act="wl">Save to Watch later</tp-yt-paper-item>' +
      '</ytd-menu-popup-renderer></tp-yt-iron-dropdown>';
    host.querySelectorAll('[role=menuitem]').forEach((item) => item.addEventListener('click', () => {
      document.body.dataset.lastAction = item.dataset.act + ':' + id;
      document.body.dataset.menuOpacity = getComputedStyle(host.querySelector('tp-yt-iron-dropdown')).opacity;
      host.innerHTML = '';
    }));
  });
</script>
</body></html>`;
}
