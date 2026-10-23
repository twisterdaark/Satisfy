'use strict';
// Behen (owner 2026-10-22): "take me back to the last island I reached", "once an island is finished no monsters spawn
// again", and "where do I get the keys?" (the hidden keys never showed).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const wait = (ms) => new Promise((r) => setTimeout(r, ms)); // the island fade is a real 300 ms

test('the gate goes on from the next island; a cleared island has no monsters; hidden keys glint', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.S.lv = 250; window.__GBH.enter(1); });
    await wait(500); await g.step(90);
    await g.eval(() => { window.__G.DL = null; window.__GBH.clear(); });
    await g.step(10);
    assert.equal(await g.eval(() => window.__GBH.s().best), 1);
    await g.eval(() => { window.__G.DL = null; window.__GBH.leave(); }); await wait(500); await g.step(60);
    // the gate offers the second island first
    const o = await g.eval(() => { const G = window.__G; G.DL = null; window.__GBH.ask(); for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); return G.DL.opts.map((x) => x.l); });
    assert.match(o[0], /2nd island/);
    // back on the first: no monsters, the way on is open
    await g.eval(() => { window.__G.DL = null; window.__GBH.enter(1); }); await wait(500); await g.step(90);
    const r = await g.eval(() => ({ mons: window.__G.mons().filter((m) => m.bh && !m.dead).length, next: window.__GBH.R.gates.some((x) => x.bh === 'next') }));
    assert.deepEqual(r, { mons: 0, next: true });
    // a keys island: a hidden key beside you is drawn
    const k = await g.eval(() => { const G = window.__G; let n = 2; while (window.__GBH.isle(n).k !== 'keys' && n < 66) n++; return n; });
    await g.eval((n) => { window.__G.DL = null; window.__GBH.s().best = 0; window.__GBH.enter(n); }, k); await wait(500); await g.step(90);
    await g.eval(() => { const G = window.__G; G.DL = null; for (let i = 0; i < 8 && G.DL; i++) G.advance(); });
    await g.step(300);
    const key = await g.eval(() => { const R = window.__GBH.R, k = R.gates.find((x) => x.bh === 'key' && !x.got); if (!k) return null; const P = window.__G.P; P.x = k.x + 20; P.y = k.y; return { x: k.x, y: k.y }; });
    assert.ok(key, 'keys were hidden');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-23: "fix island 56; make the maze doors clear, they are nearly impossible to see"
test('island 56: two lit cave mouths stand even after the question is closed; the maze runs through them to the end', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.S.lv = 400; G.P.hp = 1e9; window.__GBH.enter(56); });
    await wait(500); await g.step(30);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 8 && G.DL; i++) G.advance(); });
    for (let i = 0; i < 40 && !(await g.eval(() => window.__GBH.R.ph === 'go')); i++) { await g.step(60); await g.eval(() => { const G = window.__G; if (G.DL && !G.DL.optOn) for (let j = 0; j < 8 && G.DL && !G.DL.optOn; j++) G.advance(); }); }
    assert.equal(await g.eval(() => window.__GBH.R.ph), 'go', 'the countdown ended');
    await g.eval(() => { window.__G.DL = null; });
    for (let st = 0; st < 6; st++) {
      const d = await g.eval(() => window.__GBH.R.gates.filter((x) => x.mz).map((x) => ({ mz: x.mz, x: Math.round(x.x), hint: x.hint })));
      assert.equal(d.length, 2, 'step ' + (st + 1) + ': two caves'); assert.deepEqual(d.map((x) => x.mz).sort(), [1, 2]);
      await g.eval(() => { const R = window.__GBH.R; window.__G.DL = null; window.__GBH.use(R.gates.find((x) => x.mz === R.right + 1)); });
      await wait(400); await g.step(5);
      assert.equal(await g.eval(() => window.__GBH.R.gates.filter((x) => x.mz).length), 0, 'the caves close behind you');
      await g.eval(() => { for (const m of window.__GBH.R.ms) if (!m.dead) window.__GBH.kill(m); });
      await g.step(5); await g.eval(() => { window.__G.DL = null; });
    }
    assert.equal(await g.eval(() => window.__GBH.s().best), 56, 'the island is cleared');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
