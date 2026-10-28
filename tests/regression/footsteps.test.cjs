'use strict';
// Footsteps (SAT-ONLINE-189; owner 2026-10-24: "improve the visuals ... add dopamine"). Only drawn:
//   - walking in snow leaves footprints, left and right, that fade within about seven seconds;
//   - on a path or dirt a step makes a puff of dust (a bigger one riding); on grass nothing;
//   - none of it takes the game's random numbers;
//   - Reduced motion: prints, no dust.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// a tile of each kind in the open world (snow: a snow tile or snowy grass; dusty: a path or dirt; grass: plain, no snow)
const find = (g) => g.eval(() => { const F = window.__GFT, out = {};
  for (let ty = -150; ty < 260 && !(out.snow && out.dust && out.grass); ty += 3) for (let tx = 30; tx < 900; tx += 3) { const v = F.tile(tx, ty), sn = v === 9 || (v === 0 || v === 1) && F.snow(tx, ty);
    if (!out.snow && sn && F.tile(tx + 1, ty) === v) out.snow = [tx, ty]; else if (!out.dust && (v === 2 || v === 10) && F.tile(tx + 1, ty) === v) out.dust = [tx, ty]; else if (!out.grass && v === 0 && !sn && F.tile(tx + 1, ty) === 0) out.grass = [tx, ty]; }
  return out; });
// walk n frames from that tile; the most prints and dust seen on the way (dust lives half a second)
const walk = async (g, [tx, ty], n = 40) => { await g.eval(([tx, ty]) => { const P = window.__G.P; P.inv = 1e9; P.x = tx * 16 + 2; P.y = ty * 16 + 8; P.dir = 2; }, [tx, ty]);
  let mp = 0, md = 0; for (let i = 0; i < n; i++) { const [p, d] = await g.eval(() => { window.__G.P.x += 0.4; return [window.__GFT.prints, window.__GFT.dust]; }); mp = Math.max(mp, p); md = Math.max(md, d); await g.step(1); }
  return { prints: mp, dust: md }; };

test('footsteps: prints in snow that fade, dust on paths, nothing on grass; no dice taken', async () => {
  const a = await H.openGame({});
  try {
    await H.newGame(a);
    const T = await find(a);
    assert.ok(T.snow && T.dust && T.grass, JSON.stringify(T));
    assert.deepEqual(await walk(a, T.grass, 40), { prints: 0, dust: 0 }, 'grass takes none');
    assert.ok((await walk(a, T.dust, 40)).dust > 0, 'dust on the path');
    const p = (await walk(a, T.snow, 40)).prints;
    assert.ok(p >= 1, 'prints in the snow: ' + p);
    await a.step(500); // seven seconds and more
    assert.deepEqual(await a.eval(() => [window.__GFT.prints, window.__GFT.dust]), [0, 0], 'they fade');
    // no dice: a hundred steps on dust and snow, with Math.random counted
    const calls = await a.eval((T) => { const r0 = Math.random; let c = 0; Math.random = () => { c++; return r0(); };
      try { for (let i = 0; i < 50; i++) { window.__GFT.step(T.dust[0] * 16 + 8, T.dust[1] * 16 + 8, 2, i % 2 === 0); window.__GFT.step(T.snow[0] * 16 + 8, T.snow[1] * 16 + 8, 0, false); } } finally { Math.random = r0; } return c; }, T);
    assert.equal(calls, 0);
    assert.deepEqual(a.errors, []);
  } finally { await a.close(); }
});

test('footsteps with Reduced motion: prints, no dust', async () => {
  const g = await H.openGame({ storage: { satisfy_rmo: '1' } });
  try {
    await H.newGame(g);
    const T = await find(g);
    assert.equal((await walk(g, T.dust, 40)).dust, 0);
    assert.ok((await walk(g, T.snow, 40)).prints >= 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// Claude-B's notes on #227 (SAT-ONLINE-196): prints fade by the frame's own time (a 30 fps or a 144 Hz screen fades them in
// the same seconds), and walkers who left are forgotten
test('footsteps fade by time, not by frames; walkers who left are forgotten', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const T = await find(g);
    assert.ok((await walk(g, T.snow, 40)).prints >= 1);
    await g.step(240, 1000 / 30); // eight seconds at 30 fps: 240 frames (at a fixed 1/60 that was four seconds)
    assert.equal(await g.eval(() => window.__GFT.prints), 0, 'gone after seven seconds at 30 fps');
    const n0 = await g.eval(() => window.__GFT.walkers);
    await g.eval(() => { for (let i = 0; i < 30; i++) window.__GFT.walk('rgone' + i, 100 + i, 100); });
    assert.equal(await g.eval(() => window.__GFT.walkers), n0 + 30);
    await g.step(1100); // 18 s: past ten seconds unseen, and a sweep
    assert.equal(await g.eval(() => window.__GFT.walkers), n0, 'the 30 who left are forgotten; you stay');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
