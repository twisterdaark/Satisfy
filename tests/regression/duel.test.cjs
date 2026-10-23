'use strict';
// SAT-ONLINE-006 (doc §09 R4): a consent-based duel between two tabs with the real keys,
// over the local transport and over the fake Firebase (inbox + rules).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 };

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 5000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
const duel = (g) => g.eval(() => Satisfy.local.net().duel);
const shown = (g, id) => g.eval((i) => !document.getElementById(i).hidden, id);
const text = (g, id) => g.eval((i) => document.getElementById(i).textContent, id);

// Both players in the plains west of Winston (not a safe zone), B 20 px right of A, no monsters around.
async function pair(mode) {
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
  for (const [g, dx] of [[a, 0], [b, 20]]) {
    await g.eval((d) => {
      const G = window.__G, P = G.P;
      P.x = 90 * 16 + d; P.y = 60 * 16; P.dir = d ? 3 : 2;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
    }, dx);
  }
  await settle(a, b);
  return { ctx, a, b };
}
// K → Y (accept) → Y (ready) on both → countdown over
async function startFight(a, b) {
  await a.page.keyboard.press('KeyK');
  await settle(a, b);
  await until(b, () => !document.getElementById('duelInv').hidden);
  assert.equal(await text(b, 'duelInvT'), 'Grid challenges you to a duel');
  await b.page.keyboard.press('KeyY');
  await settle(a, b);
  for (const g of [a, b]) await until(g, () => Satisfy.local.net().duel.phase === 'ready');
  await a.page.keyboard.press('KeyY');
  await b.page.keyboard.press('KeyY');
  await settle(a, b);
  for (const g of [a, b]) await until(g, () => ['countdown', 'fight'].includes(Satisfy.local.net().duel.phase));
  await a.step(60 * 3 + 10);
  await b.step(60 * 3 + 10);
  for (const g of [a, b]) await until(g, () => Satisfy.local.net().duel.phase === 'fight');
}

for (const mode of ['local', 'online']) {
  test(`[${mode}] K challenges, Y accepts and readies, A wins on HP; nothing else changes`, async () => {
    const { ctx, a, b } = await pair(mode);
    try {
      const before = await b.eval(() => { const S = window.__G.S; return { gold: S.gold, items: JSON.stringify(S.items), mats: JSON.stringify(S.mats), hp: window.__G.P.hp }; });
      await startFight(a, b);
      assert.equal(await shown(a, 'duelW'), true);
      // A swings until B's duel HP is gone (each landed hit is 4..18 duel HP)
      for (let i = 0; i < 40 && (await duel(b)).phase === 'fight'; i++) {
        await a.eval(() => { window.__G.P.acd = 0; window.__G.tryAttack(1, 0); });
        await a.step(16);
        await settle(a, b);
      }
      await until(b, () => Satisfy.local.net().duel.last && Satisfy.local.net().duel.last.result === 'lose');
      await until(a, () => Satisfy.local.net().duel.last && Satisfy.local.net().duel.last.result === 'win');
      assert.deepEqual(await a.eval(() => window.__G.S.duels), { w: 1, l: 0 });
      assert.deepEqual(await b.eval(() => window.__G.S.duels), { w: 0, l: 1 });
      const after = await b.eval(() => { const S = window.__G.S; return { gold: S.gold, items: JSON.stringify(S.items), mats: JSON.stringify(S.mats), hp: window.__G.P.hp }; });
      assert.deepEqual(after, before, 'a duel costs no gold, items, materials, durability or real HP');
      assert.equal(await b.eval(() => window.__G.mode), 'play', 'losing a duel is not a death');
      // SAT-ONLINE-150 (plan U039): each side's fight log, from "/fightlog"
      const logOf = (g) => g.eval(() => {
        const G = window.__G; window.__GFLOG.show(); const L = G.DL.lines.slice();
        for (let i = 0; i < 60 && G.mode === 'dialog'; i++) { const b = document.querySelector('#dopts button'); if (b && !document.getElementById('dopts').hidden) { b.click(); break; } G.advance(); }
        return L;
      });
      const la = await logOf(a), lb = await logOf(b);
      assert.match(la[0], /^You won the duel against Faker in \d+\.\d s$/);
      assert.match(la[1], /^Your hits: \d+ \(100 of their HP\) · theirs: 0 /);
      assert.ok(la.some((l) => /s · You hit Faker$/.test(l)), la.join(' | '));
      assert.match(lb[0], /^You lost the duel against Grid in \d+\.\d s$/);
      assert.match(lb[1], /· theirs: \d+ \(100 of yours\)/);
      assert.ok(lb.some((l) => /s · Grid hit you -[\d.]+ \(you have 0\)$/.test(l)), lb.join(' | '));
      if (mode === 'online') {
        assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), []);
        assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), []);
        const types = await a.eval(() => [...new Set(window.__fakeRTDB.log.filter((l) => l.op === 'push').map((l) => l.path.split('/')[0]))]);
        assert.deepEqual(types, ['inbox']);
        // SAT-ONLINE-053: the duel counts in this month's arena season: 1000 each before, +-16 after (Elo, K 32)
        await until(a, () => window.__GR.mine().then((v) => !!v), 8000).catch(() => {});
        for (let i = 0; i < 40; i++) { const ok = (await a.eval(() => window.__GR.mine())) && (await b.eval(() => window.__GR.mine())); if (ok) break; await settle(a, b); }
        assert.deepEqual(await a.eval(() => window.__GR.mine().then((v) => [v.r, v.w, v.l])), [1016, 1, 0]);
        assert.deepEqual(await b.eval(() => window.__GR.mine().then((v) => [v.r, v.w, v.l])), [984, 0, 1]);
        assert.deepEqual(await b.eval(() => window.__GR.top().then((v) => v.map((x) => [x.n, x.r]))), [['Grid', 1016], ['Faker', 984]], 'the board, best first (names: the account ID, else the character)');
        assert.match(await b.eval(() => window.__GR.season()), /^s20\d{4}$/);
        assert.deepEqual(await a.eval(() => window.__fakeRTDB.rejected), [], 'the ratings pass the rules');
      }
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally { await ctx.close(); }
  });
}

