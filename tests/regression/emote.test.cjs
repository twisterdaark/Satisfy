'use strict';
// SAT-ONLINE-022 (doc §35 U061): emotes from a fixed list travel as PlayerPublic.em; every client shows the same one.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const remoteEm = (g) => g.eval(() => (Satisfy.local.net().remotes[0] || {}).em);

for (const mode of ['local', 'online']) {
  test(`[${mode}] V opens the emotes; Dance plays for 3 s on both screens; one every 2 s`, async () => {
    const ctx = await H.newContext(mode === 'online' ? { scripts: [H.FAKE_FIREBASE] } : {});
    try {
      const a = await H.openGame({ ctx, query: `?net=${mode}&slot=a` });
      const b = await H.openGame({ ctx, query: `?net=${mode}&slot=b` });
      if (mode === 'online') {
        for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
          await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
          await until(g, () => !!Satisfy.local.net());
        }
      }
      await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
      await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
      await b.eval(() => { window.__G.P.x += 30; });
      await settle(a, b);
      await a.page.keyboard.press('KeyV');
      await a.step(1);
      assert.equal(await a.eval(() => document.getElementById('emoW').hidden), false);
      assert.deepEqual(await a.eval(() => [...document.querySelectorAll('#emoW button')].map((x) => x.textContent)), ['Wave', 'Dance', 'Point', 'Cheer']);
      await a.eval(() => document.querySelector('#emoW [data-emo="dance"]').click());
      await a.step(2);
      assert.equal(await a.eval(() => document.getElementById('emoW').hidden), true, 'picking closes the list');
      assert.equal((await a.eval(() => Satisfy.local.playerPublic())).em, 'dance');
      await settle(a, b);
      await until(b, () => (Satisfy.local.net().remotes[0] || {}).em === 'dance');
      // another emote right away is refused
      await a.page.keyboard.press('KeyV');
      await a.eval(() => document.querySelector('#emoW [data-emo="cheer"]').click());
      await a.step(2);
      assert.match(await a.eval(() => document.getElementById('toasts').textContent), /Wait a moment before the next emote/);
      assert.equal((await a.eval(() => Satisfy.local.playerPublic())).em, 'dance');
      // after 3 s it ends everywhere
      await a.step(200);
      await settle(a, b);
      await until(b, () => (Satisfy.local.net().remotes[0] || {}).em === null);
      assert.equal(await remoteEm(b), null);
      // Esc closes the list without pausing
      await a.page.keyboard.press('KeyV');
      await a.step(1);
      await a.page.keyboard.press('Escape');
      await a.step(2);
      assert.equal(await a.eval(() => document.getElementById('emoW').hidden), true);
      assert.equal(await a.eval(() => window.__G.mode), 'play');
      if (mode === 'online') for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally { await ctx.close(); }
  });
}
