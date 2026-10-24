'use strict';
// SAT-ONLINE-171 (owner 2026-10-23: "start on a Second Class like Huroi's", "very, very rare, we don't want many"):
//   - each of the five comes from its own hidden condition, kept as a second class on top of the first (the first class
//     and its skills stay), with its two skills, 2 more stat points a level and "First (Second)" in the status window;
//   - one second class a character; one holder of each in the world (here: this device's record of another character);
//   - the first in the world: the title First to Obtain a Second Class;
//   - Huroi's: an Orator who did the Deserter Captain's quest waits in Winston without fighting; leaving starts it over;
//   - the skills work: Sacrifice for Justice burns the health down to 10% for a big blow, the others hit or hold.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function game() {
  const g = await H.openGame({});
  await H.newGame(g);
  await g.eval(() => { const G = window.__G; G.P.inv = 1e9; G.P.mp = 1e6; });
  return g;
}

test('each second class from its condition: kept with the first, two skills, +2 points a level, one each, the first title', async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const C = window.__GSC2, T = window.__GTTL, G = window.__G, S = G.S, o = {};
      const p0 = C.pts();
      o.none = Object.keys(C.C2 || C.SC2 || {}).length;
      // the Bomber: 25 times one skill that hits 15 at once (here the counts are set)
      S.sc2k = { bomb: 24 }; C.tick(2); o.before = S.cls2 || null;
      S.sc2k.bomb = 25; const cls = S.cls; C.tick(2);
      o.got = S.cls2; o.cls = S.cls === cls; o.pts = C.pts() - p0;
      o.skills = ['cbomb', 'mblast'].map((k) => T.ok(k) && T.cls().includes(k));
      o.others = ['sjust', 'djudg', 'sstep', 'iharv'].map((k) => T.ok(k) || T.cls().includes(k));
      o.title = !!S.tl.fsc;
      // a second one is never given
      S.sc2k.night = 5000; S.lv = 300; C.tick(2); o.still = S.cls2;
      return o;
    });
    assert.equal(r.before, null, 'not before the condition');
    assert.equal(r.got, 'bomb');
    assert.ok(r.cls, 'the first class stays');
    assert.equal(r.pts, 2, '2 more stat points a level');
    assert.deepEqual(r.skills, [true, true], 'its two skills');
    assert.deepEqual(r.others, [false, false, false, false], 'and no other second class\'s');
    assert.ok(r.title, 'the first in the world: First to Obtain a Second Class');
    assert.equal(r.still, 'bomb', 'one second class a character');
    // the status window: "First (Second)" (after the system's message)
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode === 'dialog'); i++) { await g.page.keyboard.press('Enter'); await g.step(2); }
    await g.page.keyboard.press('c'); await g.step(3);
    assert.match(await g.page.textContent('#statusW'), /Novice \(Merciless Bomber\)/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('one holder in the world: a class another character holds is never given; the others still are', async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const C = window.__GSC2, G = window.__G, S = G.S, L = C.legs();
      L.c2_shad = { pid: 'someone-else', n: 'Faker' }; L.c2first = { pid: 'someone-else', n: 'Faker' };
      S.lv = 200; S.sc2k = { night: 1000 }; C.tick(2);
      const a = S.cls2 || null, ta = C.taken('shad');
      S.sc2k.bomb = 25; C.tick(2);
      return { a, ta, b: S.cls2, title: !!S.tl.fsc };
    });
    assert.equal(r.ta, true);
    assert.equal(r.a, null, 'Faker holds it');
    assert.equal(r.b, 'bomb', 'another one, still free');
    assert.equal(r.title, false, 'not the first in the world');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("Huroi's: an Orator after the Deserter Captain waits in Winston; leaving starts over; 50 minutes and it is his", async () => {
  const g = await game();
  try {
    await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'orator'; S.qs.pt6 = { st: 2, n: 1 }; });
    await g.step(60);
    const w1 = await g.eval(() => window.__GSC2.W);
    assert.ok(w1 > 0.5, 'calm in Winston: the wait runs: ' + w1);
    // leaving Winston: back to nothing
    await g.eval(() => { const P = window.__G.P; P._x = P.x; P._y = P.y; P.x = 40 * 16; P.y = 40 * 16; });
    await g.step(5);
    assert.equal(await g.eval(() => window.__GSC2.W), 0);
    await g.eval(() => { const P = window.__G.P; P.x = P._x; P.y = P._y; });
    // close to the end: the class
    await g.eval(() => { window.__GSC2.W = 2999; });
    await g.step(150);
    const r = await g.eval(() => { const S = window.__G.S, T = window.__GTTL; return { c: S.cls2, cls: S.cls, uj: T.ok('ujust'), sj: T.ok('sjust'), title: S.title }; });
    assert.equal(r.c, 'ajp');
    assert.equal(r.cls, 'orator', 'still an Orator');
    assert.equal(r.sj, true, 'Sacrifice for Justice');
    assert.equal(r.uj, true, 'Unbreakable Justice without wearing the title');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the skills: Sacrifice for Justice burns the health to 10% for a big blow; the others hit, hold or heal', async () => {
  const g = await game();
  try {
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, T = window.__GTTL, o = {};
      const foe = () => { const m = G.spawnMon('wolf', P.x, P.y + 24); m.max = m.hp = 1e9; return m; };
      P.dir = 0; const r0 = Math.random; Math.random = () => 0.5;
      const m0 = foe(); let h = m0.hp; window.__GWP.hit(m0, 1); const basic = h - m0.hp;
      S.cls2 = 'ajp'; P.hp = T.mh(); h = m0.hp; T.sk('sjust'); o.sac = (h - m0.hp) / basic; o.hp = P.hp / T.mh();
      for (const [c, k] of [['pope', 'djudg'], ['shad', 'sbind'], ['bomb', 'cbomb'], ['bomb', 'mblast'], ['sfarm', 'iharv'], ['sfarm', 'splow'], ['shad', 'sstep']]) {
        S.cls2 = c; const m = foe(); const h0 = m.hp; T.sk(k); o[k] = k === 'sbind' ? (m.stun || 0) : h0 - m.hp; m.dead = true; }
      S.cls2 = 'pope'; P.hp = T.mh() * .5; T.sk('papbl'); o.bless = P.hp / T.mh();
      Math.random = r0;
      return o;
    });
    assert.ok(r.sac > 10, 'a big blow (at full health, about 14x): ' + r.sac);
    assert.ok(Math.abs(r.hp - 0.1) < 0.01, 'down to 10%: ' + r.hp);
    for (const k of ['djudg', 'cbomb', 'mblast', 'iharv', 'splow', 'sstep']) assert.ok(r[k] > 0, k + ' hits: ' + r[k]);
    assert.ok(r.sbind >= 2.9, 'Shadow Bind holds 3 s: ' + r.sbind);
    assert.ok(Math.abs(r.bless - 0.8) < 0.01, 'the Papal Blessing: 30% back: ' + r.bless);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
