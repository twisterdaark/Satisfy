'use strict';
// Owner 2026-10-27 23:50: awakenings at Lv 100, 200, 300, 400 and the max level, small permanent buffs, an aura of a random
// colour that grows with each, and a switch in the equipment window to hide it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('awakenings: reached once, kept, and their numbers', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, A = window.__GAWK, o = {};
      S.lv = 400; o.plain = A.tier();   // the older tests' baseline
      delete window.__awkPlain;
      S.lv = 99; A.tick(.5); o.t0 = [A.tier(), S.awk | 0];
      S.lv = 100; G.P.hitT = -99; A.tick(.5); o.t1 = [A.tier(), S.awk, typeof S.awc, G.DL && G.DL.lines.join(' ')];
      o.stM1 = A.stM(); o.spd1 = A.spd(); for (let i = 0; i < 20 && G.DL; i++)G.advance();
      // three at once (an old save at 450): the highest, with every new one's numbers
      S.awk = 1; S.lv = 450; window.__G.P.hitT = -99; A.tick(.5); o.t4 = [S.awk, (G.DL && G.DL.lines.join(' ')) || ''];
      for (let i = 0; i < 20 && G.DL; i++)G.advance();
      o.n = [A.stM(), A.atkM(), A.cdM(), A.mpM(), A.gdM()];
      o.auraNear = A.atk({ type: 'wolf', lv: S.lv, x: G.P.x + 40, y: G.P.y }); o.auraFar = A.atk({ type: 'wolf', lv: S.lv, x: G.P.x + 400, y: G.P.y });
      // permanent: a level lost keeps it
      S.lv = 50; o.kept = A.tier();
      return o;
    });
    assert.equal(r.plain, 0, 'none while the harness keeps the older numbers');
    assert.deepEqual(r.t0, [0, 0]);
    assert.equal(r.t1[0], 1); assert.equal(r.t1[1], 1); assert.equal(r.t1[2], 'number', 'a hue of its own');
    assert.ok(/First Awakening/.test(r.t1[3]) && /Combat Vitality/.test(r.t1[3]), r.t1[3]);
    assert.ok(near(r.stM1, 1.05) && near(r.spd1, 1.05));
    assert.equal(r.t4[0], 4);
    assert.ok(/Fourth Awakening/.test(r.t4[1]) && /Limit Break/.test(r.t4[1]) && /Supreme Poise/.test(r.t4[1]) && /Overwhelming Aura/.test(r.t4[1]) && !/Combat Vitality/.test(r.t4[1]), 'the three new ones: ' + r.t4[1]);
    assert.ok(near(r.n[0], 1.18), 'attributes +5%, +5%, +8%: ' + r.n[0]);
    assert.deepEqual(r.n.slice(1), [1.05, 0.95, 0.9, 0.9]);
    assert.ok(near(r.auraNear, 1.05) && near(r.auraFar, 1), 'Overwhelming Aura on the foes near you: ' + r.auraNear + ' ' + r.auraFar);
    assert.equal(r.kept, 4, 'an awakening is kept');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the max level: it stops there, the absolute awakening, its true damage and World of Transcendence', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, A = window.__GAWK, o = {};
      delete window.__awkPlain;
      S.lv = 998; S.xp = 0; S.awk = 4; G.gainXP(1e15, true); o.lv = S.lv; o.xpOk = S.xp < window.__GXP.needL(999);
      G.gainXP(1e15, true); o.lv2 = S.lv;
      G.P.hitT = -99; A.tick(.5); o.awk = S.awk; for (let i = 0; i < 20 && G.DL; i++)G.advance();
      o.sk = window.__GRZ.skills().includes('awkworld');
      o.trueGap = A.atk({ type: 'wolf', lv: 1200, x: G.P.x + 400, y: G.P.y }); o.truePure = A.atk({ type: 'wolf', lv: 1200, x: G.P.x + 400, y: G.P.y }, { pure: 1 });
      G.P.mp = 1e6; G.P.cd = {}; window.__GRZ.cast('awkworld'); o.cd = (G.P.cd.awkworld || 0) > 100; o.spd = A.spd(); o.cr = A.cr();
      return o;
    });
    assert.equal(r.lv, 999); assert.ok(r.xpOk, 'experience stops short of another level'); assert.equal(r.lv2, 999);
    assert.equal(r.awk, 5);
    assert.ok(r.sk, 'World of Transcendence on the bar');
    assert.ok(r.trueGap > 1.05, 'true damage ignores the level gap: ' + r.trueGap); assert.ok(near(r.truePure, 1.05));
    assert.ok(r.cd, 'a 3-minute cooldown'); assert.ok(near(r.spd, 1.05 * 1.25)); assert.ok(near(r.cr, 0.15));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Combat Vitality, the aura online, the switch in the equipment window, the status line, and drawing', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, A = window.__GAWK, o = {};
      delete window.__awkPlain;
      S.lv = 320; S.awk = 3; S.awc = 200;
      P.hp = 10; P.mp = 10; P.hitT = -99; P.awkCt = -99; A.tick(1); o.idle = [P.hp, P.mp];
      P.hitT = 1e9; A.tick(1); o.fight = [P.hp, P.mp]; P.hitT = -99;
      o.pub = A.pub();
      o.rem = A.fxIn({ fx: JSON.stringify(['in:1', 'ak:3' + (200).toString(36)]) }, {});
      o.bad = A.fxIn({ fx: JSON.stringify(['in:1', 'ak:9zz']) }, {});
      G.eqx.openEquip(); o.row = !!document.querySelector('#eqInfo [data-awkv]'); document.querySelector('#eqInfo [data-awkv]').click();
      o.hid = S.awh; o.pubHid = A.pub(); o.label = document.querySelector('#eqInfo [data-awkv]').textContent;
      document.querySelector('#eqInfo [data-awkv]').click(); o.shown = !S.awh;
      for (const T of [1, 2, 3, 4, 5]) A.draw(P.x, P.y, T, 120);
      window.__step(30);
      return o;
    });
    assert.deepEqual(r.idle, [10, 10], 'out of combat: nothing');
    assert.deepEqual(r.fight, [11, 11], 'one health and one mana a second in combat');
    assert.equal(r.pub, 'ak:3' + (200).toString(36));
    assert.equal(r.rem.ak, 3); assert.equal(r.rem.akh, 200);
    assert.equal(r.bad.ak, 0, 'a bad tag is ignored');
    assert.ok(r.row); assert.equal(r.hid, 1); assert.equal(r.pubHid, r.pub, 'only what you see: others still see yours');
    assert.ok(/hidden/.test(r.label)); assert.ok(r.shown);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('kept the moment it is reached, even mid-fight; announced later; a hidden level hides the aura from others', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, A = window.__GAWK, o = {};
      delete window.__awkPlain;
      S.lv = 200; P.hitT = 1e9; A.tick(.5); o.mid = [S.awk, S.awkA | 0, typeof S.awc, !!G.DL];
      S.lv = 150; o.kept = A.tier();
      P.hitT = -99; P.awkCt = -99; A.tick(.5); o.ann = [S.awkA, !!G.DL && /Second Awakening/.test(G.DL.lines.join(' '))];
      for (let i = 0; i < 20 && G.DL; i++)G.advance();
      o.pub = A.pub(); window.__G.S.lv = 999; o.xp = window.__GXP.gain(1e6, true);
      return o;
    });
    assert.deepEqual(r.mid, [2, 0, 'number', false], 'recorded at once, no window mid-fight');
    assert.equal(r.kept, 2, 'a level lost in that fight keeps it');
    assert.deepEqual(r.ann, [2, true], 'announced once out of combat');
    assert.ok(/^ak:2/.test(r.pub));
    assert.equal(r.xp, 0, 'no experience at the max level');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
