// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Builds the Chrome Web Store zip: release/v<version>/chrome/ClassicControls_v<version>_chrome.zip
// containing only the shipped files (no build step; files are zipped as they are).
import { createHash } from 'node:crypto';
import { deflateRawSync, crc32 } from 'node:zlib';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, listShipped } from './files.mjs';

const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  console.error(`manifest.json (${manifest.version}) and package.json (${pkg.version}) versions differ.`);
  process.exit(1);
}
const version = manifest.version;
const outDir = path.join(ROOT, 'release', `v${version}`, 'chrome');
const zipPath = path.join(outDir, `ClassicControls_v${version}_chrome.zip`);

// Minimal zip writer (stored or deflated with zlib), so packaging needs no extra tools.
const files = await listShipped();
const entries = [];
const chunks = [];
let offset = 0;
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 17;

for (const rel of files) {
  const data = await readFile(path.join(ROOT, rel));
  const deflated = deflateRawSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const name = Buffer.from(rel, 'utf8');
  const crc = crc32(data) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(useDeflate ? 8 : 0, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, name, body);
  entries.push({ name, crc, size: data.length, csize: body.length, method: useDeflate ? 8 : 0, offset });
  offset += local.length + name.length + body.length;
}
const central = [];
for (const e of entries) {
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(0x0800, 8);
  c.writeUInt16LE(e.method, 10);
  c.writeUInt16LE(DOS_TIME, 12);
  c.writeUInt16LE(DOS_DATE, 14);
  c.writeUInt32LE(e.crc, 16);
  c.writeUInt32LE(e.csize, 20);
  c.writeUInt32LE(e.size, 24);
  c.writeUInt16LE(e.name.length, 28);
  c.writeUInt32LE(e.offset, 42);
  central.push(c, e.name);
}
const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...chunks, centralBuf, end]);

await mkdir(outDir, { recursive: true });
await rm(zipPath, { force: true });
await writeFile(zipPath, zip);
const sha = createHash('sha256').update(zip).digest('hex');
await writeFile(zipPath + '.sha256', `${sha}  ${path.basename(zipPath)}\n`);
console.log(`${path.relative(ROOT, zipPath)}: ${files.length} files, ${zip.length} bytes, sha256 ${sha}`);
