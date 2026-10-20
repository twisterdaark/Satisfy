'use strict';
// SAT-ONLINE-017 (doc §29 T38, U002): touch controls. Pointer events on the stick and the buttons drive the
// same input the keyboard does; the key hints become buttons; online gets a party/duel/chat row.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

// pointer helpers: an event at an element's centre plus an offset in its own size (dx, dy in -1..1)
const ptr = (g, sel, type, dx = 0, dy = 0) => g.eval(([s, t, x, y]) => {
  const el = document.querySelector(s), b = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
    clientX: b.left + b.width / 2 + x * b.width / 2, clientY: b.top + b.height / 2 + y * b.height / 2 }));
}, [sel, type, dx, dy]);
const tap = async (g, sel) => { await ptr(g, sel, 'pointerdown'); await g.step(1); await ptr(g, sel, 'pointerup'); await g.step(2); };

test('without a touch screen nothing changes; ?touch=0 wins over a touch screen', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    assert.equal(await g.eval(() => document.getElementById('touch').hidden), true);
    assert.equal(await g.eval(() => document.body.classList.contains('touch')), false);
  } finally { await g.close(); }
  const off = await H.openGame({ query: '?touch=0' });
  try {
    await H.newGame(off, LOOK);
    assert.equal(await off.eval(() => document.getElementById('touch').hidden), true);
  } finally { await off.close(); }
});

test('?touch=1: the stick moves the player, Attack works while held, a key hint taps', async () => {
  const g = await H.openGame({ query: '?touch=1' });
  try {
    assert.equal(await g.eval(() => document.getElementById('touch').hidden), true, 'not on the title screen');
    await H.newGame(g, LOOK);
    await g.step(3);
    assert.equal(await g.eval(() => document.getElementById('touch').hidden), false);
    assert.equal(await g.eval(() => document.getElementById('tNet').hidden), true, 'no online row offline');
    assert.deepEqual(await g.eval(() => [...document.querySelectorAll('#tAct button')].map((b) => b.textContent)), ['Attack', 'Dodge', 'Guard', 'Use']);

    // stick right: moves east; releasing stops
    // open plains west of Winston, nothing around
    await g.eval(() => { const G = window.__G; G.P.x = 90 * 16; G.P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } });
    await g.step(2);
    const x0 = await g.eval(() => window.__G.P.x);
    await ptr(g, '#tStick', 'pointerdown', 0.9, 0);
    await g.step(30);
    const x1 = await g.eval(() => window.__G.P.x);
    assert.ok(x1 > x0 + 10, `moved right ${x0} → ${x1}`);
    await ptr(g, '#tStick', 'pointerup', 0.9, 0);
    await g.step(20);
    const x2 = await g.eval(() => window.__G.P.x);
    await g.step(20);
    assert.equal(await g.eval(() => window.__G.P.x), x2, 'stops when released');
    assert.deepEqual(await g.eval(() => document.getElementById('tKnob').style.transform), '');
    // stick up-left: both directions at once
    await ptr(g, '#tStick', 'pointerdown', -0.8, -0.8);
    const y0 = await g.eval(() => window.__G.P.y);
    await g.step(20);
    const p = await g.eval(() => [window.__G.P.x, window.__G.P.y]);
    assert.ok(p[0] < x2 && p[1] < y0, 'diagonal');
    await ptr(g, '#tStick', 'pointerup');

    // Attack while held
    await g.eval(() => { window.__G.P.acd = 0; });
    await ptr(g, '#tAct [data-tk="atk"]', 'pointerdown');
    await g.step(2);
    assert.ok(await g.eval(() => window.__G.P.acd > 0), 'swung');
    await ptr(g, '#tAct [data-tk="atk"]', 'pointerup');
    await g.step(60);
    assert.equal(await g.eval(() => window.__G.P.acd > 0), false, 'stops swinging when released');

    // owner 2026-10-20: the menu keys stay folded behind ▦; a key hint opens the inventory like I and folds them again
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('keys')).display), 'none', 'keys start folded');
    await tap(g, '#tKeysT');
    assert.notEqual(await g.eval(() => getComputedStyle(document.getElementById('keys')).display), 'none', '▦ opens them');
    await tap(g, '#keys #kI');
    assert.equal(await g.eval(() => document.body.classList.contains('keysOpen')), false, 'a pick folds them');
    assert.equal(await g.eval(() => window.__G.mode), 'inv');
    assert.equal(await g.eval(() => document.getElementById('touch').hidden), true, 'hidden over menus');
    await g.page.keyboard.press('KeyI');
    await g.step(3);
    assert.equal(await g.mode(), 'play');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-20: a finger near the stick (not only on it) steers, and one press on a potion or a skill uses it,
