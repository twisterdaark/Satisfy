'use strict';
// owner 2026-10-23: "make sure every passive levels normally, and for passives like Magic Contemplation explain how to use and level it"
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every passive levels from kills, grows by its level, and says how it works; Magic Contemplation breaks a spell', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GPS, out = { stuck: [], txt: [], noKey: [] }; S.lv = 500;
      const own = new Set(['focus', 'scraft', 'stemp', 'lpat', 'lcre', 'beyes']);
      for (const k of X.list()) { if (own.has(k)) continue; S.cls = X.cls(k); S.sk[k] = 1; S.skx = S.skx || {}; S.skx[k] = 0;
        if (!X.on().includes(k)) { out.stuck.push(k + ' (not active as ' + S.cls + ')'); continue; }
        for (let i = 0; i < 10; i++) X.kill({ type: 'wolf' }); if (!(S.skx[k] > 0)) out.stuck.push(k + '@' + S.cls);
        const tx = X.txt(k); if (!/always on|nothing to press/i.test(tx)) out.txt.push(k); }
      return out; });
    assert.deepEqual(r.stuck, [], 'passives that never level: ' + r.stuck.join(' '));
    assert.deepEqual(r.txt, [], 'passives without the how-to line');
    const b = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GPS; S.cls = 'braham'; S.sk.bcont = 1; S.skx.bcont = 0; const P = G.P; P.bcT = 0; P.inv = 0;
      let br = 0; for (let i = 0; i < 40; i++) { P.bcT = 0; if (X.bc({ x: P.x, y: P.y, m: null })) br++; }
      const xp = S.skx.bcont; S.skx.bcont = 0; const m1 = X.m('bcont'); S.skx.bcont = 2000; return { br, xp, m1, m10: X.m('bcont'), cd: (P.bcT = 99999, X.bc({ x: 0, y: 0 })) }; });
    assert.ok(b.br > 8 && b.br < 35, 'about half the spells break: ' + b.br);
    assert.equal(b.m1, 1); assert.ok(Math.abs(b.m10 - 1.45) < 1e-9);
    assert.equal(b.cd, false, 'not again within 3 s');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
