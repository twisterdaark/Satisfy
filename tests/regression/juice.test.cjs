'use strict';
// SAT-ONLINE-176 game feel (owner 2026-10-24: "improve the visuals, animations and effects; add dopamine"). Only what is
// seen and heard:
//   - a damage number pops in (drawn bigger for a moment) and drifts sideways; a crit jumps up first;
//   - a kill sends orbs of experience to you; kills in a row count up at the side (🔥 2 ...), and break after 4 s;
//   - level up and quest complete show the centre banner;
//   - under 30% health the screen's edge beats red, and stops above it;
//   - the gold count rolls up to what you have;
//   - with Reduced motion: the numbers rise straight at one size, and at most 3 orbs.
// (None of it draws on the game's random numbers: golden, save and rollback runs stay the same.)
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('game feel: numbers, orbs, the streak, the banners, the low-health edge, the gold roll; reduced motion', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G; G.P.inv = 1e9; });
    // a hit: the number pops and drifts
    const n0 = await g.eval(() => { const G = window.__G, P = G.P, m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e9; window.__GWP.hit(m, 1); m.dead = true; return window.__GJ.nums().length; });
    assert.ok(n0 >= 1);
    await g.step(1);
    const a = await g.eval(() => window.__GJ.nums().find((n) => /^\d+$/.test(n.s)));
    assert.ok(a && a.z > 1, 'bigger as it appears: ' + (a && a.z));
    await g.step(20);
    const b = await g.eval((s) => window.__GJ.nums().find((n) => n.s === s), a.s);
    assert.ok(b && b.z === 1, 'then its own size');
    assert.notEqual(b.x, a.x, 'drifted sideways');
    // two kills in a row: orbs, then the streak
    const k1 = await g.eval(() => { const G = window.__G, P = G.P, m = G.spawnMon('wolf', P.x + 30, P.y); m.hp = 1; window.__GWP.hit(m, 5); return { dead: m.dead, orbs: window.__GJ.orbs(), n: window.__GJ.st.n }; });
    assert.equal(k1.dead, true);
    assert.ok(k1.orbs >= 2, 'orbs: ' + k1.orbs);
    assert.equal(k1.n, 1);
    await g.step(30);
    const k2 = await g.eval(() => { const G = window.__G, P = G.P, m = G.spawnMon('wolf', P.x + 30, P.y); m.hp = 1; window.__GWP.hit(m, 5); const e = document.getElementById('jstk'); return { n: window.__GJ.st.n, on: e.classList.contains('on'), t: e.textContent }; });
    assert.deepEqual(k2, { n: 2, on: true, t: '🔥 2' });
    // the orbs reach you and go
    await g.step(200);
    assert.equal(await g.eval(() => window.__GJ.orbs()), 0, 'the orbs arrived');
    // 4 s without a kill: the streak breaks
    await g.step(60);
    assert.deepEqual(await g.eval(() => [window.__GJ.st.n, document.getElementById('jstk').classList.contains('on')]), [0, false]);
    // level up: the banner
    const lv = await g.eval(() => { const G = window.__G, S = G.S, l = S.lv; G.gainXP(5000); return { l, now: S.lv, ban: window.__GJ.ban() }; });
    assert.ok(lv.now > lv.l);
    assert.equal(lv.ban.on, true);
    assert.equal(lv.ban.t, 'LEVEL UP!');
    assert.match(lv.ban.s, new RegExp('Level ' + lv.now));
    // quest complete: the banner, green
    const q = await g.eval(() => {
      const G = window.__G, QD = G.QD, id = Object.keys(QD).find((k) => { const q = QD[k]; return q.obj && q.obj.t === 'kill' && q.gold > 0 && !q.rep && !q.item && !q.cls && !q.title && !q.pts; });
      G.S.lv = Math.max(G.S.lv, 300); G.S.xp = 0; G.acceptQ(id); G.S.qs[id].c = QD[id].obj.n; /* no level-up from the reward (XP x1.2) */ G.completeQ(id); return window.__GJ.ban(); });
    // (after the level's banner: one at a time)
    for (let i = 0; i < 20 && (await g.eval(() => window.__GJ.ban().t)) !== 'QUEST COMPLETE!'; i++) await g.step(20);
    Object.assign(q, await g.eval(() => window.__GJ.ban()));
    assert.equal(q.t, 'QUEST COMPLETE!');
    assert.match(q.k, /\bq\b/);
    // the gold rolls up
    await g.step(10);
    const gold = await g.eval(() => { const S = window.__G.S; S.gold += 5000; return S.gold; });
    await g.step(2);
    const mid = await g.eval(() => window.__GJ.gold());
    assert.ok(mid < gold, 'on its way: ' + mid + ' < ' + gold);
    await g.step(90);
    assert.equal(await g.eval(() => window.__GJ.gold()), gold);
    // low health: the red edge, and not above 30%
    await g.eval(() => { const G = window.__G; G.P.hp = window.__GTTL.mh() * .2; });
    await g.step(12); // the HUD every 0.1 s
    assert.equal(await g.eval(() => window.__GJ.low() && document.getElementById('jlow').classList.contains('on')), true);
    await g.eval(() => { const G = window.__G; G.P.hp = window.__GTTL.mh(); });
    await g.step(12);
    assert.equal(await g.eval(() => window.__GJ.low()), false);
    // a boss's entrance: the letterbox and its name, once in three minutes for each kind of boss
    for (let i = 0; i < 20 && (await g.eval(() => window.__GJ.ban().on)); i++) { await g.step(30); await g.page.waitForTimeout(150); }
    await g.eval(() => { const G = window.__G, P = G.P, m = G.spawnMon('guardian', P.x + 60, P.y); m.max = m.hp = 1e9; m.prov = 1e9; window.__gb = m; });
    for (let i = 0; i < 10 && !(await g.eval(() => window.__GJ.lb)); i++) await g.step(6);
    const bo = await g.eval(() => ({ ban: window.__GJ.ban(), lb: window.__GJ.lb, bar: !document.getElementById('boss').hidden }));
    assert.equal(bo.bar, true, 'the boss bar');
    assert.equal(bo.lb, true, 'the letterbox');
    assert.match(bo.ban.k, /\bb\b/);
    assert.match(bo.ban.s, /^BOSS · Lv \d+$/);
    await g.eval(() => { document.querySelector('#jban b').textContent = 'x'; });
    await g.step(30);
    assert.equal(await g.eval(() => document.querySelector('#jban b').textContent), 'x', 'not again at once');
    await g.eval(() => { window.__gb.dead = true; });
    // a heavy hit flashes the edge; a light one doesn't
    await g.eval(() => window.__GJ.hurt(1));
    assert.equal(await g.eval(() => window.__GJ.hit), false);
    await g.eval(() => window.__GJ.hurt(window.__GTTL.mh() * .2));
    assert.equal(await g.eval(() => window.__GJ.hit), true);
    // reduced motion: numbers rise straight at their size; at most 3 orbs
    const rm = await g.eval(() => { window.__GRMO.set(true); const G = window.__G, P = G.P, m = G.spawnMon('wolf', P.x + 30, P.y); m.hp = 1; window.__GWP.hit(m, 5); return window.__GJ.orbs(); });
    assert.ok(rm <= 3, 'orbs: ' + rm);
    await g.step(1);
    const r1 = await g.eval(() => window.__GJ.nums().filter((n) => n.a0 != null).slice(-1)[0]);
    await g.step(10);
    const r2 = await g.eval((s) => window.__GJ.nums().filter((n) => n.s === s).slice(-1)[0], r1.s);
    assert.equal(r1.z, 1);
    assert.equal(r2.x, r1.x, 'straight up');
    await g.eval(() => window.__GRMO.set(false));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
