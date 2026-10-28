'use strict';
// XP caps (owner 2026-10-25, encyclopedia §96; DESIGN_BALANCE): after every multiplier one source gives at most a share of
// what your level needs: a normal monster 2.0% / 1.5% / 1.1% / 0.9% / 0.8% (Lv 100 / 200 / 300 / 400 / 480+), nothing below
// 100; an elite 2.5% at 480; a boss 10% the first clear and 1.5% after; a repeatable task 2%, a story quest 8% (these ease
// in from a whole level at 400; an elite is about three normal kills, 3.125 times the normal cap of the level). Nothing under its cap changes. A boss's kill counts once (a reconnect, a late message, a reload
// within 45 s gives nothing again). xpNeed, the level, the stored XP and the gear of a save are as they were.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
// one real kill of a monster of type k at level ml by a character of level L; what it gave
const kill = (g, k, L, ml, o = {}) => g.eval(([k, L, ml, o]) => {
  const G = window.__G, S = G.S, U = window.__GU; S.lv = L; S.xp = 0; if (o.rx != null) S.rx = o.rx;
  const m = G.spawnMon(k, G.P.x + 30, G.P.y); m.tmp = 0; if (ml) m.lv = ml; m.hp = 1; const l0 = S.lv; U.killMon(m); const got = S.xp + (S.lv > l0 ? 1e15 : 0); S.lv = L; S.xp = 0; m.dead = true; m.rt = 1e9;
  return { got, need: G.xpNeed(), base: G.isk.MT[k].xp, rx: S.rx };
}, [k, L, ml, o]);

