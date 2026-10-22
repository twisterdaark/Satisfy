'use strict';
// SAT-ONLINE-095 (plan U240) over the fake Firebase with the rules' checks: online territory objectives. Hunters takes a
// territory: everyone sees it, with the server's time of the capture; Wolves can't take it for 45 minutes (the rules
// refuse it too), then can. A guild takes at most four places in seven days: each capture uses one of four slots, written
// with it; the fifth waits (the game says when), and the slot is free again a week later. Only a member takes a place for
// their guild; the canon guilds win a place back from its holder's member only. A capture the server refuses gives nothing
// (no contribution, no news) and the place goes back to what it was, also one the server never had; nobody clears the
// slots, the guild master neither (Claude-B's review of #130).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { const D = window.__fakeRTDB.data; D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
// move a page's clock on by ms from where it is (its Date.now, which the fake's rules use too)
const later = (g, ms) => g.eval((d) => { if (!window.__now0) { window.__now0 = Date.now; window.__dt = 0; } window.__dt += d; const b = window.__now0; Date.now = () => b() + window.__dt; }, ms);
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
const owner = (g, k) => g.eval((x) => { const v = window.__fakeRTDB.data.get('world/satisfy/own/' + x); return v ? v.g : null; }, k);
const news = (g) => g.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^news\//.test(k)).length);
const HU = 'g_gTeA1', WO = 'g_gTeB2', MIN = 60000;

test('territories online: shared, safe 45 minutes, four places a week a guild, members only', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gTeA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gTeB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    for (const [g, n] of [[a, 'Hunters'], [b, 'Wolves']]) {
      await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
      await g.eval((x) => window.__GG.create(x), n);
      await until([g], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    }
    await settle(a, b);
    const T = await a.eval(() => window.__GTERR.T());
    assert.ok(T.length >= 3, 'three territories and the castle: ' + T);

    // Hunters takes one: written with the server's time and its first slot; Wolves sees it
    await until([a], () => !!window.__GTERR.slots);
    await a.eval((k) => window.__GTERR.capture(k), T[0]);
    await until([a, b], (k) => { const v = window.__fakeRTDB.data.get('world/satisfy/own/' + k); return !!v && v.g === 'g_gTeA1'; }, 10000, T[0]);
    assert.deepEqual(await a.eval((k) => { const v = window.__fakeRTDB.data.get('world/satisfy/own/' + k), s = window.__fakeRTDB.data.get('capSlot/g_gTeA1/a'); return [v.s, typeof v.t, s.k]; }, T[0]), ['a', 'number', T[0]]);
    await until([b], (k) => { const o = window.__GTERR.own(); return !!o && o[k] && o[k].g === 'g_gTeA1'; }, 10000, T[0]);

    // safe for 45 minutes: Wolves's capture doesn't reach the server (and the game says so); after 46 it does
    await until([b], () => !!window.__GTERR.slots);
    const c0 = await b.eval(() => window.__GTERR.contrib()), n0 = await news(b);
    await b.eval((k) => window.__GTERR.capture(k), T[0]);
    await settle(a, b);
    assert.equal(await owner(a, T[0]), HU, 'still Hunters');
    await until([b], () => /This capture did not reach the server/.test(window.__toastSeen));
    await until([b], (k) => window.__GTERR.mine(k) === 'g_gTeA1', 10000, T[0]);
    assert.equal(await b.eval(() => window.__GTERR.contrib()), c0, 'no contribution for a refused capture');
    assert.equal(await news(b), n0, 'and no news');
    // one the server never had goes back to its holder in the story (its slot taken meanwhile, unknown to this page: the rules refuse it)
    await b.eval(() => window.__fakeRTDB.data.set('capSlot/g_gTeB2/a', { k: 'x', t: Date.now() }));
    const was1 = await b.eval((k) => window.__GTERR.mine(k), T[1]);
    assert.notEqual(was1, 'g_gTeB2');
    await b.eval((k) => window.__GTERR.capture(k), T[1]);
    assert.equal(await b.eval((k) => window.__GTERR.mine(k), T[1]), 'g_gTeB2', 'shown at once');
    await settle(a, b);
    assert.equal(await owner(a, T[1]), null);
    await until([b], ([k, w]) => window.__GTERR.mine(k) === w, 10000, [T[1], was1]);
    assert.equal(await b.eval(() => window.__GTERR.contrib()), c0);
    await b.eval(() => window.__fakeRTDB.data.delete('capSlot/g_gTeB2/a'));
    // nobody clears the slots: a guild master neither
    assert.equal(await write(a, { 'capSlot/g_gTeA1/a': null }), 'no', 'a slot stays');
    assert.equal(await write(a, { 'capSlot/g_gTeA1': null }), 'no', 'all of them too');
    for (const g of [a, b]) await later(g, 46 * MIN);
    await b.eval((k) => window.__GTERR.capture(k), T[0]);
    await until([a], (k) => { const v = window.__fakeRTDB.data.get('world/satisfy/own/' + k); return !!v && v.g === 'g_gTeB2'; }, 10000, T[0]);

    // four places in seven days: Hunters's next three (two territories and the castle) use slots b, c and d; then it waits
    await a.eval((k) => window.__GTERR.capture(k), T[1]); await settle(a);
    await a.eval((k) => window.__GTERR.capture(k), T[2]); await settle(a);
    await a.eval(() => window.__GTERR.castle()); await settle(a);
    await until([a], () => ['a', 'b', 'c', 'd'].every((s) => window.__fakeRTDB.data.has('capSlot/g_gTeA1/' + s)));
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/own/castle').g), HU);
    assert.equal(await a.eval(() => window.__GTERR.free()), null, 'no slot left');
    await a.eval((k) => window.__GTERR.act(k), T[0]); await a.step(2);
    assert.match(await a.eval(() => document.getElementById('dialog').textContent), /Your guild has taken 4 places in the last 7 days\. The next one frees in (7 days|6 days|\d+ h)/);
    await a.eval(() => window.__G.advance()); await a.step(2);
    await later(a, 46 * MIN); // Wolves's 45 minutes are over for Hunters too: only the slots stop it
    const direct = await a.eval(async (k) => { const F = window.__GLD.fb(), D = F.m.database, u = {}; u['world/satisfy/own/' + k] = { g: 'g_gTeA1', n: 'Hunters', c: '#5aa0ff', h: 'Ahmed', uid: 'gTeA1', s: 'a', t: D.serverTimestamp() }; u['capSlot/g_gTeA1/a'] = { k, t: D.serverTimestamp() }; try { await D.update(D.ref(F.db), u); return 'ok'; } catch (e) { return 'no'; } }, T[0]);
    assert.equal(direct, 'no', 'the rules count the slots too');
    assert.equal(await owner(a, T[0]), WO);

    // a canon guild wins a place back only from a member of the guild that holds it
    const npcByOther = await a.eval(async (k) => { const F = window.__GLD.fb(), D = F.m.database, u = {}; u['world/satisfy/own/' + k] = { g: 'g_tzed', n: 'Tzed', c: '#4ab06a', h: 'Ahmed', uid: 'gTeA1', s: '-', t: D.serverTimestamp() }; try { await D.update(D.ref(F.db), u); return 'ok'; } catch (e) { return 'no'; } }, T[0]);
    assert.equal(npcByOther, 'no', "not from another guild's land");
    await later(b, 46 * MIN);
    await b.eval((k) => window.__GTERR.lose(k, 'g_tzed'), T[0]); // an offline raid won it back from Wolves
    await until([a], (k) => { const v = window.__fakeRTDB.data.get('world/satisfy/own/' + k); return !!v && v.g === 'g_tzed'; }, 10000, T[0]);

    // a week later Hunters's first slot is free again, and it takes the place
    await later(a, 7 * 24 * 60 * MIN);
    assert.equal(await a.eval(() => window.__GTERR.free()), 'a');
    await a.eval((k) => window.__GTERR.capture(k), T[0]);
    await until([a], (k) => { const v = window.__fakeRTDB.data.get('world/satisfy/own/' + k); return !!v && v.g === 'g_gTeA1'; }, 10000, T[0]);
    // nobody takes a place for a guild they aren't in
    const forged = await b.eval(async (k) => { const F = window.__GLD.fb(), D = F.m.database, u = {}; u['world/satisfy/own/' + k] = { g: 'g_gTeA1', n: 'Hunters', c: '#5aa0ff', h: 'Bassem', uid: 'gTeB2', s: 'b', t: D.serverTimestamp() }; u['capSlot/g_gTeA1/b'] = { k, t: D.serverTimestamp() }; try { await D.update(D.ref(F.db), u); return 'ok'; } catch (e) { return 'no'; } }, T[1]);
    assert.equal(forged, 'no', "not for a guild you aren't in");
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/own capture|capSlot/.test(x))), []);
  } finally { await ctx.close(); }
});

