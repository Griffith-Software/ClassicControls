// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Reads and writes the upload-date part of YouTube's search filter parameter (`sp`).
// `sp` is a small base64 protobuf: field 1 is the sort, field 2 is a message of filters
// whose field 1 is the upload date (1 last hour, 2 today, 3 this week, 4 this month, 5 this year).
// Every other field is kept exactly as it was, so other filters the user picked stay on.
(function (root) {
  'use strict';

  const UPLOAD = { hour: 1, today: 2, week: 3, month: 4, year: 5 };

  // Turns the `sp` text from the address bar into bytes. YouTube sometimes URL-encodes it
  // once or twice, and uses the URL-safe base64 letters, so both are undone first.
  function fromBase64(s) {
    let str = String(s || '');
    if (/%[0-9a-f]{2}/i.test(str)) {
      try { str = decodeURIComponent(str); } catch (_) { return null; }
      if (/%[0-9a-f]{2}/i.test(str)) {
        try { str = decodeURIComponent(str); } catch (_) { return null; }
      }
    }
    str = str.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    while (str.length % 4) str += '=';
    try {
      const bin = atob(str);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (_) {
      return null;
    }
  }

  // Turns bytes back into the base64 text YouTube expects in `sp`.
  function toBase64(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  // Protobuf numbers are stored 7 bits per byte, low bits first; the top bit (0x80) means
  // another byte follows. Returns [number, position after it].
  function readVarint(bytes, pos) {
    let value = 0;
    let mult = 1;
    for (let i = 0; i < 10; i++) {
      if (pos >= bytes.length) throw new Error('truncated');
      const b = bytes[pos++];
      value += (b & 0x7f) * mult;
      if (!(b & 0x80)) return [value, pos];
      mult *= 128;
    }
    throw new Error('varint too long');
  }

  // The reverse of readVarint: appends the number to `out` 7 bits at a time.
  function writeVarint(n, out) {
    let v = Math.floor(n);
    do {
      let b = v % 128;
      v = Math.floor(v / 128);
      if (v > 0) b |= 0x80;
      out.push(b);
    } while (v > 0);
  }

  // Returns [{ field, wire, value }] where value is a number (wire 0) or Uint8Array (other wires).
  function decode(bytes) {
    const fields = [];
    let pos = 0;
    while (pos < bytes.length) {
      let key;
      [key, pos] = readVarint(bytes, pos);
      const field = Math.floor(key / 8);
      const wire = key % 8;
      if (wire === 0) {
        let v;
        [v, pos] = readVarint(bytes, pos);
        fields.push({ field, wire, value: v });
      } else if (wire === 2) {
        let len;
        [len, pos] = readVarint(bytes, pos);
        if (pos + len > bytes.length) throw new Error('truncated');
        fields.push({ field, wire, value: bytes.slice(pos, pos + len) });
        pos += len;
      } else if (wire === 1 || wire === 5) {
        const len = wire === 1 ? 8 : 4;
        if (pos + len > bytes.length) throw new Error('truncated');
        fields.push({ field, wire, value: bytes.slice(pos, pos + len) });
        pos += len;
      } else {
        throw new Error('unsupported wire type');
      }
    }
    return fields;
  }

  // The reverse of decode: turns [{ field, wire, value }] back into bytes.
  function encode(fields) {
    const out = [];
    for (const f of fields) {
      writeVarint(f.field * 8 + f.wire, out);
      if (f.wire === 0) writeVarint(f.value, out);
      else if (f.wire === 2) {
        writeVarint(f.value.length, out);
        for (const b of f.value) out.push(b);
      } else {
        for (const b of f.value) out.push(b);
      }
    }
    return Uint8Array.from(out);
  }

  function parse(sp) {
    if (!sp) return [];
    const bytes = fromBase64(sp);
    if (!bytes) return null;
    try { return decode(bytes); } catch (_) { return null; }
  }

  // The upload-date filter in `sp` (1-5), or null when there is none.
  function getUploadDate(sp) {
    const top = parse(sp);
    if (!top) return null;
    const filters = top.find((f) => f.field === 2 && f.wire === 2);
    if (!filters) return null;
    let inner;
    try { inner = decode(filters.value); } catch (_) { return null; }
    const date = inner.find((f) => f.field === 1 && f.wire === 0);
    return date ? date.value : null;
  }

  // Returns a new `sp` with the upload-date filter set (1-5) or removed (null).
  // Returns '' when nothing is left, and null when `sp` couldn't be read.
  function setUploadDate(sp, value) {
    const top = parse(sp);
    if (!top) return null;
    let inner = [];
    const at = top.findIndex((f) => f.field === 2 && f.wire === 2);
    if (at >= 0) {
      try { inner = decode(top[at].value); } catch (_) { return null; }
    }
    inner = inner.filter((f) => !(f.field === 1 && f.wire === 0));
    if (value != null) inner.unshift({ field: 1, wire: 0, value });
    const next = top.filter((f) => !(f.field === 2 && f.wire === 2));
    if (inner.length) {
      const entry = { field: 2, wire: 2, value: encode(inner) };
      if (at >= 0) next.splice(Math.min(at, next.length), 0, entry);
      else next.push(entry);
    }
    return next.length ? toBase64(encode(next)) : '';
  }

  const api = { UPLOAD, getUploadDate, setUploadDate, _decode: decode, _encode: encode, _fromBase64: fromBase64 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.ClassicControls = root.ClassicControls || {}).sp = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
