'use strict';
// SAT-ONLINE-010 (doc U006 / T07): one active session per Google account. A second tab with the same
// account takes over; the first steps aside without deleting the shared presence node, and "Play here"
// takes the account back.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const UID = 'gOneAccountTwoTabs';
async function until(g, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
async function online(g, name) {
  await g.eval(([n, uid]) => { window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = uid; document.getElementById('onlineBtn').click(); }, [name, UID]);
  await until(g, () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
}
const replaced = (g) => g.eval(() => !document.getElementById('netRepW').hidden);

test('a second tab with the same account takes over; Play here takes it back', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await online(a, 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await a.step(30);
    assert.equal(await replaced(a), false);
    const sidA = await a.eval(() => Satisfy.local.net().sid);

    const b = await H.openGame({ ctx, query: '?net=online&slot=b' });
    await online(b, 'Ahmed');
    await until(a, () => !document.getElementById('netRepW').hidden);
    assert.equal(await a.eval(() => document.getElementById('netRepT').textContent), 'Your account is now playing on another device or tab');
    assert.equal(await a.eval(() => Satisfy.local.net()), null, 'A stopped its online session');
    assert.equal(await replaced(b), false);
    // A stepped aside without removing the node B now writes, and cancelled its onDisconnect
    const log = await a.eval(() => window.__fakeRTDB.log.filter((l) => l.path === 'presence/satisfy/main/' + 'gOneAccountTwoTabs').map((l) => l.op));
    assert.ok(log.includes('cancelOnDisconnect'));
    assert.equal(log.lastIndexOf('remove'), -1, 'A never removed the shared node');
    assert.notEqual(await b.eval(() => Satisfy.local.net().sid), sidA);

    // Play here: A saves, reloads, signs back in from the saved session and claims the account
    await Promise.all([a.page.waitForNavigation(), a.eval(() => setTimeout(() => document.getElementById('netRepBtn').click(), 0))]);
    await a.step(2);
    await until(a, () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 20000); // reload + sign-in; slow when the machine is busy
    await until(b, () => !document.getElementById('netRepW').hidden);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
