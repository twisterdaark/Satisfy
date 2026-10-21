'use strict';
// Taking items apart (v1.00): any gear in the bag comes apart for part of what made it, at a smithy for a fee or at your
// own anvil (more back with smithing level, a small chance of "[The disassembly has failed.]", which only scuffs it).
// A blacksmith who takes a boss's named item apart gains understanding of it; at 100% its production method is learned.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
const give = (g, id, r) => g.eval(([id, r]) => { const G = window.__G, it = G.eqx.mkItem(id, r); G.S.items.push(it); return it.uid; }, [id, r]);

test('at a smithy: the bag opens to take things apart, the window says what comes out, the smith charges a fee', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const uid = await give(g, 'isword', 1);
    const y = await g.eval((uid) => { const G = window.__G, it = G.S.items.find((i) => i.uid === uid); return { y: window.__GSV.yield(it, 'khan'), fee: window.__GSV.fee(it, 'khan') }; }, uid);
    assert.deepEqual(y.y, { ore: 2 });
    assert.ok(y.fee > 0);
    await g.eval(() => { window.__G.S.gold = 5000; window.__GSV.open('khan'); });
    await g.step(1);
    assert.match(await g.eval(() => document.getElementById('invH').textContent), /Take items apart/);
    const i = await g.eval((uid) => window.__G.bag().INVS.findIndex((s) => s.it && s.it.uid === uid), uid);
    assert.ok(i >= 0);
    assert.match(await g.eval((i) => window.__G.bag().INVS[i].tip, i), /Gives: Iron Ore ×2 · Fee \d+ gold/);
    const ore0 = await g.eval(() => window.__G.S.mats.ore || 0);
    await g.eval((i) => window.__GSV.inv(i), i);
    assert.match(await g.eval(() => document.getElementById('cfmB').textContent), /Take Iron Sword apart\? It gives: Iron Ore ×2/);
    await g.page.click('#cfmY');
    await g.step(1);
    const r = await g.eval(([uid, ore0]) => { const S = window.__G.S; return { gone: !S.items.some((i) => i.uid === uid), ore: (S.mats.ore || 0) - ore0, gold: S.gold }; }, [uid, ore0]);
    assert.equal(r.gone, true); assert.equal(r.ore, 2); assert.equal(r.gold, 5000 - y.fee);
    assert.match(await toasts(g), /Iron Sword came apart: Iron Ore ×2/);
    // worn gear stays on; the Thunder Bow gives its thunder stones; a named item gives mana stones by rating
    const w = await g.eval(() => { const G = window.__G, X = G.eqx, S = G.S, tb = X.mkItem('tbow', 0), oc = X.mkItem('ochelm', 0); return [window.__GSV.yield(tb, 'khan'), window.__GSV.yield(oc, 'khan')]; });
    assert.deepEqual(w, [{ tstone: 3 }, { mstone: 5, blue: 1 }]);
    const eqi = await g.eval(() => window.__G.bag().INVS.findIndex((s) => s.eq));
    if (eqi >= 0) { await g.eval((i) => window.__GSV.inv(i), eqi); assert.match(await toasts(g), /Take it off first|unequip/i); }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('at the anvil: more back with smithing level, and a blacksmith learns a named item by taking it apart', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, S = G.S; S.smith = 5; const it = G.eqx.mkItem('parmor', 1); return { y: window.__GSV.yield(it, 'anvil'), fee: window.__GSV.fee(it, 'anvil'), fail: window.__GSV.fail() }; });
    assert.deepEqual(a.y, { ore: 6, leather: 1 });
    assert.equal(a.fee, 0);
    assert.ok(Math.abs(a.fail - 0.1) < 1e-9);
    // a warrior gains no understanding; a blacksmith gains 20% a time and learns the helmet at 100%
    const w = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'warrior'; for (let k = 0; k < 30; k++) { const it = G.eqx.mkItem('ochelm', 0); S.items.push(it); if (window.__GSV.doSalv(it, 'anvil')) break; } return window.__GSV.undOf('ochelm'); });
    assert.equal(w, 0);
    assert.equal(await g.eval(() => window.__GSV.rc('ochelm').unlock()), false);
    const u = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'smith'; let n = 0, f = 0; for (let k = 0; k < 60 && window.__GSV.undOf('ochelm') < 100; k++) { const it = G.eqx.mkItem('ochelm', 0); S.items.push(it); const r = window.__GSV.doSalv(it, 'anvil'); if (r) n++; else { f++; S.items.splice(S.items.indexOf(it), 1); } } return { n, f, u: window.__GSV.undOf('ochelm') }; });
    assert.equal(u.n, 5, JSON.stringify(u));
    assert.equal(u.u, 100);
    await g.page.waitForTimeout(900);
    assert.match(await toasts(g), /Your understanding of Frostlight Orc Chief.s Helmet reached 100%\. You have learned how to make it!/);
    const k = await g.eval(() => { const rc = window.__GSV.rc('ochelm'); return [rc.unlock(), !!window.__G.S.rcK.ochelm, Object.keys(rc.need).sort()]; });
    assert.deepEqual(k, [true, true, ['blue', 'leather', 'mith', 'mstone']]);
    // a failed take-apart only scuffs the item
    const f = await g.eval(() => { const G = window.__G, S = G.S; S.smith = 1; for (let k = 0; k < 400; k++) { const it = G.eqx.mkItem('isword', 0); it.dur = 100; S.items.push(it); if (window.__GSV.doSalv(it, 'anvil') === false) return { kept: S.items.includes(it), dur: it.dur }; } return null; });
    assert.deepEqual(f, { kept: true, dur: 80 });
    assert.match(await toasts(g), /\[The disassembly has failed\.\]/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
