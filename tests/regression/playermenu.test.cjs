'use strict';
// SAT-ONLINE-020 (doc §35 U046 nearby player context, U064 inspect): another player's public card, and invite, challenge or
// block exactly that player (by uid), even when two players share a name.
// SAT-ONLINE-036 (owner 2026-10-19): the card opens from a button only: ⋯ next to the name in the player list (O), or T next
// to a player ("[T] Options" over their head). A click on a player or their name is a normal click (attack).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const shown = (g, id) => g.eval((i) => !document.getElementById(i).hidden, id);
const text = (g, id) => g.eval((i) => document.getElementById(i).textContent, id);
// a click on the name over a remote player's head
async function clickRemote(g, uid) {
  const p = await g.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 30); }, uid);
  await g.page.mouse.click(p.x, p.y);
  await g.step(2);
}
async function cardFromList(g, uid) {
  if (!(await shown(g, 'plW'))) await g.page.keyboard.press('KeyO');
  for (let i = 0; i < 40 && !(await g.eval((u) => !!document.querySelector('#plL button.pm[data-uid="' + u + '"]'), uid)); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  await g.eval((u) => document.querySelector('#plL button.pm[data-uid="' + u + '"]').click(), uid);
  await g.step(2);
}
// the strings drawn on the game canvas during one frame
async function drawn(g) {
  await g.eval(() => { const T = window.__drawn = []; const f = CanvasRenderingContext2D.prototype.fillText; if (!f.__spy) { CanvasRenderingContext2D.prototype.fillText = function (s, ...r) { (window.__drawn || []).push(String(s)); return f.call(this, s, ...r); }; CanvasRenderingContext2D.prototype.fillText.__spy = 1; } T.length = 0; });
  await g.step(1);
  return g.eval(() => window.__drawn.slice());
}

test('the card opens from ⋯ or T, never from a click; invite/duel/block go to that uid even with a twin name', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Twin', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Twin', hair: 2, hc: 1, skin: 0, top: 2 });
    // plains west of Winston (duels allowed), B right of A, C left of A, nothing else around
    for (const [g, dx] of [[a, 0], [b, 40], [c, -40]]) {
      await g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
    }
    await settle(a, b, c);
    const uidB = (await b.eval(() => Satisfy.local.net().uid)), uidC = (await c.eval(() => Satisfy.local.net().uid));
    await a.eval(() => { window.__G.P.acd = 0; });

    // a click on C's name attacks and opens nothing
    await clickRemote(a, uidC);
    assert.equal(await shown(a, 'pctx'), false, 'no card from a click');
    assert.ok(await a.eval(() => window.__G.P.acd > 0), 'the click is a normal attack');
    await a.eval(() => { window.__G.P.acd = 0; });

    // ⋯ next to C in the player list: its card shows, the list closes
    await cardFromList(a, uidC);
    assert.equal(await shown(a, 'pctx'), true);
    assert.equal(await shown(a, 'plW'), false);
    assert.equal(await text(a, 'pctxT'), 'Twin');
    assert.match(await text(a, 'pctxI'), /^Lv \d+/);
    assert.doesNotMatch(await text(a, 'pctxI'), /gold|Gold/, 'nothing private');
    assert.deepEqual(await a.eval(() => [...document.querySelectorAll('#plL .me button')].length), 0, 'no ⋯ on your own row');

    // invite from the card: only C (not the other Twin) gets it
    await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').click());
    await settle(a, b, c);
    assert.equal(await shown(c, 'partyInv'), true, 'C was invited');
    assert.equal(await shown(b, 'partyInv'), false, 'B, with the same name, was not');
    assert.equal((await c.eval(() => Satisfy.local.net().party.invite)).from, await a.eval(() => Satisfy.local.net().uid));

    // T next to B (20 px right of A, C is 40 px left): "[T] Options" shows over B only, and T opens B's card
    await a.page.keyboard.press('Escape'); await a.step(2);
    await b.eval(() => { window.__G.P.x = 90 * 16 + 20; });
    await settle(a, b, c);
    const tx = await drawn(a);
    assert.equal(tx.filter((x) => /^\[T\] Options/.test(x)).length, 1, 'one prompt: ' + tx.filter((x) => /\[/.test(x)));
    assert.ok(tx.includes('[T] Options · [P] Invite to party · [K] Duel'), 'B is not in the party: ' + tx.filter((x) => /\[/.test(x)));
    await a.page.keyboard.press('KeyT');
    await a.step(2);
    assert.equal(await a.eval(() => document.querySelector('#pctx').hidden), false);
    assert.equal(await text(a, 'pctxT'), 'Twin');
    await a.eval(() => document.querySelector('#pctx [data-act="pcDuel"]').click());
    await settle(a, b, c);
    assert.equal(await shown(b, 'duelInv'), true, 'B got the challenge');
    assert.equal(await shown(c, 'duelInv'), false);
    assert.equal((await a.eval(() => Satisfy.local.net().duel)).foe, uidB);

    // Block from the card toggles to Unblock; Escape closes the card without pausing
    await a.eval(() => document.querySelector('#pctx [data-act="pcBlock"]').click());
    await a.step(2);
    assert.deepEqual((await a.eval(() => Satisfy.local.net().blocked)).map((x) => x.uid), [uidB]);
    assert.equal(await text(a, 'pctxB'), 'Unblock');
    await a.eval(() => document.querySelector('#pctx [data-act="pcBlock"]').click());
    await a.step(2);
    assert.deepEqual(await a.eval(() => Satisfy.local.net().blocked), []);
    await a.page.keyboard.press('Escape');
    await a.step(2);
    assert.equal(await shown(a, 'pctx'), false);
    assert.equal(await a.eval(() => window.__G.mode), 'play');

    // a click on empty ground still attacks
    await a.eval(() => { window.__G.P.acd = 0; });
    const g0 = await a.eval(() => window.__G.toScreen(window.__G.P.x, window.__G.P.y - 60));
    await a.page.mouse.click(g0.x, g0.y);
    await a.step(1);
    assert.ok(await a.eval(() => window.__G.P.acd > 0), 'swung');
    assert.equal(await shown(a, 'pctx'), false);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('the card closes when that player goes away', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 30; });
    await settle(a, b);
    await a.page.keyboard.press('KeyT');
    await a.step(2);
    assert.equal(await shown(a, 'pctx'), true);
    await b.close();
    for (let i = 0; i < 6 && (await shown(a, 'pctx')); i++) { await a.step(60); await a.page.waitForTimeout(50); }
    assert.equal(await shown(a, 'pctx'), false);
    assert.match(await text(a, 'toasts'), /Faker is not nearby any more/);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});

