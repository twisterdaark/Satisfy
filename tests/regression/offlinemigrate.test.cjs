'use strict';
// SAT-ONLINE-139 (plan U018, "offline-to-online migration: a compatibility map from S.v 4 and a fallback copy; items,
// quality and quests are not lost or duplicated", with a reconnect case), over the fake Firebase with the rules' checks.
// A save from an old build (schema 4) is opened offline: it is migrated to this build's schema and the old save is kept as
// a backup. Played offline, then signed in on the same device, it goes up whole: every item with its quality,
// enhancement and gem, the quests and the materials, no item twice. A second device that has its own offline character
// starts from the account's further one, but its own goes up first as a character of its own, so nothing of it is lost;
// signing in again there (a reconnect) changes nothing. One too large to go up stays where it is.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');
const F = require('../harness/fixtures.cjs');

test.after(() => H.closeBrowser());

const UID = 'gMigrate1';
async function until(g, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
// signed in with the account (its ID taken already): Play online goes on with the save on this device, or the account's
// (look: no save on the device and none in the account: a new character)
async function online(ctx, slot, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + slot });
  await g.eval((u) => {
    window.__toastLog = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true });
    window.__fakeRTDB.data.set('accountIds/' + u, 'Ahmed'); window.__fakeRTDB.nextName = 'Ahmed'; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click();
  }, UID);
  if (look) { await g.waitMode('create', 20000); await H.newGame(g, look); } else await g.waitMode('play', 20000);
  return g;
}
const toastLog = (g) => g.eval(() => window.__toastLog.join(' | '));
// what must come through: every item with its quality, enhancement, gem and passives; the quests; materials, gold, level
function keepOf(S) {
  return {
    pid: S.pid, n: S.look.n, lv: S.lv, xp: S.xp, gold: S.gold, mats: S.mats, qs: S.qs,
    items: S.items.map((i) => ({ uid: i.uid, id: i.id, r: i.r, en: i.en | 0, gem: i.gem || null, wp: i.wp || null })).sort((a, b) => a.uid - b.uid),
  };
}
const keep = (g) => g.eval(() => window.__G.S).then(keepOf);
const cloud = (g, pid) => g.eval(([u, p]) => { const v = window.__fakeRTDB.data.get('cloudSaves/' + u + '/' + p); return v ? JSON.parse(v.blob).S : null; }, [UID, pid]);
const index = (g) => g.eval((u) => [...new Set([...window.__fakeRTDB.data.keys()].filter((k) => k.startsWith('cloudIndex/' + u + '/')).map((k) => k.split('/')[2]))].sort(), UID);
const once = (S) => { const u = S.items.map((i) => i.uid), iid = S.items.map((i) => i.iid); return new Set(u).size === u.length && new Set(iid).size === iid.length; };

