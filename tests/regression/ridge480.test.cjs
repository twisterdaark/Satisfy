'use strict';
// For level 480 (owner 2026-10-25; encyclopedia §95/§96): new normal monsters made for the game (GAME_ORIGINAL) on the
// Chaos Mountains' Fourth Ridge, where Belial and the fourth Sanju are and nothing normal stood above 460. The Ridge
// Revenant is shielded while its Soul Lantern burns; the Cinder Strider burns the ground it runs over. Their XP is under
// the normal monster's cap, and the bosses of the ridge are where they were, at their levels.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Fourth Ridge: twelve revenants each with its lantern, ten striders, away from the bosses; the bosses unchanged', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__G48, ms = G.mons(), MT = G.isk.MT;
      const rev = ms.filter((m) => m.type === 'crevn'), lan = ms.filter((m) => m.type === 'clant'), st = ms.filter((m) => m.type === 'cstrid');
      const boss = ms.filter((m) => m.type === 'belial' || m.type === 'sanju4');
      return { rev: rev.length, lan: lan.length, st: st.length, paired: rev.every((m) => X.lan(m) && X.rev(X.lan(m)) === m),
        zones: [...new Set([...rev, ...st].map((m) => G.zoneAt(m.x, m.y)))], near: [...rev, ...st].some((m) => boss.some((b) => Math.abs(b.x - m.x) < 28 * 16)),
        bossLv: boss.map((b) => [b.type, MT[b.type].lv.join('-')]).sort(), kinds: ['crevn', 'clant', 'cstrid'].map((k) => window.__GXP ? window.__GXP.kind(k) : 'mob'),
        miss: window.__GMON.missing() };
    });
    assert.deepEqual([r.rev, r.lan, r.st], [12, 12, 10]);
    assert.ok(r.paired, 'each revenant finds its lantern and the lantern its revenant');
    assert.deepEqual(r.zones, ['zChaos4']);
    assert.equal(r.near, false, 'none within 28 tiles of Belial or the fourth Sanju');
    assert.deepEqual(r.bossLv, [['belial', '480-480'], ['sanju4', '500-500']]);
    assert.deepEqual(r.kinds, ['mob', 'mob', 'mob'], 'normal monsters, under the normal cap');
    assert.deepEqual(r.miss, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the revenant: a tenth while its lantern burns (a word the first time), whole once the lantern is out, shielded again when it comes back', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, X = window.__G48, S = G.S; S.lv = 480; G.P.inv = 1e9;
      const m = G.mons().find((x) => x.type === 'crevn'), l = X.lan(m);
      G.P.x = m.x - 30; G.P.y = m.y;
      const hit = () => { const h0 = m.hp; U.hitMon(m, 1, {}); return h0 - m.hp; };
      const out = { tip0: !!(S.hid || {}).o48t };
      let a = 0; for (let i = 0; i < 20; i++) a += hit(); out.shielded = a / 20; out.tip = !!S.hid.o48t;
      l.hp = 1; U.killMon(l); out.lanDead = l.dead;
      let b = 0; for (let i = 0; i < 20; i++) b += hit(); out.open = b / 20; out.shieldNow = X.shield(m);
      l.dead = false; l.hp = l.max; out.back = X.shield(m);
      // a revenant whose wandering was blocked makes where it stands its home: still its lantern's
      m.sx += 37; m.sy -= 21; m.o48s = 0; out.moved = X.lan(m) === l && X.shield(m); m.sx -= 37; m.sy += 21;
      // put out while the revenant fights: the lantern does not come back until it stops
      l.hp = 1; U.killMon(l); m.eng = 4; l.rt = .1; X.tick(.5); out.held = l.rt >= 2; m.eng = 0; l.rt = .1; X.tick(.05); out.free = l.rt < 1;
      return out;
    });
    assert.equal(r.tip0, false); assert.equal(r.tip, true, 'the word on the lantern, once');
    assert.ok(r.lanDead && !r.shieldNow && r.back);
    assert.ok(r.moved, 'paired by the monsters themselves, not where they spawned');
    assert.ok(r.held && r.free, 'the lantern waits while its revenant fights');
    assert.ok(r.shielded > 0 && r.shielded / r.open < .2, 'shielded a tenth: ' + r.shielded + ' / ' + r.open);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the lantern keeps its revenant between itself and you; the strider leaves burning ground that hurts who stands in it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 480; const m = G.mons().find((x) => x.type === 'crevn'); G.P.x = m.x - 90; G.P.y = m.y; G.P.inv = 1e9; });
    await g.step(120);
    const a = await g.eval(() => { const G = window.__G, X = window.__G48, m = G.mons().find((x) => x.type === 'crevn'), l = X.lan(m); return { pl: G.P.x, rev: m.x, lan: l.x, d: Math.hypot(l.x - m.x, l.y - m.y) }; });
    assert.ok(a.lan > a.rev && a.rev > a.pl, 'player, revenant, lantern in a row: ' + JSON.stringify(a));
    // (walking onto the ridge charts it: close what that opened)
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 30 && G.mode === 'dialog'; i++) G.advance(); });
    const b = await g.eval(() => { const G = window.__G, X = window.__G48, s = X.S[0]; s.o48f = [{ x: s.x + 200, y: s.y, t: 4 }]; s.o48x = undefined; s.o48h = 0;
      G.P.x = s.x + 200; G.P.y = s.y; G.P.inv = 0; G.P.dash = 0; G.P.hp = 1e12; G.P.qm = 0; G.S.hid.indom = 0; const h0 = G.P.hp; X.tick(.016); const h1 = G.P.hp;
      const inv = G.P.inv; G.P.x += 60; s.o48h = 0; X.tick(.016); const off = h1 - G.P.hp;
      // a strider that is not fighting lays no fire as it walks
      s.eng = 0; s.o48f = []; s.o48x = s.x; s.o48y = s.y; s.x += 30; X.tick(.016); const idle = s.o48f.length; s.eng = 4; s.x += 30; X.tick(.016); const fight = s.o48f.length;
      return { burn: h0 - h1, off, inv, left: 1, n: X.S.length, idle, fight }; });
    assert.ok(b.burn > 0, 'standing in the fire hurts: ' + JSON.stringify(b)); assert.equal(b.off, 0, 'a step out of it does not'); assert.equal(b.n, 10); assert.ok(!(b.inv > 0), 'a burn leaves no blow-proof moment');
    assert.equal(b.idle, 0, 'no fire while it walks about'); assert.equal(b.fight, 1, 'fire where it runs while it fights');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('their XP at 480 and 500: under the normal cap (0.8% of the level), nothing above it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, S = G.S, out = {};
      for (const L of [480, 500]) for (const k of ['crevn', 'cstrid']) {
        S.lv = L; S.xp = 0; S.rx = 0; const m = G.spawnMon(k, G.P.x + 30, G.P.y), b = G.isk.MT[k]; m.tmp = 0; m.hp = 1; m.lv = Math.max(b.lv[0], Math.min(b.lv[1], L + 5)); U.killMon(m); m.rt = 1e9;
        out[k + L] = +(S.xp / G.xpNeed() * 100).toFixed(3); S.lv = L; S.xp = 0;
      }
      return out;
    });
    for (const k in r) assert.ok(r[k] > 0 && r[k] <= 0.8 + 1e-9, k + ': ' + r[k] + '%');
    assert.ok(r.cstrid500 >= 0.79, 'the strider is worth a full normal kill at 500: ' + r.cstrid500);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
