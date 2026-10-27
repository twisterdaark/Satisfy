'use strict';
// Owner 2026-10-27 23:50: "Bloodline Quest for each race should be separated into their own npc, so it's not all a part of the
// menu and people have to explore. Please add all races to the index and variants ... For rare variants make the quest harder."
// Every bloodline has a keeper standing in the world; it offers its quest only to its own race, from its level, and takes it
// back; a rare bloodline is two quests; the status window's menu is gone; the Index has a Races page with hints.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
// talk to a keeper and read what it said and offers; drain() runs the lines to their end (the done callback included)
const HELP = () => {
  window.__bk = {
    talk(id) { const G = window.__G; document.getElementById('dialog').hidden = true; G.talkNPC(id); const D = G.DL; return D ? { who: D.who, text: D.lines.map((l) => window.__G.lines().en[l] || l).join(' | '), opts: (D.opts || []).map((o) => o.l) } : null; },
    pick(label) { const D = window.__G.DL; const o = D && (D.opts || []).find((x) => x.l === label); if (!o) return false; o.f(); return true; },
    drain() { for (let i = 0; i < 80 && window.__G.DL && !window.__G.DL.optOn; i++)window.__G.advance(); },
  };
};

test('twenty keepers stand in the world, one for each bloodline, at their places', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, K = window.__GRVK, o = {};
      o.n = K.RVK.length; o.ids = new Set(K.RVK.map((k) => k[1] + k[2])).size;
      o.at = K.RVK.map((k) => { const n = G.npcs.find((x) => x.id === k[0]); return n ? [k[0], G.zoneAt(n.x, n.y), G.eqx.solid(Math.floor(n.x / 16), Math.floor(n.y / 16))] : [k[0], null, true]; });
      o.names = K.RVK.every((k) => G.lines().en[k[0]] && G.lines().ar[k[0]]);
      o.quests = K.RVK.every((k) => k[5].every((q) => G.QD[q] && G.QD[q].by === k[0]));
      o.rare = K.RVK.filter((k) => k[2] === 'v2').every((k) => k[5].length === 2 && G.QD[k[5][1]].pre === k[5][0]);
      return o;
    });
    assert.equal(r.n, 20); assert.equal(r.ids, 20, 'one keeper for each race and bloodline');
    const want = { rvkHu1: 'zRuin', rvkHu2: 'zMull', rvkEl1: 'zWPine', rvkEl2: 'zSWood', rvkMe1: 'zESea', rvkMe2: 'zSSea', rvkDw1: 'zMine1', rvkDw2: 'zSDes', rvkOr1: 'zOrc', rvkOr2: 'zGrave',
      rvkEe1: 'zKesan', rvkEe2: 'zAbyss3', rvkGi1: 'zGlac', rvkGi2: 'zGiantL', rvkDr1: 'zPeak', rvkDr2: 'zChaos4', rvkYa1: 'zEaCho', rvkYa2: 'zEaXing', rvkDe1: 'zHellV', rvkDe2: 'zHell9' };
    for (const [id, z, solid] of r.at) { assert.equal(z, want[id], id + ' stands in ' + z); assert.equal(solid, false, id + ' on open ground'); }
    assert.ok(r.names, 'every keeper has a name in both languages');
    assert.ok(r.quests, 'every bloodline quest is given by its keeper');
    assert.ok(r.rare, 'a rare bloodline is two quests, the second after the first');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a keeper offers only to its own race, from its level, and the menu is gone', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, B = window.__bk, o = {};
      S.brf = 1; S.race = 'elf'; S.rsub = ''; S.rv = ''; S.lv = 150;
      o.elf = B.talk('rvkDw1'); B.drain(); o.elfQ = !!S.qs.rvdw1;
      o.row = window.__GRZ.row();
      S.race = 'dwarf'; S.lv = 50; o.low = B.talk('rvkDw1'); B.drain();
      S.lv = 120; o.offer = B.talk('rvkDw1'); o.acc = B.pick(G.lines().en.qAccept); o.st = S.qs.rvdw1 && S.qs.rvdw1.st;
      return o;
    });
    assert.ok(!/data-rzv/.test(r.row), 'no bloodline menu in the status window');
    assert.ok(/Runes don't care|Mind the walls/.test(r.elf.text), 'an elf hears its words: ' + r.elf.text);
    assert.equal(r.elfQ, false, 'and no quest');
    assert.ok(/level 100/.test(r.low.text), 'a dwarf under its level is told when: ' + r.low.text);
    assert.ok(/ten good pieces/i.test(r.offer.text), 'the offer: ' + r.offer.text);
    assert.ok(r.acc); assert.equal(r.st, 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a rare bloodline: two quests at its keeper, each taken back there, and the second wakes it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, B = window.__bk, Z = window.__GRZ, en = G.lines().en, o = {};
      S.brf = 1; S.race = 'dwarf'; S.rsub = ''; S.rv = 'v1'; S.lv = 260;
      o.first = B.talk('rvkDw2'); o.warn = /replaces/.test(o.first.text); B.pick(en.qAccept); o.a = S.qs.rvdw2a && S.qs.rvdw2a.st;
      for (let i = 0; i < 300; i++)Z.ev('fire'); Z.tick(1);
      o.aSelf = S.qs.rvdw2a.st;   // not finished by itself: it goes back to the keeper
      o.back = B.talk('rvkDw2'); B.drain(); o.aDone = S.qs.rvdw2a.st;
      o.second = B.talk('rvkDw2'); B.pick(en.qAccept); o.b = S.qs.rvdw2 && S.qs.rvdw2.st;
      o.obj = JSON.stringify(G.QD.rvdw2.obj);
      S.qs.rvdw2.c = 3; o.rv0 = S.rv; B.talk('rvkDw2'); B.drain(); await new Promise((res) => setTimeout(res, 50)); B.drain();
      o.rv = S.rv; o.bDone = S.qs.rvdw2.st;
      return o;
    });
    assert.ok(/three hundred things made of fire/i.test(r.first.text), r.first.text);
    assert.ok(r.warn, 'a dwarf with a bloodline is told the new one replaces it');
    assert.equal(r.a, 1); assert.equal(r.aSelf, 1, 'a keeper takes the quest back');
    assert.equal(r.aDone, 2);
    assert.ok(/unique rating or better/i.test(r.second.text), r.second.text); assert.equal(r.b, 1);
    assert.equal(r.obj, JSON.stringify({ t: 'craftR', it: 'craft', n: 3, r: 3 }), 'the second asks more than the old one quest did');
    assert.equal(r.bDone, 2); assert.equal(r.rv0, 'v1'); assert.equal(r.rv, 'v2', 'Heart of the Volcano makes a Dark Dwarf');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('old saves, the new counts, and the whisper', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, K = window.__GRVK, Z = window.__GRZ, o = {};
      S.brf = 1; S.race = 'human'; S.rsub = ''; S.rv = ''; S.lv = 320;
      // a human who carried "Beyond the Limits" from the old menu: its progress counts for the first quest
      S.qs.rvhu2 = { st: 1, c: 120 }; K.mig(); o.mig = [S.qs.rvhu2a && S.qs.rvhu2a.c, !!S.qs.rvhu2];
      o.avail2 = K.ok('rvhu2'); o.availA = K.ok('rvhu2a');
      // a boss above you counts for the second; a boss below you does not
      delete S.qs.rvhu2a; S.qs.rvhu2a = { st: 2, c: 500 }; G.acceptQ('rvhu2');
      Z.kill({ type: 'dcapt', lv: 400, x: G.P.x, y: G.P.y }); Z.kill({ type: 'dcapt', lv: 80, x: G.P.x, y: G.P.y }); o.boss = S.qs.rvhu2.c;
      // the Void Elf's dance: a dodge counts only with a boss close
      S.race = 'elf'; S.qs.rvel2a = { st: 2, c: 300 }; G.acceptQ('rvel2'); K.dodge(); o.far = S.qs.rvel2.c;
      const b = G.mons().find((m) => G.QD && m && m.type === 'dcapt'); if (b) { b.x = G.P.x + 40; b.y = G.P.y; b.dead = false; }
      K.dodge(); o.near = S.qs.rvel2.c;
      // the whisper: a merfolk at the level of its keeper, who has not met it, is told the blood stirs, not where
      S.race = 'merfolk'; S.rv = ''; S.lv = 210; G.S.met = G.S.met || {}; delete S.met.rvkMe1;
      const toasts = []; const T = document.getElementById('toasts') || document.body;
      K.tick(); o.toast = [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | ');
      return o;
    });
    assert.deepEqual(r.mig, [120, false], 'the old progress moved to the first quest');
    assert.equal(r.avail2, false, 'the second waits for the first'); assert.equal(r.availA, false, 'and the first is under way');
    assert.equal(r.boss, 1, 'only the boss above your level counts');
    assert.equal(r.far, 0); assert.equal(r.near, 1, 'a dodge with a boss close counts');
    assert.ok(/Royal Siren/.test(r.toast) && /Index/.test(r.toast), 'the whisper: ' + r.toast);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Index has a Races page: every race and kind, its bloodlines, hints until a keeper is met', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GIX, B = window.__bk, o = {};
      S.brf = 1; S.race = 'orc'; S.rsub = 'frost'; S.rv = ''; S.lv = 10; S.met = S.met || {}; delete S.met.rvkOr1;
      X.open(); o.tab = !!document.querySelector('#ixTabs [data-ixt="race"]'); X.tab('race');
      o.cards = document.querySelectorAll('#ixG [data-ix]').length; o.sel = (document.querySelector('#ixG .sel') || {}).dataset;
      o.det = document.getElementById('ixD').textContent;
      X.tab('race', 'yangban'); o.yang = document.getElementById('ixD').textContent;
      X.close(); B.talk('rvkOr1'); B.drain();
      X.open(); X.tab('race', 'orc_frost'); o.met = document.getElementById('ixD').textContent; X.close();
      return o;
    });
    assert.ok(r.tab);
    assert.equal(r.cards, 13, 'thirteen races and kinds, the vampire too');
    assert.equal(r.sel && r.sel.ix, 'orc_frost', 'it opens on your own');
    assert.ok(/War Chief/.test(r.det) && /Ancestral Shaman Orc/.test(r.det), 'both bloodlines');
    assert.ok(/frost village/.test(r.det), 'a hint where the War Chief\'s keeper stands');
    assert.ok(/Battle Howl/.test(r.det), 'the racial skill');
    assert.ok(/Martial Deity/.test(r.yang) && /two quests/.test(r.yang), 'a rare bloodline asks more: ' + r.yang);
    assert.ok(/path climbs toward heaven/.test(r.yang), 'where the yangban trial is, vaguely');
    assert.ok(/Keeper: The Old Chief, in Frostlight Orc Village/.test(r.met), 'once met, where: ' + r.met.slice(0, 400));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
