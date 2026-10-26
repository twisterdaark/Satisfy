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
    // the two of them, not in a party: outside they see each other; in the warcamp they don't
    const camp = await a.eval(() => { const D = window.__GPB10.dun('zDun1'); return { x: (D.x0 + 8) * 16 + 8, y: (D.y0 + 6) * 16 + 8 }; });
    const look = () => a.eval((u) => { const L = Satisfy.local.net().remotes; const R = Array.isArray(L) ? L.find((x) => x.uid === u) : null; return R ? window.__GPB10.netSees(R, null) : 'none'; }, ub);
    assert.equal(await look(), true, 'outside, they see each other');
    for (const g of [a, b]) await g.eval((c) => { const P = window.__G.P; P.x = c.x; P.y = c.y; }, camp);
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b); await settle(a, b);
    assert.equal(await a.eval((c) => window.__GPB10.inCamp(c.x, c.y), camp), true);
    assert.equal(await look(), false, 'in the warcamp, a stranger is in a copy of his own');
    // in a party, they're together there
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    await settle(a, b);
    assert.equal(await look(), true, 'his party shares the warcamp');
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
      X.homeOpt('innP')[0].f(); o.rented = !!S.home; o.paid = 20000 - S.gold;
      return o;
    });
    assert.deepEqual(r.offer, ['Rent a room of your own (5,000 gold, once)']);
    assert.equal(r.east, 0, 'not from an inn across the sea');
    assert.equal(r.rented, true); assert.equal(r.paid, 5000);
    await g.step(90);
    const s = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB10, P = G.P, H = X.HOME, o = {};
      o.inside = P.x > H.rx * 16 && P.x < (H.rx + 12) * 16 && P.y > H.ry * 16 && P.y < (H.ry + 8) * 16;
      o.again = X.homeOpt('innP').map((x) => x.l);
      const g0 = S.gold; X.homePlace(0, 'table'); X.homePlace(5, 'bed'); o.cost = g0 - S.gold;
      const [tx, ty] = X.HALLS[0]; o.block = X.solidT(H.rx + tx, H.ry + ty);
      X.homePlace(5, null); o.cleared = !S.home.slots.s5; X.homePlace(5, 'bed');
      P.hp = 1; P.mp = 0; X.homeAct(); const sl = G.DL.opts.find((x) => /^Sleep/.test(x.l)); sl.f(); o.slept = P.hp > 1;
      // a reload inside: the door still knows the inn
      H.dx = 0; X.homeTick(); o.door = H.dx === S.home.dx && H.dx > 0;
      return o;
    });
    assert.equal(s.inside, true, 'in your room');
    assert.deepEqual(s.again, ['Go to your room'], 'rented once');
    assert.equal(s.cost, 1600, 'a table and a bed, 800 each');
    assert.equal(s.block, true, 'furniture blocks the way');
    assert.equal(s.cleared, true);
    assert.equal(s.slept, true, 'a night in your own bed');
    assert.equal(s.door, true);
    await closeDialogs(g);
    // out through the door, back at the inn
    const inn = await g.eval(() => { const S = window.__G.S; return { x: S.home.dx, y: S.home.dy }; });
    await g.eval(() => { const P = window.__G.P, H = window.__GPB10.HOME; P.x = (H.rx + 6) * 16 + 8; P.y = (H.ry + 6) * 16 + 12; });
    await g.page.keyboard.down('ArrowDown'); await g.step(40); await g.page.keyboard.up('ArrowDown'); await g.step(60);
    const back = await g.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    assert.ok(Math.hypot(back.x - inn.x, back.y - inn.y) < 40, 'back at the inn: ' + JSON.stringify([back, inn]));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
