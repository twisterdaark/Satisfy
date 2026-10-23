'use strict';
// U290 Blacksmith expo (SAT-ONLINE-174; plan: "monthly creator show with voting protection", check: "alts don't mass-vote"),
// two pages over the fake Firebase with the rules' checks:
//   - online, the town board has the expo; Ann enters one of her creations, once a season;
//   - Bob sees it with the same stats Ann's page works out, votes once, and both pages see the count; he can't vote twice,
//     nor raise a count alone; Ann can't vote for her own; under level 10 the board says so;
//   - each account's first time online is recorded (firstSeen), at the server's time, once;
//   - last season's champion is crowned the first time its account plays online after it: the title (no effect), the news
//     on the other page, and never twice.
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
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
const keepNotices = (g) => g.eval(() => { window.__annSeen = []; const W = document.getElementById('announce'); new MutationObserver(() => { const s = document.getElementById('anntext').textContent; if (window.__annSeen[window.__annSeen.length - 1] !== s) window.__annSeen.push(s); }).observe(W, { childList: true, subtree: true, characterData: true, attributes: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g); await keepNotices(g);
  return g;
}
const text = (g) => g.eval(() => document.getElementById('dialog').innerText);
const buttons = (g) => g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent));
async function pick(g, re) {
  await until([g], () => !!document.querySelector('#dopts button'));
  const i = (await buttons(g)).findIndex((x) => re.test(x));
  assert.ok(i >= 0, 'no option ' + re + ' in ' + (await buttons(g)).join(' | '));
  await g.page.locator('#dopts button').nth(i).click(); await g.step(3);
}

