'use strict';
// SAT-ONLINE-143 (plan U346 "data export/delete: the user can request account delete", with a request made twice, a
// connection lost part-way and someone who isn't the owner). The owner took the data export out (2026-10-21), so the
// request is "Delete my account" (was "Delete my online data") (two clicks in Cloud saves): every record of the account goes, its account ID
// and name are freed, the save on the device stays. Someone else can't delete any of it. A delete cut off part-way
// leaves no character entry pointing at a deleted save and finishes when asked again; asked again with nothing left,
// it still works. Over the fake Firebase with the rules' checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const UID = 'gDelMe1', OTHER = 'gKeepMe2';
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
// with its account ID taken (SAT-ONLINE-026) on every page open, as the server would have it
async function signIn(g, name, uid, ...others) {
  for (const o of others) await o.eval(([n, u]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.data.set('handles/' + n.toLowerCase(), u); }, [name, uid]);
  await g.eval(([n, u]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.data.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [name, uid]);
  await until(g, () => !document.getElementById('cloudBtn').hidden && !!Satisfy.local.net());
}
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
const keysOf = (g, uid) => g.eval((u) => [...window.__fakeRTDB.data.keys()].filter((k) => k.split('/').includes(u) || window.__fakeRTDB.data.get(k) === u).sort(), uid);
async function openCloud(g) {
  await click(g, '#cloudBtn');
  await until(g, () => !document.getElementById('cloudW').hidden && !/Loading/.test(document.getElementById('cloudL').textContent));
}
// "Delete my account" asks for a second click
async function erase(g) { await openCloud(g); await g.eval(() => { const b = document.querySelector('#cloudA button:nth-child(2)'); b.click(); b.click(); }); }
const keepToasts = (g) => g.eval(() => { window.__toastLog = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); });
const toastLog = (g) => g.eval(() => window.__toastLog.join(' | '));
const removeAs = (g, p) => g.eval(async (path) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.remove(D.ref(F.db, path)); return 'ok'; } catch (e) { return 'no'; } }, p);

test('Delete my account: never by someone else, finished after a failure part-way, and again with nothing left', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    await signIn(b, 'Bassem', OTHER);
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await signIn(a, 'Ahmed', UID, b);
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await keepToasts(a);
    await until(a, (u) => [...window.__fakeRTDB.data.keys()].some((k) => k.startsWith('cloudSaves/' + u + '/')) && window.__fakeRTDB.data.has('profiles/' + u), 10000, UID);
    await until(b, (u) => window.__fakeRTDB.data.has('profiles/' + u), 10000, UID);
    const all = await keysOf(a, UID);
    for (const k of ['accountIds/' + UID, 'handles/ahmed', 'profiles/' + UID, 'sessions/' + UID]) assert.ok(all.includes(k), k + ' in ' + all);
    const bKeys = await keysOf(b, OTHER);

    // someone else: none of it can be removed
    for (const p of all) assert.equal(await removeAs(b, p), 'no', 'B removing ' + p);
    assert.deepEqual(await keysOf(a, UID), all, 'all still there');

    // the connection lost part-way (the profile, near the end, can't be removed): the characters went first, so no entry
    // is left pointing at a deleted save; the game says so and stays signed in
    await a.eval(() => window.__G.act('quit')); await a.waitMode('title');
    await a.eval(() => { window.__fakeRTDB.failRemove = '^profiles/'; });
    await erase(a);
    await until(a, () => /Cloud save failed/.test(window.__toastLog.join(' ')), 8000);
    const left = await keysOf(a, UID);
    assert.ok(left.includes('profiles/' + UID), 'the profile is left');
    assert.ok(!left.some((k) => /^cloud(Index|Saves)\//.test(k)), 'no character entry and no save left: ' + left);
    assert.ok(await a.eval(() => !!Satisfy.local.net()), 'still signed in');

    // asked again: the rest goes, the account ID and its name are freed (firstSeen stays: write-once, SAT-ONLINE-174, so a
    // deleted and remade account can't vote in the expo again)
    await a.eval(() => { window.__fakeRTDB.failRemove = null; });
    await erase(a);
    await until(a, () => /Your account is deleted/.test(window.__toastLog.join(' ')), 8000);
    await until(a, (u) => ![...window.__fakeRTDB.data.keys()].some((k) => !/^firstSeen\//.test(k) && (k.split('/').includes(u) || window.__fakeRTDB.data.get(k) === u)), 8000, UID);
    assert.equal(await a.eval(() => window.__fakeRTDB.data.has('handles/ahmed')), false, 'the name is free for anyone');

    // and again, signed in afresh with nothing left online: it works and leaves nothing
    await signIn(a, 'Ahmed', UID);
    await a.waitMode('create', 15000); // signed in: the character went with the account (owner 2026-10-24), so a new one is made
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await until(a, (u) => window.__fakeRTDB.data.has('sessions/' + u), 8000, UID);
    await erase(a);
    await until(a, () => document.getElementById('cloudBtn').hidden && Satisfy.local.net() === null, 8000); // done: signed out (the same notice as before isn't shown twice)
    // still in the world, signed out: the game plays on offline (the shared monsters stop with the network)
    assert.equal(await a.mode(), 'play');
    await a.step(60);
    await until(a, (u) => ![...window.__fakeRTDB.data.keys()].some((k) => !/^firstSeen\//.test(k) && (k.split('/').includes(u) || window.__fakeRTDB.data.get(k) === u)), 8000, UID);

    // the other account untouched
    assert.deepEqual((await keysOf(b, OTHER)).filter((k) => !/^presence\//.test(k)), bKeys.filter((k) => !/^presence\//.test(k)));
    assert.equal((await b.eval(() => Satisfy.local.net())).state, 'ONLINE');
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), [], 'nothing refused for the owner');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
