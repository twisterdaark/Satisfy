'use strict';
// SAT-ONLINE-060 (Claude-B #13 item 24): the leader makes the party a raid of up to 10 from the party panel and back.
// Online, over the fake Firebase, so the leader's presence with rd and the roster passes the database rules.
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
const head = (g) => g.eval(() => document.getElementById('pHead').textContent);
// every toast since keepToasts (a toast fades after 2.6 s of real time, which a loaded machine can outlast before the check)
const keepToasts = (g) => g.eval(() => { window.__toastLog = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); });
const toasts = (g) => g.eval(() => window.__toastLog.join(' | ') + ' | ' + document.getElementById('toasts').textContent);

test('online: Raid in the party panel makes a raid of up to 10 for every member, and Party makes it a party again', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gRdA1', 'Lead'], ['b', 'gRdB2', 'Eslam']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await keepToasts(b);
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2, 15000);
    await settle(a, b);
    assert.equal(await head(a), 'Party');
    assert.equal(await b.eval(() => document.getElementById('pRaidB').hidden), true, 'only the leader has the button');
    assert.equal(await a.eval(() => document.getElementById('pRaidB').textContent), 'Raid');

    await a.eval(() => document.getElementById('pRaidB').click());
    await settle(a, b);
    assert.equal(await head(a), 'Raid (2/10)');
    await until([b], () => document.getElementById('pHead').textContent === 'Raid (2/10)');
    assert.match(await toasts(b), /Your party is now a raid: up to 10 players/);
    assert.equal(await a.eval(() => document.getElementById('pRaidB').textContent), 'Party');

    await a.eval(() => document.getElementById('pRaidB').click());
    await settle(a, b);
    await until([b], () => document.getElementById('pHead').textContent === 'Party');
    assert.match(await toasts(b), /Your raid is a party again/);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
