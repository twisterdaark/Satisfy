'use strict';
// owner 2026-10-23: "let the notifications stay longer, especially when it is something important, I can't keep up reading"
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a notice stays by its length, an important one at least 8 s, one under the pointer stays, a click closes it; the log button', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const box = document.getElementById('toasts'); box.innerHTML = '';
      const T = window.__GTOAST; T('Short'); T('A much longer notice that goes on and on for quite a few words so that it needs time to read'); T('You learned a skill', 'good');
      const els = [...box.children]; return els.map((e) => e._ms); });
    assert.equal(r[0], 4000, 'a short one: 4 s');
    assert.ok(r[1] > 8000 && r[1] <= 12000, 'a long one by its length: ' + r[1]);
    assert.equal(r[2], 8000, 'an important one: 8 s');
    const h = await g.eval(async () => { const box = document.getElementById('toasts'), el = box.children[0]; el.dispatchEvent(new MouseEvent('mouseenter')); el._ms = 1; const keep = !el.classList.contains('out'); box.children[1].click(); await new Promise((res) => setTimeout(res, 50));
      return { keep, closed: box.children[1].classList.contains('out') || box.children.length < 3, log: !document.getElementById('toastLog').hidden }; });
    assert.deepEqual(h, { keep: true, closed: true, log: true });
    // many at once: the important one is not pushed out by plain ones
    const m = await g.eval(() => { const box = document.getElementById('toasts'); box.innerHTML = ''; const T = window.__GTOAST; T('Level up!', 'good'); for (let i = 0; i < 8; i++) T('plain ' + i);
      return [...box.children].filter((e) => !e.classList.contains('out')).map((e) => e.textContent); });
    assert.ok(m.includes('Level up!'), JSON.stringify(m));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