// the list reads the whole shard online, so ⋯ also opens the card of a player far away (their listed copy). Invites and
// duels only reach a player who can see you, so the card asks you to come closer for those.
test('online: ⋯ on a far player in the list opens their card; invite/duel wait until you are close, Block works', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gNearA1', 'Ahmed'], ['b', 'gFarB22', 'Bassem']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n + '_1'); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 2000; }); // well outside the 800 px interest range
    await settle(a, b); await settle(a, b);
    assert.equal(await a.eval(() => Satisfy.local.net().remotes.length), 0, 'B is not downloaded');
    await cardFromList(a, 'gFarB22');
    assert.equal(await shown(a, 'pctx'), true);
    assert.equal(await text(a, 'pctxT'), 'Bassem_1');
    await a.step(30);
    assert.equal(await shown(a, 'pctx'), true, 'the listed copy keeps the card open');
    assert.match(await text(a, 'pctxI'), /Far away: come closer to invite or duel/);
    assert.deepEqual(await a.eval(() => ['pcInvite', 'pcDuel'].map((x) => document.querySelector('#pctx [data-act="' + x + '"]').disabled)), [true, true], 'invites and duels only reach players you can see');
    // Block works by uid from anywhere
    await a.eval(() => document.querySelector('#pctx [data-act="pcBlock"]').click()); await a.step(2);
    assert.deepEqual((await a.eval(() => Satisfy.local.net().blocked)).map((x) => x.uid), ['gFarB22']);
    await a.eval(() => document.querySelector('#pctx [data-act="pcBlock"]').click()); await a.step(2);
    assert.deepEqual(await a.eval(() => Satisfy.local.net().blocked), []);
    // walking up to them turns it into the live card
    await b.eval(() => { window.__G.P.x -= 1980; });
    for (let i = 0; i < 40 && (await a.eval(() => Satisfy.local.net().remotes.length)) === 0; i++) await settle(a, b);
    await a.step(3);
    assert.equal(await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').disabled), false, 'close now');
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
