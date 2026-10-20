'use strict';
// Hidden classes (major 10, novel ch 33/48/117/131/150/153/174/179/188/203/335): no trainer; the system offers each class
// change quest once its hidden condition is met (parries, beasts hunted, people talked with); the new class replaces the
// old one; Aura Master's aura blades and growing rating, Beast Master's forms and Lord's Strike, the Orator's weak body,
// Persuasion, Spiteful Tongue and Eloquence; forms, aura colour and Eloquence ride in the presence fx.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// the system's offer: read through to the choice and take it (0 accept, 1 decline)
async function answer(g, i) {
  for (let n = 0; n < 6 && !(await g.eval(() => !!(window.__G.DL && window.__G.DL.optOn))); n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
  await g.eval((i) => window.__G.pickOpt(i), i);
  for (let n = 0; n < 6 && (await g.mode()) !== 'play'; n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
}
const offer = (g) => g.eval(() => { const X = window.__GHC, G = window.__G; X.HC.chk = 0; X.tick(0.05); return { who: G.DL && G.DL.who, mode: G.mode }; });

test('Aura Master: offered after 30 parries, the trial, aura blades that grow, Super Sensitivity', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const pre = await g.eval(() => { const G = window.__G, X = window.__GHC; G.S.lv = 20; for (let i = 0; i < 29; i++) X.parry(); return X.offerK(); });
    assert.equal(pre, null, 'nothing before the condition');
    await g.eval(() => window.__GHC.parry());
    const o = await offer(g);
    assert.equal(o.who, 'sysN', JSON.stringify(o));
    await answer(g, 1);
    const dec = await g.eval(() => ({ pr: window.__GHC.s().pr, q: !!window.__G.S.qs.hau }));
    assert.deepEqual(dec, { pr: 0, q: false }, 'declining resets the condition');
    await g.eval(() => { for (let i = 0; i < 30; i++) window.__GHC.parry(); });
    await offer(g); await answer(g, 0);
    const tr = await g.eval(() => { const G = window.__G, C = window.__GC2, P = G.P; const low = G.spawnMon('wolf', P.x + 14, P.y); low.lv = 25; low.hp = 1; P.dir = 2; C.hit(low);
      const hi = G.spawnMon('wolf', P.x + 14, P.y); hi.lv = 40; hi.hp = 1; C.hit(hi); return { c: G.S.qs.hau.c, obj: C.obj('hau') }; });
    assert.equal(tr.c, 1, 'only monsters 10+ levels above count'); assert.match(tr.obj, /10\+ levels above/);
    await g.eval(() => { window.__G.S.qs.hau.c = 15; });
    await offer(g);
    for (let n = 0; n < 6 && (await g.mode()) !== 'play'; n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
    const d = await g.eval(() => { const G = window.__G, C = window.__GC2; return { cls: G.S.cls, sk: C.cls(), pas: C.pas() }; });
    assert.equal(d.cls, 'aura', 'the trial completes on its own');
    assert.ok(d.sk.includes('arel') && d.pas.includes('aweap'), JSON.stringify(d));
    // aura blades: from level, not the weapon; less lost to a stronger monster; through a soldier's guard
    const a = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; G.S.lv = 30; const hit = (o) => { const m = G.spawnMon('gsold', P.x + 12, P.y); m.lv = 30; m.max = m.hp = 1e9; m.grdT = 5; m.face = -1; m.stun = 0; m.st = null;
      let s = 0; for (let i = 0; i < 8; i++) { m.grdT = 5; const h = m.hp; X.hit(m, o); s += h - m.hp; } m.dead = true; return s; };
      const far = (o) => { const m = G.spawnMon('wolf', P.x + 12, P.y); m.lv = 90; m.max = m.hp = 1e9; let s = 0; for (let i = 0; i < 8; i++) { const h = m.hp; X.hit(m, o); s += h - m.hp; } m.dead = true; return s / X.atkV(); };
      return { guarded: hit({}), aura: hit({ aura: true }), farAura: far({ aura: true }) }; });
    assert.ok(a.aura > a.guarded * 2, 'aura blades go through the guard: ' + JSON.stringify(a));
    assert.ok(a.farAura > 8 * 0.5, 'a stronger monster takes at least 60% of an aura blade: ' + JSON.stringify(a));
    const arel = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; P.dir = 2; const m = G.spawnMon('wolf', P.x + 50, P.y - 6 + 6); m.max = m.hp = 1e9; m.lv = 30; const h = m.hp; X.sk('arel'); return h - m.hp; });
    assert.ok(arel > 0, 'Aura Release reaches along the line: ' + arel);
    // the rating grows with use: Epic (red) from Lv 40
    const up = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; G.S.lv = 40; X.s().ax = 1499; const m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e9; X.sk('aspr'); return { ar: X.s().ar, st: X.st() }; });
    assert.equal(up.ar, 1); assert.match(up.st, /y/, 'others see the red aura');
    const s = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; P.mp = 80; X.sk('asens'); P.inv = 0; P.dash = 0; const hp = P.hp; const r = window.__GC2.hurt(50, { x: P.x + 20, y: P.y, type: 'wolf' }); return { mp: P.mp, r, same: P.hp === hp }; });
    assert.deepEqual(s, { mp: 0, r: 0, same: true }, 'Super Sensitivity spends all mana and reads every blow');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Beast Master: 100 beasts, a dagger trial, forms that change the fight and show online, Lord\'s Strike', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; G.S.lv = 25; for (let i = 0; i < 100; i++) { const m = G.spawnMon('wolf', P.x + 300, P.y); m.dead = true; X.kill(m); } });
    const o = await offer(g); assert.equal(o.who, 'sysN');
    await answer(g, 0);
    const tr = await g.eval(() => { const G = window.__G, X = window.__GHC; const sw = G.S.qs.hbm.c || 0; return { sw, obj: window.__GC2.obj('hbm') }; });
    assert.equal(tr.sw, 0); assert.match(tr.obj, /Hunt beasts/);
    await g.eval(() => { window.__G.S.qs.hbm.c = 20; });
    await offer(g);
    for (let n = 0; n < 6 && (await g.mode()) !== 'play'; n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
    const d = await g.eval(() => ({ cls: window.__G.S.cls, sk: window.__GC2.cls() }));
    assert.equal(d.cls, 'beast'); assert.ok(['bbear', 'bwolf', 'beagle'].every((k) => d.sk.includes(k)), JSON.stringify(d));
    const f = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; G.S.lv = 40; const src = { x: P.x + 10, y: P.y, type: 'wolf' };
      const v0 = X.hurt(100, src), s0 = X.spd(); X.sk('bbear'); const bear = { hurt: X.hurt(100, src), spd: X.spd(), st: X.st() };
      X.sk('bwolf'); const wolf = { acd: X.acd(), st: X.st() }; X.sk('beagle'); const eagle = { spd: X.spd(), st: X.st() }; X.sk('beagle'); return { v0, s0, bear, wolf, eagle, human: P.bmf }; });
    assert.ok(f.bear.hurt < f.v0 && f.bear.spd < f.s0, JSON.stringify(f));
    assert.match(f.bear.st, /u/); assert.ok(f.wolf.acd < 1); assert.match(f.wolf.st, /w/);
    assert.ok(f.eagle.spd > f.s0); assert.match(f.eagle.st, /e/); assert.equal(f.human, null, 'the same key again turns you back');
    const l = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; P.dir = 2; const m = G.spawnMon('wolf', P.x + 20, P.y); m.max = m.hp = 1e9; m.lv = 40; const h = m.hp; window.__GC2.hit(m); const one = h - m.hp; const h2 = m.hp; X.sk('blord'); return { one, lord: h2 - m.hp }; });
    assert.ok(l.lord > l.one * 6, JSON.stringify(l));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Orator: 30 people, 12 more each once, a weak body, Persuasion, Spiteful Tongue and Eloquence', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const hp0 = await g.eval(() => { const G = window.__G, X = window.__GHC; G.S.lv = 15; for (let i = 0; i < 30; i++) X.talk('folk#' + i); X.talk('folk#1'); return { hp: X.mhp(), pr: X.price('cassus', 1000) }; });
    const o = await offer(g); assert.equal(o.who, 'sysN');
    await answer(g, 0);
    const c = await g.eval(() => { const X = window.__GHC; X.talk('a'); X.talk('a'); X.talk('b'); return window.__G.S.qs.hor.c; });
    assert.equal(c, 2, 'each person counts once');
    await g.eval(() => { window.__G.S.qs.hor.c = 12; });
    await offer(g);
    for (let n = 0; n < 6 && (await g.mode()) !== 'play'; n++) { await g.page.keyboard.press('KeyE'); await g.step(2); }
    const d = await g.eval(() => ({ cls: window.__G.S.cls, sk: window.__GC2.cls(), pas: window.__GC2.pas() }));
    assert.equal(d.cls, 'orator'); assert.ok(d.sk.includes('ospite') && d.sk.includes('oelo') && d.pas.includes('opers'), JSON.stringify(d));
    const w = await g.eval(() => ({ hp: window.__GHC.mhp(), pr: window.__GHC.price('cassus', 1000) }));
    assert.equal(w.hp, Math.round(hp0.hp * 0.8), 'lower health than a magician'); assert.ok(w.pr < hp0.pr, 'Persuasion lowers prices');
    const sp = await g.eval(() => { const G = window.__G, X = window.__GHC, P = G.P; G.S.lv = 20; P.dir = 2; const m = G.spawnMon('wolf', P.x + 20, P.y); m.max = m.hp = 1e9; m.lv = 20; X.sk('ospite');
      const src = m; const hurt = X.hurt(100, { x: m.x, y: m.y, type: 'wolf', spt: m.spt }); X.sk('oelo'); return { spt: m.spt > 0, hurt, st: X.st() }; });
    assert.ok(sp.spt && sp.hurt < 100, JSON.stringify(sp)); assert.match(sp.st, /o/, 'Eloquence rides in the presence fx');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a Tier-2 class is never offered a hidden class', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const k = await g.eval(() => { const G = window.__G, X = window.__GHC; G.S.cls = 'knight'; G.S.lv = 40; for (let i = 0; i < 30; i++) X.parry(); return [X.ok(), X.offerK()]; });
    assert.deepEqual(k, [false, null]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
