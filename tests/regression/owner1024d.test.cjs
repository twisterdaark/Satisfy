'use strict';
// The owner's 2026-10-24 list, fifth part: materials (books, scrolls, potions) go into trades as bundles; your own creations
// say the name you go by now; every item with a level requirement shows it, creations by their strongest material.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('material bundles, the maker name after a rename, level requirements', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const A = window.__GAP, G = window.__G, S = G.S;
      // a bundle from the other side: a known material and a sane count, anything else turned away
      const ok = A.tin(JSON.stringify({ id: 'mpack', mk: 'tzbook', n: 1 })), bad = A.tin(JSON.stringify({ id: 'mpack', mk: 'nosuch', n: 1 })), big = A.tin(JSON.stringify({ id: 'mpack', mk: 'ore', n: 1e9 }));
      // a creation of yours, made under the old name
      S.cre = [{ id: 'c7', ty: 'gs', mats: { blhorn: 1, bljewel: 1 }, L: 50, W: 50, C: 0, sl: 1, nm: 'Abyss', by: 'Ahmed' }];
      const it = { uid: 9921, id: 'gsword', slot: 'w', r: 4, atk: 900, spd: .46, nm: 'Abyss', by: 'Ahmed', cr: 'c7', lvr: 350 };
      return { ok: ok && [ok.id, ok.mk, ok.n], bad, big: big && big.n, tip: A.tip(it) }; });
    assert.deepEqual(r.ok, ['mpack', 'tzbook', 1]);
    assert.equal(r.bad, null);
    assert.equal(r.big, 99999);
    assert.ok(/Made by Grid/.test(r.tip) && !/Ahmed/.test(r.tip), 'the name you go by now: ' + r.tip.slice(0, 200));
    assert.match(r.tip, /Lv(el)? ?350|350/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
