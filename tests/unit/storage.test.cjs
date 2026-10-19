'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules, MemoryStorage } = require('../harness/load-module.cjs');
const F = require('../harness/fixtures.cjs');

const { storage: ST } = loadModules('src/core/storage.js');
const CTX = { PTS_LV: 10, spawn: { x: 2024, y: 1354 }, maxHP: () => 300 };
const clone = (o) => JSON.parse(JSON.stringify(o));

test('constants: schema 5 under the historical key', () => {
  assert.equal(ST.SCHEMA, 5);
  assert.equal(ST.KEY, 'satisfy_proto_v4');
  assert.equal(ST.BACKUP_PREFIX, 'satisfy_proto_v4.backup.');
  assert.ok(Object.isFrozen(ST));
});

test('decode: empty, corrupt, wrong shape, ok', () => {
  assert.equal(ST.decode(null).status, 'empty');
  assert.deepEqual(ST.decode(F.CORRUPT_RAW), { status: 'corrupt', raw: F.CORRUPT_RAW, error: 'parse' });
  for (const raw of ['null', '[]', '{}', '{"S":3}', '"x"']) assert.equal(ST.decode(raw).status, 'corrupt', raw);
  const d = ST.decode(JSON.stringify(F.LEGACY_V4));
  assert.equal(d.status, 'ok');
  assert.equal(d.schema, 4);
  assert.equal(ST.decode('{"S":{}}').schema, 4, 'missing S.v counts as 4 like the original load()');
});

test('encode: legacy {S,P} shape plus envelope fields, P trimmed to durable fields', () => {
  const S = { v: 5, lv: 3 };
  const P = { x: 1, y: 2, hp: 3, st: 4, mp: 5, food: 6, dir: 2, slash: { a: 1 }, trail: [1] };
  const o = JSON.parse(ST.encode(S, P, 1000));
  assert.deepEqual(o, { S, P: { x: 1, y: 2, hp: 3, st: 4, mp: 5, food: 6 }, fmt: 1, schema: 5, savedAt: 1000 });
});

test('encode/write: world state WS is saved next to S and P, as main does', () => {
  const WS = { v: 1, guilds: {}, terr: { tCanyon: { own: 'g_giant', sh: 0 } }, legends: {} };
  const o = JSON.parse(ST.encode({ v: 5 }, { x: 1, y: 2 }, 5, { WS }));
  assert.deepEqual(Object.keys(o), ['S', 'P', 'WS', 'fmt', 'schema', 'savedAt']);
  assert.deepEqual(o.WS, WS);
  assert.equal('WS' in JSON.parse(ST.encode({ v: 5 }, { x: 1 }, 5)), false, 'no WS, no key');
  const store = new MemoryStorage(), a = ST.create(store);
  assert.equal(a.write({ v: 5 }, { x: 1 }, { WS }), true);
  assert.deepEqual(a.read().data.WS, WS);
});

test('migrate: v4 → v5 matches the original inline migration exactly', () => {
  const S = clone(F.LEGACY_V4.S), P = clone(F.LEGACY_V4.P);
  assert.deepEqual(ST.migrate(S, P, CTX), [5]);
  assert.equal(S.v, 5);
  assert.deepEqual(S.st, { str: 10, sta: 10, agi: 10, int: 10, dex: 10 });
  assert.equal(S.pts, 50);
  assert.equal(S.zone, '');
  assert.deepEqual(S.vis, { zWin: 1 });
  assert.deepEqual([P.x, P.y, P.hp], [2024, 1354, 300]);
  assert.equal(S.gold, 345, 'progress untouched');
});

test('migrate: idempotent, keeps existing vis flags, no-op on v5 and newer', () => {
  const S = clone(F.LEGACY_V4.S), P = clone(F.LEGACY_V4.P);
  S.vis = { zGrey: 1, zWin: 0 };
  ST.migrate(S, P, CTX);
  assert.deepEqual(S.vis, { zWin: 0, zGrey: 1 }, 'saved flags win over the default, as with the original spread');
  const once = clone({ S, P });
  assert.deepEqual(ST.migrate(S, P, CTX), []);
  assert.deepEqual({ S, P }, once);
  const N = clone(F.NEWER_V6.S);
  assert.deepEqual(ST.migrate(N, {}, CTX), []);
  assert.equal(N.v, 6);
});

