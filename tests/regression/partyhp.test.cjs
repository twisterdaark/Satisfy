'use strict';
// SAT-ONLINE-021 (doc §35 U051 party HP, U052 party pings): every player publishes health in 5% steps; the party
// panel shows a bar per member; Alt+click pings a spot for the party (ground ring + minimap), rate-limited.
// Over the local transport and over the fake Firebase (party.ping in the inbox, hp in presence, rules applied).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

async function partyOf2(mode) {
  const ctx = await H.newContext(mode === 'online' ? { scripts: [H.FAKE_FIREBASE] } : {});
  const a = await H.openGame({ ctx, query: `?net=${mode}&slot=a` });
  const b = await H.openGame({ ctx, query: `?net=${mode}&slot=b` });
  if (mode === 'online') {
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until(g, () => !!Satisfy.local.net());
    }
  }
  await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
  await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
  await b.eval(() => { window.__G.P.x += 20; });
  await settle(a, b);
  await a.page.keyboard.press('KeyP');
  await settle(a, b);
  await until(b, () => !document.getElementById('partyInv').hidden);
  await b.page.keyboard.press('KeyY');
  await settle(a, b);
  for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
  return { ctx, a, b };
}
const bars = (g) => g.eval(() => [...document.querySelectorAll('#partyL i.php')].map((i) => +i.dataset.hp));

for (const mode of ['local', 'online']) {
  test(`[${mode}] party frames show each member's health; an Alt+click ping reaches the other member`, async () => {
    const { ctx, a, b } = await partyOf2(mode);
    try {
      assert.equal((await b.eval(() => Satisfy.local.playerPublic())).hp, 100);
      await until(a, () => [...document.querySelectorAll('#partyL i.php')].length === 2);
      assert.deepEqual(await bars(a), [100, 100]);
      // B loses 40% of its health: A's frame for B follows (in 5% steps), A's own bar doesn't move
      await b.eval(() => { const G = window.__G; G.P.hp = Math.round(G.maxHP() * 0.6); });
      await settle(a, b);
      await until(a, () => +document.querySelectorAll('#partyL i.php')[1].dataset.hp === 60);
      assert.deepEqual(await bars(a), [100, 60]);

      // A pings a spot 80 px east with Alt+click: both see the ring, B gets it with A's name
      const spot = await a.eval(() => ({ x: window.__G.P.x + 80, y: window.__G.P.y - 10 }));
      const scr = await a.eval((p) => window.__G.toScreen(p.x, p.y), spot);
      await a.page.keyboard.down('Alt');
      await a.page.mouse.click(scr.x, scr.y);
      await a.page.keyboard.up('Alt');
      await a.step(2);
      assert.equal(await a.eval(() => window.__G.P.acd > 0), false, 'a ping is not an attack');
      await settle(a, b);
      const got = await b.eval(() => Satisfy.local.net().pings);
      assert.equal(got.length, 1);
      assert.equal(got[0].handle, 'Grid');
      assert.ok(Math.abs(got[0].x - spot.x) <= 2 && Math.abs(got[0].y - spot.y) <= 2, JSON.stringify(got[0]) + ' vs ' + JSON.stringify(spot));
      assert.equal((await a.eval(() => Satisfy.local.net().pings)).length, 1, 'the pinger sees it too');
      // a second ping right away is refused; after 3 s the rings are gone
      await a.page.keyboard.down('Alt');
      await a.page.mouse.click(scr.x, scr.y);
      await a.page.keyboard.up('Alt');
      await a.step(2);
      assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Not so many pings/);
      await a.step(200); await b.step(200);
      assert.deepEqual(await b.eval(() => Satisfy.local.net().pings), []);
      if (mode === 'online') {
        for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
        const pushed = await a.eval(() => window.__fakeRTDB.log.filter((l) => l.op === 'push').length);
        assert.ok(pushed >= 2, 'invite + ping went through the inbox');
      }
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally { await ctx.close(); }
  });
}

test('outside a party, Alt+click says pings are for the party (no ping, no attack)', async () => {
  const g = await H.openGame({ query: '?net=local&slot=solo' });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const scr = await g.eval(() => window.__G.toScreen(window.__G.P.x + 60, window.__G.P.y));
    await g.page.keyboard.down('Alt');
    await g.page.mouse.click(scr.x, scr.y);
    await g.page.keyboard.up('Alt');
    await g.step(2);
    assert.deepEqual(await g.eval(() => Satisfy.local.net().pings), []);
    assert.equal(await g.eval(() => window.__G.P.acd > 0), false);
    assert.match(await g.eval(() => document.getElementById('toasts').textContent), /Pings are for your party/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
