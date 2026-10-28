'use strict';
// v3.04 the crafts' tools (the player Suki through the owner 2026-10-25: "make smith's be able to buy hammers, each one
// helps you smith better, same principal with spatulas for cooking. You can now buy a new item "portable stove" from any
// town inn. Allows you to place down a stove and cook wherever you may be (Except dungeons or important quest areas)"):
//   - Khan sells forge hammers once you have had his lessons, the better ones from a Smithing level; each widens the anvil's
//     good and perfect parts;
//   - every inn sells spatulas (from a Cooking level: the pot's golden part wider, the pot slower) and one portable stove;
//   - the stove goes down where you stand, cooks like a campfire (E), comes back to the bag when you walk off, and never
//     goes down under the map, on water, beside a living boss or in the story's places.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test("the crafts' tools: Khan's hammers, the inns' spatulas and stove, and where a stove may go", async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, C = window.__GCK, S = G.S, o = {};
      o.noLessons = C.ham('khan').length;
      S.qs.kh1 = { st: 2 }; S.smith = 1; S.gold = 1000;
      o.ham = C.ham('khan').map((x) => [x.ic, !!x.poor]);
      const z0 = C.zone();
      C.buy('khan', 'smh', 2); o.lowSm = S.smh | 0;
      C.buy('khan', 'smh', 1); o.smh = S.smh; o.gold1 = S.gold;
      const z1 = C.zone(); o.zr = [z1.p / z0.p, z1.g / z0.g];
      o.hamAfter = C.ham('khan').map((x) => x.ic);
      // the inn
      S.gold = 50000; S.life = {};
      o.inn = C.inn('innP').map((x) => [x.ic, !!x.poor]);
      const c0 = C.cook('cfish');
      C.buy('innP', 'spt', 3); o.lowCk = S.spt | 0;
      C.buy('innP', 'spt', 1); o.spt = S.spt;
      const c1 = C.cook('cfish'); o.cr = [c1.w / c0.w, c1.dur / c0.dur];
      // the inn's own menu: one line opening its cooking tools
      o.innLine = C.innOpt('innP').map((x) => x.l);
      C.buy('innP', 'stove'); o.stove = S.mats.pstove; o.innAfter = C.inn('innP').map((x) => x.ic);
      C.buy('innP', 'stove'); o.oneStove = S.mats.pstove;
      // a stove in the stash is still yours: no second; and it can't be traded
      S.mats.pstove = 0; G.S.stash = [{ k: 'pstove', n: 1 }]; o.stashOne = [C.hasStove(), C.inn('innP').some((x) => x.ic === 'pstove')]; G.S.stash = []; S.mats.pstove = 1;
      o.trade = C.trOk('pstove');
      // other inns sell them too
      o.innT = C.inn('innT').map((x) => x.ic);
      // where it may go
      const w = window.__GFS.water();
      o.why = { under: C.why(G.P.x, 300 * 16), water: w ? C.why(w[0], w[1] + 16) : 'none', grave: C.why(...(() => { for (let y = -60; y < 0; y++) for (let x = 0; x < 900; x++) if (G.zoneAt(x * 16 + 8, y * 16 + 8) === 'zSwordG') return [x * 16 + 8, y * 16 + 8]; return [0, -9999]; })()) };
      return o;
    });
    assert.equal(r.noLessons, 0, 'no hammers before his lessons');
    assert.deepEqual(r.ham, [['ckham1', false], ['ckham2', true], ['ckham3', true]]);
    assert.equal(r.lowSm, 0, 'no Steel hammer at Smithing 1');
    assert.equal(r.smh, 1); assert.ok(r.gold1 < 1000 && r.gold1 >= 1000 - 800, String(r.gold1));
    assert.ok(Math.abs(r.zr[0] - 1.1) < 1e-9 && Math.abs(r.zr[1] - 1.1) < 1e-9, 'the Iron hammer: both parts 10% wider ' + r.zr);
    assert.deepEqual(r.hamAfter, ['ckham2', 'ckham3']);
    assert.deepEqual(r.inn, [['ckspt1', false], ['ckspt2', true], ['ckspt3', true], ['pstove', false]]);
    assert.equal(r.lowCk, 0, 'no Mithril spatula at Cooking 1');
    assert.equal(r.spt, 1);
    assert.ok(Math.abs(r.cr[0] - 1.1) < 1e-9, 'the Wooden spatula: the golden part 10% wider ' + r.cr);
    assert.ok(Math.abs(r.cr[1] - 1.05) < 1e-9, 'and the pot 5% slower ' + r.cr);
    assert.deepEqual(r.innLine, ['🍳 Cooking tools']);
    assert.equal(r.stove, 1); assert.deepEqual(r.innAfter, ['ckspt2', 'ckspt3'], 'one stove: no second for sale');
    assert.equal(r.oneStove, 1); assert.deepEqual(r.stashOne, [true, false], 'the stashed stove counts'); assert.equal(r.trade, false, 'no trading the stove');
    assert.deepEqual(r.innT, ['ckspt2', 'ckspt3']);
    assert.deepEqual(r.why, { under: 'ckNoHere', water: 'ckNoTile', grave: 'ckNoHere' });

    // set it down, cook at it with E, walk off
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode) !== 'play'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); }
    await g.page.keyboard.press('KeyI'); await g.step(3);
    const i0 = await g.eval(() => window.__G.bag().INVS.findIndex((s) => s.k === 'pstove'));
    assert.ok(i0 >= 0, 'the stove is in the bag: ' + JSON.stringify(await g.eval(() => ({ m: window.__G.mode, k: window.__G.bag().INVS.map((s) => s.k), st: window.__G.S.mats.pstove }))));
    assert.match(await g.eval((i) => window.__G.bag().INVS[i].tip, i0), /Click: set it down here/);
    await g.eval((i) => window.__G.bag().invClick(i), i0); await g.step(2);
    const st = await g.eval(() => window.__GCK.ST);
    assert.ok(st, 'set down');
    const i1 = await g.eval(() => window.__G.bag().INVS.findIndex((s) => s.k === 'pstove'));
    assert.equal(await g.eval((i) => window.__G.bag().INVS[i].hook, i1), true, 'marked in the bag while it is down');
    await g.page.keyboard.press('KeyI'); await g.step(3);
    await g.eval((s) => { const P = window.__G.P; P.x = s.x; P.y = s.y - 8; }, st); await g.step(3);
    await g.page.keyboard.press('KeyE'); await g.step(3);
    assert.equal(await g.eval(() => window.__G.DL && window.__G.DL.who), 'pstove', 'E at the stove: its cooking menu');
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode) !== 'play'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); }
    // a monster that fights back close by: no cooking (cooking stops the world)
    const foe = await g.eval(() => { const G = window.__G, P = G.P, m = window.__GTRK.mons().find((x) => x.hp > 0 && window.__GCK.aggr(x.type)); if (!m) return null; const o = [m.x, m.y]; m.x = P.x + 40; m.y = P.y; return o; });
    if (foe) {
      assert.equal(await g.eval(() => window.__GCK.foe()), true);
      await g.page.keyboard.press('KeyE'); await g.step(2);
      assert.notEqual(await g.eval(() => window.__G.mode), 'dialog', 'refused with a monster near');
      await g.eval((o) => { const m = window.__GTRK.mons().find((x) => Math.hypot(x.x - window.__G.P.x - 40, x.y - window.__G.P.y) < 1); if (m) { m.x = o[0]; m.y = o[1]; } }, foe);
    }
    await g.eval(() => { window.__G.P.x += 30 * 16; }); await g.step(3);
    assert.equal(await g.eval(() => window.__GCK.ST), null, 'walked off: back in the bag');
    assert.equal(await g.eval(() => window.__G.S.mats.pstove), 1);
    // the status shows the hammer and the spatula
    await g.page.keyboard.press('KeyC'); await g.step(3);
    const stt = await g.eval(() => [...document.querySelectorAll('.srow')].map((e) => e.textContent).join('|'));
    assert.match(stt, /Forge hammer\s*Iron Forge Hammer/, stt); assert.match(stt, /Spatula\s*Wooden Spatula/);
    // death takes it back too
    await g.page.keyboard.press('Escape'); await g.step(2);
    await g.eval(() => { window.__GCK.ST = { x: window.__G.P.x, y: window.__G.P.y + 6 }; window.__G.die(); });
    assert.equal(await g.eval(() => window.__GCK.ST), null, 'death: back in the bag');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
