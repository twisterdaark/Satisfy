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
const place = (g, dx, x = 90 * 16, y = 60 * 16) => g.eval(([d, X, Y]) => { const G = window.__G; G.P.x = X + d; G.P.y = Y; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, [dx, x, y]);

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
    // SAT-ONLINE-152 (plan U042): B's worn gear, one piece already worn down near the floor
    const worn = (g) => g.eval(() => { const G = window.__G, S = G.S, w = S.items.find((i) => i.uid === S.eqW) || S.items[0]; return { n: S.items.length, w: w.dur === undefined ? 100 : w.dur, ids: S.items.map((i) => i.uid) }; });
    await b.eval(() => { const G = window.__G, S = G.S, ar = G.eqx.mkItem('parmor', 1); ar.dur = 12; S.items.push(ar); S.eqA = ar.uid; }); // armour nearly worn out
    const before = await worn(b);
    await strike(a, b);
    for (let i = 0; i < 3 && (await b.eval(() => window.__G.mode)) !== 'dead'; i++) await strike(a, b);
    assert.equal(await b.eval(() => window.__G.mode), 'dead');
    assert.ok(await b.eval(() => !!window.__G.P.dpen), 'the normal death penalty');
    const after = await worn(b);
    assert.equal(after.w, before.w - 5, 'the weapon lost 5 durability');
    assert.equal(await b.eval(() => { const S = window.__G.S; return S.items.find((i) => i.uid === S.eqA).dur; }), 10, 'the armour stops at 10: PvP alone never breaks gear');
    assert.deepEqual([after.n, after.ids], [before.n, before.ids], 'no item dropped or lost');
    assert.match(await b.eval(() => window.__G.P.dpen), /The gear you wear lost 5 durability \(PvP\)\./);
    await strike(a, b); await strike(a, b); // more hits on the dead: nothing more
    assert.equal((await worn(b)).w, after.w, 'once a death');
    assert.equal(await b.eval(() => { const S = JSON.parse(localStorage.getItem('satisfy_proto_v4@b')).S, w = S.items.find((i) => i.uid === S.eqW) || S.items[0]; return w.dur; }), after.w, 'saved at once');
    await settle(a, b);
    assert.match(await toasts(b), /Grid killed you/);
    // SAT-ONLINE-150 (plan U039): who hit B before it died, and when
    assert.match(await toasts(b), /\d+ hits in \d+\.\d s · type \/fightlog to see who hit you/);
    const rc = await b.eval(() => window.__GFLOG.pvp);
    assert.equal(rc.n, 'Grid');
    assert.deepEqual(rc.r.by.map((x) => x.handle), ['Grid'], 'only Grid hit B');
    assert.ok(rc.r.by[0].hits >= 2 && rc.r.lines.length === rc.r.by[0].hits);
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

// plan U026/U027 (Safe Bairan, Safe Winston): from inside a town no player damage can be received, also from a modified
// client. A skips the game's own checks and puts hits straight on the channel the pages talk on, as a changed page could:
// B in Winston takes none of them; outside, the same hits land, so it is the town that stops them.
const forge = (g, to, n) => g.eval(([u, k]) => { const me = Satisfy.local.net(), ch = new BroadcastChannel('satisfy-net-v1'); ch.postMessage(Satisfy.net.envelope('pvp.hit', { to: u, k: 90, n: k }, { sessionId: me.sid, seq: 1e9 + k })); ch.close(); }, [to, n]);
test("in a town a modified client's hits do not land; outside the same hits do", async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const town = await b.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    await toasts(b);
    const ub = await b.eval(() => Satisfy.local.net().uid);
    let n = 0;
    for (const [where, x, y] of [['Winston', town.x, town.y], ['the plains', 90 * 16, 60 * 16]]) {
      await place(a, 0, x, y); await place(b, 18, x, y);
      await settle(a, b); await settle(a, b);
      await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
      const hp = await b.eval(() => window.__G.P.hp), inTown = where === 'Winston';
      assert.equal((await b.eval(() => Satisfy.local.world().towns)).includes(await b.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y))), inTown, 'B is in ' + where);
      for (let i = 0; i < 3; i++) { await forge(a, ub, ++n); await settle(a, b); }
      const hp2 = await b.eval(() => window.__G.P.hp);
      if (inTown) {
        assert.ok(hp2 >= hp, 'no damage in a town: ' + hp + ' -> ' + hp2);
        assert.doesNotMatch(await toasts(b), /attacking you/);
      } else {
        assert.ok(hp2 < hp, 'outside, the forged hits land: ' + hp + ' -> ' + hp2);
        assert.match(await toasts(b), /Grid is attacking you!/);
      }
    }
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

// plan U029 (projectile boundary): an arrow shot from outside a town doesn't hurt a target inside it. A stands on the
// plains just outside Winston with a bow and shoots B, who stands just inside, 120 px away; then both step out the same
// way and the same shot lands.
test('an arrow from outside a town does not hurt a target inside it; outside it does', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await toasts(b);
    // the town's edge, walking west from the start: the last spot of Winston and the first of the land outside
    const edge = await a.eval(() => {
      const L = Satisfy.local, P = window.__G.P, towns = L.world().towns, z0 = L.zoneAt(P.x, P.y);
      for (let x = P.x; x > 0; x -= 4) { const z = L.zoneAt(x, P.y); if (z !== z0) return { x, y: P.y, inTown: towns.includes(z), z, z0 }; }
      return null;
    });
    assert.ok(edge && !edge.inTown && edge.z !== 'void', 'an edge to open land: ' + JSON.stringify(edge));
    await a.eval(() => { const G = window.__G, S = G.S, w = G.eqx.mkItem('tbow', 0); S.items.push(w); S.eqW = w.uid; S.arrows = [99, 0, 0, 0, 0]; });
    const shoot = async (ax, bx, y) => {
      await place(a, 0, ax, y); await place(b, 0, bx, y);
      await settle(a, b); await settle(a, b);
      await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
      const hp = await b.eval(() => window.__G.P.hp);
      for (let i = 0; i < 3; i++) { await a.eval(() => { const G = window.__G; G.P.acd = 0; G.tryAttack(1, 0); }); await settle(a, b); }
      return { hp, after: await b.eval(() => window.__G.P.hp), inB: await b.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y)), inA: await a.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y)) };
    };
    // B 40 px inside, A 80 px outside, shooting east at B
    const r1 = await shoot(edge.x - 80, edge.x + 40, edge.y);
    assert.deepEqual([r1.inA === edge.z0, r1.inB], [false, edge.z0], 'A outside, B inside: ' + JSON.stringify(r1));
    assert.ok(r1.after >= r1.hp, 'no harm inside the town: ' + r1.hp + ' -> ' + r1.after);
    assert.doesNotMatch(await toasts(b), /attacking you/);
    // both 120 px further west, B now just outside: the same shot lands
    const r2 = await shoot(edge.x - 200, edge.x - 80, edge.y);
    assert.ok(r2.inB !== edge.z0, 'B outside now');
    assert.ok(r2.after < r2.hp, 'outside, the arrow lands: ' + r2.hp + ' -> ' + r2.after);
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