test('N declines; Yield ends the fight; no challenges inside a town', async () => {
  const { ctx, a, b } = await pair('local');
  try {
    // decline
    await a.page.keyboard.press('KeyK');
    await settle(a, b);
    await until(b, () => !document.getElementById('duelInv').hidden);
    await b.page.keyboard.press('KeyN');
    await settle(a, b);
    await until(a, () => Satisfy.local.net().duel.phase === 'idle');
    assert.equal(await shown(b, 'duelInv'), false);
    // yield
    await startFight(a, b);
    await b.eval(() => document.getElementById('duelYield').click());
    await settle(a, b);
    await until(a, () => (Satisfy.local.net().duel.last || {}).why === 'yield');
    assert.equal((await duel(b)).last.result, 'lose');
    // towns are safe: no challenge from inside Winston
    await a.step(60 * 5);
    await b.step(60 * 5);
    await a.eval(() => { const T = window.__G.TOWNS.find((t) => t.k === 'zWin'), P = window.__G.P; P.x = T.rx * 16 + 8; P.y = T.ry * 16 + 10; });
    await b.eval(() => { const T = window.__G.TOWNS.find((t) => t.k === 'zWin'), P = window.__G.P; P.x = T.rx * 16 + 28; P.y = T.ry * 16 + 10; });
    await settle(a, b);
    await a.page.keyboard.press('KeyK');
    await a.step(2);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /No duels inside towns/);
    assert.equal((await duel(a)).phase, 'idle');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test('U034: a third player sees both duelists\' HP and the ring', async () => {
  const { ctx, a, b } = await pair('local');
  try {
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(c, { n: 'Watcher', hair: 2, hc: 1, skin: 0, top: 2 });
    await c.eval(() => { const P = window.__G.P; P.x = 90 * 16 + 10; P.y = 60 * 16 + 40; for (const m of window.__G.mons()) { m.dead = true; m.rt = 1e9; } });
    await settle(a, b, c);
    await startFight(a, b);
    // swing until a hit lands (B's own duel HP drops), stepping C along so it keeps up
    for (let i = 0; i < 10 && (await duel(b)).hp === 100; i++) {
      await a.eval(() => { window.__G.P.acd = 0; window.__G.tryAttack(1, 0); });
      await a.step(16);
      await settle(a, b, c);
    }
    assert.ok((await duel(b)).hp < 100, 'A hit B');
    await until(c, () => {
      const rs = Satisfy.local.net().remotes.filter((r) => r.duel);
      return rs.length === 2 && rs[0].duel.split(':')[0] === rs[1].duel.split(':')[0] && rs.some((r) => +r.duel.split(':')[1] < 100);
    }, 8000);
    const seen = await c.eval(() => Satisfy.local.net().remotes.filter((r) => r.duel).map((r) => [r.handle, +r.duel.split(':')[1]]).sort());
    assert.equal(seen.length, 2);
    assert.equal(seen.find((x) => x[0] === 'Grid')[1], 100, 'A was not hit');
    assert.ok(seen.find((x) => x[0] === 'Faker')[1] < 100, 'B took a hit');
    assert.deepEqual(c.errors, []);
  } finally { await ctx.close(); }
});
