'use strict';
// SAT-ONLINE-087 (plan U340) over the fake Firebase with the rules' checks: a muted player appeals with "/appeal why", once
// a mute (a second one for the same mute is refused, by the game and by the rules); only the owner and the player read it;
// the owner's "/appeals" shows it with the mute's time and reason, and keeps or lifts the mute; the player is told, once;
// a new mute can be appealed again. Nobody else answers an appeal, and a player who is not muted can't appeal.
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
// every toast shown, once each (a toast fades after 2.6 s of real time, which a slow run can outlast)
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; window.__toastN = []; const box = document.getElementById('toasts'); new MutationObserver((ms) => { window.__toastSeen += '|' + box.textContent; for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.textContent) window.__toastN.push(n.textContent); }).observe(box, { childList: true, subtree: true, characterData: true }); });
const told = (g, re) => g.eval((src) => window.__toastN.filter((x) => new RegExp(src).test(x)).length, re.source);
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
const canRead = (g, p) => g.eval(async (path) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.get(D.ref(F.db, path)); return 'ok'; } catch (e) { return 'no'; } }, p);
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
const sayWorld = (g) => g.eval(async () => { const F = window.__GLD.fb(), D = F.m.database, u = Satisfy.local.net().uid; try { await D.push(D.ref(F.db, 'chat/satisfy'), { from: u, h: window.__fakeRTDB.data.get('accountIds/' + u), text: 'hi', t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } });
// close whatever dialog is open (its last choice, Back and then Close)
async function shut(g) { for (let i = 0; i < 8 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; if (document.getElementById('dopts').hidden || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }

test('appeals: a muted player appeals once a mute, the owner keeps or lifts it, the player is told; private to them', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gApA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gApB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gApC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(own, b, c);

    // not muted: nothing to appeal (and the rules refuse it)
    await type(c, '/appeal let me talk');
    assert.match(await toasts(c), /You are not muted/);
    assert.equal(await write(c, { 'appeals/gApC3': { mt: 1, why: 'x', n: 'Carim', t: 'SV' } }), 'no');

    // muted for 2 hours: B is told how to appeal, appeals, and can't appeal the same mute twice
    await type(own, '/mute Bassem 2 spam');
    await until([b], () => !!window.__GMOD.muted);
    await type(b, 'hello everyone');
    assert.match(await toasts(b), /You are muted in the world chat until \d\d:\d\d · Think it is a mistake\? Type \/appeal and why/);
    await type(b, '/appeal');
    assert.match(await toasts(b), /Type: \/appeal and why you think the mute is a mistake/);
    await type(b, '/appeal I was quoting someone else');
    await until([b], () => /Your appeal went to the game's owner/.test(window.__toastSeen));
    await type(b, '/appeal please');
    await until([b], () => /You already appealed this mute/.test(window.__toastSeen));
    const mt = await b.eval(() => window.__GMOD.muted.t);
    assert.equal(await write(b, { 'appeals/gApB2': { mt, why: 'again', n: 'Bassem', t: 'SV' } }), 'no', 'once a mute');
    assert.equal(await b.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^appeals\//.test(k)).length), 1);

    // private: the player and the owner read it, nobody else
    assert.equal(await canRead(b, 'appeals/gApB2'), 'ok');
    assert.equal(await canRead(c, 'appeals/gApB2'), 'no');
    assert.equal(await canRead(c, 'appeals'), 'no');
    assert.equal(await canRead(own, 'appeals'), 'ok');
    // nobody but the owner answers it
    assert.equal(await write(c, { 'appealDone/gApB2': { mt, a: 'lift', by: 'gApC3', t: 'SV' }, 'mutes/gApB2': null }), 'no');
    assert.equal(await write(b, { 'appealDone/gApB2': { mt, a: 'lift', by: 'gApB2', t: 'SV' } }), 'no');

    // the owner: /appeals -> Bassem's, with the mute's reason -> keep it; B is told once
    await type(c, '/appeals');
    await until([c], () => /Only the game's owner can do that/.test(window.__toastSeen));
    await type(own, '/appeals'); await own.step(2);
    await until([own], () => /Appeals \(1\)/.test(document.getElementById('dialog').textContent));
    assert.ok((await opts(own)).some((x) => /^Bassem: muted until \d\d:\d\d$/.test(x)));
    await pick(own, /Bassem: muted until/); await own.step(2);
    assert.match(await dtext(own), /^Bassem was muted until \d\d:\d\d \(spam\) and says: "I was quoting someone else"$/);
    await opts(own); await pick(own, /Keep the mute/);
    await until([b], () => /Your appeal was turned down: the mute stays until \d\d:\d\d/.test(window.__toastSeen));
    await until([own], () => /No open appeals/.test(document.getElementById('dialog').textContent));
    assert.ok(await b.eval(() => !!window.__GMOD.muted), 'still muted');
    assert.equal(await sayWorld(b), 'no');
    await shut(own);

    // a new mute is a new event: B appeals it, the owner lifts it; B can talk again
    await type(own, '/mute Bassem 3 insults');
    await until([b], () => !!window.__GMOD.muted && window.__GMOD.muted.t !== 0 && window.__GMOD.muted.until - Date.now() > 3 * 3600000 - 120000);
    await type(b, '/appeal it was a joke between friends');
    await until([b], () => { const a = window.__fakeRTDB.data.get('appeals/gApB2'); return !!a && a.mt === window.__GMOD.muted.t; });
    await type(own, '/appeals'); await own.step(2);
    await until([own], () => /Appeals \(1\)/.test(document.getElementById('dialog').textContent));
    await opts(own); await pick(own, /Bassem: muted until/); await own.step(2);
    assert.match(await dtext(own), /\(insults\) and says: "it was a joke between friends"/);
    await opts(own); await pick(own, /Lift the mute/);
    await until([b], () => !window.__GMOD.muted && /Your appeal was accepted: you can talk in the world chat again/.test(window.__toastSeen));
    assert.equal(await sayWorld(b), 'ok');
    assert.equal(await told(b, /Your appeal was turned down/), 1, 'each answer told once');
    assert.equal(await told(b, /Your appeal was accepted/), 1);
    for (const g of [own, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/appeals|appealDone|muted|read appeals/.test(x))), []);
    for (const g of [own, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
