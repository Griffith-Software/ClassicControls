// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Decides what the scheduled test does on GitHub after a run. Pure logic, no GitHub calls.
//
// - A fix fails and has no open youtube-change issue: open one titled
//   "<fix name> stopped working (YYYY-MM-DD)".
// - A fix fails and already has one: add a comment instead of opening a duplicate.
// - A fix passes and has one: after two passing runs in a row (for every run type that saw
//   it fail), comment "Working again" and close it. The first pass gets a short comment.
// - A run that couldn't check a fix (for example YouTube showed no videos) changes nothing.
//
// Each comment the test writes carries a hidden marker so later runs can count passes.

export const LABEL = 'youtube-change';
export const PASSES_TO_CLOSE = 2;

const MARK = /<!-- cc-canary:(pass|fail):([a-z-]+) -->/g;

export function marker(kind, mode) {
  return `<!-- cc-canary:${kind}:${mode} -->`;
}

export function titleFor(fixName, date) {
  return `${fixName} stopped working (${date})`;
}

export function findIssue(issues, fixName) {
  const prefix = `${fixName} stopped working`;
  return issues.find((i) => i.title.startsWith(prefix)) || null;
}

// Marks in the issue body and comments, oldest first.
function marks(issue) {
  const out = [];
  for (const text of [issue.body || '', ...(issue.comments || []).map((c) => c.body || '')]) {
    for (const m of text.matchAll(MARK)) out.push({ kind: m[1], mode: m[2] });
  }
  return out;
}

// Passing runs per run type since that type's last failure, plus which types have failed.
export function passCounts(issue) {
  const failed = new Set();
  const passes = {};
  for (const m of marks(issue)) {
    if (m.kind === 'fail') {
      failed.add(m.mode);
      passes[m.mode] = 0;
    } else if (failed.has(m.mode)) {
      passes[m.mode] = (passes[m.mode] || 0) + 1;
    }
  }
  return { failed, passes };
}

function failureText(fix, run) {
  const lines = [];
  lines.push(`**Failed checks (${run.mode} run):**`);
  for (const f of fix.failures) lines.push(`- ${f.name}: ${f.detail}`);
  lines.push('');
  lines.push(`**Chrome:** ${run.chromeVersion} · **Extension:** ${run.extensionVersion} · **Run:** ${run.runUrl || 'local scheduled run'}`);
  lines.push(`**Screenshot:** ${run.runUrl ? 'in the run\'s artifacts (link above)' : 'saved on the test PC in canary-results/'}`);
  const html = fix.failures.find((f) => f.html);
  if (html) {
    lines.push('');
    lines.push('<details><summary>HTML around the missing anchor</summary>');
    lines.push('');
    lines.push('```html');
    lines.push(html.html.replace(/```/g, '` ` `'));
    lines.push('```');
    lines.push('</details>');
  }
  return lines.join('\n');
}

// fixes: [{ fixId, fixName, ok: true | false | null, failures: [{ name, detail, html? }] }]
// run: { mode, date, chromeVersion, extensionVersion, runUrl }
// issues: open issues with the youtube-change label: [{ number, title, body, comments: [{ body }] }]
export function decide(fixes, run, issues) {
  const actions = [];
  for (const fix of fixes) {
    if (fix.ok == null) continue;
    const issue = findIssue(issues, fix.fixName);
    if (fix.ok === false) {
      const body = failureText(fix, run) + '\n\n' + marker('fail', run.mode);
      if (!issue) {
        actions.push({ type: 'create', fixId: fix.fixId, title: titleFor(fix.fixName, run.date), labels: [LABEL], body: `${fix.fixName} stopped working in the scheduled YouTube test.\n\n${body}` });
      } else {
        actions.push({ type: 'comment', fixId: fix.fixId, number: issue.number, body: `Still failing (${run.date}).\n\n${body}` });
      }
      continue;
    }
    if (!issue) continue;
    const { failed, passes } = passCounts(issue);
    if (!failed.has(run.mode)) continue;
    const after = { ...passes, [run.mode]: (passes[run.mode] || 0) + 1 };
    const done = [...failed].every((m) => (after[m] || 0) >= PASSES_TO_CLOSE);
    if (done) {
      actions.push({ type: 'close', fixId: fix.fixId, number: issue.number, body: `Working again: ${PASSES_TO_CLOSE} passing runs in a row (${run.date}, ${run.mode} run).\n\n${marker('pass', run.mode)}` });
    } else {
      actions.push({ type: 'comment', fixId: fix.fixId, number: issue.number, body: `Passing run ${after[run.mode]} of ${PASSES_TO_CLOSE} (${run.date}, ${run.mode} run).\n\n${marker('pass', run.mode)}` });
    }
  }
  return actions;
}
