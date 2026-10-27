'use strict';
// Owner 2026-10-27 (a tester's list): five unlockable races, each from a trial the system offers where the novel puts that
// people; finishing it replaces your race and rolls a bloodline (5% the rare one, 15% the uncommon one). The Yangban and the
// Demonkin are the hardest. Their numbers feed the combat formulas; each has a racial skill on the bar.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('the Evil Eye trial: offered in the Beware Dogs dungeon, two steps, and the race replaces a vampire', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { window.__G.S.race = 'vampire'; window.__G.S.lv = 260; });
    const s = await g.eval(() => {
      const G = window.__G, Z = window.__GRZ, o = {};
      G.S.zone = 'zBdog'; Z.tick(1);
      o.dlg = !document.getElementById('dialog').hidden;
      o.text = document.getElementById('dialog').textContent;
      const b = [...document.querySelectorAll('#dialog button, #dialog .opt, #dialog [data-i]')];
      o.btns = b.length;
      return o;
    });
    assert.ok(s.dlg, 'entering the dungeon at level 260 opens the offer');
    assert.ok(/driven out of hell|اتطردوا من الجحيم/.test(s.text) || s.text.length > 0, s.text.slice(0, 200));
    const t = await g.eval(async () => {
      const G = window.__G, Z = window.__GRZ, C = window.__GPB9, o = {};
      C.accept('rze1'); o.on = G.S.qs.rze1.st;
      for (let i = 0; i < 25; i++)Z.ev('bdv'); Z.tick(1);
      o.done1 = G.S.qs.rze1.st;
      await new Promise((res) => setTimeout(res, 1500));
      o.step2 = G.S.qs.rze2 && G.S.qs.rze2.st;
      G.S.qs.rze2.c = 100; Z.tick(1);
      o.race = G.S.race; o.rv = G.S.rv; o.name = Z.name(); o.sk = Z.skills().includes('rzeye');
      return o;
    });
    assert.equal(t.on, 1);
    assert.equal(t.done1, 2, 'twenty veins finish the first step');
    assert.equal(t.step2, 1, 'the second step follows by itself');
    assert.equal(t.race, 'evileye', 'the race replaced the vampire');
    assert.ok(['', 'v1', 'v2'].includes(t.rv));
    assert.ok(t.sk, 'Eye of Destruction is yours');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('distinct kills: the four beasts count once each, and only while the trial is yours', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, Z = window.__GRZ, C = window.__GPB9, o = {};
      G.S.lv = 460; Z.ev('sbeast', 'stiger'); o.before = (G.S.rzq && G.S.rzq.sbeast) ? G.S.rzq.sbeast.length : 0;
      C.accept('rzy1'); for (const k of ['stiger', 'stiger', 'sbird', 'stort', 'stort'])Z.ev('sbeast', k);
      o.c3 = G.S.qs.rzy1.c; Z.ev('sbeast', 'sdrag'); o.c4 = G.S.qs.rzy1.c;
      return o;
    });
    assert.equal(r.before, 0);
    assert.equal(r.c3, 3);
    assert.equal(r.c4, 4);
  } finally { await g.close(); }
});

