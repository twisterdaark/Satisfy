'use strict';
// NPC life, the second circle (owner 2026-10-25, encyclopedia §94: "Khan, Irene, Earl Ashur, Piaro, Han Seokbong..."):
// Han Seokbong, lord of Pangea, and Doran, Earl Steim's secret shadow, through the same S.met / S.aff / S.rep as the
// first four; two more first discoveries (Cork Island from the sailors' word at Pangea, Kesan Canyon from Doran's errand);
// Earl Ashur speaks of Irene as Earl Steim's daughter (the game's own Irene quest, ch 117), not his own.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const say = (g) => g.eval(() => document.getElementById('dtext').textContent);
const closeD = (g) => g.eval(() => { const G = window.__G; for (let i = 0; i < 12 && G.mode === 'dialog'; i++) { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Leave|Back|Close|Done/.test(x.textContent)); if (b) b.click(); else G.advance(); } });

test('Han Seokbong: a word once after his quests, then his warning while the king may learn he hid you; Pangea knows your name', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, N = window.__GNPC, E = window.__GEA.s(); S.met.hanS = 1; S.lv = 340;
      E.ar = 'cap'; for (const q of ['ea0', 'ea1', 'ea2']) S.qs[q] = { st: 2, c: 0 };
      const a = [N.idle('hanS'), N.idle('hanS'), N.idle('hanS')];
      // the warning is over once the king has had his delivery (ea4)
      S.qs.ea4 = { st: 2, c: 0 }; S.qs.ea3 = { st: 2, c: 0 };
      const b = []; for (let i = 0; i < 10; i++) b.push(N.idle('hanS'));
      S.rep = { zEaPangea: 160 }; const rk = N.idle('hanS'), rk2 = N.idle('hanS');
      return { a, b, rk, rk2, pool: N.pool('hanS') };
    });
    assert.equal(r.a[0], 'nhs_q0', 'a word once after the gate (ea0)');
    assert.equal(r.a[1], 'hanS_i2', 'then the warning, before any line for the moment');
    assert.notEqual(r.a[2], 'hanS_i2', 'not twice running');
    assert.equal(r.b[0], 'nhs_q4', 'home from the Lava Prison (ea4): his word first: ' + r.b);
    assert.equal(r.b.filter((k) => k === 'nhs_q4').length, 1, 'once');
    assert.ok(r.pool.includes('nhs_q3'), 'the Daoist (ea3) a line for the moment once he is home');
    assert.ok(!r.b.includes('hanS_i2'), 'no warning once the king has had it');
    assert.ok(r.pool.includes('nhs_c3') && !r.pool.includes('nhs_c4'), 'he remembers you brought Arube back alive');
    assert.equal(r.rk, 'nhs_r2'); assert.notEqual(r.rk2, 'nhs_r2');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the sea road: Han Seokbong\'s word on Cork Island, then the island, a discovery once; Pangea\'s guest at 90, once', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const before = await g.eval(() => { const S = window.__G.S; S.lv = 340; S.xp = 0; window.__GNPC.fdLm('lmCork'); return { xp: S.xp, fd: !!(S.books || {}).fd_cork }; });
    assert.deepEqual(before, { xp: 0, fd: false }, 'nothing before his word');
    await g.eval(() => { const S = window.__G.S; S.met.hanS = 1; S.aff = { hanS: 30 }; window.__GNPC.topic('hanS', 'sea'); });
    await g.step(5); assert.match(await say(g), /Cork/); await closeD(g);
    const r = await g.eval(() => { const G = window.__G, S = G.S, x0 = S.xp, f0 = S.mats.fish || 0, i0 = S.hid.insi | 0; window.__GNPC.fdLm('lmCork');
      const one = { xp: S.xp - x0, fish: (S.mats.fish || 0) - f0, insi: (S.hid.insi | 0) - i0, need: G.xpNeed() }; const x1 = S.xp; window.__GNPC.fdLm('lmCork'); one.again = S.xp - x1; return one; });
    assert.equal(r.xp, Math.round(r.need * .005), '0.5% of the level'); assert.equal(r.fish, 8); assert.equal(r.insi, 1); assert.equal(r.again, 0, 'once');
    await g.eval(() => window.__GNPC.topic('hanS', 'sea')); await g.step(5);
    assert.match(await say(g), /Cork is real/, 'and he remembers'); await closeD(g);
    // at 90: Pangea's guest, a title and its name in the town, once
    const gst = await g.eval(() => { const G = window.__G, S = G.S, N = window.__GNPC; S.aff.hanS = 90; const r0 = (S.rep || {}).zEaPangea | 0; N.topic('hanS', 'guest'); const r1 = S.rep.zEaPangea | 0; G.advance(); G.advance(); N.topic('hanS', 'guest'); return { tl: !!S.tl.pguest, rep: r1 - r0, again: (S.rep.zEaPangea | 0) - r1 }; });
    assert.deepEqual(gst, { tl: true, rep: 50, again: 0 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Doran: the lady\'s topic only after she is home, his word once, Kesan Canyon from his errand, a shadow\'s friend at 90', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, N = window.__GNPC; S.met.doranS = 1; S.lv = 200; S.aff = { doranS: 30 };
      const lady0 = N.pool('doranS').includes('ndo_c2');
      S.qs.irn = { st: 2, c: 0 }; const w = N.idle('doranS'), w2 = N.idle('doranS');
      return { lady0, w, w2, home: N.pool('doranS').includes('ndo_c2') };
    });
    assert.equal(r.lady0, false); assert.equal(r.w, 'ndo_q1'); assert.notEqual(r.w2, 'ndo_q1'); assert.equal(r.home, true);
    // the lady's topic: what you chose he remembers
    await g.eval(() => window.__GNPC.topic('doranS', 'lady')); await g.step(5); await g.eval(() => window.__G.advance()); await g.step(3);
    await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((x) => /glad she's safe/.test(x.textContent)); b.click(); }); await g.step(5);
    assert.match(await say(g), /proper shadows/); await closeD(g);
    assert.ok(await g.eval(() => window.__GNPC.pool('doranS').includes('ndo_ml1')));
    // Kesan Canyon: only after his word (trust 60)
    const k = await g.eval(() => { const G = window.__G, S = G.S, N = window.__GNPC; S.xp = 0; N.fdLm('lmKesan'); const pre = !!(S.books || {}).fd_kesan; S.aff.doranS = 60; N.topic('doranS', 'kesan'); G.advance(); G.advance();
      const x0 = S.xp; N.fdLm('lmKesan'); return { pre, got: !!S.books.fd_kesan, xp: S.xp - x0, need: G.xpNeed() }; });
    assert.equal(k.pre, false); assert.equal(k.got, true); assert.equal(k.xp, Math.round(k.need * .005));
    const s = await g.eval(() => { const S = window.__G.S; S.aff.doranS = 90; window.__GNPC.topic('doranS', 'shadow'); return !!S.tl.dshadow; });
    assert.equal(s, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Earl Ashur speaks of Irene as Earl Steim\'s daughter (canon), and both new people have Talk', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const L = window.__G.lines(), en = L.en, ar = L.ar; return { c4: en.nas_c4, i1: en.nas_i1, arc4: ar.nas_c4, src: window.__GNPC.NLD.ashur.src, opts: ['hanS', 'doranS'].map((w) => window.__G.npcs.some((n) => n.id === w)) }; });
    assert.match(r.c4, /Earl Steim's daughter/); assert.match(r.i1, /Earl Steim/); assert.match(r.arc4, /شتايم/);
    assert.ok(!/My daughter/.test(r.c4));
    assert.match(r.src, /Steim/);
    assert.deepEqual(r.opts, [true, true]);
    for (const w of ['hanS', 'doranS']) {
      await closeD(g); await g.eval((w) => { const G = window.__G; G.S.met[w] = 1; G.talkNPC(w); }, w); await g.step(30);
      const o = await g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent));
      assert.ok(o.some((x) => /Talk/.test(x)), w + ': ' + o);
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

