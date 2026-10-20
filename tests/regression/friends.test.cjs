'use strict';
// SAT-ONLINE-067 (plan U059): friends online, over the fake Firebase with the rules' checks. A asks B from B's card; B
// accepts from Friends; both lists have the other, online with level and place; A hears when B comes back online; the
// rules refuse a friend without an ask; either side removes both.
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
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}
// a toast lives 2.6 s of real time, which a loaded machine can step past: every page keeps all the toasts it has shown
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.data.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}

test('online friends: ask from the card, accept, both lists, online with place, told when back online, remove', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await signIn(ctx, 'a', 'gFrA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    let b = await signIn(ctx, 'b', 'gFrB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    // A opens B's card: Add friend
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gFrB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    assert.equal(await a.eval(() => document.getElementById('pctxF').textContent), 'Add friend');
    await a.eval(() => document.getElementById('pctxF').click()); await a.step(2);
    assert.equal(await a.eval(() => document.getElementById('pctxF').textContent), 'Asked');
    await until([b], () => !!window.__GFR.asks().gFrA1);
    assert.match(await toasts(b), /Ahmed wants to be your friend/);
    // B accepts from Friends
    await b.eval(() => window.__GFR.board()); await b.step(2);
    assert.match(await b.eval(() => document.getElementById('dialog').textContent), /Friends \(0\/50\)/);
    await b.eval(() => window.__GFR.yes('gFrA1'));
    await until([a, b], () => Object.keys(window.__GFR.list()).length === 1);
    assert.deepEqual(await a.eval(() => window.__GFR.list()), { gFrB2: { n: 'Bassem' } });
    assert.deepEqual(await b.eval(() => window.__GFR.list()), { gFrA1: { n: 'Ahmed' } });
    assert.equal(await b.eval(() => Object.keys(window.__GFR.asks()).length), 0, 'the ask is used up');
    assert.match(await toasts(a), /You and Bassem are friends now/);
    await until([a], () => !!window.__GFR.pres().gFrB2);
    assert.deepEqual(await a.eval(() => { const p = window.__GFR.pres().gFrB2; return [p.h, p.lv > 0, p.zone]; }), ['Bassem', true, 'zWin']);
    // B leaves and comes back: offline, then A is told it is online
    await b.close();
    await until([a], () => !window.__GFR.pres().gFrB2, 15000);
    await a.eval(() => { window.__toastSeen = ''; }); // only what comes after B's return
    b = await signIn(ctx, 'b2', 'gFrB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const online = async () => /Bassem is online/.test(await toasts(a));
    for (let i = 0; i < 40 && !(await online()); i++) await settle(a, b); // both clocks run: B's page must publish its presence
    assert.equal(await online(), true, 'A is told B is online');
    // the rules: no friend without an ask, and no ask to a friend
    const tries = await a.eval(async () => {
      const F = window.__GFR.store(), out = [], go = async (p) => { try { await p; out.push('ok'); } catch (e) { out.push('no'); } };
      await go(F.accept('gFrA1', 'gStranger9', 'Ahmed', 'X')); // no ask from gStranger9
      await go(F.ask('gFrB2', 'gFrA1', 'Ahmed')); // already friends
      return out;
    });
    assert.deepEqual(tries, ['no', 'no']);
    // A removes B: both lists are empty
    await a.eval(() => window.__GFR.rm('gFrB2'));
    await until([a, b], () => Object.keys(window.__GFR.list()).length === 0);
    // friends again, then B deletes its online data: B is off A's list and nothing of B's friends is left online
    await b.eval(() => window.__GFR.store().ask('gFrA1', 'gFrB2', 'Bassem'));
    await until([a], () => !!window.__GFR.asks().gFrB2);
    await a.eval(() => window.__GFR.yes('gFrB2'));
    await until([a, b], () => Object.keys(window.__GFR.list()).length === 1);
    await b.eval(() => window.__G.act('quit')); await b.waitMode('title');
    await b.eval(() => document.getElementById('cloudBtn').click());
    await until([b], () => !document.getElementById('cloudW').hidden && !/Loading/.test(document.getElementById('cloudL').textContent));
    await b.eval(() => { const x = document.querySelector('#cloudA button:nth-child(2)'); x.click(); x.click(); }); // Delete, then the confirm
    await until([b], () => Satisfy.local.net() === null, 10000);
    await until([a], () => Object.keys(window.__GFR.list()).length === 0, 10000);
    assert.deepEqual(await a.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^friend/.test(k) && k.includes('gFrB2'))), []);
    assert.equal((await a.eval(() => window.__fakeRTDB.rejected)).length, 2, 'only the two refused on purpose');
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
