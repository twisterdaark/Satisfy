'use strict';
// U291 Fishing festival (SAT-ONLINE-183; plan: "species/weight competition and seasonal cosmetics", check: "fish catch
// evidence server validated"), two pages over the fake Firebase, on a clock inside a real Fishing festival slot:
//   - during the festival the board shows at the top: your heaviest, and the heaviest three of everyone;
//   - a catch goes on the board (yours, heavier only); a second inside 15 s waits its turn, then goes;
//   - a weight past what the kind can weigh is refused (a direct write);
//   - when the festival ends, the heaviest wins: the title Festival Angler and the toast; the other hears who won.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function until(games, fn, ms = 15000, arg) {
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
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}

test('the fishing festival board: the top three, heavier only, the 15 s wait, the cap, the winner', async () => {
  // the next Fishing festival slot from the tests' clock
  let at;
  {
    const g = await H.openGame({});
    at = await g.eval(() => { const E = window.__GU.EVT; for (let s = Math.floor(Date.now() / 900000); ; s++) if (E[((s * 2654435761) >>> 0) % E.length].k === 'fishf') return s * 900000 + 20000; });
    await g.close();
  }
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock(at)] });
  try {
    const a = await signIn(ctx, 'a', 'gFfA1', 'Ann', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gFfB2', 'Bob', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await until([a, b], () => !!window.__GFF.F.s && !document.getElementById('ffW').hidden, 20000);
    assert.match(await a.eval(() => document.getElementById('ffW').textContent), /Fishing festival · You haven't caught one yet/);
    const slot = await a.eval(() => window.__GFF.F.s);
    // Ann: 2.0 kg, then 2.5 kg within 15 s: the second waits its turn
    await a.eval(() => window.__GFF.catch('fish', 2.0));
    await until([a], () => (window.__fakeRTDB.data.get('fishFest/' + window.__GFF.F.s + '/gFfA1') || {}).w === 20);
    await a.eval(() => window.__GFF.catch('fish', 2.5)); await a.step(30);
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('fishFest/' + window.__GFF.F.s + '/gFfA1').w), 20, 'not yet');
    await a.eval(() => { const real = Date.now; Date.now = () => real() + 16000; }); await a.step(10); // 16 s on
    await until([a], () => (window.__fakeRTDB.data.get('fishFest/' + window.__GFF.F.s + '/gFfA1') || {}).w === 25);
    // Bob: a lighter one, and a forged one past the cap (refused)
    await b.eval(() => window.__GFF.catch('sfish', 1.4));
    const forged = await b.eval(async (s) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.set(D.ref(F.db, 'fishFest/' + s + '/gFfB2'), { s, w: 90, k: 'fish', n: 'Bob', t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } }, slot);
    assert.equal(forged, 'no', 'past what a Fish can weigh');
    // both pages: the board
    await until([a, b], () => /1\. Ann: 2\.5 kg · 2\. Bob: 1\.4 kg/.test(document.getElementById('ffW').textContent), 20000);
    assert.match(await a.eval(() => document.getElementById('ffW').textContent), /Your heaviest: 2\.5 kg/);
    // the festival ends (ten minutes in): Ann wins
    for (const [g, off] of [[a, 11 * 60000 - 16000], [b, 11 * 60000]]) await g.eval((off) => { const real = Date.now; Date.now = () => real() + off; }, off);
    await until([a, b], () => window.__GFF.F.s === null, 20000);
    await until([a], () => !!window.__G.S.tl.angler && /You won the fishing festival! Your 2\.5 kg fish/.test(window.__toastSeen), 20000);
    await until([b], () => /The festival is over: first, Ann with a 2\.5 kg fish · you were #2/.test(window.__toastSeen), 20000);
    assert.equal(await a.eval(() => document.getElementById('ffW').hidden), true);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
