'use strict';
// SAT-ONLINE-056 (Claude-B #13 handoff): a world boss's respawn timer is shared. A kills Trauka on the peak; B, far away in
// another part of the world, finds the dragon dead too, for the same half hour, and it stays dead when B walks up to it.
// The rules take one timer per kill: B can't reset a running one.
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
const dragon = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); return m && { dead: !!m.dead, rt: m.rt || 0 }; });

test('online: a dragon killed by one player is dead for everyone, for the same half hour', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gWbA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gWbB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    // B stays in Winston, far from the peak; both have a live dragon
    assert.deepEqual(await dragon(a), { dead: false, rt: 0 });
    assert.equal((await dragon(b)).dead, false);
    await a.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'trauka'); G.P.x = m.x - 60; G.P.y = m.y; m.hp = 0; window.__GB2.kill(m); });
    await until([a], () => !!(window.__GB2.data && window.__GB2.data.trauka));
    const at = await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/wb/trauka'));
    assert.equal(at.by, 'gWbA1');
    const left = await a.eval((t) => (t - Date.now()) / 1000, at.at); // the page's clock (the fixed one)
    assert.ok(left > 1790 && left <= 1800, 'half an hour: ' + left);

    // B: the dragon is down too, with the same time left, and the world state keeps it
    await until([b], () => { const m = window.__G.mons().find((x) => x.type === 'trauka'); return m && m.dead; });
    const d = await dragon(b);
    assert.ok(Math.abs(d.rt - left) < 5, 'same time left: ' + d.rt + ' vs ' + left);
    assert.ok(Math.abs((await b.eval(() => window.__G.S && window.__GB2 && (window.__GB2.data.trauka.at))) - at.at) < 1);
    // B walks up to it: still dead (no 25 s respawn of a follower's copy)
    await b.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'trauka'); G.P.x = m.x - 200; G.P.y = m.y; m.rt = 20; });
    for (let i = 0; i < 5; i++) { await b.step(30); await b.page.waitForTimeout(30); }
    const d2 = await dragon(b);
    assert.equal(d2.dead, true);
    assert.ok(d2.rt > 1700, 'kept until the shared time: ' + d2.rt);

    // the rules: B can't put a new timer on a running one; a timer must be someone's own and at most two hours away
    const tries = await b.eval(async () => {
      const F = window.__GB2.fb(), D = F.m.database, out = [], put = async (k, v) => { try { await D.update(D.ref(F.db), { ['world/satisfy/wb/' + k]: v }); out.push('ok'); } catch (e) { out.push('no'); } };
      await put('trauka', { at: Date.now() + 60000, by: 'gWbB2', t: D.serverTimestamp() });
      await put('other_boss', { at: Date.now() + 60000, by: 'gWbA1', t: D.serverTimestamp() });
      await put('other_boss', { at: Date.now() + 9e6, by: 'gWbB2', t: D.serverTimestamp() });
      await put('other_boss', { at: Date.now() + 60000, by: 'gWbB2', t: D.serverTimestamp() });
      return out;
    });
    assert.deepEqual(tries, ['no', 'no', 'no', 'ok']);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
  } finally { await ctx.close(); }
});