test('adapter: exists/read/write round trip', () => {
  const store = new MemoryStorage();
  const a = ST.create(store);
  assert.equal(a.exists(), false);
  assert.equal(a.read().status, 'empty');
  assert.equal(a.write({ v: 5, lv: 2 }, { x: 1, y: 2, hp: 3, st: 4, mp: 5, food: 6 }), true);
  assert.equal(a.exists(), true);
  const r = a.read();
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.data.S, { v: 5, lv: 2 });
  store.setItem(ST.KEY, '');
  assert.equal(a.exists(), false, 'empty string is "no save", like the original hasSave()');
});

test('adapter: backup keeps the first copy per reason and never touches the save', () => {
  const store = new MemoryStorage({ [ST.KEY]: 'live' });
  const a = ST.create(store);
  assert.equal(a.backup('corrupt', 'first'), true);
  assert.equal(a.backup('corrupt', 'second'), false);
  assert.equal(a.backup('from-v4', 'old'), true);
  assert.equal(a.backup('x', null), false);
  assert.deepEqual(a.backups(), { corrupt: 'first', 'from-v4': 'old' });
  assert.equal(store.getItem(ST.KEY), 'live');
});

test('adapter: storage failures are swallowed (private mode, quota, no localStorage)', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, get length() { throw new Error('denied'); } };
  for (const s of [broken, null]) {
    const a = ST.create(s);
    assert.equal(a.exists(), false);
    assert.equal(a.read().status, 'empty');
    assert.equal(a.write({ v: 5 }, { x: 0, y: 0 }), false);
    assert.equal(a.backup('corrupt', 'x'), false);
    assert.deepEqual(a.backups(), {});
  }
  const circular = { v: 5 }; circular.self = circular;
  assert.equal(ST.create(new MemoryStorage()).write(circular, {}), false, 'unserializable state does not throw');
});

test('slots: separate key and backups per slot, default untouched, bad names rejected', () => {
  const store = new MemoryStorage({ [ST.KEY]: 'main-save' });
  const a = ST.create(store, { slot: 'a' });
  assert.equal(a.key, 'satisfy_proto_v4@a');
  assert.equal(a.exists(), false);
  a.write({ v: 5, lv: 9 }, { x: 0, y: 0 });
  a.backup('corrupt', 'x');
  assert.equal(store.getItem(ST.KEY), 'main-save');
  assert.equal(store.getItem('satisfy_proto_v4@a.backup.corrupt'), 'x');
  assert.deepEqual(ST.create(store).backups(), {}, 'default slot does not list slot backups');
  assert.deepEqual(Object.keys(a.backups()), ['corrupt']);
  assert.equal(ST.create(store, { slot: '' }).key, ST.KEY);
  for (const bad of ['../x', 'a b', 'x'.repeat(17), 'é']) assert.throws(() => ST.slotKey(bad), /bad save slot/);
});

test('replace: keeps the current save as a backup first, refuses junk and a reused backup reason', () => {
  const store = new MemoryStorage(), a = ST.create(store);
  a.write({ v: 5, lv: 1 }, { x: 1 });
  const old = a.read().raw, next = JSON.stringify({ S: { v: 5, lv: 9 }, P: { x: 2 } });
  assert.equal(a.replace('{oops', 'r1'), false, 'not a save');
  assert.equal(a.replace(next, 'before-cloud-1'), true);
  assert.equal(a.read().data.S.lv, 9);
  assert.equal(a.backups()['before-cloud-1'], old);
  assert.equal(a.replace(JSON.stringify({ S: { v: 5, lv: 3 }, P: {} }), 'before-cloud-1'), false, 'a backup is never overwritten, so no replace');
  assert.equal(a.read().data.S.lv, 9);
  const empty = ST.create(new MemoryStorage());
  assert.equal(empty.replace(next, 'x'), true, 'nothing to back up on a fresh device');
});
