'use strict';
// SAT-ONLINE-071 (plan U062): reporting a player and the word filter, online over the fake Firebase with the rules' checks.
// B says something rude in world chat: A sees the insult as stars; A reports B from the card (the report holds what B
// said); a second report soon after is held back; /filter shows the words as they are.
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
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  return g;
}
async function say(g, text) { await g.page.keyboard.press('Enter'); await g.step(1); await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2); }
const lines = (g) => g.eval(() => [...document.querySelectorAll('#chatL div')].map((d) => d.textContent));

test('online: insults show as stars; Report on the card sends why and what they said; /filter turns it off', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await signIn(ctx, 'a', 'gRpA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gRpB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await say(b, 'you are a fucking noob');
    await until([a], () => [...document.querySelectorAll('#chatL div')].some((d) => /Bassem: you are a ★★★★★★★ noob/.test(d.textContent)));
    assert.ok((await lines(b)).some((l) => /you are a fucking noob/.test(l)), 'your own line is not changed');
    // Report from the card: why, and what they said
    await a.page.keyboard.press('KeyT'); await a.step(2);
    assert.equal(await a.eval(() => document.getElementById('pctxR').hidden), false);
    await a.eval(() => document.getElementById('pctxR').click()); await a.step(2);
    assert.match(await a.eval(() => document.getElementById('dialog').textContent), /Why report Bassem\?/);
    await a.eval(() => { window.__G.advance(); }); await a.step(2);
    const opts = await a.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent));
    assert.ok(opts.includes('2. Insults or harassment'), opts.join(' / '));
    await a.eval(() => [...document.querySelectorAll('#dopts button')].find((x) => x.textContent === '2. Insults or harassment').click());
    await until([a], () => /You reported Bassem/.test(document.getElementById('toasts').textContent));
    const rep = await a.eval(() => { const k = [...window.__fakeRTDB.data.keys()].find((x) => x.startsWith('reports/')); return k && window.__fakeRTDB.data.get(k); });
    assert.deepEqual([rep.by, rep.about, rep.aboutN, rep.why, rep.said], ['gRpA1', 'gRpB2', 'Bassem', 'abuse', 'you are a ★★★★★★★ noob']);
    assert.equal(await b.eval(() => [...window.__fakeRTDB.data.keys()].filter((x) => x.startsWith('reports/')).length), 1, 'it reaches the database');
    // again soon: held back
    await a.eval(() => window.__GRP.ask('gRpB2')); await a.step(2);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /You reported Bassem a moment ago/);
    // /filter off: the words as they are
    await say(a, '/filter');
    assert.equal(await a.eval(() => window.__GRP.filter), false);
    await b.step(60); // B's own clock: a second line is not "too fast"
    await say(b, 'shit happens');
    await until([a], () => [...document.querySelectorAll('#chatL div')].some((d) => /Bassem: shit happens/.test(d.textContent)));
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
