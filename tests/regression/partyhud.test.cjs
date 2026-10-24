'use strict';
// U248 Party HUD (SAT-ONLINE-203; plan: "visible remote HP/class/zone/ready state", checked by "UI doesn't show stale values
// as truth"): under each mate's name in the party panel, their class and where they are; a mate not heard from for 2.5 s
// is dimmed (health too) with how long ago, and comes back to normal when they are heard again.
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
const row = (g) => g.eval(() => { const d = [...document.querySelectorAll('#partyL > div')][1]; const s = document.querySelectorAll('#partyL small.psub')[0], b = document.querySelectorAll('#partyL i.php')[1];
  return d ? { stale: d.classList.contains('stale'), sub: s ? s.textContent : '', barStale: !!(b && b.classList.contains('stale')) } : null; });

test('the party panel: a mate\'s class and place; dimmed when not heard from, back when heard again', async () => {
  const { ctx, a, b } = await partyOf2('local');
  try {
    await until(a, () => !!document.querySelector('#partyL small.psub'));
    let r = await row(a);
    assert.equal(r.stale, false);
    assert.ok(r.sub.length > 3 && !/⏳/.test(r.sub), 'class and place: ' + r.sub);
    assert.ok(/Winston|Novice|·/.test(r.sub), r.sub);
    // B's window stops (no frames, no word): A's panel dims B after 2.5 s of A's time, with how long ago
    for (let i = 0; i < 12; i++) await a.step(15);
    r = await row(a);
    assert.equal(r.stale, true, 'dimmed: ' + JSON.stringify(r));
    assert.equal(r.barStale, true, 'the health bar too');
    assert.match(r.sub, /⏳ \ds ago/);
    // B is heard again: back to normal
    await settle(a, b);
    await until(a, () => { const d = [...document.querySelectorAll('#partyL > div')][1]; return d && !d.classList.contains('stale'); });
    r = await row(a);
    assert.equal(r.barStale, false);
    assert.doesNotMatch(r.sub, /⏳/);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
