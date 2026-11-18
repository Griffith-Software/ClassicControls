// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// The files that ship in the extension, and a helper that copies them into a folder.
// The store package and every test use this same list.
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHIPPED = ['manifest.json', 'LICENSE', 'NOTICE', 'data', 'icons', 'src'];

export async function listShipped() {
  const out = [];
  async function walk(rel) {
    const abs = path.join(ROOT, rel);
    const s = await stat(abs);
    if (s.isDirectory()) {
      for (const name of (await readdir(abs)).sort()) await walk(path.join(rel, name));
    } else {
      out.push(rel.split(path.sep).join('/'));
    }
  }
  for (const entry of SHIPPED) await walk(entry);
  return out;
}

export async function copyExtension(dest) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  for (const entry of SHIPPED) {
    await cp(path.join(ROOT, entry), path.join(dest, entry), { recursive: true });
  }
  return dest;
}
