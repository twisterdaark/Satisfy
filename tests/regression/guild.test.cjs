'use strict';
// SAT-ONLINE-046 (owner 2026-10-19; Claude-B #13 item 21): guilds online, over the fake Firebase with the rules' checks.
// A founds a guild (it is made in the database); A invites B from B's card, B joins from the prompt; everyone near sees
// «guild» under B's name; the master makes B an officer; B invites C and removes C, who is told; A disbands and B is told.
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
const shown = (g, id) => g.eval((i) => !document.getElementById(i).hidden, id);
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
const toasts = (g) => g.eval(() => document.getElementById('toasts').textContent);
async function openCard(g, uid) {
  const p = await g.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; return true; }, uid);
  assert.ok(p);
  await g.step(3);
  await g.page.keyboard.press('KeyT'); await g.step(2);
  assert.equal(await shown(g, 'pctx'), true, 'the card is open');
}

test('online guilds: found, invite from the card, join, ranks, remove, disband; the guild shows under the name', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gGdA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gGdB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }], ['c', 'gGdC3', 'Carim', { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b, c } = P;
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x += 40; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 9000; });
    await settle(a, b, c);

    // A founds "Black Dragons": it is in the database, A is its master, the gold is paid once
    await a.eval(() => window.__GG.create('Black Dragons'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    assert.equal(await a.eval(() => window.__G.S.gold), 4000);
    assert.equal(await a.eval(() => window.__G.S.guild), 'g_gGdA1');
    assert.equal(await a.eval(() => window.__G.S.gon), 'g_gGdA1');
    assert.match(await toasts(a), /Black Dragons/);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.data.get('guildNames/black dragons')), 'g_gGdA1');
    // B can't take the same name in another case
    await b.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 9000; window.__GG.create('BLACK dragons'); });
    await until([b], () => /already|taken|in use/i.test(document.getElementById('toasts').textContent));
    assert.equal(await b.eval(() => window.__G.S.gold), 9000, 'nothing paid for a name that is taken');

    // A invites B from B's card; B joins from the prompt
    await openCard(a, 'gGdB2');
    assert.equal(await shown(a, 'pctxG'), true, 'a master sees Guild invite on the card');
    await click(a, '#pctx [data-act="pcGuild"]');
    await until([b], () => !document.getElementById('guildInv').hidden);
    assert.match(await b.eval(() => document.getElementById('guildInvT').textContent), /Ahmed invites you to the guild Black Dragons/);
    await click(b, '#guildInv [data-act="gdYes"]');
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await until([a], () => Object.keys(window.__GG.state().members).length === 2);
    assert.equal(await b.eval(() => window.__G.S.guild), 'g_gGdA1');
    await b.step(3);
    assert.equal(await shown(b, 'guildInv'), false, 'the prompt is gone');
    // everyone near sees «Black Dragons» under B's name (C too, who is in no guild)
    await settle(a, b, c);
    await until([c], () => { const x = window.__GG.of('gGdB2'); return !!x && x.n === 'Black Dragons'; });
    assert.equal((await a.eval(() => window.__GG.of('gGdB2'))).n, 'Black Dragons');
    // the shared guild: B's contribution is A's guild experience too
    await b.eval(() => window.__GG.contribute(700));
    for (let i = 0; i < 4; i++) { await b.step(90); await b.page.waitForTimeout(20); } // the heartbeat sends a new contribution within 5 s of game time
    await until([a], () => window.__GG.state().xp >= 700, 15000);

    // guild chat (SAT-ONLINE-049): B writes in the guild tab; A gets it as a guild line, C (in no guild) gets nothing
    await b.page.keyboard.press('Enter'); await b.step(2);
    await b.eval(() => document.querySelector('#chatTabs [data-ch="guild"]').click()); await b.step(2);
    assert.match(await b.eval(() => document.getElementById('chatIn').placeholder), /Guild chat/);
    await b.page.keyboard.type('for the guild only');
    await b.page.keyboard.press('Enter'); await b.step(2);
    await until([a], () => [...document.querySelectorAll('#chatL div.guild')].some((d) => /Bassem: for the guild only/.test(d.textContent)));
    await settle(a, b, c);
    assert.equal(await c.eval(() => [...document.querySelectorAll('#chatL div')].some((d) => /for the guild only/.test(d.textContent))), false, 'not for others');
    assert.equal(await c.eval(() => !document.querySelector('#chatTabs [data-ch="guild"]') || document.querySelector('#chatTabs [data-ch="guild"]').hidden), true, 'no guild tab outside a guild');
    // /g from any tab
    await a.page.keyboard.press('Enter'); await a.step(2);
    await a.page.keyboard.type('/g welcome');
    await a.page.keyboard.press('Enter'); await a.step(2);
    await until([b], () => [...document.querySelectorAll('#chatL div.guild')].some((d) => /Ahmed: welcome/.test(d.textContent)));

    // the vault (SAT-ONLINE-050): B puts 9 wood in; A sees it and takes it out; B puts a piece in, and A and B both try
    // to take it at once: one of them gets it
    await b.eval(() => { window.__G.S.mats.wood = 9; });
    assert.equal(await b.eval(() => window.__GG.put('wood')), true);
    await until([a], () => Object.keys(window.__GG.vault()).length === 1);
    assert.equal(await b.eval(() => window.__G.S.mats.wood || 0), 0, 'out of B\u2019s bag');
    const vw = await a.eval(() => Object.keys(window.__GG.vault())[0]);
    assert.equal(await a.eval(() => window.__G.S.mats.wood || 0), 0);
    await a.eval((v) => window.__GG.take(v), vw);
    await until([a], () => (window.__G.S.mats.wood || 0) === 9);
    await until([b], () => Object.keys(window.__GG.vault()).length === 0);
    const pc = await b.eval(() => { const G = window.__G, S = G.S, rc = Satisfy.local.defs().RC.find((r) => r.slot && r.slot !== 'w' && r.def); const it = { uid: ++S.uid, id: rc.id, slot: rc.slot, r: 2, dur: 100, def: 7 }; S.items.push(it); Satisfy.ids.ensure(S); return it.id; });
    assert.equal(await b.eval((k) => window.__GG.put(k), pc), true);
    await until([a, b], () => Object.keys(window.__GG.vault()).length === 1);
    const vp = await a.eval(() => Object.keys(window.__GG.vault())[0]);
    assert.equal(await b.eval((v) => window.__GG.canTake(v), vp), true, 'a member takes back its own');
    const has = (g) => g.eval((k) => window.__G.S.items.filter((i) => i.id === k && i.r === 2 && i.def === 7).length, pc);
    const n0 = (await has(a)) + (await has(b));
    await Promise.all([a.eval((v) => window.__GG.take(v), vp), b.eval((v) => window.__GG.take(v), vp)]);
    await until([a, b], () => Object.keys(window.__GG.vault()).length === 0);
    await settle(a, b);
    assert.equal((await has(a)) + (await has(b)) - n0, 1, 'one of them got the piece');

    // A makes B an officer; B invites C; C joins; B removes C, who is told
    await a.eval(() => window.__GG.rank('gGdB2', 'o'));
    await until([b], () => window.__GG.state().rank === 'o');
    await openCard(b, 'gGdC3');
    assert.equal(await shown(b, 'pctxG'), true, 'an officer invites too');
    await click(b, '#pctx [data-act="pcGuild"]');
    await until([c], () => !document.getElementById('guildInv').hidden);
    await click(c, '#guildInv [data-act="gdYes"]');
    await until([c], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await b.eval(() => window.__GG.kick('gGdC3'));
    await until([c], () => /You were removed from Black Dragons/.test(document.getElementById('toasts').textContent));
    assert.equal(await c.eval(() => window.__G.S.guild), '');
    // B (officer) can't remove the master
    await assert.rejects(b.eval(() => window.__GG.kick('gGdA1')));

    // A disbands: B is told, the name is free again
    await a.eval(() => window.__GG.leave());
    await until([b], () => /Black Dragons was disbanded/.test(document.getElementById('toasts').textContent));
    assert.equal(await b.eval(() => window.__G.S.guild), '');
    assert.equal(await a.eval(() => window.__G.S.guild), '');
    assert.equal(await a.eval(() => window.__fakeRTDB.data.has('guildNames/black dragons')), false);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildNames taken|guildVault(Taken)? take|PERMISSION_DENIED: guildVaultTaken/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
