'use strict';
// SAT-ONLINE-137 (plan U335, "content flags: enable data packs by region and player cohort; new quests do not disappear
// midrun") over the fake Firebase with the rules' checks. The game's owner closes the world boss hunt for everyone
// ("/pack hunt off why"): it leaves every player's calendar and can't be joined. The National Competition opens for a
// cohort only ("/pack nat on lv 100 pct 50"): from level 100, half the characters (the same half on every device). A
// quest tagged with a closed pack isn't offered any more, but one already accepted stays and can be finished. Nobody but
// an admin sets a pack, and nobody sets anything else under flags.
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
const ALL = [['gPkM1', 'Owner', true], ['gPkA2', 'Ahmed', false]];
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n, all]) => { const D = window.__fakeRTDB.data; for (const [x, y, adm] of all) { D.set('accountIds/' + x, y); D.set('handles/' + y.toLowerCase(), x); if (adm) D.set('admins/' + x, true); } window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name, ALL]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
  return g;
}
const write = (g, p, v) => g.eval(async ([path, x]) => { const F = window.__GLD.fb(), D = F.m.database; if (x && x.t === 'SV') x.t = D.serverTimestamp(); try { await D.update(D.ref(F.db), { [path]: x }); return 'ok'; } catch (e) { return 'no'; } }, [p, v]);
const calKeys = (g) => g.eval(() => window.__GCAL.list(Date.now()).map((e) => e.k));

test('content packs: closed for everyone, open for a cohort, quests already taken go on; only admins set them', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const m = await signIn(ctx, 'm', 'gPkM1', 'Owner', { n: 'Boss', hair: 1, hc: 2, skin: 1, top: 3 });
    const a = await signIn(ctx, 'a', 'gPkA2', 'Ahmed', { n: 'Grid', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(m, a);
    assert.deepEqual(await a.eval(() => [window.__GSW.pack('hunt'), window.__GSW.pack('nat')]), [true, true], 'unset: on');
    assert.ok((await calKeys(a)).includes('huntN') && (await calKeys(a)).includes('natN'));

    // the hunt closed for everyone, with a reason: off the calendar, not joined, no early boss
    await m.eval(() => window.__GSW.pcmd('/pack hunt off new boss next week'));
    await until([m], () => /The world boss hunt: off/.test(window.__toastSeen));
    const f = await m.eval(() => window.__fakeRTDB.data.get('flags/pk_hunt'));
    assert.deepEqual([f.on, f.why, f.by], [false, 'new boss next week', 'gPkM1']);
    await until([a], () => window.__GSW.pack('hunt') === false && window.__GSW.world('hunt') === false);
    assert.ok(!(await calKeys(a)).includes('huntN'), 'off the calendar');
    await a.eval(() => window.__GHUNT.go()); await a.step(2);
    assert.equal(await a.eval(() => window.__G.S.hunt && window.__G.S.hunt.back), undefined, 'not joined');
    await m.eval(() => window.__GSW.pcmd('/pack')); await m.step(2);
    await until([m], () => /Content packs: The world boss hunt: off \(new boss next week\) · The National Competition: on/.test(document.getElementById('dialog').textContent));
    await m.eval(() => window.__G.advance()); await m.step(2);

    // the competition for a cohort: level 100 and up, half the characters
    await m.eval(() => window.__GSW.pcmd('/pack nat on lv 100 pct 50'));
    await until([a], () => { const f = window.__GSW.sw.pk_nat; return !!f && f.lv === 100 && f.pct === 50; });
    assert.equal(await a.eval(() => window.__GSW.pack('nat')), false, 'level 1: not yet');
    assert.equal(await a.eval(() => window.__GSW.world('nat')), true, 'but not closed for all');
    await a.eval(() => { window.__G.S.lv = 150; });
    const b = await a.eval(() => window.__GSW.bucket());
    assert.equal(await a.eval(() => window.__GSW.pack('nat')), b < 50, 'level 150: by the half the character is in (' + b + ')');
    assert.equal(await a.eval(() => window.__GSW.bucket()), b, 'the same half every time');
    assert.equal((await calKeys(a)).includes('natN'), b < 50);

    // a quest tagged with a closed pack: not offered; one already taken stays and goes on
    const qids = await a.eval(() => Object.keys(window.__G.QD).filter((k) => window.__GC2.avail(k)).slice(0, 2));
    assert.equal(qids.length, 2, 'two quests on offer: ' + qids);
    await a.eval(([x, y]) => { const QD = window.__G.QD; QD[x].pack = 'hunt'; QD[y].pack = 'hunt'; window.__G.S.qs[y] = { st: 1, n: 0 }; }, qids);
    // (the hunt is closed at this point)
    assert.equal(await a.eval((x) => window.__GC2.avail(x), qids[0]), false, 'a new one of a closed pack is not offered');
    assert.deepEqual(await a.eval((y) => window.__G.S.qs[y], qids[1]), { st: 1, n: 0 }, 'one taken before stays');

    // only admins set packs, and only packs and switches go under flags
    assert.equal(await write(a, 'flags/pk_hunt', { on: true, by: 'gPkA2', t: 'SV' }), 'no', 'not a player');
    assert.equal(await write(m, 'flags/pk_HUNT', { on: true, by: 'gPkM1', t: 'SV' }), 'no', 'a pack name is lower case');
    assert.equal(await write(m, 'flags/chat', { on: true, lv: 5, by: 'gPkM1', t: 'SV' }), 'no', 'a cohort only for a pack');
    assert.equal(await write(m, 'flags/pk_nat', { on: true, pct: 101, by: 'gPkM1', t: 'SV' }), 'no', 'a share up to 100%');
    assert.equal(await write(m, 'flags/pk_hunt', { on: true, by: 'gPkM1', t: 'SV' }), 'ok', 'the owner opens it again');
    await until([a], () => window.__GSW.pack('hunt') === true);
    assert.ok((await calKeys(a)).includes('huntN'), 'back on the calendar');
    for (const g of [m, a]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/flags/.test(x))), []);
    for (const g of [m, a]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
