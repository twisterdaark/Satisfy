'use strict';
// v3.25 The plan's updates, batch 5: U285 a piece that came by trade can't be taken apart; U124 a golem leaves a vein where
// it falls.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('U285: a traded piece is not taken apart', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S; S.gold = 5000; const it = G.eqx.mkItem('isword', 1); it.hist = ['Faker']; S.items.push(it); window.__GSV.open('khan');
      const i = G.bag().INVS.findIndex((s) => s.it && s.it.uid === it.uid); const tip = G.bag().INVS[i].tip; window.__GSV.inv(i);
      return { tip, still: S.items.includes(it) }; });
    assert.match(r.tip, /came to you in a trade/); assert.equal(r.still, true, 'still in the bag');
    const ts = await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
    assert.match(ts, /a traded piece can't be taken apart/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('U124: a golem leaves a vein where it falls, mined once, gone in 3 minutes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G, P = G.P; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } P.x = 240 * 16; P.y = 216 * 16; P.inv = 1e9;
      const a = G.spawnMon('golem', P.x + 40, P.y); a.tmp = 0; a.hp = 1; window.__GU.hitMon(a, 100, { pure: 1 }); });
    await g.step(5);
    const one = await g.eval(() => window.__GMN.gv());
    await g.eval(() => { const G = window.__G, P = G.P; const b = G.spawnMon('ogolem', P.x - 60, P.y + 30); b.tmp = 0; b.hp = 1; window.__GU.hitMon(b, 100, { pure: 1 }); });
    await g.step(5);
    const two = await g.eval(() => window.__GMN.gv().map((v) => v[2]));
    assert.equal(one.length, 1, 'a vein where the golem fell: ' + JSON.stringify(one)); assert.deepEqual(two, ['ore', 'mith'], 'the later golems leave mithril');
    // mined once: gone; the other one, three minutes on: gone
    await g.eval(() => window.__GMN.gvTake()); await g.step(3);
    assert.deepEqual((await g.eval(() => window.__GMN.gv())).map((v) => v[2]), ['mith'], 'mined once, the vein is gone');
    await g.eval(() => window.__GMN.gvAge(181)); await g.step(3);
    assert.deepEqual(await g.eval(() => window.__GMN.gv()), [], 'and three minutes on, the other');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
