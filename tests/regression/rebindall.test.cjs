'use strict';
// Every key that can change (owner 2026-10-22): the controls screen lists the actions as well as the skill and item
// slots; a key already in use says what it is used for and the two swap; a moved action answers to its new key only;
// the extra mouse buttons bind like keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const key = (g, code) => g.page.evaluate((c) => { for (const ty of ['keydown', 'keyup']) document.body.dispatchEvent(new KeyboardEvent(ty, { code: c, key: c, bubbles: true, cancelable: true })); }, code);

test('move the bag to O, put a skill on the old key, and a side mouse button on a skill', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => window.__G.act('controls'));
    const rows = await g.eval(() => [...document.querySelectorAll('#rebindL [data-rb]')].map((b) => b.dataset.rb));
    for (const id of ['k0', 'i0', 'aup', 'ainv', 'amap', 'achat']) assert.ok(rows.includes(id), id + ' in ' + rows.join());
    // the bag to O
    await g.eval(() => document.querySelector('[data-rb="ainv"]').click());
    await key(g, 'KeyO');
    await key(g, 'KeyO'); // O is the players list's key: the second press swaps them
    assert.equal(await g.eval(() => document.querySelector('[data-rb="ainv"]').textContent), 'O');
    // skill 1 to U (the equipment's key): told what U was for, and they swap
    await g.eval(() => { window.__toastNew = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__toastNew.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); });
    await g.eval(() => document.querySelector('[data-rb="k0"]').click());
    await key(g, 'KeyU');
    // first press: told what U is for, nothing changes yet; the second press swaps (owner 2026-10-22)
    assert.deepEqual(await g.eval(() => [document.querySelector('[data-rb="k0"]').textContent, document.querySelector('[data-rb="aequip"]').textContent]), ['...', 'U']);
    assert.ok(await g.eval(() => window.__toastNew.some((x) => /U is used for: Equipment\. To swap the two, press U again/.test(x))), JSON.stringify(await g.eval(() => window.__toastNew)));
    await key(g, 'KeyU');
    assert.deepEqual(await g.eval(() => [document.querySelector('[data-rb="k0"]').textContent, document.querySelector('[data-rb="aequip"]').textContent]), ['U', '1']);
        // Escape is fixed: refused, with what it does
    await g.eval(() => document.querySelector('[data-rb="k1"]').click());
    await key(g, 'ArrowUp');
    assert.ok(await g.eval(() => window.__toastNew.some((x) => /used for: Move/.test(x))));
    await key(g, 'Escape');
    // skill 2 on the back side button
    await g.eval(() => document.querySelector('[data-rb="k1"]').click());
    await g.page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 3, bubbles: true })));
    assert.equal(await g.eval(() => document.querySelector('[data-rb="k1"]').textContent), 'M4');
    await g.eval(() => window.__G.act('back'));
    await g.eval(() => { if (window.__G.mode !== 'play') window.__G.act('resume'); });
    // in play: O opens the bag, I does nothing now; 1 opens the equipment
    await key(g, 'KeyI');
    assert.equal(await g.eval(() => document.getElementById('inv').hidden), true, 'I no longer opens the bag');
    await key(g, 'KeyO');
    assert.equal(await g.eval(() => document.getElementById('inv').hidden), false, 'O opens it');
    await key(g, 'KeyO');
    assert.equal(await g.eval(() => document.getElementById('inv').hidden), true, 'and closes it');
    await key(g, 'Digit1');
    assert.equal(await g.eval(() => window.__G.mode), 'equip', 'the equipment moved to 1');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
