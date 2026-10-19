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
    assert.deepEqual(await accountButtons(a), ['Sign out', 'Delete my online data', 'Hide my level from others']);
    await click(a, '#cloudN button'); await click(a, '#cloudN button');
    await until(a, () => document.querySelectorAll('#cloudL .cr').length === 1);
    assert.deepEqual(await keysOf(a, UID), ['cloudIndex/gEraseMe1/<pid>', 'cloudSaves/gEraseMe1/<pid>', 'presence/satisfy/main/gEraseMe1', 'profiles/gEraseMe1', 'sessions/gEraseMe1']);

    // Sign out: presence goes, the cloud data stays, the title offers sign-in again
    await click(a, '#cloudA button');
    await until(a, () => document.getElementById('cloudBtn').hidden && Satisfy.local.net() === null);
    assert.equal(await a.eval(() => document.getElementById('onlineBtn').textContent), 'Play online (Google)');
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
