'use strict';
// Quest details keep opening (owner 2026-10-22: "I opened a quest's details once, and after that no other would open"):
// a quest row opens its details while the details, the bag or the map is up, and a press that let go over the details
// window does not swallow the next click on the panel.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('quest rows open their details again and again, over other windows', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; ['kh1', 'kh2', 'kh3'].forEach((k) => G.acceptQ(k)); });
    await g.step(5);
    const rows = () => g.eval(() => [...document.querySelectorAll('#qtext .qi[data-qd]:not(.ms) b')].map((b) => { const r = b.getBoundingClientRect(); return [r.x + 8, r.y + r.height / 2, b.closest('[data-qd]').dataset.qd]; }));
    const st = () => g.eval(() => [window.__G.mode, document.getElementById('qdW').hidden ? '' : document.getElementById('qdT').textContent]);
    let r = await rows();
    assert.ok(r.length >= 2, 'rows: ' + r.length);
    await g.page.mouse.click(r[0][0], r[0][1]); await g.step(2);
    const a = await st();
    assert.equal(a[0], 'qd');
    // with the details open, another row switches to its quest
    r = await rows();
    await g.page.mouse.click(r[1][0], r[1][1]); await g.step(2);
    const b = await st();
    assert.equal(b[0], 'qd'); assert.notEqual(b[1], a[1], 'the second quest opened');
    await g.page.keyboard.press('Escape'); await g.step(2);
    // the bag is open: the row still opens, and the bag closes
    await g.page.keyboard.press('KeyI'); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'inv');
    r = await rows();
    await g.page.mouse.click(r[0][0], r[0][1]); await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.mode, document.getElementById('inv').hidden]), ['qd', true]);
    await g.page.keyboard.press('Escape'); await g.step(2);
    // the track button right after still works (the earlier press is not swallowing it)
    const tk = await g.eval(() => { const b = document.querySelector('#qtext [data-qtk]:not([disabled])'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, b.dataset.qtk]; });
    if (tk) { const was = await g.eval(() => [window.__G.S.qTrk, !!window.__G.S.qGOff]); await g.page.mouse.click(tk[0], tk[1]); await g.step(2);
      assert.notDeepEqual(await g.eval(() => [window.__G.S.qTrk, !!window.__G.S.qGOff]), was, 'the 📍 press toggled tracking'); }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22: "clicking the quest name makes my character attack": a quest panel moved with its grip lives in the
// HUD and must still take the click instead of letting it through to the game
test('a moved quest panel still opens a quest, and the click does not attack', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; ['kh1', 'kh2'].forEach((k) => G.acceptQ(k)); });
    await g.step(20);
    // drag the panel by its grip
    const q = await g.eval(() => { const r = document.getElementById('quest').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 10]; });
    await g.page.mouse.move(q[0], q[1]); await g.step(20);
    const gp = await g.eval(() => { const e = document.querySelector('#g_quest .gm'); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await g.page.mouse.move(gp[0], gp[1]); await g.page.mouse.down(); await g.page.mouse.move(gp[0] - 250, gp[1] + 120, { steps: 6 }); await g.page.mouse.up();
    await g.step(5);
    assert.equal(await g.eval(() => document.getElementById('quest').parentNode.id), 'hud', 'the panel moved into the HUD');
    const b = await g.eval(() => { const e = document.querySelector('#qtext .qi[data-qd]:not(.ms) b'); const r = e.getBoundingClientRect(); return [r.x + 8, r.y + r.height / 2]; });
    const hit = await g.eval((p) => { const e = document.elementFromPoint(p[0], p[1]); return !!(e && e.closest('#quest')); }, b);
    assert.equal(hit, true, 'the click lands on the panel');
    await g.page.mouse.click(b[0], b[1]); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'qd');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
