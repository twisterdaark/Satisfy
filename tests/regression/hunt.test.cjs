'use strict';
// SAT-ONLINE-124 (plan U189, "seasonal world boss: event schedule, opt-in region transport") over the fake Firebase with
// the rules' checks. Saturday 19:00 UTC, week 1 of the season: Trauka's hunt. Ahmed kills the dragon at 18:35, so its
// shared timer runs to 19:05; the hunt is in the calendar, told 10 minutes before, and Bassem joins it from the calendar
// (not below level 180) and lands by the lair. At 19:00 the dragon is back on both screens, the old timer set aside.
// Ahmed kills it in the hunt: the title and one hunt mark, once however often the kill reaches the game; the rules refuse
// its timer while the old one runs, and it is written again after 19:05, so Bassem, gone back home, sees it dead.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const MIN = 60000, WK = 604800000, LOCK_E = Date.UTC(1970, 0, 5);
// the first Saturday 19:00 UTC from 2026-01-05 in week 1 of a ten-week season (Trauka's)
const W = Math.ceil((Date.UTC(2026, 0, 5) - LOCK_E) / WK / 10) * 10, T = LOCK_E + W * WK + 5 * 86400000 + 19 * 3600000;

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
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; window.__toastNew = []; const box = document.getElementById('toasts'); new MutationObserver((ms) => { window.__toastSeen += '|' + box.textContent; for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__toastNew.push(n.textContent); }).observe(box, { childList: true, subtree: true, characterData: true }); });
const goTo = (g, t) => g.eval((x) => { if (!window.__now0) window.__now0 = Date.now; const b = window.__now0; window.__dt = x - b(); Date.now = () => b() + window.__dt; }, t);
const dragon = (g) => g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'trauka'); return { dead: !!m.dead, rt: m.rt || 0, d: Math.hypot(G.P.x - m.sx, G.P.y - m.sy)}; });
const kill = (g) => g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'trauka'); G.P.x = m.x - 60; G.P.y = m.y; m.dead = false; m.hp = 0; window.__GB2.kill(m); });
async function pickOpt(g, re) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  await g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source);
}

