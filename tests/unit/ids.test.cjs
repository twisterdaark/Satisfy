'use strict';
// SAT-ONLINE-005 (doc §05 R0.5): character ids, stable item ids derived from the legacy uid, request ids.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { ids: I } = loadModules('src/core/ids.js');

test('uuid: RFC 4122 v4, unique', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const u = I.uuid(); assert.ok(I.isUuid(u), u); seen.add(u); }
  assert.equal(seen.size, 500);
});

test('character ids: p_ + 20 base32 chars, safe as a database key; guild-style pids are valid too', () => {
  const c = I.charId();
  assert.match(c, /^p_[a-z2-7]{20}$/);
  assert.ok(I.isCharId('pmgx3k2a9b1c'), "Claude-B's pidOf() format ('p' + base36 time + base36 random)");
  assert.equal(I.isCharId('P.bad/id'), false);
  for (const v of [undefined, null, 12345]) assert.equal(I.isCharId(v), false, String(v));
  assert.ok(I.isCharId(c));
  assert.doesNotMatch(c, /[.#$[\]/]/);
  assert.notEqual(I.charId(), c);
});

test('item ids are derived from (pid, legacy uid) and map back', () => {
  const pid = 'p_abcdefghijklmnopqrst';
  assert.equal(I.itemId(pid, 7), 'it_p_abcdefghijklmnopqrst_7');
  assert.equal(I.legacyUid('it_p_abcdefghijklmnopqrst_7'), 7);
  assert.equal(I.itemId('pmgx3k2a9b1c', 12), 'it_pmgx3k2a9b1c_12');
  assert.equal(I.legacyUid('nope'), null);
  assert.throws(() => I.itemId('bad', 1), /character id/);
  assert.throws(() => I.itemId(pid, 0), /uid/);
  assert.throws(() => I.itemId(pid, 1.5), /uid/);
});

test('ensure: assigns once, is idempotent, and fixes an iid copied from another item', () => {
  const S = { items: [{ uid: 1, id: 'rusty' }, { uid: 4, id: 'isword' }], uid: 4 };
  const got = I.ensure(S);
  assert.deepEqual(got, { pid: true, items: 2 });
  assert.ok(I.isCharId(S.pid));
  assert.deepEqual(S.items.map((i) => i.iid), [I.itemId(S.pid, 1), I.itemId(S.pid, 4)]);
  const before = JSON.stringify(S);
  assert.deepEqual(I.ensure(S), { pid: false, items: 0 });
  assert.equal(JSON.stringify(S), before, 'second call changes nothing');
  S.items[1].iid = S.items[0].iid;
  assert.deepEqual(I.ensure(S), { pid: false, items: 1 });
  assert.equal(S.items[1].iid, I.itemId(S.pid, 4));
  assert.deepEqual(I.ensure(null), { pid: false, items: 0 });
  assert.deepEqual(I.ensure({ pid: S.pid }), { pid: false, items: 0 }, 'no items array is fine');
});

test('ensure keeps an existing pid, including one a guild join already made', () => {
  for (const pid of ['p_zzzzzzzzzzzzzzzzzzzz', 'pmgx3k2a9b1c']) {
    const S = { pid, items: [{ uid: 2 }] };
    I.ensure(S);
    assert.equal(S.pid, pid);
    assert.equal(S.items[0].iid, 'it_' + pid + '_2');
  }
});

test('entity ids (plan U311): one scheme for monsters, NPCs and players, and back', () => {
  assert.equal(I.entity('m', 'golem@1592,840'), 'm:golem@1592,840');
  assert.equal(I.entity('m', 'redk@14008,392~2'), 'm:redk@14008,392~2');
  assert.equal(I.entity('m', 'snowr@120,-56'), 'm:snowr@120,-56', 'the north has negative rows');
  assert.equal(I.entity('n', 'khan'), 'n:khan');
  assert.equal(I.entity('p', 'u_3Fq9-zz'), 'p:u_3Fq9-zz');
  assert.deepEqual(I.parseEntity('m:forc@wb0'), { kind: 'm', key: 'forc@wb0' });
  assert.deepEqual(I.parseEntity('p:me'), { kind: 'p', key: 'me' });
  for (const bad of ['x:khan', 'm:', 'n:has space', 'p:a/b', 12, null]) assert.equal(I.parseEntity(bad), null, String(bad));
  assert.throws(() => I.entity('q', 'khan'));
  assert.throws(() => I.entity('n', 'bad/key'));
});
