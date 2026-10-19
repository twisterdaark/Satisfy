'use strict';
// SAT-ONLINE-016 (doc §29 T31): party chat with the real keys, over the local transport and the fake
// Firebase (inbox + rules), and the block list (⊘ in the party list hides chat and later invites).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const lines = (g) => g.eval(() => [...document.querySelectorAll('#chatL div')].map((d) => d.textContent));

async function partyOf2(mode) {
  const ctx = await H.newContext(mode === 'online' ? { scripts: [H.FAKE_FIREBASE] } : {});
  const a = await H.openGame({ ctx, query: `?net=${mode}&slot=a` });
  const b = await H.openGame({ ctx, query: `?net=${mode}&slot=b` });
  if (mode === 'online') {
    for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
      await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
      await until(g, () => !!Satisfy.local.net());
    }
  }
  await H.newGame(a, LOOK_A);
  await H.newGame(b, LOOK_B);
  await b.eval(() => { window.__G.P.x += 20; });
  await settle(a, b);
  await a.page.keyboard.press('KeyP');
  await settle(a, b);
  await until(b, () => !document.getElementById('partyInv').hidden);
  await b.page.keyboard.press('KeyY');
  await settle(a, b);
  for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
  return { ctx, a, b };
}

for (const mode of ['local', 'online']) {
  test(`[${mode}] Enter opens party chat; lines reach the other member as plain text; typing triggers no game keys`, async () => {
    const { ctx, a, b } = await partyOf2(mode);
    try {
      await settle(a, b);
      // no lines yet: no box (owner, SAT-ONLINE-026: don't crowd the screen); Enter brings it up
      assert.equal(await a.eval(() => document.getElementById('chatW').hidden), true, 'no empty chat box');
      await a.page.keyboard.press('Enter');
      await a.step(2);
      assert.equal(await a.eval(() => document.getElementById('chatW').hidden), false, 'Enter shows the chat box');
      assert.equal(await a.eval(() => document.activeElement && document.activeElement.id), 'chatIn');
      // P, K, E, I and Space are game keys; inside the chat line they are just letters
      await a.page.keyboard.type('pkei hi <b>bold</b> 👋');
      await a.step(2);
      assert.equal(await a.eval(() => window.__G.mode), 'play', 'no inventory or dialog opened');
      assert.equal(await a.eval(() => Satisfy.local.net().duel.phase), 'idle', 'K did not challenge');
      await a.page.keyboard.press('Enter');
      await settle(a, b);
      await until(b, () => document.querySelectorAll('#chatL div').length === 1);
      assert.deepEqual(await lines(b), ['Grid: pkei hi <b>bold</b> 👋']);
      assert.equal(await b.eval(() => document.querySelectorAll('#chatL b').length), 1, 'the markup arrived as text, not as elements');
      assert.deepEqual(await lines(a), ['Grid: pkei hi <b>bold</b> 👋']);
      assert.equal(await a.eval(() => document.getElementById('chatIn').hidden), true, 'Enter sends and closes');

      // B answers; Escape closes without sending
      await b.page.keyboard.press('Enter');
      await b.page.keyboard.type('ok');
      await b.page.keyboard.press('Escape');
      await b.step(2);
      assert.equal(await b.eval(() => window.__G.mode), 'play', 'Escape in the chat line does not pause');
      await b.page.keyboard.press('Enter');
      await b.page.keyboard.type('مرحبا');
      await b.page.keyboard.press('Enter');
      await settle(a, b);
      await until(a, () => document.querySelectorAll('#chatL div').length === 2);
      assert.deepEqual(await lines(a), ['Grid: pkei hi <b>bold</b> 👋', 'Faker: مرحبا']);
      if (mode === 'online') {
        const types = await a.eval(() => window.__fakeRTDB.log.filter((l) => l.op === 'push').map((l) => l.path.split('/')[0]));
        assert.deepEqual([...new Set(types)], ['inbox']);
        for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
      }
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally { await ctx.close(); }
  });
}

test('⊘ blocks a party member: their lines and their next invite never show; Unblock all clears it', async () => {
  const { ctx, a, b } = await partyOf2('local');
  try {
    await settle(a, b);
    // B blocks A from the party list
    await b.eval(() => document.querySelector('#partyL button.blk').click());
    await b.step(2);
    assert.match(await b.eval(() => document.getElementById('toasts').textContent), /Grid is blocked/);
    const blocked = await b.eval(() => Satisfy.local.net().blocked);
    assert.deepEqual(blocked.map((x) => x.handle), ['Grid']);
    assert.ok(await b.eval(() => !!JSON.parse(localStorage.getItem('satisfy_blocked'))));
    await a.page.keyboard.press('Enter');
    await a.page.keyboard.type('can you hear me');
    await a.page.keyboard.press('Enter');
    await settle(a, b);
    assert.deepEqual(await lines(a), ['Grid: can you hear me']);
    assert.deepEqual(await lines(b), [], 'hidden for B');
    // B leaves; A invites again: no prompt on B, and A gets no answer
    await b.eval(() => document.querySelector('#partyW [data-act="pLeave"]').click());
    await settle(a, b);
    await a.step(400); await b.step(400); // the leader notices a member gone after a 5 s grace
    await until(a, () => ((Satisfy.local.net().party || {}).members || []).length < 2);
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await settle(a, b);
    assert.equal(await b.eval(() => document.getElementById('partyInv').hidden), true, 'no invite prompt from a blocked player');
    assert.equal(await b.eval(() => Satisfy.local.net().party.invite), null);
    // the block list is per device; clearing it lets invites through again
    await b.eval(() => Satisfy.chat.blocklist().clear());
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    // Block on the invite prompt: blocks and declines
    await b.eval(() => document.querySelector('#partyInv [data-act="pBlock"]').click());
    await settle(a, b);
    assert.equal(await b.eval(() => document.getElementById('partyInv').hidden), true);
    assert.deepEqual((await b.eval(() => Satisfy.local.net().blocked)).map((x) => x.handle), ['Grid']);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
