'use strict';
// SAT-ONLINE-023 (doc §35 U065 party reconnect): a reload (F5, "Play here", an update) doesn't lose the party.
// The member comes back and accepts its leader's invite by itself; a reloaded leader keeps its party.
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
const inParty = () => ((Satisfy.local.net() || {}).party || {}).members && Satisfy.local.net().party.members.length === 2;

test('a member or the leader reloads: the party comes back without a prompt', async () => {
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
    await until([a, b], inParty);
    const pid = await a.eval(() => Satisfy.local.net().party.id);

    // B reloads and continues: back in the same party, no invite prompt
    await b.eval(() => window.__G.act('quit'));
    await b.waitMode('title');
    await b.reload();
    await until([b], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    await H.continueGame(b);
    // toasts fade after a few seconds: record them as they appear
    await b.eval(() => { window.__toastLog = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toastLog.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true }); });
    await until([a, b], inParty, 30000);
    assert.equal(await b.eval(() => Satisfy.local.net().party.id), pid);
    assert.equal(await b.eval(() => document.getElementById('partyInv').hidden), true, 'no prompt');
    assert.ok((await b.eval(() => window.__toastLog)).some((x) => /Back in Grid's party/.test(x)), 'told it is back');
    assert.ok(!(await b.eval(() => window.__toastLog)).some((x) => /invites you/.test(x)));

    // A (the leader) reloads: its party is restored and B is still in it
    await a.eval(() => window.__G.act('quit'));
    await a.waitMode('title');
    await a.reload();
    await until([a], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    await H.continueGame(a);
    await until([a, b], inParty, 30000);
    assert.equal(await a.eval(() => Satisfy.local.net().party.id), pid);
    assert.equal(await b.eval(() => Satisfy.local.net().party.id), pid);

    // leaving on purpose is final: no invite back
    await b.eval(() => document.querySelector('#partyW [data-act="pLeave"]').click());
    await settle(a, b);
    await a.step(60 * 8); await b.step(60 * 8);
    await settle(a, b);
    assert.equal(await b.eval(() => Satisfy.local.net().party.id), null);
    assert.equal(await b.eval(() => document.getElementById('partyInv').hidden), true);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
