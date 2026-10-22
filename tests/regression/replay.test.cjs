'use strict';
// SAT-ONLINE-100 (plan U323 replay recorder, U373 combat determinism): offline with ?tick=fixed&rec the game records a
// session from Continue (the save, a seed, the clock it began at, and the keys pressed, each at its step). Here a scripted
// player walks to the nearest monster and fights it at 60 frames a second; ?tick=fixed&replay plays the recording back
// at 30 (and 144) in a save slot of its own: the player's own save is untouched, and the replay ends in the same world
// (every 10 s checked against the recording, and at the end), and says so. A recording with one key taken out goes apart,
// and the replay says when.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const world = (g) => g.eval(() => {
  const G = window.__G, P = G.P, S = G.S, r = (x) => Math.round(x * 1e4) / 1e4;
  return { steps: window.__REC.steps, P: [r(P.x), r(P.y), r(P.hp)], xp: S.xp, gold: S.gold, hash: window.__REC.hash() };
});

// the scripted player: every 1/6 s, toward the nearest monster with the arrow keys; the attack key held when close
async function play(g, seconds, fps) {
  const dt = 1000 / fps, chunk = Math.round(fps / 6);
  let held = new Set();
  const set = async (want) => {
    for (const k of held) if (!want.has(k)) await g.page.keyboard.up(k);
    for (const k of want) if (!held.has(k)) await g.page.keyboard.down(k);
    held = want;
  };
  for (let i = 0; i < seconds * 6; i++) {
    const v = await g.eval(() => {
      const G = window.__G, P = G.P;
      const m = G.mons().filter((x) => !x.dead && x.max < 5000).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
      return m ? [m.x - P.x, m.y - P.y] : [0, 0];
    });
    const want = new Set(), d = Math.hypot(v[0], v[1]);
    if (d > 18) { if (Math.abs(v[0]) > 8) want.add(v[0] > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(v[1]) > 8) want.add(v[1] > 0 ? 'ArrowDown' : 'ArrowUp'); }
    if (d < 40) want.add('KeyJ');
    await set(want);
    await g.step(chunk + (i % 3), dt); // uneven chunks: inputs land at any step
  }
  await set(new Set());
  await g.step(3, dt);
}

async function replay(ctx, fps) {
  const g = await H.openGame({ ctx, query: '?tick=fixed&replay' });
  await g.waitMode('play');
  const end = await g.eval(() => window.__REC.rpl.end);
  const dt = 1000 / fps;
  for (let i = 0; i < 400 && !(await g.eval(() => !!window.__REC.rpl.done)); i++) await g.step(Math.round(fps / 2), dt);
  const out = await g.eval(() => ({ done: !!window.__REC.rpl.done, result: window.__REC.rpl.result, bad: window.__REC.rpl.bad, notice: document.getElementById('anntext').textContent }));
  return { g, end, out };
}

test('replay: a session recorded at 60 fps plays back the same at 30 and 144, in a slot of its own', async () => {
  const ctx = await H.newContext();
  try {
    // a character to continue, then a session recorded from Continue
    const a = await H.openGame({ ctx, query: '?tick=fixed&rec' });
    await H.newGame(a); // it saves
    await a.reload();
    await H.continueGame(a);
    assert.equal(await a.eval(() => window.__REC.sim && !!window.__REC.rec), true, 'recording');
    const save0 = await a.eval(() => localStorage.getItem('satisfy_proto_v4'));
    await play(a, 14, 60);
    await a.eval(() => window.__REC.keep());
    const rec = await a.eval(() => { const R = JSON.parse(localStorage.getItem('satisfy_replay')); return { end: R.end, ev: R.ev.length, cp: R.cp.length, h: R.h }; });
    const w60 = await world(a);
    assert.equal(rec.end, w60.steps);
    assert.ok(rec.ev >= 4 && rec.cp >= 1, 'keys and checks recorded: ' + JSON.stringify(rec));
    assert.ok(w60.xp > 0 || w60.P[2] < 200, 'something happened: ' + JSON.stringify(w60));
    assert.deepEqual(a.errors, []);
    const saveA = await a.eval(() => localStorage.getItem('satisfy_proto_v4'));
    await a.close();

    // played back at 30 and at 144 frames a second: the same world, and the replay says so
    for (const fps of [30, 144]) {
      const { g, end, out } = await replay(ctx, fps);
      assert.equal(end, rec.end);
      assert.deepEqual(out, { done: true, result: 'same', bad: -1, notice: 'The replay ended exactly as the game did' }, fps + ' fps');
      const w = await world(g);
      assert.deepEqual(w, w60, fps + ' fps: the same world');
      assert.equal(await g.eval(() => localStorage.getItem('satisfy_proto_v4')), saveA, "the player's own save untouched");
      assert.ok(await g.eval(() => !!localStorage.getItem('satisfy_proto_v4@rpl')), 'the replay plays in its own slot');
      assert.deepEqual(g.errors, []);
      await g.close();
    }
    assert.notEqual(save0, null);

    // the check can tell: one key press taken out, and the replay goes apart and says when
    const t = await H.openGame({ ctx });
    await t.eval(() => {
      const R = JSON.parse(localStorage.getItem('satisfy_replay')), i = R.ev.findIndex((e) => e[1] === 'd' && /^Arrow/.test(e[2]));
      R.ev.splice(i, 1); localStorage.setItem('satisfy_replay', JSON.stringify(R));
    });
    await t.close();
    const { g, out } = await replay(ctx, 60);
    assert.equal(out.result, 'apart');
    assert.ok(out.bad > 0 && out.bad <= rec.end, 'when: ' + out.bad);
    assert.match(out.notice, /^The replay went apart from the game at \d+:\d\d$/);
    await g.close();
  } finally { await ctx.close(); }
});

// Claude-B's note on #134: the replay's input guard (non-passive touchstart and wheel listeners on the window) is only on a
// replay page; every other page scrolls and touches as before
test('replay: its input guard is only on a replay page', async () => {
  const spy = { content: "window.__np=[];const _ae=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,f,o){if(this===window&&o&&typeof o==='object'&&o.passive===false)window.__np.push(t);return _ae.call(this,t,f,o);};" };
  const ctx = await H.newContext({ scripts: [spy] });
  try {
    const g = await H.openGame({ ctx });
    assert.deepEqual(await g.eval(() => window.__np.filter((t) => t === 'touchstart' || t === 'wheel')), [], 'a normal page');
    await g.close();
    const r = await H.openGame({ ctx, query: '?tick=fixed&replay' });
    assert.deepEqual((await r.eval(() => window.__np.filter((t) => t === 'touchstart' || t === 'wheel'))).sort(), ['touchstart', 'wheel'], 'a replay page');
    await r.close();
  } finally { await ctx.close(); }
});
