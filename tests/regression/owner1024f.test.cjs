'use strict';
// Owner 2026-10-24: the Cloud saves panel showed under the title's buttons; pressing Play darkened the screen with the buttons
// still there; the first world map froze the game about 5 s while it painted (keep it drawn once, without the freeze);
// deleting a cloud character that is also on this device came back with the next automatic sync.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('title panels over the buttons, buttons gone on Play, the map painted between frames and shown whole', async () => {
  const g = await H.openGame();
  try {
    const z = await g.eval(() => { const w = document.getElementById('cloudW'), m = document.querySelector('#titleScreen .menu'); w.hidden = false;
      const r = w.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); w.hidden = true;
      return [w.contains(top), +getComputedStyle(document.getElementById('fade')).zIndex > +getComputedStyle(m).zIndex]; });
    assert.deepEqual(z, [true, true], 'the panel is on top of the buttons, the fade over them');
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.eval(() => window.__G.save(true));
    const st = await g.storage();
    // Continue on the title: the buttons go at once (the screen fades over them)
    const g2 = await H.openGame({ storage: st });
    try {
      const v = await g2.eval(() => { const m = document.querySelector('#titleScreen .menu'), b = document.getElementById('contBtn'), was = getComputedStyle(m).visibility; b.click(); return [was, getComputedStyle(m).visibility]; });
      assert.deepEqual(v, ['visible', 'hidden']);
      assert.deepEqual(g2.errors, []);
    } finally { await g2.close(); }
    // the map: what isn't painted yet doesn't freeze the game; 'drawing the map' shows until it is all there
    const r = await g.eval(() => { const G = window.__G; const t0 = performance.now(); G.openMap(); return { ms: performance.now() - t0, left: G.pj().filter(([k, p]) => p <= 0).length }; });
    assert.ok(r.ms < 400, 'opening the map took ' + Math.round(r.ms) + ' ms');
    for (let i = 0; i < 400 && (await g.eval(() => window.__G.pj().some(([k, p]) => p <= 0))); i++) await g.step(2);
    assert.equal(await g.eval(() => window.__G.pj().some(([k, p]) => p <= 0)), false, 'the map pieces got painted');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
