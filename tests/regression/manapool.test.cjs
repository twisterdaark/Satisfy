'use strict';
// owner 2026-10-23: "2500 Intelligence and only 8000 mana, skills that take 6500, ten potions run out fast; fix the mana like the novel"
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('mana: 3 a point, 6 from level 200; skill costs from a capped reference pool; standing still refills faster; 30 potions; the log button stays', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, M = window.__GMP; S.st.int = 100; S.lv = 50;
      const lo = { max: M.max(), per: M.per(), strike: M.cost('strike') };
      S.lv = 450; S.st.int = 2500; const hi = { max: M.max(), per: M.per(), ref: M.ref(), strike: M.cost('strike') };
      S.st.int = 30; const war = { max: M.max(), strike: M.cost('strike') };
      return { lo, hi, war, cap: M.cap() }; });
    assert.equal(r.lo.per, 3); assert.equal(r.hi.per, 6);
    assert.ok(r.hi.max >= 15000, 'level 450, 2500 Intelligence: ' + r.hi.max);
    assert.ok(r.hi.ref < 2500 * 3 + 1, 'the cost pool is capped by level: ' + r.hi.ref);
    assert.ok(r.hi.max / r.hi.strike > 20, 'many strikes from a full bar: ' + r.hi.max + '/' + r.hi.strike);
    assert.ok(r.war.strike < r.war.max / 5, 'a low-Intelligence build still affords its skills: ' + JSON.stringify(r.war));
    assert.equal(r.cap, 30);
    // regen: standing still out of a fight is much faster than walking
    const reg = await g.eval(() => { const G = window.__G, P = G.P; P.hitT = -99; P.mp = 0; for (let i = 0; i < 30; i++) { P.stillT = 0; P.mx0 = -1; window.__step(1, 1000 / 30); } const a = P.mp; P.mp = 0; P.stillT = 3; window.__step(30, 1000 / 30); return { a, b: P.mp }; });
    assert.ok(reg.b > reg.a * 2.4, 'still for two seconds more than doubles the rate: ' + JSON.stringify(reg));
    const lb = await g.eval(() => { const b = document.getElementById('toastLog'); window.__GTOAST('one'); window.__GTOAST('two'); const n = b.dataset.n; document.getElementById('toasts').innerHTML = '';
      return { inHead: !!b.closest('#quest .qhead'), hidden: b.hidden || getComputedStyle(b).display === 'none', n }; });
    assert.equal(lb.inHead, true); assert.equal(lb.hidden, false); assert.ok(+lb.n >= 2);
    const tz = await g.eval(() => [getComputedStyle(document.getElementById('tip')).zIndex, getComputedStyle(document.getElementById('toasts')).zIndex]);
    assert.ok(+tz[0] > +tz[1], 'the item tip draws over the notices');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