// with a finger or the mouse, even when the pointer moves a little before it lets go
test('a finger near the stick steers; one press on a potion or a skill uses it once (finger and mouse)', async () => {
  const ctx = await H.newContext({ device: { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true } });
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g, LOOK);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.P.x = 90 * 16; G.P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } });
    await g.step(2);
    const x0 = await g.eval(() => window.__G.P.x);
    // just outside the ring, to its right
    const near = await g.eval(() => { const b = document.getElementById('tStick').getBoundingClientRect(), x = b.right + b.width * 0.12, y = b.top + b.height / 2, el = document.elementFromPoint(x, y);
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y })); return { id: el.id, x, y }; });
    assert.equal(near.id, 'tStick', 'the space around the stick belongs to it');
    await g.step(30);
    assert.ok(await g.eval(() => window.__G.P.x) > x0 + 10, 'moved right');
    await g.eval(([x, y]) => document.getElementById('tStick').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y })), [near.x, near.y]);
    await g.step(5);
    assert.equal(await g.eval(() => document.getElementById('tKnob').style.transform), '');
    // a finger on the potion and on a skill: used on the press, once
    await g.eval(() => { const G = window.__G; G.S.cls = 'warrior'; G.S.lv = 20; G.gainXP(1); G.S.hpot = 5; G.P.hp = 10; G.P.mp = 100; });
    await g.step(3);
    const at = (s) => g.eval((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, s);
    const q = await at('#pot_hpot');
    await g.page.touchscreen.tap(q[0], q[1]);
    await g.step(3);
    assert.deepEqual(await g.eval(() => window.__G.S.hpot), 4, 'one potion for one tap');
    assert.ok(await g.eval(() => window.__G.P.hp > 10));
    const r = await at('#skillbar [data-sk="0"]');
    await g.page.touchscreen.tap(r[0], r[1]);
    await g.step(2);
    assert.ok(await g.eval(() => Object.values(window.__G.P.cd).some((c) => c > 0)), 'the skill went off');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
  // the mouse: the press uses it, a small slip before letting go does not lose it, and the click after it adds nothing
  const m = await H.openGame();
  try {
    await H.newGame(m, LOOK);
    await m.step(3);
    await m.eval(() => { const G = window.__G; G.S.hpot = 5; G.P.hp = 10; });
    await m.step(3);
    const q = await m.eval(() => { const b = document.querySelector('#pot_hpot').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await m.page.mouse.move(q[0], q[1]);
    await m.page.mouse.down();
    assert.equal(await m.eval(() => window.__G.S.hpot), 4, 'on the press');
    await m.page.mouse.move(q[0] + 6, q[1] + 3);
    await m.page.mouse.up();
    await m.step(3);
    assert.equal(await m.eval(() => window.__G.S.hpot), 4, 'once');
    assert.deepEqual(m.errors, []);
  } finally { await m.close(); }
});

test('?touch=1 online: the party row opens a card, invites, accepts and opens the chat line', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a&touch=1' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b&touch=1' });
    await H.newGame(a, LOOK);
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    for (let i = 0; i < 8; i++) { await a.step(7); await b.step(7); await a.page.waitForTimeout(30); }
    // owner 2026-10-20: the online row starts folded behind ☰ and opens on a tap
    assert.deepEqual(await a.eval(() => [document.getElementById('tNetT').hidden, document.getElementById('tNet').hidden]), [false, true]);
    await tap(a, '#tNetT'); await tap(b, '#tNetT');
    assert.equal(await a.eval(() => document.getElementById('tNet').hidden), false);
    // SAT-ONLINE-036: the Options tap opens the card of the player next to you
    await tap(a, '#tNet [data-tk="KeyT"]');
    assert.equal(await a.eval(() => document.getElementById('tNet').hidden), true, 'a pick folds the row again');
    assert.equal(await a.eval(() => document.getElementById('pctx').hidden), false, 'Options opened the card');
    assert.equal(await a.eval(() => document.getElementById('pctxT').textContent), 'Faker');
    await a.eval(() => document.querySelector('#pctx [data-act="pcClose"]').click());
    await a.step(2);
    await tap(a, '#tNetT');
    await tap(a, '#tNet [data-tk="KeyP"]');
    for (let i = 0; i < 8; i++) { await a.step(7); await b.step(7); await a.page.waitForTimeout(30); }
    assert.equal(await b.eval(() => document.getElementById('partyInv').hidden), false, 'B got the invite');
    // owner 2026-10-20: yes and no show by themselves only while something waits for an answer
    assert.equal(await a.eval(() => document.getElementById('tAsk').hidden), true, 'nothing waits on A');
    assert.equal(await b.eval(() => document.getElementById('tAsk').hidden), false, 'yes/no wait on B');
    await tap(b, '#tAsk [data-tk="KeyY"]');
    for (let i = 0; i < 12; i++) { await a.step(7); await b.step(7); await a.page.waitForTimeout(30); }
    assert.equal(await b.eval(() => document.getElementById('tAsk').hidden), true, 'answered, yes/no hide again');
    assert.equal((await a.eval(() => Satisfy.local.net().party.members)).length, 2);
    await tap(a, '#tNetT');
    await tap(a, '#tNet [data-tk="Enter"]');
    assert.equal(await a.eval(() => document.activeElement && document.activeElement.id), 'chatIn');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

