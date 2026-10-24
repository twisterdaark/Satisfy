'use strict';
// U288 Tavern social hub (SAT-ONLINE-193; plan: "seats, emotes, party recruitment", check: "no combat inside tavern"):
//   - an inn's common room is a tavern: no attack, no skill inside (out on the square they work);
//   - you can sit down there (not outside), and stand up as soon as you move;
//   - the innkeeper's party board shows only online.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the tavern: no fighting inside, a stool to sit on, the board online only', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    // on the square: an attack swings, and you can't sit
    const out = await g.eval(() => { const G = window.__G, P = G.P; P.acd = 0; G.tryAttack(); const sw = P.acd > 0; window.__GTAV.sit(); return { in: window.__GTAV.in(), sw, sit: !!P.sit }; });
    assert.deepEqual(out, { in: false, sw: true, sit: false });
    // in Winston's inn
    const spot = await g.eval(() => window.__GTAV.room('zWin'));
    assert.ok(spot, "Winston's inn");
    await g.eval((p) => { const P = window.__G.P; P.x = p.x; P.y = p.y; P.acd = 0; }, spot); await g.step(10);
    const inn = await g.eval(() => { const G = window.__G, P = G.P; P.acd = 0; G.tryAttack(); const sw = P.acd > 0; G.useSlot(0); return { in: window.__GTAV.in(), sw, slash: !!P.slash }; });
    assert.deepEqual(inn, { in: true, sw: false, slash: false }, 'no fighting in the tavern');
    // sit; moving stands you up
    await g.eval(() => window.__GTAV.sit()); await g.step(5);
    assert.ok(await g.eval(() => !!window.__GTAV.P), 'sitting');
    await g.eval(() => { window.__G.P.x += 4; }); await g.step(2);
    assert.equal(await g.eval(() => window.__GTAV.P), null, 'up again');
    // the board is for online players
    assert.deepEqual(await g.eval(() => window.__GTAV.opts('inn')), []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
