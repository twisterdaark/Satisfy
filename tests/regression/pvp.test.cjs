'use strict';
// SAT-ONLINE-038 (owner 2026-10-19): open PvP outside towns, the way duels work: a capped share of the victim's max HP per
// hit, applied by the victim's own client; no friendly fire in a party; no fighting in a town; dying to a player costs the
// normal death penalty only; the killer gets a red "outlaw" name for a while.
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
const place = (g, dx, x = 90 * 16, y = 60 * 16) => g.eval(([d, X, Y]) => { const G = window.__G; G.P.x = X + d; G.P.y = Y; G.P.inv = 0; if (window.__GPVP) window.__GPVP.end(); /* the spawn shield (SAT-ONLINE-142) is its own test */ for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, [dx, x, y]);

test('outside town a hit takes a capped share of HP; a party or a town stops it; a kill makes an outlaw', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const town = await a.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y, zone: Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y) })); // a new character starts in Winston
    assert.ok((await a.eval(() => Satisfy.local.world().towns)).includes(town.zone), 'the start is in a town: ' + town.zone);
    await toasts(a); await toasts(b); // start collecting
    await place(a, 0); await place(b, 18); // the plains west of Winston
    await settle(a, b);
    const maxB = await b.eval(() => window.__G.maxHP());
    await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    await strike(a, b);
    const hp1 = await b.eval(() => window.__G.P.hp);
    assert.ok(hp1 < maxB, 'the hit landed on B: ' + hp1 + '/' + maxB);
    assert.ok(maxB - hp1 <= Math.ceil(maxB * 0.09) + 1, 'capped to 9% of max HP: ' + (maxB - hp1));
    assert.match(await toasts(b), /Grid is attacking you!/);

    // a party: no friendly fire
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await b.page.keyboard.press('KeyY'); await settle(a, b); await settle(a, b);
    assert.equal(await b.eval(() => Satisfy.local.net().party.members.length), 2);
    const hp2 = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) >= hp2, 'no hit inside the party (HP only regenerates)');
    assert.doesNotMatch(await toasts(b), /attacking you![^]*attacking you!/, 'no second attack notice');
    await b.eval(() => document.querySelector('#partyW [data-act="pLeave"]').click()); await settle(a, b);
    for (let i = 0; i < 3; i++) await settle(a, b);

    // a town: no hit
    await place(a, 0, town.x, town.y); await place(b, 18, town.x, town.y);
    await settle(a, b);
    assert.equal(await a.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y)), await b.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y)));
    const hp3 = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) >= hp3, 'no hit in a town');

    // back outside: B at 1 HP dies to the next hit; normal death penalty, nothing for A; A turns outlaw (red for B)
    await place(a, 0); await place(b, 18);
    await settle(a, b);
    const goldA = await a.eval(() => window.__G.S.gold), itemsA = await a.eval(() => window.__G.S.items.length);
    await b.eval(() => { window.__G.P.hp = 1; window.__G.S.tl = window.__G.S.tl || {}; window.__G.S.tl.legend = false; });
    await strike(a, b);
    for (let i = 0; i < 3 && (await b.eval(() => window.__G.mode)) !== 'dead'; i++) await strike(a, b);
    assert.equal(await b.eval(() => window.__G.mode), 'dead');
    assert.ok(await b.eval(() => !!window.__G.P.dpen), 'the normal death penalty');
    await settle(a, b);
    assert.match(await toasts(b), /Grid killed you/);
    assert.match(await toasts(a), /You killed Faker: you are an outlaw for 10 minutes/);
    assert.ok(await a.eval(() => window.__G.S.olT > Date.now()));
    assert.equal(await a.eval(() => window.__G.S.gold), goldA, 'no gold changes hands');
    assert.equal(await a.eval(() => window.__G.S.items.length), itemsA, 'no items change hands');
    await settle(a, b);
    const ua = await a.eval(() => Satisfy.local.net().uid);
    assert.equal(await b.eval((u) => Satisfy.local.net().remotes.find((r) => r.uid === u).ol, ua), 1, 'B sees A as an outlaw');
    // the mark survives a reload of the killer's save, and ends by itself
    await a.eval(() => { window.__G.S.olT = Date.now() - 1; });
    await settle(a, b); await settle(a, b);
    assert.match(await toasts(a), /You are no longer an outlaw/);
    assert.equal(await b.eval((u) => Satisfy.local.net().remotes.find((r) => r.uid === u).ol, ua), null);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

