'use strict';
// S and SS quests (major 14, novel ch 4-5, 202, 256-258, 330): a graded quest shows its grade, time limit and failure
// price; it fails when the time runs out or when it is given up, costs its levels and is gone for good. Doran's rescue of
// Irene (S), Piaro's revenge on Asmophel behind the Seventh Servant Dark Bus (SS) and King Wiesbaden's six ancient
// weapons (SS).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const offer = (g, id) => g.eval((id) => { const G = window.__G; G.talkNPC(id); const D = G.DL; return D ? { lines: D.lines.slice(), opts: (D.opts || []).map((o) => o.l) } : null; }, id);

test('the S quest: Doran offers it with its grade; Irene is freed in time and he pays', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // Doran stands on open ground outside the ruins of Yatan's temple
    const d = await g.eval(() => { const G = window.__G, n = G.npcs.find((n) => n.id === 'doranS'); return { z: G.zoneAt(n.x, n.y), solid: G.eqx.solid(Math.floor(n.tx), Math.floor(n.ty)), near: Math.hypot(n.x - 465 * 16, n.y - 30 * 16) }; });
    assert.equal(d.solid, false); assert.ok(d.near < 16 * 8, JSON.stringify(d));
    // too low: no offer; at 150 the window carries the grade, the hour and the price
    await g.eval(() => { const G = window.__G; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } G.S.lv = 150; G.gainXP(1); });
    const o = await offer(g, 'doranS');
    const txt = o.lines.join('\n');
    assert.ok(/Difficulty: S/.test(txt) && /60 minutes/.test(txt) && /Level -2/.test(txt) && /15,000|15000/.test(txt) && /Doran's Ring/.test(txt), txt);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && !(G.DL && G.DL.optOn); i++) G.advance(); G.pickOpt(0); });
    await g.step(2);
    const a = await g.eval(() => { const G = window.__G, E = window.__GEP, s = G.S.qs.irn, o = E.irene(); return { st: s && s.st, left: Math.round(E.left('irn') / 60000), vis: E.vis(o), name: document.getElementById('quest').textContent }; });
    assert.equal(a.st, 1); assert.equal(a.left, 60); assert.equal(a.vis, true);
    assert.ok(/\(S\)/.test(a.name) && /⏳/.test(a.name), a.name);
    // owner 2026-10-22: no walking in and out. By the altar the elders of Yatan wake, and the ropes hold while they live
    const h = await g.eval(() => { const G = window.__G, E = window.__GEP, o = E.irene(); G.P.x = o.x; G.P.y = o.y + 8; E.tick(); E.act(o);
      const gd = G.mons().filter((m) => m.irnG && !m.dead); return { n: gd.length, elder: gd.filter((m) => m.nm === 'Elder of Yatan').length, ready: G.S.qs.irn.c || 0 }; });
    assert.deepEqual(h, { n: 4, elder: 1, ready: 0 });
    await g.eval(() => { const G = window.__G; G.DL = null; for (const m of G.mons()) if (m.irnG && !m.dead) window.__GU.killMon(m); window.__GEP.tick(); });
    // free Irene, then Doran pays 15,000 gold, Doran's Ring and a level's worth of experience, with a fanfare
    const b = await g.eval(() => { const G = window.__G, E = window.__GEP, o = E.irene(); E.act(o); const g0 = G.S.gold, l0 = G.S.lv; G.completeQ('irn'); return { vis: E.vis(o), gold: G.S.gold - g0, up: G.S.lv > l0, ring: G.S.items.some((i) => i.id === 'doran'), st: G.S.qs.irn.st, z: G.zoneAt(o.x, o.y) }; });
    assert.deepEqual(b, { vis: false, gold: 15000, up: true, ring: true, st: 2, z: 'zYatan' });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('failing a graded quest: the hour runs out or it is given up; levels go and it never comes back', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, E = window.__GEP, S = G.S, o = {};
      S.lv = 160; G.gainXP(1); G.acceptQ('irn'); S.qs.irn.t0 = Date.now() - 61 * 60000; E.tick();
      o.time = [S.qs.irn.st, S.lv]; G.talkNPC('doranS'); o.offered = !!(G.DL && G.DL.opts && G.DL.opts.some((x) => /Accept/.test(x.l || ''))); // (Doran has Talk now, v2.90: the quest's offer is what must be gone) G.DL && G.pickOpt && G.DL.opts && G.pickOpt(G.DL.opts.length - 1);
      // giving up Defense War II is failing it (no levels: its price is the kingdom's)
      S.lv = 240; G.gainXP(1); G.acceptQ('dw2'); G.openQD('dw2'); const c = () => document.getElementById('qdCancel').click(); c(); c();
      o.quit = [S.qs.dw2.st, S.lv];
      return o;
    });
    assert.deepEqual(r.time, [3, 158]);
    assert.equal(r.offered, false, 'a failed quest is gone');
    assert.deepEqual(r.quit, [3, 240]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the SS quests: Dark Bus shields Asmophel until he falls; the six ancient weapons pay the kingdom and the guild', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, E = window.__GEP, S = G.S, A = E.ASMO, o = {};
      const asmo = G.mons().find((m) => m.type === 'asmo'), bus = G.mons().find((m) => m.type === 'dbus');
      o.zone = G.zoneAt(asmo.x, asmo.y); o.knights = G.mons().filter((m) => m.type === 'redk' && G.zoneAt(m.x, m.y) === 'zAsmo').length;
      o.wall = G.eqx.solid(A.x0, A.y0 + 5); o.gate = G.eqx.solid(A.gx, A.y1);
      S.lv = 290; G.gainXP(1); G.acceptQ('asm');
      o.shield = E.atk(asmo);
      window.__GB2.kill(bus); o.after = E.atk(asmo);
      asmo.hp = 1; window.__GB2.kill(asmo); o.ready = S.qs.asm.st === 1 && S.qs.asm.c === 1;
      G.completeQ('asm'); o.piaro = (S.aff || {}).piaro;
      // the six ancient weapons
      const kc0 = S.kc || 0, g0 = S.gold; G.acceptQ('dw2'); for (let i = 0; i < 6; i++) window.__GC2.ev('kill', 'aweapon'); G.completeQ('dw2');
      o.dw2 = [S.qs.dw2.st, (S.kc || 0) - kc0, S.gold - g0];
      return o;
    });
    await g.page.waitForTimeout(1600);
    const tl = await g.eval(() => ({ shero: !!window.__G.S.tl.shero, yslay: !!window.__G.S.tl.yslay, es: window.__G.S.mats.estone || 0 }));
    assert.equal(r.zone, 'zAsmo'); assert.ok(r.knights >= 4, 'his guards: ' + r.knights);
    assert.equal(r.wall, true); assert.equal(r.gate, false);
    assert.equal(r.shield, 0.1); assert.equal(r.after, 1);
    assert.equal(r.ready, true); assert.equal(r.piaro, 100);
    assert.deepEqual(r.dw2, [2, 50000, 500000]);
    assert.equal(tl.shero, true); assert.equal(tl.yslay, true); assert.ok(tl.es >= 10);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
