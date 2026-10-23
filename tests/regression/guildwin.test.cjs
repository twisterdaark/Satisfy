'use strict';
// owner 2026-10-23: the guild is a window like the bag and the status, with everything in it: Info, Members (online or
// last seen) and Manage (every guild page inside the window); invite by account ID, hand over the lead, leave, and a
// Disband that asks for the guild's name. In the party, the leader makes another member the leader from the panel.
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
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
const pickW = (g, re) => g.eval((src) => { const r = new RegExp(src), b = [...document.querySelectorAll('#gwB .gwopts button')].find((x) => r.test(x.textContent)); if (!b) throw new Error('no option ' + src + ' in ' + window.__GDW.opts().join(' | ')); b.click(); }, re.source);
async function typeLine(g, v) { await until([g], () => !!document.getElementById('lineIn')); await g.eval((x) => { const i = document.getElementById('lineIn'); i.value = x; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }, v); await g.step(2); }

test('the guild window: tabs, invite by ID, members, Manage inside the window, hand over, disband by name; make a party leader', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gGwA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gGwB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.data.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    for (const g of [a, b]) await g.eval(() => { const D = window.__fakeRTDB.data; [['gGwA1', 'Ahmed'], ['gGwB2', 'Bassem']].forEach(([u, n]) => { D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); }); });
    await b.eval(() => { window.__G.P.x += 20; });
    for (let i = 0; i < 8; i++) { for (const g of [a, b]) await g.step(7); await a.page.waitForTimeout(30); }
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 9000; window.__GG.create('Black Dragons'); });
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });

    // G: the window, on Info; Members lists the master
    await a.page.keyboard.press('KeyG'); await a.step(2);
    assert.equal(await a.eval(() => window.__G.mode), 'guild');
    assert.equal(await a.eval(() => document.getElementById('dialog').hidden), true, 'not a dialog');
    assert.match(await a.eval(() => document.getElementById('gwT').textContent), /Black Dragons/);
    assert.match(await a.eval(() => window.__GDW.text()), /Lv 1/);
    assert.deepEqual(await a.eval(() => [...document.querySelectorAll('#gwTabs button')].map((x) => x.textContent)), ['Info', 'Members', 'Manage']);
    assert.deepEqual(await a.eval(() => [...document.querySelectorAll('#gwF button')].map((x) => x.textContent)), ['Invite a player', 'Guild chat', 'Disband the guild'], 'a master alone: no hand over, no leave');

    // invite by account ID; B joins from the prompt
    await click(a, '#gwF [data-gwf="inv"]');
    await typeLine(a, 'Bassem');
    assert.equal(await a.eval(() => window.__G.mode), 'guild', 'back in the window after typing');
    await until([b], () => !document.getElementById('guildInv').hidden);
    await click(b, '#guildInv [data-act="gdYes"]');
    await until([a], () => Object.keys(window.__GG.state().members).length === 2);
    await click(a, '#gwTabs [data-gwtab="m"]');
    await until([a], () => document.querySelectorAll('#gwB [data-gwmem]').length === 2);
    const rows = await a.eval(() => [...document.querySelectorAll('#gwB [data-gwmem]')].map((x) => x.textContent));
    assert.match(rows[0], /● Ahmed\s*Master/); assert.match(rows[1], /Bassem\s*Member/);
    // a member's page opens in the window
    await click(a, '#gwB [data-gwmem="gGwB2"]'); await a.step(2);
    assert.ok((await a.eval(() => window.__GDW.opts())).some((x) => /Make Bassem an officer/.test(x)));
    // Manage: the old guild panel, inside the window
    await click(a, '#gwTabs [data-gwtab="x"]'); await a.step(2);
    assert.equal(await a.eval(() => document.getElementById('dialog').hidden), true);
    assert.ok((await a.eval(() => window.__GDW.opts())).includes('Vault (0)'));
    await pickW(a, /^Vault/); await a.step(2);
    assert.match(await a.eval(() => window.__GDW.text()), /Guild vault|vault/i);

    // hand over from the footer: B is the master, A gets Leave instead of Disband
    await click(a, '#gwF [data-gwf="hand"]'); await a.step(2);
    await pickW(a, /^Bassem/); await a.step(2);
    await pickW(a, /^Yes$/); await a.step(2);
    await until([b], () => window.__GG.state().rank === 'm');
    await until([a], () => window.__GG.state().rank !== 'm');
    await a.eval(() => window.__GDW.tab('i')); await a.step(2);
    assert.ok((await a.eval(() => [...document.querySelectorAll('#gwF button')].map((x) => x.textContent))).includes('Leave the guild'));

    // B disbands: the wrong name does nothing, the right one ends the guild for both
    await b.page.keyboard.press('KeyG'); await b.step(2);
    await click(b, '#gwF [data-gwf="dis"]'); await b.step(2);
    assert.match(await b.eval(() => window.__GDW.text()), /cannot be undone/);
    await pickW(b, /^Disband the guild$/); await b.step(2);
    await typeLine(b, 'Black');
    assert.match(await b.eval(() => document.getElementById('toasts').textContent), /doesn't match/);
    assert.equal(await b.eval(() => window.__GG.state().rank), 'm');
    await click(b, '#gwF [data-gwf="dis"]'); await b.step(2);
    await pickW(b, /^Disband the guild$/); await b.step(2);
    await typeLine(b, 'black dragons');
    await until([a, b], () => { const s = window.__GG.state(); return !s || !s.gid; }, 15000);
    await until([a, b], () => !window.__G.S.guild);

    // the party: A leads, makes B the leader from the panel
    await a.page.keyboard.press('Escape'); await b.page.keyboard.press('Escape'); await a.step(2); await b.step(2);
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gGwB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3);
    await a.eval(() => document.querySelector('[data-act="pInv"]').click()); await a.step(2);
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2, 15000);
    await until([a], () => !!document.querySelector('#partyL button.mkld'));
    await click(a, '#partyL button.mkld');
    for (let i = 0; i < 12; i++) { for (const g of [a, b]) await g.step(10); await a.page.waitForTimeout(30); } // both pages run: the members show the new id
    await until([b], () => /made you the party leader/.test(document.getElementById('toasts').textContent));
    await until([b], () => !!document.querySelector('#partyL button.mkld'));
    await until([a], () => !document.querySelector('#partyL button.mkld') && document.getElementById('partyL').textContent.includes('Bassem'));
    assert.match(await a.eval(() => document.querySelector('#partyL .ld').textContent), /Bassem/, 'the star is on B');
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('a guild founded offline: Invite says why and offers to take it online; same name, level and land, then invites work', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await g.eval(() => { const D = window.__fakeRTDB.data; D.set('accountIds/gGwO1', 'Omar'); D.set('handles/omar', 'gGwO1'); window.__fakeRTDB.nextName = 'Omar'; window.__fakeRTDB.nextUid = 'gGwO1'; document.getElementById('onlineBtn').click(); });
    await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    for (let i = 0; i < 6; i++) { await g.step(7); await g.page.waitForTimeout(30); }
    // as an old save would have it: a guild only on this device, level 3, holding a land
    const land = await g.eval(() => { const S = window.__G.S, WS = window.__GU.WS, me = window.__GDW.pid(), k = Object.keys(WS.terr)[0];
      WS.guilds.g_old = { id: 'g_old', name: 'Shadow Hunters', master: me, lv: 1, xp: 9000, col: '#5aa0ff', members: { [me]: { n: 'Omar', rk: 'm', c: 9000 } } }; S.guild = 'g_old'; WS.terr[k].own = 'g_old'; return k; });
    await g.page.keyboard.press('KeyG'); await g.step(2);
    assert.match(await g.eval(() => window.__GDW.text()), /lives only on this device/);
    const foot = await g.eval(() => [...document.querySelectorAll('#gwF button')].map((x) => x.textContent));
    assert.ok(foot.includes('Invite a player') && foot.includes('Take the guild online'), foot.join(' | '));
    await click(g, '#gwF [data-gwf="inv"]'); await g.step(2);
    assert.match(await g.eval(() => window.__GDW.text()), /founded offline, so nobody can join it/);
    await pickW(g, /^Take the guild online$/); await g.step(2);
    await pickW(g, /^Take the guild online$/); await g.step(2);
    await until([g], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    assert.equal(await g.eval(() => window.__GG.state().guild.name), 'Shadow Hunters');
    assert.equal(await g.eval(() => window.__G.S.guild), 'g_gGwO1');
    assert.equal(await g.eval((k) => window.__GU.WS.terr[k].own, land), 'g_gGwO1', 'the land moved with it');
    assert.equal(await g.eval(() => !!window.__GU.WS.guilds.g_old), false);
    for (let i = 0; i < 4; i++) { await g.step(90); await g.page.waitForTimeout(20); }
    await until([g], () => window.__GG.state().xp >= 9000, 15000);
    await g.eval(() => window.__GDW.tab('i')); await g.step(2);
    assert.match(await g.eval(() => window.__GDW.text()), /The guild is online/);
    assert.ok((await g.eval(() => [...document.querySelectorAll('#gwF button')].map((x) => x.textContent))).includes('Guild chat'));
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
