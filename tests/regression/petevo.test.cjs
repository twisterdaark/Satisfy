'use strict';
// Pet evolution and mount training (v0.97): a pet at the top level evolves once (Noe on a thunder stone, as in the novel),
// starting again at level 1 in a new form with twice the passive; evolved Noe discharges lightning at monsters near.
// The smiths take the Thunder Bow apart for three thunder stones. Horses train on the road, up to level 10.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
const sub = (fn) => `(() => { const G = window.__G; return (${fn})(G); })()`;
const ev = (g, fn) => g.page.evaluate(sub(fn));

test('Noe evolves on a thunder stone from the Thunder Bow: level 1 again, golden, twice the passive, Discharge!!', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // the Thunder Bow comes apart at Khan's for three thunder stones
    await ev(g, `(G) => { const S = G.S; S.items.push({ uid: ++S.uid, id: 'tbow', slot: 'w', r: 3, dur: 100, atk: 220, spd: .45 }); }`);
    const n = await g.eval(() => { const G = window.__G, n0 = G.S.items.filter((i) => i.id === 'tbow').length; window.__GPE.tbowBreak('khan'); return [n0, G.S.items.filter((i) => i.id === 'tbow').length, G.S.mats.tstone]; });
    assert.deepEqual(n, [1, 0, 3]);
    assert.match(await g.eval(() => document.getElementById('dtext').textContent), /three thunder stones/);
    await g.eval(() => { const G = window.__G; G.DL && G.advance(); });
    // Noe at the top level
    await ev(g, `(G, X) => { const S = G.S; S.pets = S.pets || {}; S.pets.noe = 1; window.__GPE.setPet('noe'); }`);
    await g.step(3);
    assert.equal(await g.eval(() => window.__GPE.pEvoOk('noe')), false);
    const b0 = await ev(g, `(G, X) => { const S = G.S; S.petx = { noe: 1e9 }; return [window.__GPE.petLv('noe'), window.__GPE.petB('noe')]; }`);
    assert.equal(b0[0], 20);
    assert.equal(await g.eval(() => window.__GPE.pEvoOk('noe')), true);
    await g.eval(() => window.__GPE.petEvo('noe'));
    await g.step(2);
    assert.match(await toasts(g), /\[The memphis ‘Noe’ has succeeded in the evolution!\]/);
    const a = await ev(g, `(G, X) => [G.S.mats.tstone, window.__GPE.petLv('noe'), window.__GPE.petB('noe'), window.__GPE.pEvo('noe'), window.__GPE.ptPub()]`);
    assert.equal(a[0], 2);
    assert.equal(a[1], 1);
    assert.ok(Math.abs(a[2] - 0.1) < 1e-9, 'evolved Noe at level 1: damage +10%');
    assert.equal(a[3], true);
    assert.match(a[4], /^noe\.501/);
    // Discharge!!: hits monsters near Noe and shocks them, then waits five seconds
    const d = await g.eval(() => {
      const G = window.__G, P = G.P, ms = G.mons().filter((m) => !m.dead && !m.spar).slice(0, 3), a = { k: 'noe', x: P.x, y: P.y, dc: 0 };
      ms.forEach((m, i) => { m.x = P.x + 10 + i * 4; m.y = P.y; m.eng = 4; m.hp = m.max; });
      const ok = window.__GPE.peDischarge(a, 1, .1), hurt = ms.filter((m) => m.hp < m.max).length, again = window.__GPE.peDischarge(a, 1, .1);
      return { ok, hurt, again, n: ms.length, stun: ms.filter((m) => m.stun > 0).length };
    });
    assert.ok(d.n >= 1, 'monsters to test on');
    assert.equal(d.ok, true);
    assert.equal(d.hurt, d.n);
    assert.equal(d.again, false);
  } finally { await g.close(); }
});

test('the dog evolves on mana stones and a golden fish; horses train on the road', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await ev(g, `(G, X) => { const S = G.S; S.pets = { dog: 1 }; window.__GPE.setPet('dog'); S.petx = { dog: 1e9 }; S.mats.mstone = 9; S.mats.gfish = 1; }`);
    await g.eval(() => window.__GPE.petEvo('dog'));
    assert.match(await toasts(g), /To evolve, Dog needs/);
    assert.equal(await g.eval(() => window.__GPE.pEvo('dog')), false);
    await g.eval(() => { window.__G.S.mats.mstone = 10; window.__GPE.petEvo('dog'); });
    assert.deepEqual(await g.eval(() => [window.__GPE.pEvo('dog'), window.__G.S.mats.mstone, window.__G.S.mats.gfish]), [true, 0, 0]);
    assert.ok(Math.abs((await ev(g, `(G, X) => window.__GPE.petB('dog')`)) - 0.2) < 1e-9);
    // a brown horse: level 1, then 2,500 of road makes level 2 (+1.5% speed, +5% health)
    const h = await ev(g, `(G, X) => { const S = G.S; S.mounts = { horse: 1 }; S.mount = 'horse'; const sp0 = window.__GPE.mtSp('horse'), hp0 = window.__GPE.rhpMax('horse'); G.P.ride = 1; window.__GPE.mtRide(2600); return { l: window.__GPE.mtLv('horse'), sp: window.__GPE.mtSp('horse') / sp0, hp: window.__GPE.rhpMax('horse') / hp0 }; }`);
    assert.equal(h.l, 2);
    assert.ok(Math.abs(h.sp - 1.015) < 1e-9, JSON.stringify(h));
    assert.ok(Math.abs(h.hp - 1.05) < 0.01, JSON.stringify(h));
    assert.match(await toasts(g), /Brown Horse has learned the road: level 2/);
    // riding for real trains the horse
    const x0 = await g.eval(() => window.__G.S.mxp.horse);
    await g.page.keyboard.down('d'); for (let i = 0; i < 20; i++) await g.step(1); await g.page.keyboard.up('d');
    assert.ok((await g.eval(() => window.__G.S.mxp.horse)) > x0);
  } finally { await g.close(); }
});

test('online: the other screen draws your pet in its evolved form', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await ev(a, `(G, X) => { const S = G.S; S.pets = { noe: 1 }; S.pevo = { noe: 1 }; window.__GPE.setPet('noe'); }`);
    await b.eval(([x, y]) => { window.__G.P.x = x + 20; window.__G.P.y = y; }, await a.eval(() => [window.__G.P.x, window.__G.P.y]));
    for (let i = 0; i < 12; i++) { for (const g of [a, b]) await g.step(3); await a.page.waitForTimeout(150); }
    assert.deepEqual(await b.eval(() => window.__GPE.remPets()), [{ k: 'noe', ev: true, lv: 1 }]);
    assert.match(await a.eval(() => window.__GPE.ptPub()), /^noe\.501$/);
  } finally { await ctx.close(); }
});
