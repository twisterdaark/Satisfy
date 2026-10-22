'use strict';
// SAT-ONLINE-064 (Claude-B #13 item 25): the National Competition online, over the fake Firebase with the rules' checks.
// A forced competition: both join and go to the grounds; A hunts in stage 1, B crafts in stage 2, both duel in stage 3 (three a foe count); the scores
// reach the database; at the end each is paid once by its rank, A (first) gets the title and B hears it.
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
const MIN = 60000;
const force = (games, ms) => Promise.all(games.map((g) => g.eval((m) => window.__GNC.force(m), ms)));
const bar = (g) => g.eval(() => { const b = document.getElementById('natbar'); return b.hidden ? null : b.textContent; });

test('online: a National Competition in three stages; scores in the database; each paid once by rank; the winner is heard', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] }); // an odd hour: no real competition runs into the forced one
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gNcA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gNcB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await force([a, b], 0);
    await until([a, b], () => /Stage 1\/3: Hunting/.test(document.getElementById('natbar').textContent) && !document.getElementById('natbar').hidden);
    const id = await a.eval(() => window.__GNC.now().id);
    // taking part is a choice (owner 2026-10-22): a kill before joining scores nothing; Join takes you to the grounds
    assert.equal(await a.eval(() => { const G = window.__G, m = G.mons().find((m) => !m.dead && !m.tmp); m.hp = 0; window.__GB2.kill(m); return window.__GNC.sc().h; }), 0, 'not joined: no points');
    for (const g of [a, b]) await g.eval(() => document.querySelector('#natbar [data-nat=join]').click());
    await until([a, b], () => window.__GNC.here() && window.__G.mode === 'play', 10000);
    assert.match(await bar(a), /Leave/);
    await a.step(190); // the first ones come 3 s of the game's clock after joining, which moves only when the test steps it
    await until([a], () => window.__G.mons().some((m) => m.nat && !m.dead), 10000); // the hunting stage sends monsters to the grounds

    // stage 1: A kills three monsters; B's kills would count too, but B hunts nothing
    const hunt = await a.eval(() => {
      const G = window.__G, N = Satisfy.natcomp, ms = G.mons().filter((m) => !m.dead && !m.tmp).slice(0, 3);
      let pts = 0; for (const m of ms) { pts += N.huntPts(Satisfy.local.defs().MT[m.type].lv[0], Satisfy.local.defs().MT[m.type].boss); m.hp = 0; window.__GB2.kill(m); }
      return pts;
    });
    assert.ok(hunt >= 3);
    assert.equal((await a.eval(() => window.__GNC.sc())).h, hunt);
    // stage 2: B crafts a sword; A's points from the hunt stay
    await force([a, b], 10 * MIN + 1000); await settle(a, b);
    assert.match(await bar(b), /Stage 2\/3: Production/);
    const craft = await b.eval(() => { const G = window.__G, S = G.S; S.mats.ore = 20; S.mats.wood = 20; G.startMG('isword'); G.finishMG()(); const it = S.items[S.items.length - 1]; return Satisfy.natcomp.craftPts(it.r); });
    assert.equal((await b.eval(() => window.__GNC.sc())).c, craft);
    assert.equal(await a.eval(() => { window.__GNC.duel(true, 'gNcB2'); return window.__GNC.sc().d; }), 0, 'a duel in the production stage scores nothing');
    // stage 3: four wins over the same foe count three times
    await force([a, b], 20 * MIN + 1000); await settle(a, b);
    assert.match(await bar(a), /Stage 3\/3: Arena/);
    const duel = await a.eval(() => { for (let i = 0; i < 4; i++) window.__GNC.duel(true, 'gNcB2'); return window.__GNC.sc().d; });
    assert.equal(duel, 3 * 50);
    assert.equal(await b.eval(() => { window.__GNC.duel(false, 'gNcA1'); return window.__GNC.sc().d; }), 10);
    for (const g of [a, b]) await g.eval(() => window.__GNC.write());
    const sA = hunt + duel, sB = craft + 10;
    await until([a], (o) => { const v = window.__fakeRTDB.data.get('nat/' + o.id + '/gNcA1'), w = window.__fakeRTDB.data.get('nat/' + o.id + '/gNcB2'); return !!v && !!w && v.s === o.sA && w.s === o.sB; }, 10000, { id, sA, sB });
    await settle(a, b);
    assert.match(await bar(a), new RegExp(sA + ' pts'));

    // the end: half a minute later each is paid once by rank; A first (the title, and the world hears it)
    const g0 = { a: await a.eval(() => window.__G.S.gold), b: await b.eval(() => window.__G.S.gold) };
    const want = await a.eval((o) => ({ a: Satisfy.natcomp.reward(o.sA > o.sB ? 1 : 2, o.sA), b: Satisfy.natcomp.reward(o.sA > o.sB ? 2 : 1, o.sB) }), { sA, sB });
    await force([a, b], 30 * MIN + 31000);
    await until([a, b], () => document.getElementById('natbar').hidden);
    await until([a, b], () => !window.__GNC.here() && !window.__GNC.joined(), 10000); // back in town when it ends
    await until([a], (g) => window.__G.S.gold === g, 15000, g0.a + want.a);
    await until([b], (g) => window.__G.S.gold === g, 15000, g0.b + want.b);
    assert.equal(await a.eval((id) => window.__fakeRTDB.data.get('natPaid/' + id + '/gNcA1').g, id), want.a);
    assert.equal(await a.eval(() => !!window.__G.S.tl.natChamp), sA > sB, 'the winner\'s title');
    await until([b], () => /Ahmed won the National Competition!/.test(document.body.textContent), 10000);
    // paid once: later frames pay nothing more
    await settle(a, b); await settle(a, b);
    assert.equal(await a.eval(() => window.__G.S.gold), g0.a + want.a);
    // the board
    await a.eval(() => window.__GNC.board());
    await until([a], () => !document.getElementById('dialog').hidden);
    assert.match(await a.eval(() => document.getElementById('dialog').textContent), /National Competition \(\d\d:00 UTC\)/);
    await a.eval(() => window.__G.advance()); await a.step(2);
    assert.match(await a.eval(() => document.getElementById('dialog').textContent), /1\. Ahmed: \d+ \(hunt \d+ · craft 0 · arena 150\) · 2\. Bassem: \d+ \(hunt 0 · craft \d+ · arena 10\)/);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
