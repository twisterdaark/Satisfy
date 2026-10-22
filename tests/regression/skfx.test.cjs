'use strict';
// Every skill shows and sounds like itself (owner 2026-10-22: "any skill missing effects and sounds"): cast next to a
// monster, each one draws something of its own and has a sound of its kind, not the plain cast (the bard's songs open
// their rhythm game and play their own notes).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('each skill draws something when cast and has its own kind of sound', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const keys = await g.eval(() => window.__GSKF.keys());
    const SONG = new Set(['bvalor', 'bswift', 'brest']), dark = [], plain = [];
    for (const k of keys) {
      if (SONG.has(k)) continue;
      const r = await g.eval((k) => { const G = window.__G, P = G.P;
        for (const m of G.mons()) if (!m.dead && Math.hypot(m.x - P.x, m.y - P.y) < 200) m.dead = true;
        const m = G.spawnMon('wolf', P.x + 24, P.y); m.tmp = 0; m.stun = 99; m.hp = m.max = 1e9;
        P.mp = 1e6; P.hp = 1e6; P.inv = 0; P.dash = 0; const A = window.__GSKF, v0 = A.vn(), f0 = A.fx();
        A.cast(k); window.__sk0 = { v0, f1: Math.max(0, A.fx() - f0) }; return { snd: A.snd(k) }; }, k);
      await g.step(15); await g.page.waitForTimeout(150); // some land a moment later (a volley, a rune, a chain)
      if (!(await g.eval(() => window.__GSKF.vn() - window.__sk0.v0 + window.__sk0.f1))) dark.push(k);
      if (!r.snd || r.snd === 'cast') plain.push(k);
      await g.eval(() => { const G = window.__G; if (G.mode !== 'play') document.querySelectorAll('#dialog,#qdW').forEach((e) => { e.hidden = true; }); });
    }
    assert.deepEqual(dark, [], 'nothing drawn');
    assert.deepEqual(plain.filter((k) => !['ospite', 'asens'].includes(k)), [], 'only the plain cast sound');
  } finally { await g.close(); }
});
