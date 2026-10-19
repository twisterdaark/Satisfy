'use strict';
// SAT-ONLINE-028 (owner feedback #5, #10, #12): a World chat tab for everyone online, world notices that reach every
// online player in their own language, and a list of who is online (O).
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
const lines = (g) => g.eval(() => [...document.querySelectorAll('#chatL div')].map((d) => d.textContent));

test('online: world chat across the map, a world notice in the reader\'s language, and the player list', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=online&slot=b', storage: { satisfy_lang: 'ar' } });
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 3000; }); // far outside each other's 800 px interest range: presence never meets
    await settle(a, b); await settle(a, b);
    assert.equal(await a.eval(() => Satisfy.local.net().count), 0, 'A does not see B in presence');

    // world chat: Enter outside a party opens the World tab
    await a.page.keyboard.press('Enter');
    await a.page.keyboard.type('hello everyone');
    await a.page.keyboard.press('Enter');
    await until([b], () => [...document.querySelectorAll('#chatL div')].some((d) => /hello everyone/.test(d.textContent)));
    assert.deepEqual(await lines(b), ['Grid: hello everyone']);
    assert.equal(await b.eval(() => document.querySelector('#chatTabs [data-ct="world"]').classList.contains('on')), true);
    assert.equal(await b.eval(() => document.querySelector('#chatTabs [data-ct="party"]').disabled), true, 'no party: its tab is off');

    // a world notice: A's game announces it in English, B shows it in Arabic
    await a.eval(() => window.__G.announce(window.__G.t('annPagma', { n: 'Grid' })));
    await until([b], () => !document.getElementById('announce').hidden && /Grid/.test(document.getElementById('anntext').textContent));
    const ar = await b.eval(() => document.getElementById('anntext').textContent);
    assert.ok(ar.startsWith('🌐 '), ar);
    assert.equal(ar.slice(3), await b.eval(() => window.__G.t('annPagma', { n: 'Grid' })), 'B\'s own language');
    // a personal message (not a world notice) stays home
    await a.eval(() => window.__G.announce(window.__G.t('brokeT', { it: 'Sword' })));
    await settle(a, b);
    assert.doesNotMatch(await b.eval(() => document.getElementById('anntext').textContent), /Sword/);

    // the player list: both, with their zones
    await b.page.keyboard.press('KeyO');
    await until([b], () => document.querySelectorAll('#plL .r').length === 2);
    const rows = await b.eval(() => [...document.querySelectorAll('#plL .r')].map((r) => r.textContent));
    assert.ok(rows[0].includes('Faker'), 'self first: ' + rows);
    assert.ok(rows.some((r) => r.includes('Grid')), rows.join(' | '));
    await b.page.keyboard.press('Escape');
    await b.step(2);
    assert.equal(await b.eval(() => document.getElementById('plW').hidden), true);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