test('world boss hunt: on the calendar, joined from it, the boss back for it, the reward once, its timer shared after', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock(T - 25 * MIN)] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gHuA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gHuB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
      await g.eval(() => { window.__G.S.lv = 200; });
      await keepToasts(g);
    }
    const { a, b } = P;
    const h = await a.eval(() => window.__GHUNT.of());
    assert.deepEqual([h.k, h.at, h.end, h.i], ['trauka', T, T + 60 * MIN, 1]);
    const cal = await b.eval(() => window.__GCAL.list().find((e) => e.k === 'huntN'));
    assert.equal(cal.at, T);
    assert.match(cal.l, /^World boss hunt: Trauka the Red Dragon \(season \d+, week 1 of 10\)$/);
    assert.deepEqual(await b.eval(() => window.__GHUNT.opts()), [], 'not open yet');

    // 18:35: Ahmed kills the dragon on the peak; its shared timer runs to 19:05
    for (const g of [a, b]) await goTo(g, T - 25 * MIN);
    await kill(a);
    await until([a], () => !!(window.__GB2.data && window.__GB2.data.trauka));
    const old = await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/wb/trauka'));
    assert.ok(Math.abs(old.at - (T + 5 * MIN)) < 5000, 'back at 19:05');
    await until([b], () => window.__G.mons().find((x) => x.type === 'trauka').dead);
    const home = await b.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));

    // 18:55: told, and the calendar offers the hunt; level 150 is not enough for it, 200 is
    for (const g of [a, b]) await goTo(g, T - 5 * MIN);
    await settle(a, b);
    await until([b], () => /The world boss hunt starts in/.test(window.__toastSeen));
    assert.match(await toasts(b), /The world boss hunt starts in 5 min: Trauka the Red Dragon\. Join it from the calendar/);
    assert.deepEqual(await b.eval(() => window.__GHUNT.opts()), ['Join the hunt: Trauka the Red Dragon (free)']);
    await b.eval(() => { window.__G.S.lv = 150; window.__GHUNT.go(); });
    await settle(b);
    assert.match(await toasts(b), /The hunt for Trauka the Red Dragon is for level 180 and up/);
    await b.eval(() => { window.__G.S.lv = 200; });
    await b.eval(() => window.__GCAL.board()); await b.step(2);
    await pickOpt(b, /Join the hunt: Trauka/);
    await until([b], () => !!(window.__G.S.hunt && window.__G.S.hunt.back) && window.__G.mode === 'play' && Math.hypot(window.__G.P.x - window.__G.mons().find((x) => x.type === 'trauka').sx, window.__G.P.y - window.__G.mons().find((x) => x.type === 'trauka').sy) < 260, 10000);
    const d0 = (await dragon(b)).d;
    assert.ok(d0 > 140 && d0 < 260, 'by the lair, out of its reach: ' + d0);
    assert.match(await toasts(b), /You are at the hunt: Trauka the Red Dragon is close/);
    assert.deepEqual(await b.eval(() => window.__G.S.hunt.back), { x: Math.round(home.x), y: Math.round(home.y), until: T + 90 * MIN });

    // 19:01: the hunt is on and the dragon is back on both screens (Ahmed far from it), though the old timer runs to 19:05
    await a.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'trauka'); G.P.x = m.sx - 420; G.P.y = m.sy; });
    for (const g of [a, b]) await goTo(g, T + MIN);
    await until([a, b], () => /The world boss hunt is on/.test(window.__toastSeen));
    for (const g of [a, b]) assert.match(await toasts(g), /The world boss hunt is on: Trauka the Red Dragon is back at its lair until \d\d:00 \(UTC 20:00\)!/);
    await until([a, b], () => !window.__G.mons().find((x) => x.type === 'trauka').dead, 15000);
    assert.equal(await a.eval((t) => window.__GHUNT.lift('trauka', t), old.at), true, 'the old timer is set aside');
    for (let i = 0; i < 3; i++) { await a.eval(() => window.__GB2.apply()); await settle(a, b); }
    assert.equal((await dragon(a)).dead, false, 'and stays aside: no quiet kill off screen');

    // Ahmed kills it in the hunt: the title and one mark; the same kill again pays nothing; its timer waits for 19:05
    await kill(a);
    await settle(a);
    assert.match(await toasts(a), /You won this week's hunt: Trauka the Red Dragon! Hunt marks: 1/);
    assert.equal(await a.eval(() => window.__G.S.tl.whunt), 1);
    // shown and worn from the status screen (C), like every title (Claude-B, v1.51: the list there missed it)
    assert.equal(await a.eval(() => { window.__GU.openStatus(); return !!document.querySelector('#statusW [data-title="whunt"]'); }), true, 'on the C screen');
    await a.page.keyboard.press('Escape'); await a.step(2);
    assert.equal(await a.mode(), 'play');
    await kill(a);
    await settle(a);
    assert.deepEqual(await a.eval(() => ({ n: window.__G.S.hunt.n, w: Object.keys(window.__G.S.hunt.w) })), { n: 1, w: [String(W)] });
    assert.equal(await a.eval(() => window.__toastNew.filter((x) => /You won this week's hunt/.test(x)).length), 1, 'told once');
    assert.equal(await a.eval(() => typeof window.__GHUNT.re.trauka), 'number', 'refused while the old timer runs: kept for later');
    assert.ok(Math.abs((await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/wb/trauka').at)) - old.at) < 1, 'the old timer still');

    // Bassem goes back from the calendar to where he joined from
    await b.eval(() => window.__GCAL.board()); await b.step(2);
    await pickOpt(b, /Go back to where you were/);
    await until([b], () => !window.__G.S.hunt.back && window.__G.mode === 'play' && Math.hypot(window.__G.P.x - window.__G.mons().find((x) => x.type === 'trauka').sx, window.__G.P.y - window.__G.mons().find((x) => x.type === 'trauka').sy) > 1000, 10000);
    assert.deepEqual(await b.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y })), { x: Math.round(home.x), y: Math.round(home.y) });

    // 19:06: the old timer is over; Ahmed's is written with the same end (19:31) and Bassem, far away, has it dead
    for (const g of [a, b]) await goTo(g, T + 6 * MIN);
    await until([a], () => { const v = window.__fakeRTDB.data.get('world/satisfy/wb/trauka'); return v && v.by === 'gHuA1' && v.at > Date.now() + 20 * 60000; }, 15000);
    const nw = await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/wb/trauka'));
    assert.ok(Math.abs(nw.at - (T + 31 * MIN)) < 60000, 'the hunt kill + 30 min: ' + new Date(nw.at).toISOString());
    assert.equal(await a.eval(() => Object.keys(window.__GHUNT.re).length), 0);
    assert.equal(await a.eval((t) => window.__GHUNT.lift('trauka', t), nw.at), false, 'a kill in the hunt counts');
    await until([b], () => { const m = window.__G.mons().find((x) => x.type === 'trauka'); return m.dead && m.rt > 20 * 60; }, 15000);
    // Claude-B's notes on #160: someone else's kill in the hunt also ends a copy nobody hurt near you (no second kill of
    // your own), not one you are fighting; a timer written before the hunt is set aside whatever its end
    const near = (hurt) => b.eval((h) => { const G = window.__G, m = G.mons().find((x) => x.type === 'trauka'); G.P.x = m.sx - 60; G.P.y = m.sy; m.dead = false; m.dying = 0; m.led = false; m.hp = h ? m.max - 1 : m.max; window.__GB2.apply(); return m.dead; }, hurt); // a copy of its own, not the shared fight's
    assert.equal(await near(true), false, 'a fight of your own goes on');
    assert.equal(await near(false), true, 'an untouched copy goes down');
    assert.equal(await a.eval((t) => window.__GHUNT.lift('trauka', t + 100 * 60000, t - 10 * 60000), T), true, 'written before the hunt, ending far ahead: aside');
    assert.equal(await a.eval((t) => window.__GHUNT.lift('trauka', t + 100 * 60000, t + 2 * 60000), T), false, 'written in the hunt: it counts');
    // not from the arena or the tower
    assert.equal(await b.eval(() => window.__GHUNT.can()), true);

    // after the hour: next week's boss on the calendar, nothing to join or go back to
    for (const g of [a, b]) await goTo(g, T + 61 * MIN);
    await settle(a, b);
    assert.match(await b.eval(() => window.__GCAL.list().find((e) => e.k === 'huntN').l), /^World boss hunt: Storm Lord \(season \d+, week 2 of 10\)$/);
    assert.deepEqual(await b.eval(() => window.__GHUNT.opts()), []);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/wb running/.test(x))), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
