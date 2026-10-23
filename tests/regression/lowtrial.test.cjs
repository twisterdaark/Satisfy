'use strict';
// "Kill it below 50% health" on a monster 20+ levels under you (owner 2026-10-24): a monster that weak can't bring you
// down that far, so a kill of any monster near your level, made below that health, counts instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('low-health trial: far stronger players count kills of monsters near their level', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, L = window.__GLOW, MT = L.MT, out = {};
      S.qs.c2b = { st: 1, c: 0 }; const c = () => S.qs.c2b.c || 0;
      const near = Object.keys(MT).find(k => MT[k].lv[0] >= 158 && MT[k].lv[0] <= 175 && !MT[k].boss && k !== 'merman');
      const far = Object.keys(MT).find(k => (MT[k].lv[1] || 1) < 100 && k !== 'merman');
      S.lv = 25; L.hp(.3); L.kill('merman'); out.lowLv = c(); L.kill(near); out.lowLvNear = c();
      S.lv = 162; out.text = L.text('c2b');
      L.hp(.9); L.kill(near); out.full = c();
      L.hp(.3); L.kill(near); out.near = c(); L.kill(far); out.far = c(); L.kill('merman'); out.own = c();
      return out;
    });
    assert.equal(r.lowLv, 1, 'at its level the merman itself counts');
    assert.equal(r.lowLvNear, 1, 'other monsters do not count at its level');
    assert.match(r.text, /near your level|قريب من لفلك/);
    assert.equal(r.full, 1, 'health above half still does not count');
    assert.equal(r.near, 2, 'a near-level kill below half counts');
    assert.equal(r.far, 2, 'a weak other monster does not');
    assert.equal(r.own, 3, 'the merman itself still counts');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
