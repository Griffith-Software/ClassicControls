// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Ownership marks, permissions and "no network" rules, checked against the shipped files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, listShipped } from '../../scripts/files.mjs';

const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');

test('manifest identity, permissions and marks', async () => {
  const m = JSON.parse(await read('manifest.json'));
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(m.manifest_version, 3);
  assert.equal(m.name, 'Classic Controls');
  assert.doesNotMatch(m.name, /youtube/i);
  assert.equal(m.version, pkg.version);
  assert.equal(m.author, 'Griffith Software');
  assert.equal(m.homepage_url, 'https://griffith.software/classic-controls.html');
  assert.deepEqual(m.permissions, ['storage']);
  assert.deepEqual(m.host_permissions, ['https://www.youtube.com/*']);
  assert.equal(m.web_accessible_resources, undefined);
  assert.equal(m.externally_connectable, undefined);
  assert.ok(m.description.length <= 132, 'store limit');
  for (const cs of m.content_scripts) assert.deepEqual(cs.matches, ['https://www.youtube.com/*']);
});

test('rules file carries the publisher mark', async () => {
  const rules = JSON.parse(await read('data/fixes.json'));
  assert.equal(rules.publisher, 'Griffith Software');
});

test('every shipped source file has the license and copyright header', async () => {
  const files = (await listShipped()).filter((f) => /\.(js|css|html)$/.test(f));
  assert.ok(files.length > 10);
  for (const f of files) {
    const text = await read(f);
    assert.match(text, /SPDX-License-Identifier: LicenseRef-Apache-2\.0-with-Commons-Clause/, f);
    assert.match(text, /Copyright \(c\) 2026 Griffith Software — https:\/\/griffith\.software/, f);
  }
});

test('no network calls or remote code in shipped files', async () => {
  const files = (await listShipped()).filter((f) => /\.(js|html)$/.test(f));
  for (const f of files) {
    const text = await read(f);
    assert.doesNotMatch(text, /XMLHttpRequest|WebSocket|sendBeacon|EventSource|\beval\(|new Function\(/, f);
    assert.doesNotMatch(text, /<script[^>]+src=["']https?:/i, f);
    // The only fetch is the extension's own rules file.
    for (const m of text.matchAll(/fetch\((.*)$/gm)) {
      assert.match(m[1], /^chrome\.runtime\.getURL\('data\/fixes\.json'\)\)/, f + ': ' + m[0]);
    }
  }
});

test('shipped code is plain, readable source (Chrome Web Store code readability policy)', async () => {
  const files = (await listShipped()).filter((f) => /\.(js|css|html|json)$/.test(f));
  const banned = [
    [/\beval\s*\(/, 'eval'],
    [/\bnew\s+Function\b/, 'new Function'],
    [/set(Timeout|Interval)\s*\(\s*['"`]/, 'timer with a code string'],
    [/document\.write/, 'document.write'],
    [/\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/, 'HTML built from strings'],
    [/javascript:/i, 'javascript: URL'],
    [/ActiveXObject|activeXDocument/, 'bundled legacy polyfill'],
    [/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/i, 'escaped characters'],
    [/sourceMappingURL|__webpack|__vite|parcelRequire/, 'bundler output']
  ];
  for (const f of files) {
    const text = await read(f);
    const lines = text.split(/\r?\n/);
    const longest = Math.max(...lines.map((l) => l.length));
    assert.ok(longest <= 250, `${f}: a line is ${longest} characters long, which reads as minified`);
    if (!f.endsWith('.json')) {
      for (const [re, what] of banned) assert.doesNotMatch(text, re, `${f}: ${what}`);
    }
  }
});

test('About line, export marker and storage prefix', async () => {
  const popup = await read('src/popup/popup.js');
  assert.match(popup, /'Classic Controls · by Griffith Software · ' \+ version \+ ' · © 2026 Griffith Software · Apache 2\.0 with Commons Clause · '/);
  assert.match(popup, /https:\/\/griffith\.software/);
  const settings = await read('src/lib/settings.js');
  assert.match(settings, /'software\.griffith\.classiccontrols\.'/);
  assert.match(settings, /'Classic Controls by Griffith Software'/);
});

test('license files', async () => {
  const license = await read('LICENSE');
  assert.match(license, /"Commons Clause" License Condition v1\.0/);
  assert.match(license, /Software: Classic Controls/);
  assert.match(license, /Apache License\s+Version 2\.0/);
  const notice = await read('NOTICE');
  assert.match(notice, /commercial license/);
  assert.match(notice, /not made by, endorsed by, or affiliated with YouTube or Google/);
});
