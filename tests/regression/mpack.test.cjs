'use strict';
// Owner 2026-10-21, patch 1 of the third batch: the monster pack (plan U114, U115, U120, U139, U141, U142) and the bag
// tabs, quest filters and photo mode with its free camera (U255, U208, U303).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
// one monster of a kind next to the player, everything else around it gone
const only = (g, ty, dx, dy) => g.eval(([ty, dx, dy]) => {
  const G = window.__G, P = G.P, m = G.mons().find((o) => o.type === ty && !o.dead);
  P.inv = 1e9; P.hp = 1e9;
  m.x = m.sx = P.x + dx; m.y = m.sy = P.y + dy; m.hp = m.max; m.tmp = 0;
  for (const o of G.mons()) if (o !== m && Math.hypot(o.x - P.x, o.y - P.y) < 250) { o.dead = true; o.rt = 1e9; }
  return G.mons().indexOf(m);
}, [ty, dx, dy]);

test('the new monsters live where they should and have names', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, z = {};
      for (const k of ['hrabbit', 'grabbit', 'slime', 'cbat', 'sscorp', 'mimic', 'gobsc']) { const m = G.mons().find((o) => o.type === k); z[k] = m ? G.zoneAt(m.sx, m.sy) : null; }
      return z;
    });
    for (const k in r) assert.ok(r[k], k + ' spawns');
  } finally { await g.close(); }
});

test('a slime splits in two when it dies; a golden rabbit runs; a mimic waits until you come close', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const i = await only(g, 'slime', 14, 0);
    await g.eval((i) => { const m = window.__G.mons()[i]; m.hp = 1; window.__GC2.hit(m); }, i);
    await g.step(5);
    assert.equal(await g.eval((i) => window.__G.mons()[i].dead, i), true, 'the slime died');
    assert.equal(await g.eval(() => window.__G.mons().filter((o) => o.type === 'mslime' && !o.dead && Math.hypot(o.x - window.__G.P.x, o.y - window.__G.P.y) < 80).length), 2);

    const r = await only(g, 'grabbit', 60, 0);
    await g.step(5);
    assert.ok(await g.eval((r) => window.__G.mons()[r].flee > 0, r), 'the golden rabbit runs from you');

    const m = await only(g, 'mimic', 120, 0);
    await g.step(60);
    assert.deepEqual(await g.eval((m) => { const o = window.__G.mons()[m]; return [o.dorm, o.x === o.sx, o.y === o.sy]; }, m), [1, true, true], 'a mimic far away is a chest');
    await g.eval((m) => { const G = window.__G, o = G.mons()[m]; G.P.x = o.x - 20; G.P.y = o.y; }, m);
    await g.step(10);
    assert.equal(await g.eval((m) => window.__G.mons()[m].dorm, m), 0, 'close by it wakes');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a goblin scout that sees you blows its horn and the camp comes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, s = G.mons().find((o) => o.type === 'gobsc' && !o.dead), near = G.mons().filter((o) => o.type === 'goblin' && !o.dead && Math.hypot(o.x - s.x, o.y - s.y) < 240);
      near.forEach((o) => { o.agg = 0; o.eng = 0; });
      s.agg = 1; window.__GMP.tick(0.016);
      return [s.horn, near.length, near.filter((o) => o.agg).length];
    });
    assert.equal(r[0], 1);
    assert.ok(r[1] > 0, 'goblins near the scout');
    assert.equal(r[2], r[1], 'every goblin in earshot comes');
  } finally { await g.close(); }
});

test('bag tabs, quest filters and photo mode', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.page.keyboard.press('KeyI'); await g.step(3);
    const all = await g.eval(() => window.__G.bag().INVS.length);
    for (const k of ['gear', 'mat', 'use']) {
      const r = await g.eval((k) => { window.__GUX.tab(k); const I = window.__G.bag().INVS; return [I.length, I.every((s) => window.__GUX.bagCat(s) === k), document.querySelector('#invTabs .on') && document.querySelector('#invTabs .on').dataset.btab]; }, k);
      assert.ok(r[0] <= all && r[1], k);
      assert.equal(r[2], k);
    }
    await g.eval(() => window.__GUX.tab('all'));
    await g.page.keyboard.press('Escape'); await g.step(3);

    assert.equal(await g.eval(() => window.__GUX.qCat('gj1')), 'ms');
    // a side quest next to the story one: two kinds, so the chips show
    const side = await g.eval(() => { const G = window.__G, id = Object.keys(G.QD).find((k) => window.__GUX.qCat(k) === 'side' && !G.QD[k].pre && !G.QD[k].cls); G.acceptQ(id); if (!G.S.qs.gj1) G.acceptQ('gj1'); return id; });
    assert.ok(side);
    await g.eval(() => window.__GUX.qf('ms')); await g.step(3);
    assert.ok(await g.eval(() => !!document.querySelector('#qtext [data-qf="ms"].on')), 'the filter chips show');

    await g.page.keyboard.press('F8'); await g.step(3);
    assert.equal(await g.eval(() => [window.__GUX.photo, document.body.classList.contains('photo'), getComputedStyle(document.querySelector('#photoBar button')).visibility].join()), 'true,true,visible');
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('skillbar')).visibility), 'hidden', 'the HUD hides');
    assert.match(await g.eval(() => window.__GUX.shot()), /^data:image\/png;base64,/);
    // U303: the arrows move the camera away from you, you stand still; C brings it back
    const x0 = await g.eval(() => window.__G.P.x);
    await g.page.keyboard.down('ArrowRight'); await g.step(30); await g.page.keyboard.up('ArrowRight'); await g.step(2);
    const cam = await g.eval(() => [window.__GUX.phc.x, window.__G.P.x]);
    assert.ok(cam[0] > 20, 'the camera moved: ' + cam[0]); assert.equal(cam[1], x0, 'and you did not');
    await g.page.keyboard.press('KeyC'); await g.step(2);
    assert.deepEqual(await g.eval(() => window.__GUX.phc), { x: 0, y: 0 }, 'C brings the camera back');
    // (review) nor a dodge: Space with an arrow held moves nothing
    await g.page.keyboard.down('ArrowRight'); await g.page.keyboard.press('Space'); await g.step(20); await g.page.keyboard.up('ArrowRight'); await g.step(2);
    assert.equal(await g.eval(() => window.__G.P.x), x0, 'no dodge in photo mode');
    await g.page.keyboard.press('Escape'); await g.step(3);
    assert.equal(await g.eval(() => window.__GUX.photo), false);
    assert.equal(await g.eval(() => window.__G.mode), 'play', 'Esc leaves photo mode, not the game');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
