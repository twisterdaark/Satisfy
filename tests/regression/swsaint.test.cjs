'use strict';
// Sword Saint against the novel (owner 2026-10-22): the SSS quest "Win against a legend" from Piaro (ch 348); winning gives the
// class at level 1 (ch 463); Kraugel's own art (Space Sword, Control Sword, Manifestation of Will, Heart Sword, True Clouds,
// Frenzy Sword) and the party aura; Muller's sword is the class quest, where Muller's technique can be refused (ch 1254, 1746).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Sword Saint: Piaro\'s quest, the spar against a legend, the class, the kit and the class quest', async () => {
  const g = await H.openGame({ storage: { satisfy_lang: 'en' } });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    // a warrior at 150 takes the quest from Piaro and spars him; Piaro is drawn as himself
    const q = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GSS; S.cls = 'warrior'; S.lv = 150;
      const o = X.ssqOpts(); o[0].f(); const D = G.DL; return { n: o.length, opts: D && D.opts && D.opts.length }; });
    assert.equal(q.n, 1);
    const sp = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GSS; S.ssq = 1; document.getElementById('dialog').hidden = true; G.DL = null;
      const o = X.ssqOpts(); o[0].f(); const D = G.DL; D.opts[0].f(); const m = X.SPAR && X.SPAR.m; return m ? { fig: m.fig, ssq: m.ssq, spar: m.spar } : null; });
    assert.deepEqual(sp, { fig: 'piaro', ssq: 1, spar: 1 });
    // he yields at a quarter of his health: a battle against a legend is won and the class is offered
    await g.eval(() => { const m = window.__GSS.SPAR.m; m.hp = m.max * .2; });
    await g.step(60);
    await new Promise((r) => setTimeout(r, 900));
    const w = await g.eval(() => { const G = window.__G, S = G.S, D = G.DL; return { ssqW: S.ssqW, opts: D && D.opts && D.opts.map((o) => o.l) }; });
    assert.equal(w.ssqW, 1);
    await g.eval(() => { window.__G.DL.opts[0].f(); });
    await g.step(5);
    const c = await g.eval(() => { const S = window.__G.S; return { cls: S.cls, lv: S.lv, rec: !!window.__GL.legends().muller, txt: document.getElementById('dialog').textContent }; });
    assert.equal(c.cls, 'saint'); assert.equal(c.lv, 1); assert.ok(c.rec);
    // the kit casts; the aura lifts damage; a Control Sword at your side catches 40% of a hit
    const k = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GP2; S.lv = 260; S.qs = S.qs || {}; for (const id of ['ms1', 'ms2', 'ms3']) S.qs[id] = { done: 1 };
      P.inv = 1e9; P.hp = 1e9; P.mp = 1e6; P.x = 90 * 16; P.y = 60 * 16; P.dir = 2;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } const m = G.spawnMon('forc', P.x + 30, P.y); m.max = m.hp = 1e9; m.lv = 260; m.tmp = 0; window.__m = m;
      const Y = window.__GPH, a0 = Y.atk(m), h0 = Y.hurt(100, m); X.sk('sctl'); const h1 = Y.hurt(100, m);
      for (const c of ['mcross', 'mheaven', 'mwind', 'scloud', 'mflash']) X.sk(c);
      return { a0, h0, h1, slow: m.slowU > 0, weak: m.weak > 0, stun: m.stun > 0, lost: m.hp < m.max, wil: window.__GSS.wilV() }; });
    assert.equal(k.a0, 1.3, 'the aura'); assert.equal(k.h1, Math.round(k.h0 * .6), 'a sword catches the hit'); assert.ok(k.slow && k.weak, 'Space Sword leaves irreparable damage');
    assert.ok(k.stun, 'True Clouds holds the foe'); assert.ok(k.lost); assert.equal(k.wil, 520);
    // the swords fly out and cut on their own
    for (let i = 0; i < 12 && await g.eval(() => window.__G.mode) === 'dialog'; i++) { await g.page.keyboard.press('Space'); await g.step(20); }
    const sw = await g.eval(() => { const G = window.__G, m = window.__m, P = G.P; m.hp = m.max; m.dead = false; P.cd.sctl = 0; window.__GP2.sk('sctl'); return { n: P.ctlS.length, hp: m.hp }; });
    assert.equal(sw.n, 4, 'four swords at first');
    await g.step(90);
    const sw2 = await g.eval(() => ({ hp: window.__m.hp, out: window.__G.P.ctlS && window.__G.P.ctlS.length }));
    assert.ok(sw2.hp < sw.hp, 'the swords cut the foe'); assert.equal(sw2.out, 4);
    // Muller's sword: refusing his technique is Kraugel's road
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GSS; const a = S.st.str; X.msEnd(1); return { mq: S.mq, d: S.st.str - a, wil: X.wilV() }; });
    assert.deepEqual(r, { mq: 2, d: 30, wil: 720 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
