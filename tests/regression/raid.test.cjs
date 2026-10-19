'use strict';
// SAT-ONLINE-009 (doc §10 R6): two tabs in a party fight the Goblin Chief. The member's hits land on the
// leader's boss, both see the same HP, it dies once, and each player gets the kill rewards once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 5000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
// the boss on this client: its key is the same everywhere, its level/max HP are rolled per client
const boss = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead); return m ? { hp: m.hp, max: m.max, key: m.type + '@' + (m.sx | 0) + ',' + (m.sy | 0) } : null; });

// Stand next to the boss (frozen, so it can't fight back), strong enough to finish it in a few swings.
async function atBoss(g, dx) {
  await g.eval((d) => {
    const G = window.__G, P = G.P, S = G.S, m = G.mons().find((x) => x.type === 'gchief' && !x.dead);
    m.stun = 1e9; m.x = m.sx; m.y = m.sy;
    for (const o of G.mons()) if (o !== m) { o.dead = true; o.rt = 1e9; }
    P.x = m.x - 12 + d; P.y = m.y; P.dir = 2; S.st.str = 30000; P.hp = 1e6; // the boss outlevels a new character
  }, dx);
}
// swing until a hit registers somewhere: on the host's boss for a member, on the own boss for the host
async function swing(g) {
  await g.eval(() => { const G = window.__G; G.P.acd = 0; G.tryAttack(1, 0); });
  await g.step(2);
}

test('party raid: one boss HP, one death, one reward each, nothing paid twice', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, LOOK_A);
    await H.newGame(b, LOOK_B);
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    // party: A leads
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    assert.equal((await a.eval(() => Satisfy.local.net().raid)).host, true);
    assert.equal((await b.eval(() => Satisfy.local.net().raid)).member, true);

    await atBoss(a, 0); await atBoss(b, -6);
    await settle(a, b);
    const a0 = await boss(a), b0 = await boss(b);
    assert.equal(a0.key, b0.key, 'the same boss on both clients');
    const before = await b.eval(() => ({ gold: window.__G.S.gold, xp: window.__G.S.xp, lv: window.__G.S.lv }));

    // B swings: its own copy keeps its HP, the leader's copy loses it
    await swing(b);
    await settle(a, b);
    const a1 = await boss(a), b1 = await boss(b);
    assert.ok(a1.hp < a0.hp, `the leader's boss took B's hit (${a0.hp} → ${a1.hp})`);
    await until(b, (share) => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead); return m && Math.abs(m.hp / m.max - share) < 0.01; }, 5000, a1.hp / a1.max);

    // A finishes it
    for (let i = 0; i < 30 && (await boss(a)); i++) { await swing(a); await settle(a, b); }
    assert.equal(await boss(a), null, 'dead on the leader');
    await until(b, () => !window.__G.mons().some((x) => x.type === 'gchief' && !x.dead), 5000);
    const after = await b.eval(() => ({ gold: window.__G.S.gold, xp: window.__G.S.xp, lv: window.__G.S.lv, done: window.__G.S.raidDone }));
    assert.ok(after.gold > before.gold || after.lv > before.lv || after.xp > before.xp, 'B got the kill rewards');
    assert.equal(after.done.length, 1, 'the encounter is recorded once');
    await settle(a, b);
    assert.equal((await b.eval(() => window.__G.S.raidDone)).length, 1);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
