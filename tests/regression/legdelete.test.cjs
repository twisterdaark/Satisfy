'use strict';
// A legendary class goes back to the world when its holder is deleted (owner 2026-10-26: "make sure deleting the class, if you
// are a legend, lets people get the class again from the start instead of it being lost"): A becomes the Sword Saint, deletes
// that character from the cloud list, and B can become the Sword Saint.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const P0 = {};

async function until(games, fn, ms = 15000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn + ' on ' + games.map((g) => g === P0.a ? 'A' : 'B').join(','));
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}

test('deleting a legendary character frees its class for everyone', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {}; P0.a = null;
    for (const [k, uid, name, look] of [['a', 'gLdA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gLdB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
      await H.newGame(g, look);
    }
    const { a, b } = P; P0.a = a;
    await until([a, b], () => !!window.__GL.db());
    // A becomes the Sword Saint
    await a.eval(() => { window.__G.S.cls = 'warrior'; window.__GL.become('muller'); });
    await until([a], () => window.__G.S.cls === 'saint');
    await until([a], () => !!window.__fakeRTDB.data.get('world/satisfy/legends/muller'));
    // its save goes up, A goes back to the title screen and deletes that character from the cloud list
    const pid = await a.eval(() => { window.__G.save(true); return window.__G.S.pid; });
    await until([a], ([u, p]) => window.__fakeRTDB.data.has('cloudSaves/' + u + '/' + p), 15000, ['gLdA1', pid]);
    await a.eval(() => window.__G.act('quit'));
    await a.waitMode('title');
    await a.eval(() => document.getElementById('cloudBtn').click());
    await until([a], () => document.querySelectorAll('#cloudL .cr button').length > 0);
    await a.eval(() => { const btn = document.querySelector('#cloudL .cr button'); btn.click(); btn.click(); });   // Delete asks for a second click
    await until([a], () => !window.__fakeRTDB.data.get('world/satisfy/legends/muller'));
    // B can become the Sword Saint now
    await until([b], () => { const L = window.__GL.legends(); return !(L && L.muller); });
    await b.eval(() => { window.__G.S.cls = 'warrior'; window.__GL.become('muller'); });

    await until([b], () => window.__G.S.cls === 'saint');
    assert.equal(await b.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/muller').uid), 'gLdB2');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
