// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, marker } from '../canary/issue-logic.mjs';

const run = (mode = 'signed-out', date = '2026-11-17') => ({ mode, date, chromeVersion: '159', extensionVersion: '1.0.0', runUrl: 'https://github.com/x/y/actions/runs/1' });
const fail = { fixId: 'newestFirst', fixName: 'Newest First in Search', ok: false, failures: [{ name: 'results sorted', detail: 'toolbar missing', html: '<div>x</div>' }] };
const pass = { fixId: 'newestFirst', fixName: 'Newest First in Search', ok: true, failures: [] };

// Applies actions to a fake issue list, the way GitHub would.
function apply(issues, actions) {
  let next = 100 + issues.length;
  for (const a of actions) {
    if (a.type === 'create') issues.push({ number: next++, title: a.title, body: a.body, comments: [], open: true });
    const issue = issues.find((i) => i.number === a.number);
    if (a.type === 'comment' || a.type === 'close') issue.comments.push({ body: a.body });
    if (a.type === 'close') issue.open = false;
  }
  return issues.filter((i) => i.open);
}

test('a forced failure opens one issue with the details', () => {
  const actions = decide([fail], run(), []);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'create');
  assert.equal(actions[0].title, 'Newest First in Search stopped working (2026-11-17)');
  assert.deepEqual(actions[0].labels, ['youtube-change']);
  assert.match(actions[0].body, /toolbar missing/);
  assert.match(actions[0].body, /Chrome:\*\* 159/);
  assert.match(actions[0].body, /```html\n<div>x<\/div>/);
  assert.match(actions[0].body, /actions\/runs\/1/);
});

test('a second failure comments instead of opening a duplicate', () => {
  let open = apply([], decide([fail], run(), []));
  const actions = decide([fail], run('signed-out', '2026-11-18'), open);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'comment');
  assert.match(actions[0].body, /^Still failing \(2026-11-18\)/);
  open = apply(open, actions);
  assert.equal(open.length, 1);
});

test('closes after two passing runs in a row', () => {
  let open = apply([], decide([fail], run(), []));
  let actions = decide([pass], run(), open);
  assert.equal(actions[0].type, 'comment');
  assert.match(actions[0].body, /Passing run 1 of 2/);
  open = apply(open, actions);
  actions = decide([pass], run(), open);
  assert.equal(actions[0].type, 'close');
  assert.match(actions[0].body, /^Working again/);
  open = apply(open, actions);
  assert.equal(open.length, 0);
});

test('a failure between passes starts the count again', () => {
  let open = apply([], decide([fail], run(), []));
  open = apply(open, decide([pass], run(), open));
  open = apply(open, decide([fail], run(), open));
  const actions = decide([pass], run(), open);
  assert.equal(actions[0].type, 'comment');
  assert.match(actions[0].body, /Passing run 1 of 2/);
});

test('a signed-out pass does not close an issue the signed-in run opened', () => {
  let open = apply([], decide([fail], run('signed-in'), []));
  assert.deepEqual(decide([pass], run('signed-out'), open), []);
  open = apply(open, decide([pass], run('signed-in'), open));
  assert.equal(decide([pass], run('signed-in'), open)[0].type, 'close');
});

test('inconclusive runs and healthy fixes change nothing', () => {
  assert.deepEqual(decide([{ ...pass, ok: null }], run(), []), []);
  assert.deepEqual(decide([pass], run(), []), []);
});

test('human comments without markers are ignored', () => {
  const issue = { number: 5, title: 'Newest First in Search stopped working (2026-11-01)', body: 'x ' + marker('fail', 'signed-out'), comments: [{ body: marker('pass', 'signed-out') }, { body: 'I see this too' }] };
  assert.equal(decide([pass], run(), [issue])[0].type, 'close');
});
