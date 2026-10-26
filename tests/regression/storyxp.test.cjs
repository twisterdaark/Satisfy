'use strict';
// The player Suki through the owner 2026-10-26: story experience x2 (its cap too), and a legend may replay finished story
// and side quests (they stay finished for what follows them; no class, trial or epic comes back).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('story XP doubled; a legend replays story and side quests', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2, S = G.S;
      const run = (id) => { S.lv = 200; S.xp = 0; C.accept(id); const q = S.qs[id]; q.c = 99; const x0 = S.xp; C.complete(id); return S.xp - x0; };
      const gj1 = run('gj1'); const cn = run('cn');
      return { gj1, cn, need: G.xpNeed() }; });
    // gj1 gives 5000 base: doubled = 10000 x XPMUL 1.2 = 12000 (level 200 is under any quest cap)
    assert.ok(a.gj1 >= 12000 && a.gj1 < 13500 && a.cn >= 3000 && a.cn < 3400, JSON.stringify(a)); // cn (2500, not story) stays x1.2
    const b = await g.eval(() => { const G = window.__G, C = window.__GC2, S = G.S;
      const before = C.avail('gj1'); S.cls = 'saint'; const legA = C.avail('gj1'), legCls = C.avail('cn');
      C.accept('gj1'); const rp = !!S.qs.gj1.rp, stillDone = window.__GMS.cur() !== 0 || true; const gj2ok = C.avail('gj2');
      S.qs.gj1.c = 99; C.complete('gj1'); const after = { st: S.qs.gj1.st, rp: !!S.qs.gj1.rp };
      return { before, legA, legCls, rp, gj2ok, after }; });
    assert.deepEqual(b, { before: false, legA: true, legCls: false, rp: true, gj2ok: true, after: { st: 2, rp: false } });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
