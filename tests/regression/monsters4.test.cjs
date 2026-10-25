'use strict';
// Four more of the game's own monsters (owner 2026-10-25, encyclopedia §95: GAME_ORIGINAL, each fighting its own way, in
// places that exist, never in a town): the Kobold Sapper, the Dune Shellback, the Thornback Sapling, the Stone Sentinel.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('where they live: saplings and sentinels in the Grey Forest, sappers in the mines, shellbacks in the dunes; none in a town; normal monsters for the XP caps', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, O = window.__GOG, n = {}, z = {}, bad = [];
      for (const m of G.mons()) if (['ksap', 'edune', 'tsap', 'ssent'].includes(m.type)) { n[m.type] = (n[m.type] || 0) + 1; (z[m.type] = z[m.type] || new Set()).add(G.zoneAt(m.x, m.y)); if (O.town(m.x, m.y)) bad.push(m.type); }
      return { n, z: Object.fromEntries(Object.entries(z).map(([k, s]) => [k, [...s].sort()])), bad, kinds: ['ksap', 'edune', 'tsap', 'ssent'].map((k) => window.__GXP.kind(k)), miss: window.__GMON.missing() };
    });
    assert.deepEqual(r.n, { tsap: 8, ssent: 6, ksap: 6, edune: 10 });
    assert.deepEqual(r.z.tsap, ['zGrey']); assert.deepEqual(r.z.ssent, ['zGrey']); assert.deepEqual(r.z.edune, ['zEaDesert']);
    assert.ok(r.z.ksap.every((x) => /^zMine/.test(x)), 'the mines: ' + r.z.ksap);
    assert.deepEqual(r.bad, []);
    assert.deepEqual(r.kinds, ['mob', 'mob', 'mob', 'mob']);
    assert.deepEqual(r.miss, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('their rules: the sentinel is stone until you stand by it, 12 s awake, then 4 s of stone; the shell from above, the curled sapling; the sapling stays rooted; the sapper runs', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, O = window.__GOG, MT = G.isk.MT, S = G.S; S.lv = 110; G.P.inv = 1e9; const out = {};
      const at = (k, dx, dy) => { const m = G.spawnMon(k, G.P.x + dx, G.P.y + (dy || 0)); m.tmp = 1; m.lv = 110; m.hp = m.max = 1e9; return m; };
      const hit = (m) => { const h0 = m.hp; U.hitMon(m, 1, {}); return h0 - m.hp; }, avg = (m) => { let a = 0; for (let i = 0; i < 40; i++) a += hit(m); return a / 40; };
      // the sentinel
      const s = at('ssent', 120); out.sleepHit = hit(s); out.far = O.OGB.ssent(s, MT.ssent, G.P.x - s.x, G.P.y - s.y, 120, 3, .016, false);
      s.x = G.P.x + 30; out.wake = O.OGB.ssent(s, MT.ssent, G.P.x - s.x, 0, 30, 3, .016, false); out.eng = s.eng > 0; out.awakeHit = hit(s) > 0;
      s.o2A = -1; out.stone = O.OGB.ssent(s, MT.ssent, G.P.x - s.x, 0, 30, 3, .016, false) && !(s.eng > 0); out.home = s.x === s.sx && s.y === s.sy;
      // marked fighting by a stun or a taunt, not by its waking: still stone
      s.eng = 4; s.o2A = 0; out.stunImm = hit(s) === 0; s.eng = 0;
      // a push while it is stone: back at its post the next frame
      s.x += 40; O.OGB.ssent(s, MT.ssent, 200, 0, 200, 3, .016, false); out.pinned = s.x === s.sx; out.noWake = O.OGB.ssent(s, MT.ssent, G.P.x - s.x, 0, 30, 3, .016, false) && !(s.eng > 0);
      out.townWake = (() => { s.o2D = 0; const v = O.OGB.ssent(s, MT.ssent, G.P.x - s.x, 0, 30, 3, .016, true); return v && !(s.eng > 0); })(); s.dead = true;
      // the shellback: from the side whole, from above a quarter
      const d = at('edune', 30, 0); const side = avg(d); d.x = G.P.x; d.y = G.P.y + 30; const above = avg(d); out.shell = above / side; d.dead = true;
      // the sapling: from afar whole, close by half; rooted
      const p = at('tsap', 100, 0); const farHit = avg(p); p.x = G.P.x + 20; p.sx = p.x; p.sy = p.y; const nearHit = avg(p); out.curl = nearHit / farHit;
      p.x += 40; O.OGB.tsap(p, MT.tsap); out.rooted = p.x === p.sx; p.dead = true;
      // the sapper: badly hurt, it runs
      const k = at('ksap', 60); k.hp = k.max * .3; O.OGB.ksap(k, MT.ksap, 60, 0, 60, 3, .016, false); out.flee = k.flee > 0; k.dead = true;
      return out;
    });
    assert.equal(r.sleepHit, 0, 'stone: nothing hurts it'); assert.equal(r.far, true, 'asleep from afar');
    assert.equal(r.wake, false); assert.equal(r.eng, true); assert.equal(r.awakeHit, true, 'awake: it can be hurt');
    assert.equal(r.stone, true, 'after its 12 s: stone again'); assert.equal(r.noWake, true, 'and 4 s it will not wake');
    assert.equal(r.townWake, true, 'not woken from a town');
    assert.equal(r.home, true, 'turned to stone, it is back at its post');
    assert.equal(r.stunImm, true, 'a stun or a taunt does not wake it'); assert.equal(r.pinned, true, 'stone is not pushed about');
    assert.ok(r.shell > .18 && r.shell < .33, 'the shell from above: ' + r.shell);
    assert.ok(r.curl > .38 && r.curl < .63, 'curled: ' + r.curl);
    assert.equal(r.rooted, true); assert.equal(r.flee, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
