'use strict';
// NPC life (owner 2026-10-25, encyclopedia §93-95): Khan, Earl Ashur and Piaro (with the Patrian farmer) say more than one
// line: lines for the moment that never repeat twice running, a word once after each quest of theirs and once for each rank
// of your name in their town, topics with choices they remember (S.met), more as their affinity grows (the gifts' 30/60/90),
// rumours that lead to places already in the world and a discovery the first time you find them (once, kept in the save),
// the farmer's daily field work (ch 856) and the secret quest it opens (Piaro's field at night). Nothing new is saved: S.met,
// S.aff, S.rep, S.qs, S.books.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const say = (g) => g.eval(() => document.getElementById('dtext').textContent);
const opts = (g) => g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent.replace(/^\d+\.\s*/, '')));
const pick = (g, re) => g.eval((s) => { const r = new RegExp(s); const b = [...document.querySelectorAll('#dopts button')].find((b) => r.test(b.textContent)); if (!b) throw new Error('no option ' + s); b.click(); }, re.source);
const closeD = (g) => g.eval(() => { const G = window.__G; for (let i = 0; i < 12 && G.mode === 'dialog'; i++) { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Leave|Back|Close|Done/.test(x.textContent)); if (b) b.click(); else G.advance(); } });
async function talk(g, who) { await closeD(g); await g.eval((w) => window.__G.talkNPC(w), who); await g.step(40); }

