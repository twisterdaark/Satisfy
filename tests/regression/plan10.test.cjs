'use strict';
// Plan batch 10 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U150 the goblin warcamp, one copy per party;
// U300 a room of your own at the inns.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };
async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const closeDialogs = async (g) => {
  for (let i = 0; i < 10 && await g.eval(() => window.__G.mode) === 'dialog'; i++) {
    if (await g.eval(() => { const D = window.__G.DL; return !!(D && D.opts && D.opts.length); })) await g.page.keyboard.press('Escape'); else await g.eval(() => window.__G.advance());
    await g.step(2);
  }
};

test('the goblin warcamp: only your party is there with you', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, LOOK_A);
    await H.newGame(b, LOOK_B);
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    const ub = await b.eval(() => Satisfy.local.net().uid);
    const out = await a.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    const camp = await a.eval(() => { const D = window.__GPB10.dun('zDun1'); return { x: (D.x0 + 8) * 16 + 8, y: (D.y0 + 6) * 16 + 8 }; });
    const remote = (u) => { const L = Satisfy.local.net().remotes; return Array.isArray(L) ? L.find((x) => x.uid === u) : null; };
    const look = () => a.eval((u) => { const R = (u0 => { const L = Satisfy.local.net().remotes; return Array.isArray(L) ? L.find((x) => x.uid === u0) : null; })(u); return R ? window.__GPB10.netSees(R, null) : 'none'; }, ub);
    const why = () => a.eval((u) => { const R = (u0 => { const L = Satisfy.local.net().remotes; return Array.isArray(L) ? L.find((x) => x.uid === u0) : null; })(u); return R ? window.__GPB10.pvpWhy(R) : 'none'; }, ub);
    // the camp's goblins are put to sleep for the test, so nobody dies in there while it looks
    const goTo = async (c) => { for (const g of [a, b]) await g.eval((c) => { const P = window.__G.P, X = window.__GPB10; P.x = c.x; P.y = c.y; for (const m of window.__G.mons()) if (X.inCamp(m.x, m.y)) { m.dead = true; m.rt = 1e9; } }, c); await b.eval(() => { window.__G.P.x += 20; }); await settle(a, b); await settle(a, b); };
    assert.equal(await look(), true, 'outside, they see each other');
    // the two of them, not in a party: in the warcamp each is in a copy of his own
    await goTo(camp);
    assert.equal(await a.eval((c) => window.__GPB10.inCamp(c.x, c.y), camp), true);
    assert.equal(await look(), false, 'in the warcamp, a stranger is in a copy of his own');
    assert.equal(await why(), 'room', 'and open PvP doesn\'t reach across');
    const drop = await a.eval((u) => { const X = window.__GPB10, n0 = X.gdropN(), P = window.__G.P;
      X.dropIn('d_' + u + '_x1', { o: u, x: P.x + 10, y: P.y, k: 'hpot', n: 1, r: 0, t: Date.now() });
      return X.gdropN() - n0; }, ub);
    assert.equal(drop, 0, 'a stranger\'s drop in his copy isn\'t in ours');
    // in a party, they're together there
    await goTo(out);
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    await goTo(camp);
    assert.equal(await look(), true, 'his party shares the warcamp');
    assert.equal(await why(), 'mate');
    // a drop in your own room is never put on the network
    const put = await a.eval(() => { const X = window.__GPB10, H = X.HOME, P = window.__G.P; return [X.dropNet((H.rx + 4) * 16, (H.ry + 4) * 16), X.dropNet(P.x, P.y)]; });
    assert.deepEqual(put, [false, true]);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('a room of your own: rent it at an inn, furnish it, sleep in your bed, and its door brings you back', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB10, o = {};
      S.gold = 20000;
      o.offer = X.homeOpt('innP').map((x) => x.l); o.east = X.homeOpt('innKa').length;
      const opt = X.homeOpt('innP')[0]; opt.f(); opt.f(); o.rented = !!S.home; o.paid = 20000 - S.gold;   // a second click on the offer doesn't pay again
      return o;
    });
    assert.deepEqual(r.offer, ['Rent a room of your own (5,000 gold, once)']);
    assert.equal(r.east, 0, 'not from an inn across the sea');
    assert.equal(r.rented, true); assert.equal(r.paid, 5000, 'paid once');
    await until(g, () => { const P = window.__G.P, H = window.__GPB10.HOME; return P.x > H.rx * 16 && P.x < (H.rx + 12) * 16 && P.y > H.ry * 16 && P.y < (H.ry + 8) * 16; });
    await g.step(30);
    const w = await g.eval(() => { const X = window.__GPB10, P = window.__G.P, H = X.HOME;
      return { room: X.roomId(P.x, P.y), zone: X.zoneAt(P.x, P.y) === H.z, bh: X.inBh(P.x, P.y) || !!X.BHR, solo: X.solo(P.x, P.y), dun: !!X.dunAt(P.x, P.y),
        clear: [0, 7].every((dy) => [0, 11].every((dx) => !X.inBh((H.rx + dx) * 16 + 8, (H.ry + dy) * 16 + 8))) }; });
    assert.deepEqual(w, { room: 'rHome', zone: true, bh: false, solo: true, dun: false, clear: true }, 'in your room, and nowhere else');
    const s = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB10, P = G.P, H = X.HOME, o = {};
      o.again = X.homeOpt('innP').map((x) => x.l);
      const g0 = S.gold; X.homePlace(0, 'table'); X.homePlace(5, 'bed'); o.cost = g0 - S.gold;
      const [tx, ty] = X.HALLS[0]; o.block = X.solidT(H.rx + tx, H.ry + ty);
      X.homePlace(5, null); o.cleared = !S.home.slots.s5; X.homePlace(5, 'bed');
      const sleep = () => { X.homeAct(); const sl = G.DL.opts.find((x) => /^Sleep/.test(x.l)); sl.f(); };
      P.hp = 1; P.mp = 0; P.st = 0; sleep(); o.slept = P.hp > 1; o.st = P.st === X.maxST();
      P.hp = 1; sleep(); o.tired = P.hp === 1;
      // a reload inside: the door still knows the inn; another character has its own room
      H.dx = 0; X.homeTick(); o.door = H.dx === S.home.dx && H.dx > 0;
      const mine = S.home; S.home = { slots: {}, dx: 77, dy: 88 }; X.homeTick(); o.other = [X.solidT(H.rx + tx, H.ry + ty), H.dx]; S.home = mine; X.homeTick();
      return o;
    });
    assert.deepEqual(s.again, ['Go to your room'], 'rented once');
    assert.equal(s.cost, 1600, 'a table and a bed, 800 each');
    assert.equal(s.block, true, 'furniture blocks the way');
    assert.equal(s.cleared, true);
    assert.equal(s.slept, true, 'a night in your own bed');
    assert.equal(s.st, true, 'stamina to its own top');
    assert.equal(s.tired, true, 'not again right away');
    assert.equal(s.door, true);
    assert.deepEqual(s.other, [false, 77], 'another character: not this one\'s furniture or door');
    await closeDialogs(g);
    // out through the door, back at the inn
    const inn = await g.eval(() => { const S = window.__G.S; return { x: S.home.dx, y: S.home.dy }; });
    await g.eval(() => { const P = window.__G.P, H = window.__GPB10.HOME; P.x = (H.rx + 6) * 16 + 8; P.y = (H.ry + 6) * 16 + 12; });
    await g.page.keyboard.down('ArrowDown');
    await until(g, () => { const P = window.__G.P, S = window.__G.S; return Math.hypot(P.x - S.home.dx, P.y - S.home.dy) < 40; });
    await g.page.keyboard.up('ArrowDown'); await g.step(10);
    const back = await g.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    assert.ok(Math.hypot(back.x - inn.x, back.y - inn.y) < 60, 'back at the inn: ' + JSON.stringify([back, inn]));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
