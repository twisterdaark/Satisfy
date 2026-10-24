'use strict';
// The owner's 2026-10-24 morning list: the game-feel banners in the game's own type and out of the middle, a way out of the Abyss when the hydra falls, a way to the East Continent after the Archipelago, and the
// Tower of Wisdom's duty after its tests (daily tests, the week's watch, the library, Radwolf's workshop), and a gear
// picker that marks what you already wear in another slot.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('banners, hydra exit, the East scroll after the islands, the Tower duty', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    // the banner: the windows' type, near the top
    const ban = await g.eval(() => { const b = getComputedStyle(document.querySelector('#jban b')), e = document.getElementById('jban'), st = getComputedStyle(document.getElementById('jstk'));
      return { fam: b.fontFamily, top: parseFloat(getComputedStyle(e).top) / e.parentNode.clientHeight, stk: st.display }; });
    assert.ok(!/Lalezar/.test(ban.fam) || /^"?Tajawal|Oswald/.test(ban.fam), ban.fam);
    assert.ok(ban.top < .2, 'near the top: ' + ban.top);

    // a ring worn in another slot is marked in the ring picker, dimmed and last
    const rp = await g.eval(() => { const G = window.__G, S = G.S, a = G.eqx.mkItem('wring', 0), b = G.eqx.mkItem('wring', 0), c = G.eqx.mkItem('wring', 0); S.items.push(a, b, c);
      S.eq = S.eq || {}; S.eq.k1 = a.uid; S.eq.k2 = b.uid; G.eqx.openEquip(); G.openPick('k1');
      const rows = [...document.querySelectorAll('#eqPick [data-pick]')].map((e) => ({ u: +e.dataset.pick, o: e.classList.contains('eqo'), t: e.textContent }));
      document.getElementById('eqPick').hidden = true; G.eqx.closeEquip && G.eqx.closeEquip(); delete S.eq.k1; delete S.eq.k2;
      return { first: rows[0].u === a.uid, b: rows.find((r) => r.u === b.uid), c: rows.find((r) => r.u === c.uid), lastB: rows.filter((r) => r.u).pop().u === b.uid }; });
    assert.ok(rp.lastB, JSON.stringify(rp));
    assert.ok(rp.b.o && /another slot|خانة تانية/.test(rp.b.t), JSON.stringify(rp.b));
    assert.ok(!rp.c.o, JSON.stringify(rp.c));

    // the hydra falls in its chamber: a way straight out to the surface, as the other dungeon bosses leave
    const hy = await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'hydra'); if (!m) return null; const P = G.P; P.x = m.x - 30; P.y = m.y;
      window.__GBH.kill(m); const ex = window.__GTRK.gates().find((d) => d.exit && d.tmp && d.hint === 'hExitD'); return ex ? { up: ex.to.y < m.y - 1000 } : { none: 1 }; });
    assert.deepEqual(hy, { up: true });

    // the Archipelago done: the carriage store opens from the pier, with the portal scroll for points (Sticks gives one free)
    const ec = await g.eval(() => { const G = window.__G, S = G.S, b = window.__GBH.s(); b.best = 66; b.pur = 1; b.cp = 5000; S.mats.ecscr = 0;
      window.__GBH.ask(); const o1 = (G.DL.opts || []).map((x) => x.l);
      const shop = G.DL.opts.find((x) => /store|المتجر/.test(x.l)); shop.f(); const sc = G.DL.opts.find((x) => /Portal|بوابة/.test(x.l)); sc.f();
      return { o1, scroll: S.mats.ecscr, cp: b.cp }; });
    assert.ok(ec.o1.some((l) => /store|المتجر/.test(l)), JSON.stringify(ec.o1));
    assert.deepEqual([ec.scroll, ec.cp], [1, 4000]);

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
