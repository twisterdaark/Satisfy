'use strict';
// SAT-ONLINE-051 (Claude-B #13 item 23, U038): bounties on outlaws, online over the fake Firebase with the rules' checks.
// A puts 500 gold on the head of B (an outlaw); everyone sees it; C kills B in open PvP and gets the 500 once, through
// B's own kill record; the bounty is gone; A takes a second bounty back from the board and gets the gold back.
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
const toasts = (g) => g.eval(() => {
  if (!window.__toastLog) { window.__toastLog = [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); }
  return window.__toastLog.join(' | ');
});
const place = (g, dx) => g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 0; if (window.__GPVP) window.__GPVP.end(); /* the spawn shield (SAT-ONLINE-142) is its own test */ for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
async function strike(a, b, uid) {
  await a.eval(() => { window.__G.P.acd = 0; });
  const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
  await a.page.mouse.click(p.x, p.y);
  await a.step(1);
  await settle(a, b);
}

test('online: a bounty on an outlaw goes to the player who kills it, once; a bounty taken back returns its gold', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gBnA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gBnB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }], ['c', 'gBnC3', 'Carim', { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b, c } = P;
    for (const g of [a, b, c]) await toasts(g);
    await place(a, -40); await place(b, 18); await place(c, 0);
    await b.eval(() => { window.__G.S.olT = Date.now() + 600000; }); // B is an outlaw (a red name)
    await a.eval(() => { window.__G.S.gold = 2000; });
    await c.eval(() => { window.__G.S.gold = 0; });
    await settle(a, b, c);
    await until([a], () => (Satisfy.local.net().remotes.find((x) => x.uid === 'gBnB2') || {}).ol === 1);

    // A puts 500 gold on B's head: it leaves A's bag, and C sees it
    assert.equal(await a.eval(() => window.__GB.post('gBnB2', 500)), true);
    assert.equal(await a.eval(() => window.__G.S.gold), 1500);
    await until([c], () => window.__GB.on('gBnB2') === 500);
    assert.match(await toasts(a), /You put a 500 gold bounty on Bassem/);

    // C kills B in open PvP: C gets the 500 once, the bounty is gone for everyone, the world hears it
    await b.eval(() => { const G = window.__G; G.P.hp = 1; G.S.tl = G.S.tl || {}; G.S.tl.legend = false; });
    for (let i = 0; i < 4 && (await b.eval(() => window.__G.mode)) !== 'dead'; i++) await strike(c, b, 'gBnB2');
    assert.equal(await b.eval(() => window.__G.mode), 'dead');
    await until([c], () => window.__G.S.gold === 500, 15000);
    await until([a, b, c], () => window.__GB.on('gBnB2') === 0, 10000);
    assert.match(await toasts(c), /You claimed a 500 gold bounty on Bassem/);
    await until([a], () => /Carim claimed a 500 gold bounty on an outlaw/.test(window.__toastLog.join(' | ') + document.body.textContent), 10000);
    await settle(a, b, c);
    assert.equal(await c.eval(() => window.__G.S.gold), 500, 'paid once');

    // A sets another one and takes it back from the board: the gold comes back
    assert.equal(await a.eval(() => window.__GB.post('gBnB2', 100)), true);
    await until([a], () => window.__GB.on('gBnB2') === 100);
    assert.equal(await a.eval(() => window.__G.S.gold), 1400);
    await a.eval(() => { document.querySelector('[data-act="plBnt"]').click(); });
    await a.step(2);
    await a.eval(() => { window.__G.advance(); });
    await a.step(1);
    await a.eval(() => window.__G.pickOpt(0));
    await until([a], () => window.__G.S.gold === 1500 && window.__GB.on('gBnB2') === 0);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
