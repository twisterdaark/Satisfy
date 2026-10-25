'use strict';
// Owner 2026-10-25: "I'm level 480 and there are no monsters and nothing left to do" and the Angel Hierarchy (Rebecca and
// Yatan, the Angels of Asgard, Raphael and Michael as strong as the Great Demons, the fallen who become Great Demons, Sariel).
// Three realms under the world east of the vampire cities: Asgard (480-570; the Wall of Judgement sealed below 520), the
// Yatan Cathedral (500-545) and the Fallen Rift (550-600, sealed below 550), with their people, bosses, drops and quests.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const toasts = (g) => g.eval(() => {
  if (!window.__toastLog) { window.__toastLog = [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); }
  return window.__toastLog.join(' | ');
});
// use the realm gate of kind k (standing on it), then let the fade finish
async function gate(g, k) {
  await g.eval((k) => { const G = window.__G, d = G.eqx.DGATES.find((d) => d.hv && d.hk === k); G.P.x = d.x; G.P.y = d.y; G.eqx.useGate(d); }, k);
  await g.page.waitForTimeout(700); await g.step(30);
  return g.eval(() => { const G = window.__G; return { z: G.zoneAt(G.P.x, G.P.y), x: G.P.x / 16 | 0, y: G.P.y / 16 | 0 }; });
}

