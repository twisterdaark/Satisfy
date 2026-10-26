'use strict';
// Plan batch 13 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U311 one id for each monster on the network,
// of the shape the database rules take, kept through respawns and never shared by two live ones; one entity id scheme for
// monsters, NPCs and players.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const RULE = /^[a-z0-9_]{1,16}@-?[0-9]{1,6},-?[0-9]{1,6}$/;   // backend/database.rules.json mobs/…/m/$k
const KEYS = `const X = window.__GPB12, live = () => window.__G.mons().filter((m) => !m.tmp && !m.dead),
  plain = (m) => m.type.toLowerCase() + '@' + (m.sx | 0) + ',' + (m.sy | 0),
  dups = () => { const seen = new Set(), d = []; for (const m of live()) { const k = X.mobKey(m); if (seen.has(k)) d.push(k); seen.add(k); } return d; };`;
// another screen: other dice and another clock, so the keys can't agree by chance
const OTHER = { content: `(() => { let a = 0x0badf00d | 0; Math.random = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();` };

test('every monster has a key of its own of the rules\' shape, the same on every screen, through respawns', async () => {
  const g = await H.openGame({});
  const ctx2 = await H.newContext({ scripts: [OTHER, H.fixedClock(1767999999000)] });
  const h = await H.openGame({ ctx: ctx2 });
  try {
    await H.newGame(g);
    await H.newGame(h);
    const all = (gg) => gg.eval(new Function(`${KEYS} return window.__G.mons().filter((m) => !m.tmp).map((m) => X.mobKey(m));`));
    const a = await g.eval(new Function(`${KEYS} const all = window.__G.mons().filter((m) => !m.tmp && !m.band);
      return { dups: dups(), renamed: all.filter((m) => X.mobKey(m) !== plain(m)).map((m) => X.mobKey(m) + ' (' + plain(m) + ')') };`));
    const ka = await all(g), kb = await all(h);
    assert.deepEqual(a.dups, [], 'no two live monsters share a key');
    assert.ok(a.renamed.length >= 5, 'the pairs on one tile are told apart: ' + a.renamed.join(', '));
    assert.deepEqual(ka.filter((k) => !RULE.test(k)), [], 'every key fits the rules');
    assert.equal(kb.join('|'), ka.join('|'), 'the same keys on a screen with other dice and another clock');

    // a renamed twin and a dozen around it killed, then back: the same monsters, the same keys, new local ids
    const before = await g.eval(new Function(`${KEYS}
      const P = window.__G.P, Y = window.__GPB11, twin = live().find((m) => !m.band && X.mobKey(m) !== plain(m) && m.type === 'tsap');
      P.x = twin.sx + 200; P.y = twin.sy; P.inv = 1e9;
      const near = [twin, ...live().filter((m) => m !== twin && !m.boss && !m.band && Math.hypot(m.x - P.x, m.y - P.y) < 600).slice(0, 11)];
      window.__U311 = near.map((m) => ({ m, k: X.mobKey(m), id: m.id }));   // kept outside: a respawn clears the monster's own fields (monFresh)
      for (const m of near) { Y.killMon(m); m.rt = 0.05; }
      P.y -= 160; return { n: near.length, twin: X.mobKey(twin) };`));
    assert.ok(before.n >= 6, 'monsters to kill: ' + before.n); assert.match(before.twin, /^tsap@/);
    await g.step(30);
    const after = await g.eval(new Function(`${KEYS}
      const near = window.__U311, ms = window.__G.mons();
      return { back: near.filter((e) => !e.m.dead).length, twin: !near[0].m.dead && X.mobKey(near[0].m) === near[0].k, same: near.every((e) => ms.includes(e.m) && X.mobKey(e.m) === e.k),
        newIds: near.filter((e) => !e.m.dead).every((e) => e.m.id !== e.id), dups: dups(), ids: new Set(ms.map((m) => m.id)).size === ms.length };`));
    assert.ok(after.back >= before.n - 2, 'they came back: ' + after.back + '/' + before.n);
    assert.equal(after.twin, true, 'the renamed twin came back with its key');
    assert.equal(after.same, true, 'each one the same monster with its key');
    assert.equal(after.newIds, true, 'with a new local id: an id is never used twice');
    assert.deepEqual(after.dups, []); assert.equal(after.ids, true);

    // one scheme for what stands in the world
    const e = await g.eval(() => {
      const X = window.__GPB12, G = window.__G, m = G.mons().find((x) => !x.tmp);
      return { mon: X.entId(m) === 'm:' + X.mobKey(m), me: X.entId(G.P), npc: X.entId(X.npcObj('khan')), fake: X.entId({ id: 'khan' }) };
    });
    assert.equal(e.mon, true); assert.equal(e.me, 'p:me', 'offline the player is p:me');
    assert.equal(e.npc, 'n:khan'); assert.equal(e.fake, null, 'only a real NPC gets an NPC id');
    assert.deepEqual(g.errors, []);
    assert.deepEqual(h.errors, []);
  } finally { await g.close(); await h.close(); await ctx2.close(); }
});

// online over the fake database: by a twin pair, the Guardian's pillars and the orc warband, every write of the host's
// list is taken by the rules, and the follower follows them all
const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}

test('online: the host\'s list is taken by the rules by a twin pair, the Guardian\'s pillars and the warband, and the follower follows them', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await online(ctx, 'a', 'u311A', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'u311B', 'Bassem');   // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const spots = await a.eval(new Function(`${KEYS}
      const twin = live().find((m) => !m.band && X.mobKey(m) !== plain(m) && m.type === 'redk'), first = live().find((m) => m !== twin && X.mobKey(m) === plain(twin));
      const pil = window.__G.mons().filter((m) => m.type === 'gpillar'), band = window.__G.mons().filter((m) => m.band);
      return [{ x: twin.sx, y: twin.sy, keys: [X.mobKey(twin), X.mobKey(first)] }, { x: pil[0].sx, y: pil[0].sy, keys: pil.map((m) => X.mobKey(m)) }, { x: band[0].x, y: band[0].y, keys: band.map((m) => X.mobKey(m)) }];`));
    for (const s of spots) {
      for (const [g, dx] of [[a, -60], [b, -30]]) await g.eval(([s, d]) => { const G = window.__G; G.P.x = s.x + d; G.P.y = s.y + 40; G.P.inv = 1e9; G.S.lv = 400; G.P.hp = G.maxHP(); }, [s, dx]);
      await frames([a, b], 50);
      const seen = await b.eval((keys) => { const ms = window.__G.mons(), key = (m) => m.nk || (m.type.toLowerCase() + '@' + (m.sx | 0) + ',' + (m.sy | 0)); return keys.filter((k) => ms.some((m) => key(m) === k && m.led)); }, s.keys);
      assert.deepEqual(seen.sort(), s.keys.slice().sort(), 'the follower follows them: ' + s.keys.join(', '));
    }
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), [], 'no write refused');
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
