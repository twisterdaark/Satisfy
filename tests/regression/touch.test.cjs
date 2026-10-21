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
    // owner 2026-10-20: every round button (Attack, the skills in an arc around it, Dodge, Guard, Use, the potions) apart
    // from the others, from the stick, the menu keys and ▦, and on screen
    const B = await g.eval(() => [...document.querySelectorAll('#tAct button, #skillbar button')].filter((e) => e.offsetParent && getComputedStyle(e).display !== 'none')
      .map((e) => { const b = e.getBoundingClientRect(); return { id: e.id || e.dataset.tk || 'sk' + e.dataset.sk, l: b.left, r: b.right, t: b.top, b: b.bottom }; }));
    assert.ok(B.length >= 6, JSON.stringify(B.map((b) => b.id)));
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) assert.ok(apart(B[i], B[j]), `${B[i].id} and ${B[j].id} overlap`);
      for (const k of ['stick', 'keys', 'kt']) assert.ok(apart(B[i], L[k]), `${B[i].id} and ${k} overlap`);
      assert.ok(B[i].l >= L.stage.l && B[i].r <= L.stage.r && B[i].t >= L.stage.t && B[i].b <= L.stage.b + 1, B[i].id + ' on screen');
    }
    for (const [x, y] of [['stick', 'keys'], ['kt', 'keys'], ['kt', 'stick']]) assert.ok(apart(L[x], L[y]), `${x} and ${y} overlap`);
    for (const k of ['stick', 'keys']) assert.ok(L[k].l >= L.stage.l && L[k].r <= L.stage.r && L[k].b <= L.stage.b + 1, k + ' on screen');
    assert.equal(L.kbd, 'none'); assert.equal(L.label, 'block');
    assert.deepEqual(L.hidden, ['none', 'none', 'none', 'none'], 'attack, dodge, guard and use are the big buttons');
    assert.equal(L.rot, 'none');
    await g.page.setViewportSize({ width: 390, height: 844 });
    await g.page.waitForTimeout(100);
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('rotW')).display), 'flex');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

