// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sp from '../../src/lib/sp.js';

const { getUploadDate, setUploadDate, UPLOAD } = sp;

test('reads the upload-date codes YouTube uses (single and double encoded)', () => {
  assert.equal(getUploadDate('EgIIAQ=='), UPLOAD.hour);
  assert.equal(getUploadDate('EgIIAQ%3D%3D'), UPLOAD.hour);
  assert.equal(getUploadDate('EgIIAg%253D%253D'), UPLOAD.today);
  assert.equal(getUploadDate('EgIIAw%3D%3D'), UPLOAD.week);
  assert.equal(getUploadDate('EgIIBA%3D%3D'), UPLOAD.month);
  assert.equal(getUploadDate('EgIIBQ%3D%3D'), UPLOAD.year);
  assert.equal(getUploadDate(''), null);
  assert.equal(getUploadDate('CAM%3D'), null);
  assert.equal(getUploadDate('EgIQAQ%3D%3D'), null);
});

test('sets Last Hour from nothing', () => {
  assert.equal(setUploadDate('', UPLOAD.hour), 'EgIIAQ==');
});

test('keeps other filters and the sort', () => {
  // Videos type filter (field 2.2 = 1) plus Popularity sort (field 1 = 3)
  const start = 'CAMSAhAB';
  const next = setUploadDate(start, UPLOAD.today);
  assert.equal(getUploadDate(next), UPLOAD.today);
  const fields = sp._decode(sp._fromBase64(next));
  assert.deepEqual(fields.find((f) => f.field === 1), { field: 1, wire: 0, value: 3 });
  const inner = sp._decode(fields.find((f) => f.field === 2).value);
  assert.ok(inner.some((f) => f.field === 2 && f.value === 1), 'type filter kept');
});

test('replaces an existing upload date and can remove it', () => {
  const week = setUploadDate('EgIIAQ%3D%3D', UPLOAD.week);
  assert.equal(getUploadDate(week), UPLOAD.week);
  assert.equal(setUploadDate('EgIIAQ%3D%3D', null), '');
  const typeOnly = setUploadDate(setUploadDate('EgIQAQ%3D%3D', UPLOAD.hour), null);
  assert.equal(typeOnly, 'EgIQAQ==');
});

test('unreadable values are reported, not guessed', () => {
  assert.equal(setUploadDate('%%%not-base64', UPLOAD.hour), null);
  assert.equal(getUploadDate('////'), null);
});
