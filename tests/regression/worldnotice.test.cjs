'use strict';
// SAT-ONLINE-041 (owner 2026-10-19): a "World Notice" reaches every player online at the same moment and also stays in the
// chat; a player who joins mid-event gets a short line instead of a notice as if it had just begun; your own moments say
// "Notice", not "World Notice"; an invasion captain is told to everyone, not only to the players at the town.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(5); await games[0].page.waitForTimeout(30); }
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
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  return g;
}
// the clock moved to `ms` after the start of the next Winston invasion (every page gets the same shift)
async function eventClock(games, ms) {
  const at = await games[0].eval(() => {
    const EVS = 15 * 60 * 1000;
    let slot = Math.floor(Date.now() / EVS) + 1;
    while (((slot * 2654435761) >>> 0) % 9 !== 0) slot++; // EVT[0]: the invasion of Winston (9 events since the Defense War)
    return slot * EVS;
  });
  for (const g of games) await g.eval(([t0, d]) => { if (!window.__realNow) window.__realNow = Date.now.bind(Date); const off = t0 + d - window.__realNow(); Date.now = () => window.__realNow() + off; }, [at, ms]);
}
const notice = (g) => g.eval(() => { const W = document.getElementById('announce'); return W.hidden ? null : { head: W.querySelector('.head').textContent, text: document.getElementById('anntext').textContent }; });
const chatSys = (g) => g.eval(() => window.__GN.chat().filter((l) => l.ch === 'sys').map((l) => l.text));

test('a world event starts for everyone at once, also in the chat; a late joiner gets a line; your own notice is "Notice"', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gWnA1', 'Ahmed'), b = await online(ctx, 'b', 'gWnB2', 'Bassem');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 3000; }); // far from A and from Winston
    await eventClock([a, b], -60000); // a quiet minute before it (no event of the real clock in the way)
    await settle(a, b); await a.page.waitForTimeout(600); await settle(a, b);
    await eventClock([a, b], 1000);
    await until([a, b], () => !document.getElementById('announce').hidden);
    const na = await notice(a), nb = await notice(b);
    assert.deepEqual(na, { head: 'World Notice', text: "Goblin invasion! Goblins are attacking Winston's west gate." });
    assert.deepEqual(nb, na, 'the same notice for both');
    for (const g of [a, b]) assert.ok((await chatSys(g)).some((x) => x.includes(na.text)), 'it stays in the chat too');

    // a third player comes in a minute later: a short line, no notice as if it had just begun
    const c = await online(ctx, 'c', 'gWnC3', 'Celine');
    await eventClock([c], 60000);
    await H.newGame(c, { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(c);
    assert.equal(await notice(c), null, 'no World Notice for a late joiner');
    assert.match(await c.eval(() => document.getElementById('toasts').textContent), /is on now/);

    // your own moment: "Notice", and not in anyone's chat
    await a.eval(() => window.__GN.announce('Your Sword broke!', 1));
    assert.equal((await notice(a)).head, 'Notice');
    assert.ok(!(await chatSys(a)).some((x) => /Sword/.test(x)));
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('an invasion captain is told to everyone online, also those far from the town', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gCpA1', 'Ahmed'), b = await online(ctx, 'b', 'gCpB2', 'Bassem');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 3000; });
    await eventClock([a, b], -60000);
    await a.eval(() => { const T = window.__GU.TOWNS.find((x) => x.k === 'zWin'); window.__G.P.x = T.rx * 16 + 8; window.__G.P.y = T.ry * 16 + 40; window.__G.P.inv = 1e9; });
    await settle(a, b);
    // the third wave (a captain) is due: 2 s + 2 waves of 30 s after the start
    await eventClock([a, b], 2000 + 2 * 30000 + 500);
    await until([a], () => /captain/i.test(document.getElementById('anntext').textContent) && !document.getElementById('announce').hidden, 15000);
    await until([b], () => /captain/i.test(document.getElementById('anntext').textContent) && !document.getElementById('announce').hidden, 15000);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
    // once per wave: no second notice when the news comes back to A, or from another player at the town
    await settle(a, b);
    assert.equal((await chatSys(a)).filter((x) => /captain/i.test(x)).length, 1, 'A told it once');
    assert.equal((await chatSys(b)).filter((x) => /captain/i.test(x)).length, 1, 'B got it once');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
