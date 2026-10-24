'use strict';
// U267 Reduced motion (SAT-ONLINE-164; plan: "disable shake/flash and heavy particles", check: "combat telegraphs still
// discernible"). A setting of this device, in the pause menu.
//   - off by default (here: no system preference), on from the pause menu, kept on this device across a reload;
//   - on: the camera doesn't shake, the white flash doesn't show, and the loose and effect particles are capped (rings kept);
//   - a monster's wind-up draws exactly the same, on or off.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('reduced motion: from the pause menu, kept; no shake, no flash, fewer particles; telegraphs the same', async () => {
  const ctx = await H.newContext();
  try {
    let g = await H.openGame({ ctx });
    await H.newGame(g);
    await g.step(3);
    assert.equal(await g.eval(() => window.__GRMO.on()), false, 'off unless asked');
    // the shake and the flash, off: as before
    const shook = async () => { const sh = []; await g.eval(() => window.__GRMO.setShake(2)); for (let i = 0; i < 6; i++) { await g.step(1); sh.push(await g.eval(() => window.__GRMO.shake())); } return sh.some(([x, y]) => x || y); };
    const flashed = () => g.eval(() => { const f = document.getElementById('flash'); f.classList.remove('on'); window.__GRMO.flash(); return f.classList.contains('on'); });
    const off = { moved: await shook(), flash: await flashed() };
    assert.deepEqual(off, { moved: true, flash: true });

    // the pause menu's button turns it on
    await g.page.keyboard.press('Escape'); await g.step(2);
    await g.page.locator('#pauseScreen [data-act="settings"]').click(); await g.step(1);
    const b = g.page.locator('#rmB');
    assert.equal(await b.textContent(), 'Reduced motion: Off');
    await b.click(); await g.step(1);
    assert.equal(await b.textContent(), 'Reduced motion: On');
    assert.equal(await g.eval(() => window.__GRMO.on()), true);
    assert.equal(await g.eval(() => localStorage.getItem('satisfy_rmo')), '1');
    assert.equal(await g.eval(() => document.body.classList.contains('rmo')), true);
    await g.page.keyboard.press('Escape'); await g.step(2);

    const on = { moved: await shook(), flash: await flashed() };
    await g.eval(() => {
      const R = window.__GRMO, P = window.__G.P;
      // 400 loose particles and 3 rings; 60 bursts from the effect engine
      for (let i = 0; i < 400; i++) R.push({ x: P.x, y: P.y, vx: 0, vy: 0, t: 5, c: '#fff' });
      for (let i = 0; i < 3; i++) R.push({ ring: true, x: P.x, y: P.y, t: 5 });
      for (let i = 0; i < 60; i++) R.vfx('crit', P.x, P.y);
    });
    await g.step(2);
    Object.assign(on, await g.eval(() => { const R = window.__GRMO; return { fx: R.fx(), vx: R.vx(), caps: [R.FX, R.VXC] }; }));
    assert.equal(on.moved, false, 'no camera shake');
    assert.equal(on.flash, false, 'no white flash');
    assert.ok(on.fx <= on.caps[0] + 3, 'loose particles capped, the rings kept: ' + on.fx);
    assert.ok(on.vx <= on.caps[1] + 40, 'effect particles capped: ' + on.vx); // the last burst before the cap may add a few
    assert.deepEqual(g.errors, []);
    await g.close();

    // kept on this device: a reload starts with it on
    g = await H.openGame({ ctx });
    await H.newGame(g);
    assert.equal(await g.eval(() => window.__GRMO.on()), true, 'still on after a reload');
    // a wind-up draws the same, on or off: the same calls on the canvas
    const tele = await g.eval(() => {
      const R = window.__GRMO, G = window.__G, V = window.__GMV, P = G.P;
      const m = G.spawnMon('outlaw', P.x + 30, P.y);
      m.mv = V.RKMV.outlaw[0]; m.st = 'tele'; m.stT = m.mv.tele / 2;
      const count = () => { const c = R.ctx, names = ['fillRect', 'fill', 'stroke', 'arc', 'ellipse', 'lineTo', 'moveTo'], saved = {}; let n = 0;
        for (const k of names) { saved[k] = c[k]; c[k] = function (...a) { n++; return saved[k].apply(this, a); }; }
        try { R.tele(m); } finally { for (const k of names) c[k] = saved[k]; } return n; };
      const a = count(); R.set(false); const b = count(); R.set(true);
      return { a, b };
    });
    assert.ok(tele.a > 0, 'the wind-up draws');
    assert.equal(tele.a, tele.b, 'and the same with reduced motion');
    assert.deepEqual(g.errors, []);
    await g.close();
  } finally { await ctx.close(); }
});
