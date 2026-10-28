'use strict';
// Owner 2026-10-27 23:50: relics, unique accessories, one copy of each in the world, one relic to a player (none other even in
// the bag), found through chains of stones across the map and overworld puzzles rather than a quest giver.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const HELP = () => {
  window.__rq = {
    use(id) { document.getElementById('dialog').hidden = true; window.__G.DL && (window.__G.DL.optOn = false); window.__GRQ.use(id); const D = window.__G.DL; return D ? D.lines.map((l) => window.__G.lines().en[l] || l).join(' | ') : ''; },
    opts() { const D = window.__G.DL; return D && D.opts ? D.opts.map((o) => o.l) : []; },
    pick(re) { const D = window.__G.DL; const o = D && (D.opts || []).find((x) => re.test(x.l)); if (!o) return false; o.f(); return true; },
    text() { const D = window.__G.DL; return D ? D.lines.join(' | ') : ''; },
    drain() { for (let i = 0; i < 60 && window.__G.DL && !window.__G.DL.optOn; i++)window.__G.advance(); },
    wait: (ms) => new Promise((r) => setTimeout(r, ms || 60)),
  };
};

test('the stones stand on open ground in their places; a stone out of turn says nothing', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(() => {
      const G = window.__G, Q = window.__GRQ, o = {};
      o.bad = Object.entries(Q.RQSITE).filter(([id, s]) => G.eqx.solid(s[0], s[1])).map(([id]) => id);
      o.n = Object.keys(Q.RQSITE).length;
      o.chains = Q.RQK.map((k) => Q.RQST[k].length);
      o.late = window.__rq.use('gh3'); o.vault = window.__rq.use('gh4');
      o.first = window.__rq.use('gh1'); o.firstOpts = window.__rq.opts();
      return o;
    });
    assert.deepEqual(r.bad, [], 'no stone inside a wall');
    assert.equal(r.n, 43);
    assert.deepEqual(r.chains, [4, 4, 4, 4, 4, 4, 4, 4]);
    assert.ok(/Broken stones/.test(r.late), 'a later stone is only a ruin: ' + r.late);
    assert.ok(/does not move/.test(r.vault), r.vault);
    assert.ok(/Fill the hand/.test(r.first) && r.firstOpts.some((l) => /50,000 gold/.test(l)), r.first + ' ' + r.firstOpts);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("Rebecca's chain end to end: dawn, an offering, peace, the dial (a wrong turn locks it), the relic and its powers", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, P = G.P, Q = window.__GRQ, B = window.__rq, o = {};
      window.__GVP.force(15); o.noon = B.use('re1'); o.step0 = (S.rqs || {}).rebecca | 0;
      window.__GVP.force(6); o.dawn = B.use('re1'); o.step1 = S.rqs.rebecca;
      S.mats.herb = 5; S.mats.bherb = 10; B.use('re2'); B.pick(/Offer/); o.poor = S.rqs.rebecca;
      S.mats.herb = 25; B.use('re2'); B.pick(/Offer/); await B.wait(); o.paid = [S.rqs.rebecca, S.mats.herb, S.mats.bherb];
      Q.kill({ type: 'wolf' }); o.blood = B.use('re3'); o.step2 = S.rqs.rebecca;
      Q.S.kt = -1e9; o.peace = B.use('re3'); o.step3 = S.rqs.rebecca;
      const sg = Q.signs('rebecca'); o.signs = sg.map((x) => Q.G[x]).join('');
      Q.ring('rebecca', [sg[1], sg[0], sg[2]]); o.lock = (S.rqL || {}).rebecca > Date.now(); o.locked = B.use('re4');
      S.rqL.rebecca = 0; Q.ring('rebecca', sg); await B.wait(100); B.drain();
      const it = Q.item(); o.got = it && it.id; o.on = Q.on(); o.eq = S.eq && S.eq.rl === (it && it.uid);
      // its power: Divine Blessing every 60 s
      P.stun = 2; P.hp = 10; P.rqDbT = 0; Q.tick(.016); o.bless = [P.stun, P.hp > 10];
      return o;
    });
    assert.ok(/candle burned out/.test(r.noon)); assert.equal(r.step0, 0, 'at noon it does nothing');
    assert.ok(/✧/.test(r.dawn)); assert.equal(r.step1, 1, 'at dawn it answers');
    assert.equal(r.poor, 1, 'not enough herbs');
    assert.deepEqual(r.paid, [2, 5, 0], 'the offering is taken');
    assert.ok(/fresh blood/.test(r.blood)); assert.equal(r.step2, 2, 'not after a kill');
    assert.ok(/✠/.test(r.peace)); assert.equal(r.step3, 3);
    assert.equal(r.signs, '✧☘✠');
    assert.ok(r.lock, 'a wrong turn locks the vault'); assert.ok(/locked/.test(r.locked));
    assert.equal(r.got, 'rl_rebecca'); assert.equal(r.on, 'rebecca'); assert.ok(r.eq, 'it goes on at once');
    assert.deepEqual(r.bless, [0, true], 'Divine Blessing: cleansed and healed');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('one relic: another vault will not give a second; a relic never leaves the bag; letting it go frees it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, Q = window.__GRQ, B = window.__rq, o = {};
      Q.give('godhand'); const it = Q.item(); o.got = it && it.id;
      S.rqs = Object.assign(S.rqs || {}, { core: 3 }); S.rqo = { core: 1 }; o.second = B.use('co4'); o.items = S.items.filter((i) => i.slot === 'rl').length;
      o.bound = Q.bound({ it }); o.tradeIn = window.__GPB7.tradeIn(JSON.stringify({ id: 'rl_core', slot: 'rl', r: 4, dur: 100 }));
      // gone: let it go
      Q.release(); B.pick(/Let it go/); o.after = [Q.item(), S.eq.rl];
      o.again = B.use('co4'); await B.wait(50); B.drain(); o.core = (Q.item() || {}).id;
      return o;
    });
    assert.equal(r.got, 'rl_godhand');
    assert.ok(/already hold a relic/.test(r.second), r.second); assert.equal(r.items, 1, 'never two');
    assert.equal(r.bound, true, 'bound to its holder'); assert.equal(r.tradeIn, null, 'no relic comes in by trade');
    assert.deepEqual(r.after, [undefined, undefined], 'let go');
    assert.equal(r.core, 'rl_core', 'with empty hands the open vault gives');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the puzzles: stones in order, a hunt, stillness, blood', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, P = G.P, Q = window.__GRQ, B = window.__rq, o = {};
      // the giant's four stones: the fewest notches first
      o.riddle = B.use('gi1');
      const touch = (id) => { B.use(id); B.pick(/Lay your hand/); };
      touch('gi1b'); touch('gi1a'); o.wrong = [(S.rqs || {}).giant | 0, (S.rqx.giant.q || []).length];
      for (const id of ['gi1b', 'gi1d', 'gi1a', 'gi1c'])touch(id); await B.wait(); o.seq = S.rqs.giant;
      // the throne's hunt: asked at the stone, counted only after
      Q.kill({ type: 'fgiant' }); o.before = S.rqx.giant.c | 0; B.use('gi2'); Q.kill({ type: 'fgiant' }); o.hunt = B.use('gi2'); o.step = S.rqs.giant;
      // the Taoist's stillness: broken by a step, kept for a minute
      S.rqs.gourd = 1; B.use('go2'); B.pick(/Sit/); P.x += 100; Q.tick(.016); o.broke = !Q.S.st; P.x -= 100;
      B.use('go2'); B.pick(/Sit/); P.hitT = -99; for (let i = 0; i < 70; i++) { if (Q.S.st) Q.S.st.t0 -= 1; Q.tick(.016); } o.still = S.rqs.gourd;
      // Baal's lectern: only whole, and it takes half
      S.rqs.baal = 2; P.hp = 10; B.use('ba3'); B.pick(/blood/); o.hurt = S.rqs.baal; for (let i = 0; i < 5 && G.DL; i++)G.advance();
      P.hp = 100000; B.use('ba3'); B.pick(/blood/); await B.wait(); o.paid = [S.rqs.baal, P.hp];
      return o;
    });
    assert.ok(/youngest to the eldest/.test(r.riddle));
    assert.deepEqual(r.wrong, [0, 0], 'a wrong stone silences them');
    assert.equal(r.seq, 1);
    assert.equal(r.before, 0, 'a kill before the throne asked does not count');
    assert.ok(/⚔/.test(r.hunt)); assert.equal(r.step, 2);
    assert.ok(r.broke, 'a step breaks the stillness'); assert.equal(r.still, 2, 'a still minute');
    assert.equal(r.hurt, 2, 'not while wounded'); assert.deepEqual(r.paid, [3, 50000]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("the relics' powers", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, Q = window.__GRQ, X = G.eqx, o = {};
      const wear = (k) => { const it = Q.item(); if (it) { S.items.splice(S.items.indexOf(it), 1); delete S.eq.rl; } Q.give(k); return Q.item(); };
      const cd0 = X.atkCD();
      wear('godhand'); o.as = X.atkCD() < cd0; P.rqHandU = 0; let n = 0; for (let i = 0; i < 400; i++) { P.rqHandU = 0; Q.struck(10); if (P.rqHandU > 0) n++; } o.hand = n; P.rqHandU = 1e9; o.catch = Q.hand({ x: 0, y: 0 });
      wear('evilking'); Q.tick(.016); o.eyes = P.rqEyeN; const src = { type: 'wolf', x: P.x + 10, y: P.y }; let e = 0; for (let i = 0; i < 8; i++)if (Q.evade(src)) e++; o.evade = e;
      wear('dragon'); o.fire = Q.hurt(100, { type: 'salamander' }); o.roar = window.__GRZ.skills().includes('rqroar');
      wear('giant');
      wear('core'); P.mp = 1e6; P.cd = {}; window.__GRZ.cast('rqover'); o.bar = P.rqBar > 0; o.absorb = Q.hurt(10, { type: 'wolf' }); o.sk = window.__GRZ.skills().filter((k) => /^rq/.test(k));
      wear('baal'); P.cd = { strike: 30, rqsoul: 0 }; P.hp = 1000; window.__GRZ.cast('rqsoul'); o.soul = [P.cd.strike, P.hp, (P.cd.rqsoul || 0) > 50];
      wear('gourd'); P.hp = 10; P.mp = 10; P.hitT = -99; P.awkCt = -99; Q.tick(1); o.regen = P.hp > 10 && P.mp > 10;
      return o;
    });
    assert.ok(r.as, 'God Hand: faster attacks');
    assert.ok(r.hand > 20 && r.hand < 70, "Greed's Reflex about 10%: " + r.hand); assert.equal(r.catch, true, 'the golden hand catches a shot');
    assert.equal(r.eyes, 5); assert.equal(r.evade, 5, 'five dodges ready');
    assert.ok(r.bar); assert.equal(r.absorb, 0, 'the barrier takes the blow'); assert.deepEqual(r.sk, ['rqover'], 'only the Core\'s skill');
    assert.equal(r.soul[0], 0, 'every other cooldown reset'); assert.equal(r.soul[1], 850, '15% of your health'); assert.ok(r.soul[2]);
    assert.ok(r.regen, 'Five Elements Harmony out of combat');
    assert.equal(r.fire, 85, 'the Dragon: fire resisted'); assert.ok(r.roar, 'Draconic Roar on the bar');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the review: a record and its relic agree, spent dodges stay spent, the whisper waits for an empty screen, the cycle from any stone', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(HELP);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, P = G.P, Q = window.__GRQ, B = window.__rq, o = {};
      // a record of yours and no relic in the bag (a save behind its record): the relic comes back
      Q.give('core'); const it = Q.item(); S.items.splice(S.items.indexOf(it), 1); delete S.eq.rl; o.gone = !!Q.item();
      Q.mend(); o.back = (Q.item() || {}).id;
      // spent dodges stay spent when it is taken off and on again
      return o;
    });
    assert.equal(r.gone, false); assert.equal(r.back, 'rl_core', 'its record gives it back');
    const r2 = await g.eval(async () => {
      const G = window.__G, S = G.S, P = G.P, Q = window.__GRQ, B = window.__rq, X = G.eqx, o = {};
      // let the core go, then the evil king
      if (Q.item()) { Q.release(); B.pick(/Let it go/); }
      Q.S.rel = {}; Q.give('evilking'); const it = Q.item(); Q.tick(.016); const src = { type: 'wolf', x: P.x + 10, y: P.y };
      for (let i = 0; i < 5; i++)Q.evade(src); o.spent = P.rqEyeN;
      delete S.eq.rl; Q.tick(.016); X.equip(it); Q.tick(.016); o.again = P.rqEyeN;
      // the whisper: not over an open dialog
      S.rqw = 0; S.lv = 120; G.talkNPC('smith'); const who0 = G.DL && G.DL.who; Q.tick(1); await B.wait(2800); o.rumorOver = !S.rqw && !!G.DL && G.DL.who === who0; o.dbg = [S.rqw, who0, G.DL && G.DL.who, G.mode, G.DL && G.DL.lines.join(' / ').slice(0, 200)];
      for (let i = 0; i < 40 && G.DL; i++) { if (G.DL.optOn) { G.pickOpt(G.DL.opts.length - 1); break; } G.advance(); }
      // the five stones may begin with any element, in the cycle
      S.rqs = S.rqs || {}; S.rqx = S.rqx || {}; S.rqs.gourd = 2; S.rqx.gourd = {}; const touch = (id) => { B.use(id); B.pick(/Lay your hand/); };
      for (const id of ['go3a', 'go3d', 'go3b', 'go3c', 'go3e'])touch(id); await B.wait(); o.cycle = S.rqs.gourd;
      return o;
    });
    assert.equal(r2.spent, 0); assert.equal(r2.again, 0, 'no refill by taking it off');
    assert.ok(r2.rumorOver, 'the whisper waits: ' + JSON.stringify(r2.dbg));
    assert.equal(r2.cycle, 3, 'earth, metal, water, wood, fire is the cycle too');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
