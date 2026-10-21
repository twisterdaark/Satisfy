'use strict';
// SAT-ONLINE-082 (plan U339/U341/U383/U227) over the fake Firebase with the rules' checks: a player reports another; only
// the owner (admin) reads reports and crash reports; "/reports" mutes the reported player for a day from the report and
// resolves it; a muted player is told and can't post in the world chat (the rules refuse it too); "/unmute" and "/mute ID
// hours"; a page's crash reports are cut of long ids and e-mails, at most three a session; "/economy" from the rankings.
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
const pick = (g, re) => g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source);
const dtext = (g) => g.eval(() => document.getElementById('dtext').textContent);
const sayWorld = (g) => g.eval(async () => { const F = window.__GLD.fb(), D = F.m.database, u = Satisfy.local.net().uid; try { await D.push(D.ref(F.db, 'chat/satisfy'), { from: u, h: window.__fakeRTDB.data.get('accountIds/' + u), text: 'hi', t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } });
const canRead = (g, p) => g.eval(async (path) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.get(D.ref(F.db, path)); return 'ok'; } catch (e) { return 'no'; } }, p);

test('moderation: reports to the owner, mute from a report, muted out of the world chat, unmute; crash reports; economy', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gMdA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gMdB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gMdC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(own, b, c);

    // C reports B; nobody but the owner reads reports
    await c.eval(() => Satisfy.firebase.reportStore(window.__GLD.fb()).report({ by: 'gMdC3', byN: 'Carim', about: 'gMdB2', aboutN: 'Bassem', why: 'abuse', said: 'you are all bad at this' }));
    assert.equal(await canRead(b, 'reports'), 'no');
    assert.equal(await canRead(c, 'crashes'), 'no');
    await type(c, '/reports');
    await until([c], () => /Only the game's owner can do that/.test(window.__toastSeen));

    // the owner: /reports -> the report -> mute Bassem for a day (and the report is resolved)
    await type(own, '/reports'); await own.step(2);
    await until([own], () => /Open reports \(1\)/.test(document.getElementById('dialog').textContent));
    assert.ok((await opts(own)).includes('Bassem: insults'));
    await pick(own, /Bassem: insults/); await own.step(2);
    await until([own], () => /Carim reported Bassem/.test(document.getElementById('dialog').textContent));
    assert.match(await dtext(own), /Carim reported Bassem \(insults\) · their last lines: "you are all bad at this"/);
    await opts(own); await pick(own, /Mute Bassem for a day/);
    await until([own], () => window.__fakeRTDB.data.has('mutes/gMdB2') && Object.keys(Object.fromEntries([...window.__fakeRTDB.data].filter(([k]) => /^reportDone\//.test(k)))).length === 1);
    assert.match(await toasts(own), /Bassem is muted until \d\d:\d\d/);
    // B is told, and the rules refuse a direct world line
    await until([b], () => !!window.__GMOD.muted);
    await type(b, 'hello everyone');
    assert.match(await toasts(b), /You are muted in the world chat until \d\d:\d\d/);
    assert.equal(await sayWorld(b), 'no');
    assert.equal(await sayWorld(c), 'ok', 'others still talk');
    // B can't unmute itself; the owner unmutes, then mutes again for 2 hours
    const self = await b.eval(async () => { try { await window.__GMOD.store().unmute('gMdB2'); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(self, 'no');
    await type(own, '/unmute Bassem');
    await until([b], () => !window.__GMOD.muted);
    assert.equal(await sayWorld(b), 'ok');
    await type(own, '/mute Bassem 2 spam');
    await until([b], () => !!window.__GMOD.muted && window.__GMOD.muted.until - Date.now() > 7100000);
    await type(own, '/mute Nobody 2');
    await until([own], () => /No player with the ID Nobody/.test(window.__toastSeen));

    // crash reports: cut of long ids and e-mails, at most three a session; the owner lists them
    const red = await c.eval(() => window.__GMOD.redact('token AbCdEfGhIjKlMnOpQrStUvWxYz123456 from me@mail.com at file:///home/x/index.html:12'));
    assert.equal(red, 'token … from … at file');
    for (let i = 1; i <= 5; i++) await c.eval((k) => window.__GMOD.crash('TypeError ' + k + ' in gMdC3abcdefghijklmnopqrstu', 'at f (file:///x/index.html:1:2)'), i);
    await settle(own, c);
    assert.equal(await c.eval(() => window.__GMOD.sent), 3);
    const crashes = await own.eval(() => [...window.__fakeRTDB.data].filter(([k]) => /^crashes\//.test(k)).map(([, v]) => v));
    assert.equal(crashes.length, 3);
    assert.ok(crashes.every((x) => x.by === 'gMdC3' && !/gMdC3abcdef/.test(x.m) && x.s === 'at f (file)'), JSON.stringify(crashes[0]));
    await type(own, '/crashes'); await own.step(2);
    await until([own], () => /Crash reports \(3\)/.test(document.getElementById('dialog').textContent));
    assert.match(await dtext(own), /· TypeError \d in … \(/);
    await own.eval(() => window.__G.advance()); await own.step(2);

    // the economy from the rankings
    await type(own, '/economy'); await own.step(2);
    await until([own], () => /Economy \(\d+ ranked players\)/.test(document.getElementById('dialog').textContent));
    assert.match(await dtext(own), /^Economy \(\d+ ranked players\): total [\d,]+ gold · median [\d,]+ · top 10% from [\d,]+ · richest [\d,]+ · average level \d+$/);
    assert.deepEqual(await own.eval(() => window.__GMOD.eco({ a: { v: 10 }, b: { v: 30 }, c: { v: 20 }, d: { v: 1000 } }, { a: { v: 2 }, b: { v: 4 } })), { n: 4, total: 1060, median: 30, p90: 1000, max: 1000, lv: 3 });
    for (const g of [own, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/muted|mutes admins only|read reports|read crashes/.test(x))), []);
    for (const g of [own, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
