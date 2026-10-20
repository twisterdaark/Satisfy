'use strict';
// SAT-ONLINE-073 (plan U185): the group finder, over the fake Firebase with the rules' checks. Nobody is looking at first;
// A says "Look for a raid" from the board; B sees A's line (name, level, class, party role, what, where); B can't write A's entry;
// an entry older than half an hour is not shown; A stops looking and the line goes; signing out removes it too.
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
// open the board and read both lines (the heading, then the list with the options under it)
async function board(g) {
  await g.eval(() => window.__GLF.board());
  await until([g], () => !document.getElementById('dialog').hidden);
  const head = await g.eval(() => document.getElementById('dtext').textContent);
  await g.eval(() => window.__G.advance()); await g.step(2);
  const list = await g.eval(() => document.getElementById('dtext').textContent);
  const opts = await g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent.replace(/^\d+\.\s*/, ''))); // the buttons are numbered for the keys
  return { head, list, opts };
}
const pick = (g, label) => g.eval((l) => [...document.querySelectorAll('#dopts button')].find((b) => b.textContent.replace(/^\d+\.\s*/, '') === l).click(), label);
const entry = (g, uid) => g.eval((u) => { const v = window.__fakeRTDB.data.get('lfg/' + u); return v === undefined ? null : v; }, uid);

test('group finder: post, see, stop; others cannot write your entry; old entries are hidden; signing out removes it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gLfA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gLfB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await b.eval(() => { window.__G.P.x += 20; });
    await a.eval(() => { window.__G.S.lv = 42; window.__GRL.role('tank'); });
    await settle(a, b);

    // nobody yet; the options are the four kinds (no "Stop looking" while you aren't)
    let r = await board(a);
    assert.equal(r.head, 'Looking for a group (0)');
    assert.equal(r.list, 'Nobody is looking right now');
    assert.deepEqual(r.opts, ['Look for a raid', 'Look for a party', 'Look for a dungeon group', 'Look for a duel', 'Close']);
    await pick(a, 'Look for a raid');
    await until([a], () => window.__GLF.k === 'raid');
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /You are looking for a raid \(for half an hour\)/);
    await settle(a, b);
    const e = await entry(a, 'gLfA1');
    assert.equal(e.n, 'Ahmed'); assert.equal(e.lv, 42); assert.equal(e.k, 'raid'); assert.equal(e.r, 'tank'); assert.equal(typeof e.t, 'number');

    // B sees it, and the board offers A "Stop looking"
    await a.eval(() => window.__G.advance()); await a.step(2);
    r = await board(b);
    assert.equal(r.head, 'Looking for a group (1)');
    assert.match(r.list, /^Ahmed · Lv 42 [^·]* · 🛡 Tank · a raid · \S/);
    r = await board(a);
    assert.match(r.list, /^★ Ahmed · Lv 42/);
    assert.equal(r.opts.includes('Stop looking'), true);
    await a.eval(() => window.__G.advance()); await a.step(2);
    await b.eval(() => window.__G.advance()); await b.step(2);

    // the rules: B can't put or remove A's entry, nor post a kind that doesn't exist
    const bad = await b.eval(async () => {
      const FB = window.__GLF.fb(), D = FB.m.database, out = [];
      for (const [p, v] of [['lfg/gLfA1', null], ['lfg/gLfA1', { n: 'X', lv: 1, cls: '', r: '', k: 'raid', z: 'zTown', t: D.serverTimestamp() }], ['lfg/gLfB2', { n: 'Bassem', lv: 1, cls: '', r: '', k: 'trade', z: 'zTown', t: D.serverTimestamp() }]]) {
        try { await D.set(D.ref(FB.db, p), v); out.push('ok'); } catch (e) { out.push('no'); }
      }
      return out;
    });
    assert.deepEqual(bad, ['no', 'no', 'no']);
    assert.notEqual(await entry(a, 'gLfA1'), null, 'still there');

    // an entry older than half an hour is not shown
    await b.eval(() => window.__GLF.put('duel'));
    await until([b], () => window.__GLF.k === 'duel');
    await settle(a, b);
    await a.eval(() => { const D = window.__fakeRTDB.data, v = D.get('lfg/gLfB2'); D.set('lfg/gLfB2', { ...v, t: v.t - 31 * 60000 }); });
    r = await board(a);
    assert.equal(r.head, 'Looking for a group (1)', 'only A: B\'s entry is too old');
    await a.eval(() => window.__G.advance()); await a.step(2);

    // A stops looking
    await a.eval(() => window.__GLF.stop());
    await until([a], () => window.__GLF.k === null);
    assert.equal(await entry(a, 'gLfA1'), null);
    // B signs out: the entry goes with it
    await b.eval(() => window.__GLF.put('party'));
    await until([b], () => window.__GLF.k === 'party');
    assert.notEqual(await entry(b, 'gLfB2'), null);
    await b.eval(() => window.__GLF.out());
    await until([b], () => window.__fakeRTDB.data.get('lfg/gLfB2') === undefined);

    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
