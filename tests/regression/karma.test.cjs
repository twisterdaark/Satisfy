'use strict';
// SAT-ONLINE-052 (Claude-B #13 item 23): karma. Killing a player who is not an outlaw costs a point and, below -1, a longer red name;
// at -5 you are a murderer (ol 2, a darker red for everyone); killing an outlaw is justice: a point back, no red name.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const place = (g, dx) => g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 0; if (window.__GPVP) window.__GPVP.end(); /* the spawn shield (SAT-ONLINE-142) is its own test */ for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
async function kill(a, b) {
  const uid = await b.eval(() => Satisfy.local.net().uid);
  await b.eval(() => { const G = window.__G; G.P.hp = 1; G.S.tl = G.S.tl || {}; G.S.tl.legend = false; });
  for (let i = 0; i < 4 && (await b.eval(() => window.__G.mode)) !== 'dead'; i++) {
    await a.eval(() => { window.__G.P.acd = 0; });
    const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
    await a.page.mouse.click(p.x, p.y); await a.step(1); await settle(a, b);
  }
  assert.equal(await b.eval(() => window.__G.mode), 'dead', 'the kill');
  await settle(a, b); await settle(a, b);
}
const olOf = (g, other) => g.eval((u) => (Satisfy.local.net().remotes.find((x) => x.uid === u) || {}).ol || 0, other);

test('karma: a murder costs a point and lengthens the red name; at -5 a murderer; killing an outlaw is justice', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const ua = await a.eval(() => Satisfy.local.net().uid), ub = await b.eval(() => Satisfy.local.net().uid);
    await place(a, 0); await place(b, 18); await settle(a, b); await settle(a, b);

    // A kills B, who is no outlaw: karma -1, red for the usual 10 minutes
    await kill(a, b);
    assert.equal(await a.eval(() => window.__GK.karma()), -1);
    const left = await a.eval(() => window.__G.S.olT - Date.now());
    assert.ok(left > 9 * 60000 && left <= 10 * 60000, 'red for 10 minutes: ' + left);
    for (let i = 0; i < 10 && (await olOf(b, ua)) !== 1; i++) await settle(a, b);
    assert.equal(await olOf(b, ua), 1, 'B sees A as an outlaw');

    // B comes back and kills A, the outlaw: justice, +1, and B stays clean
    await b.eval(() => window.__GK.respawn()); await place(b, 18); await place(a, 0); await settle(a, b);
    await kill(b, a);
    assert.equal(await b.eval(() => window.__GK.karma()), 1, 'justice');
    assert.equal(await b.eval(() => !!(window.__G.S.olT && window.__G.S.olT > Date.now())), false, 'no red name for killing an outlaw');

    // A, already at -4, kills B again: -5, a murderer for everyone
    await a.eval(() => { window.__GK.respawn(); window.__GK.set(-4); }); await place(a, 0); await place(b, 18); await settle(a, b);
    await kill(a, b);
    assert.equal(await a.eval(() => window.__GK.karma()), -5);
    assert.equal(await a.eval(() => window.__GK.ol()), 2);
    for (let i = 0; i < 10 && (await olOf(b, ua)) !== 2; i++) await settle(a, b);
    assert.equal(await olOf(b, ua), 2, 'B sees a murderer');
    const left2 = await a.eval(() => window.__G.S.olT - Date.now());
    assert.ok(left2 > 29 * 60000 && left2 <= 30 * 60000, 'red for 30 minutes at -5: ' + left2);
    assert.ok(ub);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
