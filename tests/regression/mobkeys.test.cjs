'use strict';
// Hotfix 2026-10-27: every shared monster's key is of the shape the database rules take (mobs/…/m/$k:
// /^[a-z0-9_]{1,16}@-?[0-9]{1,6},-?[0-9]{1,6}$/). The Guardian's pillars (gpillar@N), the orc warband (forc@wbN) and Ren's
// War's ferB/chuckB weren't, and one bad key made the database refuse the host's whole list: monster sharing stopped near
// them for the whole party. Online over the fake database by the pillars and the warband no write is refused, and the
// follower follows them.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const RULE = /^[a-z0-9_]{1,16}@-?[0-9]{1,6},-?[0-9]{1,6}$/;
const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
const key = (m) => m.nk || (m.type.toLowerCase() + '@' + (m.sx | 0) + ',' + (m.sy | 0));

test('every world monster\'s key fits the rules', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const bad = await g.eval(new Function('RULE', `const key = ${key.toString()}; return window.__G.mons().filter((m) => !m.tmp).map(key).filter((k) => !new RegExp(RULE).test(k));`), RULE.source);
    assert.deepEqual(bad, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('online: by the Guardian\'s pillars and the orc warband no write is refused, and the follower follows them', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await online(ctx, 'a', 'mkA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'mkB2', 'Bassem');   // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const spots = await a.eval(new Function(`const key = ${key.toString()}, ms = window.__G.mons(), pil = ms.filter((m) => m.type === 'gpillar'), band = ms.filter((m) => m.band);
      return [{ x: pil[0].sx, y: pil[0].sy, keys: pil.map(key) }, { x: band[0].x, y: band[0].y, keys: band.map(key) }];`));
    for (const s of spots) {
      for (const [g, dx] of [[a, -60], [b, -30]]) await g.eval(([s, d]) => { const G = window.__G; G.P.x = s.x + d; G.P.y = s.y + 40; G.P.inv = 1e9; G.S.lv = 400; G.P.hp = G.maxHP(); }, [s, dx]);
      await frames([a, b], 50);
      const seen = await b.eval(new Function('keys', `const key = ${key.toString()}, ms = window.__G.mons(); return keys.filter((k) => ms.some((m) => key(m) === k && m.led));`), s.keys);
      assert.deepEqual(seen.sort(), s.keys.slice().sort(), 'the follower follows them: ' + s.keys.join(', '));
    }
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), [], 'no write refused');
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
