'use strict';
// U297 Town notice board (SAT-ONLINE-200; plan: "approved event announcements", checked by "no phishing external links"):
//   - online, every town board lists the game owner's announcements of the last 14 days, newest first, each on its page;
//   - a web address in one shows as [link] on the board; plain words stay as they are;
//   - nobody else can post one (the rules); offline the board has no notices.
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

const board = (g) => g.eval(() => { window.__GNTC.board(); return [...document.querySelectorAll('#dopts button')].map((x) => x.textContent); });
async function pages(g) { const out = []; for (let i = 0; i < 8; i++) { out.push(await g.eval(() => document.getElementById('dtext').textContent)); if (await g.eval(() => !!document.querySelector('#dopts button'))) break; await g.page.keyboard.press('Enter'); await g.step(2); } return out; }

test('the town notice board: the owner\'s announcements, newest first, links shown as [link]', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gNtA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gNtB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(own, b);
    // nothing posted yet: no notices on the board
    assert.ok(!(await board(b)).some((l) => /Notices/.test(l)), 'no notices yet');
    await b.eval(() => window.__G.closeDialog && window.__G.closeDialog());
    // a player can't post one: the rules refuse it
    const forged = await b.eval(async () => { const F = window.__GLD.fb(), D = F.m.database; try { await D.push(D.ref(F.db, 'announce'), { k: 'msg', ar: 'x', en: 'x', by: 'gNtB2', t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(forged, 'no');
    // the owner posts two
    await type(own, '/announce The lantern festival starts Friday at 9 pm');
    await own.page.waitForTimeout(50);
    await type(own, '/announce Prizes at https://evil.example.com/claim and www.free-gold.net, ask in game.gg too');
    await until([b], () => window.__GNTC.list().length === 2);
    const opts = await board(b);
    assert.ok(opts.some((l) => /📜 Notices \(2\)/.test(l)), JSON.stringify(opts));
    await b.eval(() => window.__GNTC.open()); await b.step(2);
    const P = await pages(b);
    assert.match(P[0], /Prizes at \[link\] and \[link\], ask in \[link\] too/, 'newest first, the addresses gone: ' + P[0]);
    assert.ok(!/https?:|www\.|evil\.example|free-gold|game\.gg/.test(P.join(' ')), 'no address left: ' + P.join(' | '));
    assert.match(P[1], /The lantern festival starts Friday at 9 pm/);
    // plain words with dots stay
    assert.equal(await b.eval(() => window.__GNTC.text('Meet at 9.30 near the inn, e.g. Winston. Bring 2.5 gold')), 'Meet at 9.30 near the inn, e.g. Winston. Bring 2.5 gold');
    assert.deepEqual(own.errors, []); assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('offline the board has no notices', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    assert.ok(!(await board(g)).some((l) => /Notices/.test(l)));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
