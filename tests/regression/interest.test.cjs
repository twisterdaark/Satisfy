'use strict';
// SAT-ONLINE-014 (doc U009): interest management over the fake Firebase. A client listens only to
// players within NET_INTEREST.radius px of it along the map (a range query on x), plus its party
// members wherever they are. Three tabs: walk one away and back, then split a party across the map.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOKS = [
  { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 },
  { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 },
  { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 },
];
const FAR = 2000; // px: well past the 800 px radius

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(3);
    await games[0].page.waitForTimeout(30);
  }
}
const net = (g) => g.eval(() => Satisfy.local.net());
const sees = (g) => g.eval(() => Satisfy.local.net().remotes.map((r) => r.handle).sort());
const moveBy = (g, dx) => g.eval((d) => { window.__G.P.x += d; }, dx);

test('players far along the map are not downloaded; party members are, wherever they are', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const gs = [];
    for (const s of ['a', 'b', 'c']) gs.push(await H.openGame({ ctx, query: '?net=online&slot=' + s }));
    const [a, b, c] = gs;
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem'], [c, 'Camilia']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    for (let i = 0; i < 3; i++) await H.newGame(gs[i], LOOKS[i]);
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 20; });
    await settle(a, b, c);
    await until(gs, () => Satisfy.local.net().remotes.length === 2);

    // the presence listener is a range query on x around the player, re-centred as they move
    const ia = (await net(a)).interest;
    assert.equal(ia.radius, 800);
    assert.ok(Math.abs(ia.centre - (await a.eval(() => window.__G.P.x))) <= 400, JSON.stringify(ia));
    const qs = await a.eval(() => window.__fakeRTDB.listens.filter((l) => l.path === 'presence/satisfy/main' && l.type === 'added').map((l) => l.q));
    assert.ok(qs.length >= 1 && qs.every((q) => q && q.child === 'x' && q.hi - q.lo <= 1600), JSON.stringify(qs));

    // A and B walk 500 px east together: A's query re-centres, B stays, and the re-listing is no replay
    const before = await a.eval(() => window.__fakeRTDB.listens.filter((l) => l.path === 'presence/satisfy/main' && l.type === 'added').length);
    await moveBy(a, 500); await moveBy(b, 500);
    await settle(a, b, c);
    await until([a], (n) => window.__fakeRTDB.listens.filter((l) => l.path === 'presence/satisfy/main' && l.type === 'added').length > n, 8000, before);
    await settle(a, b, c);
    assert.ok((await sees(a)).includes('Faker'), 'B is still there after the re-centre');
    assert.equal((await net(a)).stats.dropped, 0, 'no replays counted as dropped');
    await moveBy(a, -500); await moveBy(b, -500);
    await settle(a, b, c);
    await until(gs, () => Satisfy.local.net().remotes.length === 2);

    // C walks far east: A and B lose C at once (the query drops it), and C stops listening to them
    await moveBy(c, FAR);
    await settle(a, b, c);
    await until([a, b], () => Satisfy.local.net().remotes.length === 1);
    assert.deepEqual(await sees(a), ['Faker']);
    await until([c], () => Satisfy.local.net().remotes.length === 0);
    assert.equal((await net(c)).stats.dropped, 0, 'leaving range is a leave, not dropped messages');

    // ...and back: everyone sees everyone again
    await moveBy(c, -FAR);
    await settle(a, b, c);
    await until(gs, () => Satisfy.local.net().remotes.length === 2);

    // A and B form a party, then B walks far: A and B still see each other, C (not in it) doesn't see B
    // P invites the nearest player: put B closest (walking may have nudged everyone)
    const [ax, ay] = await a.eval(() => [window.__G.P.x, window.__G.P.y]);
    await b.eval(([x, y]) => { window.__G.P.x = x + 15; window.__G.P.y = y; }, [ax, ay]);
    await c.eval(([x, y]) => { window.__G.P.x = x - 36; window.__G.P.y = y; }, [ax, ay]);
    await settle(a, b, c);
    await a.page.keyboard.press('KeyP');
    await settle(a, b, c);
    await until([b], () => !document.getElementById('partyInv').hidden);
    assert.equal(await c.eval(() => document.getElementById('partyInv').hidden), true, 'the invite went to B, not C');
    await b.page.keyboard.press('KeyY');
    await settle(a, b, c);
    await until([a, b], () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    const uidB = (await net(b)).uid, uidA = (await net(a)).uid;
    await until([a], (u) => Satisfy.local.net().interest.watched.join() === u, 8000, uidB);
    await until([b], (u) => Satisfy.local.net().interest.watched.join() === u, 8000, uidA);

    await moveBy(b, FAR);
    await settle(a, b, c);
    await until([c], () => Satisfy.local.net().remotes.length === 1);
    assert.deepEqual(await sees(c), ['Grid']);
    await until([b], () => Satisfy.local.net().remotes.length === 1);
    assert.deepEqual(await sees(b), ['Grid'], 'B still sees its leader across the map, not C');
    assert.deepEqual(await sees(a), ['Faker', 'Ruby']);
    // B keeps moving there: A still gets the updates
    const bx = await b.eval(() => window.__G.P.x);
    await moveBy(b, 30);
    await settle(a, b, c);
    await until([a], (x) => Satisfy.local.net().remotes.some((r) => r.handle === 'Faker' && r.x >= x + 20), 8000, bx);
    assert.equal(((await net(a)).party.members || []).length, 2, 'the party survives the distance');

    // B leaves the party: A stops watching B, and B is out of range, so A drops it
    await b.eval(() => document.querySelector('#partyW [data-act="pLeave"]').click());
    await settle(a, b, c);
    await until([a], () => Satisfy.local.net().interest.watched.length === 0);
    await until([a], () => Satisfy.local.net().remotes.length === 1);
    assert.deepEqual(await sees(a), ['Ruby']);
    await until([b], () => Satisfy.local.net().remotes.length === 0);

    for (const g of gs) {
      assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
      assert.deepEqual(g.errors, []);
    }
  } finally { await ctx.close(); }
});
