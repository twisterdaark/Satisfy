'use strict';
// SAT-ONLINE-127 (plan U311, "entity registry: stable ids for monsters, NPCs and players; no duplicate id on respawn").
// Satisfy.local.entities() lists every monster by its key, every NPC by its id; no two share one, and two clients get the
// same keys. Two monsters of one type that spawned on the same tile (the red knights at Asmophel's mansion) have keys of
// their own, which they keep through a respawn, and a save remembers which of the two is dead.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const ents = (g) => g.eval(() => Satisfy.local.entities());
const dups = (a) => { const seen = new Set(), d = []; for (const x of a) { if (seen.has(x)) d.push(x); seen.add(x); } return d; };

test('every monster and NPC has an id of its own, the same on two clients, kept through a respawn and a reload', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?slot=a' });
    const b = await H.openGame({ ctx, query: '?slot=b' });
    await H.newGame(a);
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const E = await ents(a), Eb = await ents(b);
    assert.ok(E.mons.length > 500, 'the world has its monsters: ' + E.mons.length);
    assert.deepEqual(dups(E.mons.map((m) => m.key)), [], 'no two monsters share a key');
    assert.deepEqual(dups(E.npcs.map((n) => n.id)), [], 'no two NPCs share an id');
    assert.deepEqual(Eb.mons.map((m) => m.key), E.mons.map((m) => m.key), 'the same keys on another client');
    assert.deepEqual(E.players, [], 'offline: nobody else');

    // every key has the database's form (Firebase allows no '#'; the rules' pattern for mobs/…/m)
    assert.deepEqual(E.mons.map((m) => m.key).filter((k) => !/^[a-z0-9_]{1,16}@-?[0-9]{1,6},-?[0-9]{1,6}$/.test(k)), []);
    // twins: two of one type on one spawn tile; the second takes the first free spot below it
    const twins = E.mons.filter((m) => m.key !== m.type + '@' + m.sp);
    assert.ok(twins.length >= 1, 'this world has twins (two red knights on one tile at the mansion)');
    const k2 = twins[0].key, k1 = twins[0].type + '@' + twins[0].sp;
    assert.ok(E.mons.some((m) => m.key === k1), 'its twin has the plain key');

    // a respawn keeps the key: kill both, bring them back away from the player
    const kill = (key) => a.eval((k) => { const m = window.__G.mons().find((x) => x.nk === k); m.dead = true; m.dying = 0; m.rt = 0.01; return m.id; }, key);
    const id1 = await kill(k1), id2 = await kill(k2);
    await a.eval(() => { const G = window.__G; G.P.x = 3304; G.P.y = 1354; });
    await a.step(10);
    const E2 = await ents(a);
    assert.deepEqual(dups(E2.mons.map((m) => m.key)), [], 'still no two alike after the respawn');
    assert.ok(E2.mons.some((m) => m.key === k1 && !m.dead) && E2.mons.some((m) => m.key === k2 && !m.dead), 'both back, each with its key');
    const ids = await a.eval(() => window.__G.mons().map((m) => m.id));
    assert.deepEqual(dups(ids), [], 'and no two share a runtime id either');
    assert.ok(!ids.includes(id1) && !ids.includes(id2), 'a respawn is a new monster');

    // a save remembers which twin is dead: kill only the second, save, reload
    await a.eval((k) => { const m = window.__G.mons().find((x) => x.nk === k); m.hp = 0; window.__GB2.kill(m); m.rt = 600; }, k2);
    await a.step(3);
    await a.eval(() => window.__GU.save(true));
    await a.step(2);
    assert.ok(await a.eval((k) => (window.__G.S.mrt || {})[k] > Date.now(), k2), 'its respawn time is kept under its own key');
    await a.eval(() => window.__G.act('quit'));
    await a.waitMode('title');
    await a.reload();
    await H.continueGame(a);
    const E3 = await ents(a);
    assert.equal(E3.mons.find((m) => m.key === k2).dead, true, 'the one killed is still dead');
    assert.equal(E3.mons.find((m) => m.key === k1).dead, false, 'its twin is not');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

// Claude-B's review of #163: a twin's key went to the database with '#', which Firebase refuses (the SDK throws), so the host
// published none of its monsters. Now the host shares both twins, and the follower plays them as the host's.
const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}

test('online: twins are shared like any other monster, under keys the database takes', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await online(ctx, 'a', 'gEnA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gEnB2', 'Bassem'); // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const tw = await a.eval(() => Satisfy.local.entities().mons.find((m) => m.key !== m.type + '@' + m.sp));
    const k1 = tw.type + '@' + tw.sp, k2 = tw.key, [sx, sy] = tw.sp.split(',').map(Number);
    for (const [g, dx] of [[a, -30], [b, 30]]) await g.eval(([x, y, d]) => { const G = window.__G; G.P.x = x + d; G.P.y = y; G.P.inv = 1e9; }, [sx, sy, dx]);
    const pub = () => a.eval(() => { const o = {}; for (const [p, v] of window.__fakeRTDB.data) if (/^mobs\/satisfy\/[^/]+\/gEnA1$/.test(p) && v && v.m) Object.assign(o, v.m); return Object.keys(o); });
    let keys = [];
    for (let i = 0; i < 40 && !(keys.includes(k1) && keys.includes(k2)); i++) { await frames([a, b], 5); keys = await pub(); }
    assert.ok(keys.includes(k1) && keys.includes(k2), 'the host publishes both twins: ' + keys.filter((k) => k.startsWith(tw.type)).join(' '));
    assert.ok(keys.length > 2, 'and the monsters around them: ' + keys.length);
    let led = [];
    for (let i = 0; i < 40 && led.length < 2; i++) { await frames([a, b], 5); led = await b.eval((ks) => window.__G.mons().filter((m) => m.led && ks.includes(m.nk)).map((m) => m.nk), [k1, k2]); }
    assert.deepEqual(led.sort(), [k1, k2].sort(), 'the follower plays both as the host\'s');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
