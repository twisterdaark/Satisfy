'use strict';
// SAT-ONLINE-145 (plan U035, "open PvP toggle: a clear warning and cooldown; no kill of a player who chose PvE only"). From
// the players list (O) a player leaves open PvP: nobody can hurt them and they hurt nobody, outside towns too, and the
// others see a 🕊 by the name. It is no way out of a fight (not within 30 s of a blow, not while an outlaw), it changes at
// most once every 2 minutes (the owner, 2026-10-22), and it is kept through a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
// every toast since the page opened (a toast fades after 2.6 s of real time, which a slow run can outlast)
const toasts = (g) => g.eval(() => {
  if (!window.__toastLog) { window.__toastLog = [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); }
  return window.__toastLog.join(' | ');
});
// one attack click on the other player's body (a click on a player attacks)
async function strike(a, b) {
  const uid = await b.eval(() => Satisfy.local.net().uid);
  await a.eval(() => { window.__G.P.acd = 0; });
  const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
  await a.page.mouse.click(p.x, p.y, { modifiers: [] });
  await a.step(1);
  await settle(a, b);
}
const place = (g, dx, x = 90 * 16, y = 60 * 16) => g.eval(([d, X, Y]) => { const G = window.__G; G.P.x = X + d; G.P.y = Y; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, [dx, x, y]);

const shown = (g, of) => g.eval((u) => (Satisfy.local.net().remotes.find((r) => r.uid === u) || {}).pv, of);
const hp = (g) => g.eval(() => window.__G.P.hp);
const full = (g) => g.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
async function pveButton(g) {
  if (await g.eval(() => document.getElementById('plW').hidden)) await g.page.keyboard.press('KeyO');
  await g.step(2);
  const label = await g.eval(() => document.getElementById('plPve').textContent);
  await g.eval(() => document.getElementById('plPve').click()); await g.step(2);
  return label;
}

test('PvE only: out of open PvP both ways, seen by others; not in a fight, not as an outlaw, once every 2 minutes; kept', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await toasts(a); await toasts(b);
    const ua = await a.eval(() => Satisfy.local.net().uid);
    await place(a, 0); await place(b, 18);
    await settle(a, b);

    // in a fight: B strikes A, A can't leave PvP for 30 s
    await full(a); let h = await hp(a);
    await strike(b, a);
    assert.ok((await hp(a)) < h, 'open PvP to start with');
    assert.match(await pveButton(a), /PvE only/);
    assert.equal(await a.eval(() => window.__GPVE.on()), false, 'not in a fight');
    assert.match(await toasts(a), /Not in a fight: wait \d+ s after the last blow/);
    for (let i = 0; i < 15; i++) { await a.step(130); await b.step(5); } // 32 s of the game clock

    // out of the fight: PvE only, seen by B, both ways
    await pveButton(a);
    assert.equal(await a.eval(() => window.__GPVE.on()), true);
    assert.match(await toasts(a), /PvE only: no player can hurt you and you can hurt no one/);
    await settle(a, b);
    assert.equal(await shown(b, ua), 1, 'B sees it');
    await full(a); h = await hp(a);
    await strike(b, a);
    assert.ok((await hp(a)) >= h, 'B can not hurt A');
    await full(b); h = await hp(b);
    await strike(a, b);
    assert.ok((await hp(b)) >= h, 'nor A B');
    assert.match(await a.eval(() => document.getElementById('plPve').textContent), /Back to open PvP/);

    // straight back: refused for 2 minutes; kept through a reload
    await pveButton(a);
    assert.equal(await a.eval(() => window.__GPVE.on()), true, 'not again so soon');
    assert.match(await toasts(a), /You can change it again in [12] min/);
    await a.eval(() => window.__G.save(true));
    await a.page.reload(); await a.step(2); await H.continueGame(a);
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GPVE.on()), true, 'kept');
    assert.equal(await a.eval(() => window.__GPVE.why()[0]), 'pveCool', 'and so is the wait');
    // 2 minutes later (on the server clock): open PvP again, and blows land
    await a.eval(() => { window.__G.S.pveT -= 121000; });
    await pveButton(a);
    assert.equal(await a.eval(() => window.__GPVE.on()), false);
    assert.match(await toasts(a), /Open PvP again/);
    await place(a, 0); await place(b, 18); await settle(a, b); await settle(a, b);
    assert.notEqual(await shown(b, ua), 1);
    await full(a); h = await hp(a);
    await strike(b, a);
    assert.ok((await hp(a)) < h, 'hurt again');

    // an outlaw can't leave open PvP (out of the fight and past the wait)
    for (let i = 0; i < 15; i++) { await a.step(130); await b.step(5); } // 32 s of the game clock
    await a.eval(() => { const S = window.__G.S; S.olT = Date.now() + 600000; S.pveT = 0; });
    await pveButton(a);
    assert.equal(await a.eval(() => window.__GPVE.on()), false);
    assert.match(await toasts(a), /Not while you are an outlaw/);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
