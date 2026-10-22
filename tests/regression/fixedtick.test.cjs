'use strict';
// SAT-ONLINE-099 (plan U313 fixed tick simulator, U373 combat determinism): with ?tick=fixed the world moves in steps of
// 1/60 s whatever the frame rate, and drawing draws its random numbers from a stream of its own. The same scripted
// session (fight the nearest monster with the attack key held, then go after it still swinging) played at 30, 60 and 144
// frames a second ends in the same world: the player, the monsters, experience, gold and the next random number, to the
// last digit. Without the flag the game is as it was: the world moves by each frame's time, and 30 and 60 end apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function session(fps, query) {
  const g = await H.openGame({ query });
  try {
    await H.newGame(g);
    // every press and release falls on a whole number of frames at 30, 60 and 144 a second, and of 1/60 s steps: a
    // multiple of 1/6 s. A key pressed between two steps is seen by the next one, at any frame rate
    const dt = 1000 / fps, hold = (s) => g.step(Math.round(s * fps), dt);
    // the monster nearest the start, the player just left of it, facing it (the same spot every run: the world is seeded)
    await g.eval(() => { const G = window.__G, P = G.P; const m = G.mons().filter((x) => !x.dead && x.max < 5000).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; P.x = m.x - 16; P.y = m.y; P.dir = 2; window.__tm = m; });
    await hold(1 / 6);
    await g.page.keyboard.down('KeyJ'); await hold(1); // hit it
    await g.page.keyboard.down('ArrowRight'); await hold(2); // after it, still swinging
    await g.page.keyboard.up('ArrowRight'); await g.page.keyboard.up('KeyJ');
    await hold(1);
    const out = await g.eval(() => {
      const G = window.__G, P = G.P, S = G.S, r = (x) => Math.round(x * 1e6) / 1e6;
      const near = G.mons().filter((m) => Math.hypot(m.x - P.x, m.y - P.y) < 400).map((m) => [m.type, r(m.x), r(m.y), r(m.hp), !!m.dead]).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
      // the world's own random numbers: the next one is the same too (drawing took none of them)
      return { P: [r(P.x), r(P.y), r(P.hp), r(P.acd)], xp: S.xp, lv: S.lv, gold: S.gold, near, target: [r(window.__tm.hp), r(window.__tm.max), !!window.__tm.dead], next: Math.random() };
    });
    assert.deepEqual(g.errors, []);
    return out;
  } finally { await g.close(); }
}

test('fixed tick: the same session at 30, 60 and 144 frames a second ends the same', async () => {
  const at60 = await session(60, '?tick=fixed');
  assert.ok(at60.target[0] < at60.target[1], 'the fight happened: ' + JSON.stringify(at60.target));
  assert.ok(at60.near.length > 1, 'monsters around');
  const at30 = await session(30, '?tick=fixed');
  const at144 = await session(144, '?tick=fixed');
  assert.deepEqual(at30, at60, '30 vs 60');
  assert.deepEqual(at144, at60, '144 vs 60');
  // the check can tell: without the flag the same session ends elsewhere at 30 than at 60
  assert.notDeepEqual(await session(30, ''), await session(60, ''), 'without ?tick=fixed the frame rate shows');
});
