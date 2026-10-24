'use strict';
// U264 Damage accessibility (SAT-ONLINE-167; plan: "contrast mode and color-neutral cues", check: "status readable with low
// saturation"). A setting of this device, next to Reduced motion in Settings (the pause menu).
//   - Settings opens from the pause menu and Esc goes back; High contrast is off unless asked, on from there, and kept;
//   - on: a critical hit's number ends in "!", so a hit, a critical hit, damage taken and a gain read apart without colour;
//   - on: a monster's wind-up has a white outline, the bars over heads a white frame, the HUD's bars a frame.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('high contrast: from Settings, kept; a crit reads "!", wind-ups and bars framed in white', async () => {
  const ctx = await H.newContext();
  try {
    let g = await H.openGame({ ctx });
    await H.newGame(g);
    await g.step(3);
    const kinds = () => g.eval(() => { const C = window.__GHC; const n = (s, b) => String(C.num(s, b)); return { hit: n(1234, false), crit: n(1234, true), taken: n('-45', false), gain: n('+30', false), big: n('+120G', true), word: n('EVADE', true) }; });
    assert.equal(await g.eval(() => window.__GHCM.on()), false, 'off unless asked');
    const off = await kinds();
    assert.equal(off.hit, off.crit, 'off: a hit and a crit differ only in colour and size, as before');

    // the pause menu: Settings, then High contrast; Esc goes back
    await g.page.keyboard.press('Escape'); await g.step(2);
    await g.page.locator('#pauseScreen [data-act="settings"]').click(); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('settingsScreen').hidden), false);
    assert.equal(await g.page.textContent('#hcB'), 'High contrast: Off');
    assert.equal(await g.page.textContent('#rmB'), 'Reduced motion: Off');
    await g.page.click('#hcB'); await g.step(1);
    assert.equal(await g.page.textContent('#hcB'), 'High contrast: On');
    assert.deepEqual(await g.eval(() => [window.__GHCM.on(), localStorage.getItem('satisfy_hc'), document.body.classList.contains('hc')]), [true, '1', true]);
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.mode, document.getElementById('pauseScreen').hidden]), ['pause', false], 'Esc: back to the pause menu');
    await g.page.keyboard.press('Escape'); await g.step(2);

    // every kind reads without its colour
    const on = await kinds();
    assert.deepEqual(on, { hit: '1234', crit: '1234!', taken: '-45', gain: '+30', big: '+120G', word: 'EVADE' });
    assert.equal(new Set([on.hit, on.crit, on.taken, on.gain]).size, 4, 'a hit, a crit, damage taken and a gain all read apart');

    // the HUD's bars have a frame
    assert.equal(await g.eval(() => getComputedStyle(document.querySelector('.bar')).outlineStyle), 'solid');

    // a wind-up: a white outline, 2 px
    const tele = await g.eval(() => {
      const C = window.__GHC, G = window.__G, V = window.__GMV, P = G.P, c = C.ctx;
      const m = G.spawnMon('outlaw', P.x + 30, P.y); m.mv = V.RKMV.outlaw[0]; m.st = 'tele'; m.stT = m.mv.tele / 2;
      const seen = []; const st = c.stroke; c.stroke = function (...a) { seen.push([c.strokeStyle, c.lineWidth]); return st.apply(this, a); };
      try { C.tele(m); } finally { c.stroke = st; }
      return seen;
    });
    assert.ok(tele.length > 0 && tele.every(([s, w]) => /^#ffffff|rgba\(255, 255, 255/.test(s) && w === 2), JSON.stringify(tele));
    assert.deepEqual(g.errors, []);
    await g.close();

    // kept on this device
    g = await H.openGame({ ctx });
    await H.newGame(g);
    assert.equal(await g.eval(() => window.__GHCM.on()), true, 'still on after a reload');
    assert.deepEqual(g.errors, []);
    await g.close();
  } finally { await ctx.close(); }
});