// owner 2026-10-20: play on a phone like the mobile action games: the stick floats under the left thumb and is analog,
// Attack turns to the nearest monster, a tapped skill aims at it too, a dragged skill goes where the finger points (with an
// arrow), dragging back calls it off, and a long press only shows what it does
test('a phone: floating analog stick, Attack and skills aim themselves, a dragged skill aims where you point', async () => {
  const ctx = await H.newContext({ device: { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true } });
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g, LOOK);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.P.x = 90 * 16; G.P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } G.S.cls = 'warrior'; G.S.lv = 40; G.gainXP(1); G.P.mp = 999; });
    await g.step(3);
    const pe = (sel, type, x, y, id = 11) => g.eval(([s, t, x, y, id]) => { const el = typeof s === 'string' ? document.querySelector(s) : document.elementFromPoint(s[0], s[1]);
      el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y })); return el.id; }, [sel, type, x, y, id]);
    // the floating stick: a finger on the world, lower left, brings the stick under it
    const tgt = await pe([300, 250], 'pointerdown', 300, 250);
    assert.equal(tgt, 'game');
    const c = await g.eval(() => { const b = document.getElementById('tStick').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width / 2]; });
    assert.ok(Math.abs(c[0] - 300) < 2 && Math.abs(c[1] - 250) < 2, 'under the finger: ' + c);
    // a small push walks slowly, a full one at full speed
    const walk = async (f) => { const x0 = await g.eval(() => window.__G.P.x); await pe('#tStick', 'pointermove', c[0] + c[2] * f, c[1]); await g.step(30); return (await g.eval(() => window.__G.P.x)) - x0; };
    const slow = await walk(0.3), fast = await walk(1);
    assert.ok(slow > 2 && fast > slow * 1.8, `analog: ${slow} then ${fast}`);
    await pe('#tStick', 'pointerup', c[0] + c[2], c[1]);
    await g.step(2);
    assert.deepEqual(await g.eval(() => { const s = document.getElementById('tStick'); return [s.style.left, s.style.top, s.classList.contains('on')]; }), ['', '', false], 'back home');
    // a monster to the east, the player facing west
    const m = () => g.eval(() => { const G = window.__G, m = G.mons().find((m) => m.type === 'wolf' || m.type === 'rabbit') || G.mons()[0]; m.dead = false; m.hp = m.mhp = 1e9; m.x = G.P.x + 30; m.y = G.P.y; m.spd = 0; G.P.dir = 3; G.P.acd = 0; for (const k in G.P.cd) G.P.cd[k] = 0; return m.type; });
    await m();
    await ptr(g, '#tAct [data-tk="atk"]', 'pointerdown');
    await g.step(1);
    await ptr(g, '#tAct [data-tk="atk"]', 'pointerup');
    const at = await g.eval(() => [window.__G.P.dir, window.__G.P.slash.a]);
    assert.ok(at[0] === 2 && Math.abs(at[1]) < 0.3, 'Attack turned to the monster: ' + at);
    // a tapped skill: goes off on the release, at the monster
    const sk = await g.eval(() => { const b = document.querySelector('#skillbar [data-sk="0"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await g.step(30);
    await m();
    await pe('#skillbar [data-sk="0"]', 'pointerdown', sk[0], sk[1]);
    await g.step(1);
    assert.equal(await g.eval(() => Object.values(window.__G.P.cd).some((c) => c > 0)), false, 'not on the press');
    await pe('#skillbar [data-sk="0"]', 'pointerup', sk[0], sk[1]);
    assert.ok(await g.eval(() => (window.__G.P.cd.strike || 0) > 0), 'on the release');
    assert.ok(Math.abs(await g.eval(() => window.__G.P.slash.a)) < 0.3, 'at the monster');
    // a dragged skill: up and to the left, away from the monster, with the arrow while the finger is down
    await g.step(30);
    await m();
    await pe('#skillbar [data-sk="0"]', 'pointerdown', sk[0], sk[1]);
    await pe('#skillbar [data-sk="0"]', 'pointermove', sk[0] - 60, sk[1] - 60);
    await g.step(3);
    await pe('#skillbar [data-sk="0"]', 'pointerup', sk[0] - 60, sk[1] - 60);
    assert.equal(await g.eval(() => Math.round(window.__G.P.slash.a * 100) / 100), Math.round(Math.atan2(-1, -1) * 100) / 100, 'where the finger pointed');
    // dragged out and back onto the button: called off
    await g.step(30);
    await m();
    await pe('#skillbar [data-sk="0"]', 'pointerdown', sk[0], sk[1]);
    await pe('#skillbar [data-sk="0"]', 'pointermove', sk[0] - 70, sk[1]);
    await pe('#skillbar [data-sk="0"]', 'pointermove', sk[0] - 4, sk[1]);
    assert.equal(await g.eval(() => document.querySelector('#skillbar [data-sk="0"]').classList.contains('cx')), true);
    await pe('#skillbar [data-sk="0"]', 'pointerup', sk[0] - 4, sk[1]);
    assert.equal(await g.eval(() => window.__G.P.cd.strike || 0), 0, 'called off');
    // a long press: shows what it does, does not cast
    await pe('#skillbar [data-sk="0"]', 'pointerdown', sk[0], sk[1]);
    await g.page.waitForTimeout(600);
    assert.equal(await g.eval(() => document.getElementById('tip').classList.contains('on')), true);
    await pe('#skillbar [data-sk="0"]', 'pointerup', sk[0], sk[1]);
    assert.equal(await g.eval(() => window.__G.P.cd.strike || 0), 0, 'only the details');
    // the hint is Use: a tap on it does what E does
    const h = await g.eval(() => { const G = window.__G, n = G.npcs[0]; G.P.x = n.x; G.P.y = n.y + 14; return n.id; });
    await g.step(5);
    if (await g.eval(() => !document.getElementById('hint').hidden)) {
      await ptr(g, '#hint', 'pointerdown');
      await g.step(3);
      assert.equal(await g.mode(), 'dialog', 'talked to ' + h);
    }
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

// owner 2026-10-20: ✥ arranges the phone buttons: drag them where you like, resize them, keep it, or bring the first layout back
test('a phone: ✥ moves and resizes the buttons, nothing else answers meanwhile, and the layout is kept', async () => {
  const phone = { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
  const ctx = await H.newContext({ device: phone });
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g, LOOK);
    await g.step(3);
    const pe = (sel, type, x, y, id = 21) => g.eval(([s, t, x, y, id]) => document.querySelector(s).dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y })), [sel, type, x, y, id]);
    const box = (s) => g.eval((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; }, s);
    const ATK = '#tAct [data-tk="atk"]';
    const t0 = await box('#tLayT');
    await pe('#tLayT', 'pointerdown', t0.x, t0.y); await pe('#tLayT', 'pointerup', t0.x, t0.y);
    assert.equal(await g.eval(() => document.body.classList.contains('tLay') && !document.getElementById('tLayBar').hidden), true, '✥ opens the arranging');
    assert.match(await g.eval(() => document.getElementById('tLayBar').textContent), /Drag any button/);
    // drag Attack to the middle of the screen: it moves and does not swing
    await g.eval(() => { window.__G.P.acd = 0; });
    const a0 = await box(ATK);
    await pe(ATK, 'pointerdown', a0.x, a0.y);
    await pe(ATK, 'pointermove', 422, 200); await pe(ATK, 'pointerup', 422, 200);
    await g.step(2);
    let a1 = await box(ATK);
    assert.ok(Math.abs(a1.x - (a0.x + 422 - a0.x)) < 3 && Math.abs(a1.y - 200) < 3, 'moved: ' + JSON.stringify([a0, a1]));
    assert.equal(await g.eval(() => window.__G.P.acd > 0), false, 'no swing while arranging');
    // bigger twice, smaller once
    for (const l of ['+', '+', '-']) { const b = await box(`#tLayBar [data-l="${l}"]`); await pe(`#tLayBar [data-l="${l}"]`, 'pointerdown', b.x, b.y); }
    await g.page.waitForTimeout(400); // buttons ease into a new size
    a1 = await box(ATK);
    assert.ok(Math.abs(a1.w / a0.w - 1.1) < 0.02, 'resized ' + a1.w / a0.w);
    assert.ok(Math.abs(a1.x - 422) < 3, 'keeps its centre');
    // Done keeps it on this device; Attack works again where it is now
    const d = await box('#tLayBar [data-l="d"]');
    await pe('#tLayBar [data-l="d"]', 'pointerdown', d.x, d.y);
    const saved = await g.eval(() => JSON.parse(localStorage.getItem('satisfy_tlay')));
    assert.ok(saved.atk && Math.abs(saved.atk.s - 1.1) < 0.01, JSON.stringify(saved));
    await ptr(g, ATK, 'pointerdown'); await g.step(2);
    assert.equal(await g.eval(() => window.__G.P.acd > 0), true, 'swings again');
    await ptr(g, ATK, 'pointerup');
    // the next time the game opens on this phone
    const g2 = await H.openGame({ ctx, storage: { satisfy_tlay: JSON.stringify(saved) } });
    await H.newGame(g2, LOOK);
    await g2.step(3);
    const b2 = await g2.eval(() => { const b = document.querySelector('#tAct [data-tk="atk"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    assert.ok(Math.abs(b2[0] - 422) < 3 && Math.abs(b2[1] - 200) < 3, 'kept: ' + b2);
    // Reset: the first layout again
    await g.eval(() => { const lt = document.getElementById('tLayT'), b = lt.getBoundingClientRect(), f = (t, el) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 23, pointerType: 'touch', clientX: b.left + 5, clientY: b.top + 5 })); f('pointerdown', lt); f('pointerup', lt); });
    const r = await box('#tLayBar [data-l="r"]');
    await pe('#tLayBar [data-l="r"]', 'pointerdown', r.x, r.y);
    await g.page.waitForTimeout(400);
    const a2 = await box(ATK);
    assert.ok(Math.abs(a2.x - a0.x) < 2 && Math.abs(a2.y - a0.y) < 2 && Math.abs(a2.w - a0.w) < 1, 'back to the first layout');
    assert.deepEqual(g.errors, []); assert.deepEqual(g2.errors, []);
  } finally { await ctx.close(); }
});

