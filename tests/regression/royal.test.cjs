'use strict';
// Owner 2026-10-20: Earl Aden's royal tasks vary (levy, hunt, letter, crafting), never the same kind twice running,
// at most 4 a day with a pause between, and the offer does not change by walking away and back.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function opts(g) {
  for (let i = 0; i < 8 && (await g.eval(() => !document.querySelector('#dopts:not([hidden]) button'))); i++) { await g.page.keyboard.press('Space'); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent));
}
async function pick(g, re) {
  const i = (await opts(g)).findIndex((l) => re.test(l));
  assert.ok(i >= 0, 'option ' + re + ' in ' + (await opts(g)).join(' | '));
  await g.eval((i) => document.querySelectorAll('#dopts button')[i].click(), i);
  await g.step(2);
}
async function closeDlg(g) { for (let i = 0; i < 10 && (await g.mode()) === 'dialog'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); } }

test('royal tasks: varied, one kind never twice running, 4 a day, fixed offer', async () => {
  const g = await H.openGame();
  await H.newGame(g);
  await g.eval(() => { const S = window.__G.S; S.lv = 150; S.mats = Object.assign(S.mats || {}, { ore: 99, leather: 99, wood: 99, herb: 99, mith: 99, mstone: 99, bherb: 99, estone: 99, gfish: 99 }); });
  const kinds = [];
  for (let k = 0; k < 4; k++) {
    await g.eval(() => window.__G.talkNPC('aden'));
    const a = await opts(g); await closeDlg(g);
    await g.eval(() => window.__G.talkNPC('aden'));
    const b = await opts(g);
    assert.deepEqual(a, b, 'the same offer after walking away');
    await pick(g, /Royal task \(\d\/4\)/);
    await pick(g, /Accept/);
    await closeDlg(g);
    const q = await g.eval(() => { const S = window.__G.S, id = Object.keys(S.adqa)[0]; return { id, t: S.adqa[id].obj.t, n: S.adqa[id].obj.n, it: S.adqa[id].obj.it }; });
    kinds.push(q.t);
    await g.eval((q) => { const S = window.__G.S; if (q.t !== 'have') S.qs[q.id].c = q.n; }, q);
    await g.eval(() => window.__G.talkNPC('aden'));
    for (let i = 0; i < 8 && (await g.mode()) === 'dialog'; i++) { await g.page.keyboard.press('Space'); await g.step(2); }
    const st = await g.eval((id) => { const S = window.__G.S; return { left: !!S.qs[id], done: S.dly.adq, wait: S.adqT > S.playT }; }, q.id);
    assert.deepEqual(st, { left: false, done: k + 1, wait: true });
    await g.eval(() => { window.__G.S.adqT = 0; });
  }
  for (let i = 1; i < kinds.length; i++) assert.notEqual(kinds[i], kinds[i - 1], 'kinds ' + kinds.join(','));
  await g.eval(() => window.__G.talkNPC('aden'));
  assert.ok((await opts(g)).some((l) => /tasks are done/.test(l)));
  assert.deepEqual(g.errors, []);
  await g.close();
});