test('the Blacksmith expo: one entry a season, votes counted once on every page, the champion crowned once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gExA1', 'Ann', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gExB2', 'Bob', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const [g, u] of [[a, 'gExA1'], [b, 'gExB2']]) await g.eval((u) => { const S = window.__G.S; S.lv = 30; window.__fakeRTDB.data.set('profiles/' + u, { lv: 30 }); }, u);
    // Ann's creation (as the anvil makes it)
    await a.eval(() => { window.__G.S.cre = [{ id: 'cx1', ty: 'gs', mats: { blue: 2, ore: 6 }, L: 70, W: 40, C: 10, sl: 5, nm: 'Blue Fang', by: 'Grid' }]; });
    await settle(a, b);
    // the first time online, recorded once at the server's time
    await until([a, b], () => typeof window.__GEXPO.seen === 'number');
    const seen = await a.eval(() => window.__GEXPO.seen);
    await a.eval(() => { window.__GEXPO.again(); window.__GEXPO.tick(); });
    await until([a], () => typeof window.__GEXPO.seen === 'number');
    assert.equal(await a.eval(() => window.__GEXPO.seen), seen, 'not written again');
    const p = await a.eval(() => window.__GEXPO.sea());

    // the board has the expo; Ann enters her creation
    await a.eval(() => window.__G.openBoard());
    for (let i = 0; i < 4 && await a.eval(() => !document.querySelector('#dopts button')); i++) { await a.page.keyboard.press('Enter'); await a.step(2); }
    await pick(a, /🔨 Blacksmith Expo/);
    await until([a], () => /Blacksmith Expo · season/.test(document.getElementById('dialog').innerText) && !!document.querySelector('#dopts button'));
    assert.match(await text(a), /Blacksmith Expo · season/);
    assert.match(await text(a), /No creations on show this season yet/);
    await pick(a, /Enter one of your creations/);
    assert.match(await text(a), /Pick the creation to enter/);
    await pick(a, /Greatsword · Blue Fang|· Blue Fang/);
    await a.page.locator('#cfmY').click(); await a.step(3);
    await until([a], () => /"Blue Fang" is in the Blacksmith Expo!/.test(window.__toastSeen));
    await until([a], () => !!document.querySelector('#dopts button'));
    assert.ok(!(await buttons(a)).some((x) => /Enter one of your creations/.test(x)), 'one entry a season');
    // a second entry, straight to the database: refused
    const again = await a.eval(async (p) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.set(D.ref(F.db, 'expo/' + p + '/gExA1'), { p, n: 'Other', by: 'Ann', ty: 'sw', L: 1, W: 1, C: 1, sl: 1, mats: { ore: 6 }, t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } }, p);
    assert.equal(again, 'no');

    // Bob sees it, with the stats Ann's page works out
    const st = await a.eval(() => { const X = window.__GEXPO.X, e = X.d.e.gExA1; return e && e.n; });
    assert.equal(st, 'Blue Fang');
    await b.eval(() => window.__GEXPO.menu()); await until([b], () => !!document.querySelector('#dopts button'));
    assert.match(await text(b), /1 creations on show/);
    await pick(b, /"Blue Fang" · Ann · ❤ 0/);
    const look = await text(b);
    assert.match(look, /"Blue Fang" · by Ann/);
    assert.match(look, /Materials: .*Blue Orichalcum 2/);
    const sa = await a.eval(() => { window.__GEXPO.look('gExA1'); return document.getElementById('dialog').innerText.split('\n')[2]; });
    assert.equal(look.split('\n')[2], sa, 'the same stats on both pages');
    // under level 10 the board says so
    await b.eval(() => { window.__G.S.lv = 5; });
    await pick(b, /Vote for this creation/);
    await until([b], () => /You need level 10 to vote/.test(window.__toastSeen));
    await b.eval(() => { window.__G.S.lv = 30; });
    await until([b], () => !!document.querySelector('#dopts button'));
    await pick(b, /Vote for this creation/);
    await until([b], () => /Your vote for "Blue Fang" is counted!/.test(window.__toastSeen));
    // both pages: one vote
    await a.eval(() => window.__GEXPO.menu());
    await until([a], () => { const X = window.__GEXPO.X; return X && X.d.t && X.d.t.gExA1 === 1; });
    await until([b], () => /✓ "Blue Fang" · Ann · ❤ 1/.test([...document.querySelectorAll('#dopts button')].map((x) => x.textContent).join('|')));
    // twice, a count alone, your own: refused
    const tries = await b.eval(async (p) => { const F = window.__GLD.fb(), D = F.m.database, w = async (u) => { try { await D.update(D.ref(F.db), u); return 'ok'; } catch (e) { return 'no'; } };
      return Promise.all([w({ ['expoVotes/' + p + '/gExB2']: 'gExA1', ['expoTally/' + p + '/gExA1']: 2 }), w({ ['expoTally/' + p + '/gExA1']: 2 })]); }, p);
    assert.deepEqual(tries, ['no', 'no']);
    const self = await a.eval(async (p) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.update(D.ref(F.db), { ['expoVotes/' + p + '/gExA1']: 'gExA1', ['expoTally/' + p + '/gExA1']: 2 }); return 'ok'; } catch (e) { return 'no'; } }, p);
    assert.equal(self, 'no', 'for your own creation');
    await a.eval(() => window.__GEXPO.look('gExA1'));
    assert.match(await text(a), /This is your creation/);
    assert.ok(!(await buttons(a)).some((x) => /Vote for this creation/.test(x)));

    // last season: Ann's entry had the most votes; she is crowned the first time she plays online after it
    // (as the server holds it: on both pages' copies)
    for (const g of [b, a]) await g.eval((p) => { const d = window.__fakeRTDB.data; d.set('expo/' + (p - 1) + '/gExA1', { p: p - 1, n: 'Old Hammer', by: 'Ann', ty: 'hm', L: 50, W: 50, C: 0, sl: 3, mats: { ore: 6 }, t: 1 });
      d.set('expo/' + (p - 1) + '/gExB2', { p: p - 1, n: 'Bow', by: 'Bob', ty: 'bw', L: 50, W: 50, C: 0, sl: 3, mats: { wood: 5 }, t: 2 }); d.set('expoTally/' + (p - 1) + '/gExA1', 3); d.set('expoTally/' + (p - 1) + '/gExB2', 1); }, p);
    await a.eval(() => window.__GEXPO.again());
    await until([a], () => !!window.__G.S.tl.expoc);
    const won = await a.eval(() => ({ worn: window.__G.S.title, exw: window.__G.S.exw, t: window.__toastSeen }));
    assert.match(won.t, /Your creation "Old Hammer" won the Blacksmith Expo/);
    assert.deepEqual(won.exw, [p - 1]);
    await until([b], () => window.__annSeen.some((s) => /Ann's creation won the Blacksmith Expo/.test(s)));
    // never twice
    await a.eval(() => { window.__toastSeen = ''; window.__GEXPO.again(); });
    await settle(a);
    assert.deepEqual(await a.eval(() => window.__G.S.exw), [p - 1]);
    assert.doesNotMatch(await a.eval(() => window.__toastSeen), /won the Blacksmith Expo/);
    // the board names last season's champion
    await b.eval(() => window.__GEXPO.menu()); await until([b], () => !!document.querySelector('#dopts button'));
    assert.match(await text(b), /Last season's champion: "Old Hammer" by Ann \(3 votes\)/);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
