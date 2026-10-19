'use strict';
// SAT-ONLINE-005 (doc §05 R0.4): every S key has one class; profiles hold durable data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadModules, ROOT } = require('../harness/load-module.cjs');

const { state: ST, storage: STO } = loadModules('src/core/storage.js', 'src/core/state.js');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('every S key the game uses is classified (add new keys to src/core/state.js)', () => {
  const used = new Set([...html.matchAll(/\bS\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  const fresh = /function freshState\(\)\{\s*S=\{(.*?)\};/s.exec(html);
  assert.ok(fresh, 'freshState() found');
  // top-level keys of the freshState() literal (skip nested objects like st:{str:..})
  let depth = 0, tok = '';
  for (const ch of fresh[1] + ',') {
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { const k = /^\s*([A-Za-z_]\w*):/.exec(tok); if (k) used.add(k[1]); tok = ''; } else tok += ch;
  }
  const missing = [...used].filter((k) => !ST.known(k)).sort();
  assert.deepEqual(missing, [], 'unclassified S keys: ' + missing.join(', '));
});

test('doc §05: progress is durable, timers and the raid flag are session, ids are meta', () => {
  for (const k of ['lv', 'xp', 'gold', 'items', 'mats', 'qs', 'sk', 'tl', 'eqW', 'eqA']) assert.equal(ST.classOf(k), 'durable', k);
  for (const k of ['raid', 'immT', 'swT', 'unstT', 'bqT', 'zone']) assert.equal(ST.classOf(k), 'session', k);
  for (const k of ['v', 'wv', 'uid', 'pid']) assert.equal(ST.classOf(k), 'meta', k);
  for (const k of ['aff', 'rep', 'eq', 'guild', 'life']) assert.equal(ST.classOf(k), 'durable', k);
  assert.equal(ST.classOf('giftT'), 'session');
  assert.equal(ST.classOf('somethingNew'), 'durable', 'unknown keys are kept, never dropped');
  assert.ok(ST.UI_EPHEMERAL.includes('allies'), 'allies are UI/cutscene state, never saved');
});

test('P_SAVED is exactly what the save keeps of P', () => {
  const raw = STO.encode({ v: 5 }, { x: 1, y: 2, hp: 3, st: 4, mp: 5, food: 6, dir: 1, cd: { a: 1 }, slash: {} }, 0);
  assert.deepEqual(Object.keys(JSON.parse(raw).P).sort(), [...ST.P_SAVED].sort());
});

test('split/profileOf: durable copies only, session and P never in a profile', () => {
  const S = { v: 5, wv: 2, uid: 3, pid: 'p_abcdefghijklmnopqrst', lv: 7, gold: 50, items: [{ uid: 1 }], raid: 1, immT: 3, __demo: true, brandNew: { a: 1 } };
  const s = ST.split(S);
  assert.deepEqual(Object.keys(s.durable).sort(), ['brandNew', 'gold', 'items', 'lv']);
  assert.deepEqual(Object.keys(s.session).sort(), ['immT', 'raid']);
  assert.deepEqual(Object.keys(s.meta).sort(), ['pid', 'uid', 'v', 'wv']);
  assert.deepEqual(s.unknown, ['brandNew']);
  s.durable.items[0].uid = 99;
  assert.equal(S.items[0].uid, 1, 'deep copies');
  const p = ST.profileOf(S);
  assert.deepEqual(p, { pid: S.pid, schema: 5, durable: { lv: 7, gold: 50, items: [{ uid: 1 }], brandNew: { a: 1 } } });
  assert.equal(JSON.stringify(p).includes('raid'), false);
});

test('lists are disjoint and frozen', () => {
  const all = [...ST.DURABLE, ...ST.SESSION, ...ST.META, ...ST.TRANSIENT];
  assert.equal(new Set(all).size, all.length);
  for (const k of ['DURABLE', 'SESSION', 'META', 'P_SAVED', 'UI_EPHEMERAL']) assert.ok(Object.isFrozen(ST[k]), k);
});
