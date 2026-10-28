'use strict';
// U250 PvP HUD (SAT-ONLINE-204; plan: "combat flag, criminal timer, safe-zone badge", checked by "the status comes before
// the first hit"): the online badge at the top carries
//   - "Safe zone" in a town, "Open PvP" outside it, from the first frame there (before anyone can hit), with a flash and
//     a notice the moment you step out of a town;
//   - "In combat Ns" on both sides for 10 s after a hit, gone after;
//   - "Outlaw m:ss" (or "Murderer m:ss") while the outlaw mark lasts.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const toasts = (g) => g.eval(() => {
  if (!window.__toastLog) { window.__toastLog = [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); }
  return window.__toastLog.join(' | ');
});
async function strike(a, b) {
  const uid = await b.eval(() => Satisfy.local.net().uid);
  await a.eval(() => { window.__G.P.acd = 0; });
  const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
  await a.page.mouse.click(p.x, p.y, { modifiers: [] });
  await a.step(1);
  await settle(a, b);
}
const place = (g, dx, x = 90 * 16, y = 60 * 16) => g.eval(([d, X, Y]) => { const G = window.__G; G.P.x = X + d; G.P.y = Y; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, [dx, x, y]);
const chips = (g) => g.eval(() => ({ text: document.getElementById('netB').textContent, cls: [...document.querySelectorAll('#netB span')].map((e) => e.className + '=' + e.textContent), flash: document.getElementById('netB').classList.contains('flash') }));

test('the badge: safe in town, open PvP before the first hit, in combat on both sides, the outlaw timer', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    await toasts(a);
    const town = await a.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y })); // a new character starts in Winston
    // in Winston: safe
    let c = await chips(a);
    assert.match(c.text, / · Safe zone$/, c.text);
    assert.deepEqual(c.cls, ['pz safe=Safe zone']);
    // out on the plains: open PvP shows at once, with a flash and a notice, before any hit
    await a.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    await place(a, 0); await a.step(1);
    c = await chips(a);
    assert.deepEqual(c.cls, ['pz pvp=Open PvP'], JSON.stringify(c));
    assert.equal(c.flash, true, 'the badge flashes as you step out');
    assert.match(await toasts(a), /You left the safe zone: other players can attack you here/);
    assert.equal(await a.eval(() => window.__G.P.hp === window.__G.maxHP()), true, 'nothing has hit A yet');
    // B comes and hits: both in combat
    await place(b, 18); await settle(a, b); await settle(a, b); // (a hit within 1 s of a jump doesn't land: U044)
    await a.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    await strike(b, a);
    assert.ok(await a.eval(() => window.__G.P.hp < window.__G.maxHP()), 'the hit landed');
    for (const g of [a, b]) {
      c = await chips(g);
      assert.equal(c.cls[0], 'pz pvp=Open PvP');
      assert.match(c.cls[1] || '', /^pc=In combat (9|10)s$/, JSON.stringify(c));
    }
    // 10 s later: out of combat
    for (let i = 0; i < 4; i++) { await a.step(160); await b.step(160); }
    for (const g of [a, b]) assert.deepEqual((await chips(g)).cls, ['pz pvp=Open PvP']);
    // the outlaw mark, then a murderer's
    await b.eval(() => { const S = window.__G.S; S.olT = Date.now() + (9 * 60 + 41) * 1000 - 500; S.karma = -1; });
    await b.step(2);
    c = await chips(b);
    assert.match(c.cls.at(-1), /^po=Outlaw 9:4[01]$/, JSON.stringify(c));
    await b.eval(() => { window.__G.S.karma = -6; }); await b.step(2);
    assert.match((await chips(b)).cls.at(-1), /^po=Murderer 9:[34]\d$/);
    // back in town: safe again; the outlaw timer stays (it runs anywhere); no notice for going in
    const n0 = (await toasts(a)).split('left the safe zone').length;
    await place(a, 0, town.x, town.y); await a.step(2);
    c = await chips(a);
    assert.deepEqual(c.cls, ['pz safe=Safe zone']);
    await place(b, 18, town.x, town.y); await b.step(2);
    assert.deepEqual((await chips(b)).cls.map((x) => x.split('=')[0]), ['pz safe', 'po']);
    // out again soon after: the badge flashes, the notice isn't repeated within 3 minutes
    await place(a, 0); await a.step(1);
    assert.equal((await chips(a)).flash, true);
    assert.equal((await toasts(a)).split('left the safe zone').length, n0, 'one notice in 3 minutes');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
