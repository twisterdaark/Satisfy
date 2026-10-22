'use strict';
// SAT-ONLINE-125 (plan U343, "community feedback triage") over the fake Firebase with the rules' checks. Bassem types
// "/bug ..." twice: the second within 2 minutes waits (and the rules refuse it after a reload too); two crash reports with
// the same message are one group. The owner's "/bugs" lists them; Carim's report of the same thing is tagged as the same
// as Bassem's and merged with both reporters; the crash group is fixed, comes back when the same crash arrives again; a
// month later the closed reports are cleared. Players can't read the reports or tag them.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const MIN = 60000;
async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
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
const pick = (g, re) => g.eval((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)); if (!b) throw new Error('no option ' + src); b.click(); }, re.source);
const dtext = (g) => g.eval(() => document.getElementById('dtext').textContent);
const goTo = (g, t) => g.eval((x) => { if (!window.__now0) window.__now0 = Date.now; const b = window.__now0; window.__dt = x - b(); Date.now = () => b() + window.__dt; }, t);
const canRead = (g, p) => g.eval(async (path) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.get(D.ref(F.db, path)); return 'ok'; } catch (e) { return 'no'; } }, p);
const bugsIn = (g) => g.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^bugs\//.test(k)).length);
async function openBugs(own) {
  await own.eval(() => window.__GBUG.open());
  await until([own], () => window.__G.mode === 'dialog');
  return opts(own);
}

