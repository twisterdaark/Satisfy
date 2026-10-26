'use strict';
// Plan batch 11 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U124 a golem's rubble; U040 rated duels capped
// per opponent; U186 the boss fight log and its replay; U220/U105 caravan commissions.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const closeDialogs = async (g) => {
  for (let i = 0; i < 10 && await g.eval(() => window.__G.mode) === 'dialog'; i++) {
    if (await g.eval(() => { const D = window.__G.DL; return !!(D && D.opts && D.opts.length); })) await g.page.keyboard.press('Escape'); else await g.eval(() => window.__G.advance());
    await g.step(2);
  }
};

test('a golem leaves its rubble: a vein its killer digs once, gone in 90 s; rated duels: three a day against one player', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB11, P = G.P, o = {};
      const n0 = X.nodes().length, last = () => X.nodes()[X.nodes().length - 1];
      const m = X.newMon('golem', P.x + 40, P.y); X.killMon(m);
      const n = last(); o.added = X.nodes().length - n0; o.gol = n.gol > 0; o.kind = n.kind || 'ore'; o.at = Math.hypot(n.x - m.x, n.y - m.y) < 8;
      const c = X.newMon('egolem', P.x - 40, P.y); X.killMon(c); o.mith = last().kind;
      const tm = X.newMon('golem', P.x, P.y + 40); tm.tmp = 1; X.killMon(tm); o.tmp = X.nodes().length - n0;   // a summoned one leaves nothing
      const w = X.newMon('wolf', P.x, P.y - 40); X.killMon(w); o.wolf = X.nodes().length - n0;
      // dig the first one
      const ore = () => Object.keys(S.mats).filter((k) => /ore$/.test(k)).reduce((a, k) => a + S.mats[k], 0);
      P.st = 100; P.lcd = 0; const o0 = ore(); X.mine(n); o.dug = ore() - o0; o.dep = n.dep > 0;
      return o;
    });
    assert.equal(r.added, 1); assert.equal(r.gol, true); assert.equal(r.kind, 'ore'); assert.equal(r.at, true, 'where it fell');
    assert.equal(r.mith, 'mith', 'the Canyon Golem leaves mithril');
    assert.equal(r.tmp, 2, 'a summoned golem leaves nothing'); assert.equal(r.wolf, 2, 'nor does a wolf');
    assert.ok(r.dug >= 1, 'ore dug: ' + r.dug); assert.equal(r.dep, true);
    await g.step(3);
    const after = await g.eval(() => window.__GPB11.nodes().filter((n) => n.gol).length);
    assert.equal(after, 1, 'the dug vein is gone; the other waits');
    await g.eval(() => { for (const n of window.__GPB11.nodes()) if (n.gol) n.gol = 0.01; });
    await g.step(3);
    assert.equal(await g.eval(() => window.__GPB11.nodes().filter((n) => n.gol).length), 0, 'and crumbles when its time is up');

    const d = await g.eval(() => {
      const X = window.__GPB11, S = window.__G.S, o = {};
      o.counts = [1, 2, 3, 4, 5].map(() => X.rnkCount('foeA'));
      o.other = X.rnkCount('foeB'); o.used = X.rnkUsed('foeA');
      S.rnkD.d -= 1; o.tomorrow = [X.rnkUsed('foeA'), X.rnkCount('foeA')];
      return o;
    });
    assert.deepEqual(d.counts, [true, true, true, false, false], 'three rated, the rest not');
    assert.equal(d.other, true, 'another player still counts'); assert.equal(d.used, 5);
    assert.deepEqual(d.tomorrow, [0, true], 'a new day, a new count');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the boss fight log: phases, damage, deaths and positions, kept on the device and played back as ghosts', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB11, P = G.P, o = {};
      X.resetRL(); try { localStorage.removeItem('satisfy_rlog'); } catch (e) {}
      const m = X.newMon('dcapt', P.x + 60, P.y); m.hp = Math.round(m.max * 0.9); m.myd = 0;
      X.bflTick(0.016); o.started = !!X.BFF && X.BFF.m === m;
      for (let i = 0; i < 24; i++) { X.addT(0.5); P.x += 2; m.x -= 1; m.hp -= Math.round(m.max * 0.02); m.myd += Math.round(m.max * 0.02); if (i === 10) { X.bflPhase(m, 2); P.hp -= 5; } X.bflTick(0.5); }
      m.dead = true; X.bflTick(0.016);
      const L = X.bflList(); o.n = L.length; const R = L[0];
      o.rec = { k: R.k, end: R.end, d: R.d >= 115, ph: R.ev.filter((e) => e[1] === 'ph').map((e) => e[2]), dealt: R.dealt > 0, tk: R.tk >= 5, samples: R.s.length >= 24, bag: /items|mats|gold/.test(JSON.stringify(R)) };
      try { o.saved = JSON.parse(localStorage.getItem('satisfy_rlog')).k; } catch (e) { o.saved = null; }
      // the device keeps it through a reload: the list comes back from localStorage
      X.resetRL(); o.reloaded = X.bflList().length;
      return o;
    });
    assert.equal(r.started, true, 'a hurt boss near you starts the log');
    assert.equal(r.n, 1);
    assert.deepEqual(r.rec, { k: 'dcapt', end: 'down', d: true, ph: [2], dealt: true, tk: true, samples: true, bag: false });
    assert.equal(r.saved, 'dcapt'); assert.equal(r.reloaded, 1);

    // the replay
    await g.eval(() => window.__GPB11.bflOpen());
    await g.step(2);
    const v = await g.eval(() => ({ open: !document.getElementById('bflW').hidden, head: document.getElementById('bflT').textContent, sum: document.getElementById('bflS').textContent, t: window.__GPB11.BFV.t }));
    assert.equal(v.open, true);
    assert.match(v.head, /Fight log: Deserter Captain \(1\/1\)/);
    assert.match(v.sum, /The boss fell after 1[12] s/); assert.match(v.sum, /Phases: 2 at [56]s/);
    await g.step(30);
    const t1 = await g.eval(() => window.__GPB11.BFV.t);
    assert.ok(t1 > v.t, 'it plays: ' + [v.t, t1]);
    // a click on the timeline seeks and pauses
    const box = await g.page.locator('#bflC').boundingBox();
    await g.page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 3);
    await g.step(2);
    const s = await g.eval(() => ({ t: window.__GPB11.BFV.t, play: window.__GPB11.BFV.play }));
    assert.ok(Math.abs(s.t - 6) < 1, 'half way: ' + s.t); assert.equal(s.play, false);
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('bflW').hidden), true, 'Escape closes it');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a caravan commission: the deposit, the roads, the bandits, no teleports, and the pay on delivery', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB11, P = G.P, o = {};
      o.low = X.cvOpts('merchantR').length;
      S.lv = 100; S.gold = 100000;
      o.ask = X.cvOpts('merchantR').map((x) => x.l);
      X.cvMenu('merchantR'); o.to = G.DL.opts.map((x) => x.l);
      o.pay = [X.cvPay('merchantR', 'merchantRh', 0), X.cvPay('merchantR', 'merchantRh', 1)]; o.dep = X.cvDep('merchantR', 'merchantRh');
      G.DL.opts[0].f(); o.roads = G.DL.opts.map((x) => x.l);
      const g0 = S.gold; G.DL.opts[0].f(); o.took = g0 - S.gold; o.cvn = !!S.cvn && S.cvn.to === 'merchantRh';
      { const A = X.cvPos('merchantR'); P.x = A.x; P.y = A.y + 20; X.cvTick(0.016); }   // out of the shop's door with it
      o.none = X.cvOpts('merchantRo').length; o.drop = X.cvOpts('merchantR').map((x) => x.l);
      // the coach won't take it
      X.cGo('coachRh', 'coachR'); o.coach = G.mode === 'dialog' && /coach won't take/.test(G.DL.lines.join(' '));
      return o;
    });
    assert.equal(r.low, 0, 'not below level 30');
    assert.deepEqual(r.ask, ['📦 Caravan commission']);
    assert.equal(r.to.length, 4, 'three towns and close: ' + r.to); assert.match(r.to[0], /^To .+: [\d,]+ gold \(\d+ min\)$/);
    assert.equal(r.pay[1], r.pay[0] * 2, 'the bandits\' road pays double');
    assert.match(r.roads[0], /^The safe road: /); assert.match(r.roads[1], /^The bandits' road: /);
    assert.equal(r.took, r.dep, 'the deposit'); assert.equal(r.cvn, true);
    assert.equal(r.none, 0, 'one load at a time');
    assert.match(r.drop[0], /^Give up the commission/);
    assert.equal(r.coach, true, 'the coach won\'t take a load');
    await closeDialogs(g);

    // a teleport out in the world loses the load and the deposit; a door into a house and back doesn't
    const t = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB11, P = G.P, o = {};
      const A = X.cvPos('merchantR'); P.x = A.x; P.y = A.y + 20; X.cvTick(0.016);
      P.x += 100; X.cvTick(0.016); o.walk = !!S.cvn;
      const ox = P.x, oy = P.y; P.y = window.__GPB10.HOME.ry * 16 + 60; P.x = window.__GPB10.HOME.rx * 16 + 60; X.cvTick(0.016); P.x = ox; P.y = oy + 4; X.cvTick(0.016); o.door = !!S.cvn;
      P.x += 1500; X.cvTick(0.016); o.tele = !S.cvn;
      return o;
    });
    assert.equal(t.walk, true); assert.equal(t.door, true, 'in and out of a door');
    assert.equal(t.tele, true, 'a teleport leaves the load behind');
    await g.step(2);

    // the bandits' road: two ambushes on the way, and the pay on delivery
    const d = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB11, P = G.P, o = {};
      X.cvMenu('merchantR'); G.DL.opts[0].f(); G.DL.opts[1].f(); o.risk = S.cvn && S.cvn.risk;
      const A = X.cvPos('merchantR'), B = X.cvPos('merchantRh'), n0 = X.mons().filter((m) => m.cv && !m.dead).length;
      P.x = A.x; P.y = A.y + 20; X.cvTick(0.016);
      const steps = Math.ceil(Math.hypot(B.x - P.x, B.y - P.y) / 120), sx = P.x, sy = P.y;
      for (let i = 1; i <= steps; i++) { P.x = sx + (B.x - sx) * i / steps; P.y = sy + (B.y + 20 - sy) * i / steps; X.cvTick(0.016); }
      o.amb = X.mons().filter((m) => m.cv && !m.dead).length - n0; o.left = S.cvn ? S.cvn.amb.length : -1;
      const g0 = S.gold, pay = S.cvn.pay, dep = S.cvn.dep;
      const opt = X.cvOpts('merchantRh'); o.give = opt.map((x) => x.l); opt[0].f(); o.got = S.gold - g0 === pay + dep; o.done = !S.cvn;
      o.today = S.cvD.n;
      return o;
    });
    assert.equal(d.risk, 1);
    assert.ok(d.amb >= 3, 'raiders came: ' + d.amb); assert.equal(d.left, 0, 'twice');
    assert.match(d.give[0], /^📦 Hand over the load/);
    assert.equal(d.got, true, 'the pay and the deposit back'); assert.equal(d.done, true);
    assert.equal(d.today, 2);
    await closeDialogs(g);

    // death loses it; four a day
    const e = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB11, o = {};
      X.cvTake('merchantR', 'merchantRo', 0); X.die(); o.died = !S.cvn;
      S.cvD.n = 4; X.cvMenu('merchantR'); o.cap = /loads a day/.test(G.DL.lines.join(' ')) && !(G.DL.opts || []).some((x) => /^To /.test(x.l));
      return o;
    });
    assert.equal(e.died, true, 'a death loses the load');
    assert.equal(e.cap, true, 'four a day');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
