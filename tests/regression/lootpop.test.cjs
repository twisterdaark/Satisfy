'use strict';
// Loot pops (SAT-ONLINE-185; owner 2026-10-24: "improve the visuals ... add dopamine"): what a kill gives jumps out of it as
// its icon, bounces and flies into you. Only drawn:
//   - a kill's materials and items pop (XP and gold don't: they have their own), at most 8 a kill, 2 with Reduced motion;
//   - they reach the player and are gone within a few seconds; the bag is what it was without them;
//   - they take nothing from the game's random numbers (the same next number as on a page without them).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const pop = (g, keys) => g.eval((keys) => { const G = window.__G, P = G.P, L = window.__GLP; L.src({ x: P.x + 60, y: P.y + 10 }); for (const k of keys) L.add(k, k.startsWith('it') ? { ic: 'rusty', r: 3 } : {}); return L.n; }, keys);

test('loot pops: materials and items pop, fly into you and go; XP and gold do not; the dice are untouched', async () => {
  const a = await H.openGame({}), b = await H.openGame({});
  try {
    await H.newGame(a); await H.newGame(b);
    const n0 = await pop(a, ['xp', 'coin']);
    assert.equal(n0, 0, 'XP and gold have their own');
    const n1 = await pop(a, ['ore', 'wood', 'it99', 'leather']);
    assert.equal(n1, 4);
    const many = await pop(a, Array.from({ length: 12 }, (_, i) => 'm' + i).map(() => 'ore'));
    assert.equal(many, 4 + 8, 'at most 8 a kill');
    const bag = await a.eval(() => JSON.stringify(window.__G.S.mats));
    await a.step(30);
    const mid = await a.eval(() => window.__GLP.list());
    assert.ok(mid.length > 0, 'still flying');
    await a.step(240);
    assert.equal(await a.eval(() => window.__GLP.n), 0, 'all reached you');
    assert.equal(await a.eval(() => JSON.stringify(window.__G.S.mats)), bag, 'the bag is what it was');
    // the same steps on a page without pops: the same next random number
    await b.step(270);
    const [ra, rb] = [await a.eval(() => Math.random()), await b.eval(() => Math.random())];
    assert.equal(ra, rb);
    assert.deepEqual(a.errors, []);
  } finally { await a.close(); await b.close(); }
});

test('loot pops with Reduced motion: at most 2 a kill', async () => {
  const g = await H.openGame({ storage: { satisfy_rmo: '1' } });
  try {
    await H.newGame(g);
    assert.equal(await pop(g, ['ore', 'wood', 'leather', 'ore']), 2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
