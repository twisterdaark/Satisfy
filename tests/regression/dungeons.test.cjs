'use strict';
// Dungeon ratings (major 13, novel ch 592 and 637): each dungeon carries a rating (normal to legendary) that it shows on
// entry and that adds 5% experience and gold per step inside it; the first player in the world to find a dungeon gets 20%
// more experience there for a week and a boss chest that always holds an item; a conquered dungeon greets you once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent));

test('offline: the rating on entry, its bonus, the first finder for a week, and the greeting after the boss', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // walk into the Warlord's Throne (unique-rated)
    await g.eval(() => { const G = window.__G, D = window.__GDT.dun('zDun3'); for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } G.P.x = (D.x0 + D.x1 + 1) * 8; G.P.y = (D.y0 + D.y1 + 1) * 8; });
    await g.step(100); // a zone counts after 1.2 s in it
    await g.page.waitForTimeout(4200);
    const a = await g.eval(() => { const G = window.__G, T = window.__GDT, m = { x: G.P.x, y: G.P.y }; return { zone: G.S.zone, at: T.zone(m.x, m.y), xp: T.xp(m), gold: T.gold(m), fw: T.fw('zDun3'), left: Math.round((T.s().fw.zDun3 - Date.now()) / 864e5), chest: T.p(m) }; });
    assert.equal(a.zone, 'zDun3'); assert.equal(a.at, 'zDun3');
    assert.equal(a.fw, true, 'the first to find it on this device: ' + JSON.stringify(a)); assert.equal(a.left, 7);
    assert.equal(Math.round(a.xp * 100), 25, '5% for unique plus 20% for the first finder');
    assert.equal(a.gold, 0.05); assert.equal(a.chest, 1);
    const t1 = (await toasts(g)).join(' | ');
    assert.ok(/Warlord's Throne/.test(t1) && /unique/i.test(t1), t1);
    assert.ok(/first player to find/.test(t1), t1);
    // after the week: only the rating's bonus; outside a dungeon, nothing
    const b = await g.eval(() => { const G = window.__G, T = window.__GDT, m = { x: G.P.x, y: G.P.y }; T.s().fw.zDun3 = Date.now() - 1; const D1 = T.dun('zDun1'); return { xp: T.xp(m), chest: T.p(m), r: T.r(m, 1), d1: T.xp({ x: D1.x0 * 16 + 20, y: D1.y0 * 16 + 20 }), out: T.xp({ x: 200, y: 200 }) }; });
    assert.deepEqual(b, { xp: 0.05, chest: 0.05, r: 1, d1: 0, out: 0 });
    // the boss falls; the next visit says so once
    await g.eval(() => { const G = window.__G, T = window.__GDT; T.clear({ x: G.P.x, y: G.P.y }); document.getElementById('toasts').innerHTML = ''; T.enter('zDun3'); });
    await g.page.waitForTimeout(3200);
    assert.ok((await toasts(g)).some((s) => /first time you have visited the dungeon after conquering it/.test(s)));
    await g.eval(() => { document.getElementById('toasts').innerHTML = ''; window.__GDT.enter('zDun3'); });
    await g.page.waitForTimeout(3200);
    assert.ok(!(await toasts(g)).some((s) => /after conquering/.test(s)), 'only once');
    assert.deepEqual(await g.eval(() => window.__GDT.s().clr.zDun3), 2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

async function until(games, fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}

test('online: one first finder per world, kept in the database; the second player gets only the rating', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name] of [['a', 'gDtA1', 'Ahmed'], ['b', 'gDtB2', 'Bassem']]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
      await H.newGame(g, { n: name === 'Ahmed' ? 'Grid' : 'Faker', hair: 1, hc: 2, skin: 1, top: 3 });
    }
    const { a, b } = P;
    await a.eval(() => window.__GDT.enter('zMine2'));
    await until([a], () => window.__GDT.fw('zMine2'));
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/df_zmine2').uid), 'gDtA1');
    await b.eval(() => window.__GDT.enter('zMine2'));
    for (let i = 0; i < 6; i++) { await b.step(5); await b.page.waitForTimeout(60); }
    assert.equal(await b.eval(() => window.__GDT.fw('zMine2')), false, 'already found by Ahmed');
    assert.equal(await b.eval(() => window.__GDT.s().seen.zMine2), 1);
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/df_zmine2').uid), 'gDtA1');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
