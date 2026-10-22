'use strict';
// Extra skill bars (owner 2026-10-22: "like Fiesta Online and World of Warcraft: more than one skill bar, used with the
// mouse or with their own keys"): skills dragged from the bar and potions from the bag, Shift+number and Alt+number by
// default, rebindable with a modifier, right-click empties, and a second bar shown from the controls screen.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const drag = (g, from, to) => g.eval(([f, t]) => { const dt = new DataTransfer(), a = document.querySelector(f), b = document.querySelector(t);
  a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  a.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); }, [from, to]);

test('skills and potions on an extra bar, used by Shift+number, emptied by right-click, a second bar from the controls', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.cls = 'warrior'; S.lv = 30; S.hpot = 3; });
    await g.step(5);
    assert.deepEqual(await g.eval(() => [document.getElementById('xbar0').hidden, document.getElementById('xbar1').hidden, document.querySelectorAll('#xbar0 [data-xb]').length]), [false, true, 10]);
    // a skill from the main bar to slot 3 of the extra bar
    const k = await g.eval(() => window.__G.S.bar ? window.__G.S.bar[0] : document.querySelector('#skillbar [data-sk="0"] img') && null);
    await drag(g, '#skillbar [data-sk="0"]', '#xbar0 [data-xi="2"]');
    const sk = await g.eval(() => window.__G.S.xbar[0][2]);
    assert.ok(sk, 'a skill landed on the bar');
    // a health potion from the bag to slot 1
    await g.page.keyboard.press('KeyI');
    await g.eval(() => { const B = window.__G.bag(); const i = B.INVS.findIndex((s) => s.k === 'hpot'); window.__iv = i; });
    await drag(g, '#igrid [data-inv="' + (await g.eval(() => window.__iv)) + '"]', '#xbar0 [data-xi="0"]');
    assert.equal(await g.eval(() => window.__G.S.xbar[0][0]), 'hpot');
    await g.page.keyboard.press('KeyI');
    await g.step(3);
    // Shift+3 casts the bar's skill (not the main bar's 3), Shift+1 drinks
    await g.eval(() => { const G = window.__G; G.P.mp = 9999; G.P.cd = {}; G.P.hp = 5; G.P.pcd = 0; });
    await g.page.keyboard.down('Shift'); await g.page.keyboard.press('Digit3'); await g.page.keyboard.press('Digit1'); await g.page.keyboard.up('Shift');
    await g.step(2);
    const r = await g.eval((sk) => { const G = window.__G; return { cd: G.P.cd[sk] || 0, pots: G.S.hpot, txt: document.querySelector('#xbar0 [data-xi="0"] kbd').textContent }; }, sk);
    assert.ok(r.cd > 0, 'the skill was cast');
    assert.equal(r.pots, 2, 'a potion was drunk');
    assert.equal(r.txt, '⇧1');
    // right-click empties
    await g.eval(() => document.querySelector('#xbar0 [data-xi="2"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    assert.equal(await g.eval(() => window.__G.S.xbar[0][2]), null);
    // the controls: Shift+V on bar 3 slot 1, and two bars shown
    await g.eval(() => window.__G.act('controls'));
    await g.eval(() => document.querySelector('[data-rb="x1_0"]').click());
    await g.page.keyboard.down('Shift'); await g.page.keyboard.press('KeyV'); await g.page.keyboard.up('Shift');
    assert.equal(await g.eval(() => document.querySelector('[data-rb="x1_0"]').textContent), '⇧V');
    await g.eval(() => document.querySelector('[data-xbn]').click());
    await g.eval(() => window.__G.act('back'));
    await g.eval(() => { if (window.__G.mode !== 'play') window.__G.act('resume'); });
    await g.step(3);
    assert.equal(await g.eval(() => document.getElementById('xbar1').hidden), false, 'the second extra bar shows');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22 (twice): "the controls screen is cut off and has no scroll": it fits the screen, its list scrolls and
// the ✕ shows
test('the controls screen fits the screen, scrolls, and has a close button', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => window.__G.act('controls'));
    const r = await g.eval(() => { const c = document.getElementById('controls'), b = c.getBoundingClientRect(), sc = c.querySelector('.cscroll'), x = c.querySelector('.ptitle [data-act="back"]').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, vh: innerHeight, scroll: sc.scrollHeight > sc.clientHeight, over: getComputedStyle(sc).overflowY, xIn: x.top >= 0 && x.bottom <= innerHeight }; });
    assert.ok(r.top >= 0 && r.bottom <= r.vh, JSON.stringify(r));
    assert.equal(r.scroll, true, 'the list is longer than the box and scrolls');
    assert.equal(r.over, 'auto');
    assert.equal(r.xIn, true, 'the close button is on screen');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22: "+ and - on the first bar add and remove bars, and a removed bar comes back with its things; put
// armour and weapons from the bag on them to equip fast, and bread and anything from the bag"
test('+ and - add and take away bars that keep their slots; gear on a bar is put on with a click', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.items.push({ uid: ++S.uid, id: 'isword', slot: 'w', r: 1, dur: 100, atk: 20, spd: .4 }); S.bread = 4; });
    await g.step(5);
    const shown = () => g.eval(() => [0, 1, 2, 3].map((b) => !document.getElementById('xbar' + b).hidden));
    const press = (d) => g.eval((d) => document.querySelector('#skillbar [data-xbadd="' + d + '"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })), d);
    await press(1); await g.step(2);
    assert.deepEqual(await shown(), [true, true, false, false]);
    // the sword and bread from the bag to bar 3
    await g.page.keyboard.press('KeyI');
    const ix = (k) => g.eval((k) => window.__G.bag().INVS.findIndex((s) => s.k === k && !s.eq), k);
    await drag(g, '#igrid [data-inv="' + (await ix('isword')) + '"]', '#xbar1 [data-xi="0"]');
    await drag(g, '#igrid [data-inv="' + (await ix('bread')) + '"]', '#xbar1 [data-xi="1"]');
    await g.page.keyboard.press('KeyI'); await g.step(2);
    const row = await g.eval(() => window.__G.S.xbar[1].slice(0, 2));
    assert.match(row[0], /^g:\d+$/); assert.equal(row[1], 'bread');
    // a click puts the sword on
    await g.eval(() => document.querySelector('#xbar1 [data-xi="0"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    await g.step(2);
    assert.equal(await g.eval(() => document.querySelector('#xbar1 [data-xi="0"]').classList.contains('eq')), true, 'worn');
    // take the bar away and bring it back: same slots
    await press(-1); await g.step(2);
    assert.deepEqual(await shown(), [true, false, false, false]);
    await press(1); await g.step(2);
    assert.deepEqual(await g.eval(() => window.__G.S.xbar[1].slice(0, 2)), row);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
