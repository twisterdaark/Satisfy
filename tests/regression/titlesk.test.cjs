'use strict';
// Owner 2026-10-24: titles with a skill sit at the top, and hovering the skill's line shows the skill's details.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('titles: those with a skill first; the skill line carries the skill tooltip', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.tl = Object.assign(S.tl || {}, { pioneer: 1, veteran: 1, chief: 1, krage: 1, forest: 1 }); });
    await g.page.keyboard.press('KeyC'); await g.step(3);
    const r = await g.eval(() => [...document.querySelectorAll('#statusW .tl')].map((e) => ({ sk: !!e.querySelector('em'), tip: !!(e.querySelector('em') || {}).dataset?.tip })));
    const firstPlain = r.findIndex((x) => !x.sk), lastSk = r.map((x) => x.sk).lastIndexOf(true);
    assert.ok(r.length >= 5, 'titles listed: ' + r.length);
    assert.ok(firstPlain === -1 || lastSk < firstPlain, 'skill titles first: ' + JSON.stringify(r));
    assert.ok(r.filter((x) => x.sk).every((x) => x.tip), 'every skill line has a tooltip');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