// Claude-B's re-review of #130: the rules take captures only from members of online guilds. A signed-in player in a guild
// that isn't online (a canon guild, or one made offline) still takes places and the castle, kept on that page as before.
test('territories online: a player whose guild is not online still takes a place and the castle, on this page', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const c = await signIn(ctx, 'c', 'gTeC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(c);
    await c.eval(() => { const S = window.__G.S; S.lv = 60; S.guild = 'g_tzed'; delete S.gon; });
    const T = await c.eval(() => window.__GTERR.T());
    const was = await c.eval((k) => window.__GTERR.mine(k), T[0]);
    assert.notEqual(was, 'g_tzed');
    await c.eval((k) => window.__GTERR.capture(k), T[0]);
    await settle(c);
    assert.equal(await c.eval((k) => window.__GTERR.mine(k), T[0]), 'g_tzed', 'taken, and it stays');
    await c.eval(() => window.__GTERR.castle());
    await settle(c);
    assert.equal(await c.eval(() => window.__GU.WS.castle.own), 'g_tzed', 'the castle too');
    assert.equal(await c.eval((k) => window.__fakeRTDB.data.has('world/satisfy/own/' + k) || window.__fakeRTDB.data.has('world/satisfy/own/castle'), T[0]), false, 'nothing written for a guild that is not online');
    assert.doesNotMatch(await c.eval(() => window.__toastSeen), /did not reach the server/);
    assert.deepEqual(await c.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(c.errors, []);
  } finally { await ctx.close(); }
});
