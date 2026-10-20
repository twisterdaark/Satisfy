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

test('skill books for anyone; the Lightning Swordsman book changes the class; a second class book is refused without paying', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, F = window.__GFB, C = window.__GC2; G.S.lv = 30; window.__GBH.s().cp = 5000; const o = F.opts(); const before = C.cls().includes('sbdash');
      o.find((x) => /Dash to Turn the Tables/.test(x.l)).f(); return { n: o.length, before, after: C.cls().includes('sbdash'), cp: window.__GBH.s().cp, again: F.opts().some((x) => /Dash to Turn/.test(x.l)) }; });
    assert.deepEqual([a.before, a.after, a.cp, a.again], [false, true, 4600, false], JSON.stringify(a));
    const d = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; P.dir = 2; const x0 = P.x; const m = G.spawnMon('wolf', P.x + 80, P.y); m.max = m.hp = 1e9; m.lv = 90; const h = m.hp; F.sk('sbdash'); return { dmg: h - m.hp, moved: P.x - x0, stun: m.stun > 0 }; });
    assert.ok(d.dmg > 0 && d.moved > 40 && d.stun, JSON.stringify(d));
    await g.eval(() => window.__GFB.opts().find((x) => /Blazing Short Rain/.test(x.l)).f());
    const r = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; const m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e9; m.stun = 99; const h = m.hp; F.sk('sbrain'); for (let i = 0; i < 40; i++) F.tick(0.1); return { dmg: h - m.hp, left: F.FOGB.rains.length }; });
    assert.ok(r.dmg > 0 && r.left === 0, 'three seconds of fire: ' + JSON.stringify(r));
    // the class book
    await g.eval(() => window.__GFB.book('lsword'));
    await pick(g, 0);
    const c = await g.eval(() => ({ cls: window.__G.S.cls, cp: window.__GBH.s().cp, sk: window.__GC2.cls() }));
    assert.equal(c.cls, 'lsword'); assert.equal(c.cp, 2700); assert.ok(c.sk.includes('lsslash') && c.sk.includes('sbdash'), JSON.stringify(c));
    const l = await g.eval(() => { const G = window.__G, F = window.__GFB, P = G.P; G.mons().forEach((m) => { m.dead = true; }); P.dir = 2; const ms = [0, 1, 2].map((i) => { const m = G.spawnMon('wolf', P.x + 18 + i * 20, P.y); m.max = m.hp = 1e9; return m; }); F.sk('lsslash'); return ms.map((m) => 1e9 - m.hp); });
    assert.ok(l.every((x) => x > 0), 'the lightning leaps to the others: ' + JSON.stringify(l));
    const n = await g.eval(() => { const G = window.__G, F = window.__GFB; F.book('esorc'); const who = G.DL && G.DL.who; return { who, cp: window.__GBH.s().cp }; });
    assert.equal(n.cp, 2700, 'one hidden class per character');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Explosion Sorcerer: a blast where you point, the rune that bursts later, Chain Detonation', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 30; window.__GBH.s().cp = 1000; window.__GFB.book('esorc'); });
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
