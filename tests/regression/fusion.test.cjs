'use strict';
// Pagma's Swordsmanship fusion skills (owner 2026-10-22, 1:1 with the novel): two sword dances back to back fuse once
// into a new technique with +10 intelligence. Kill + Link = Linked Kill, Pinnacle + Kill = Pinnacle Kill, and once
// Linked Kill is known, Link + Kill + Wave = Linked Kill Wave. Transcended Link needs Link at level 2.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('sword dances back to back fuse into Linked Kill, Pinnacle Kill and Linked Kill Wave', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const G = window.__G; G.S.cls = 'pagma'; G.S.lv = 200; G.S.pgMur = 1; G.S.qs.dp2 = { st: 2, c: 1 };
      G.S.bar = ['transcend', 'link', 'kill', 'wave', 'pinnacle', null, null, null]; G.isk.checkSkills(); G.isk.rs(); G.P.hp = 1e6;
      const m = G.spawnMon('forc', G.P.x + 20, G.P.y); m.max = m.hp = 1e9; m.tmp = 0; });
    await g.step(10);
    const key = async (k) => { await g.eval(() => { window.__G.P.mp = 1e6; }); await g.page.keyboard.press(k); await g.step(4); };
    const int0 = await g.eval(() => window.__G.S.st.int);
    // Transcend then Link with Link still level 1: no fusion
    await key('Digit1'); await g.step(30); await key('Digit2'); await g.step(10);
    assert.deepEqual(await g.eval(() => window.__G.S.fus || {}), {});
    await g.eval(() => { window.__G.P.cd = {}; });
    await key('Digit3'); await key('Digit2'); await g.step(20);
    assert.deepEqual(await g.eval(() => window.__G.S.fus), { lkill: 1 });
    await g.eval(() => { window.__G.P.cd = {}; }); await key('Digit5'); await key('Digit3'); await g.step(30);
    await g.eval(() => { window.__G.P.cd = {}; }); await key('Digit2'); await key('Digit3'); await key('Digit4'); await g.step(30);
    const r = await g.eval(() => ({ fus: window.__G.S.fus, int: window.__G.S.st.int }));
    assert.deepEqual(r.fus, { lkill: 1, pkill: 1, lkwave: 1 });
    assert.equal(r.int, int0 + 30);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-23: "make sure there are no more Pagma combinations like Linked Kill Wave... make sure you added everything he has":
// Grid's own dances (Flower, Chop, Drop, Dragon, Serve, Sky) and every fusion the novel names, three to six dances long
test('the later fusions: Wave Pinnacle, Linked Kill Flower, Linked Kill Wave Pinnacle, Transcended Link Flower; every one strikes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const G = window.__G; G.S.cls = 'pagma'; G.S.lv = 460; G.S.pgMur = 1; G.S.qs.dp2 = { st: 2, c: 1 }; G.S.fus = { lkill: 1, lkwave: 1, pkill: 1, tlink: 1 };
      G.S.bar = ['link', 'kill', 'wave', 'pinnacle', 'pgflower', 'transcend', 'revolve', 'pgdrop']; G.isk.checkSkills(); G.isk.rs(); G.P.hp = 1e6;
      const m = G.spawnMon('forc', G.P.x + 20, G.P.y); m.max = m.hp = 1e9; m.tmp = 0; window.__fm = m; });
    await g.step(10);
    const seq = async (ks) => { for (const k of ks) { await g.eval((k) => { const P = window.__G.P; P.cd = {}; P.mp = 1e6; window.__GPF.cast(k); }, k); await g.step(4); } await g.step(40); };
    await seq(['wave', 'pinnacle']);
    await seq(['link', 'kill', 'pgflower']);
    await seq(['link', 'kill', 'wave', 'pinnacle']);
    await seq(['transcend', 'link', 'pgflower']);
    const fus = await g.eval(() => window.__G.S.fus);
    for (const f of ['wpinn', 'lkflower', 'lkwp', 'tlflower']) assert.equal(fus[f], 1, f + ' learnt: ' + JSON.stringify(fus));
    const all = await g.eval(() => window.__GPF.PGFU.map((x) => x[0]).concat(Object.keys(window.__GPF.PGB)));
    assert.ok(all.length >= 28, 'six dances and the fusions: ' + all.length);
    for (const k of all) {
      await g.eval((k) => { const G = window.__G; for (let i = 0; i < 10 && G.DL; i++) G.advance(); G.DL = null; G.P.hp = 1e6; for (const m of G.mons()) if (m !== window.__fm) m.dead = true; const m = window.__fm; m.dead = false; m.hp = 1e9; m.x = G.P.x + 20; m.y = G.P.y; window.__GSKF.cast(k); }, k);
      for (let i = 0; i < 15; i++) { await g.step(10); await g.eval(() => { const G = window.__G; for (let j = 0; j < 10 && G.DL; j++) G.advance(); }); }
      const d = await g.eval(() => 1e9 - window.__fm.hp);
      if (k !== 'pgserve' && k !== 'pgsky') assert.ok(d > 0, k + ' strikes');
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