test('a normal monster: capped by level band from 100, untouched below; a reward under its cap is what it was', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const c = await g.eval(() => { const X = window.__GXP; return [50, 99, 100, 199, 200, 299, 300, 399, 400, 479, 480, 600].map((L) => +(X.capP('mob', L) * 100).toFixed(3)); });
    assert.deepEqual(c, [0, 0, 2, 2, 1.5, 1.5, 1.1, 1.1, 0.9, 0.9, 0.8, 0.8]);
    // a Lv 470 Mureungdowon ghost at 480 gives less than the cap (its level is under yours): as before
    const a = await kill(g, 'eghost', 480, 470);
    assert.equal(a.got, Math.round(a.base * 1.2 * 0.7), 'x1.2, and 0.7 for 10 levels under you: ' + a.got);
    // at its own level and above, with the XP food on, it reaches the cap: 0.8% of 49,338,544
    await g.eval(() => { const S = window.__G.S; S.xpb = Date.now() + 6e5; S.xpbU = Date.now() + 6e5; });
    const b = await kill(g, 'eghost', 480, 495);
    assert.ok(b.got <= Math.round(b.need * .008) && b.got >= Math.round(b.need * .008) - 1, 'at the cap: ' + b.got + ' of ' + b.need);
    // below level 100 nothing is capped (a monster far above you gives 1.3 times)
    await g.eval(() => { const S = window.__G.S; S.xpb = 0; S.xpbU = 0; });
    const d = await kill(g, 'lizard', 60, 120);
    assert.ok(Math.abs(d.got - d.base * 1.3 * 1.2) <= 1, 'x1.3 and x1.2: ' + d.got + ' of ' + d.base + ' need ' + d.need);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('bosses at 480: 10% the first clear, 1.5% after; easing in from 400, no wall at 480; the drops and the quest credit stay', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const f = await kill(g, 'hydra', 480);
    assert.equal(f.got, Math.round(f.need * .10), 'the first Hydra: 10% (it gave 61%)');
    await g.eval(() => { window.__G.S.bkt.hydra = Date.now() - 60000; });
    const r = await kill(g, 'hydra', 480);
    assert.equal(r.got, Math.round(r.need * .015), 'again: 1.5%');
    const s = await g.eval(() => window.__G.S.kills.hydra);
    assert.equal(s, 2, 'both kills count (quests, the bestiary)');
    // Fenrir first at 480: 10% (it gave 88%)
    const fe = await kill(g, 'vfenrir', 480);
    assert.equal(fe.got, Math.round(fe.need * .10));
    // the ease: a whole level at 400, then down smoothly; a level under 480 is barely more than 480
    const e = await g.eval(() => { const X = window.__GXP; return { r399: X.capP('bossR', 399), r400: X.capP('bossR', 400), r440: X.capP('bossR', 440), r479: X.capP('bossR', 479), r480: X.capP('bossR', 480), f479: X.capP('boss1', 479), f480: X.capP('boss1', 480) }; });
    assert.equal(e.r399, 0, 'under 400 a boss is not capped');
    assert.ok(Math.abs(e.r400 - 1) < 1e-9, 'a level at most at 400 (a boss of 500 gave two)');
    assert.ok(e.r440 > .05 && e.r440 < .15, 'halfway: ' + e.r440);
    assert.ok(e.r479 / e.r480 < 1.06 && e.f479 / e.f480 < 1.03, 'no step at 480');
    // elites: about three normal kills from 100 (2.5% at 480); the old Ancient Weapon at 250 gave 156% a kill
    const el = await g.eval(() => { const X = window.__GXP; return [X.capP('elite', 90), X.capP('elite', 250), X.capP('elite', 340), X.capP('elite', 480), X.kind('aweapon'), X.kind('ferB')]; });
    assert.deepEqual(el.slice(0, 4).map((x) => +x.toFixed(6)), [0, .046875, .034375, .025]);
    assert.deepEqual(el.slice(4), ['elite', 'elite']);
    const ag = await kill(g, 'aweapon', 250, 300);
    assert.equal(ag.got, Math.round(ag.need * .046875), 'the Ancient Weapon at 250: 4.7% (it gave 156%)');
    // an invasion's captain or elite (made so when it spawns) is an elite too
    const cp = await g.eval(() => { const X = window.__GXP, G = window.__G, m = G.spawnMon('rabbit', G.P.x + 30, G.P.y); m.cap = 1; const k = X.src(m, 0); m.dead = true; m.rt = 1e9; return k; });
    assert.equal(cp, 'elite');
    // a boss under its cap gives what it gave: a Lv 400 ghost of the 6th city at 480 (3.2%)
    await g.eval(() => { window.__G.S.kills.vb6 = 0; });
    const v = await kill(g, 'vb6', 480);
    assert.equal(v.got, Math.round(v.base * 1.2 * 0.1), 'vb6 at 480 is 80 levels under you: x0.1, under the cap');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a boss counts once: the same boss again within 45 s, even after a reload, gives nothing; then again 1.5%', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const a = await kill(g, 'belial', 480);
    assert.equal(a.got, Math.round(a.need * .10));
    const b = await kill(g, 'belial', 480);
    assert.equal(b.got, 0, 'a second message for the same kill');
    // quit, reload, continue (a reconnect): the kill is in the save
    const t0 = await g.eval(() => { window.__G.S.lv = 480; window.__G.save(true); window.__G.act('quit'); return window.__G.S.bkt.belial; });
    await g.waitMode('title'); await g.reload(); await H.continueGame(g);
    // the kill's time came back with the save; a slow machine may take longer than 45 s to get here, so the window is held open
    assert.equal(await g.eval(() => { window.__GXP.C.BOSS_DUP_MS = 36e5; return window.__G.S.bkt.belial; }), t0);
    const c = await kill(g, 'belial', 480);
    assert.equal(c.got, 0, 'still the same kill after the reload');
    await g.eval(() => { window.__GXP.C.BOSS_DUP_MS = 45000; window.__G.S.bkt.belial = Date.now() - 46000; });
    const d = await kill(g, 'belial', 480);
    assert.equal(d.got, Math.round(d.need * .015), 'the next one: 1.5% (the first clear is spent)');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the inn\'s rest is not wasted on a capped kill; quests and dailies are capped; exact grants are not', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    // at the cap already: the rest is kept for a kill under it
    const a = await kill(g, 'eghost', 480, 495, { rx: 5e6 });
    assert.equal(a.rx, 5e6, 'no rest spent on a capped kill');
    const b = await kill(g, 'eghost', 480, 470, { rx: 5e6 });
    assert.ok(b.got <= Math.round(b.need * .008) + 1 && b.got > Math.round(b.base * 1.2 * .7), 'the rest doubles it, up to the cap: ' + b.got);
    assert.ok(b.rx < 5e6);
    // a repeatable quest 2%, a story quest 8% at 480; under 400 as before
    const q = await g.eval(() => { const X = window.__GXP, G = window.__G, S = G.S, out = {}; for (const [k, src, L] of [['r480', 'rquest', 480], ['s480', 'squest', 480], ['s300', 'squest', 300]]) { S.lv = L; S.xp = 0; out[k] = X.gain(1e9, 0, src); out[k + 'n'] = G.xpNeed(); } S.lv = 480; S.xp = 0; out.exact = X.gain(G.xpNeed() - 1, 1); out.lv = S.lv; S.xp = 0; return out; });
    assert.equal(q.r480, Math.round(q.r480n * .02));
    assert.equal(q.s480, Math.round(q.s480n * .08));
    assert.ok(q.s300 > q.s300n, 'a story quest at 300: not capped');
    assert.equal(q.lv, 480, 'an exact grant just under a level: given whole');
    assert.equal(q.exact, q.s480n - 1);
    // NaN or nothing gives nothing (and breaks nothing)
    const n = await g.eval(() => { const X = window.__GXP, S = window.__G.S; S.xp = 5; X.gain(NaN); X.gain(-3); X.gain(undefined, 0, 'mob'); return S.xp; });
    assert.equal(n, 5);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a level 480 save loads as it was: level, XP, points and gear untouched by the caps', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const before = await g.eval(() => { const G = window.__G, S = G.S; S.lv = 480; S.xp = 31234567; S.pts = 12; const it = G.isk.mkItem('yetgs', 4); S.items.push(it); G.isk.equip(it); S.kills.hydra = 9; G.save(true); return JSON.stringify({ lv: S.lv, xp: S.xp, pts: S.pts, w: S.eqW, items: S.items.map((i) => i.id + ':' + i.r + ':' + i.atk), kills: S.kills.hydra }); });
    await g.eval(() => window.__G.act('quit')); await g.waitMode('title'); await g.reload(); await H.continueGame(g);
    const after = await g.eval(() => { const S = window.__G.S; return JSON.stringify({ lv: S.lv, xp: S.xp, pts: S.pts, w: S.eqW, items: S.items.map((i) => i.id + ':' + i.r + ':' + i.atk), kills: S.kills.hydra }); });
    assert.equal(after, before);
    // the Hydra this character already killed nine times is not a first clear
    const r = await kill(g, 'hydra', 480);
    assert.equal(r.got, Math.round(r.need * .015));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the other sources: a spar is a fight (the normal cap) and gives XP five bouts a day; the weekly watch 12%, a new zone 1.5%', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, T = window.__GT, S = G.S, X = window.__GXP, out = { xp: [], gold: [] };
      S.lv = 480; S.xp = 0;
      for (let i = 0; i < 7; i++) {
        T.tick(0.016); const f = T.tf().find((x) => x.role === 'spar' && x.T === 'zWin' && !x.busy);
        G.P.x = f.x + 20; G.P.y = f.y; G.P.hp = G.maxHP(); T.spar(f);
        const m = T.SPAR.m, x0 = S.xp, g0 = S.gold; m.hp = Math.floor(m.max * 0.2); T.tick(0.016);
        out.xp.push(S.xp - x0); out.gold.push(S.gold - g0 > 0); S.lv = 480; S.xp = 0;
      }
      out.need = G.xpNeed();
      out.weekly = X.gain(1e12, 0, 'weekly'); S.xp = 0; out.disc = X.gain(1e12, 0, 'disc'); S.xp = 0;
      return out;
    });
    for (let i = 0; i < 5; i++) assert.equal(r.xp[i], Math.round(r.need * .008), 'bout ' + (i + 1) + ': the normal cap at 480 (it was 3.6%)');
    assert.deepEqual(r.xp.slice(5), [0, 0], 'the sixth bout of the day and after: gold only');
    assert.ok(r.gold.every(Boolean), 'every win still pays its gold');
    assert.equal(r.weekly, Math.round(r.need * .12));
    assert.equal(r.disc, Math.round(r.need * .015));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
