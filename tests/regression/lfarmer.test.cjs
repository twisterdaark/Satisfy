'use strict';
// The Legendary Farmer (legends/npc-legends.md §1; ch253, ch316-336): Piaro's path for a swordsman who farms. Win his field
// 30 times, beat him in a spar, and Free Farming starts over at level 1: seeds sown, then Rapid Growth binds where they fell.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Piaro', hair: 1, hc: 2, skin: 1, top: 3 };
const pick = (g, re) => g.eval((src) => { const o = window.__G.DL.opts.find((x) => new RegExp(src).test(x.l)); if (!o) return window.__G.DL.opts.map((x) => x.l).join('|'); o.f(); return 'ok'; }, re.source);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function shut(g) { for (let i = 0; i < 12 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; if (document.getElementById('dopts').hidden || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }

test('Piaro asks a farming swordsman for 30 harvests and a spar; Sowing then Rapid Growth binds the enemies', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, F = window.__GLFA, out = {};
      S.cls = 'mage'; out.mage = F.opts().length;
      S.cls = 'warrior'; S.lv = 260; F.opts()[0].f(); out.low = G.DL.opts ? G.DL.opts.length : 0;
      S.sec = 'farmer'; S.life = S.life || {}; S.life.farm = 600; F.opts()[0].f(); return out; });
    assert.equal(r.mage, 0, 'only the swordsmen');
    assert.equal(await pick(g, /Accept/), 'ok');
    const h = await g.eval(() => { const G = window.__G, S = G.S, F = window.__GLFA; for (let i = 0; i < F.N; i++) F.harv(); F.opts()[0].f(); return { h: S.lfq.h, o: G.DL.opts.map((x) => x.l) }; });
    assert.equal(h.h, 30); assert.ok(h.o.some((l) => /Spar with Piaro/.test(l)), h.o.join('|'));
    await shut(g);
    const s = await g.eval(() => { const G = window.__G; window.__GLFA.spar(); const m = G.mons().find((x) => x.lgq === 'lfarmer'); return !!m && !!m.spar; });
    assert.equal(s, true);
    await shut(g);
    await g.eval(() => { const G = window.__G; for (const m of G.mons()) if (m.lgq) m.dead = true; window.__G.S.cls = 'warrior'; window.__GLG.won('lfarmer'); });
    assert.equal(await pick(g, /^(Use|Yes)/), 'ok');
    await shut(g);
    const c = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF; G.isk.checkSkills();
      const out = { cls: S.cls, lv: S.lv, sk: ['lfsow', 'lfgrow', 'lfplow', 'lfnat', 'lfharv'].filter((k) => S.sk[k]) };
      for (const m of G.mons()) m.dead = true;
      const a = G.spawnMon('wolf', P.x + 40, P.y); a.max = a.hp = 1e7; a.tmp = 0; window.__a = a;
      P.mp = 1e6; A.cast('lfsow'); return out; });
    assert.deepEqual([c.cls, c.lv, c.sk], ['lfarmer', 1, ['lfsow', 'lfgrow', 'lfplow', 'lfnat']]);
    await wait(300);
    const g2 = await g.eval(() => { const G = window.__G, P = G.P, A = window.__GSKF, a = window.__a; const seeds = window.__GLFA.LFS.length, hp = a.hp; a.stun = 0; P.mp = 1e6; A.cast('lfgrow'); return { seeds, sown: hp < 1e7, stun: a.stun }; });
    assert.ok(g2.seeds >= 1); assert.equal(g2.sown, true); assert.ok(g2.stun >= 1.5, 'Rapid Growth binds: ' + g2.stun);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