test('three realms past level 480: walkable from where you arrive to their bosses and ways out, with their people', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, V = window.__GHV, R = V.HVR, sol = (x, y) => G.eqx.solid(x, y);
      // flood from a start, staying in the box: which of the targets can be reached on foot
      const reach = (box, start, targets) => { const seen = new Set(), q = [start]; while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (seen.has(k) || x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1 || sol(x, y)) continue; seen.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
        return targets.map(([x, y]) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => seen.has((x + dx) + ',' + (y + dy))))); };
      const gt = (k) => { const d = G.eqx.DGATES.find((d) => d.hv && d.hk === k); return [d.x / 16 | 0, d.y / 16 | 0]; }, to = (k) => { const d = G.eqx.DGATES.find((d) => d.hv && d.hk === k); return [d.to.x / 16 | 0, d.to.y / 16 | 0]; };
      const boss = (t) => { const o = V.HVB.find((o) => o.m.type === t); return [o.m.x / 16 | 0, o.m.y / 16 | 0]; };
      const A = R.asg, C = R.ycat, F = R.rift, outer = { ...A, x1: A.wall - 1 }, inner = { ...A, x0: A.wall + 3 };
      const count = (box) => { const n = {}; for (const m of G.mons()) { const x = m.x / 16, y = m.y / 16; if (x >= box.x0 && x < box.x1 + 1 && y >= box.y0 && y < box.y1 + 1) n[m.type] = (n[m.type] || 0) + 1; } return n; };
      return {
        gates: G.eqx.DGATES.filter((d) => d.hv).map((d) => d.hk).sort(),
        hard: G.eqx.DGATES.filter((d) => d.hv && d.hard).map((d) => d.hk + d.lv).sort(),
        arrivals: G.eqx.DGATES.filter((d) => d.hv).every((d) => !sol(d.to.x / 16 | 0, d.to.y / 16 | 0)),
        zones: [[A.x0 + 10, A.ym], [A.wall + 10, A.ym], [A.hall + 5, A.ym], [C.x0 + 20, C.ym], [F.x0 + 20, F.ym], [F.th + 5, F.ym]].map(([x, y]) => G.zoneAt(x * 16 + 8, y * 16 + 8)),
        outer: reach(outer, to('stair'), [gt('down'), gt('wall'), [A.x0 + 8, A.ym - 3]]),
        inner: reach(inner, to('wall'), [gt('wallb'), boss('raphael'), boss('michael'), gt('fall')]),
        cat: reach(C, to('yat'), [gt('upy'), boss('yarch'), gt('deep'), [C.x0 + 7, C.ym - 3]]),
        rift: reach(F, to('fall'), [gt('upa'), gt('upc'), boss('sariel'), boss('baal'), [F.x0 + 9, F.ym - 3]]),
        riftC: reach(F, to('deep'), [boss('sariel')]),
        nOuter: count(outer), nInner: count(inner), nCat: count(C), nRift: count(F),
        bosses: V.HVB.map((o) => o.m.type + ':' + o.k).sort(),
        npcs: ['hvher', 'ycapo', 'hvwatch'].map((id) => { const n = G.npcs ? G.npcs.find((n) => n.id === id) : null; return n ? V.realm(n.x / 16, n.y / 16) : null; }),
        missing: window.__GMON.missing(),
        sheets: ['asent', 'michael', 'sariel', 'sariel~1', 'baal', 'hvher'].map((k) => V.sheet(k)),
      };
    });
    assert.deepEqual(r.gates, ['deep', 'down', 'fall', 'stair', 'upa', 'upc', 'upy', 'wall', 'wallb', 'yat']);
    assert.deepEqual(r.hard, ['deep550', 'fall550', 'wall520']);
    assert.equal(r.arrivals, true, 'nothing solid where a gate puts you');
    assert.deepEqual(r.zones, ['zAsg1', 'zAsg2', 'zAsgT', 'zYatC', 'zRift', 'zBaal']);
    assert.deepEqual(r.outer, [true, true, true], 'the Outer Courts: the way down, the Wall of Judgement and the Herald');
    assert.deepEqual(r.inner, [true, true, true, true], 'the Inner Sanctum: back, Raphael, Michael and the Edge of the Fall');
    assert.deepEqual(r.cat, [true, true, true, true], 'the Cathedral: up, the Archbishop, the way under the altar and the Apostate');
    assert.deepEqual(r.rift, [true, true, true, true, true], 'the Rift: both ways up, Sariel, Baal and the Watcher');
    assert.deepEqual(r.riftC, [true]);
    assert.deepEqual(r.nOuter, { asent: 26, aseraph: 18, athrone: 8 });
    assert.deepEqual(r.nInner, { adomin: 22, apower: 16, acherub: 8, raphael: 1, michael: 1 });
    assert.deepEqual(r.nCat, { ybmag: 22, yinq: 20, ypact: 12, ychor: 14, yarch: 1 });
    assert.deepEqual(r.nRift, { fangel: 26, rhound: 22, bseraph: 16, gdherald: 8, rdrake: 4, sariel: 1, baal: 1 });
    assert.deepEqual(r.bosses, ['baal:rift', 'michael:asg', 'raphael:asg', 'sariel:rift', 'yarch:ycat']);
    assert.deepEqual(r.npcs, ['asg', 'ycat', 'rift']);
    assert.deepEqual(r.missing, [], 'every new monster has a picture');
    assert.deepEqual(r.sheets, [true, true, true, true, true, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the ways in: the Stairway of Light from Rolling warns; the Wall of Judgement opens at 520 and the Rift at 550; the ways back', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await toasts(g);
    await g.eval(() => { const G = window.__G; G.S.lv = 300; G.P.inv = 1e9; G.P.hp = 1e9; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } });
    const surf = await g.eval(() => { const G = window.__G, s = window.__GHV.stair; return G.zoneAt(s.x * 16 + 8, s.y * 16 + 8); });
    assert.equal(surf, 'zRolling', 'the stair stands in Rolling');
    let at = await gate(g, 'stair');
    assert.equal(at.z, 'zAsg1');
    assert.match(await toasts(g), /deadly below level 480/);
    assert.match(await toasts(g), /You have entered Asgard, the realm of Rebecca/);
    // the wall: sealed at 519, open at 520
    await g.eval(() => { window.__G.S.lv = 519; });
    at = await gate(g, 'wall');
    assert.equal(at.z, 'zAsg1', 'turned back');
    assert.match(await toasts(g), /None pass before level 520/);
    await g.eval(() => { window.__G.S.lv = 520; });
    at = await gate(g, 'wall');
    assert.equal(at.z, 'zAsg2');
    // the Edge of the Fall: sealed at 549, open at 550
    await g.eval(() => { window.__G.S.lv = 549; });
    at = await gate(g, 'fall');
    assert.equal(at.z, 'zAsgT', 'still in Michael\'s hall');
    assert.match(await toasts(g), /You cannot go down before level 550/);
    await g.eval(() => { window.__G.S.lv = 550; });
    at = await gate(g, 'fall');
    assert.equal(at.z, 'zRift');
    assert.match(await toasts(g), /You have entered the Fallen Rift/);
    // from the Rift up into the Cathedral, and out to the ruins of Yatan
    at = await gate(g, 'upc');
    assert.equal(at.z, 'zYatC');
    at = await gate(g, 'upy');
    assert.equal(at.z, 'zYatan');
    // and from Asgard's plaza down to Rolling
    at = await gate(g, 'yat');
    assert.equal(at.z, 'zYatC');
    await g.eval(() => window.__GHV.go(window.__GHV.HVR.asg.x0 + 6, window.__GHV.HVR.asg.ym)); await g.step(5);
    at = await gate(g, 'down');
    assert.equal(at.z, 'zRolling');
    assert.equal(await g.eval(() => window.__G.S.hv.in_asg), 1, 'the first visit is remembered (its lore once)');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Archbishop\'s Great Demon Contract, Sariel turning into a Great Demon, and Asgard\'s light on a sinner', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await toasts(g);
    const R = await g.eval(() => window.__GHV.HVR);
    await g.eval((R) => { const G = window.__G; G.S.lv = 560; G.P.inv = 1e9; for (const m of G.mons()) if (!window.__GHV.HVB.some((o) => o.m === m)) { m.dead = true; m.rt = 1e9; } window.__GHV.go(R.ycat.alt - 12, R.ycat.ym); }, R);
    await g.step(5);
    // half dead: he signs, grows stronger, and the contract eats his life down to a fifth
    const c = await g.eval(() => { const V = window.__GHV, m = V.HVB.find((o) => o.m.type === 'yarch').m; m.hp = Math.round(m.max * .49); V.tick(.016); const a = { gdc: m.gdc, fury: m.fury > 1e5, dmul: m.dmul, hp0: m.hp }; V.tick(10); a.hp1 = m.hp; for (let i = 0; i < 40; i++) V.tick(10); a.hp2 = m.hp; a.max = m.max; return a; });
    assert.equal(c.gdc, 1);
    assert.equal(c.fury, true);
    assert.ok(Math.abs(c.dmul - 1.2) < 1e-9);
    assert.ok(Math.abs((c.hp0 - c.hp1) - c.max * .03) < c.max * .001, 'his life force drains (0.3% a second)');
    assert.equal(c.hp2, c.max * .2, 'never below a fifth from the contract');
    assert.match(await toasts(g), /signs a Great Demon Contract/);
    // Sariel at half health: her Great Demon form (the second sheet), and back when she is whole again
    await g.eval((R) => window.__GHV.go(R.rift.cr - 12, R.rift.ym), R); await g.step(5);
    const s = await g.eval(() => { const V = window.__GHV, m = V.HVB.find((o) => o.m.type === 'sariel').m; const a = { vr0: m.vr || 0 }; m.hp = Math.round(m.max * .45); V.tick(.016); a.vr1 = m.vr; a.fury = m.fury > 1e5; m.hp = m.max; V.tick(.016); a.vr2 = m.vr; return a; });
    assert.deepEqual(s, { vr0: 0, vr1: 1, fury: true, vr2: 0 });
    assert.match(await toasts(g), /Sariel has become a Great Demon/);
    // Asgard's light: an outlaw (or bad karma) loses 2% of their health a second there, never the last point; nowhere else
    const L = await g.eval((R) => { const G = window.__G, V = window.__GHV; G.S.karma = -5; V.go(R.asg.x0 + 6, R.asg.ym); V.tick(.016); const mh = window.__G.maxHP ? window.__G.maxHP() : G.P.hp; G.P.hp = mh; V.tick(1.01); const a = { lost: mh - G.P.hp, mh }; G.P.hp = 2; for (let i = 0; i < 5; i++) V.tick(1.01); a.floor = G.P.hp;
      V.go(R.ycat.x0 + 6, R.ycat.ym); V.tick(.016); G.P.hp = mh; V.tick(1.01); a.cat = mh - G.P.hp; G.S.karma = 0; V.go(R.asg.x0 + 6, R.asg.ym); V.tick(.016); G.P.hp = mh; V.tick(1.01); a.clean = mh - G.P.hp; return a; }, R);
    assert.equal(L.lost, Math.ceil(L.mh * .02));
    assert.equal(L.floor, 1);
    assert.equal(L.cat, 0);
    assert.equal(L.clean, 0);
    assert.match(await toasts(g), /light of Asgard burns the sinful/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Baal falls: two hours of rest for the world, the title and the first-kill note; Michael\'s title; drops by level', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await toasts(g);
    await g.eval(() => { const G = window.__G, V = window.__GHV; G.S.lv = 600; G.P.inv = 1e9; V.go(V.HVR.rift.x1 - 30, V.HVR.rift.ym); });
    await g.step(5);
    const b = await g.eval(() => { const G = window.__G, V = window.__GHV, m = V.HVB.find((o) => o.m.type === 'baal').m, t0 = Date.now(), dc = G.S.mats.dcore || 0; window.__GU.killMon(m);
      return { wb: V.wb('baal') - t0, dead: m.dead, k: G.S.hv.k.baal, tl: !!G.S.tl.gdslay, dc: (G.S.mats.dcore || 0) - dc }; });
    assert.equal(b.dead, true);
    assert.ok(Math.abs(b.wb - 7200000) < 5000, 'two hours: ' + b.wb);
    assert.equal(b.k, 1);
    assert.equal(b.tl, true, 'Great Demon Slayer');
    assert.ok(b.dc >= 1, 'a Great Demon\'s core: ' + b.dc);
    await g.step(10); await g.page.waitForTimeout(1200); await g.step(5);
    assert.match(await toasts(g), /You have defeated Great Demon Baal for the first time/);
    assert.match(await toasts(g), /Great Demon Slayer/);
    const m = await g.eval(() => { const G = window.__G, V = window.__GHV, m = V.HVB.find((o) => o.m.type === 'michael').m; window.__GU.killMon(m); return { k: G.S.hv.k.michael, tl: !!G.S.tl.aslay }; });
    assert.deepEqual(m, { k: 1, tl: true });
    // a boss's random gear piece follows its level: the new armour from 480, the Fallen set from 550; older bosses as before
    const d = await g.eval(() => { const V = window.__GHV; return { baal: V.drop('baal'), belial: V.drop('belial'), vb3: V.drop('vb3') }; });
    assert.ok(d.baal.includes('falla') && d.baal.includes('dcneck'));
    assert.ok(d.belial.includes('seraa') && !d.belial.includes('falla'));
    assert.ok(!d.vb3.includes('seraa'));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Herald\'s quests: too weak below 480, then the Test of Light; a kill counts and the reward lands', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const say = (g) => g.eval(() => document.getElementById('dtext').textContent);
    const close = (g) => g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Leave|Decline|Close/.test(x.textContent)); if (b) b.click(); else window.__G.advance(); });
    await g.eval(() => { const G = window.__G; G.S.lv = 470; G.S.met.hvher = 1; G.talkNPC('hvher'); });
    await g.step(40);
    assert.match(await say(g), /too weak for what comes next/);
    await close(g); await g.step(5);
    await g.eval(() => { const G = window.__G; if (G.mode === 'dialog') G.advance(); G.S.lv = 480; G.talkNPC('hvher'); });
    await g.step(60);
    assert.match(await say(g), /test everyone who climbs/);
    const r = await g.eval(() => { const G = window.__G, C = window.__GC2;
      C.accept('hv1'); for (let i = 0; i < 25; i++) C.ev('kill', 'asent'); const xp0 = G.S.xp, lv0 = G.S.lv; C.complete('hv1');
      return { done: !!(G.S.qs.hv1 && G.S.qs.hv1.st === 2), gained: G.S.lv > lv0 || G.S.xp > xp0, next: C.avail('hv2'), daily: C.avail('hvd1') }; });
    assert.deepEqual(r, { done: true, gained: true, next: true, daily: true });
    // every new line has its Arabic
    const miss = await g.eval(() => { const L = window.__G.lines(), k = Object.keys(L.en).filter((k) => /^(hv|yc|rf|q_hv|q_yc|q_rf|zAsg|zYatC|zRift|zBaal|hHv)/.test(k)); return k.filter((x) => !L.ar[x]); });
    assert.deepEqual(miss, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
