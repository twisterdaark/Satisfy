'use strict';
// SAT-ONLINE-115 (plan U235) over the fake Firebase with the rules' checks: the guild hall. The master furnishes it from the
// guild panel (who placed what is kept); a member can't; members go in and see each other there, and nobody outside does;
// furniture blocks the way; a player outside the guild can't read it until the master lets them in by account ID, then
// finds the invitation in the guild panel, goes in, still can't furnish, walks out to where they came from and turns the
// invitation down; in the hall with no visit (a reload) you are put outside; a disband takes the hall with it.
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
  await g.eval(([u, n]) => { const D = window.__fakeRTDB.data; D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
  return g;
}
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => (document.getElementById('dopts').hidden && !document.querySelector('#gwB .gwopts button'))); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
async function pick(g, re) {
  await opts(g);
  await g.eval((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].find((x) => r.test(x.textContent.replace(/^\d+\.\s*/, ''))); if (!b) throw new Error('no option ' + src); b.click(); }, re.source);
  await g.step(2);
}
const GID = 'g_gHlA1';
const write = (g, path, v) => g.eval(async ([p, x]) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.update(D.ref(F.db), { [p]: x === 'SV' ? null : x }); return 'ok'; } catch (e) { return 'no'; } }, [path, v]);
const read = (g, path) => g.eval(async (p) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.get(D.ref(F.db, p)); return 'ok'; } catch (e) { return 'no'; } }, path);
const inside = (g) => g.eval(() => window.__GHALL.inside());

