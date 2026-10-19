'use strict';
// SAT-ONLINE-059 (plan U184, Claude-B #13): weekly lockouts. Online, a dungeon boss's chest pays once a week per account:
// the first Goblin Warlord chest pays and takes the lockout; a second one that week is empty; another boss's chest still
// pays. The rules keep the lockout (no second take, none for someone else). Offline nothing is locked.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}
// a boss chest at your feet, opened at once (the gate dunBossDown leaves)
const chest = (g, b) => g.eval((b) => {
  const G = window.__G, P = G.P, x = { x: P.x, y: P.y, to: { x: P.x, y: P.y }, hint: 'hBChest', tmp: 1, chest: 1, til: 1e12, b, lv: 0 };
  G.eqx.DGATES.push(x); const g0 = G.S.gold; G.eqx.useGate(x); window.__lastChest = { x, g0 }; return g0;
}, b);
const paid = (g) => g.eval(() => window.__G.S.gold - window.__lastChest.g0);
const toastLog = (g) => g.eval(() => document.getElementById('toasts').textContent);

test('online: a dungeon boss chest pays once a week per account; another boss still pays; offline is not locked', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await a.eval(() => { window.__fakeRTDB.data.set('accountIds/gLkA1', 'Ahmed'); window.__fakeRTDB.nextName = 'Ahmed'; window.__fakeRTDB.nextUid = 'gLkA1'; document.getElementById('onlineBtn').click(); });
    await until([a], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await until([a], () => !!window.__GL2.locks);
    const wk = await a.eval(() => window.__GL2.week());
    assert.match(wk, /^w[0-9]{4,6}$/);

    // the first Goblin Warlord chest pays and takes this week's lockout
    await chest(a, 'gwar');
    await until([a], () => window.__lastChest.x.open === 1 && window.__G.S.gold > window.__lastChest.g0);
    assert.equal(await a.eval((w) => typeof window.__fakeRTDB.data.get('lockouts/gLkA1/' + w + '/gwar').t, wk), 'number');
    await until([a], () => !!(window.__GL2.locks && window.__GL2.locks.gwar));
    // a second one this week: empty, and you are told when it resets
    await chest(a, 'gwar');
    await until([a], () => window.__lastChest.x.open === 1);
    await a.step(5);
    assert.equal(await paid(a), 0, 'nothing from the second chest');
    assert.match(await toastLog(a), /this week: it is empty for you until the reset in \d+ (days|h)/);
    // another boss's chest still pays
    await chest(a, 'kking');
    await until([a], () => window.__lastChest.x.open === 1 && window.__G.S.gold > window.__lastChest.g0);

    // the rules: no second take of the same lockout, and none in another player's name
    const tries = await a.eval(async (w) => {
      const F = window.__GL2.fb(), D = F.m.database, out = [];
      for (const p of ['lockouts/gLkA1/' + w + '/gwar', 'lockouts/gOther9/' + w + '/bknight', 'lockouts/gLkA1/' + w + '/bknight']) {
        try { await D.update(D.ref(F.db), { [p]: { t: D.serverTimestamp() } }); out.push('ok'); } catch (e) { out.push('no'); }
      }
      return out;
    }, wk);
    assert.deepEqual(tries, ['no', 'no', 'ok']);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }

  // offline: two chests of the same boss both pay
  const o = await H.openGame();
  try {
    await H.newGame(o);
    for (let i = 0; i < 2; i++) { await chest(o, 'gwar'); await o.step(2); assert.ok((await paid(o)) > 0, 'offline chest ' + (i + 1) + ' pays'); }
    assert.deepEqual(o.errors, []);
  } finally { await o.close(); }
});