test('Khan: a greeting, lines that never repeat twice running, a word once after his quests and once a rank', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await talk(g, 'khan');
    assert.match(await say(g), /Khan's smithy/, 'the first meeting');
    await g.eval(() => { const S = window.__G.S; for (const q of ['kh1', 'kh2', 'kh3', 'kh4', 'kh5']) S.qs[q] = { st: 2, c: 0 }; S.lv = 40; });
    // after his quests: what he says about them, each once
    const seen = [];
    for (let i = 0; i < 12; i++) { const k = await g.eval(() => window.__GNPC.idle('khan')); seen.push(k); }
    assert.deepEqual(seen.slice(0, 2).sort(), ['nkh_q2', 'nkh_q5'], 'the two quests with a word: ' + seen.slice(0, 3));
    assert.ok(!seen.slice(2).some((k) => /^nkh_q/.test(k)), 'once each');
    for (let i = 3; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], 'never the same line twice running');
    // Winston knows your name: a greeting once at a new rank
    await g.eval(() => { window.__G.S.rep = { zWin: 160 }; });
    assert.equal(await g.eval(() => window.__GNPC.idle('khan')), 'nkh_r2');
    assert.notEqual(await g.eval(() => window.__GNPC.idle('khan')), 'nkh_r2');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a word kept for once is only spent when it is said: talking to Khan while his next quest is on shows that quest, and the word waits', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const S = window.__G.S; S.met.khan = 1; S.lv = 40; S.qs.kh1 = { st: 2, c: 0 }; S.qs.kh2 = { st: 2, c: 0 }; S.qs.kh3 = { st: 1, c: 0 }; });
    await talk(g, 'khan');
    assert.equal(await g.eval(() => window.__GNPC.m('khan', 'q_kh2')), undefined, 'not spent while kh3 is what he talks about');
    await closeD(g);
    await g.eval(() => { const S = window.__G.S; for (const q of ['kh3', 'kh4', 'kh5', 'kh6']) S.qs[q] = { st: 2, c: 0 }; });
    assert.equal(await g.eval(() => window.__GNPC.idle('khan')), 'nkh_q2', 'and then said');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('topics: choices remembered, their affinity once, the trusted ones locked until 30/60/90; gifts cannot be spammed', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    // his quests done, so he talks instead of offering one
    await g.eval(() => { const G = window.__G, S = G.S; S.met.khan = 1; S.aff = { khan: 20 }; for (const q in G.QD) if (G.QD[q].by === 'khan') S.qs[q] = { st: 2, c: 0 }; });
    await talk(g, 'khan');
    await pick(g, /Talk/); await g.step(5);
    const o = await opts(g);
    assert.ok(o.some((x) => /His work/.test(x)) && o.some((x) => /Your travels/.test(x)));
    assert.ok(o.filter((x) => /don't trust you enough/.test(x)).length === 3, 'the anvil, the mine and his dream locked: ' + o);
    await pick(g, /His work/); await g.step(5); await g.eval(() => window.__G.advance()); await g.step(3);
    await pick(g, /how you choose your iron/); await g.step(5);
    assert.match(await say(g), /colour where it breaks/);
    let a = await g.eval(() => ({ aff: window.__G.S.aff.khan, mem: window.__G.S.met['khan#work'] }));
    assert.deepEqual(a, { aff: 22, mem: 1 });
    // the same choice again: no more affinity; the memory is in his lines
    await g.eval(() => { const N = window.__GNPC, t = N.NLD.khan.topics.find((x) => x.id === 'work'); N.topic('khan', 'work'); });
    await g.step(3); await g.eval(() => window.__G.advance()); await g.step(3); await pick(g, /how you choose your iron/); await g.step(3);
    a = await g.eval(() => ({ aff: window.__G.S.aff.khan, pool: window.__GNPC.pool('khan') }));
    assert.equal(a.aff, 22, 'counted once');
    assert.ok(a.pool.includes('nkh_mw1'), 'he remembers what you said');
    // trust 30: the anvil opens
    await closeD(g); await g.eval(() => { window.__G.S.aff.khan = 30; }); await talk(g, 'khan'); await pick(g, /Talk/); await g.step(5);
    assert.ok((await opts(g)).some((x) => /The old anvil/.test(x)));
    assert.equal((await opts(g)).filter((x) => /don't trust you enough/.test(x)).length, 2);
    // gifts: once every five minutes of play (the existing rule), so ten in a row are one
    await closeD(g);
    const gift = await g.eval(() => { const G = window.__G, S = G.S; S.mats.ore = 10; const a0 = S.aff.khan; for (let i = 0; i < 10; i++) { if (!((S.giftT || {}).khan > S.playT)) G.eqx.giveGift('khan', 'ore'); } return S.aff.khan - a0; });
    assert.equal(gift, 2, 'one gift (ore, which he likes: 2)');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a rumour, then the place: a discovery the first time only, kept through a reload', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const L = await g.eval(() => window.__GU.lmList().find((l) => l.k === 'lmMine'));
    // reading the mine's walls before Khan's word: nothing more than before
    const before = await g.eval((L) => { const G = window.__G, S = G.S; S.lv = 120; S.xp = 0; window.__GNPC.fdLm('lmMine'); return { xp: S.xp, fd: !!(S.books || {}).fd_kvein }; }, L);
    assert.deepEqual(before, { xp: 0, fd: false });
    // trust 60: Khan tells of his grandfather's vein
    await g.eval(() => { const S = window.__G.S; S.met.khan = 1; S.aff = { khan: 60 }; window.__GNPC.topic('khan', 'vein'); });
    await g.step(5); await closeD(g);
    const r = await g.eval(() => { const G = window.__G, S = G.S, x0 = S.xp, o0 = S.mats.ore || 0, i0 = S.hid.insi | 0; window.__GNPC.fdLm('lmMine'); const one = { xp: S.xp - x0, ore: (S.mats.ore || 0) - o0, insi: (S.hid.insi | 0) - i0, need: G.xpNeed() }; const x1 = S.xp; window.__GNPC.fdLm('lmMine'); one.again = S.xp - x1; return one; });
    assert.equal(r.xp, Math.round(r.need * .004), '0.4% of the level');
    assert.equal(r.ore, 6); assert.equal(r.insi, 1);
    assert.equal(r.again, 0, 'once');
    await g.eval(() => { window.__G.save(true); window.__G.act('quit'); }); await g.waitMode('title'); await g.reload(); await H.continueGame(g);
    const after = await g.eval(() => { const S = window.__G.S, x0 = S.xp; window.__GNPC.fdLm('lmMine'); return { kept: !!S.books.fd_kvein, xp: S.xp - x0 }; });
    assert.deepEqual(after, { kept: true, xp: 0 }, 'not again after a reload');
    // and Khan remembers: the topic's answer is the one for after
    await g.eval(() => window.__GNPC.topic('khan', 'vein')); await g.step(5);
    assert.match(await say(g), /It still sings/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the farmers (ch 856): the daily field work, the farmer\'s word at 90, the burrow, Piaro\'s answer (a refusal can be mended), the night quest', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 50; S.met.farmerP = 1; S.met.piaro = 1; S.aff = { farmerP: 87, piaro: 40 }; G.P.inv = 1e9; });
    // the field work: five burrowers in his rows, then a rainbow potato and his trust
    let o = await g.eval(() => window.__GNPC.fwOpts().map((x) => x.l));
    assert.match(o[0], /field work \(daily\)/);
    await g.eval(() => window.__GNPC.fwOpts()[0].f()); await closeD(g);
    const kills = await g.eval(() => { const G = window.__G, U = window.__GU, F = window.__GNPC.FWF; let n = 0; for (let i = 0; i < 5; i++) { const m = G.spawnMon('fburrow', F.x * 16 + 8, F.y * 16 + 8); m.tmp = 0; m.hp = 1; U.killMon(m); m.rt = 1e9; n++; } return window.__GNPC.fw().n; });
    assert.equal(kills, 5);
    const r = await g.eval(() => { const G = window.__G, S = G.S, p0 = S.mats.rpotato || 0; window.__GNPC.rnd(() => 0.1); window.__GNPC.fwOpts()[0].f(); window.__GNPC.rnd(null); return { p: (S.mats.rpotato || 0) - p0, aff: S.aff.farmerP, hint: window.__GNPC.m('farmerP', 'hint'), again: window.__GNPC.fwOpts()[0].l }; });
    assert.equal(r.p, 1); assert.equal(r.aff, 90);
    assert.equal(r.hint, 1, 'Devoted, a day\'s work brought his word about Piaro\'s field');
    assert.match(r.again, /done/, 'once a day');
    await closeD(g);
    // the burrow is there now; inspecting it is the trace (and a discovery)
    const h = await g.eval(() => { const G = window.__G, S = G.S, o = window.__GNPC.hole(), x0 = S.xp; window.__GNPC.act(o); return { trace: window.__GNPC.m('piaro', 'trace'), fd: !!S.books.fd_burrow, xp: S.xp - x0, need: G.xpNeed() }; });
    assert.equal(h.trace, 1); assert.equal(h.fd, true); assert.equal(h.xp, Math.round(h.need * .01));
    await closeD(g);
    // Piaro: refuse, then come back and accept
    await g.eval(() => window.__GNPC.topic('piaro', 'burrow')); await g.step(5); await g.eval(() => window.__G.advance()); await g.step(3);
    await pick(g, /not my business/); await g.step(5); await closeD(g);
    assert.equal(await g.eval(() => window.__GNPC.m('piaro', 'burrow')), 2);
    await g.eval(() => window.__GNPC.topic('piaro', 'burrow')); await g.step(5);
    assert.match(await say(g), /Changed your mind/);
    await pick(g, /guard the field/); await g.step(10); await g.eval(() => window.__G.advance()); await g.step(10);
    await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Accept/.test(x.textContent)); if (b) b.click(); }); await g.step(5); await closeD(g);
    assert.equal(await g.eval(() => window.__G.S.qs.fq1 && window.__G.S.qs.fq1.st), 1, 'the secret quest is yours');
    // by day nothing; at night by the field the queen comes up; dawn first: she goes back under (try again)
    await g.eval(() => { const P = window.__GNPC.PIF, G = window.__G; window.__GVP.force(12); G.P.x = P.x * 16 + 8; G.P.y = (P.y + 5) * 16; window.__GNPC.fqTick(.1); });
    assert.equal(await g.eval(() => window.__GNPC.FQM.length), 0);
    await g.eval(() => { window.__GVP.force(23); window.__GNPC.fqTick(.1); });
    assert.equal(await g.eval(() => window.__GNPC.FQM.filter((m) => m.type === 'fbqueen').length), 1);
    assert.ok(await g.eval(() => window.__GNPC.FQM.every((m) => m.ek && m.fq && window.__G.mons().includes(m))), 'shared like an event\'s, a follower keeps its own');
    await g.eval(() => { window.__GVP.force(9); window.__GNPC.fqTick(.1); });
    assert.deepEqual(await g.eval(() => [window.__GNPC.FQM.length, window.__GNPC.m('piaro', 'fqfail')]), [0, 1]);
    assert.equal(await g.eval(() => window.__G.mons().some((m) => m.fq)), false, 'gone from the world, not left dead in it');
    assert.ok(await g.eval(() => window.__GNPC.pool('piaro').includes('npi_c5')), 'Piaro says she got away');
    await g.eval(() => { window.__GVP.force(23); window.__GNPC.fqTick(.1); const q = window.__GNPC.FQM.find((m) => m.type === 'fbqueen'); q.hp = 1; window.__GU.killMon(q); });
    const done = await g.eval(() => { const G = window.__G, S = G.S, p0 = S.mats.rpotato || 0; G.completeQ('fq1'); return { st: S.qs.fq1 && S.qs.fq1.st, tl: !!S.tl.ffield, p: (S.mats.rpotato || 0) - p0, word: window.__GNPC.idle('piaro') }; });
    assert.equal(done.st, 2); assert.equal(done.tl, true); assert.equal(done.p, 3);
    assert.equal(done.word, 'npi_q1', 'and he says so, once');
    await g.eval(() => window.__GVP.force(null));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the new monsters live outside the towns: none spawned inside one', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, O = window.__GOG, n = {}, bad = []; for (const m of G.mons()) if (['fburrow', 'bscout', 'bswarm', 'msnap'].includes(m.type)) { n[m.type] = (n[m.type] || 0) + 1; if (O.town(m.x, m.y)) bad.push(m.type + '@' + (m.x / 16 | 0) + ',' + (m.y / 16 | 0)); } return { n, bad }; });
    assert.deepEqual(r.n, { fburrow: 10, bscout: 5, bswarm: 6, msnap: 8 });
    assert.deepEqual(r.bad, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the new monsters: a burrower cannot be hit underground, the swarm loses a bat a blow, the shell turns back a blow from the front', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, O = window.__GOG, S = G.S; S.lv = 110; G.P.inv = 1e9;
      const out = {}, at = (k, dx) => { const m = G.spawnMon(k, G.P.x + dx, G.P.y); m.tmp = 1; m.hp = m.max; return m; };
      // a burrower, idle and far: underground; its blow is turned back
      const b = at('fburrow', 600); out.bur = O.bur(b); const h0 = b.hp; U.hitMon(b, 1, {}); out.burHit = h0 - b.hp; b.dead = true;
      // close by: it comes up (for some spawn spots right now), and then a blow lands
      const c = at('fburrow', 20); let up = -1; for (let i = 0; i < 60 && up < 0; i++) { c.sx = i * 37; if (O.bur(c) === 'up') up = i; }
      out.up = up >= 0; const c0 = c.hp; U.hitMon(c, 1, {}); out.upHit = c0 - c.hp;
      // the player in a town: it stays under and does not come (the burrowers never follow anyone into a town)
      const x0 = c.x, y0 = c.y; c.eng = 4; window.__GOG.OGB.fburrow(c, G.isk.MT.fburrow, G.P.x - c.x, G.P.y - c.y, 20, 3, .1, true); out.townEng = c.eng; out.townMoved = Math.hypot(c.x - x0, c.y - y0); c.dead = true;
      // a companion's blow on a burrower under the ground is turned back too
      const u = at('fburrow', 600); const u0 = u.hp; window.__GOG.comp(u); out.compHit = u0 - u.hp; u.dead = true;
      // the swarm: one blow is one bat at most
      const w = at('bswarm', 20); w.eng = 4; let hits = 0; for (let i = 0; i < 40 && w.hp > w.max * .5; i++) { const before = w.hp; U.hitMon(w, 50, {}); if (w.hp < before) { hits++; out.most = Math.max(out.most || 0, before - w.hp); } } out.bat = Math.ceil(w.max / 6); out.batHits = hits; w.dead = true;
      // the snapper: from the front a tenth
      const s = at('msnap', 20); s.ogF = -1; let a = s.hp; U.hitMon(s, 1, {}); const front = a - s.hp; s.ogF = 1; a = s.hp; U.hitMon(s, 1, {}); const back = a - s.hp; out.shell = front / back; s.dead = true;
      return out; });
    assert.equal(r.bur, 'under'); assert.equal(r.burHit, 0);
    assert.ok(r.up && r.upHit > 0, 'up, it can be hit');
    assert.equal(r.townEng, 0); assert.equal(r.townMoved, 0, 'not into a town');
    assert.equal(r.compHit, 0, 'a companion cannot hit it under the ground');
    assert.ok(r.most <= r.bat, 'never more than a bat a blow: ' + r.most + ' / ' + r.bat);
    assert.ok(r.batHits >= 3, 'it takes several blows: ' + r.batHits);
    assert.ok(r.shell < .2, 'the shell from the front: ' + r.shell);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