// plan U028 (spawn shield): nobody can catch a player as they come into the world. For 10 s after entering the game, coming
// back from death or a reload, no open PvP hit lands on them and the others see it; striking a player ends it at once.
const placeKeep = (g, dx, x = 90 * 16, y = 60 * 16) => g.eval(([d, X, Y]) => { const G = window.__G; G.P.x = X + d; G.P.y = Y; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, [dx, x, y]);
const shown = (g, of) => g.eval((u) => (Satisfy.local.net().remotes.find((r) => r.uid === u) || {}).sh, of);
test('a spawn shield: no hit lands for 10 s after coming into the world, the others see it, and striking ends it', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const ua = await a.eval(() => Satisfy.local.net().uid), ub = await b.eval(() => Satisfy.local.net().uid);
    await toasts(a); await toasts(b);
    await placeKeep(a, 0); await placeKeep(b, 18);
    await settle(a, b);
    assert.equal(await b.eval(() => window.__GPVP.on), true, 'B came into the world: shielded');
    assert.equal(await shown(a, ub), 1, 'A sees it');
    await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    let hp = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) >= hp, 'no hit lands');
    // 10 s of B's clock later it is over, and the same strike lands
    for (let i = 0; i < 6; i++) { await b.step(110); await a.step(10); }
    await settle(a, b);
    assert.equal(await b.eval(() => window.__GPVP.on), false);
    assert.notEqual(await shown(a, ub), 1, 'not shown any more');
    // A is still shielded (A's clock barely moved): striking B ends it at once, and B can strike back
    assert.equal(await a.eval(() => window.__GPVP.on), true);
    assert.equal(await shown(b, ua), 1);
    hp = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.equal(await a.eval(() => window.__GPVP.on), false, 'striking a player ends your own shield');
    assert.ok((await b.eval(() => window.__G.P.hp)) >= hp, 'that first blow only ends it');
    assert.match(await toasts(a), /Spawn shield off/);
    await settle(a, b);
    assert.notEqual(await shown(b, ua), 1, 'B sees it gone');
    await a.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    const hpA = await a.eval(() => window.__G.P.hp);
    await strike(b, a);
    assert.ok((await a.eval(() => window.__G.P.hp)) < hpA, 'B strikes back');
    hp = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) < hp, "and A's next blow lands");

    // back from death: shielded again
    await b.eval(() => { window.__G.P.hp = 0; window.__G.die(); });
    await b.step(5);
    assert.equal(await b.mode(), 'dead');
    await b.eval(() => window.__GK.respawn()); await b.step(2);
    assert.equal(await b.eval(() => window.__GPVP.on), true, 'shielded after coming back');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('online: the hits, the kill report and the outlaw mark pass the database rules', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gPvpA1', 'Grid'], ['b', 'gPvpB2', 'Faker']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await place(a, 0); await place(b, 18);
    await settle(a, b); await settle(a, b);
    await b.eval(() => { window.__G.P.hp = 1; window.__G.S.tl = window.__G.S.tl || {}; window.__G.S.tl.legend = false; });
    for (let i = 0; i < 4 && (await b.eval(() => window.__G.mode)) !== 'dead'; i++) await strike(a, b);
    assert.equal(await b.eval(() => window.__G.mode), 'dead');
    for (let i = 0; i < 20 && !(await a.eval(() => window.__G.S.olT > Date.now())); i++) await settle(a, b);
    assert.ok(await a.eval(() => window.__G.S.olT > Date.now()), 'the kill report arrived');
    for (let i = 0; i < 20 && !(await b.eval(() => (Satisfy.local.net().remotes[0] || {}).ol === 1)); i++) await settle(a, b);
    assert.equal(await b.eval(() => (Satisfy.local.net().remotes[0] || {}).ol), 1);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
