'use strict';
// SAT-ONLINE-080 (plan U242) over the fake Firebase with the rules' checks: the guild master adds an event; a member sees it
// in G in their time zone and UTC, says "I'm going" (the master sees it), is told 10 minutes before and when it starts, and
// finds it in the Calendar; a member can't add one, an outsider can't sign up, a time in the past is refused; cancelling
// takes it away for everyone.
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
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = (g, re) => g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source);
const dtext = (g) => g.eval(() => document.getElementById('dtext').textContent);
const T0 = Date.UTC(2026, 0, 5, 9, 40, 30), GID = 'g_gEvA1';
const at = (g, mins) => g.eval((m) => { if (!window.__base) window.__base = Date.now; const b = window.__base; Date.now = () => b() + m * 60000; }, mins);

test('guild events: add, see in your time zone, go, reminders, calendar, cancel; the rules keep it to the guild', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE], device: { timezoneId: 'Asia/Tokyo' } }); // UTC+9
  try {
    const a = await signIn(ctx, 'a', 'gEvA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gEvB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gEvC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 200; }); // out of the way of A's card on B
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Planners'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gEvB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });

    // the times offered: in 30 min, 1 h, 2 h, then today/tomorrow at 18, 20, 22 (in this page's time zone)
    const times = await a.eval((n) => window.__GEV.times(n).map((o) => o.l), T0);
    assert.deepEqual(times, ['In 30 min', 'In 1 h 0 min', 'In 2 h 0 min', 'Today 20:00', 'Today 22:00', 'Tomorrow 18:00', 'Tomorrow 20:00', 'Tomorrow 22:00'], '18:40 in Tokyo: today 18:00 is past');
    // a member can't add one; the master can't add one in the past
    const no = (g, v) => g.eval(async ([gid, x]) => { try { await window.__GEV.store().addEvent(gid, 'e_test' + x.k, { title: 'X', at: Date.now() + x.dt, by: Satisfy.local.net().uid, n: 'X' }); return 'ok'; } catch (e) { return 'no'; } }, [GID, v]);
    assert.equal(await no(b, { k: 1, dt: 3600000 }), 'no', 'a member adds no event');
    assert.equal(await no(a, { k: 2, dt: -60000 }), 'no', 'not in the past');

    // A adds one in an hour; B sees it in G
    await a.eval(() => window.__GEV.add('Raid on the Goblin Chief', Date.now() + 3600000));
    await until([b], () => Object.keys(window.__GEV.ev).length === 1);
    await b.eval(() => window.__GEV.list()); await b.step(2);
    await opts(b);
    assert.match(await b.eval(() => document.getElementById('dialog').textContent), /Guild events \(1\) · Raid on the Goblin Chief · 19:4\d \(UTC 10:4\d\), in 1 h 0 min · 0 going/);
    await pick(b, /Raid on the Goblin Chief/); await b.step(2);
    await opts(b); await pick(b, /I'm going/);
    await until([a], () => Object.keys(Object.values(window.__GEV.signs)[0] || {}).length === 1);
    await a.eval(() => window.__GEV.one(Object.keys(window.__GEV.ev)[0])); await a.step(2);
    assert.match(await dtext(a), /Going: Bassem/);
    // an outsider can't sign up
    const eid = await a.eval(() => Object.keys(window.__GEV.ev)[0]);
    const csign = await c.eval(async ([gid, e]) => { try { await window.__GEV.store().sign(gid, e, 'gEvC3', 'Carim'); return 'ok'; } catch (x) { return 'no'; } }, [GID, eid]);
    assert.equal(csign, 'no');

    // 10 minutes before, then at the start; the Calendar has it on its last page
    await at(b, 50.5); await b.step(3);
    assert.match(await toasts(b), /Guild event in 10 minutes: Raid on the Goblin Chief/);
    await at(b, 60.2); await b.step(3);
    assert.match(await toasts(b), /Guild event now: Raid on the Goblin Chief/);
    await b.eval(() => window.__GCAL.board()); await b.step(2);
    for (let i = 0; i < 2; i++) { await b.eval(() => window.__G.advance()); await b.step(2); }
    assert.match(await dtext(b), /^Guild events · Raid on the Goblin Chief: now \(\d+ min left\)$/);
    await b.eval(() => window.__G.advance()); await b.step(2);

    // A cancels: gone for B, and who was going with it
    await a.eval((e) => window.__GEV.store().cancelEvent('g_gEvA1', e), eid);
    await until([b], () => Object.keys(window.__GEV.ev).length === 0 && Object.keys(window.__GEV.signs).length === 0);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildEvents write|guildEvents values|guildEventSign write/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
