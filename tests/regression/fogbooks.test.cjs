'use strict';
// Fog Island's books (novel ch 362/401): the pumpkin carriage sells two rare class change books (Lightning Swordsman,
// Explosion Sorcerer: hidden class rules, one per character) and two skill books anyone can learn (Dash to Turn the
// Tables, Blazing Short Rain), all for Challenger Points.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function pick(g, i) {
  for (let n = 0; n < 6 && !(await g.eval(() => !!(window.__G.DL && window.__G.DL.optOn))); n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
  await g.eval((i) => window.__G.pickOpt(i), i);
  for (let n = 0; n < 6 && (await g.mode()) !== 'play'; n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
}

// owner 2026-10-23: the books are bought into the bag with no condition, read from it, and kept (to sell or give) when they don't fit
test('skill books for anyone, bought into the bag and read from it; the Lightning Swordsman book changes the class; a second class book is refused and kept', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, F = window.__GFB, C = window.__GC2; G.S.lv = 30; window.__GBH.s().cp = 5000; const o = F.opts(); const before = C.cls().includes('sbdash');
      o.find((x) => /Dash to Turn the Tables/.test(x.l)).f(); const bought = C.cls().includes('sbdash'), bag = G.S.mats.bk_sbdash; F.use('bk_sbdash');
      return { n: o.length, before, bought, bag, after: C.cls().includes('sbdash'), left: G.S.mats.bk_sbdash, cp: window.__GBH.s().cp, again: F.opts().some((x) => /Dash to Turn/.test(x.l)) }; });
    assert.deepEqual([a.before, a.bought, a.bag, a.after, a.left, a.cp, a.again], [false, false, 1, true, 0, 4600, true], JSON.stringify(a));
    const k2 = await g.eval(() => { const G = window.__G, F = window.__GFB; G.S.mats.bk_sbdash = 1; F.use('bk_sbdash'); return G.S.mats.bk_sbdash; });
    assert.equal(k2, 1, 'a book read before stays in the bag');
    const d = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; P.dir = 2; const x0 = P.x; const m = G.spawnMon('wolf', P.x + 80, P.y); m.max = m.hp = 1e9; m.lv = 90; const h = m.hp; F.sk('sbdash'); return { dmg: h - m.hp, moved: P.x - x0, stun: m.stun > 0 }; });
    assert.ok(d.dmg > 0 && d.moved > 40 && d.stun, JSON.stringify(d));
    await g.eval(() => { window.__GFB.opts().find((x) => /Blazing Short Rain/.test(x.l)).f(); window.__GFB.use('bk_sbrain'); });
    const r = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; const m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e9; m.stun = 99; const h = m.hp; F.sk('sbrain'); for (let i = 0; i < 40; i++) F.tick(0.1); return { dmg: h - m.hp, left: F.FOGB.rains.length }; });
    assert.ok(r.dmg > 0 && r.left === 0, 'three seconds of fire: ' + JSON.stringify(r));
    // the class book
    await g.eval(() => { window.__GFB.opts().find((x) => /Lightning Swordsman/.test(x.l)).f(); window.__GFB.use('bk_lsword'); });
    await pick(g, 0);
    const c = await g.eval(() => ({ cls: window.__G.S.cls, cp: window.__GBH.s().cp, sk: window.__GC2.cls() }));
    assert.equal(c.cls, 'lsword'); assert.equal(c.cp, 2700); assert.ok(c.sk.includes('lsslash') && c.sk.includes('sbdash'), JSON.stringify(c));
    const l = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; G.mons().forEach((m) => { m.dead = true; }); P.dir = 2; const ms = [0, 1, 2].map((i) => { const m = G.spawnMon('wolf', P.x + 18 + i * 20, P.y); m.max = m.hp = 1e9; return m; }); F.sk('lsslash'); return ms.map((m) => 1e9 - m.hp); });
    assert.ok(l.every((x) => x > 0), 'the lightning leaps to the others: ' + JSON.stringify(l));
    const n = await g.eval(() => { const G = window.__G, F = window.__GFB; G.DL = null; F.opts().find((x) => /Explosion Sorcerer/.test(x.l)).f(); F.use('bk_esorc'); return { cls: G.S.cls, cp: window.__GBH.s().cp, bag: G.S.mats.bk_esorc }; });
    assert.deepEqual(n, { cls: 'lsword', cp: 1700, bag: 1 }, 'one hidden class per character; the book stays in the bag');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Explosion Sorcerer: a blast where you point, the rune that bursts later, Chain Detonation', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 30; window.__GBH.s().cp = 1000; window.__GFB.opts().find((x) => /Explosion Sorcerer/.test(x.l)).f(); window.__GFB.use('bk_esorc'); });
    await pick(g, 0);
    const c = await g.eval(() => ({ cls: window.__G.S.cls, cp: window.__GBH.s().cp }));
    assert.deepEqual(c, { cls: 'esorc', cp: 0 });
    const b = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; P.dir = 2; const m = G.spawnMon('wolf', P.x + 2, P.y + 2); m.max = m.hp = 1e9; m.stun = 99;
      F.sk('esrune'); const h0 = m.hp; F.tick(1); const early = h0 - m.hp; F.tick(1.2); return { early, late: h0 - m.hp }; });
    assert.equal(b.early, 0); assert.ok(b.late > 0, 'the rune bursts after two seconds: ' + JSON.stringify(b));
    const k = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; const a = G.spawnMon('wolf', P.x + 20, P.y); a.hp = 1; a.stun = 99; const b = G.spawnMon('wolf', P.x + 40, P.y); b.max = b.hp = 1e9; b.stun = 99;
      F.hit(a, { skill: 1 }); const h = b.hp; for (let i = 0; i < 5; i++) F.tick(0.05); return { dead: a.dead, chain: h - b.hp }; });
    assert.ok(k.dead && k.chain > 0, 'a monster killed by a skill explodes: ' + JSON.stringify(k));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-23: "I bought Madra's diary and can't find it in my bag or my skills"
test("Madra's diary goes in the bag and raises you three levels when first read; one bought before is handed over", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, B = window.__GBH, F = window.__GFB; S.lv = 100; const b = B.s(); b.diary = 1; delete S.mats.bk_mdiary;
      const old = (B.s(), S.mats.bk_mdiary); const lv0 = S.lv; F.use('bk_mdiary'); const after = { lv: S.lv - lv0, left: S.mats.bk_mdiary, ma1: S.mats.bk_ma1 };
      F.use('bk_mdiary'); return { old, after, again: S.mats.bk_mdiary }; });
    assert.equal(r.old, 1, 'the diary bought before is in the bag');
    assert.deepEqual(r.after, { lv: 3, left: 1, ma1: 1 }, 'read: three levels at once, the first swordsmanship book, and the diary kept for its next chapters');
    assert.equal(r.again, 1, 'shut until the book is learned, and still yours');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
