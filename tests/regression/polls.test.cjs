'use strict';
// U306 Community board polls (SAT-ONLINE-173; plan: "in-game votes for cosmetic events", check: "privacy/anti-alt checks"),
// over the fake Firebase with the rules' checks:
//   - only the game's owner posts a poll ("/poll question | a | b | hours"); a player's chat command and a direct write fail;
//   - online, the town board shows it with the counts; a player votes once, and both pages see the count;
//   - the same account can't vote again (the board says so; a direct second write is refused), nor raise a count alone,
//     nor vote for an answer the poll doesn't have (the account ID and the rest: unit/rules-polls).
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
// world notices replace each other (a region discovered right after joining): keep every one shown, with its heading
const keepNotices = (g) => g.eval(() => { window.__annSeen = []; const W = document.getElementById('announce'); new MutationObserver(() => { const s = W.querySelector('.head').textContent + ' | ' + document.getElementById('anntext').textContent; if (window.__annSeen[window.__annSeen.length - 1] !== s) window.__annSeen.push(s); }).observe(W, { childList: true, subtree: true, characterData: true, attributes: true }); });
const notices = (g) => g.eval(() => window.__annSeen.join('\n'));
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look, admin) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  if (admin) await g.eval((u) => window.__fakeRTDB.data.set('admins/' + u, true), uid); // the owner marks the account in the console
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  if (look) await H.newGame(g, look); else await H.continueGame(g);
  await keepToasts(g); await keepNotices(g);
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
const tally = (g) => g.eval(() => { const P = window.__GPOLL, id = P.open(); return id ? JSON.stringify(P.tally[id] || {}) : null; });

test('community polls: the owner asks, each account votes once at the board, only the counts are public', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gPoA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gPoB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(own, b);
    // a player can't post one
    await type(b, '/poll Free gold? | yes | yes');
    await until([b], () => /Only the game's owner can do that/.test(window.__toastSeen));
    const forged = await b.eval(async () => { const F = window.__GLD.fb(), D = F.m.database; try { await D.push(D.ref(F.db, 'polls'), { q: { ar: 'x', en: 'x' }, o: { 0: { ar: 'a', en: 'a' }, 1: { ar: 'b', en: 'b' } }, end: Date.now() + 3600000, by: 'gPoB2', t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(forged, 'no');
    // the owner asks
    await type(own, '/poll Which festival next? | Lanterns | Fireworks | Masks | 24');
    await until([own, b], () => !!window.__GPOLL.open());
    // the board: the poll with its answers
    const menu = await b.eval(() => { window.__GPOLL.menu(); return document.getElementById('dialog').innerText; });
    assert.match(menu, /Which festival next\?/);
    for (let i = 0; i < 4 && await b.eval(() => !document.querySelector('#dopts button')); i++) { await b.page.keyboard.press('Enter'); await b.step(2); }
    const opts = await b.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent));
    assert.deepEqual(opts.slice(0, 3), ['1. Vote: Lanterns', '2. Vote: Fireworks', '3. Vote: Masks']);
    // B votes Fireworks: both see it
    await b.page.locator('#dopts button').nth(1).click();
    await until([own, b], () => { const P = window.__GPOLL, id = P.open(); return id && (P.tally[id] || {})[1] === 1; });
    assert.equal(await tally(own), '{"1":1}');
    assert.equal(await b.eval(() => window.__GPOLL.mine[window.__GPOLL.open()]), 1);
    // once: the board says so; a second write, a count raised alone, an answer that isn't there: refused
    const again = await b.eval(() => { window.__GPOLL.menu(); return document.getElementById('dialog').innerText; });
    assert.match(again, /You have voted in this poll/);
    const tries = await b.eval(async () => { const F = window.__GLD.fb(), D = F.m.database, id = window.__GPOLL.open(), w = async (u) => { try { await D.update(D.ref(F.db), u); return 'ok'; } catch (e) { return 'no'; } };
      return Promise.all([w({ ['pollVotes/' + id + '/gPoB2']: '0', ['pollTally/' + id + '/0']: 1 }), w({ ['pollTally/' + id + '/2']: 1 })]); });
    assert.deepEqual(tries, ['no', 'no']);
    const bad = await own.eval(async () => { const F = window.__GLD.fb(), D = F.m.database, id = window.__GPOLL.open(); try { await D.update(D.ref(F.db), { ['pollVotes/' + id + '/gPoA1']: '3', ['pollTally/' + id + '/3']: 1 }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(bad, 'no', 'an answer the poll does not have');
    assert.equal(await tally(b), '{"1":1}');
    for (const g of [own, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
