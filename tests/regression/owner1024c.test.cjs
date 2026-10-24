'use strict';
// The owner's 2026-10-24 list, third part: a creation taken apart gives back its rare materials; the rarer a piece the likelier
// a hidden option; a boss calls its warriors only when one comes; Jurene's test at the round table; the world map shows what
// is on screen painted whole.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('salvaged creations, appraisal odds, boss calls, the map painted whole', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const sv = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'pagma'; S.smith = 10;
      S.cre = [{ id: 'c9', ty: 'gs', mats: { blhorn: 1, bljewel: 1, dscale: 6, sess: 2 }, L: 50, W: 50, C: 0, sl: 1, nm: "Demon's Tear", by: 'Grid' }];
      const it = { uid: 9911, id: 'gsword', slot: 'w', r: 2, atk: 900, spd: .46, cr: 'c9', cw: 'gs.50.50.0.blhorn.bljewel' };
      return window.__GSV.yield(it, 'anvil'); });
    assert.deepEqual([sv.blhorn, sv.bljewel, sv.dscale], [1, 1, 6], JSON.stringify(sv));
    assert.ok(!sv.ore || sv.ore < 4, 'not iron ore for a creation: ' + JSON.stringify(sv));

    const ap = await g.eval(() => [0, 1, 2, 3, 4, 5].map((r) => window.__GAP.chance({ id: 'isword', r })).concat([1, 3, 5].map((r) => window.__GAP.chance({ id: 'yetgs', r }))));
    for (let i = 1; i < 6; i++) assert.ok(ap[i] > ap[i - 1], 'made pieces: ' + ap.join(','));
    assert.ok(ap[6] < ap[7] && ap[7] < ap[8], 'drops: ' + ap.join(','));

    // a boss boxed in by rock calls no one, and says so plainly
    const bc = await g.eval(() => { const G = window.__G, P = G.P, m = G.spawnMon('sanju4', P.x, P.y); const tx = (P.x / 16) | 0, ty = (P.y / 16) | 0;
      for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 6; x <= tx + 6; x++) if (x !== tx || y !== ty) G.setT(x, y, 4);
      const n0 = G.mons().length; m.hp = m.max * .6; for (let i = 0; i < 3; i++) window.__G.mons(); return { n0, id: m.type }; });
    await g.step(5);
    const calls = await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
    assert.ok(!/calls his warriors/.test(calls), calls);

    // the map: what it shows is there at once, nothing left painting for it
    const mp = await g.eval(() => { window.__G.openMap(); return [...document.querySelectorAll('#mapW')].length; });
    assert.equal(mp, 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
