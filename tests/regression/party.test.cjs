'use strict';
// SAT-ONLINE-003: forming a party in Winston with the real keys, over the local transport and over
// the fake Firebase (inbox path + rules), plus the safe-zone tag.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const party = (g) => g.eval(() => Satisfy.local.net().party);
const shown = (g, id) => g.eval((i) => !document.getElementById(i).hidden, id);
const text = (g, id) => g.eval((i) => document.getElementById(i).textContent, id);

async function pair(mode) {
  const ctx = await H.newContext(mode === 'online' ? { scripts: [H.FAKE_FIREBASE] } : {});
  const a = await H.openGame({ ctx, query: `?net=${mode}&slot=a` });
  const b = await H.openGame({ ctx, query: `?net=${mode}&slot=b` });
  if (mode === 'online') {
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until(g, () => !!Satisfy.local.net());
    }
  }
  await H.newGame(a, LOOK_A);
  await H.newGame(b, LOOK_B);
  // stand B right next to A (both spawn on the same tile; nudge so they are distinct but within reach)
  await b.eval(() => { window.__G.P.x += 20; });
  await settle(a, b);
  return { ctx, a, b };
}

for (const mode of ['local', 'online']) {
  test(`[${mode}] P invites the nearby player, Y accepts, both see the party`, async () => {
    const { ctx, a, b } = await pair(mode);
    try {
      await a.page.keyboard.press('KeyP');
      await settle(a, b);
      await until(b, () => !document.getElementById('partyInv').hidden);
      assert.equal(await shown(b, 'partyInv'), true, 'invite prompt on B');
      assert.equal(await text(b, 'partyInvT'), 'Grid invites you to a party');
      await b.page.keyboard.press('KeyY');
      await settle(a, b);
      for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
      const pa = await party(a), pb = await party(b);
      assert.equal(pa.id, 'p_' + (await a.eval(() => Satisfy.local.net().uid)));
      assert.equal(pb.id, pa.id);
      assert.deepEqual(pa.members.map((m) => m.handle || 'self'), ['self', 'Faker']);
      assert.deepEqual(pb.members.map((m) => [m.handle || 'self', m.leader]), [['self', false], ['Grid', true]]);
      assert.equal(await shown(a, 'partyW'), true);
      assert.match(await text(a, 'partyL'), /★ Grid.*Faker/);
      assert.equal(await shown(b, 'partyInv'), false, 'prompt closes');
      if (mode === 'online') {
        const types = await a.eval(() => window.__fakeRTDB.log.filter((l) => l.op === 'push').map((l) => l.path.split('/')[0]));
        assert.deepEqual([...new Set(types)], ['inbox']);
        assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
        assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
        const left = await a.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => k.startsWith('inbox/')));
        assert.deepEqual(left, [], 'read messages are deleted');
      }
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally { await ctx.close(); }
  });

  test(`[${mode}] N declines; Leave breaks the party for both`, async () => {
    const { ctx, a, b } = await pair(mode);
    try {
      await a.page.keyboard.press('KeyP');
      await settle(a, b);
      await until(b, () => !document.getElementById('partyInv').hidden);
      await b.page.keyboard.press('KeyN');
      await settle(a, b);
      assert.equal((await party(b)).id, null);
      assert.equal(await shown(b, 'partyInv'), false);
      await until(a, () => !(Satisfy.local.net().party || {}).id);
      assert.equal((await party(a)).id, null, 'declined, nobody left: party dissolves');
      await a.page.keyboard.press('KeyP');
      await settle(a, b);
      await until(b, () => !document.getElementById('partyInv').hidden);
      await b.page.keyboard.press('KeyY');
      await settle(a, b);
      await until(b, () => !!(Satisfy.local.net().party || {}).id);
      assert.ok((await party(b)).id);
      await b.eval(() => document.querySelector('#partyW [data-act=pLeave]').click());
      await settle(a, b);
      await a.step(6 * 60); // past the grace period
      await settle(a, b);
      for (const g of [a, b]) await until(g, () => !(Satisfy.local.net().party || {}).id);
      assert.equal((await party(b)).id, null);
      assert.equal((await party(a)).id, null);
      assert.equal(await shown(a, 'partyW'), false);
    } finally { await ctx.close(); }
  });
}

test('P with nobody close says so; party keys do nothing offline', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    await H.newGame(a, LOOK_A);
    await a.page.keyboard.press('KeyP');
    await a.step(2);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Nobody nearby to invite/);
    const off = await H.openGame({ ctx, query: '?slot=c' });
    await H.newGame(off, LOOK_B);
    await off.page.keyboard.press('KeyP');
    await off.step(2);
    assert.doesNotMatch(await off.eval(() => document.getElementById('toasts').textContent), /invite/i);
    assert.deepEqual(off.errors, []);
  } finally { await ctx.close(); }
});

test('safe zone tag in Winston, not outside town', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    await H.newGame(a, LOOK_A);
    await a.step(5);
    assert.match(await text(a, 'netB'), /Safe zone$/);
    await a.eval(() => { const P = window.__G.P; P.x = 90 * 16; P.y = 60 * 16; }); // plains west of Winston
    await a.step(5);
    assert.equal(await a.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y) === 'zWin'), false);
    assert.doesNotMatch(await text(a, 'netB'), /Safe zone/);
  } finally { await ctx.close(); }
});

test('every town is a safe zone, and Patrian shows the tag', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    await H.newGame(a, LOOK_A);
    const towns = await a.eval(() => Satisfy.local.world().towns.map((z) => [z, Satisfy.net.zonePolicy(z).safe]));
    assert.ok(towns.length >= 5, 'Bairan, Winston, Patrian, Reidan, Reinhardt');
    for (const [z, safe] of towns) assert.equal(safe, true, `${z} is safe`);
    const zone = await a.eval(() => { const T = window.__G.TOWNS.find((t) => t.k === 'zPat'), P = window.__G.P; P.x = T.rx * 16 + 8; P.y = T.ry * 16 + 10; return Satisfy.local.zoneAt(P.x, P.y); });
    assert.equal(zone, 'zPat');
    await a.step(5);
    assert.match(await text(a, 'netB'), /Safe zone$/);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});

test('[online] a member invites a third player directly; the leader takes them in without doing anything (owner 2026-10-23)', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  const gs = [];
  try {
    for (const s of ['a', 'b', 'c']) gs.push(await H.openGame({ ctx, query: `?net=online&slot=${s}` }));
    const [a, b, c] = gs;
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem'], [c, 'Eslam']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until(g, () => !!Satisfy.local.net());
    }
    await H.newGame(a, LOOK_A); await H.newGame(b, LOOK_B); await H.newGame(c, { n: 'Eslam', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x += 32; });
    await settle(a, b, c);
    await a.page.keyboard.press('KeyP'); await settle(a, b, c);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b, c);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    // the member (Faker) invites Eslam; the leader's frames don't run meanwhile (a tab in the background)
    await b.page.keyboard.press('KeyP');
    for (let i = 0; i < 6; i++) { await b.step(5); await c.step(5); }
    await until(c, () => !document.getElementById('partyInv').hidden);
    assert.equal(await text(c, 'partyInvT'), "Faker invites you to Grid's party");
    await c.page.keyboard.press('KeyY');
    for (let i = 0; i < 6; i++) { await b.step(5); await c.step(5); }
    await settle(a, b, c);
    for (const g of [a, b, c]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 3, 8000);
    const pa = await party(a), pc = await party(c);
    assert.equal(pc.id, pa.id);
    for (const g of gs) { assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []); assert.deepEqual(g.errors, []); }
  } finally { await ctx.close(); }
});