const optsOf = (g) => g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent));

test('trust you can reach: Doran takes gifts, Earl Ashur\'s follows Patrian\'s honour; the lady\'s topic only after the rescue', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    // before the rescue: no topic about the lady at all
    await g.eval(() => { const S = window.__G.S; S.met.doranS = 1; S.aff = { doranS: 13 }; window.__GNPC.topics('doranS'); }); await g.step(5);
    let o = await optsOf(g);
    assert.ok(!o.some((x) => /lady Irene/.test(x)), 'no lady before the rescue: ' + o);
    assert.equal(o.filter((x) => /don't trust you enough/.test(x)).length, 2, 'Kesan and the shadow locked at 13');
    await closeD(g);
    // gifts (the usual five minutes apart): a healing potion, which he likes, is 8 a gift
    const a = await g.eval(() => { const G = window.__G, S = G.S, a0 = S.aff.doranS; S.hpot = 20; for (let i = 0; i < 6; i++) { S.giftT = {}; G.eqx.giveGift('doranS', 'hpot'); } return S.aff.doranS - a0; });
    assert.equal(a, 48);
    await g.eval(() => { window.__G.S.qs.irn = { st: 2, c: 0 }; window.__GNPC.topics('doranS'); }); await g.step(5);
    o = await optsOf(g);
    assert.ok(o.some((x) => /lady Irene/.test(x)) && o.some((x) => /Kesan Canyon/.test(x)), 'at 61, after the rescue: ' + o);
    await closeD(g);
    // Earl Ashur takes no gifts, but Patrian's honour opens him: Honoured (350) opens his 60s
    await g.eval(() => { const S = window.__G.S; S.met.ashur = 1; S.aff.ashur = 36; S.qs.irn = { st: 2, c: 0 }; window.__GNPC.topics('ashur'); }); await g.step(5);
    o = await optsOf(g);
    assert.ok(o.some((x) => /or .* in Patrian/.test(x)), 'his lock says the town can open it: ' + o);
    await closeD(g);
    await g.eval(() => { const S = window.__G.S; S.rep = { zPat: 360 }; window.__GNPC.topics('ashur'); }); await g.step(5);
    o = await optsOf(g);
    assert.ok(o.some((x) => /Irene/.test(x)), 'Irene open by the town\'s honour: ' + o);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the quests come first: Doran still offers the rescue, Han Seokbong still asks about Arube; the son-in-law and a failed rescue are spoken of as they are', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const G = window.__G; G.S.lv = 160; G.S.met.doranS = 1; G.talkNPC('doranS'); }); await g.step(20);
    let o = await optsOf(g);
    assert.ok(o.some((x) => /Accept/.test(x)), 'the rescue is offered: ' + o);
    await closeD(g);
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 330; S.met.hanS = 1; for (const q of ['ea0', 'ea1', 'ea2']) S.qs[q] = { st: 2, c: 0 }; const E = window.__GEA.s(); delete E.ar; G.talkNPC('hanS'); }); await g.step(20);
    o = await optsOf(g);
    assert.ok(o.some((x) => /Talk/.test(x)) && o.length >= 3, 'Talk beside the Arube choice: ' + o);
    await closeD(g);
    const r = await g.eval(() => { const G = window.__G, S = G.S, N = window.__GNPC; S.qs.irn = { st: 3 }; const fail = N.pool('doranS'); S.qs.irn = { st: 2, c: 0 }; S.tl = S.tl || {}; S.tl.sonlaw = 1;
      const lady = N.topics('doranS'), ladyOpts = [...document.querySelectorAll('#dopts button')].map((b) => b.textContent); G.advance && 0; return { fail, ladyOpts }; });
    assert.ok(r.fail.includes('ndo_c5') && !r.fail.includes('ndo_c4'), 'after a failed rescue he does not speak as if she were still down there');
    await g.eval(() => window.__GNPC.topic('doranS', 'ladyS')); await g.step(5);
    assert.match(await say(g), /family to the house/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