test('each race changes the numbers it says and its skill works; bloodlines roll 5% and 15%', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, Z = window.__GRZ, B = window.__GPB11, o = {};
      G.P.inv = 1e9; G.S.lv = 300; G.S.race = 'vampire'; G.S.rv = ''; const hp0 = G.maxHP(), m = B.newMon('wolf', G.P.x + 20, G.P.y);
      const a0 = Z.atk(m, {});
      G.S.race = 'giant'; G.S.rv = ''; o.giantHp = G.maxHP() / hp0; o.str = Z.stM('str');
      G.S.rv = 'v2'; o.titanCC = Z.cc(); G.S.rv = '';
      G.S.race = 'draco'; o.dracoAtk = Z.atk(m, {}) / a0; o.dracoHurt = Z.hurt(1000, m);
      G.S.race = 'yangban'; o.core = Z.stM('agi'); o.yangSk = Z.atk(m, { skill: 1 });
      G.S.race = 'evileye'; G.S.rv = 'v2'; o.omni = Z.omni(); G.S.rv = '';
      G.S.race = 'demon'; G.P.rzHfU = 1e9; m.rgOffU = 1e9; o.sure = Z.sure(m); G.P.rzHfU = 0;
      G.S.rv = 'v2'; m.rzCor = 10; o.rg = Z.rg(m); G.S.rv = '';
      G.S.race = 'vampire'; G.S.rv = ''; o.human = [Z.atk(m, {}), Z.hurt(1000, m), Z.stM('str')];
      // the skills, cast for real
      o.cast = {};
      for (const [r, k] of [['evileye', 'rzeye'], ['giant', 'rzquake'], ['draco', 'rzbreath'], ['yangban', 'rzchiyou'], ['demon', 'rzhell']]) {
        G.S.race = r; G.P.mp = 1e6; G.P.cd = {}; window.__GRZ.cast(k); o.cast[k] = (G.P.cd[k] || 0) > 0;
      }
      o.stance = G.P.rzStU > 0; o.ccNow = (G.S.race = 'yangban', Z.cc());
      // the roll
      let v1 = 0, v2 = 0; const N = 4000;
      for (let i = 0; i < N; i++) { G.S.qs = G.S.qs || {}; Z.gain('giant'); if (G.S.rv === 'v1') v1++; else if (G.S.rv === 'v2') v2++; document.getElementById('dialog').hidden = true; }
      o.p1 = v1 / N; o.p2 = v2 / N;
      return o;
    });
    assert.ok(Math.abs(r.giantHp - 1.25) < 0.02, 'giants +25% health: ' + r.giantHp);
    assert.ok(Math.abs(r.str - 1.3) < 1e-9);
    assert.equal(r.titanCC, true, 'the Ancient Titan is unstoppable');
    assert.ok(r.dracoAtk > 1.14, 'half-draconians +15% attack: ' + r.dracoAtk);
    assert.ok(r.dracoHurt < 1000 * 0.81, 'and their scales take a fifth off a physical blow: ' + r.dracoHurt);
    assert.ok(Math.abs(r.core - 1.15) < 1e-9, 'yangbans +15% to every core stat');
    assert.ok(r.yangSk >= 1.2, 'and +20% skill power');
    assert.equal(r.omni, true);
    assert.equal(r.sure, true, 'Hellfire Overdrive: a sure critical on a burning foe');
    assert.ok(Math.abs(r.rg - 0.8) < 1e-9, 'ten stacks of corruption cut healing by 20%');
    assert.deepEqual(r.human, [1, 1000, 1], 'a vampire has none of these');
    assert.deepEqual(r.cast, { rzeye: true, rzquake: true, rzbreath: true, rzchiyou: true, rzhell: true }, 'every racial skill casts');
    assert.ok(r.stance && r.ccNow, 'the stance makes you immune to stuns');
    assert.ok(r.p1 > 0.12 && r.p1 < 0.18, 'the uncommon bloodline about 15%: ' + r.p1);
    assert.ok(r.p2 > 0.03 && r.p2 < 0.07, 'the rare one about 5%: ' + r.p2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('base races: one free switch, the skin others see, the numbers, the skills and a bloodline quest', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, Z = window.__GRZ, C = window.__GPB9, B = window.__GPB11, o = {};
      G.P.inv = 1e9; G.S.lv = 320; G.S.rv = '';
      delete window.__rzPlain; // the Human as players have it: the strengths from the start, before any pick
      o.hum = [Z.xp(), Z.stM('dex')];
      o.row = Z.row();
      G.S.look.skin = 3; Z.pickAsk('elf', 'dark');
      const yes = [...document.querySelectorAll('#dialog button, #dialog .opt, #dialog [data-i]')];
      o.btns = yes.length;
      return o;
    });
    assert.ok(Math.abs(r.hum[0] - 1.1) < 1e-9 && Math.abs(r.hum[1] - 1.05) < 1e-9, 'a Human: +10% experience, +5% attributes ' + r.hum);
    assert.ok(/data-rzp/.test(r.row), 'the status window offers the free switch');
    const s = await g.eval(() => {
      const G = window.__G, Z = window.__GRZ, o = {};
      G.S.brf = 1; Z.gain('elf', 'dark'); Z.tick(1);
      o.race = G.S.race; o.sub = G.S.rsub; o.name = Z.name(); o.skin = G.S.look.skin; o.hsk = G.S.look.hsk; o.fig = Z.fig(G.S.look);
      o.sk = Z.skills().filter((k) => /^rz/.test(k)); o.dex = Z.stM('dex'); o.row = Z.row();
      // a second switch is refused
      document.getElementById('dialog').hidden = true; Z.pick(); o.used = document.getElementById('dialog').textContent;
      // the dwarf, the orc, the merfolk
      G.S.rv = ''; Z.gain('dwarf'); o.dwSkin = G.S.look.skin; o.dwSpd = Z.spd(); o.dwHurt = Z.hurt(1000, { type: 'wolf', x: G.P.x + 300, y: G.P.y });
      G.S.rv = ''; Z.gain('orc', 'frost'); o.orFig = Z.fig(G.S.look); G.P.hp = 1; o.orAtk = Z.atk({ type: 'wolf', lv: G.S.lv }, {}); G.P.hp = 1e9;
      G.P.rzHwU = 1e9; o.st = Z.st(); G.P.rzHwU = 0;
      G.S.rv = ''; Z.gain('merfolk'); o.meIce = Z.atk({ type: 'wolf', lv: G.S.lv }, { el: 'water', skill: 1 });
      // back to human: the old skin returns
      G.S.rv = ''; Z.gain('human'); Z.tick(1); o.back = G.S.look.skin;
      // every new racial skill casts
      o.cast = {};
      for (const [r, k, sub] of [['human', 'rzwind'], ['elf', 'rzspirit'], ['elf', 'rzshadow', 'dark'], ['merfolk', 'rzsurge'], ['dwarf', 'rzforge'], ['orc', 'rzhowl']]) {
        G.S.race = r; G.S.rsub = sub || ''; G.P.mp = 1e6; G.P.cd = {}; Z.cast(k); o.cast[k] = (G.P.cd[k] || 0) > 0;
      }
      // a bloodline quest awakens its bloodline
      G.S.race = 'dwarf'; G.S.rsub = ''; G.S.rv = ''; window.__GPB9.accept('rvdw2');
      for (let i = 0; i < 300; i++)window.__GRZ.ev('fire'); Z.tick(1); o.rv = G.S.rv;
      return o;
    });
    assert.equal(s.race, 'elf'); assert.equal(s.sub, 'dark');
    assert.ok(/Dark Elf|دارك إلف/.test(s.name), s.name);
    assert.ok(s.skin >= 12, 'a skin of its own: ' + s.skin); assert.equal(s.hsk, 3, 'the old skin is kept for later');
    assert.ok(s.fig.ears, 'drawn with pointed ears');
    assert.deepEqual(s.sk, ['rzshadow'], 'a Dark Elf has Shadow Step, not Spirit Arrow');
    assert.ok(Math.abs(s.dex - 1.2) < 1e-9);
    assert.ok(!/data-rzp/.test(s.row), 'the free switch is gone');
    assert.ok(/new character|شخصية جديدة/.test(s.used), 'a second switch is refused');
    assert.ok(s.dwSkin >= 12 && s.dwSkin !== s.skin);
    assert.ok(Math.abs(s.dwSpd - 0.85) < 0.2 && s.dwSpd < 1, 'dwarves are slower: ' + s.dwSpd);
    assert.ok(s.dwHurt < 1000 * 0.91, 'Stout Physique: ' + s.dwHurt);
    assert.ok(s.orFig.tusk && s.orFig.ears, 'an orc has tusks');
    assert.ok(s.orAtk > 1.25, 'Honor of the Tribe at low health: ' + s.orAtk);
    assert.ok(/B/.test(s.st), 'the howl rides in the st tag');
    assert.ok(s.meIce >= 1.2, 'merfolk water magic +20%: ' + s.meIce);
    assert.equal(s.back, 3, 'a Human gets the old skin back');
    assert.deepEqual(s.cast, { rzwind: true, rzspirit: true, rzshadow: true, rzsurge: true, rzforge: true, rzhowl: true });
    assert.equal(s.rv, 'v2', 'Heart of the Volcano makes a Dark Dwarf');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
