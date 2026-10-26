'use strict';
// The Hermit of Oblivion in Reidan (the player Suki through the owner 2026-10-26): forget your class for 100 levels (Lv 100+),
// a legend going back to the world (owner 16:39), or wipe the whole character into a new one with the same name and save.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Hermit of Oblivion: forget the class, a legend freed, wipe the character', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, S = G.S, O = window.__GOBLV, C = window.__GC2;
      const n = O.npc();
      S.cls = 'knight'; S.lv = 150; S.st = { str: 600, sta: 400, agi: 300, int: 100, dex: 100 }; S.pts = 5; S.qs.ck = { st: 2, c: 0 }; S.qs.gj1 = { st: 2, c: 0 };
      const ptsBefore = 1450 + 5; O.cls();
      return { npc: n, cls: S.cls, lv: S.lv, st: S.st.str, pts: S.pts, ck: !!S.qs.ck, gj1: !!S.qs.gj1, ptsBefore }; });
    assert.deepEqual(a.npc && [a.npc.solid, a.npc.reid], [false, true], JSON.stringify(a.npc));
    assert.equal(a.cls, 'novice'); assert.equal(a.lv, 50); assert.equal(a.st, 10);
    assert.ok(a.pts > 0 && a.pts < a.ptsBefore, JSON.stringify(a));
    assert.equal(a.ck, false, 'the class trial can be taken again'); assert.equal(a.gj1, true, 'the story stays');
    // a legend forgotten goes back to the world
    const b = await g.eval(async () => { const G = window.__G, S = G.S, GL = window.__GL;
      GL.become('muller'); const had = !!(GL.legends() || {}).muller; S.lv = 200; await window.__GOBLV.go(0); window.__GOBLV.cls();
      return { had, cls: S.cls, freed: !(GL.legends() || {}).muller }; });
    assert.deepEqual(b, { had: true, cls: 'novice', freed: true });
    const c = await g.eval(async () => { const G = window.__G, S = G.S; const pid = S.pid, nm = S.look.n; S.lv = 300; S.gold = 99999;
      window.__GOBLV.wipe(); return { pid, nm }; });
    await g.page.waitForFunction(() => window.__G.S.lv === 1, null, { timeout: 5000 }).catch(() => {});
    await g.step(5);
    const d = await g.eval(() => { const S = window.__G.S; return { pid: S.pid, nm: S.look.n, lv: S.lv, gold: S.gold, cls: S.cls }; });
    assert.equal(d.pid, c.pid); assert.equal(d.nm, c.nm); assert.equal(d.lv, 1); assert.ok(d.gold < 1000); assert.equal(d.cls, 'novice');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
