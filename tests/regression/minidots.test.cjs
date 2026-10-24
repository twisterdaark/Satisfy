'use strict';
// U253 MiniMap player dots (SAT-ONLINE-207; plan: "interest-filtered teammate/enemy/ally dots", checked by "no hidden player
// is shown without a reveal"): the HUD map marks your party (green), your guild (blue), an allied guild (pale blue) and
// foes (an outlaw, a guild at war with yours: a red diamond); nobody else gets a dot, and a player in stealth gets none
// unless they are in your party; when the stealth ends the dot is back.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
// the player dots of the HUD map's next draw (it draws 5 times a second; the player arrow comes last)
async function dots(g) {
  await g.eval(() => {
    const M = window.SatArt.minimap, mine = (gg) => gg && gg.canvas && gg.canvas.id === 'mini';
    if (!window.__MKI) {
      window.__MKI = 1; window.__MK = [];
      const o = M.marker, p = M.player;
      M.marker = function (gg, k) { if (mine(gg) && ['ally', 'guild', 'gally', 'foe'].includes(k)) window.__MK.push(k); return o.apply(this, arguments); };
      M.player = function (gg) { if (mine(gg)) { window.__MKL = window.__MK.slice().sort(); window.__MK = []; } return p.apply(this, arguments); };
    }
    window.__MKL = null; window.__MK = [];
  });
  for (let i = 0; i < 3; i++) { await g.step(14); if (await g.eval(() => window.__MKL)) break; }
  return g.eval(() => window.__MKL);
}

test('party, foes; no dot for a neutral player or one in stealth (a party mate still shows)', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    const d = await H.openGame({ ctx, query: '?net=local&slot=d' });
    const all = [a, b, c, d];
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Mate', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Rogue', hair: 2, hc: 1, skin: 0, top: 2 });
    await H.newGame(d, { n: 'Walker', hair: 4, hc: 3, skin: 1, top: 0 });
    // all on the plains west of Winston, a few tiles apart
    for (const [g, dx] of [[a, 0], [b, 30], [c, 60], [d, 90]]) await g.eval((x) => { const G = window.__G; G.P.inv = 1e9; G.P.x = 90 * 16 + x; G.P.y = 60 * 16; }, dx);
    await settle(...all);
    // what the HUD map marks with no player dots yet (a companion is drawn as an ally too): counted out below
    await until(a, () => Satisfy.local.net().remotes.length === 3);
    const base = await dots(a), mine = async () => { const d = await dots(a), out = [...d]; for (const k of base) { const i = out.indexOf(k); if (i >= 0) out.splice(i, 1); } return out; };
    // B joins A's party
    await b.eval(() => { window.__G.P.x = 90 * 16 + 20; }); await settle(...all);
    await a.page.keyboard.press('KeyP'); await settle(...all);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(...all);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    await until(a, () => Satisfy.local.net().remotes.length === 3);
    // C is an outlaw; D is nobody to A
    await c.eval(() => { window.__G.S.olT = Date.now() + 600000; window.__G.S.karma = -1; });
    await settle(...all); await settle(...all);
    assert.deepEqual(await mine(), ['ally', 'foe'], 'the mate green, the outlaw red, nobody for the neutral one');
    // the outlaw and the mate go into stealth: the outlaw's dot goes, the mate's stays
    for (const g of [b, c]) await g.eval(() => { window.__G.P.stl = 1e9; });
    await settle(...all); await settle(...all);
    assert.deepEqual(await mine(), ['ally'], 'no dot for a hidden foe; your mate still shows');
    // the stealth ends: back
    await c.eval(() => { window.__G.P.stl = 0; });
    await settle(...all); await settle(...all);
    assert.deepEqual(await mine(), ['ally', 'foe']);
    // the outlaw mark ends: no dot (a neutral player)
    await c.eval(() => { window.__G.S.olT = 0; });
    await settle(...all); await settle(...all);
    assert.deepEqual(await mine(), ['ally']);
    for (const g of all) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
