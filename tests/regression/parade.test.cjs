'use strict';
// U295 Guild parade (SAT-ONLINE-175; plan: "emblems/costumes original only", check: "stage occupancy not blocking NPC"),
// three pages over the fake Firebase:
//   - the guild master starts a parade in Winston from G (a member without the right can't); it rides in the fx tag;
//   - a member in the same town joins it until the same end, and marches with the banner; each page draws the others';
//   - a player outside the guild hears who is marching and sees the banners and the stage;
//   - every town's stage keeps PDGAP from every NPC of that town, on free ground; with a parade on, E still finds the NPC;
//   - leaving the town ends your part; a second parade waits for the cooldown.
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
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) window.__toastSeen += '|' + n.textContent; }).observe(box, { childList: true }); }); // each toast once, as it arrives
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}

test('a guild parade: the master starts it, members march, others see it, the stage leaves the NPCs be', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gPdA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gPdB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gPdC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 60; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Dragons'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gPdB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await a.eval(() => window.__GBAN.set(3)); // the dragon
    await until([a], () => (window.__GG.state().guild || {}).emb === 3);

    // only with the right to plan events; from G
    assert.equal(await b.eval(() => window.__GPD.can()), false, 'a member');
    assert.equal(await a.eval(() => window.__GPD.can()), true, 'the master, in Winston');
    await a.page.keyboard.press('KeyG'); await a.step(2); await a.eval(() => window.__GDW.dlg()); await a.step(2);
    const gOpts = await a.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].map((x) => x.textContent).join('|'));
    assert.match(gOpts, /Start a guild parade here/);
    await a.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].find((x) => /Start a guild parade here/.test(x.textContent)).click());
    await a.step(2);
    await until([a], () => /The guild parade has begun in Winston/.test(window.__toastSeen));
    await a.page.keyboard.press('Escape'); await a.step(2);
    const end = await a.eval(() => +window.__GPD.pub());
    assert.ok(end > 0);

    // B, in the same town, joins until the same end; each draws the other's banner
    await until([b], () => window.__GPD.on(), 15000);
    assert.equal(await b.eval(() => Math.floor(window.__GPD.PD.until)), end, 'the same end');
    assert.match(await b.eval(() => window.__toastSeen), /You march with the banner/);
    await until([a, b], () => { const d = window.__GPD.drawn(); return d.me > 0 && (d.gPdA1 > 0 || d.gPdB2 > 0); });
    // C, outside the guild: hears it once the guild's name is known, sees the banners and the stage
    await c.step(3700); await settle(a, b, c);
    for (let i = 0; i < 40 && !(await c.eval(() => /Dragons are holding a parade in Winston/.test(window.__toastSeen))); i++) await settle(a, b, c);
    assert.match(await c.eval(() => window.__toastSeen), /🐉 Dragons are holding a parade in Winston!/);
    assert.equal((await c.eval(() => window.__toastSeen)).match(/holding a parade/g).length, 1, 'once');
    await until([a, b, c], () => window.__GPD.on() || ((window.__GPD.drawn().gPdA1 || 0) > 0 && !!window.__GPD.live().zWin), 10000);
    assert.ok(await c.eval(() => (window.__GPD.drawn().gPdA1 || 0) > 0 && !!window.__GPD.live().zWin));
    assert.equal(await c.eval(() => window.__GPD.on()), false, 'not in the guild: no banner of its own');

    // every town's stage: on free ground, PDGAP from every NPC of the town
    const st = await a.eval(() => { const D = window.__GPD, o = {}; for (const k of D.towns()) { const s = D.stage(k); if (!s) { o[k] = null; continue; }
      const tx = Math.floor(s.x / 16), ty = Math.floor(s.y / 16); let solid = false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (D.solid(tx + i, ty + j)) solid = true;
      o[k] = { solid, near: Math.min(1e9, ...D.npcsOf(k).map((n) => Math.hypot(n.x - s.x, n.y - s.y))) }; } return { o, gap: D.gap }; });
    assert.ok(st.o.zWin, 'Winston has a stage');
    for (const [k, v] of Object.entries(st.o)) if (v) { assert.equal(v.solid, false, k + ': free ground'); assert.ok(v.near >= st.gap, k + ': ' + v.near + ' from an NPC'); }
    assert.ok(Object.values(st.o).filter(Boolean).length >= 3, 'most towns have one');
    // with the parade on, next to an NPC E still finds the NPC
    const npc = await a.eval(() => { const n = window.__GPD.npcsOf('zWin')[0]; const P = window.__G.P; P.x = n.x; P.y = n.y + 14; return n.id; });
    await a.step(3);
    assert.deepEqual(await a.eval(() => window.__GPD.nearest()), { k: 'npc', id: npc });
    assert.equal(await a.eval(() => window.__GPD.on()), true);

    // leaving the town ends your part; a second parade waits
    await a.eval(() => { const P = window.__G.P; P._x = P.x; P._y = P.y; P.x = 40 * 16; P.y = 40 * 16; });
    await a.step(3);
    assert.equal(await a.eval(() => window.__GPD.pub()), '');
    await a.eval(() => { const P = window.__G.P; P.x = P._x; P.y = P._y; });
    await a.step(3);
    assert.equal(await a.eval(() => window.__GPD.on()), true, 'back before the end');
    await a.eval(() => window.__GPD.start()); await a.step(2);
    assert.match(await a.eval(() => window.__toastSeen), /You can hold another parade in \d+ min/);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
