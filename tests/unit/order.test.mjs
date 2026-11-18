// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software
import { test } from 'node:test';
import assert from 'node:assert/strict';
import order from '../../src/lib/order.js';

const { computeOrder, isNewestFirst, END } = order;
const v = (age, upcoming = false) => ({ kind: 'video', age, upcoming });

function display(items) {
  const orders = computeOrder(items);
  return items.map((it, i) => ({ it, o: orders[i], i })).sort((a, b) => a.o - b.o || a.i - b.i).map((x) => x.it);
}

test('videos sort newest first', () => {
  const items = [v(300), v(10), v(86400), v(60)];
  assert.deepEqual(display(items).map((x) => x.age), [10, 60, 300, 86400]);
});

test('ties keep page order', () => {
  const a = v(60);
  const b = v(60);
  assert.deepEqual(display([a, b]), [a, b]);
});

test('unknown ages after known, upcoming last', () => {
  const up = v(null, true);
  const unknown = v(null);
  const items = [up, unknown, v(5)];
  assert.deepEqual(display(items), [items[2], unknown, up]);
});

test('ads and headers stay right after the video they followed', () => {
  const ad = { kind: 'other' };
  const items = [ad, v(500), v(5), { kind: 'other', tag: 'x' }];
  const out = display(items);
  assert.equal(out[0], ad);
  assert.equal(out.indexOf(items[3]), out.indexOf(items[2]) + 1);
});

test('shelves go after the sorted videos and the spinner stays last', () => {
  const shelf = { kind: 'shelf' };
  const end = { kind: 'end' };
  const items = [v(100), shelf, v(1), end, v(50)];
  const orders = computeOrder(items);
  assert.equal(orders[3], END);
  assert.equal(orders[1], END - 1);
  assert.deepEqual(display(items).map((x) => x.kind), ['video', 'video', 'video', 'shelf', 'end']);
});

test('isNewestFirst', () => {
  assert.equal(isNewestFirst([1, 2, null, 3]), true);
  assert.equal(isNewestFirst([5, 2]), false);
  assert.equal(isNewestFirst([]), true);
});
