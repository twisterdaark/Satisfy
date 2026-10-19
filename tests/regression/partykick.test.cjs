'use strict';
// SAT-ONLINE-037 (owner 2026-10-19): the leader removes a member from the party panel (Kick, then "Kick Eslam?"). The member
// gets a notice and is never rejoined to that party by itself: the next invite needs Y. Online, over the fake Firebase, so
// the kick's payload passes the database rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(10);
    await games[0].page.waitForTimeout(30);
  }
}
const shown = (g, sel) => g.eval((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
const toasts = (g) => g.eval(() => document.getElementById('toasts').textContent);

test('online: Kick, confirm, the member is told and a new invite needs Y', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gLeadA1', 'Lead'], ['b', 'gEslamB2', 'Eslam']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2, 15000);
    await settle(a, b);

    assert.equal(await b.eval(() => document.querySelectorAll('#partyL button.kick').length), 0, 'a member has no Kick');
    assert.equal(await a.eval(() => document.querySelectorAll('#partyL button.kick').length), 1, 'the leader has one, for the member');
    // Kick asks first; Cancel keeps them
    await a.eval(() => document.querySelector('#partyL button.kick').click()); await a.step(2);
    assert.equal(await a.eval(() => document.querySelector('#partyL .kq span').textContent), 'Kick Eslam?');
    await a.eval(() => document.querySelector('#partyL button.kno').click()); await a.step(2);
    assert.equal(await a.eval(() => document.querySelectorAll('#partyL .kq').length), 0);
    await settle(a, b);
    assert.equal(await b.eval(() => Satisfy.local.net().party.members.length), 2, 'Cancel kicks nobody');
    // Kick, then the confirm
    await a.eval(() => document.querySelector('#partyL button.kick').click()); await a.step(2);
    await a.eval(() => document.querySelector('#partyL button.kyes').click()); await a.step(2);
    assert.match(await toasts(a), /Eslam was removed from the party/);
    await until([b], () => Satisfy.local.net().party.id === null, 15000);
    assert.match(await toasts(b), /Lead removed you from the party/);
    assert.equal(await b.eval(() => sessionStorage.getItem('satisfy_party') || null), null, 'no rejoin memo left');
    await until([a], () => document.getElementById('partyW').hidden);
    // nothing brings them back by itself; a fresh invite asks
    for (let i = 0; i < 4; i++) await settle(a, b);
    assert.equal(await b.eval(() => Satisfy.local.net().party.id), null);
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await settle(a, b);
    assert.equal(await b.eval(() => Satisfy.local.net().party.id), null, 'the invite waits for Y');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
