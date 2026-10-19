'use strict';
// SAT-ONLINE-029 (owner feedback #1, #3, #4, #15): after signing in, a player picks a name nobody else has; online
// everyone sees that name (never the Google one); it shows at once after F5; online-only, Play waits for it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(6);
    await games[0].page.waitForTimeout(30);
  }
}
async function signIn(g, name, uid) {
  await g.eval(([n, u]) => { window.__fakeRTDB.nextName = n; if (u) window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [name, uid]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
}
const btn = (g) => g.eval(() => document.getElementById('onlineBtn').textContent);
async function choose(g, name) {
  await until([g], () => !document.getElementById('hndW').hidden);
  await g.eval((n) => { const i = document.getElementById('hndIn'); i.value = n; document.getElementById('hndOk').click(); }, name);
  await g.page.waitForTimeout(100); await g.step(3);
}

test('a unique name per account, shown to others instead of the character (and never the Google name)', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    await signIn(a, 'Ahmed Google', 'gHandleA1');
    assert.equal(await btn(a), 'Online as choose a name', 'not the Google display name');
    await choose(a, 'gr');
    assert.match(await a.eval(() => document.getElementById('hndE').textContent), /3 to 16/);
    await choose(a, 'GridMaster');
    await until([a], () => document.getElementById('hndW').hidden);
    assert.equal(await btn(a), 'Online as GridMaster');
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.data.get('handles/gridmaster').uid), 'gHandleA1');

    await signIn(b, 'Bassem Google', 'gHandleB2');
    await choose(b, 'gridmaster');
    await until([b], () => document.getElementById('hndE').textContent === 'Someone already has this name');
    await choose(b, 'Faker_2');
    await until([b], () => document.getElementById('hndW').hidden);

    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b); await settle(a, b);
    assert.deepEqual((await a.eval(() => Satisfy.local.net().remotes)).map((r) => r.handle), ['Faker_2']);
    assert.deepEqual((await b.eval(() => Satisfy.local.net().remotes)).map((r) => r.handle), ['GridMaster']);
    await until([a], () => (window.__fakeRTDB.data.get('profiles/gHandleA1') || {}).handle === 'GridMaster');

    // F5: the name is there at once (no "?"), the session comes back by itself, no question asked again
    await a.eval(() => window.__G.act('quit'));
    await a.waitMode('title');
    await a.reload();
    assert.match(await btn(a), /^(Signing in as|Online as) GridMaster…?$/, 'the name at once, never "?" or the Google name');
    await until([a], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    assert.equal(await btn(a), 'Online as GridMaster');
    await a.step(30);
    assert.equal(await a.eval(() => document.getElementById('hndW').hidden), true);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('online-only (&only=1): no New game / Continue; Play waits for the name, then starts this account\'s character', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online&only=1&slot=o' });
    const vis = () => g.eval(() => ['contBtn', 'newBtn', 'playBtn'].map((id) => !document.getElementById(id).hidden));
    assert.deepEqual(await vis(), [false, false, true]);
    assert.equal(await g.eval(() => document.getElementById('playBtn').disabled), true, 'not signed in yet');
    await signIn(g, 'Ruby Google', 'gOnlyOne3');
    await until([g], () => !document.getElementById('hndW').hidden);
    assert.equal(await g.eval(() => document.getElementById('hndLater').hidden), true, 'online-only: no "Later"');
    assert.equal(await g.eval(() => document.getElementById('playBtn').disabled), true, 'no name yet');
    await choose(g, 'Ruby');
    await until([g], () => !document.getElementById('playBtn').disabled);
    await g.eval(() => document.getElementById('playBtn').click());
    await g.waitMode('create');
    assert.equal(await g.eval(() => document.getElementById('cname').value), 'Ruby', 'no character yet: create one, named after the account');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
