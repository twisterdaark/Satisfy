'use strict';
// SAT-ONLINE-079 (plan U336/U337) over the fake Firebase with the rules' checks: the owner's account (admins/{uid} = true,
// set in the console) types "/announce" and every player online sees a world notice "From the game's owner", once, also
// after a reload; a player who comes online within ten minutes sees it too; nobody else can post one, from the chat or with
// a direct write; "/maint 15" announces maintenance with toasts before it and a save when it starts.
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
const notice = (g) => g.eval(() => { const W = document.getElementById('announce'); return W.hidden ? null : W.querySelector('.head').textContent + ' | ' + document.getElementById('anntext').textContent; });
const posts = (g) => g.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^announce\//.test(k)).length);

test('owner announcements and maintenance notices; nobody else can post', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gAnA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    let b = await signIn(ctx, 'b', 'gAnB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(own, b);

    // a player can't: the chat says so and posts nothing; a direct write is refused by the rules
    await type(b, '/announce free gold for everyone');
    await until([b], () => /Only the game's owner can do that/.test(window.__toastSeen));
    const forged = await b.eval(async () => { const F = window.__GLD.fb(), D = F.m.database; try { await D.push(D.ref(F.db, 'announce'), { k: 'msg', ar: 'x', en: 'x', by: 'gAnB2', t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(forged, 'no');
    assert.equal(await posts(b), 0);

    // the owner announces: B sees it once, headed "From the game's owner"
    assert.deepEqual(await own.eval(() => window.__fakeRTDB.log.filter((l) => /^admins\//.test(l.path)).length), 0, 'nobody reads admins before trying');
    await type(own, '/announce Double XP weekend starts now!');
    await until([b], () => !document.getElementById('announce').hidden);
    assert.equal(await notice(b), "From the game's owner | Double XP weekend starts now!");
    assert.match(await toasts(own), /The announcement went out to everyone/);
    // a player who comes online a little later sees it too; after a reload it is not shown again
    const c = await signIn(ctx, 'c', 'gAnC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await until([c], () => /From the game's owner \| Double XP weekend starts now!/.test(window.__annSeen.join('\n')));
    assert.equal((await c.eval(() => window.__GANN.seen())).length, 1);
    await c.close();
    const c2 = await signIn(ctx, 'c', 'gAnC3', 'Carim', null);
    await settle(c2);
    assert.doesNotMatch(await notices(c2), /Double XP/, 'seen already: not again');

    // maintenance in 15 minutes: the notice now, toasts at 10, 5 and 1 minutes, a save when it starts
    await type(own, '/maint 15 Server update');
    await until([b], () => !!window.__GANN.maint);
    assert.match(await notice(b), /^From the game's owner \| Server maintenance at \d\d:\d\d \(in 15 min\): Server update$/);
    for (const [mins, want] of [[5.5, /Maintenance in 10 min/], [10.5, /Maintenance in 5 min/], [14.5, /Maintenance in 1 min/]]) {
      await b.eval((m) => { if (!window.__realNow0) window.__realNow0 = Date.now; const base = window.__realNow0; Date.now = () => base() + m * 60000; }, mins);
      await b.step(3);
      assert.match(await toasts(b), want);
    }
    await b.eval(() => { const base = window.__realNow0; Date.now = () => base() + 15.2 * 60000; });
    await b.step(3);
    assert.equal(await b.eval(() => window.__GANN.maint), null);
    assert.match(await notice(b), /Maintenance has started\. Your progress is saved/);
    await type(own, '/maint');
    assert.match(await toasts(own), /Type: \/maint minutes message/);
    for (const g of [own, b, c2]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/announce/.test(x))), []);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected.filter((x) => /announce/.test(x)).length), 1, 'only the forged write');
    for (const g of [own, b, c2]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
