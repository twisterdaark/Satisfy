'use strict';
// The status window's Specializations page (v3.01; the player Suki through the owner 2026-10-25: "Add specialization
// descriptions, display what each one does when you press C"): every specialization, what it does, who teaches it and
// where, yours marked; the cost of changing; a Blacksmith takes none.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('C: every specialization with what it does and its trainer, yours marked', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(5);
    await g.eval(() => { window.__G.S.sec = 'fisher'; });
    await g.page.keyboard.press('KeyC'); await g.step(3);
    const tip = await g.eval(() => [...document.querySelectorAll('#sbody .srow')].map((e) => e.dataset.tip || '').find((s) => s.includes('Rare fish bite')) || '');
    await g.eval(() => document.querySelector('[data-stab="sec"]').click()); await g.step(2);
    const r = await g.eval(() => { const L = window.__G.lines().en, b = document.getElementById('sbody'), rows = [...b.querySelectorAll('.tl')];
      return { n: rows.length, keys: window.__GSEC.keys().length, text: b.innerText, mine: rows.filter((e) => e.classList.contains('worn')).map((e) => e.querySelector('b').textContent) }; });
    assert.ok(tip.length > 0, 'the status row says what yours does');
    assert.ok(r.n >= r.keys + 6, 'every specialization: ' + r.n);
    for (const s of ['Blacksmith', 'Tailor', 'Fisherman', 'Monster Discerner', 'Rare fish bite 50% more often.', 'Taught by Lake Fisherman', 'changing it costs 2,000 gold']) assert.ok(r.text.includes(s), s);
    assert.deepEqual(r.mine, ['Fisherman · yours']);
    await g.eval(() => { window.__G.S.cls = 'smith'; window.__G.S.sec = null; document.querySelector('[data-stab="sec"]').click(); }); await g.step(2);
    assert.match(await g.eval(() => document.getElementById('sbody').innerText), /A Blacksmith takes no specialization/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
