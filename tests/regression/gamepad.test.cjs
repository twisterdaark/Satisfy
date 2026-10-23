'use strict';
// U266 Controller support (SAT-ONLINE-172; plan: "virtual joystick, shortcuts, vibration optional", check: "mouse
// keyboard still works"). A fake standard gamepad stands in for a real one.
//   - the left stick walks (analog), A attacks while held, Y guards while held, B dodges;
//   - Start opens the menu; in the menu the D-pad moves and B goes back;
//   - the right stick opens a window (down: the bag);
//   - a hit taken rumbles the pad, and not with vibration off;
//   - the keyboard still walks after the pad is let go; with no pad nothing changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const PAD = () => {
  const b = () => ({ pressed: false, value: 0 });
  window.__rumble = 0;
  window.__pad = { id: 'Test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, b),
    vibrationActuator: { playEffect: () => { window.__rumble++; return Promise.resolve('complete'); } } };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__pad] });
};
const press = (g, i, on) => g.eval(([i, on]) => { const x = window.__pad.buttons[i]; x.pressed = on; x.value = on ? 1 : 0; }, [i, on]);
const axes = (g, a) => g.eval((a) => { window.__pad.axes = a; }, a);

test('a gamepad plays: walk, attack, guard, dodge, a skill, the menu, a window, the rumble; the keyboard still works', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.P.inv = 0; });
    const x0 = await g.eval(() => window.__G.P.x);
    await g.eval(PAD);
    // the left stick, to the right: you walk right
    await axes(g, [1, 0, 0, 0]); await g.step(30);
    const x1 = await g.eval(() => window.__G.P.x);
    assert.ok(x1 > x0 + 10, 'walked right: ' + x0 + ' -> ' + x1);
    await axes(g, [0, 0, 0, 0]); await g.step(2);
    assert.deepEqual(await g.eval(() => [!!window.__GGP.GP, !!(window.__GGP.GP && window.__GGP.GP.mv)]), [true, false], 'let go: the walk stops');
    // A held: the attack key; let go: no more
    await press(g, 0, true); await g.step(2);
    const atk = await g.eval(() => window.__GGP.GP.atk); await press(g, 0, false); await g.step(2);
    assert.equal(atk, 1);
    assert.equal(await g.eval(() => window.__GGP.GP.atk), 0);
    // Y held: guard
    await press(g, 3, true); await g.step(2);
    assert.equal(await g.eval(() => window.__G.P.guard), 1);
    await press(g, 3, false); await g.step(2);
    assert.equal(await g.eval(() => window.__G.P.guard), 0);
    // B: a dodge (stamina spent)
    await press(g, 1, true); await g.step(1); await press(g, 1, false); await g.step(1);
    assert.ok(await g.eval(() => window.__G.P.dash > 0 || window.__G.P.dcd > 0), 'dodged');
    // a hit taken: a rumble; with vibration off, none
    await g.eval(() => { const G = window.__G; G.P.inv = 0; G.P.dash = 0; });
    await g.step(40);
    const r1 = await g.eval(() => { const m = window.__G.spawnMon('wolf', window.__G.P.x + 8, window.__G.P.y); const r0 = window.__rumble; window.__GGP.hurt(5, m); return window.__rumble - r0; });
    assert.equal(r1, 1, 'a rumble');
    await g.eval(() => { window.__GGP.vib(false); window.__G.P.inv = 0; });
    const r2 = await g.eval(() => { const m = window.__G.spawnMon('wolf', window.__G.P.x + 8, window.__G.P.y); const r0 = window.__rumble; window.__GGP.hurt(5, m); return window.__rumble - r0; });
    assert.equal(r2, 0, 'vibration off');
    assert.equal(await g.eval(() => localStorage.getItem('satisfy_gpvib')), '0');
    // the right stick down: the bag
    await axes(g, [0, 0, 0, 1]); await g.step(3); await axes(g, [0, 0, 0, 0]); await g.step(3);
    assert.equal(await g.eval(() => window.__G.mode), 'inv', 'the bag');
    await g.page.keyboard.press('Escape'); await g.step(3);
    // Start: the menu; the D-pad moves in it; B goes back
    await press(g, 9, true); await g.step(2); await press(g, 9, false); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'pause');
    await press(g, 13, true); await g.step(2); await press(g, 13, false); await g.step(2);
    assert.ok((await g.eval(() => window.__GGP.log())).includes('+ArrowDown'), 'the D-pad sends the arrows in a menu');
    await press(g, 1, true); await g.step(2); await press(g, 1, false); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'play', 'B: back');
    // the keyboard after the pad: still walks
    const k0 = await g.eval(() => window.__G.P.x);
    await g.page.keyboard.down('ArrowLeft'); await g.step(30); await g.page.keyboard.up('ArrowLeft'); await g.step(2);
    assert.ok(await g.eval(() => window.__G.P.x) < k0 - 10, 'the keyboard walks');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('no pad: nothing of it runs', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.step(10);
    assert.equal(await g.eval(() => window.__GGP.GP), null);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
