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
    await g.eval(() => { const b = document.querySelector('#xbar1 [data-xi="0"]'), r = b.getBoundingClientRect(), o = { bubbles: true, button: 0, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); });
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

// owner 2026-10-22: "I can't add a skill, it says take one off first though I added a bar", "dragged from a main slot to
// the second bar it should leave the first", "a thing you drag must not be used by mistake"
test('a full main bar spills onto an extra bar; dragging moves between bars; a press that drags casts nothing', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.cls = 'pagma'; S.pgMur = 1; S.lv = 400; for (const q of Object.keys(window.__G.QD)) S.qs[q] = { st: 2 }; });
    await g.step(5);
    // fill the main bar, then add one more skill from the status window
    await g.page.keyboard.press('KeyC'); await g.step(2);
    const ks = await g.eval(() => [...document.querySelectorAll('#statusW [data-bar]')].map((b) => b.dataset.bar));
    assert.ok(ks.length > 8, 'Pagma has more than 8 skills: ' + ks.length);
    await g.eval((ks) => { window.__G.S.bar = ks.slice(0, 8); }, ks);
    await g.eval(() => { window.__G.S.xbar = null; });
    await g.page.keyboard.press('KeyC'); await g.step(1); await g.page.keyboard.press('KeyC'); await g.step(2);
    await g.eval((k) => document.querySelector('#statusW [data-bar="' + k + '"]').click(), ks[8]);
    assert.equal(await g.eval(() => window.__G.S.xbar[0][0]), ks[8], 'the ninth skill went to the first empty slot of the extra bar');
    // its button now takes it off again
    await g.eval((k) => document.querySelector('#statusW [data-bar="' + k + '"]').click(), ks[8]);
    assert.equal(await g.eval(() => window.__G.S.xbar[0][0]), null);
    await g.page.keyboard.press('KeyC'); await g.step(2);
    // main slot 0 dragged to extra slot 3: it leaves the main bar
    await drag(g, '#skillbar [data-sk="0"]', '#xbar0 [data-xi="3"]');
    let st = await g.eval(() => ({ bar: window.__G.S.bar.slice(0, 2), x: window.__G.S.xbar[0][3] }));
    assert.equal(st.x, ks[0]); assert.equal(st.bar[0], null);
    // and back from the extra bar to main slot 0
    await drag(g, '#xbar0 [data-xi="3"]', '#skillbar [data-sk="0"]');
    st = await g.eval(() => ({ bar: window.__G.S.bar[0], x: window.__G.S.xbar[0][3] }));
    assert.equal(st.bar, ks[0]); assert.equal(st.x, null);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a press on a bar slot that turns into a drag casts nothing; a press let go in place casts', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.cls = 'warrior'; S.lv = 30; });
    await g.step(5);
    // a press that turns into a drag casts nothing; a press let go in place casts
    await g.eval(() => { const G = window.__G; G.P.mp = 9999; G.P.cd = {}; });
    await g.step(3);
    const cdOf = () => g.eval(() => Object.values(window.__G.P.cd).reduce((a, b) => a + b, 0));
    await g.eval(() => { const b = document.querySelector('#skillbar [data-sk="0"]'), r = b.getBoundingClientRect(), o = { bubbles: true, button: 0, clientX: r.x + 5, clientY: r.y + 5 };
      b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })); b.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: r.x + 40 })); });
    assert.equal(await cdOf(), 0, 'the drag cast nothing');
        await g.eval(() => { const b = document.querySelector('#skillbar [data-sk="0"]'), r = b.getBoundingClientRect(), o = { bubbles: true, button: 0, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
      b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); });
    await g.step(1);
    assert.ok(await cdOf() > 0, 'a click cast it');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22: "fix how the bar looks, a resize for every extra bar, something to turn it horizontal or diagonal,
// and siege messages you can move and close"
test('extra bars turn and resize; + and - sit in their own row; an event banner closes until the event ends', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(5);
    const r = await g.eval(() => { const c = document.querySelector('#skillbar .xctl'); return { ctl: !!c, slots: document.querySelectorAll('#skillbar .sk[data-xbadd]').length, row: c && getComputedStyle(c).gridRowStart }; });
    assert.deepEqual(r, { ctl: true, slots: 0, row: '6' });
    const pd = (sel) => g.eval((sel) => document.querySelector(sel).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })), sel);
    await pd('#xbar0 [data-xrot]'); await g.step(1);
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('xbar0')).flexDirection), 'column');
    await pd('#xbar0 [data-xrot]'); await pd('#xbar0 [data-xrot]'); await g.step(1);
    const d = await g.eval(() => { const a = document.querySelector('#xbar0 [data-xi="0"]').getBoundingClientRect(), b = document.querySelector('#xbar0 [data-xi="1"]').getBoundingClientRect(); return [b.x > a.x, b.y > a.y]; });
    assert.deepEqual(d, [true, true], 'diagonal: each slot right of and below the last');
    // the corner makes it bigger
    const w0 = await g.eval(() => document.querySelector('#xbar0 [data-xi="0"]').getBoundingClientRect().width);
    await g.eval(() => { const c = document.querySelector('#xbar0 [data-xrs]'); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
      dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 160 })); dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160 })); });
    await g.step(1);
    const w1 = await g.eval(() => document.querySelector('#xbar0 [data-xi="0"]').getBoundingClientRect().width);
    assert.ok(w1 > w0 * 1.2, w0 + ' -> ' + w1);
    assert.ok(await g.eval(() => JSON.parse(localStorage.getItem('satisfy_xlay'))[0].s > 1), 'saved');
    await pd('#xbar0 [data-xrst]'); await g.step(1);
    assert.equal(await g.eval(() => document.getElementById('xbar0').className), 'sys xbar');
    // a siege banner: its tab has a close button; closed it stays away until the banner goes and comes back
    await g.eval(() => { const b = document.getElementById('sgbar'); b.hidden = false; b.innerHTML = '<b>Siege</b> · 2:00'; });
    await g.step(20);
    assert.equal(await g.eval(() => !!document.querySelector('#g_sgbar .gx')), true);
    await g.eval(() => document.querySelector('#g_sgbar .gx').click());
    await g.step(2);
    assert.equal(await g.eval(() => getComputedStyle(document.getElementById('sgbar')).display), 'none');
    await g.eval(() => { document.getElementById('sgbar').hidden = true; }); await g.step(20);
    await g.eval(() => { document.getElementById('sgbar').hidden = false; }); await g.step(20);
    assert.notEqual(await g.eval(() => getComputedStyle(document.getElementById('sgbar')).display), 'none');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
