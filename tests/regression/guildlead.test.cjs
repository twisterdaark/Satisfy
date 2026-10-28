'use strict';
// SAT-ONLINE-076 (plan U241/U243/U244) over the fake Firebase with the rules' checks: the guild notice reaches a member;
// the rankings list every online guild next to the canon ones; the master hands the guild to an officer (one master at a
// time, and the founder can't free the name after); an officer takes over from a master away 14 days; a master who is not
// the founder disbands and frees the name.
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
// a toast lives 2.6 s of real time: every page keeps the toasts it has shown
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  if (look) await H.newGame(g, look); else await H.continueGame(g); // the character saved in this slot
  await keepToasts(g);
  return g;
}
const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }, LOOK_C = { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 };
const G1 = 'g_gLdA1';
const rk = (g) => g.eval((gid) => { const o = {}; for (const [p, v] of window.__fakeRTDB.data) { const m = p.match(/^guildMembers\/([^/]+)\/([^/]+)$/); if (m && m[1] === gid) o[m[2]] = v.rk; } return o; }, G1);
const master = (g) => g.eval((gid) => (window.__fakeRTDB.data.get('guilds/' + gid) || {}).master || null, G1);
// A invites B from B's card; B joins from the prompt
async function inviteFromCard(a, b, uidB, rank) {
  await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; }, uidB);
  await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
  await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
  await until([b], () => !document.getElementById('guildInv').hidden);
  await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
  await until([b], (r) => { const s = window.__GG.state(); return !!s && s.rank === r; }, 10000, rank);
}

test('online guilds: notice, rankings, handing over, taking over from an absent master, disband by a master who did not found it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gLdA1', 'Ahmed', LOOK_A);
    let b = await signIn(ctx, 'b', 'gLdB2', 'Bassem', LOOK_B);
    const c = await signIn(ctx, 'c', 'gLdC3', 'Carim', LOOK_C);
    for (const [g, dx] of [[b, 20], [c, -20]]) await g.eval((d) => { window.__G.P.x += d; }, dx);
    for (const g of [a, c]) await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Leaders'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await inviteFromCard(a, b, 'gLdB2', 'r');
    await a.eval(() => window.__GG.rank('gLdB2', 'o'));
    await until([b], () => window.__GG.state().rank === 'o');

    // the notice: A writes it; B, in the guild, is told and sees it in G; a second version replaces it
    await a.eval(() => window.__GLD.setNote('Raid on the Goblin Chief at 9 pm'));
    await until([b], () => (window.__GLD.note() || {}).v === 1);
    await settle(a, b);
    assert.match(await toasts(b), /New guild notice from Ahmed: Raid on the Goblin Chief at 9 pm/);
    await b.eval(() => window.__GLD.setNote('Raid moved to 10 pm'));
    await until([a], () => (window.__GLD.note() || {}).v === 2);
    assert.equal(await a.eval(() => window.__GLD.note().n), 'Bassem', 'an officer writes it too');
    // in G: the notice is the panel's last line, with "Write the guild notice"; B's card offers A the handover
    await a.page.keyboard.press('KeyG'); await a.step(2); await a.eval(() => window.__GDW.tab('x')); await a.step(2);
    assert.ok((await a.eval(() => window.__GDW.lines())).includes('📌 Raid moved to 10 pm (Bassem)'), 'the notice is one of the lines in the guild window');
    const opts = await a.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
    assert.ok(opts.includes('Write the guild notice') && opts.includes('Guild rankings'), opts.join(' | '));
    await a.eval(() => window.__GG.members()); await a.step(2);
    for (let i = 0; i < 3 && await a.eval(() => (document.getElementById('dopts').hidden && !document.querySelector('#gwB .gwopts button'))); i++) { await a.eval(() => window.__G.advance()); await a.step(2); }
    await a.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].find((x) => /Bassem/.test(x.textContent)).click()); await a.step(2);
    assert.ok((await a.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].map((x) => x.textContent).join('|'))).includes('Hand the guild to Bassem'));
    await a.page.keyboard.press('Escape'); await a.step(2);

    // rankings: Leaders (5,000 contributed, Lv 2) and C's new guild among the canon ones, a star on your own
    await c.eval(() => window.__GG.create('Others'));
    await until([c], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => window.__GG.contribute(5000));
    await until([a], () => (window.__fakeRTDB.data.get('guildMembers/g_gLdA1/gLdA1') || {}).c === 5000, 15000);
    const line = await a.eval(() => window.__GLD.rank());
    assert.match(line, /^Guild rankings: /);
    assert.match(line, /\d\. ★ Leaders \(Lv 2, 0 land\)/);
    assert.match(line, /\d\. Others \(Lv 1, 0 land\)/);
    assert.ok(line.indexOf('Leaders') < line.indexOf('Others'), 'by level');

    // A hands the guild to B: one master (B), A an officer; A, the founder, can no longer free the name
    await a.eval(() => window.__GLD.hand('gLdB2'));
    await until([a], () => window.__GG.state().rank === 'o');
    await until([b], () => window.__GG.state().rank === 'm');
    assert.equal(await master(a), 'gLdB2');
    assert.deepEqual(await rk(a), { gLdA1: 'o', gLdB2: 'm' });
    assert.match(await toasts(b), /You are the master of Leaders now/);
    const free = await a.eval(async () => { const F = window.__GLD.fb(), D = F.m.database; try { await D.remove(D.ref(F.db, 'guildNames/leaders')); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(free, 'no');
    const two = await a.eval(async () => { const F = window.__GLD.fb(), D = F.m.database, v = window.__fakeRTDB.data.get('guildMembers/g_gLdA1/gLdA1'); try { await D.set(D.ref(F.db, 'guildMembers/g_gLdA1/gLdA1'), { rk: 'm', n: v.n, c: v.c, on: v.on }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(two, 'no', 'no second master');
    await assert.rejects(a.eval(() => window.__GLD.claim()), /rank/, 'B is here: nothing to take over');

    // B stops playing; two weeks later (A's clock) A takes the guild over from B's card
    await b.close();
    await a.eval(() => { const now = Date.now; Date.now = () => now() + 15 * 86400000; });
    await settle(a);
    assert.equal(await a.eval(() => window.__GLD.away()), true);
    await a.eval(() => window.__GLD.claim());
    await until([a], () => window.__GG.state().rank === 'm');
    assert.equal(await master(a), 'gLdA1');
    assert.deepEqual(await rk(a), { gLdA1: 'm', gLdB2: 'o' });

    // A hands it to B again; B comes back and, a master who did not found it, disbands it: the name is free again
    await a.eval(() => window.__GLD.hand('gLdB2'));
    await until([a], () => window.__GG.state().rank === 'o');
    b = await signIn(ctx, 'b', 'gLdB2', 'Bassem', null);
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; }, 15000);
    await b.eval(() => window.__GLD.disband());
    await until([b], () => !window.__fakeRTDB.data.has('guilds/g_gLdA1') && !window.__fakeRTDB.data.has('guildNames/leaders') && !window.__fakeRTDB.data.has('guildNote/g_gLdA1'));
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildNames remove|guildMembers write|guildMembers rk/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
