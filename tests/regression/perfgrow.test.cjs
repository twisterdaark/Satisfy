'use strict';
// SAT-ONLINE-160 (owner 2026-10-23: "the game drops frames when there are many monsters and effects, even on a strong
// computer, and the longer I play the more it lags"). What made a frame cost more than it had to, and what grew with play:
//   - every monster of the map ran its AI each frame (about 670 of 1,400 had no sleep), wherever you were;
//   - dead monsters that never come back (an invasion's waves, a boss's adds, copies made from the host's list) stayed in
//     the list for the session, and some 30 passes a frame walked them;
//   - each name, level and number over a head was two text rasters a frame;
//   - an area blow that killed ten saved ten times in that frame;
//   - the world's chunks kept every repaint of the same tiles (the archipelago's bridges) and replayed them all;
//   - the bosses' ticks looked their monster up over the whole list several times a frame, and the worn gear over the bag.
// Each case checks the cheaper way gives the same answer as before, and that what grew now stays put.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const SPOT = { x: 90 * 16, y: 60 * 16 }; // the plains west of Winston
async function field() {
  const g = await H.openGame({});
  await H.newGame(g);
  await g.eval((s) => { const G = window.__G; G.P.x = s.x; G.P.y = s.y; G.P.inv = 1e9; }, SPOT);
  await g.step(10);
  return g;
}

test('a monster no player is within 900 px of sleeps; one near you, or one still after you, goes on', async () => {
  const g = await field();
  try {
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, M = G.mons().filter((m) => !m.dead && !m.far && !m.arena);
      const d = (m) => Math.hypot(m.x - P.x, m.y - P.y);
      const near = M.find((m) => d(m) < 400), far = M.filter((m) => d(m) > 2000), chase = far[1];
      chase.eng = 99; // after you from afar: it keeps running
      window.__t = { near, far: far[0], chase, t: [near.t, far[0].t, chase.t] };
      return { n: M.length, far: far.length };
    });
    assert.ok(r.far > 300, 'hundreds of monsters far from you: ' + r.far);
    await g.step(60);
    const [n, f, c] = await g.eval(() => { const o = window.__t; return [o.near.t - o.t[0], o.far.t - o.t[1], o.chase.t - o.t[2]]; });
    assert.ok(n > 0.9, 'the near one lived the second: ' + n);
    assert.equal(f, 0, 'the far one slept');
    assert.ok(c > 0.9, 'the one after you went on: ' + c);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('dead monsters that never come back leave the list after 2 s; one that respawns stays, and so does one still falling', async () => {
  const g = await field();
  try {
    const n0 = await g.eval((s) => {
      const G = window.__G, n = G.mons().length;
      for (let i = 0; i < 40; i++) { const m = G.spawnMon('rabbit', s.x + 200 + i * 4, s.y + 60); window.__GB2.kill(m); }
      const w = G.mons().find((m) => !m.dead && !m.tmp && !m.far && m.type === 'rabbit'); window.__GB2.kill(w); window.__w = w;
      return n;
    }, SPOT);
    assert.equal((await g.eval(() => window.__GPERF.counts().mons)) - n0, 40, 'the 40 dead ones are there at first');
    await g.step(150);
    const c = await g.eval(() => ({ n: window.__GPERF.counts().mons, w: window.__G.mons().includes(window.__w), tmp: window.__G.mons().filter((m) => m.tmp && m.dead).length }));
    assert.equal(c.n, n0, 'gone: the list is back to its size');
    assert.equal(c.tmp, 0);
    assert.ok(c.w, 'the wild one waits to respawn in the list');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('names and numbers over heads: a stamp from the text sprite is the same pixels as drawing it; the sprites stay at 400', async () => {
  const g = await field();
  try {
    const fonts = ['500 21.0px Oswald', 'bold 21.0px Tajawal', '18.0px "Press Start 2P", monospace', 'bold 27.0px sans-serif'];
    for (const f of fonts) for (const [s, c] of [['Lv12', '#ffd23a'], ['Goblin Shaman', '#e8e4d8'], ['12,345', '#ff9a8a'], ['ذئب رمادي', '#9fe0ff'], ['Ahmed 💰', '#8dff9a']]) {
      const r = await g.eval(([s, f, c]) => window.__GPERF.txCmp(s, f, c), [s, f, c]);
      assert.ok(r.ink > 30, `${s} in ${f} drew: ${r.ink}`);
      assert.equal(r.n, 0, `${s} in ${f}: the same pixels`);
    }
    const n = await g.eval(() => { let n = 0; for (let i = 0; i < 1500; i++) n = window.__GPERF.tx(String(i), '500 21.0px Oswald', '#fff'); return n; });
    assert.equal(n, 400, '1,500 different numbers: the last 400 kept');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the same tiles painted again and again (a bridge up and down) keep one paint each, not one a time', async () => {
  const g = await field();
  try {
    const o0 = await g.eval(() => window.__GPERF.counts().ops);
    await g.eval(() => { for (let k = 0; k < 50; k++) for (let i = 0; i < 6; i++) window.__GPERF.put(16 * 40 + i * 16, 16 * 40); });
    assert.equal((await g.eval(() => window.__GPERF.counts().ops)) - o0, 6, '6 tiles, 50 times: 6');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('ten kills in one blow save once, at its end, with all ten in it', async () => {
  const g = await field();
  try {
    const s0 = await g.eval(() => window.__GPERF.counts().saves);
    const k0 = await g.eval(() => window.__G.S.kills.rabbit || 0);
    await g.eval((s) => { const G = window.__G; for (let i = 0; i < 10; i++) window.__GB2.kill(G.spawnMon('rabbit', s.x + 100 + i * 6, s.y)); }, SPOT);
    assert.equal((await g.eval(() => window.__GPERF.counts().saves)) - s0, 1, 'one save for the blow');
    const saved = await g.eval(() => { for (const k of Object.keys(localStorage)) { try { const d = JSON.parse(localStorage.getItem(k)); if (d && d.S && d.S.kills) return d.S.kills.rabbit || 0; } catch (e) {} } return null; });
    assert.equal(saved, k0 + 10, 'the save has the ten kills');
    await g.eval((s) => { const G = window.__G; window.__GB2.kill(G.spawnMon('rabbit', s.x + 100, s.y + 30)); }, SPOT);
    assert.equal((await g.eval(() => window.__GPERF.counts().saves)) - s0, 2, 'the next kill saves again');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a boss looked up by its type, and the gear worn by its uid: the same answer as a search, after the lists change', async () => {
  const g = await field();
  try {
    const r = await g.eval(() => {
      const G = window.__G, Q = window.__GPERF, M = G.mons(), out = [];
      for (const ty of ['guardian', 'belial', 'berith', 'kraken', 'rabbit', 'nosuch']) out.push(Q.monsOf(ty)[0] === M.find((m) => m.type === ty));
      const m = G.spawnMon('trauka', G.P.x, G.P.y); out.push(Q.monsOf('trauka').includes(m));
      M.splice(M.indexOf(m), 1); out.push(!Q.monsOf('trauka').includes(m));
      const S = G.S, it = S.items[0]; out.push(Q.item(it.uid) === it);
      const copy = Object.assign({}, it, { uid: 'zz' + it.uid }); S.items[0] = copy; out.push(Q.item(copy.uid) === copy, Q.item(it.uid) === undefined);
      S.items[0] = it; out.push(Q.item(it.uid) === it);
      return out;
    });
    assert.deepEqual(r, r.map(() => true));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
