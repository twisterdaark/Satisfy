'use strict';
// Load a classic-script module (src/**/*.js) the way a browser would: run it as a script
// against the global object, then hand back the `Satisfy` namespace it created.
// It runs in this realm (not a separate vm context) so objects compare with assert.deepEqual.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Run classic scripts against the global object and return the global they populate.
 * The global is removed again afterwards, so each call starts clean.
 * @param {string} name global to return, e.g. 'Satisfy' or 'SATISFY_DATA'
 * @param {string[]} files paths relative to the repo root, run in order
 */
function loadGlobal(name, files) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name);
  const prev = globalThis[name];
  delete globalThis[name];
  try {
    for (const f of files) {
      const file = path.join(ROOT, f);
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    }
    return globalThis[name];
  } finally {
    if (had) globalThis[name] = prev; else delete globalThis[name];
  }
}

/** @returns {object} the `Satisfy` namespace after running the given src/ files in order */
function loadModules(...files) { return loadGlobal('Satisfy', files); }

/** Minimal Storage implementation (localStorage API). */
class MemoryStorage {
  constructor(init) { this.m = new Map(Object.entries(init || {})); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

module.exports = { loadGlobal, loadModules, MemoryStorage, ROOT };
