// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software
import { test } from 'node:test';
import assert from 'node:assert/strict';
import state from '../../src/lib/state.js';
import settings from '../../src/lib/settings.js';

const { reduce, anyChanged } = state;

test('one miss is not enough to warn; two in a row are', () => {
  let r = reduce(undefined, 0, 'miss');
  assert.deepEqual(r, { state: 'checking', misses: 1 });
  r = reduce(r.state, r.misses, 'miss');
  assert.deepEqual(r, { state: 'changed', misses: 2 });
});

test('a working load resets the count and clears the warning', () => {
  const r = reduce('changed', 5, 'ok');
  assert.deepEqual(r, { state: 'working', misses: 0 });
  const again = reduce(r.state, r.misses, 'miss');
  assert.equal(again.state, 'checking');
});

test('pages with no videos never warn and do not reset the count', () => {
  assert.deepEqual(reduce('checking', 1, 'novideo'), { state: 'na', misses: 1 });
  assert.deepEqual(reduce('working', 0, 'na'), { state: 'na', misses: 0 });
  assert.deepEqual(reduce('changed', 2, 'off'), { state: 'off', misses: 2 });
});

test('a warning stays until the fix works again', () => {
  assert.equal(reduce('changed', 0, 'miss').state, 'changed');
});

test('toolbar mark only for changed pages', () => {
  assert.equal(anyChanged({ a: 'working', b: 'changed' }), true);
  assert.equal(anyChanged({ a: 'working', b: 'off' }), false);
  assert.equal(anyChanged(null), false);
});

test('settings defaults and cleanup', () => {
  const s = settings.normalize({ fixes: { hoverButtons: false, bogus: true }, hideShorts: 'yes', extra: 1 });
  assert.deepEqual(s, { fixes: { hoverButtons: false, newestFirst: true, subsList: true }, hideShorts: false, newestFirstDefault: false });
  assert.equal(settings.KEY, 'software.griffith.classiccontrols.settings');
});

test('export then import restores everything', () => {
  const mine = { fixes: { hoverButtons: false, newestFirst: true, subsList: false }, hideShorts: true, newestFirstDefault: true };
  const file = settings.buildExport(mine, '1.0.0', new Date('2026-11-17T00:00:00Z'));
  assert.equal(file.generator, 'Classic Controls by Griffith Software');
  assert.equal(file.appVersion, '1.0.0');
  assert.equal(file.schemaVersion, 1);
  const back = settings.parseImport(JSON.stringify(file));
  assert.deepEqual(back, { ok: true, settings: mine });
});

test('import refuses other files with a plain message', () => {
  assert.equal(settings.parseImport('not json').ok, false);
  assert.equal(settings.parseImport('{"settings":{}}').ok, false);
  const newer = settings.parseImport(JSON.stringify({ generator: settings.GENERATOR, schemaVersion: 99, settings: {} }));
  assert.equal(newer.ok, false);
  assert.match(newer.error, /newer version/);
});
