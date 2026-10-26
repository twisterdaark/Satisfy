'use strict';
// Owner reports, 2026-10-26: "Drawing the map... 9%" for minutes; opening the chat left the page shifted until a refresh;
// "make sure the vampires hit you, they just watch you now".
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the vampire cities are no town: their beasts come for you', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.lv = 300; const m = G.mons().find((x) => x.type === 'vthrall' && !x.dead);
      P.x = m.x + 40; P.y = m.y; P.hp = G.maxHP(); window.__m = m; window.__hp = P.hp; return { z: G.zoneAt(m.x, m.y) }; });
    assert.match(r.z, /^zVc/);
    await g.step(240);
    const o = await g.eval(() => ({ eng: window.__m.eng > 0, hurt: window.__G.P.hp < window.__hp }));
    assert.deepEqual(o, { eng: true, hurt: true });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the world map waits only for what it shows, and paints it first', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.page.keyboard.press('KeyM'); await g.step(2);
    await g.eval(() => { const G = window.__G; G.MV.z = 1; G.mapDraw(); });
    let ld = true; for (let i = 0; i < 400 && ld; i++) { await g.page.waitForTimeout(50); await g.step(1); ld = await g.eval(() => window.__GML.ld()); }
    const r = await g.eval(() => ({ ld: window.__GML.ld(), left: window.__GML.q(), need: window.__GML.v().n }));
    assert.equal(r.ld, false, 'the map is up');
    assert.ok(r.need > 0 && r.left > 0, 'the other continent is still to come: ' + JSON.stringify(r));
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a field that lets go puts the page back where it was', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(async () => { const i = document.getElementById('chatIn'), st = document.getElementById('stage'), ui = document.getElementById('ui'); i.hidden = false; document.getElementById('chatW').hidden = false;
      i.focus({ preventScroll: true }); st.scrollLeft = 30; st.scrollTop = 20; const was = [st.scrollLeft, st.scrollTop]; /* #stage: the box the browser shifts (overflow hidden) */ i.blur(); await new Promise((res) => setTimeout(res, 300));
      return { was, now: [ui.scrollLeft, ui.scrollTop, st.scrollLeft, st.scrollTop, scrollX, scrollY] }; });
    assert.ok(r.was[0] > 0 && r.was[1] > 0, 'the stage was shifted: ' + JSON.stringify(r));
    assert.deepEqual(r.now, [0, 0, 0, 0, 0, 0], JSON.stringify(r));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
