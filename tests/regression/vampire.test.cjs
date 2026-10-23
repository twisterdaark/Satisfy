'use strict';
// Owner 2026-10-22: the Vampire Crown Prince explains the Covenant (what it is, what it gives, what it costs) with Accept and
// Decline; races (Human by default, Vampire through the prince's Eternal Blood) shown in the status window; a day and a night
// on the world clock; vampires burn in the sun outside shade, are stronger at night, and vampire monsters hide by day.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const at = (g, x, y) => g.eval(([x, y]) => { const G = window.__G; G.P.x = x * 16 + 8; G.P.y = y * 16 + 8; G.P.inv = 1e9; G.P.hp = 1e9; }, [x, y]);

test('day and night follow the world clock, the HUD shows the hour, and the status window shows your race', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const V = window.__GVP, real = V.hour(), want = ((Date.now() / 1000) % 2400) / 2400 * 24;
      V.force(12); V.tick(1 / 60); const day = [V.night(), V.dark(), document.getElementById('dnClk').textContent];
      V.force(22); V.tick(1 / 60); const night = [V.night(), V.dark(), document.getElementById('dnClk').textContent];
      V.force(19); const dusk = [V.night(), V.dark()];
      window.__GTC.openStatus(); const sw = document.getElementById('statusW'), row = [...sw.querySelectorAll('.srow')].find((e) => /Race|العرق/.test(e.textContent));
      return { real, want, day, night, dusk, race: V.race(), row: row ? row.textContent : null, tip: row ? row.dataset.tip : null };
    });
    assert.ok(Math.abs(r.real - r.want) < 0.05, 'the hour comes from the clock: ' + r.real + ' ' + r.want);
    assert.deepEqual(r.day, [false, 0, '☀ 12:00']);
    assert.deepEqual(r.night, [true, 1, '☾ 22:00']);
    assert.deepEqual(r.dusk, [true, 0.5]);
    assert.equal(r.race, 'human');
    assert.ok(r.row && /Human|بشري/.test(r.row), 'race row: ' + r.row);
    assert.ok(r.tip && r.tip.length > 20, 'the race row has a tooltip');
  } finally { await g.close(); }
});

test('vampire monsters hide indoors by day outside the catacombs and come back at nightfall', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => window.__GVP.force(12));
    await at(g, 640, 212);
    await g.step(40);
    const day = await g.eval(() => {
      const G = window.__G, X = window.__GP3, cat = (m) => X.VMC.cat && m.sx / 16 >= X.VMC.cat.x0 && m.sx / 16 <= X.VMC.cat.x1 && m.sy / 16 >= X.VMC.cat.y0 && m.sy / 16 <= X.VMC.cat.y1;
      const th = G.mons().filter((m) => m.type === 'vthrall'), kn = G.mons().filter((m) => m.type === 'vknight' && cat(m));
      return { th: th.length, hid: th.filter((m) => m.dead && m.vhid).length, kn: kn.length, knUp: kn.filter((m) => !m.dead).length, lord: G.mons().filter((m) => m.type === 'vlord' && !m.dead).length };
    });
    assert.equal(day.hid, day.th, 'every thrall is indoors by day');
    assert.ok(day.kn >= 8 && day.knUp === day.kn, 'the catacomb knights stay: ' + JSON.stringify(day));
    assert.equal(day.lord, 1);
    await g.eval(() => window.__GVP.force(22));
    await g.step(60);
    const night = await g.eval(() => window.__G.mons().filter((m) => m.type === 'vthrall' && !m.dead).length);
    assert.equal(night, day.th, 'they come back at night');
  } finally { await g.close(); }
});

test('the Crown Prince explains the Covenant with Accept and Decline, gives the Eternal Blood, and a vampire burns in the sun', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 627, 211);
    const r = await g.eval(() => {
      const G = window.__G, V = window.__GVP, X = window.__GP3, C = window.__GC2, o = {};
      o.npc = G.npcs.some((p) => p.id === 'vprince');
      G.S.lv = 250; o.first = V.opts().length; o.pick = V.cov().map((x) => x.l);
      V.cov()[0].f(); o.low = !G.S.qs.vc1;
      G.S.lv = 275; V.cov()[0].f(); o.trial = !!G.S.qs.vc1;
      G.S.qs.vc1.c = 30; C.complete('vc1'); C.accept('vc2'); G.S.mats.bvial = 10; C.complete('vc2'); X.tick(1 / 60);
      o.cov = G.S.p3.cov; o.withCov = V.opts().length;
      V.embrace(); o.race = V.race(); o.st = V.st();
      return o;
    });
    assert.ok(r.npc, 'the prince stands at the gate');
    assert.equal(r.first, 1, 'only "what is the Covenant?" before you join');
    assert.equal(r.pick.length, 2, 'Accept and Decline');
    assert.ok(r.low, 'too low to start the trial');
    assert.ok(r.trial, 'accepting starts the envoy\'s trial');
    assert.equal(r.cov, 1);
    assert.equal(r.withCov, 2, 'a Covenant member is offered the Eternal Blood');
    assert.equal(r.race, 'vampire');
    assert.equal(r.st, 'V');
    // outdoors by day: the sun burns; night, the catacombs and a house are safe
    await at(g, 300, 120);
    const b = await g.eval(() => {
      const G = window.__G, V = window.__GVP, o = {};
      V.force(12); G.P.inv = 0; G.P.hp = G.maxHP ? G.maxHP() : window.__GP3.mh(); const h0 = G.P.hp;
      o.burning = V.burning(); o.atkDay = V.atk(); for (let i = 0; i < 8; i++) V.tick(0.5);
      o.lost = h0 - G.P.hp; o.st = V.st(); o.max = window.__GP3.mh();
      V.force(22); o.nightBurn = V.burning(); o.atkN = V.atk(); o.spdN = V.spd(); V.tick(0.1); o.stN = V.st();
      V.force(12); G.P.x = 700 * 16 + 8; G.P.y = 222 * 16 + 8; o.cata = V.burning();
      G.S.gold = 60000; V.cure(); o.cured = V.race(); o.gold = G.S.gold;
      return o;
    });
    assert.ok(b.burning, 'outdoors at noon a vampire burns');
    assert.ok(b.lost > b.max * 0.04 && b.lost < b.max * 0.12, 'about 4% a second after two seconds of warning: ' + JSON.stringify(b));
    assert.equal(b.st, 'VX', 'others see you burning');
    assert.equal(b.atkDay, 0.9);
    assert.equal(b.nightBurn, false);
    assert.equal(b.atkN, 1.2);
    assert.equal(b.spdN, 1.1);
    assert.equal(b.stN, 'V');
    assert.equal(b.cata, false, 'the catacombs are shade');
    assert.equal(b.cured, 'human');
    assert.equal(b.gold, 10000);
  } finally { await g.close(); }
});
