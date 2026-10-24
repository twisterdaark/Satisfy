'use strict';
// SAT-ONLINE-101 (plan U321): the mixer. "Sound" in the pause menu opens four channels, each with its own volume and its own off: game
// sounds, music, the world around you (monsters' voices) and other players. A channel turned off is silent while the others
// play on (individual mute); monsters' voices play on the world channel; the volumes are remembered.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const slide = (g, k, v) => g.eval(([kk, vv]) => { const r = document.getElementById('vol_' + kk); r.value = String(vv); r.dispatchEvent(new Event('input')); }, [k, v]);
const heard = async (g, fn) => { await g.eval(() => { window.__GMIX.played.length = 0; }); await g.eval(fn); return g.eval(() => [...new Set(window.__GMIX.played)].sort()); };

test('mixer: game sounds, music, the world and other players each turn down and off on their own', async () => {
  const ctx = await H.newContext();
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g);
    // Escape, then "Sound": the four channels; Escape goes back to the pause menu, and again to the game
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.mode(), 'pause');
    await g.eval(() => document.querySelector('#pauseScreen [data-act="settings"]').click()); await g.step(2);
    await g.eval(() => document.querySelector('#settingsScreen [data-act="sound"]').click()); await g.step(2);
    assert.equal(await g.mode(), 'sound');
    assert.deepEqual(await g.eval(() => [...document.querySelectorAll('#soundScreen label.vol span')].map((x) => x.textContent)), ['Game sounds', 'Music', 'World sounds', 'Other players']);
    assert.equal(await g.eval(() => document.querySelector('#pauseScreen label.vol')), null, 'the pause menu has one Sound row instead');
    // the menu fits a phone held sideways
    await g.page.setViewportSize({ width: 844, height: 390 });
    await g.step(2);
    assert.ok(await g.eval(() => { const r = document.querySelector('#soundScreen [data-act="sndBack"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'Back in view');
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.mode(), 'pause');
    assert.ok(await g.eval(() => { const b = [...document.querySelectorAll('#pauseScreen .menu > *')]; const a = b[0].getBoundingClientRect(), z = b[b.length - 1].getBoundingClientRect(); return a.top >= 0 && z.bottom <= innerHeight; }), 'the whole pause menu in view');
    assert.equal(await g.eval(() => !document.getElementById('settingsScreen').hidden), true, 'back in Settings');
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.ok(await g.eval(() => { const b = [...document.querySelectorAll('#pauseScreen .menu > *')]; const a = b[0].getBoundingClientRect(), z = b[b.length - 1].getBoundingClientRect(); return a.height > 0 && a.top >= 0 && z.bottom <= innerHeight; }), 'the whole pause menu in view');
    await g.page.setViewportSize({ width: 1280, height: 720 });
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.mode(), 'play');

    // each channel plays on its own
    assert.deepEqual(await heard(g, () => { window.__GMIX.play('sfx'); window.__GMIX.play('amb'); window.__GMIX.play('soc'); }), ['amb', 'sfx', 'soc']);
    // a monster's voice is on the world channel
    assert.ok(await g.eval(() => window.__GMIX.vox()), 'a monster near the start');
    assert.deepEqual(await heard(g, () => window.__GMIX.vox()), ['amb']);

    // the world off: monsters are silent, the rest plays on
    await slide(g, 'amb', 0);
    assert.equal(await g.eval(() => document.getElementById('volv_amb').textContent), 'Off');
    assert.deepEqual(await heard(g, () => { window.__GMIX.vox(); window.__GMIX.play('amb'); window.__GMIX.play('sfx'); window.__GMIX.play('soc'); }), ['sfx', 'soc']);
    // other players off too; game sounds off: only the channels still on
    await slide(g, 'soc', 0);
    assert.deepEqual(await heard(g, () => { window.__GMIX.play('soc'); window.__GMIX.play('sfx'); }), ['sfx']);
    await slide(g, 'amb', 60); await slide(g, 'sfx', 0);
    assert.deepEqual(await heard(g, () => { window.__GMIX.play('sfx'); window.__GMIX.play('soc'); window.__GMIX.vox(); }), ['amb']);
    assert.deepEqual(await g.eval(() => window.__GMIX.v), { sfx: 0, mus: 50, amb: 60, soc: 0 });

    // remembered on this device
    await g.reload();
    assert.deepEqual(await g.eval(() => window.__GMIX.v), { sfx: 0, mus: 50, amb: 60, soc: 0 });
    assert.deepEqual(await g.eval(() => ['sfx', 'amb', 'soc'].map((k) => document.getElementById('vol_' + k).value)), ['0', '60', '0']);
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
