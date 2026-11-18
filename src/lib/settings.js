// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Settings shape, defaults, and settings export and import.
(function (root) {
  'use strict';

  const PREFIX = 'software.griffith.classiccontrols.';
  const KEY = PREFIX + 'settings';
  const GENERATOR = 'Classic Controls by Griffith Software';
  const SCHEMA_VERSION = 1;
  const FIX_IDS = ['hoverButtons', 'newestFirst', 'subsList'];

  const DEFAULTS = Object.freeze({
    fixes: Object.freeze({ hoverButtons: true, newestFirst: true, subsList: true }),
    hideShorts: false,
    newestFirstDefault: false
  });

  function bool(v, fallback) {
    return typeof v === 'boolean' ? v : fallback;
  }

  // Fills in defaults and drops anything unknown or of the wrong type.
  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fixesSrc = src.fixes && typeof src.fixes === 'object' ? src.fixes : {};
    const fixes = {};
    for (const id of FIX_IDS) fixes[id] = bool(fixesSrc[id], DEFAULTS.fixes[id]);
    return {
      fixes,
      hideShorts: bool(src.hideShorts, DEFAULTS.hideShorts),
      newestFirstDefault: bool(src.newestFirstDefault, DEFAULTS.newestFirstDefault)
    };
  }

  function buildExport(settings, appVersion, now) {
    return {
      generator: GENERATOR,
      appVersion: String(appVersion),
      schemaVersion: SCHEMA_VERSION,
      exportedAt: (now || new Date()).toISOString(),
      settings: normalize(settings)
    };
  }

  // Returns { ok: true, settings } or { ok: false, error } with a plain-language error.
  function parseImport(text) {
    let data;
    try {
      data = JSON.parse(String(text));
    } catch (_) {
      return { ok: false, error: "This file isn't a Classic Controls settings file." };
    }
    if (!data || typeof data !== 'object' || data.generator !== GENERATOR || !data.settings || typeof data.settings !== 'object') {
      return { ok: false, error: "This file isn't a Classic Controls settings file." };
    }
    if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
      return { ok: false, error: 'This file was made by a newer version of Classic Controls. Update the extension and try again.' };
    }
    return { ok: true, settings: normalize(data.settings) };
  }

  const api = { PREFIX, KEY, GENERATOR, SCHEMA_VERSION, FIX_IDS, DEFAULTS, normalize, buildExport, parseImport };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.ClassicControls = root.ClassicControls || {}).settings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
