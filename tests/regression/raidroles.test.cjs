'use strict';
// SAT-ONLINE-061 (Claude-B #13 item 24; doc ch 40 U171): raid roles against bosses. Two players in a raid next to the
// Goblin Chief (frozen): a tank takes 30% less and draws the boss on the host; damage hits 15% harder; a support near you
// takes 15% off your damage too; a healer heals the raid mates near it every 3 s. None of it outside a raid.
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
    for (const g of games) await g.step(10);
    await games[0].page.waitForTimeout(30);
  }
}
const boss = (g) => g.eval(() => window.__G.mons().find((m) => m.type === 'gchief' && !m.dead));
// next to the boss, frozen so it can't fight back (as raid.test does), the other monsters out of the way
const at = (g, dx) => g.eval((dx) => {
  const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead);
  m.stun = 1e9; m.x = m.sx; m.y = m.sy;
  for (const o of G.mons()) if (o !== m) { o.dead = true; o.rt = 1e9; }
  G.P.x = m.x + dx; G.P.y = m.y; G.P.inv = 0;
}, dx);
const def = (g) => g.eval(() => window.__GRL.def(window.__G.mons().find((m) => m.type === 'gchief' && !m.dead)));
const atk = (g) => g.eval(() => window.__GRL.atk(window.__G.mons().find((m) => m.type === 'gchief' && !m.dead)));

test('online: raid roles against a boss: tank, damage, support and healer; nothing outside a raid', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gRlA1', 'Lead'], ['b', 'gRlB2', 'Mate']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    assert.ok(await boss(a), 'the Goblin Chief is there');
    await at(a, -40); await at(b, -20);
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2, 15000);
    await at(b, 70);
    await a.eval(() => window.__GRL.role('tank')); await b.eval(() => window.__GRL.role('damage'));
    await settle(a, b);
    // a party, not a raid: nothing
    assert.equal(await def(a), 1);
    assert.equal(await atk(b), 1);
    // a raid
    await a.eval(() => document.getElementById('pRaidB').click());
    await until([a, b], () => window.__GRL.on());
    assert.equal(await def(a), 0.7, 'the tank takes 30% less');
    assert.equal(await atk(b), 1.15, 'damage hits 15% harder');
    assert.equal(await def(b), 1);
    // the host (A, the lower uid) picks whom its boss chases: B, a tank 70 px off, before A at 40 px
    await a.eval(() => window.__GRL.role(null)); await b.eval(() => window.__GRL.role('tank'));
    await settle(a, b);
    await until([a], () => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead), t = window.__GRL.target(m); return !!t && t.remote === 'gRlB2'; });
    await b.eval(() => window.__GRL.role('damage')); await settle(a, b);
    await until([a], () => window.__GRL.target(window.__G.mons().find((x) => x.type === 'gchief' && !x.dead)) === null);
    // a support near A takes 15% off A's damage
    await b.eval(() => window.__GRL.role('support')); await a.eval(() => window.__GRL.role('tank'));
    await settle(a, b);
    assert.equal(Math.round((await def(a)) * 1000), 595, 'tank and support: 0.7 x 0.85');
    // a healer heals the mate near it: B heals A
    await b.eval(() => window.__GRL.role('healer'));
    await a.eval(() => { window.__G.P.hp = 50; });
    for (let i = 0; i < 60 && !(await a.eval(() => window.__GRL.got() > 0)); i++) await settle(a, b); // both clocks run (B heals every 3 s)
    const got = await a.eval(() => window.__GRL.got());
    assert.ok(got >= 2, 'a heal of 5% from the healer: ' + got);
    // it stops when B is no healer any more
    await b.eval(() => window.__GRL.role('damage')); await settle(a, b);
    const g1 = await a.eval(() => window.__GRL.got());
    for (let i = 0; i < 5; i++) await settle(a, b);
    assert.equal(await a.eval(() => window.__GRL.got()), g1);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