test('an old offline save goes online whole, and a device with its own offline character keeps it in the account', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    // device A, offline: a save from an old build (schema 4)
    const old = JSON.stringify(F.LEGACY_V4);
    const a = await H.openGame({ ctx, query: '?slot=a', storage: { 'satisfy_proto_v4@a': old } });
    await H.continueGame(a);
    assert.equal(await a.eval(() => window.__G.S.v), 5, 'migrated to this build');
    assert.equal((await a.eval(() => Satisfy.local.backups()))['from-v4'], old, 'the old save kept as it was');
    const fromOld = await keep(a);
    assert.deepEqual([fromOld.items.map((i) => [i.id, i.r]), fromOld.qs.kh1.st, fromOld.mats.leather, fromOld.gold], [[['rusty', 0]], 2, 5, 345], 'nothing of it lost');
    // played offline: better items of several qualities, one enhanced with a gem in it, a quest taken, materials
    const qid = await a.eval(() => Object.keys(window.__G.QD).find((k) => window.__GC2.avail(k)));
    await a.eval((q) => {
      const G = window.__G, S = G.S, mk = G.eqx.mkItem, w = mk('isword', 4); w.en = 6; w.gem = 'ruby';
      S.items.push(w, mk('parmor', 1), mk('ochelm', 0), mk('tbow', 3));
      S.qs[q] = { st: 1, n: 2 }; S.mats.ore = 40; S.gold = 12345; G.gainXP(3000); G.save(true);
    }, qid);
    const off = await keep(a);
    assert.equal(off.items.length, 5);
    await a.close();

    // the same device, signed in for the first time: the account has nothing; the save goes up as it is
    const a2 = await online(ctx, 'a');
    assert.deepEqual(await keep(a2), off, 'the same character on the device');
    await until(a2, ([u, p]) => window.__fakeRTDB.data.has('cloudSaves/' + u + '/' + p), 10000, [UID, off.pid]);
    const up = await cloud(a2, off.pid);
    assert.deepEqual(keepOf(up), off, 'every item, its quality, the quests: in the account');
    assert.ok(once(up), 'no item twice');
    assert.deepEqual(await a2.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a2.errors, []);
    // (A stays open: in the fake the database lives in the open pages)

    // device C, offline: a character of its own, never signed in
    const c = await H.openGame({ ctx, query: '?slot=c' });
    await H.newGame(c, { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await c.eval(() => { const G = window.__G, S = G.S; const it = G.eqx.mkItem('isword', 3); it.en = 2; S.items.push(it); S.gold = 50; G.save(true); });
    const zed = await keep(c);
    assert.ok(zed.lv < off.lv);
    await c.close();
    // signed in there: the account's further character comes down, and Zed goes up first as its own
    const c2 = await online(ctx, 'c');
    assert.deepEqual(await keep(c2), keepOf(up), "the account's character, whole");
    assert.deepEqual(await index(c2), [off.pid, zed.pid].sort(), 'both characters in the account');
    assert.deepEqual(keepOf(await cloud(c2, zed.pid)), zed, 'Zed with everything it had');
    const bk = await c2.eval(() => Satisfy.local.backups()), before = Object.keys(bk).filter((k) => /^before-cloud-/.test(k));
    assert.equal(before.length, 1, 'and kept on the device too');
    assert.deepEqual(keepOf(JSON.parse(bk[before[0]]).S), zed);
    assert.match(await toastLog(c2), /Your character Zed \(Lv 1\) on this device was kept in your account[^]*Your character Grid \(Lv \d+\) was loaded from your account/);

    // a reconnect: the page reloads and signs in again; nothing comes down again, nothing goes twice
    await c2.close();
    const c3 = await online(ctx, 'c');
    assert.deepEqual(await keep(c3), keepOf(up), 'the same character, nothing lost');
    assert.ok(once(await c3.eval(() => window.__G.S)), 'no item twice');
    assert.equal(Object.keys(await c3.eval(() => Satisfy.local.backups())).filter((k) => /^before-cloud-/.test(k)).length, 1, 'not replaced again');
    assert.deepEqual(keepOf(await cloud(c3, zed.pid)), zed, 'Zed untouched in the account');
    assert.deepEqual(await c3.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(c3.errors, []);
  } finally { await ctx.close(); }
});

test('an offline character too large to go up stays on its device; the account one does not replace it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await a.eval(() => { const G = window.__G; G.gainXP(9000); G.save(true); });
    const pid = await a.eval(() => window.__G.S.pid);
    await until(a, ([u, p]) => window.__fakeRTDB.data.has('cloudSaves/' + u + '/' + p), 10000, [UID, pid]);
    // device B offline: a character whose save is past the cloud's limit (400,000 characters)
    const b = await H.openGame({ ctx, query: '?slot=b' });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { const G = window.__G; G.S.note = 'x'.repeat(410000); G.save(true); });
    const fk = await keep(b);
    await b.close();
    const b2 = await online(ctx, 'b');
    assert.deepEqual(await keep(b2), fk, 'Faker stays: it could not go up, so nothing came down over it');
    assert.deepEqual(await index(b2), [pid]);
    assert.match(await toastLog(b2), /^(?![^]*was loaded from your account)/, 'nothing came down');
    assert.deepEqual(b2.errors, []);
  } finally { await ctx.close(); }
});
