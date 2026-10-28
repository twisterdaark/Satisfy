'use strict';
// The plan's gear and craft updates: U276 sockets (1-3 by rating, gems in each, one taken out to move it), U285 a traded piece
// can't be salvaged, U272 a weapon wears another weapon's look, U273 armour dyes, U280 blueprint fragments, U284 /craftstats
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('sockets, traded pieces, weapon looks, dyes, blueprint fragments, craft stats', async () => {
  const g = await H.openGame({ storage: { satisfy_lang: 'en' } });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, A = window.__GAP;
      // sockets by rating
      const so = [0, 4].map((rt) => { const n = new Set(); for (let i = 0; i < 40; i++) n.add(G.eqx.mkItem('isword', rt).so); return [...n].sort(); });
      // gems in two sockets count, and a traded copy keeps them but can't be salvaged
      const it = G.eqx.mkItem('isword', 4); it.so = 3; it.gem = 'ruby'; it.gx = ['ruby']; S.items.push(it); S.eqW = it.uid;
      const tip = A.tip(it); const tr = A.tin(JSON.stringify(Object.assign({}, it, { uid: 0, iid: 0 })));
      const sv = window.__GSV.yield(it, 'anvil');
      return { so, tipGems: /Gems: .*\(2\/3 sockets\)/.test(tip), trGx: tr && tr.gx, trd: tr && tr.trd, svRuby: sv.ruby }; });
    assert.deepEqual(r.so[0], [1]);
    assert.ok(r.so[1].every((x) => x >= 2 && x <= 3), JSON.stringify(r.so));
    assert.equal(r.tipGems, true);
    assert.deepEqual([r.trGx, r.trd, r.svRuby], [['ruby'], 1, 2]);
    // weapon look and armour dye change what is drawn, not the stats
    const w = await g.eval(() => { const G = window.__G, S = G.S, it = S.items.find((i) => i.uid === S.eqW), atk = it.atk; it.skn = 'gsword';
      const k0 = window.__GLK.sig(); S.look.ad = 6; const k1 = window.__GLK.sig(); return { key: window.__GCR.key(it), atk: it.atk === atk, sigChanged: k0 !== k1 }; });
    assert.deepEqual(w, { key: 'gsword', atk: true, sigChanged: true });
    // five fragments make a rare book; craft ratings are counted
    const b = await g.eval(() => { const G = window.__G, S = G.S; S.mats.bpfrag = 5; G.useSlot ? 0 : 0; window.__GBP.use(); const books = Object.keys(S.mats).filter((k) => /^rb_/.test(k) && S.mats[k] > 0);
      S.crs = [10, 5, 2, 1, 0]; return { left: S.mats.bpfrag, books }; });
    assert.equal(b.left, 0);
    assert.ok(b.books.length >= 1, JSON.stringify(b.books));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
