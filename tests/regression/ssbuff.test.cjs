'use strict';
// The Sword Saint made stronger (the player Soki through the owner 2026-10-26: "buff/add skills to most legendary classes"): his
// skills hit about 30% harder and Manifestation of Will strikes up to eight foes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Sword Saint: Manifestation of Will on eight foes, the texts say the new numbers', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF;
      S.cls = 'saint'; S.lv = 300; G.isk.checkSkills();
      for (const m of G.mons()) m.dead = true;
      window.__SSW = []; for (let i = 0; i < 10; i++) { const m = G.spawnMon('wolf', P.x + 20 + i * 12, P.y + (i % 2) * 10); m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1; window.__SSW.push(m); }
      P.mp = 1e6; A.cast('mheaven'); });
    await g.page.waitForTimeout(1200); await g.step(5);
    const r = await g.eval(() => ({ hit: window.__SSW.filter((m) => m.hp < 1e9).length,
      txt: ['mcross', 'mheaven', 'sskp', 'sscond'].map((k) => window.__GSKF.info(k).desc) }));
    assert.equal(r.hit, 8, 'Manifestation of Will strikes eight');
    assert.match(r.txt[0], /650%/); assert.match(r.txt[1], /up to 8 foes/); assert.match(r.txt[2], /3,250%/); assert.match(r.txt[3], /1,040%/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// The Demon Slayer too: her skills about 30% harder, and Demon Predator at 300 (ch1024, the white armour from hell).
test('the Demon Slayer: Demon Predator at 300 takes 30% off every blow, the texts say the new numbers', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GPG;
      S.cls = 'dslayer'; S.lv = 299; G.isk.checkSkills(); const out = { at299: !!S.sk.dspred };
      S.lv = 300; G.isk.checkSkills(); out.at300 = !!S.sk.dspred;
      for (const m of G.mons()) m.dead = true;
      const m = G.spawnMon('wolf', P.x + 30, P.y); m.lv = 1; m.max = m.hp = 1e9; m.tmp = 0;
      P.hp = P.mhp = 1e9; P.inv = 0; const h0 = P.hp; X.hurt(1000, m); out.plain = h0 - P.hp;
      P.cd = {}; P.mp = 1e6; window.__GSS2.cast('dspred'); P.inv = 0; P.dash = 0; const h1 = P.hp; X.hurt(1000, m); out.armour = h1 - P.hp;
      out.txt = window.__GSKF.info('dsvind').desc;
      return out; });
    assert.equal(r.at299, false); assert.equal(r.at300, true);
    assert.ok(r.plain > 0 && Math.abs(r.armour / r.plain - 0.7) < 0.02, `30% less (${r.plain} -> ${r.armour})`);
    assert.match(r.txt, /440%/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// The Legendary Knight: Supreme Swordsmanship 4th Style at 300 (ch807) catches a blow bare-handed and answers it; Tzudan's arc.
test('the Legendary Knight: the 4th Style catches a blow and answers it; Keen Insight 20%; Tzudan 340%', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GPG;
      S.cls = 'lknight'; S.lv = 299; G.isk.checkSkills(); const out = { at299: !!S.sk.lkpalm };
      S.lv = 300; G.isk.checkSkills(); out.at300 = !!S.sk.lkpalm;
      for (const m of G.mons()) m.dead = true;
      const m = G.spawnMon('wolf', P.x + 30, P.y); m.lv = 1; m.max = m.hp = 1e9; m.tmp = 0;
      P.hp = P.mhp = 1e9; P.inv = 0; P.cd = {}; P.mp = 1e6; window.__GSS2.cast('lkpalm'); P.inv = 0; P.dash = 0;
      const h0 = P.hp; out.taken = X.hurt(1000, m); out.lost = h0 - P.hp; out.struck = m.hp < 1e9;
      out.second = X.hurt(1000, m) > 0;   // only the first blow is caught
      out.txt = [window.__GSKF.info('lkinsight').desc, window.__GSKF.info('tzcleave').desc];
      return out; });
    assert.equal(r.at299, false); assert.equal(r.at300, true);
    assert.equal(r.lost, 0, 'the blow caught does nothing'); assert.equal(r.struck, true, 'and the striker is answered');
    assert.equal(r.second, true, 'only the first blow');
    assert.match(r.txt[0], /\+20%/); assert.match(r.txt[1], /340%/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// Mumud's, Madra's and the Legendary Farmer's skills say their new numbers (about 30% more); Piaro's Perish stays the novel's 3,000%.
test("Mumud, Madra and the Legendary Farmer: the new numbers", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const d = await g.eval(() => ['mmwater', 'mmnull', 'mmdrain', 'mdarmy', 'mdarmy2', 'lfmortar', 'lfperish'].map((k) => window.__GSKF.info(k).desc));
    assert.match(d[0], /290%/); assert.match(d[1], /340%/); assert.match(d[2], /160%/); assert.match(d[3], /650%/); assert.match(d[4], /1,040%/);
    assert.match(d[5], /260% a pounding \(1,040% in all\)/); assert.match(d[6], /3,000%/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
