'use strict';
// The Sword Grave (v2.95; owner 2026-10-25: "add any place or region of the novel that has an effect"): the plain of swords
// (ch 931), twelve that matter, each turned left or right in its order, a wrong turn setting every sword back; the hill it
// becomes and the grave it opens; the glacier that tolerates no living thing, with Braham's body and Pagma's late works
// (ch 937, 940); Skunk of Skunk's Expedition Group and his hints.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('the puzzle: in order, the right way, or every sword springs back; out of order nothing; solved once, the grave opens for you', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, W = window.__GSG, out = {}, closeD = () => { for (let i = 0; i < 8 && G.mode === 'dialog'; i++) G.advance(); };
      out.n = W.N; out.zone = G.zoneAt(538 * 16, -16 * 16); out.sealed = W.gate().hide;
      // out of order: nothing moves
      W.go(3, W.S[2].d); closeD(); out.skip = W.p();
      W.go(1, W.S[0].d); closeD(); W.go(2, W.S[1].d); closeD(); out.two = W.p();
      // a wrong turn: every sword back
      W.go(3, 1 - W.S[2].d); closeD(); out.wrong = W.p();
      // all of them in order
      for (let i = 1; i <= W.N; i++) { W.go(i, W.S[i - 1].d); closeD(); }
      out.done = [W.p(), W.done()]; W.tick(.016); out.open = !W.gate().hide;
      const fd = !!(S.books || {}).fd_swopen || !!(S.books || {}).fd_sgopen; out.fd = fd;
      // after: a turn changes nothing
      W.go(1, 1 - W.S[0].d); closeD(); out.after = [W.p(), W.done()];
      return out;
    });
    assert.equal(r.n, 12); assert.equal(r.zone, 'zSwordG'); assert.equal(r.sealed, 1, 'sealed before');
    assert.equal(r.skip, 0, 'out of order: nothing'); assert.equal(r.two, 2); assert.equal(r.wrong, 0, 'a wrong turn: every sword back');
    assert.deepEqual(r.done, [12, true]); assert.equal(r.open, true, 'the grave opens'); assert.equal(r.fd, true, 'its first discovery, once');
    assert.deepEqual(r.after, [12, true], 'solved stays solved');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the glacier: sealed until solved, its cold, the coffin: Pagma\'s Late Work once; Skunk and his hints', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, W = window.__GSG, out = {};
      S.lv = 320; G.P.inv = 0; S.hid.indom = 0;
      // the gate: closed until the swords open it
      const gt = W.gate(); G.P.x = gt.x; G.P.y = gt.y; const x0 = G.P.x; W.use(); out.blocked = G.P.x === x0;
      // the cold inside: 1.2% of health a second
      // unsolved and inside anyway: back to the surface
      G.P.x = gt.to.x; G.P.y = gt.to.y; W.tick(.1); out.out = G.P.y < 0;
      S.books = S.books || {}; S.books.swgd = Date.now();
      G.P.x = gt.to.x; G.P.y = gt.to.y; G.P.hp = 1000000; const mh = G.maxHP(); const h0 = G.P.hp; for (let i = 0; i < 5; i++) { G.P.inv = 0; W.tick(1); } out.cold = h0 - G.P.hp; out.mh = mh;
      G.P.inv = 3; const h1 = G.P.hp; W.tick(1); out.invHold = h1 - G.P.hp;
      delete S.books.swgd;
      // the coffin: nothing for whom the swords did not open it (a recall to someone inside); then the sword once
      const nU = S.items.length; W.coffin(); for (let i = 0; i < 8 && G.mode === 'dialog'; i++) G.advance(); out.unsolved = S.items.length - nU;
      S.books.swgd = Date.now();
      const n0 = S.items.length; W.coffin(); for (let i = 0; i < 8 && G.mode === 'dialog'; i++) G.advance(); W.coffin(); for (let i = 0; i < 8 && G.mode === 'dialog'; i++) G.advance();
      out.got = S.items.filter((i) => i.id === 'pgwork').length; out.n = S.items.length - n0;
      // Skunk: his order topic says the first three turns
      S.met.skunk = 1; const N = window.__GNPC; N.topic('skunk', 'order'); G.advance();
      out.hint = document.getElementById('dtext').textContent; out.dirs = W.S.slice(0, 3).map((s) => s.d);
      return out;
    });
    assert.equal(r.blocked, true, 'sealed until solved');
    assert.ok(Math.abs(r.cold - 5 * Math.max(1, Math.round(r.mh * .012))) <= 1, 'the cold: ' + r.cold);
    assert.equal(r.out, true, 'unsolved, out of the glacier'); assert.equal(r.invHold, 0, 'not through invulnerability');
    assert.equal(r.unsolved, 0, 'nothing for whom the grave is shut');
    assert.equal(r.got, 1, 'Pagma\'s Late Work once'); assert.equal(r.n, 1);
    const words = r.dirs.map((d) => (d ? 'right' : 'left'));
    assert.ok(r.hint.includes(words[0]) && r.hint.includes(words[1]) && r.hint.includes(words[2]), 'Skunk\'s three: ' + r.hint);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