test('bug reports: sent by players at most every 2 minutes, triaged by the owner, duplicates merged, fixed, cleared', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gBgA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gBgB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gBgC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(own, b, c);
    const t0 = await own.eval(() => Date.now());

    // Bassem types it in the chat; too short is refused; a second one within 2 minutes waits, here and in the rules
    await type(b, '/bug ok');
    assert.match(await toasts(b), /Type: \/bug and what went wrong/);
    await type(b, '/bug The shop window stays open after I die, mail me at me@example.com');
    await until([b], () => /Thanks! Your report went to the game's owner/.test(window.__toastSeen));
    await b.eval(() => window.__GBUG.send('Another one right away'));
    assert.match(await toasts(b), /One report every 2 minutes/);
    await b.eval(() => { window.__GBUG.reset(); window.__GBUG.send('Another one after a reload'); });
    await until([b], () => window.__fakeRTDB.rejected.some((x) => /bugs too soon/.test(x)));
    await until([own], () => [...window.__fakeRTDB.data.keys()].filter((k) => /^bugs\//.test(k)).length === 1);
    const sent = await own.eval(() => { const D = window.__fakeRTDB.data, k = [...D.keys()].find((x) => /^bugs\//.test(x)); return D.get(k); });
    assert.equal(sent.s, 'The shop window stays open after I die, mail me at …', 'an e-mail is cut out');
    assert.deepEqual([sent.by, sent.n, typeof sent.v, typeof sent.z], ['gBgB2', 'Bassem', 'string', 'string']);

    // Carim reports the same thing; two crashes with one message (line numbers aside) from Bassem's page
    await c.eval(() => window.__GBUG.send('shop stays open when dead'));
    await until([c], () => /Thanks! Your report went/.test(window.__toastSeen));
    await b.eval(() => { window.__GMOD.crash('TypeError: x is undefined at 4021', 'TypeError\n at draw (index.html:4021)'); window.__GMOD.crash('TypeError: x is undefined at 4377', 'TypeError\n at draw (index.html:4377)'); });
    await until([own], () => [...window.__fakeRTDB.data.keys()].filter((k) => /^crashes\//.test(k)).length === 2 && [...window.__fakeRTDB.data.keys()].filter((k) => /^bugs\//.test(k)).length === 2);

    // players can't read the reports or tag them
    for (const g of [b, c]) { assert.equal(await canRead(g, 'bugs'), 'no'); assert.equal(await canRead(g, 'bugTriage'), 'no'); }
    const tagAs = (g, key, s) => g.eval(async ([k, x]) => { try { await window.__GBUG.store().tag(k, x, Satisfy.local.net().uid); return 'ok'; } catch (e) { return 'no'; } }, [key, s]);
    assert.equal(await tagAs(c, 'b_x', 'fixed'), 'no');
    await type(c, '/bugs'); await settle(c);
    assert.match(await toasts(c), /admin|owner/i);

    // the owner's list: the crash group ×2 first, then the two reports
    let o = await openBugs(own);
    assert.match(await dtext(own), /^Bug reports and crashes: 3 open \(0 actionable\) · 0 fixed · 0 not a bug$/);
    assert.equal(o[0], '🆕 TypeError: x is undefined at # ×2');
    assert.deepEqual(o.slice(1, 3).sort(), ['🆕 The shop window stays open after I die, mail me ×1', '🆕 shop stays open when dead ×1']);
    assert.ok(o.includes('Close'));

    // Carim's is the same as Bassem's: merged, with both reporters
    await pick(own, /shop stays open when dead/); await own.step(2);
    assert.match(await dtext(own), /^Bug report \(🆕 new\): "shop stays open when dead" · ×1 · players: 1 · build [^·]+ · [^·]+ · first /);
    await opts(own); await pick(own, /The same as another report/); await own.step(2);
    await opts(own); await pick(own, /The shop window stays open/);
    await until([own], () => /Merged into "The shop window stays open/.test(window.__toastSeen));
    await until([own], () => window.__G.mode === 'dialog');
    assert.match(await dtext(own), /^Bug reports and crashes: 2 open/);
    const merged = await own.eval(() => window.__GBUG.groups().find((g) => g.kind === 'bug'));
    assert.deepEqual([merged.n, merged.items.map((i) => i.n), merged.merged.length], [2, ['Bassem', 'Carim'], 1]);
    await opts(own); await pick(own, /The shop window stays open/); await own.step(2);
    assert.match(await dtext(own), /×2 · players: 2/);
    await own.eval(() => window.__G.advance()); await own.step(2);
    assert.match(await dtext(own), /^Carim \([^)]*\) [\d/]+ \d\d:\d\d: "shop stays open when dead" · Bassem \([^)]*\) [\d/]+ \d\d:\d\d: "The shop window stays open/);
    await opts(own); await pick(own, /^(\d+\.\s*)?Actionable$/);
    await until([own], () => /Tagged: actionable/.test(window.__toastSeen));

    // the crash group is fixed: closed; the same crash again brings it back
    await until([own], () => window.__G.mode === 'dialog');
    await opts(own); await pick(own, /TypeError: x is undefined/); await own.step(2);
    assert.match(await dtext(own), /^Crash \(🆕 new\): "TypeError: x is undefined at #" · ×2 · players: 1/);
    await opts(own); await pick(own, /^(\d+\.\s*)?Fixed$/);
    await until([own], () => /Tagged: fixed/.test(window.__toastSeen));
    await until([own], () => window.__G.mode === 'dialog');
    assert.match(await dtext(own), /^Bug reports and crashes: 1 open \(1 actionable\) · 1 fixed · 0 not a bug$/);
    assert.ok((await opts(own)).includes('Show the closed ones too (1)'));
    await own.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; o[o.length - 1].click(); }); await own.step(2);
    await goTo(b, t0 + 5 * MIN); await goTo(own, t0 + 5 * MIN);
    await b.eval(() => window.__GMOD.crash('TypeError: x is undefined at 9999', 'TypeError\n at draw (index.html:9999)'));
    await until([own], () => [...window.__fakeRTDB.data.keys()].filter((k) => /^crashes\//.test(k)).length === 3);
    await openBugs(own);
    assert.match(await dtext(own), /^Bug reports and crashes: 2 open \(1 actionable\) · 0 fixed/);
    assert.ok((await opts(own)).some((x) => /^🔁 TypeError: x is undefined at # ×3$/.test(x)), 'back after the fix');
    await own.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; o[o.length - 1].click(); }); await own.step(2);

    // a month later, with Bassem's report fixed too: the closed reports (both merged ones) are cleared, crashes stay
    assert.equal(await own.eval((k) => window.__GBUG.store().tag(k, 'fixed', 'gBgA1').then(() => 'ok', () => 'no'), merged.key), 'ok');
    await goTo(own, t0 + 31 * 86400000);
    o = await openBugs(own);
    assert.ok(o.includes('Clear the closed reports older than 30 days (2)'), o.join(' | '));
    await pick(own, /Clear the closed reports/);
    await until([own], () => /Cleared 2 reports/.test(window.__toastSeen));
    assert.equal(await bugsIn(own), 0);
    assert.equal(await own.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^crashes\//.test(k)).length), 3);

    assert.deepEqual(await own.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected.filter((x) => !/bugs too soon/.test(x))), []);
    assert.deepEqual(await c.eval(() => window.__fakeRTDB.rejected.filter((x) => !/bugTriage admins only|read bug/.test(x))), []);
    for (const g of [own, b, c]) assert.deepEqual(g.errors.filter((e) => !/TypeError: x is undefined/.test(e)), []);
  } finally { await ctx.close(); }
});
