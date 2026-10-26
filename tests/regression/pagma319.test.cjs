'use strict';
// v3.19 Pagma's Successor at the anvil by the novel (the owner 2026-10-26, "like the novel exactly"): any gear worn
// unconditionally but with a penalty by its rating below its level, shrinking with understanding (ch 3, 4, 16); Legendary
// Blacksmith's Craftsmanship (ch 97, 442), Appraisal (ch 13, 244) and Disassembly (ch 2) as named skills.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the rating penalty, Craftsmanship, Appraisal and Disassembly', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, L = window.__GLG3, o = {};
      S.cls = 'pagma'; S.lv = 40; S.sk = {}; G.isk.checkSkills();
      o.sk = ['lcraft', 'lappr', 'ldisas'].map((k) => !!S.sk[k]);
      const it = G.isk.mkItem('failure', 4, 1);   // a legendary weapon of level 90
      S.und = S.und || {}; S.und[it.id] = 0; o.pen0 = +L.pen(it).toFixed(2);
      S.und[it.id] = 50; o.pen50 = +L.pen(it).toFixed(2);
      S.und[it.id] = 100; o.pen100 = L.pen(it);
      S.und[it.id] = 0; S.lv = 95; o.over = L.pen(it);
      S.lv = 40; const rare = G.isk.mkItem('failure', 1, 1); o.rare = +L.pen(rare).toFixed(2);
      S.cls = 'knight'; o.other = L.pen(it);
      S.cls = 'pagma'; o.craft = +L.craft().toFixed(4);
      return o;
    });
    assert.deepEqual(r.sk, [true, true, true]);
    assert.equal(r.pen0, 0.5, 'a legendary piece below its level: half'); assert.equal(r.pen50, 0.75, 'half understood: a quarter'); assert.equal(r.pen100, 1, 'understood: none');
    assert.equal(r.over, 1, 'at its level: none'); assert.equal(r.rare, 0.8, 'a rare piece: 20%'); assert.equal(r.other, 1, 'only Pagma\'s Successor');
    assert.equal(r.craft, 0.1067, 'Craftsmanship Lv 1 (12% at Lv 2, 20% at Lv 8)');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
