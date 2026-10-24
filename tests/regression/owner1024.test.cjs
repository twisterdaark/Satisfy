'use strict';
// The owner's 2026-10-24 morning list: the game-feel banners in the game's own type and out of the middle (the kill counter
// at the side gone), a way out of the Abyss when the hydra falls, a way to the East Continent after the Archipelago, and the
// Tower of Wisdom's duty after its tests (daily tests, the week's watch, the library, Radwolf's workshop).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('banners, hydra exit, the East scroll after the islands, the Tower duty', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    // the banner: the windows' type, near the top; the counter at the side never shows
    const ban = await g.eval(() => { const b = getComputedStyle(document.querySelector('#jban b')), e = document.getElementById('jban'), st = getComputedStyle(document.getElementById('jstk'));
      return { fam: b.fontFamily, top: parseFloat(getComputedStyle(e).top) / e.parentNode.clientHeight, stk: st.display }; });
    assert.ok(!/Lalezar/.test(ban.fam) || /^"?Tajawal|Oswald/.test(ban.fam), ban.fam);
    assert.ok(ban.top < .2, 'near the top: ' + ban.top);
    assert.equal(ban.stk, 'none');

    // the hydra falls in its chamber: a way straight out to the surface, as the other dungeon bosses leave
    const hy = await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'hydra'); if (!m) return null; const P = G.P; P.x = m.x - 30; P.y = m.y;
      window.__GBH.kill(m); const ex = window.__GTRK.gates().find((d) => d.exit && d.tmp && d.hint === 'hExitD'); return ex ? { up: ex.to.y < m.y - 1000 } : { none: 1 }; });
    assert.deepEqual(hy, { up: true });

    // the Archipelago done: the carriage store opens from the pier, and the scroll sells for gold too
    const ec = await g.eval(() => { const G = window.__G, S = G.S, b = window.__GBH.s(); b.best = 66; b.pur = 1; b.cp = 0; S.gold = 300000; S.mats.ecscr = 0;
      window.__GBH.ask(); const o1 = (G.DL.opts || []).map((x) => x.l);
      const shop = G.DL.opts.find((x) => /store|المتجر/.test(x.l)); shop.f(); const gold = G.DL.opts.find((x) => /gold|دهب/.test(x.l) && /Portal|بوابة/.test(x.l)); gold.f();
      return { o1, scroll: S.mats.ecscr, gold: S.gold }; });
    assert.ok(ec.o1.some((l) => /store|المتجر/.test(l)), JSON.stringify(ec.o1));
    assert.deepEqual([ec.scroll, ec.gold], [1, 150000]);

    // the Tower after its tests: a daily test pays marks once a day; the week's watch counts kills near your level
    const tw = await g.eval(() => { const G = window.__G, S = G.S, T = window.__GTWD; S.lv = 420; S.wis = { done: { ken: 1, jessica: 1 }, pill: 2, basic: 1, map: 1 };
      T.day('ken'); T.day('ken'); const wm1 = S.wis.wm; T.day('jessica');
      const W = T.wk(); W.on = 1; for (let i = 0; i < 70; i++) T.kill({ lv: 410, type: 'wolf' }); T.kill({ lv: 100, type: 'wolf' });
      return { wm1, wm2: S.wis.wm, n: W.n, need: W.need }; });
    assert.deepEqual([tw.wm1, tw.wm2], [3, 6]);
    assert.equal(tw.n, tw.need);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
