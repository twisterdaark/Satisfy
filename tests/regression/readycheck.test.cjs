'use strict';
// v3.23 (plan U170) A ready check before a raid: the party leader asks (the ✓? button, or walking into the Warlord's
// Throne), every member answers Y or N within 20 s, and everyone counts the answers. It rides in the party chat, so it
// needs nothing new on the server (over the fake Firebase: the inbox path and its rules).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { let ok = true; for (const g of games) if (!(await g.eval(fn))) ok = false; if (ok) return; for (const g of games) await g.step(3); await games[0].page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));

test('a ready check: the leader asks, a member answers, the Throne waits for it', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
  try {
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until([g], () => !!Satisfy.local.net());
    }
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    await until([a, b], () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    assert.equal(await a.eval(() => !document.getElementById('pRdyB').hidden), true, "the leader's ✓? button");
    assert.equal(await b.eval(() => document.getElementById('pRdyB').hidden), true, 'not on a member');
    // the Throne's stairs wait for a check, and start one
    assert.equal(await a.eval(() => window.__GRDY.gate()), false, 'held at the stairs');
    await until([b], () => !document.getElementById('rdyBox').hidden);
    assert.match(await b.eval(() => document.getElementById('rdyT').textContent), /Grid asks: ready\? "The Warlord's Throne"/);
    assert.equal(await a.eval(() => window.__GRDY.ask('')), false, 'one check at a time');
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    await until([a], () => window.__GRDY.ok());
    assert.match(await toasts(a), /The whole party is ready!/);
    assert.equal(await b.eval(() => document.getElementById('rdyBox').hidden), true);
    assert.equal(await a.eval(() => window.__GRDY.gate()), true, 'then the way is open');
    assert.ok((await b.eval(() => window.__GN.chat().filter((l) => l.ch === 'party').map((l) => l.text).join('|'))).includes('✓ ready'), 'the answer is a party chat line');
    // a member who isn't ready
    assert.equal(await a.eval(() => window.__GRDY.ask('the Hydra')), true);
    await until([b], () => !document.getElementById('rdyBox').hidden);
    await b.page.keyboard.press('KeyN'); await settle(a, b);
    await until([a], () => !window.__GRDY.R);
    assert.match(await toasts(a), /Not ready: Faker/);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

// (review) a party of three: each member counts their own answer with the others', so the last to answer closes it
async function cardFromList(g, uid) {
  if (await g.eval(() => document.getElementById('plW').hidden)) await g.page.keyboard.press('KeyO');
  await until([g], () => true);
  for (let i = 0; i < 60 && !(await g.eval((u) => !!document.querySelector('#plL button.pm[data-uid="' + u + '"]'), uid)); i++) { await g.step(3); await g.page.waitForTimeout(40); }
  await g.eval((u) => document.querySelector('#plL button.pm[data-uid="' + u + '"]').click(), uid); await g.step(2);
}
const st = (g) => g.eval(() => ({ R: !!window.__GRDY.R, box: !document.getElementById('rdyBox').hidden, ok: window.__GRDY.ok() }));

test('a party of three: both members answer, the last closes it, and a No ends it for all', async () => {
  const ctx = await H.newContext();
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; }); await c.eval(() => { window.__G.P.x -= 30; });
    await settle(a, b, c);
    for (const g of [b, c]) {
      const uid = await g.eval(() => Satisfy.local.net().uid);
      await cardFromList(a, uid); await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').click()); await settle(a, b, c);
      await until([g], () => !document.getElementById('partyInv').hidden); await g.page.keyboard.press('KeyY'); await settle(a, b, c);
    }
    await until([a, b, c], () => Satisfy.local.net().party.members.length === 3);
    if (!(await a.eval(() => document.getElementById('plW').hidden))) await a.page.keyboard.press('KeyO');
    assert.equal(await a.eval(() => window.__GRDY.ask('the Throne')), true);
    await until([b, c], () => !document.getElementById('rdyBox').hidden);
    await c.page.keyboard.press('KeyY'); await settle(a, b, c);
    assert.deepEqual(await st(b), { R: true, box: true, ok: false }, "C's yes leaves B's question open");
    await b.page.keyboard.press('KeyY'); await settle(a, b, c); await settle(a, b, c);
    for (const g of [a, b, c]) assert.equal((await st(g)).ok, true, 'all ready, on every screen');
    assert.equal(await a.eval(() => window.__GRDY.gate()), true);
    // a No: over for everyone at once
    await a.page.waitForTimeout(7100);
    assert.equal(await a.eval(() => window.__GRDY.ask('again')), true);
    await until([b, c], () => !document.getElementById('rdyBox').hidden);
    await b.page.keyboard.press('KeyN'); await settle(a, b, c); await settle(a, b, c);
    for (const g of [a, c]) assert.match(await toasts(g), /Not ready: Faker/);
    assert.equal(await c.eval(() => document.getElementById('rdyBox').hidden), true, "C's question closes too");
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
