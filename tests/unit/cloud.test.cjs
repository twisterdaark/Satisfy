'use strict';
// SAT-ONLINE-007 (doc §06 R1, §23, D4): public profile and consented cloud saves, against an in-memory SDK.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { cloud: CL, ids: I } = loadModules('src/core/ids.js', 'src/net/cloud.js');
const SV = { '.sv': 'timestamp' };

function memSdk() {
  const data = new Map(), log = [];
  const val = (p) => {
    if (data.has(p)) return JSON.parse(JSON.stringify(data.get(p)));
    const kids = {};
    for (const [k, v] of data) if (k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')) kids[k.slice(p.length + 1)] = v;
    return Object.keys(kids).length ? JSON.parse(JSON.stringify(kids)) : null;
  };
  const database = {
    ref: (db, path) => ({ path }),
    serverTimestamp: () => SV,
    set: (r, v) => { log.push(['set', r.path]); data.set(r.path, JSON.parse(JSON.stringify(v))); return Promise.resolve(); },
    remove: (r) => { log.push(['remove', r.path]); data.delete(r.path); return Promise.resolve(); },
    get: (r) => { log.push(['get', r.path]); return Promise.resolve({ val: () => val(r.path) }); },
  };
  return { sdk: { m: { database }, db: {} }, data, log };
}
const save = (pid, o = {}) => JSON.stringify({ S: { v: 5, pid, lv: o.lv || 7, cls: 'novice', look: { n: o.n || 'Grid' }, items: [] }, P: { x: 1, y: 2 }, savedAt: o.at || 1000 });

test('profileFrom: only the public fields of doc §23, clamped to what the rules accept', () => {
  const p = CL.profileFrom({ look: { n: 'x'.repeat(40), hair: 3, hc: 99, skin: -1, top: 2 }, title: 'smith', cls: 'gknight', lv: 5000, gold: 999, items: [1] }, 'ar', 7);
  assert.deepEqual(p, { handle: 'x'.repeat(24), look: { hair: 3, hc: 0, skin: 0, top: 2 }, language: 'ar', titleId: 'smith', classId: 'gknight', lv: 999, revision: 7 });
  assert.equal(CL.profileFrom({}, 'fr', 1).language, 'en');
});

test('indexFrom needs a character id and describes the save', () => {
  assert.throws(() => CL.indexFrom(JSON.stringify({ S: { v: 5 } }), 1), /character id/);
  const raw = save('p_abcdefghijklmnopqrst', { lv: 12, n: 'Faker', at: 55 });
  assert.deepEqual(CL.indexFrom(raw, 9), { pid: 'p_abcdefghijklmnopqrst', handle: 'Faker', lv: 12, cls: 'novice', schema: 5, savedAt: 55, rev: 9, size: raw.length });
});

test('upload writes the blob before the index; list is newest first; download returns the same string', async () => {
  const { sdk, data, log } = memSdk();
  let t = 100;
  const C = CL.create(sdk, { uid: 'u1', now: () => t });
  const a = save('p_aaaaaaaaaaaaaaaaaaaa', { n: 'A' }), b = save('pk2x9abc', { n: 'B' });
  await C.upload(a); t = 200; await C.upload(b);
  assert.deepEqual(log.filter((l) => l[0] === 'set').map((l) => l[1]), [
    'cloudSaves/u1/p_aaaaaaaaaaaaaaaaaaaa', 'cloudIndex/u1/p_aaaaaaaaaaaaaaaaaaaa', 'cloudSaves/u1/pk2x9abc', 'cloudIndex/u1/pk2x9abc']);
  assert.deepEqual(data.get('cloudSaves/u1/pk2x9abc'), { blob: b, rev: 200, t: SV });
  assert.deepEqual((await C.list()).map((c) => c.handle), ['B', 'A']);
  assert.equal(await C.download('pk2x9abc'), b);
  assert.equal(await C.download('p_nothinghereatall000'), null);
  await assert.rejects(C.download('../x'), /bad character id/);
});

test('upload refuses saves without an id, empty and oversized saves; remove clears index then blob', async () => {
  const { sdk, data, log } = memSdk();
  const C = CL.create(sdk, { uid: 'u1' });
  await assert.rejects(C.upload(''), /nothing/);
  await assert.rejects(C.upload(JSON.stringify({ S: { v: 5 } })), /character id/);
  await assert.rejects(C.upload('x'.repeat(CL.MAX_BLOB + 1)), /too large/);
  assert.equal(data.size, 0, 'nothing written');
  const pid = I.charId();
  await C.upload(save(pid));
  await C.remove(pid);
  assert.deepEqual(log.filter((l) => l[0] === 'remove').map((l) => l[1]), ['cloudIndex/u1/' + pid, 'cloudSaves/u1/' + pid]);
  assert.equal(data.size, 0);
});

test('profile revisions only go up, even when another device wrote a higher one', async () => {
  const { sdk, data } = memSdk();
  data.set('profiles/u1', { revision: 5000 });
  let t = 100; // this device's clock is behind
  const C = CL.create(sdk, { uid: 'u1', now: () => t });
  await C.writeProfile({ look: { n: 'Grid' }, lv: 3 }, 'en');
  const r1 = data.get('profiles/u1').revision;
  assert.ok(r1 > 5000, 'above the stored revision');
  await C.writeProfile({ look: { n: 'Grid' }, lv: 4 }, 'en');
  assert.ok(data.get('profiles/u1').revision > r1);
  assert.deepEqual(data.get('profiles/u1').t, SV);
});

test('eraseAll (T35): every online record of the account, index before save, nothing of anyone else', async () => {
  const { sdk, data, log } = memSdk();
  const C = CL.create(sdk, { uid: 'u1', now: () => 5000 });
  await C.writeProfile({ look: { n: 'Grid' }, lv: 3 }, 'en');
  await C.upload(save('p_aaaaaaaaaaaaaaaaaaaa'));
  await C.upload(save('p_bbbbbbbbbbbbbbbbbbbb', { n: 'Faker' }));
  data.set('cloudSaves/u1/p_orphanorphanorphan1', { blob: '{}', rev: 1, t: 1 }); // a save whose index write never happened
  data.set('inbox/u1/-m1', { type: 'party.invite' });
  data.set('sessions/u1', { sid: 'sess-1234', t: 1 });
  data.set('presence/satisfy/main/u1', { x: 1 });
  for (const p of ['profiles/u2', 'cloudSaves/u2/p_cccccccccccccccccccc', 'presence/satisfy/main/u2', 'inbox/u2/-m9']) data.set(p, { other: 1 });
  log.length = 0;
  const n = await C.eraseAll(['presence/satisfy/main/u1', 'presence/satisfy/main/u2', 'profiles/u2']);
  assert.equal(n, 10, '... and the account record (SAT-ONLINE-029)');
  assert.deepEqual([...data.keys()].filter((k) => k.includes('u1')), [], 'nothing of u1 left');
  assert.equal([...data.keys()].filter((k) => k.includes('u2')).length, 4, "another account's data and paths passed in by mistake are untouched");
  const removed = log.filter((l) => l[0] === 'remove').map((l) => l[1]);
  assert.ok(removed.indexOf('cloudIndex/u1/p_aaaaaaaaaaaaaaaaaaaa') < removed.indexOf('cloudSaves/u1/p_aaaaaaaaaaaaaaaaaaaa'));
  assert.deepEqual(removed.slice(-3), ['sessions/u1', 'profiles/u1', 'accounts/u1']);
  // a new profile can be written afterwards (the revision is read again)
  await C.writeProfile({ look: { n: 'Grid' }, lv: 3 }, 'en');
  assert.ok(data.has('profiles/u1'));
});

// SAT-ONLINE-027 (owner feedback #16)
test('profileFrom: a hidden level is written as 0', () => {
  assert.equal(CL.profileFrom({ look: { n: 'Grid' }, lv: 40 }, 'en', 1, true).lv, 0);
  assert.equal(CL.profileFrom({ look: { n: 'Grid' }, lv: 40 }, 'en', 1).lv, 40);
});

// SAT-ONLINE-028/029: the player-list entry, our world lines and our name go too
test('eraseAll also takes the online entry, our world lines and our name', async () => {
  const { sdk, data } = memSdk();
  const C = CL.create(sdk, { uid: 'u1', now: () => 5000 });
  for (const p of ['online/main/u1', 'world/main/-w1', 'handles/grid', 'accounts/u1', 'online/main/u2']) data.set(p, { x: 1 });
  await C.eraseAll(['online/main/u1', 'world/main/-w1', 'handles/grid', 'online/main/u2', 'handles/../x']);
  assert.deepEqual([...data.keys()].sort(), ['online/main/u2'], 'only what is ours (the rules refuse the rest anyway)');
});
