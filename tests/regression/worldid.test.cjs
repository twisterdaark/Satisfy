'use strict';
// SAT-ONLINE-019 (doc §59 C06/C07/C14): positions mean the same place only on the same map. Each client publishes
// its map version (a hash of the generated world) and shows, invites and challenges only remotes on the same map
// and in the same room. The interior strip between rooms is 'void' online, never Winston's safe town.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const net = (g) => g.eval(() => Satisfy.local.net());

test('a player on another map version is tracked but not drawn, invited or challenged; same version is', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    // B runs a build whose map hashes differently (as after an update that only one of them loaded). The version is
    // the hash of the map as generated at load (c178cdd), so a tile changed while playing (a tree cut) keeps it:
    // the test sets the other build's version through the hook instead of changing a tile.
    const [v0] = await b.eval(() => window.__GU.mapV());
    await b.eval(() => { window.__G.setT(3, 3, window.__G.at(3, 3) === 1 ? 2 : 1); });
    const [v1, h1] = await b.eval(() => window.__GU.mapV());
    assert.equal(v1, v0, 'a tile changed in play keeps the version');
    assert.notEqual(h1, v0, '(the map itself did change)');
    await b.eval(() => window.__GW.setMapV('0badc0de'));
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    const mvA = (await a.eval(() => Satisfy.local.playerPublic())).mv, mvB = (await b.eval(() => Satisfy.local.playerPublic())).mv;
    assert.match(mvA, /^[0-9a-f]{8}$/);
    assert.notEqual(mvA, mvB, 'one tile changes the version');
    const na = await net(a);
    assert.equal(na.remotes.length, 1, 'still tracked (counted, expires normally)');
    assert.equal(na.remotes[0].mv, mvB);
    assert.equal(na.drawn, 0, 'not drawn');
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Faker is nearby on a different version of the game/);
    await a.page.keyboard.press('KeyP');
    await a.step(2);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Nobody nearby to invite/);
    assert.equal(await b.eval(() => document.getElementById('partyInv').hidden), true);

    // a third tab on A's map sees A and is seen
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(c, { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 });
    await c.eval(() => { window.__G.P.x -= 20; });
    await settle(a, b, c);
    assert.equal((await c.eval(() => Satisfy.local.playerPublic())).mv, mvA);
    assert.equal((await net(a)).drawn, 1, 'Ruby is drawn, Faker is not');
    assert.equal((await net(c)).drawn, 1);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('the strip between house interiors is "void" online: not a safe town (duels there are refused: unit/duel)', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const spot = await a.eval(() => {
      const L = Satisfy.local, W = L.world();
      for (let ty = W.outdoorH; ty < W.h; ty++) for (let tx = 0; tx < W.w; tx++) {
        const x = tx * 16 + 8, y = ty * 16 + 8;
        if (!L.roomAt(x, y) && L.zoneAt(x, y) === 'void') return { x, y };
      }
      return null;
    });
    assert.ok(spot, 'there is undefined space in the interior strip');
    await a.eval((p) => { window.__G.P.x = p.x; window.__G.P.y = p.y; }, spot);
    await a.step(3);
    assert.equal((await a.eval(() => Satisfy.local.playerPublic())).zone, 'void');
    assert.equal(await a.eval(() => Satisfy.net.zonePolicy(Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y)).safe), false);
    assert.doesNotMatch(await a.eval(() => document.getElementById('netB').textContent), /Safe zone/);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});
