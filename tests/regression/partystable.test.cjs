'use strict';
// SAT-ONLINE-026 (owner feedback #13): a party member whose window is covered or minimised must not "leave". The browser
// stops requestAnimationFrame there, so the render loop (and netTick) stops; a heartbeat outside the loop keeps the
// presence fresh. Here a page that is not stepped is exactly that: its frames don't run, its timers and Worker do.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(6);
    await games[0].page.waitForTimeout(30);
  }
}
const members = () => ((Satisfy.local.net().party || {}).members || []).length;
const recordToasts = (g) => g.eval(() => { window.__toastLog = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toastLog.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true }); });
// step only `g`, no faster than real time, for `sec` seconds of its game clock
async function only(g, sec) {
  for (let i = 0; i < sec * 2; i++) { await g.step(30); await g.page.waitForTimeout(500); }
}

test('a member or the leader in a background window stays in the party (heartbeat outside the render loop)', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    await recordToasts(a); await recordToasts(b);

    // B's window is covered: its frames stop for longer than the presence expiry (15 s) plus the party grace (10 s)
    await only(a, 28);
    assert.equal(await a.eval(members), 2, 'the leader still has B');
    assert.deepEqual((await a.eval(() => window.__toastLog)).filter((x) => /left|dissolved/i.test(x)), []);
    // now the leader's window is covered
    await only(b, 28);
    assert.equal(await b.eval(members), 2, 'B is still in the party');
    assert.deepEqual((await b.eval(() => window.__toastLog)).filter((x) => /left|dissolved/i.test(x)), []);
    await settle(a, b);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
