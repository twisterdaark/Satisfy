'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');
const F = require('../harness/fixtures.cjs');

const { net: N } = loadModules('src/net/contracts.js');
const WORLD = { id: 'satisfy', tile: 16, w: 160, h: 144 };
const S = { ...F.LEGACY_V4.S, v: 5, cls: 'smith', title: 'smith' };
const P = { x: 2024.7, y: 1354.2, dir: 2, hp: 1, st: 1, mp: 1, food: 1 };

test('toPlayerPublic: only public fields, valid, rounded', () => {
  const pp = N.toPlayerPublic(S, P, { zone: 'zWin', uid: 'u1', sid: 's1', anim: 'walk' });
  assert.deepEqual(Object.keys(pp), N.PUBLIC_FIELDS);
  assert.deepEqual(N.validatePlayerPublic(pp, { world: WORLD }), { ok: true, errors: [] });
  assert.deepEqual([pp.x, pp.y, pp.dir, pp.anim, pp.handle, pp.cls], [2025, 1354, 2, 'walk', 'Grid', 'smith']);
  for (const k of N.PRIVATE_FIELDS) assert.equal(k in pp, false, k);
  assert.equal(pp.uid, 'u1', 'account uid from ctx, never the S.uid item counter');
  assert.equal(N.toPlayerPublic(S, P).uid, null);
});

test('toPlayerPublic: clamps hostile input', () => {
  const pp = N.toPlayerPublic({ ...S, look: { n: 'x'.repeat(200), hair: 1 }, title: 't'.repeat(99) }, { ...P, dir: 7 }, { anim: '<script>' });
  assert.equal(pp.handle.length, N.LIMITS.handle);
  assert.equal(pp.title.length, N.LIMITS.title);
  assert.equal(pp.dir, 3);
  assert.equal(pp.anim, 'idle');
});

test('validatePlayerPublic: rejects unknown fields, bad types and out-of-world positions', () => {
  const ok = N.toPlayerPublic(S, P, { zone: 'zWin' });
  const bad = (patch) => N.validatePlayerPublic({ ...ok, ...patch }, { world: WORLD }).errors;
  assert.ok(bad({ gold: 9 }).includes('unknown field gold'));
  assert.ok(bad({ x: -1 }).includes('out of world'));
  assert.ok(bad({ y: 144 * 16 }).includes('out of world'));
  assert.ok(bad({ x: 1.5 }).includes('position'));
  assert.ok(bad({ v: 2 }).includes('protocol version'));
  assert.ok(bad({ lv: 0 }).includes('lv'));
  assert.ok(bad({ look: { hair: 'a', hc: 0, skin: 0, top: 0 } }).includes('look.hair'));
  assert.equal(N.validatePlayerPublic(null).ok, false);
});

test('room keys round trip', () => {
  assert.equal(N.roomKey('satisfy', 'zWin', 0), 'satisfy/zWin/0');
  assert.equal(N.roomKey(null, 'zWin'), 'satisfy/zWin/0');
  assert.deepEqual(N.parseRoomKey('satisfy/zWin/3'), { key: 'satisfy/zWin/3', world: 'satisfy', zone: 'zWin', shard: 3 });
  assert.equal(N.parseRoomKey('satisfy/../x'), null);
});

test('network state machine', () => {
  assert.ok(N.canTransition('DISCONNECTED', 'AUTHENTICATING'));
  assert.ok(N.canTransition('ONLINE', 'RECONNECTING'));
  assert.ok(N.canTransition('RECONNECTING', 'SYNCING'));
  assert.equal(N.canTransition('DISCONNECTED', 'ONLINE'), false, 'cannot skip auth');
  assert.equal(N.canTransition('NOPE', 'ONLINE'), false);
  assert.equal(N.NET_STATES.length, 10);
});

test('envelope: versioned and size-limited', () => {
  const e = N.envelope('party.invite', { to: 'u2' }, { requestId: 'r1', seq: 4 });
  assert.deepEqual(e, { v: 1, type: 'party.invite', requestId: 'r1', sessionId: null, seq: 4, tick: 0, payload: { to: 'u2' } });
  assert.throws(() => N.envelope('chat', { text: 'x'.repeat(5000) }), /BAD_MESSAGE/);
});

test('zone policy: Bairan and Winston are safe, nothing allows PvP yet', () => {
  assert.deepEqual(N.zonePolicy('zWin'), { zone: 'zWin', safe: true, pvp: false, duel: false });
  assert.deepEqual(N.zonePolicy('zBai'), { zone: 'zBai', safe: true, pvp: false, duel: false });
  for (const z of ['zPlains', 'zGrave', 'zOrc', '']) {
    assert.equal(N.zonePolicy(z).safe, false, z);
    assert.equal(N.zonePolicy(z).pvp, false, z);
  }
});
