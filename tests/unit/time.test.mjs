// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software
import { test } from 'node:test';
import assert from 'node:assert/strict';
import time from '../../src/lib/time.js';

const { parseAge, isUpcoming, ageFromTexts } = time;

test('short forms YouTube shows on cards', () => {
  assert.equal(parseAge('2d ago'), 2 * 86400);
  assert.equal(parseAge('11h ago'), 11 * 3600);
  assert.equal(parseAge('55 min ago'), 55 * 60);
  assert.equal(parseAge('2w ago'), 14 * 86400);
  assert.equal(parseAge('3mo ago'), 90 * 86400);
  assert.equal(parseAge('1y ago'), 365 * 86400);
  assert.equal(parseAge('30s ago'), 30);
});

test('long forms from aria-labels', () => {
  assert.equal(parseAge('1 day ago'), 86400);
  assert.equal(parseAge('3 weeks ago'), 21 * 86400);
  assert.equal(parseAge('5 months ago'), 150 * 86400);
  assert.equal(parseAge('2 years ago'), 2 * 365 * 86400);
  assert.equal(parseAge('an hour ago'), 3600);
});

test('streams and premieres', () => {
  assert.equal(parseAge('Streamed 4d ago'), 4 * 86400);
  assert.equal(parseAge('Streamed live 3 hours ago'), 3 * 3600);
  assert.equal(parseAge('Premiered 2 days ago'), 2 * 86400);
  assert.equal(parseAge('LIVE'), 0);
  assert.equal(parseAge('1.2K watching'), 0);
  assert.equal(isUpcoming('Premieres 11/20/26, 3:00 PM'), true);
  assert.equal(isUpcoming('Scheduled for 11/20/26'), true);
  assert.equal(isUpcoming('2d ago'), false);
});

test('text that is not an upload time', () => {
  for (const t of ['409K', '1.2M views', '', null, undefined, 'New', '4K', 'ago', '5 bananas ago']) {
    assert.equal(parseAge(t), null, String(t));
  }
});

test('first readable time wins, upcoming is noted', () => {
  assert.deepEqual(ageFromTexts(['409K views', '2d ago']), { age: 172800, upcoming: false });
  assert.deepEqual(ageFromTexts(['1 day ago', '1d ago']), { age: 86400, upcoming: false });
  assert.deepEqual(ageFromTexts(['Premieres tomorrow']), { age: null, upcoming: true });
  assert.deepEqual(ageFromTexts([]), { age: null, upcoming: false });
});
