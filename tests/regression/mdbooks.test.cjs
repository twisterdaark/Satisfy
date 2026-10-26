'use strict';
// Madra's diary (novel ch 692-701, owner 2026-10-23: "it gives the skills Grid learned from it, not just levels"): read
// chapter by chapter; chapter 2 holds the book of 100,000 Army Swordsmanship, chapter 7 the book of 200,000; the diary
// stays shut until each book is learned. The books are items, need Madra to know you, the second also level 399.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const close = async (g) => { for (let n = 0; n < 30 && (await g.mode()) !== 'play'; n++) { await g.eval(() => window.__G.advance()); await g.step(1); } };

test("the diary's chapters, its two swordsmanship books, the incomplete skills, and a slot's cooldown number", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, b = window.__GBH.s(); G.S.lv = 396; G.S.cls = 'warrior'; b.pur = 0; G.S.mats.bk_mdiary = 1; window.__GFB.use('bk_mdiary'); return { lv: G.S.lv, ma1: G.S.mats.bk_ma1, ch: b.mdch, diary: G.S.mats.bk_mdiary }; });
    assert.deepEqual(a, { lv: 399, ma1: 1, ch: 2, diary: 1 }, 'chapter 1-2: three levels and the first book; the diary stays');
    await close(g);
    const b = await g.eval(() => { const G = window.__G, b = window.__GBH.s(), F = window.__GFB; F.use('bk_mdiary'); const shut = b.mdch; F.use('bk_ma1'); const unknown = !!(b.sb && b.sb.ma1); b.pur = 1; F.use('bk_ma1');
      return { shut, unknown, learned: b.sb.ma1, left: G.S.mats.bk_ma1, sk: window.__GC2.cls().filter((k) => /^ma/.test(k)) }; });
    await close(g);
    assert.equal(b.shut, 2, 'the diary is shut until the book is learned'); assert.equal(b.unknown, false, 'Madra must know you');
    assert.equal(b.learned, 1); assert.equal(b.left, 0); assert.deepEqual(b.sk.sort(), ['mablock', 'mamass']);
    const c = await g.eval(() => { const G = window.__G, b = window.__GBH.s(), F = window.__GFB; F.use('bk_mdiary'); return { ch: b.mdch, ma2: G.S.mats.bk_ma2 }; });
    await close(g);
    assert.deepEqual(c, { ch: 7, ma2: 1 });
    const d = await g.eval(() => { const G = window.__G, b = window.__GBH.s(), F = window.__GFB; G.S.lv = 398; F.use('bk_ma2'); const low = !!b.sb.ma2; G.S.lv = 399; F.use('bk_ma2'); F.use('bk_mdiary'); return { low, ma2: b.sb.ma2, ch: b.mdch, diary: G.S.mats.bk_mdiary, sk: window.__GC2.cls().filter((k) => /^ma/.test(k)) }; });
    await close(g);
    assert.equal(d.low, false, 'level 399 for the second'); assert.deepEqual([d.ma2, d.ch, d.diary], [1, 8, 0], 'chapter 8 ends the diary');
    assert.deepEqual(d.sk.sort(), ['mablock', 'macrush', 'mamass']);
    // the Undefeated King's Descendant keeps his own Blockade and 200,000
    assert.deepEqual(await g.eval(() => { window.__G.S.cls = 'madra'; const r = window.__GC2.cls().filter((k) => /^ma/.test(k)); window.__G.S.cls = 'warrior'; return r; }), ['mamass']);
    // Crushing breaks an attack being readied; the recoil is 10% + 10% for each one broken
    const e = await g.eval(() => { const G = window.__G, P = G.P; G.mons().forEach((m) => { m.dead = true; }); P.dir = 2; P.hp = window.__G.eqx ? P.hp : P.hp; const m = G.spawnMon('wolf', P.x + 40, P.y); m.max = m.hp = 1e9; m.st = 'tele'; m.mv = { k: 'arc' }; m.tele = 1;
      const h0 = P.hp; window.__GFB.sk('macrush'); window.__mdM = m; return { st: m.st, lost: h0 - P.hp, h0 }; });
    await g.step(30);   /* the cuts land a moment later (setTimeout) */
    e.dmg = await g.eval(() => 1e9 - window.__mdM.hp);
    assert.equal(e.st, null); assert.ok(e.dmg > 0, JSON.stringify(e)); assert.ok(e.lost > 0, 'the recoil: ' + JSON.stringify(e));
    const bl = await g.eval(() => { const G = window.__G, P = G.P; G.mons().forEach((m) => { m.dead = true; }); const m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e9; window.__GFB.sk('mablock'); return m.stun; });
    assert.ok(bl >= 3, 'blockaded 3 s');
    // the old diary read before (levels only) comes back at chapter 2 with the first book
    const mg = await g.eval(() => { const G = window.__G, b = window.__GBH.s(); b.mdch = 0; b.mdread = 1; G.S.mats.bk_mdiary = 0; G.S.mats.bk_ma1 = 0; const b2 = window.__GBH.s(); return [b2.mdch, G.S.mats.bk_mdiary, G.S.mats.bk_ma1]; });
    assert.deepEqual(mg, [2, 1, 1]);
    // a slot waiting on its cooldown shows the time left
    const at = async (v) => { await g.eval((v) => { window.__G.P.cd.mamass = v; window.__G.P.mp = 1e6; }, v); await g.step(2); return g.eval(() => document.querySelector('#skillbar [data-sk="0"]').dataset.cd); };
    await g.eval(() => { window.__G.S.bar = ['mamass', null, null, null, null, null]; });
    const cd = [await at(245.9), await at(4.25), (await at(0)) === undefined];
    assert.deepEqual(cd, ['4:05', '4.2', true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
