'use strict';
// Owner 2026-10-21, patch 6 of the third batch: Ren's War, a world event on Reidan (the Eternal Kingdom's army in six
// waves, Ferrell and Chucksley as captains), with Piaro, Laden and Lauel fighting for the town, and Lauel's quests.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const at = (g, x, y) => g.eval(([x, y]) => { const G = window.__G; G.P.x = x * 16 + 8; G.P.y = y * 16 + 8; G.P.inv = 1e9; G.P.hp = 1e9; }, [x, y]);

test('Reidan has Laden and Lauel; Piaro comes only for the war; the war is one of the world events', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 538, 84); await g.step(10);
    const r = await g.eval(() => { const G = window.__G, U = window.__GU, f = (id) => G.npcs.find((n) => n.id === id), e = U.EVT.find((e) => e.k === 'renW');
      return { ppl: ['laden', 'lauel', 'piaroR'].map((id) => !!f(id)), hid: f('piaroR').hidden, e: e && [e.tw, e.cap.join(), e.fixed] }; });
    assert.deepEqual(r.ppl, [true, true, true]);
    assert.equal(r.hid, true);
    assert.deepEqual(r.e, ['zReid', 'ferB,chuckB', 1]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the war: the army marches in waves, Ferrell leads the third and Chucksley the sixth; the allies fight and cannot fall; Lauel plans', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 538, 84);
    await g.eval(() => window.__GU.forceEvent('renW', 300000));
    await g.page.waitForTimeout(2200); await g.step(5);
    const a = await g.eval(() => { const G = window.__G, E = window.__GW.ev(), ms = G.mons().filter((m) => m.evt && !m.dead);
      return { k: E && E.k, n: ms.length, types: [...new Set(ms.map((m) => m.type))].sort(), lv: Math.min(...ms.map((m) => m.lv)), piaro: G.npcs.find((n) => n.id === 'piaroR').hidden }; });
    assert.equal(a.k, 'renW');
    assert.equal(a.n, 5);
    assert.ok(a.types.every((t) => ['ersol', 'erarch', 'erkn'].includes(t)), a.types.join());
    assert.ok(a.lv >= 288, 'canon levels');
    assert.equal(a.piaro, false, 'Piaro has come');
    // jump the war's clock to the third wave, then to the sixth
    const caps = [];
    for (const back of [62000, 90000]) {
      await g.eval(() => { for (const m of window.__G.mons()) if (m.evt && !m.dead) window.__GU.killMon(m); });
      await g.eval((b) => { window.__GP6.ev().end -= b; }, back); // the war started that much earlier
      await g.step(3);
      caps.push(await g.eval(() => window.__G.mons().filter((m) => m.evt && m.cap && !m.dead).map((m) => m.type).join()));
    }
    assert.deepEqual(caps, ['ferB', 'chuckB']);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP6, U = window.__GU, f = (id) => G.npcs.find((n) => n.id === id), L = f('laden');
      const m = G.mons().find((m) => m.evt && !m.dead && m.type !== 'chuckB'); m.x = L.x + 30; m.y = L.y; const h0 = m.hp; L.p6 = 0; X.tick(0.02); const hit = m.hp < h0;
      X.P6.lT = 0.01; X.tick(0.02); const buf = X.P6.buf, mul = X.atk(m);
      const i = G.npcs.indexOf(L); window.__GW.knock(i); const ko = window.__GW.ko('laden');
      return { hit, buf, mul, ko };
    });
    assert.equal(r.hit, true, 'Laden strikes');
    assert.ok(r.buf > 14);
    assert.ok(Math.abs(r.mul - 1.15) < 1e-9);
    assert.equal(r.ko, false, 'Laden cannot be knocked out');
    for (let i = 0; i < 20; i++) await g.step(3);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("Lauel's quests: break the soldiers, defeat Chucksley, and become the Defender of Reidan", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 538, 84);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, S = G.S; S.lv = 300; G.acceptQ('rw1');
      for (let i = 0; i < 15; i++) U.killMon(G.spawnMon('ersol', G.P.x + 30, G.P.y));
      G.completeQ('rw1'); G.acceptQ('rw2'); U.killMon(G.spawnMon('chuckB', G.P.x + 30, G.P.y)); G.completeQ('rw2');
      return [S.qs.rw1.st, S.qs.rw2.st, !!S.tl.rdef, window.__GP6.atk({ type: 'erkn' })];
    });
    assert.deepEqual(r.slice(0, 3), [2, 2, true]);
    assert.ok(Math.abs(r[3] - 1.1) < 1e-9);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
