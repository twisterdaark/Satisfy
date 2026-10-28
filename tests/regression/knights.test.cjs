'use strict';
// Knights (owner 2026-10-27, from the novel; card "both": reputation up to viscount, the king names earls and dukes). A noble
// offers a friend knighthood and the friend accepts; Summon Knights brings a knight who accepts to the lord; the lord pays
// 500 gold a month a knight. The messages ride whispers between friends; here they are fed in and caught directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('knights: titles, appointing, summoning, salary', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, P = G.P, K = window.__GKN, out = {}, sent = [];
      K.T.send = (u, s) => sent.push([u, s]);
      const line = (from, text, handle = 'X') => K.line({ type: 'line', ch: 'w', from, handle, text, self: false });
      const stamp = () => Math.round(Date.now()).toString(36);
      out.none = [K.rank(), K.cap()];
      S.tl.viscount = 1; out.visc = [K.rank(), K.cap()];
      // the lord's side: offer a friend, the friend accepts
      K.fr('u1', 'Faker'); K.offer('u1');
      out.offer = sent.length && sent[0][0] === 'u1' && /^⚜K\? [0-9a-z]+ viscount$/.test(sent[0][1]);
      line('u1', '⚜K✓ ' + stamp(), 'Faker');
      out.k = S.kn.k.map(x => x.n); out.pay = S.kn.pay > 0;
      line('u9', '⚜K✓ ' + stamp(), 'Nobody'); out.k2 = S.kn.k.length;   // nobody asked u9
      // the knight's side: a duke offers, accept
      sent.length = 0; line('L1', '⚜K? ' + stamp() + ' dukeK', 'Huroi');
      out.box = K.R && K.R.kind; K.ans(true);
      out.lord = S.kn.lord && S.kn.lord.n; out.ans = sent.map(x => x[1].split(' ')[0]);
      line('L2', '⚜K? ' + stamp() + ' dukeK', 'Other'); out.second = [!!K.R, sent[sent.length - 1][1].split(' ')[0]];   // one lord at a time
      // summoned by the lord: accept and stand beside him; stale and strangers' calls do nothing
      const x0 = P.x, y0 = P.y, tx = Math.round(P.x + 64), ty = Math.round(P.y);
      line('L1', '⚜S? ' + Math.round(Date.now() - 60000).toString(36) + ' ' + tx + ',' + ty, 'Huroi'); out.stale = !!K.R;
      line('L9', '⚜S? ' + stamp() + ' ' + tx + ',' + ty, 'Stranger'); out.stranger = !!K.R;
      line('L1', '⚜S? ' + stamp() + ' ' + tx + ',' + ty, 'Huroi'); out.sbox = K.R && K.R.kind;
      P.hitT = -99; sent.length = 0; K.ans(true);
      out.moved = Math.hypot(P.x - tx, P.y - ty) < 40 && Math.hypot(P.x - x0, P.y - y0) > 20; out.sans = sent.map(x => x[1].split(' ')[0]);
      // the king names an earl: only the castle guild's master counts
      K.T.king = 'K1';
      line('K2', '⚜T? ' + stamp() + ' earlK', 'Fake'); await new Promise(r => setTimeout(r, 50)); out.fake = !!K.R;
      line('K1', '⚜T? ' + stamp() + ' dukeK', 'Ren'); await new Promise(r => setTimeout(r, 50)); out.noDuke = !!K.R;   // a viscount can't skip earl
      line('K1', '⚜T? ' + stamp() + ' earlK', 'Ren'); await new Promise(r => setTimeout(r, 50)); out.tbox = K.R && K.R.kind;
      K.ans(true); out.earl = !!S.tl.earlK; out.rank = [K.rank(), K.cap()];
      // Summon Knights from the lord's side, then its cooldown
      sent.length = 0; out.call = K.summon(); out.called = sent.map(x => x[0] + ' ' + x[1].split(' ')[0]); out.again = K.summon();
      // salary: a month passes for both sides
      const g0 = S.gold = 5000, M = K.N.MON; S.kn.pay -= M + 1000; S.kn.rpay -= M + 1000; K.pay(); out.gold = S.gold - g0;
      for (const b of [undefined, 'add', 'rel', 'king']) K.board(b);
      out.dlg = document.getElementById('dialog').hidden === false;
      // releasing
      K.drop('u1'); out.rel = [S.kn.k.length, S.kn.pay];
      return out;
    });
    assert.deepEqual(r.none, [null, 0], 'no title, no knights');
    assert.deepEqual(r.visc, ['viscount', 3], 'a viscount appoints three (canon)');
    assert.ok(r.offer, 'the offer goes to the friend as a whisper');
    assert.deepEqual(r.k, ['Faker']); assert.ok(r.pay, 'the salary clock starts'); assert.equal(r.k2, 1, 'an answer nobody asked for is ignored');
    assert.equal(r.box, 'K'); assert.equal(r.lord, 'Huroi'); assert.deepEqual(r.ans, ['⚜K✓']);
    assert.deepEqual(r.second, [false, '⚜K✗'], 'a knight serves one lord');
    assert.equal(r.stale, false, 'an old whisper replayed after a reload does nothing'); assert.equal(r.stranger, false, 'only your lord summons you');
    assert.equal(r.sbox, 'S'); assert.ok(r.moved, 'the knight stands beside the lord'); assert.deepEqual(r.sans, ['⚜S✓']);
    assert.equal(r.fake, false, 'a title from someone who is not the king is ignored'); assert.equal(r.noDuke, false, 'duke needs earl first');
    assert.equal(r.tbox, 'T'); assert.ok(r.earl); assert.deepEqual(r.rank, ['earlK', 5]);
    assert.equal(r.call, true); assert.deepEqual(r.called, ['u1 ⚜S?']); assert.equal(r.again, false, 'Summon Knights has a cooldown');
    assert.equal(r.gold, -500 + 500, 'the lord pays 500 for his knight and gets 500 from his own lord');
    assert.deepEqual(r.rel, [0, 0]); assert.ok(r.dlg, 'the knights board opens');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
