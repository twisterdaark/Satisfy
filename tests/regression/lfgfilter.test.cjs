'use strict';
// U259 Party finder panel (SAT-ONLINE-208; plan: "filters range/role/region/level", checked by "matching never corrupts a
// party"): the group finder's board can show one kind, players within 10 levels of yours, those in your area, or one party
// role; the heading says how many of how many and which filters; your own line always shows; the filters only choose what
// you read: no party changes, nothing is written for anyone.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

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
const opts = (g) => g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent.replace(/^\d+\.\s*/, '')));
const pick = (g, re) => g.eval((s) => { const r = new RegExp(s); [...document.querySelectorAll('#dopts button')].find((b) => r.test(b.textContent.replace(/^\d+\.\s*/, ''))).click(); }, re.source);
// read the board on screen (its heading, then the list); board() opens it first
async function read(g) {
  await until([g], () => !document.getElementById('dialog').hidden && /Looking for a group/.test(document.getElementById('dtext').textContent));
  const head = await g.eval(() => document.getElementById('dtext').textContent);
  await g.eval(() => window.__G.advance()); await g.step(2);
  const list = await g.eval(() => document.getElementById('dtext').textContent);
  return { head, list, names: [...list.matchAll(/(?:^| · )(?:★ )?([A-Z][a-z]+) · Lv /g)].map((m) => m[1]) };
}
async function board(g) {
  await g.eval(() => { const d = document.getElementById('dialog'); if (!d.hidden) { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Close|Done/.test(x.textContent)); if (b) b.click(); } });
  await g.step(2); await g.page.waitForTimeout(60);
  await g.eval(() => window.__GLF.board());
  return read(g);
}
const close = async (g) => { await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Close|Done/.test(x.textContent)); if (b) b.click(); }); await g.step(2); };

test('the group finder filters by kind, level, area and role; your own line stays; nothing else changes', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await a.eval(() => { window.__fakeRTDB.data.set('accountIds/gLfA1', 'Ahmed'); window.__fakeRTDB.nextName = 'Ahmed'; window.__fakeRTDB.nextUid = 'gLfA1'; document.getElementById('onlineBtn').click(); });
    await until([a], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await a.eval(() => { window.__G.S.lv = 40; });
    // four others on the board (as their own clients would have written them), and A's own line
    const here = await a.eval(() => Satisfy.local.zoneAt(window.__G.P.x, window.__G.P.y));
    await a.eval((z) => {
      const D = window.__fakeRTDB.data, t = Date.now();
      D.set('lfg/u1', { n: 'Basma', lv: 42, cls: '', r: 'tank', k: 'raid', z, t });
      D.set('lfg/u2', { n: 'Chady', lv: 12, cls: '', r: 'healer', k: 'raid', z, t: t - 1000 });
      D.set('lfg/u3', { n: 'Dina', lv: 38, cls: '', r: 'healer', k: 'duel', z: 'zSnow', t: t - 2000 });
      D.set('lfg/u4', { n: 'Ezz', lv: 0, cls: '', r: 'damage', k: 'party', z, t: t - 3000 }); // level hidden
    }, here);
    await a.eval(() => window.__GLF.put('party')); await until([a], () => window.__GLF.k === 'party');
    const before = await a.eval(() => JSON.stringify([...window.__fakeRTDB.data.entries()].filter(([p]) => /^(lfg|party|parties)/.test(p))));
    let r = await board(a);
    assert.equal(r.head, 'Looking for a group (5)');
    assert.deepEqual(r.names.sort(), ['Ahmed', 'Basma', 'Chady', 'Dina', 'Ezz']);
    assert.ok((await opts(a)).includes('🔎 Filters'));
    // raids only
    await pick(a, /Filters/); await a.step(2);
    assert.deepEqual(await opts(a), ['What: all', 'Level: any', 'Where: anywhere', 'Role: all', 'Done']);
    await pick(a, /^What/); await a.step(2);
    assert.equal((await opts(a))[0], 'What: a raid');
    await pick(a, /^Done/); await a.step(2);
    r = await read(a);
    assert.equal(r.head, 'Looking for a group (3 of 5) · a raid');
    assert.deepEqual(r.names.sort(), ['Ahmed', 'Basma', 'Chady'], 'raids, and your own line');
    // + near your level (40 ± 10): Chady (12) goes
    await close(a); await a.eval(() => window.__GLF.filters()); await a.step(2);
    await pick(a, /^Level/); await a.step(2); await pick(a, /^Done/); await a.step(2);
    r = await read(a);
    assert.deepEqual(r.names.sort(), ['Ahmed', 'Basma']);
    assert.match(r.head, /\(2 of 5\) · a raid, near yours \(±10\)$/);
    // only healers, any kind, any level: Chady and Dina; then only your area: Chady
    await close(a); await a.eval(() => { const F = window.__GLF.F; F.k = ''; F.lv = 0; F.r = 'healer'; }); r = await board(a);
    assert.deepEqual(r.names.sort(), ['Ahmed', 'Chady', 'Dina']);
    await close(a); await a.eval(() => { window.__GLF.F.z = 1; }); r = await board(a);
    assert.deepEqual(r.names.sort(), ['Ahmed', 'Chady']);
    // a hidden level is never "near"
    await close(a); await a.eval(() => { const F = window.__GLF.F; F.r = ''; F.z = 0; F.k = 'party'; F.lv = 1; }); r = await board(a);
    assert.deepEqual(r.names, ['Ahmed']);
    assert.match(r.list, /^★ Ahmed/);
    // nobody matching: the line says so; clearing brings everyone back
    await close(a); await a.eval(() => { const F = window.__GLF.F; F.k = 'dungeon'; F.lv = 0; }); r = await board(a);
    assert.equal(r.names.length, 1, 'only your own line');
    await close(a); await a.eval(() => window.__GLF.stop()); await until([a], () => window.__GLF.k === null);
    r = await board(a);
    assert.equal(r.list, 'Nobody matches these filters');
    await close(a); await a.eval(() => window.__GLF.filters()); await a.step(2);
    await pick(a, /^Clear the filters/); await a.step(2);
    await until([a], () => /Looking for a group \(4\)/.test(document.getElementById('dtext').textContent));
    // nothing was written by filtering: the board's entries and the party are as before (but A's own line, which A took down)
    const after = await a.eval(() => JSON.stringify([...window.__fakeRTDB.data.entries()].filter(([p]) => /^(lfg|party|parties)/.test(p) && p !== 'lfg/gLfA1')));
    assert.equal(after, JSON.stringify(JSON.parse(before).filter(([p]) => p !== 'lfg/gLfA1')));
    assert.equal(await a.eval(() => !!(Satisfy.local.net().party && Satisfy.local.net().party.members.length > 1)), false, 'no party');
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});
