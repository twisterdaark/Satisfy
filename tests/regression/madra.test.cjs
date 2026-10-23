'use strict';
// The Undefeated King's Descendant (legends/other-legends.md §9; ch698-713, ch849, ch956): Madra's Old Sheath gives one who
// has never been defeated the hidden quest to destroy the Red Knights in 22 days. Falling once loses it for good and it
// becomes the quest for the 100,000 Army Swordsmanship skill.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Oasis', hair: 1, hc: 2, skin: 1, top: 3 };
const pick = (g, re) => g.eval((src) => { const o = window.__G.DL.opts.find((x) => new RegExp(src).test(x.l)); if (!o) return window.__G.DL.opts.map((x) => x.l).join('|'); o.f(); return 'ok'; }, re.source);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function shut(g) { for (let i = 0; i < 12 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; if (document.getElementById('dopts').hidden || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }

test('never defeated: the sheath opens the quest, 100 Red Knights make the Descendant, and the blockade holds them', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, D = window.__GMD; S.cls = 'warrior'; S.lv = 260; S.mats.mdsheath = 1; D.use(); return { opts: G.DL.opts.length }; });
    assert.equal(r.opts, 2);
    assert.equal(await pick(g, /Accept/), 'ok');
    const c = await g.eval(() => { const G = window.__G, S = G.S, D = window.__GMD, out = { cand: D.cand(), left: D.left(), sheath: S.mats.mdsheath };
      out.res = G.legResist ? G.legResist() : null; return out; });
    assert.equal(c.cand, true); assert.equal(c.left, 22); assert.equal(c.sheath, 0);
    await g.eval(() => { const G = window.__G, D = window.__GMD; for (let i = 0; i < D.N; i++) D.kill({ type: 'redk' }); });
    await wait(900);
    assert.equal(await pick(g, /^(Use|Yes)/), 'ok');
    await shut(g);
    const m = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF; G.isk.checkSkills();
      const out = { cls: S.cls, lv: S.lv, sk: ['mdarmy', 'mdsense'].filter((k) => S.sk[k]), war: 0 };
      S.lv = 60; G.isk.checkSkills(); out.war = Object.keys(S.sk).filter((k) => G.SKD ? G.SKD[k] && G.SKD[k].cls === 'warrior' : !/^md/.test(k)).length > 0;
      for (const x of G.mons()) x.dead = true;
      const a = G.spawnMon('wolf', P.x + 30, P.y), b = G.spawnMon('wolf', P.x - 30, P.y);
      for (const x of [a, b]) { x.max = x.hp = 1e7; x.tmp = 0; }
      P.mp = 1e6; A.cast('mdarmy'); window.__ab = [a, b]; return out; });
    assert.deepEqual([m.cls, m.lv, m.sk], ['madra', 1, ['mdarmy', 'mdsense']]);
    assert.ok(m.war, 'keeps the warrior skills');
    await wait(400);
    const h = await g.eval(() => window.__ab.map((x) => [x.hp < 1e7, x.stun >= 2]));
    assert.deepEqual(h, [[true, true], [true, true]]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('defeated once: no sheath quest; a candidate who falls gets the 100,000 Army Swordsmanship quest instead', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, D = window.__GMD; S.cls = 'knight'; S.lv = 260;
      S.dth = 1; S.mats.mdsheath = 1; D.use(); const refused = !S.mdq && S.mats.mdsheath === 1;
      S.dth = 0; S.mdq = { st: 1, k: 5, e: 0 }; D.die(); const lost = S.mdq.st;
      for (let i = 0; i < D.N; i++) D.kill({ type: 'redk' }); G.isk.checkSkills();
      return { refused, lost, sk: !!S.sk.mdarmy, st: S.mdq.st, dth: S.dth }; });
    assert.equal(r.refused, true, 'only one never defeated');
    assert.equal(r.lost, 3);
    assert.deepEqual([r.sk, r.st, r.dth], [true, 4, 1]);
    // the 22 days run out the same way
    const late = await g.eval(() => { const S = window.__G.S, D = window.__GMD; S.mdq = { st: 1, k: 0, e: 0 }; D.tick(22 * 2400 + 1); return [S.mdq.st, S.mdMsg]; });
    assert.deepEqual(late, [3, 'mdLate']);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
