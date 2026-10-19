'use strict';
// SAT-ONLINE-002: two tabs of the same browser (?net=local) see each other in Winston.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };

// BroadcastChannel delivers on real time; the game clock only moves with step().
async function settle(...games) {
  for (let i = 0; i < 6; i++) {
    for (const g of games) await g.step(7);
    await games[0].page.waitForTimeout(30);
  }
}
const net = (g) => g.eval(() => Satisfy.local.net());

async function twoPlayers() {
  const ctx = await H.newContext();
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  await H.newGame(a, LOOK_A);
  await H.newGame(b, LOOK_B);
  await settle(a, b);
  return { ctx, a, b };
}

test('two tabs in Winston see each other, with name and look', async () => {
  const { ctx, a, b } = await twoPlayers();
  try {
    const na = await net(a), nb = await net(b);
    assert.equal(na.count, 1);
    assert.equal(nb.count, 1);
    const seenByA = na.remotes[0];
    assert.equal(seenByA.handle, 'Faker');
    assert.deepEqual(seenByA.look, { hair: 3, hc: 0, skin: 2, top: 1 });
    assert.equal(seenByA.zone, 'zWin');
    assert.equal(seenByA.sid, nb.sid);
    assert.equal(nb.remotes[0].handle, 'Grid');
    assert.equal(na.drawn, 1, 'B is drawn on A\'s screen');
    assert.equal(await a.eval(() => document.getElementById('netB').textContent), 'Local online · players: 2');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('movement shows up on the other screen', async () => {
  const { ctx, a, b } = await twoPlayers();
  try {
    const start = (await net(a)).remotes[0];
    // walk B to the right with the real input path
    await b.page.keyboard.down('KeyD');
    await settle(a, b);
    const mid = (await net(a)).remotes[0];
    await b.page.keyboard.up('KeyD');
    await settle(a, b);
    const end = (await net(a)).remotes[0];
    const bx = await b.eval(() => Math.round(window.__G.P.x));
    assert.ok(mid.x > start.x, `moving right: ${start.x} → ${mid.x}`);
    assert.equal(mid.dir, 2, 'facing right');
    assert.equal(end.x, bx, 'settles on B\'s real position');
    assert.equal(end.anim, 'idle');
  } finally { await ctx.close(); }
});

test('a player inside a house is only drawn for players in the same house', async () => {
  const { ctx, a, b } = await twoPlayers();
  try {
    const room = await b.eval(() => { const R = window.__G.ROOMS[0], P = window.__G.P; P.x = (R.rx + 6) * 16 + 8; P.y = (R.ry + 4) * 16; return R.id; });
    await settle(a, b);
    const na = await net(a);
    assert.equal(na.remotes[0].room, room);
    assert.equal(na.drawn, 0, 'outdoors A does not draw B');
    await a.eval(() => { const R = window.__G.ROOMS[0], P = window.__G.P; P.x = (R.rx + 4) * 16 + 8; P.y = (R.ry + 4) * 16; });
    await settle(a, b);
    assert.equal((await net(a)).drawn, 1, 'inside the same house A draws B');
  } finally { await ctx.close(); }
});

test('closing a tab removes the player; silent tabs expire', async () => {
  const { ctx, a, b } = await twoPlayers();
  try {
    await b.page.close({ runBeforeUnload: true });
    await settle(a);
    let n = (await net(a)).count;
    if (n) { await a.step(6 * 60); n = (await net(a)).count; } // pagehide may not fire in headless: expiry covers it
    assert.equal(n, 0);
    assert.equal(await a.eval(() => document.getElementById('netB').textContent), 'Local online · players: 1');
  } finally { await ctx.close(); }
});

test('each slot keeps its own save; the default save is untouched', async () => {
  const { ctx, a } = await twoPlayers();
  try {
    const st = await a.storage();
    assert.equal(JSON.parse(st['satisfy_proto_v4@a']).S.look.n, 'Grid');
    assert.equal(JSON.parse(st['satisfy_proto_v4@b']).S.look.n, 'Faker');
    assert.equal(st.satisfy_proto_v4, undefined);
  } finally { await ctx.close(); }
});

test('without ?net nothing online runs', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(30);
    assert.equal(await g.eval(() => Satisfy.local.net()), null);
    assert.equal(await g.eval(() => document.getElementById('netB').hidden), true);
  } finally { await g.close(); }
});
