'use strict';
// v3.24 (plan U192) Regas's lesson before the Guardian raid: he swings at you with a monster's wind-up; dodge three blows
// (Space), then parry three (the guard raised a moment before); nothing he lands hurts, and it is remembered.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test("Regas's lesson: three dodges, three parries, no harm, remembered", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, P = G.P, n = G.npcs.find((q) => q.id === 'regas'); P.x = n.x; P.y = n.y + 24; G.S.lv = 95;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      window.__GLES.start(); const L = window.__GLES.L; return { on: !!L, hid: !!n.hidden, fig: L && L.m.fig }; });
    assert.deepEqual(r, { on: true, hid: true, fig: 'regas' }, 'Regas steps out to spar');
    // his blows: dodged, they count; landed, they don't hurt
    const d = await g.eval(() => { const G = window.__G, P = G.P, L = window.__GLES.L, hp = G.maxHP(); P.hp = hp;
      const hit = () => window.__GSS2.hurt(500, L.m); P.inv = 0; P.dash = 0; hit(); const hurt = hp - P.hp;
      for (let i = 0; i < 3; i++) { P.inv = 0; P.dash = 0.2; hit(); } P.dash = 0; return { hurt, dg: L.dg, pr: L.pr }; });
    assert.ok(d.hurt <= 1, 'his blows do no harm: ' + d.hurt);
    assert.deepEqual([d.dg, d.pr], [3, 0], 'three dodges');
    // a parry before the dodges counts nothing; after, three end the lesson
    await g.eval(() => { for (let i = 0; i < 3; i++) window.__GLES.hit('pr'); });
    await g.page.waitForTimeout(800); await g.step(5);
    const e = await g.eval(() => ({ L: window.__GLES.L, les: window.__G.S.les, hid: !!window.__G.npcs.find((q) => q.id === 'regas').hidden }));
    assert.deepEqual(e, { L: null, les: 1, hid: false }, 'done, remembered, Regas back in his place');
    const ts = await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((x) => x.textContent).join(' | '));
    assert.match(ts, /Now parry/); assert.match(ts, /The Guardian is slower and heavier than me/);
    // walking off ends it
    await g.eval(() => { window.__GLES.start(); const P = window.__G.P; P.x += 400; });
    await g.step(10);
    assert.equal(await g.eval(() => window.__GLES.L), null, 'walking off ends it');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
