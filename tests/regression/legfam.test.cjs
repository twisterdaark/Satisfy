'use strict';
// A legendary class asks for the whole family (owner 2026-10-22: "a warlock or battlemage still branched from the
// magician"): Braham's soul answers any magic class, Muller's sword any warrior's branch, hidden classes included.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a warlock, a battlemage and a necromancer may take Braham; a knight Muller; an archer neither', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const S = window.__G.S, F = window.__GLC, o = {};
      for (const [c, b, root] of [['warlock', 'mage'], ['bmage', 'mage'], ['necro', null], ['esorc', null, 'mage'], ['knight', 'warrior'], ['sniper', 'archer'], ['aura', null, 'archer']]) {
        S.cls = c; S.cbase = b; S.croot = root || null; o[c] = [F.fam('mage'), F.fam('warrior')]; }
      return o; });
    assert.deepEqual(r, { warlock: [true, false], bmage: [true, false], necro: [true, false], esorc: [true, false], knight: [false, true], sniper: [false, false], aura: [false, true] });
    // at Braham's soul a level-150 warlock is offered the class, not told to be a magician
    const d = await g.eval(() => { const G = window.__G, S = G.S; for (const m of G.mons()) if (m.type === 'bknight') { m.dead = true; m.rt = 1e9; }
      S.cls = 'warlock'; S.cbase = 'mage'; S.lv = 150; window.__GLC.soul(); return document.getElementById('dtext').textContent + '|' + (document.querySelectorAll('#dopts button').length); });
    assert.doesNotMatch(d, /magician/i);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
