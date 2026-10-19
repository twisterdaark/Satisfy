'use strict';
// SAT-ONLINE-015 (doc §29 T35): sign out, and delete everything the account stored online, from the
// Cloud saves panel. Over the fake Firebase, with a second account that must not be touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const UID = 'gEraseMe1', OTHER = 'gSomeoneElse2';
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
async function signIn(g, name, uid) {
  await g.eval(([n, u]) => { window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [name, uid]);
  await until(g, () => !document.getElementById('cloudBtn').hidden && !!Satisfy.local.net());
}
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
const keysOf = (g, uid) => g.eval((u) => [...window.__fakeRTDB.data.keys()].filter((k) => k.split('/').includes(u)).map((k) => k.replace(/\/p_[a-z0-9]+$/, '/<pid>').replace(/\/-[^/]+$/, '/<msg>')).sort(), uid);
async function openCloud(g) {
  await click(g, '#cloudBtn');
  await until(g, () => !document.getElementById('cloudW').hidden && !/Loading/.test(document.getElementById('cloudL').textContent));
}
const accountButtons = (g) => g.eval(() => [...document.querySelectorAll('#cloudA button')].map((b) => b.textContent));

test('Sign out, then Delete my online data: nothing of the account is left online, the local save stays', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    await signIn(b, 'Bassem', OTHER);
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.step(30);

    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await signIn(a, 'Ahmed', UID);
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await until(a, (u) => !!window.__fakeRTDB.data.get('profiles/' + u), 8000, UID);
    await until(b, () => Satisfy.local.net().remotes.length === 1);
    await a.eval(() => window.__G.act('quit'));
    await a.waitMode('title');
    const local = await a.eval(() => localStorage.getItem('satisfy_proto_v4@a'));
    assert.ok(local);

    // upload a cloud character (two clicks), so every kind of record exists
    await openCloud(a);
    assert.deepEqual(await accountButtons(a), ['Sign out', 'Delete my online data']);
    await click(a, '#cloudN button'); await click(a, '#cloudN button');
    await until(a, () => document.querySelectorAll('#cloudL .cr').length === 1);
    assert.deepEqual(await keysOf(a, UID), ['cloudIndex/gEraseMe1/<pid>', 'cloudSaves/gEraseMe1/<pid>', 'presence/satisfy/main/gEraseMe1', 'profiles/gEraseMe1', 'sessions/gEraseMe1']);

    // Sign out: presence goes, the cloud data stays, the title offers sign-in again
    await click(a, '#cloudA button');
    await until(a, () => document.getElementById('cloudBtn').hidden && Satisfy.local.net() === null);
    assert.equal(await a.eval(() => document.getElementById('onlineBtn').textContent), 'Play online');
    assert.equal(await a.eval(() => document.getElementById('cloudW').hidden), true);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Signed out/);
    await until(a, (u) => !window.__fakeRTDB.data.has('presence/satisfy/main/' + u), 5000, UID);
    await until(b, () => Satisfy.local.net().remotes.length === 0);
    assert.deepEqual(await keysOf(a, UID), ['cloudIndex/gEraseMe1/<pid>', 'cloudSaves/gEraseMe1/<pid>', 'profiles/gEraseMe1', 'sessions/gEraseMe1']);

    // sign back in, then delete everything: one click does nothing, the second erases
    await signIn(a, 'Ahmed', UID);
    await until(a, (u) => window.__fakeRTDB.data.has('sessions/' + u), 5000, UID);
    await openCloud(a);
    await click(a, '#cloudA button:nth-child(2)');
    await a.step(5);
    assert.equal((await keysOf(a, UID)).length >= 4, true, 'one click deletes nothing');
    await click(a, '#cloudA button:nth-child(2)');
    await until(a, () => document.getElementById('cloudBtn').hidden && Satisfy.local.net() === null);
    await until(a, (u) => ![...window.__fakeRTDB.data.keys()].some((k) => k.split('/').includes(u)), 5000, UID);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Your online data is deleted \(\d+ records\)/);
    assert.equal(await a.eval(() => localStorage.getItem('satisfy_proto_v4@a')), local, 'the save on this device is untouched');
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);

    // the other account is untouched and still online
    assert.deepEqual(await keysOf(b, OTHER), ['presence/satisfy/main/gSomeoneElse2', 'profiles/gSomeoneElse2', 'sessions/gSomeoneElse2']);
    assert.equal((await b.eval(() => Satisfy.local.net())).state, 'ONLINE');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

// 37f15f6 (owner request): on a shared device each Google account keeps its own local save, and the title has
// "Play with another Google account". The device's old save goes to the first account that signs in without one.
test('Play with another Google account: each account keeps its own character on this device', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online' });
    const ONE = 'gAcctOne1', TWO = 'gAcctTwo2';
    await g.eval(([a, b]) => { window.__fakeRTDB.data.set('accountIds/' + a, 'Ahmed_1'); window.__fakeRTDB.data.set('accountIds/' + b, 'Bassem_2'); }, [ONE, TWO]);
    const storeKey = () => g.eval(() => window.__GU.getStore());
    const name = () => g.eval(() => window.__G.S.look.n);

    await signIn(g, 'Ahmed', ONE);
    assert.equal(await storeKey(), 'satisfy_proto_v4@g' + ONE);
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(30);
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    assert.equal(await g.eval(() => document.getElementById('switchBtn').hidden), false);
    assert.equal(await g.eval(() => document.getElementById('switchBtn').textContent), 'Play with another Google account');

    // the second account: the chooser opens from the click, and with no character of its own it goes to creation
    await g.eval((u) => { window.__fakeRTDB.nextName = 'Bassem'; window.__fakeRTDB.nextUid = u; document.getElementById('switchBtn').click(); }, TWO);
    await until(g, (u) => !!Satisfy.local.net() && window.__GU.getStore() === 'satisfy_proto_v4@g' + u, 8000, TWO);
    assert.deepEqual(await g.eval(() => window.__fakeRTDB.authParams), { prompt: 'select_account' });
    await until(g, () => window.__G.mode === 'create', 8000);
    await H.newGame(g, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await g.step(30);
    await g.eval(() => window.__G.act('quit'));
    await g.waitMode('title');
    const saves = await g.eval(([a, b]) => [a, b].map((u) => /Grid/.test(localStorage.getItem('satisfy_proto_v4@g' + u) || '') ? 'Grid' : /Faker/.test(localStorage.getItem('satisfy_proto_v4@g' + u) || '') ? 'Faker' : null), [ONE, TWO]);
    assert.deepEqual(saves, ['Grid', 'Faker'], 'two saves on one device, one per account');

    // back to the first account: its own character continues
    await g.eval((u) => { window.__fakeRTDB.nextName = 'Ahmed'; window.__fakeRTDB.nextUid = u; document.getElementById('switchBtn').click(); }, ONE);
    await until(g, () => window.__G.mode === 'play', 10000);
    assert.equal(await storeKey(), 'satisfy_proto_v4@g' + ONE);
    assert.equal(await name(), 'Grid');
    assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