test('the guild hall: furnished by the master, members and invited guests only, furniture in the way, gone with the guild', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await signIn(ctx, 'a', 'gHlA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gHlB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gHlC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 60; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Dragons'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gHlB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await settle(a, b, c);

    // G -> Guild hall: the master furnishes place 1 with a table
    await a.page.keyboard.press('KeyG'); await a.step(2); await a.eval(() => window.__GDW.tab('x')); await a.step(2);
    await pick(a, /^Guild hall$/);
    await until([a], () => /The guild hall: 0 of 8 places furnished/.test((window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)));
    assert.deepEqual(await opts(a), ['Go in', 'Furnish the hall', 'Guests', "Other guilds' halls you may visit", 'Back']);
    await pick(a, /Furnish the hall/);
    await pick(a, /^Place 1: empty$/);
    await pick(a, /^Table$/);
    await until([a], () => /Placed in the hall/.test(window.__toastSeen));
    const s0 = await a.eval((gid) => window.__fakeRTDB.data.get('guildHall/' + gid + '/s0'), GID);
    assert.deepEqual([s0.k, s0.by, s0.n, typeof s0.t], ['table', 'gHlA1', 'Ahmed', 'number'], 'who placed it and when');
    assert.deepEqual((await opts(a)).slice(0, 2), ['Place 1: Table', 'Place 2: empty']);
    await pick(a, /^Place 1: Table$/);
    assert.match(await a.eval(() => (window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)), /Place 1 · now: Table \(by Ahmed\)/);
    await pick(a, /^Back$/); await pick(a, /^Back$/); await pick(a, /^Back$/);
    await a.page.keyboard.press('Escape'); await a.step(2);

    // a member can't furnish, nor can anyone write a piece outside the list
    await b.page.keyboard.press('KeyG'); await b.step(2); await b.eval(() => window.__GDW.tab('x')); await b.step(2);
    await pick(b, /^Guild hall$/);
    await until([b], () => /The guild hall: 1 of 8 places furnished/.test((window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)));
    assert.deepEqual(await opts(b), ['Go in', "Other guilds' halls you may visit", 'Back']);
    assert.equal(await write(b, 'guildHall/' + GID + '/s1', { k: 'bed', by: 'gHlB2', n: 'Bassem', t: { '.sv': 'timestamp' } }), 'no');
    assert.equal(await write(a, 'guildHall/' + GID + '/s1', { k: 'throne', by: 'gHlA1', n: 'Ahmed', t: { '.sv': 'timestamp' } }), 'no');
    assert.equal(await write(a, 'guildHall/' + GID + '/s9', { k: 'bed', by: 'gHlA1', n: 'Ahmed', t: { '.sv': 'timestamp' } }), 'no');

    // both members go in; they see each other there and nobody outside sees them
    await pick(b, /^Go in$/);
    await a.eval(() => window.__GHALL.menu()); await a.step(2);
    await pick(a, /^Go in$/);
    await until([a, b], () => window.__GHALL.inside());
    const hid = await a.eval((g) => window.__GHALL.id(g), GID);
    assert.match(hid, /^h[0-9a-z]{1,7}$/);
    assert.equal(await a.eval(() => window.__GHALL.room().id), hid);
    await settle(a, b, c);
    await until([a], () => Satisfy.local.net().remotes.some((r) => r.uid === 'gHlB2' && r.room === window.__GHALL.room().id));
    await until([c], (h) => Satisfy.local.net().remotes.filter((r) => r.room === h).length === 2, 10000, hid);
    assert.equal(await c.eval(() => Satisfy.local.net().remotes.filter((r) => !r.room).length), 0, 'both are in the hall, which C outside does not draw');
    // the table blocks the way (two tiles at place 1)
    const R = await a.eval(() => window.__GHALL.room());
    assert.deepEqual(await a.eval(([x, y]) => [window.__GHALL.solid(x, y), window.__GHALL.solid(x + 1, y), window.__GHALL.solid(x + 2, y)], [R.rx + 1, R.ry + 2]), [true, true, false]);
    assert.deepEqual(await a.eval(() => window.__GHALL.v.slots.s0.k), 'table');
    await a.step(5); // drawn with no error

    // C, outside the guild, can't read it and has no invitation
    assert.equal(await read(c, 'guildHall/' + GID), 'no');
    await c.page.keyboard.press('KeyG'); await c.step(2); await c.eval(() => window.__GDW.tab('x')); await c.step(2);
    await pick(c, /Other guilds' halls you may visit/);
    await until([c], () => /No guild has let you in yet/.test((window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)));
    await pick(c, /^Back$/); await c.page.keyboard.press('Escape'); await c.step(2);

    // the master lets C in by account ID (each page set its own ID in its copy of the fake: the others' copies learn it here)
    for (const g of [a, b, c]) await g.eval(() => { const D = window.__fakeRTDB.data; [['gHlA1', 'Ahmed'], ['gHlB2', 'Bassem'], ['gHlC3', 'Carim']].forEach(([u, n]) => { D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); }); });
    await a.eval(() => window.__GHALL.menu()); await a.step(2);
    await pick(a, /^Guests$/);
    await until([a], () => /No guests yet/.test((window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)));
    await pick(a, /Let a player in/);
    await a.eval(() => { document.getElementById('lineIn').value = 'carim'; document.querySelector('#gnBox button').click(); });
    await until([a], () => /Carim may visit the hall now/.test(window.__toastSeen));
    assert.equal(await a.eval((gid) => window.__fakeRTDB.data.get('guildHallGuest/' + gid + '/gHlC3').n, GID), 'Carim');
    assert.equal(await a.eval((gid) => window.__fakeRTDB.data.get('hallInv/gHlC3/' + gid).g, GID), 'Dragons');
    await until([a], () => /Guests who may come in: Carim/.test((window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)));
    await pick(a, /^Back$/); await a.page.keyboard.press('Escape'); await a.step(2);

    // C finds it in the guild panel, goes in, sees the table and the members, and still can't furnish
    const cx0 = await c.eval(() => [Math.round(window.__G.P.x), Math.round(window.__G.P.y)]);
    await c.page.keyboard.press('KeyG'); await c.step(2); await c.eval(() => window.__GDW.tab('x')); await c.step(2);
    await pick(c, /Other guilds' halls you may visit/);
    await until([c], () => /Guild halls you may visit:/.test((window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)));
    await pick(c, /^The hall of Dragons$/);
    await pick(c, /^Go in$/);
    await until([c], () => window.__GHALL.inside() && !!window.__GHALL.v && !!window.__GHALL.v.slots.s0);
    assert.equal(await c.eval(() => window.__GHALL.v.guest), true);
    await settle(a, b, c);
    await until([c], () => Satisfy.local.net().remotes.filter((r) => r.room === window.__GHALL.room().id).length === 2);
    assert.equal(await write(c, 'guildHall/' + GID + '/s2', { k: 'barrel', by: 'gHlC3', n: 'Carim', t: { '.sv': 'timestamp' } }), 'no', 'a guest does not furnish');
    // out through the door: back where C came in from
    await c.eval(() => { const R = window.__GHALL.room(); window.__G.P.x = (R.rx + 6) * 16 + 8; window.__G.P.y = (R.ry + 7) * 16 + 6; });
    await until([c], () => !window.__GHALL.inside() && !window.__GHALL.v, 8000);
    const cx1 = await c.eval(() => [Math.round(window.__G.P.x), Math.round(window.__G.P.y)]);
    assert.ok(Math.abs(cx1[0] - cx0[0]) <= 2 && Math.abs(cx1[1] - cx0[1]) <= 6, `back at ${cx1}, came from ${cx0}`);
    assert.equal(await c.eval(() => window.__GHALL.room().id), 'rGH', 'the room is nobody\'s again');
    // C turns the invitation down: both copies go
    await c.eval(() => window.__GHALL.visits()); await c.step(2);
    await pick(c, /^The hall of Dragons$/);
    await pick(c, /^Turn it down$/);
    await until([c], () => /Invitation turned down/.test(window.__toastSeen));
    assert.equal(await c.eval((gid) => window.__fakeRTDB.data.has('hallInv/gHlC3/' + gid) || window.__fakeRTDB.data.has('guildHallGuest/' + gid + '/gHlC3'), GID), false);
    await pick(c, /^Back$/);

    // a reload inside (the page forgets the visit, the save keeps it): the visit goes on in the same hall (plan U013)
    assert.equal(await b.eval(() => window.__GHALL.saved && window.__GHALL.saved.gid), GID, 'the save knows the visit');
    await b.eval(() => window.__GHALL.forget());
    await until([b], (gid) => window.__GHALL.inside() && !!window.__GHALL.v && window.__GHALL.v.gid === gid && window.__GHALL.room().id !== 'rGH', 6000, GID);
    assert.equal(await b.eval(() => window.__GHALL.v.slots.s0 && window.__GHALL.v.slots.s0.k), 'table', 'with its furniture');
    // with no visit in the save (an older save, or one left behind): put outside, where the save says it came in
    await b.eval(() => window.__GHALL.off());
    await until([b], () => !window.__GHALL.inside(), 4000);
    assert.equal(await b.eval(() => window.__GHALL.saved), null, 'leaving forgets the visit');

    // a disband takes the hall and its guests with it
    await a.eval(() => window.__GHALL.off());
    await until([a], () => !window.__GHALL.inside(), 4000);
    await a.eval(() => window.__GG.kick('gHlB2'));
    await until([a], () => !window.__fakeRTDB.data.has('guildMembers/' + 'g_gHlA1' + '/gHlB2'));
    await a.eval(() => window.__GLD.disband());
    await until([a], () => ![...window.__fakeRTDB.data.keys()].some((k) => /^(guilds|guildHall|guildHallGuest)\/g_gHlA1/.test(k)), 8000);

    const want = /PERMISSION_DENIED: guildHall\/|guildHall values|guildHall slot|read guildHall/;
    for (const g of [a, b, c]) assert.deepEqual(await g.eval((src) => window.__fakeRTDB.rejected.filter((x) => !new RegExp(src).test(x)), want.source), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