// v1.01: everything a keyboard does, a finger does: the minigames answer as the finger lands and hold while it stays
// down, a tap on the farm plot digs that square, a leave button in the minigames, the forge's reheat button, the log
// key, x1 / x10 / Max in the shops and the sell window, and all stat points at once
test('a phone: forge and alchemy hold under the finger, the farm digs where you tap, the leave button, the log, amounts', async () => {
  const g = await H.openGame({ query: '?touch=1' });
  const at = (type, x, y) => g.eval(([t, x, y]) => { const el = document.getElementById('game'); el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y })); }, [type, x, y]);
  const mid = () => g.eval(() => { const b = document.getElementById('game').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    const [cx, cy] = await mid();
    // the forge's heat stage holds while the finger is down
    await g.eval(() => { const G = window.__G; G.S.mats.ore = 20; G.S.mats.wood = 20; window.__GTC.openForge(); G.startMG('isword'); });
    assert.equal(await g.mode(), 'forge');
    await at('pointerdown', cx, cy);
    assert.equal(await g.eval(() => window.__G.MG.hold), true);
    await at('pointerup', cx, cy);
    assert.equal(await g.eval(() => window.__G.MG.hold), false);
    assert.equal(await g.eval(() => !!document.getElementById('mgReheat')), true);
    await g.eval(() => { window.__G.finishMG()(); });
    await g.eval(() => window.__GTC.closeForge());
    // alchemy heats while held
    await g.eval(() => { const G = window.__G, U = window.__GU; G.S.mats.herb = 9; G.S.mode; U.mixStart('hpot'); });
    await g.step(1);
    assert.equal(await g.mode(), 'mix');
    assert.equal(await g.eval(() => document.getElementById('tQuit').hidden), false, 'the leave button shows');
    await at('pointerdown', cx, cy);
    assert.equal(await g.eval(() => window.__GU.getMIX().h), 1);
    await at('pointerup', cx, cy);
    assert.equal(await g.eval(() => window.__GU.getMIX().h), 0);
    await g.page.click('#tQuit');
    await g.page.waitForTimeout(1600);
    await g.step(2);
    assert.notEqual(await g.mode(), 'mix');
    // the farm: a tap on a square digs that square
    await g.eval(() => { window.__G.DL = null; window.__G.S.mode; window.__GU.farmStart(); });
    await g.step(1);
    assert.equal(await g.mode(), 'farm');
    const xy = await g.eval(() => { const G = window.__G, P = G.P, F = window.__GU.getFARM(), C = 12, x0 = Math.round(P.x - 6 * C / 2), y0 = Math.round(P.y - 40 - 4 * C); const wx = x0 + 3 * C + 6, wy = y0 + 2 * C + 6; return window.__GTC.w2s(wx, wy); });
    await at('pointerdown', xy[0], xy[1]);
    const f = await g.eval(() => { const F = window.__GU.getFARM(); return [F.cx, F.cy, Object.keys(F.dug)]; });
    assert.deepEqual(f.slice(0, 2), [3, 2]);
    assert.ok(f[2].includes('3,2'));
    await g.page.click('#tQuit');
    await g.page.waitForTimeout(1200);
    await g.step(2);
    // the log has a key; the stat points go all at once
    assert.equal(await g.eval(() => !!document.getElementById('kL')), true);
    await g.eval(() => { window.__G.S.pts = 12; window.__GTC.openStatus(); });
    await g.step(1);
    const s0 = await g.eval(() => window.__G.S.st.str);
    await g.page.click('#statusW [data-stat="str"][data-n="all"]');
    assert.deepEqual(await g.eval(() => [window.__G.S.st.str, window.__G.S.pts]), [s0 + 12, 0]);
    await g.eval(() => document.querySelector('[data-act="closeStatus"]').click());
    // a shop: x10 buys ten
    await g.eval(() => { const G = window.__G; G.S.gold = 100000; G.DL = null; G.talkNPC('merchant'); });
    await g.step(2);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); });
    await g.step(1);
    assert.equal(await g.eval(() => !!document.querySelector('#dopts .qrow')), true, 'the amount buttons');
    await ptr(g, '#dopts .qrow [data-bq="10"]', 'pointerdown');
    assert.equal(await g.eval(() => window.__GTC.TBQ), 10);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
