'use strict';
// SAT-ONLINE-070: whispers between friends, over the fake Firebase with the rules' checks. A and B become friends; A
// whispers B with "/w Bassem ..." (B reads it in purple, from A); B answers; a stranger's whisper is refused by the
// rules; a name that is not a friend is told so.
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
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
const chatLines = (g) => g.eval(() => [...document.querySelectorAll('#chatL div')].map((d) => d.className.replace('old ', '') + '|' + d.textContent));

test('online whispers: only between friends, anywhere; /w name text; a stranger is refused', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await signIn(ctx, 'a', 'gWhA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gWhB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    // not friends yet: /w is refused in the game, and the rules refuse a direct write
    await type(a, '/w Bassem hello?');
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Bassem is not your friend: whispers are for friends/);
    assert.equal(await a.eval(() => document.getElementById('chatIn').hidden), false, 'the line stays open to fix the name');
    await a.page.keyboard.press('Escape'); await a.step(2);
    const direct = await a.eval(async () => { try { await window.__GFR.store().whisper('gWhB2', { from: 'gWhA1', h: 'Ahmed', text: 'sneaky' }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(direct, 'no');
    // friends (B asked, A accepts), then B goes far away
    await b.eval(() => window.__GFR.store().ask('gWhA1', 'gWhB2', 'Bassem'));
    await until([a], () => !!window.__GFR.asks().gWhB2);
    await a.eval(() => window.__GFR.yes('gWhB2'));
    await until([a, b], () => Object.keys(window.__GFR.list()).length === 1);
    await b.eval(() => { window.__G.P.x += 3000; });
    await settle(a, b);
    // A whispers B: B reads it from A, in purple; A's own shows "→ Bassem"
    await type(a, '/w bassem Meet me at the forge');
    await until([b], () => [...document.querySelectorAll('#chatL div.w')].some((d) => /Ahmed \(whisper\): Meet me at the forge/.test(d.textContent)), 10000);
    assert.ok((await chatLines(a)).some((l) => l === 'w|→ Bassem: Meet me at the forge'), (await chatLines(a)).join(' / '));
    // B answers
    await type(b, '/w Ahmed On my way');
    await until([a], () => [...document.querySelectorAll('#chatL div.w')].some((d) => /Bassem \(whisper\): On my way/.test(d.textContent)), 10000);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected.filter((x) => !/whisper not a friend/.test(x))), []);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
