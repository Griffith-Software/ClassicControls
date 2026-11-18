// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Opens, comments on and closes youtube-change issues from a scheduled-test results file,
// using the GitHub CLI (gh). In GitHub Actions gh uses the workflow's token; on the owner's
// PC it uses the owner's gh sign-in.
//
//   node tests/canary/issues.mjs --results canary-results/results.json [--repo owner/name] [--dry-run]
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decide, LABEL } from './issue-logic.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DRY = args.includes('--dry-run');
const REPO = opt('--repo', process.env.GITHUB_REPOSITORY || 'Griffith-Software/ClassicControls');
const resultsFile = opt('--results', 'canary-results/results.json');

let results;
try {
  results = JSON.parse(await readFile(resultsFile, 'utf8'));
} catch (err) {
  console.error(`No results file at ${resultsFile}; the scheduled test did not finish.`);
  process.exit(1);
}

// One entry per fix: failed if any check failed, passed if all checked ones passed.
const byFix = new Map();
for (const c of results.checks) {
  const f = byFix.get(c.fixId) || { fixId: c.fixId, fixName: c.fixName, ok: null, failures: [] };
  if (c.ok === false) {
    f.ok = false;
    f.failures.push({ name: c.name, detail: c.detail, html: c.html });
  } else if (c.ok === true && f.ok !== false) {
    f.ok = true;
  }
  byFix.set(c.fixId, f);
}
const fixes = [...byFix.values()];

function gh(ghArgs, input) {
  return execFileSync('gh', [...ghArgs, '--repo', REPO], { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] });
}

let issues = [];
if (!DRY) {
  gh(['label', 'create', LABEL, '--color', 'B45309', '--description', 'A YouTube change stopped one of the fixes', '--force']);
  issues = JSON.parse(gh(['issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '100', '--json', 'number,title,body,comments']));
} else if (args.includes('--issues')) {
  issues = JSON.parse(await readFile(opt('--issues'), 'utf8'));
}

const run = { mode: results.mode, date: results.date, chromeVersion: results.chromeVersion, extensionVersion: results.extensionVersion, runUrl: results.runUrl };
const actions = decide(fixes, run, issues);
if (!actions.length) console.log('No issue changes.');

const tmp = await mkdtemp(path.join(os.tmpdir(), 'cc-issues-'));
for (const [i, a] of actions.entries()) {
  console.log(`${a.type} ${a.number ? '#' + a.number : ''} ${a.title || ''} (${a.fixId})`);
  if (DRY) {
    console.log(a.body + '\n');
    continue;
  }
  const bodyFile = path.join(tmp, `body-${i}.md`);
  await writeFile(bodyFile, a.body);
  if (a.type === 'create') gh(['issue', 'create', '--title', a.title, '--label', a.labels.join(','), '--body-file', bodyFile]);
  if (a.type === 'comment') gh(['issue', 'comment', String(a.number), '--body-file', bodyFile]);
  if (a.type === 'close') {
    gh(['issue', 'comment', String(a.number), '--body-file', bodyFile]);
    gh(['issue', 'close', String(a.number), '--reason', 'completed']);
  }
}
