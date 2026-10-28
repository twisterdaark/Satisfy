'use strict';
// Owner 2026-10-24: "many cannot find the necromancer trainer, make his way easier, and let a Mage switch to Necromancer".
// The Winston coachman points the quest arrow to the pale man; a plain Mage can take the Hyena trial (cnm) and becomes a
// Necromancer, a promoted mage or a warrior cannot, and the switch is never the recommended quest.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the way to the necromancer trainer, and a Mage changing to Necromancer', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2, S = G.S; S.lv = 22;
      const novice = { cn: C.avail('cn'), cnm: C.avail('cnm') };
      window.__GNW(); const tg = window.__GQG.tgt(); const nec = window.__GNW.npc();
      S.cls = 'mage'; const mage = { cn: C.avail('cn'), cnm: C.avail('cnm'), rec: window.__GQREC.rec() };
      S.cls = 'bmage'; const bm = C.avail('cnm'); S.cls = 'warrior'; const wr = C.avail('cnm'); S.qTrk = null; window.__GNW(); const wrTrk = S.qTrk || null;
      return { novice, tg: tg && tg.id, near: tg && nec && Math.hypot(tg.p.x - nec.x, tg.p.y - nec.y), mage, bm, wr, wrTrk }; });
    assert.deepEqual(a.novice, { cn: true, cnm: false }, JSON.stringify(a));
    assert.equal(a.tg, 'cn', 'the arrow follows the Hyena trial'); assert.ok(a.near < 3, 'and points at the pale man: ' + a.near);
    assert.equal(a.mage.cn, false); assert.equal(a.mage.cnm, true); assert.notEqual(a.mage.rec, 'cnm', 'never recommended');
    assert.equal(a.bm, false); assert.equal(a.wr, false); assert.equal(a.wrTrk, null, 'a warrior is only told where he is');
    // the Mage gathers corpses and becomes a Necromancer with the necro skills
    const b = await g.eval(() => { const G = window.__G, C = window.__GC2, X = window.__GNE, P = G.P, S = G.S; S.cls = 'mage'; S.qTrk = null;
      window.__GNW(); const trk = S.qTrk; C.accept('cnm'); const m = G.spawnMon('wolf', P.x + 30, P.y); m.hp = 1; m.lv = 22; C.hit(m); const n = X.NEC.corpses.length; if (n) { P.x = X.NEC.corpses[0].x; P.y = X.NEC.corpses[0].y; X.tick(0.05); }
      const got = S.qs.cnm.c; S.qs.cnm.c = 8; C.complete('cnm'); return { trk, n, got, cls: S.cls, sk: C.cls() }; });
    assert.equal(b.trk, 'cnm'); assert.equal(b.n, 1, 'a kill leaves a body during the switch trial'); assert.equal(b.got, 1);
    assert.equal(b.cls, 'necro'); assert.ok(b.sk.includes('nskel'), JSON.stringify(b));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
