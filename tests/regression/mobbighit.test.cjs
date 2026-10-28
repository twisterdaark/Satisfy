'use strict';
// SAT-ONLINE-214 (owner 2026-10-25: "monsters stay at 1 HP for me and higher for the others, so you can't kill them: the
// demons, the vampire city, most bosses"). A follower's hits reached the host capped at 1,000,000 a hit and a read, so a
// Lv 400+ player hitting for millions took a 60,000,000 HP boss to 1 on their own screen while the host's copy (the one
// everyone sees) lost a sixth of it. Now a hit can do up to the monster's whole health: both screens show the same health
// and the follower's hits kill it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
const boss = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); return m && { x: m.x, y: m.y, dead: !!m.dead, led: !!m.led, hp: m.hp, max: m.max }; });
async function until(gs, fn, n = 120) { for (let i = 0; i < n; i++) { if (await fn()) return true; await frames(gs, 1); } return false; }

test('a follower hitting for millions: the host loses the same health, both screens agree, the follower kills it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gBhA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gBhB2', 'Bassem'); // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const d0 = await boss(a);
    assert.ok(d0 && !d0.dead, 'Trauka is up');
    await a.eval((d) => { const G = window.__G; G.P.x = d.x - 120; G.P.y = d.y + 10; G.P.inv = 1e9; }, d0);
    await b.eval((d) => { const G = window.__G; G.P.x = d.x - 60; G.P.y = d.y + 10; G.P.inv = 1e9; }, d0);
    await frames([a, b], 60);
    assert.equal(await a.eval(() => window.__GM.host), 'gBhA1', 'A hosts');
    // a late-game boss: 60,000,000 health on the host's copy
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.max = 6e7; m.hp = 6e7; });
    assert.ok(await until([a, b], async () => { const x = await boss(b); return x.led && x.max === 6e7; }), "B's copy takes the host's health");
    // B hits it four times for 5,000,000 each (as a Lv 480 does)
    for (let i = 0; i < 4; i++) { await b.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.hp -= 5e6; window.__GM.hit(m, 5e6); }); await frames([a, b], 3); }
    assert.ok(await until([a, b], async () => (await boss(a)).hp <= 4e7 + 1), 'the host lost the 20,000,000: ' + (await boss(a)).hp);
    await frames([a, b], 30);
    const ha = (await boss(a)).hp, hb = (await boss(b)).hp;
    assert.ok(Math.abs(ha - hb) <= 6e7 / 1000 + 1, 'the same health on both screens (to the shared list\'s 0.1%): ' + ha + ' / ' + hb);
    assert.ok(hb > 1, 'not stuck at 1 on the follower: ' + hb);
    // B finishes it: 8 more hits; it dies on both
    for (let i = 0; i < 8; i++) { await b.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); if (!m.dead) { m.hp -= 5e6; window.__GM.hit(m, 5e6); } }); await frames([a, b], 3); }
    assert.ok(await until([a, b], async () => (await boss(a)).dead && (await boss(b)).dead), 'dead on both screens');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