// owner 2026-10-20 (mobile port): on a phone held sideways the view widens to the screen instead of black bars, the
// controls do not cover each other, the menu keys show their names, and held upright the game asks to be turned
test('a phone sideways: the view fills the screen and the controls stay apart; upright it asks to turn', async () => {
  const phone = { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
  const ctx = await H.newContext({ device: phone });
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g, LOOK);
    await g.step(3);
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('keys')).display), 'none', 'menu keys folded behind ▦');
    await tap(g, '#tKeysT');
    const L = await g.eval(() => {
      const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      return { W: document.getElementById('game').width, stage: r('#stage'), stick: r('#tStick'), act: r('#tAct'), keys: r('#keys'), sk: r('#skillbar'), kt: r('#tKeysT'),
        kbd: getComputedStyle(document.querySelector('#kM kbd')).display, label: getComputedStyle(document.querySelector('#kM span')).display,
        hidden: ['kA', 'kD', 'kG', 'kE'].map((k) => getComputedStyle(document.getElementById(k)).display), rot: getComputedStyle(document.getElementById('rotW')).display };
    });
    assert.ok(L.W > 560, 'wider view: ' + L.W);
    assert.ok(L.stage.r - L.stage.l > 830, 'no black bars');
    const apart = (a, b) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
    for (const [x, y] of [['stick', 'keys'], ['keys', 'sk'], ['sk', 'act'], ['stick', 'act'], ['kt', 'keys'], ['kt', 'stick'], ['kt', 'sk']]) assert.ok(apart(L[x], L[y]), `${x} and ${y} overlap`);
    for (const k of ['stick', 'act', 'keys', 'sk']) assert.ok(L[k].l >= L.stage.l && L[k].r <= L.stage.r && L[k].b <= L.stage.b + 1, k + ' on screen');
    assert.equal(L.kbd, 'none'); assert.equal(L.label, 'block');
    assert.deepEqual(L.hidden, ['none', 'none', 'none', 'none'], 'attack, dodge, guard and use are the big buttons');
    assert.equal(L.rot, 'none');
    await g.page.setViewportSize({ width: 390, height: 844 });
    await g.page.waitForTimeout(100);
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('rotW')).display), 'flex');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
