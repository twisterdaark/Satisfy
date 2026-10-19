'use strict';
// SAT-ONLINE-045 (owner 2026-10-19: "the monsters the same for everyone, the same hits, the same actions"). Bosses on the
// shared list: the host's boss goes after the player nearest to it (not always the host, who would drag it home to heal
// while someone else fights it), Trauka's fire breath is timed and aimed once by the host and replayed on the other
// screen, a follower sees the boss's phase roar, and flying on an item skill shows on the other screen.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
const dragon = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); return m && { x: m.x, y: m.y, dead: !!m.dead, br: m.br || 0, ba: m.ba, tgU: m.tgU || null, ph: m.ph || 0, led: !!m.led, hp: m.hp, max: m.max }; });
async function until(gs, fn, n = 120) { for (let i = 0; i < n; i++) { if (await fn()) return true; await frames(gs, 1); } return false; }

test('online: the boss fights the nearest player; the breath, the phase roar and flight look the same on both screens', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gBsA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gBsB2', 'Bassem'); // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const d0 = await dragon(a);
    assert.ok(d0 && !d0.dead, 'Trauka is up');
    // A a little way off, B right in front of it; nobody gets hurt in this test (inv), it is about what each screen shows
    await a.eval((d) => { const G = window.__G; G.P.x = d.x - 140; G.P.y = d.y + 10; G.P.inv = 1e9; }, d0);
    await b.eval((d) => { const G = window.__G; G.P.x = d.x - 60; G.P.y = d.y + 10; G.P.inv = 1e9; }, d0);
    await frames([a, b], 60);
    assert.equal(await a.eval(() => window.__GM.host), 'gBsA1', 'A hosts');
    assert.ok((await dragon(b)).led, "B's dragon follows A's");

    // the host's boss is after B, the nearer one
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.eng = 4; m.agg = 1; });
    assert.ok(await until([a, b], async () => (await dragon(a)).tgU === 'gBsB2'), 'the boss goes after the nearest player, not the host');

    // a breath: the host starts it, aimed at B; B plays the same breath at the same angle
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.brc = 0; m.eng = 4; });
    assert.ok(await until([a, b], async () => (await dragon(a)).br > 0, 40), 'the host breathes');
    const da = await dragon(a), pb = await b.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    const aim = Math.atan2(pb.y - 8 - (da.y - 40), pb.x - da.x);
    assert.ok(Math.abs(da.ba - aim) < 0.35, 'aimed at B: ' + da.ba + ' vs ' + aim);
    assert.ok(await until([a, b], async () => (await dragon(b)).br > 0, 40), 'B sees the breath');
    const db = await dragon(b);
    assert.ok(Math.abs(db.ba - da.ba) < 0.02, 'the same angle on both screens: ' + db.ba + ' vs ' + da.ba);
    assert.ok(Math.abs(db.br - da.br) < 0.5, 'at about the same time: ' + db.br + ' vs ' + da.br);
    // B never starts a breath of its own: wait the breath out, then the boss's next one comes only from A
    await until([a, b], async () => (await dragon(a)).br <= 0 && (await dragon(b)).br <= 0, 120);
    await b.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.brc = 0; });
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.brc = 99; });
    await frames([a, b], 30);
    assert.equal((await dragon(b)).br, 0, 'no breath of its own on the follower');

    // the phase roar: the host's boss drops below 66%, B sees it change phase
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'trauka'); m.hp = Math.round(m.max * 0.6); });
    assert.ok(await until([a, b], async () => (await dragon(b)).ph === 1, 60), "B's boss roars into phase 2");

    // flying on an item skill shows on the other screen
    await b.eval(() => { const G = window.__G; G.P.mp = 1e6; G.P.fly = 4; });
    assert.ok(await until([a, b], () => a.eval(() => { const r = Satisfy.local.net().remotes().find((x) => x.uid === 'gBsB2'); return !!r && typeof r.fx === 'string' && r.fx.includes('"st:f"'); }), 40), "B's flight is in its presence");

    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
