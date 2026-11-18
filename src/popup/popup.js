// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Popup and settings page: a switch per fix, each fix's status on the current YouTube tab,
// the "YouTube changed this page" message, settings export and import, and About.
(function () {
  'use strict';
  const S = globalThis.ClassicControls.settings;
  const isPage = document.body.classList.contains('page');
  const version = chrome.runtime.getManifest().version;

  const SUB_OPTIONS = {
    newestFirst: [{ key: 'newestFirstDefault', label: 'Sort Newest First by Default' }],
    subsList: [{ key: 'hideShorts', label: 'Hide Shorts in Subscriptions' }]
  };
  const STATUS = {
    working: { text: 'Working', cls: 'ok' },
    off: { text: 'Off', cls: 'off' },
    checking: { text: 'Checking', cls: 'off' },
    changed: { text: 'YouTube Changed This Page', cls: 'warn' }
  };

  let rules = null;
  let settings = S.normalize(null);
  let tabId = null;
  let onYouTube = false;
  let tabState = null;
  const rows = {};

  function $(id) {
    return document.getElementById(id);
  }

  async function save() {
    await chrome.storage.sync.set({ [S.KEY]: settings });
  }

  function fixIsOn(id) {
    return id === 'subsList' ? settings.fixes.subsList || settings.hideShorts : settings.fixes[id];
  }

  function build() {
    const tpl = $('fix-template');
    const host = $('fixes');
    for (const id of S.FIX_IDS) {
      const info = rules.fixes[id];
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.fix = id;
      node.querySelector('.name').textContent = info.name;
      const toggle = node.querySelector('.fix-toggle');
      toggle.addEventListener('change', async () => {
        settings.fixes[id] = toggle.checked;
        render();
        await save();
      });
      const sub = node.querySelector('.sub');
      for (const opt of SUB_OPTIONS[id] || []) {
        const label = document.createElement('label');
        label.className = 'check';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.key = opt.key;
        box.addEventListener('change', async () => {
          settings[opt.key] = box.checked;
          render();
          await save();
        });
        label.appendChild(box);
        label.appendChild(document.createTextNode(' ' + opt.label));
        sub.appendChild(label);
        sub.hidden = false;
      }
      const what = node.querySelector('.notice-what');
      if (what) {
        what.textContent = info.subject + " can't be added right now because YouTube changed how this page is built. This isn't a problem with your browser or your settings, and the other fixes still work.";
      }
      host.appendChild(node);
      rows[id] = node;
    }
  }

  function render() {
    for (const id of S.FIX_IDS) {
      const node = rows[id];
      node.querySelector('.fix-toggle').checked = settings.fixes[id];
      node.querySelectorAll('.sub input').forEach((box) => { box.checked = settings[box.dataset.key]; });

      let state = null;
      if (!fixIsOn(id)) state = 'off';
      else if (onYouTube && tabState && tabState.fixes) state = tabState.fixes[id] || null;
      const status = node.querySelector('.status');
      const look = state && STATUS[state];
      status.hidden = !look;
      if (look) {
        status.className = 'status ' + look.cls;
        node.querySelector('.status-text').textContent = look.text;
      }
      const notice = node.querySelector('.notice');
      notice.hidden = isPage || state !== 'changed';
      node.classList.toggle('has-notice', !notice.hidden);
    }
    const hint = $('hint');
    if (hint) hint.hidden = onYouTube;
  }

  function showToolsMessage(text, isError) {
    const el = $('tools-msg');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
    el.hidden = false;
  }

  function exportSettings() {
    const data = S.buildExport(settings, version);
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classic-controls-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToolsMessage('Settings exported.');
  }

  async function importFile(file) {
    if (!file) return;
    const result = S.parseImport(await file.text());
    if (!result.ok) {
      showToolsMessage(result.error, true);
      return;
    }
    settings = result.settings;
    await save();
    render();
    showToolsMessage('Settings imported.');
  }

  async function loadTabState() {
    if (tabId == null) return;
    const key = S.PREFIX + 'tab.' + tabId;
    const got = await chrome.storage.session.get(key);
    tabState = got[key] || null;
  }

  async function init() {
    rules = await (await fetch(chrome.runtime.getURL('data/fixes.json'))).json();
    const got = await chrome.storage.sync.get(S.KEY);
    settings = S.normalize(got[S.KEY]);

    if (!isPage) {
      // ?tab=<id> lets the automated tests open the popup as a page for a given YouTube tab.
      const forced = Number(new URLSearchParams(location.search).get('tab'));
      const [tab] = forced ? [await chrome.tabs.get(forced)] : await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        tabId = tab.id;
        onYouTube = String(tab.url || '').startsWith('https://www.youtube.com/');
      }
      await loadTabState();
    }

    $('about-line').textContent = 'Classic Controls · by Griffith Software · ' + version + ' · © 2026 Griffith Software · Apache 2.0 with Commons Clause · ';
    const link = document.createElement('a');
    link.href = 'https://griffith.software';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'https://griffith.software';
    $('about-line').appendChild(link);

    build();
    render();

    $('export').addEventListener('click', exportSettings);
    $('import').addEventListener('click', () => {
      // A file picker closes the small popup, so importing happens on the settings page.
      if (isPage) $('import-file').click();
      else chrome.runtime.openOptionsPage();
    });
    $('import-file').addEventListener('change', (e) => {
      importFile(e.target.files[0]);
      e.target.value = '';
    });

    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'sync' && changes[S.KEY]) {
        settings = S.normalize(changes[S.KEY].newValue);
        render();
      }
      if (area === 'session' && tabId != null && changes[S.PREFIX + 'tab.' + tabId]) {
        tabState = changes[S.PREFIX + 'tab.' + tabId].newValue || null;
        render();
      }
    });
  }

  init();
})();
