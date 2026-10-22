'use strict';
// SAT-ONLINE-108 (plan U020): the network at a glance for the owner. "/net" (admins only) shows who is online now
// (presence seen in the last minute), in which zones and at which levels, this page's link, and the crash reports of the
// last day with the newest. Anyone else is told it is for the owner.
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
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look, admin) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n, a]) => { const D = window.__fakeRTDB.data; if (a) D.set('admins/' + u, true); D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name, !!admin]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
// every page of a dialog, until its choices show
async function pages(g) {
  let out = [];
  for (let i = 0; i < 10; i++) { out.push(await g.eval(() => document.getElementById('dtext').textContent)); if (!(await g.eval(() => document.getElementById('dopts').hidden))) break; await g.eval(() => window.__G.advance()); await g.step(2); }
  return out;
}

test('"/net": online now by zone and level, the link, the last day\'s crashes; for the owner only', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gNwA1', 'Owner', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gNwB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gNwC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await c.eval(() => { window.__G.S.lv = 45; });
    await settle(own, b, c);
    await until([own], () => { const v = [...window.__fakeRTDB.data.keys()].filter((k) => /^presence\/satisfy\/main\//.test(k)); return v.length >= 3; });
    // the counting itself: only the last minute counts
    assert.deepEqual(await own.eval(() => window.__GMOD.nw({ a: { t: 1000, zone: 'zWin', lv: 5 }, b: { t: 900, zone: 'zWin', lv: 70 }, c: { t: 10, zone: 'zReid', lv: 30 } }, 60500)),
      { n: 2, zones: [['zWin', 2]], lv: [['1-9', 1], ['60+', 1]] });

    await type(own, '/net'); await own.step(4);
    await until([own], () => !document.getElementById('dopts').hidden || /The network now/.test(document.getElementById('dtext').textContent));
    const p = (await pages(own)).join(' | ');
    assert.match(p, /The network now/);
    assert.match(p, /Online: 3 players \(in the last minute\)/);
    assert.match(p, /Where: [^|]*3/);
    assert.match(p, /Levels: 1-9: 2 · 30-59: 1/);
    assert.match(p, /This page: \d+ ms round trip · \d+ writes · \d+ failed/);
    assert.match(p, /Crashes in the last day: 0/);
    await own.eval(() => { const b = [...document.querySelectorAll('#dopts button')]; b[b.length - 1].click(); }); await own.step(2);

    // a crash on Bassem's page shows up, with its message
    await b.eval(() => window.dispatchEvent(new ErrorEvent('error', { message: 'Boom at the anvil', error: new Error('Boom at the anvil') })));
    await until([own], () => [...window.__fakeRTDB.data.keys()].some((k) => /^crashes\//.test(k)));
    await type(own, '/net'); await own.step(4);
    await until([own], () => !document.getElementById('dopts').hidden || /The network now/.test(document.getElementById('dtext').textContent));
    assert.match((await pages(own)).join(' | '), /Crashes in the last day: 1 · [^|]*Boom at the anvil/);

    // anyone else: for the owner
    await type(b, '/net'); await b.step(4);
    await until([b], () => /owner/i.test(window.__toastSeen));
    for (const g of [own, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/admins|crashes/.test(x))), []);
  } finally { await ctx.close(); }
});
