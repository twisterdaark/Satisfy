'use strict';
// Quest lines never show a key (owner 2026-10-22: Earl Aden said "ad202610222_w"). Every written quest has its offer,
// waiting and done lines (and a letter's line; a hidden class's trial has no giver), in both languages; a generated one (Earl Aden's royal tasks, the board's)
// speaks a shared line with its name and progress instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const SRC = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
function literal(src, i) {
  let depth = 0, q = null, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; }
  }
  return vm.runInNewContext('(' + src.slice(i, j + 1) + ')');
}
function tables(src) {
  const base = literal(src, src.indexOf('{', src.indexOf('const STR={'))), out = { ar: Object.assign({}, base.ar), en: Object.assign({}, base.en) };
  const re = /Object\.assign\(STR\.(ar|en),\{/g; let m;
  while ((m = re.exec(src))) Object.assign(out[m[1]], literal(src, m.index + m[0].length - 1));
  return out;
}

test('every written quest has its lines in both languages', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const qd = await g.eval(() => Object.entries(window.__G.QD).filter(([, q]) => !q.gen).map(([id, q]) => [id, q.by, q.obj && q.obj.t]));
    const T = tables(SRC), miss = [];
    for (const [id, by, ot] of qd) {
      const need = ['_o'];
      if (by !== 'sys') need.push('_d'); // a hidden class's own trial: the system speaks, no one waits
      if (by !== 'sys' && by !== 'board') need.push('_w');
      if (ot === 'deliver') need.push('_dl');
      for (const s of need) for (const L of ['ar', 'en']) if (T[L][id + s] == null) miss.push(L + ':' + id + s);
    }
    assert.deepEqual(miss, []);
  } finally { await g.close(); }
});

test('Earl Aden waits on a royal task in words, with its name and progress', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const pick = (re) => g.eval((src) => { const b = [...document.querySelectorAll('#dopts button')].find((x) => new RegExp(src).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    await g.eval(() => { const S = window.__G.S; S.lv = 120; S.met = S.met || {}; S.met.aden = 1; window.__G.talkNPC('aden'); });
    assert.ok(await pick('Royal task'), 'a royal task is offered');
    assert.ok(await pick('^\\s*\\d*\\.?\\s*Accept'), 'and can be taken');
    await g.eval(() => window.__G.talkNPC('aden'));
    let txt = '';
    for (let i = 0; i < 40 && !/Still waiting on you/.test(txt); i++) { await g.page.waitForTimeout(100); txt = await g.eval(() => document.getElementById('dtext').textContent); }
    assert.match(txt, /Still waiting on you: \S/);
    assert.doesNotMatch(txt, /\b[a-z]+\d{6,}\w*_\w+\b/, 'no key in: ' + txt);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('each quest in the list has its own track button; it picks the quest without opening it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; ['kh1', 'kh2', 'kh3'].forEach((k) => G.acceptQ(k)); });
    await g.step(5);
    const ids = await g.eval(() => [...document.querySelectorAll('#qtext [data-qtk]:not([disabled])')].map((b) => b.dataset.qtk));
    assert.ok(ids.length >= 1, 'track buttons: ' + ids.length);
    const id = ids[ids.length - 1], sel = '#qtext [data-qtk="' + id + '"]';
    const box = await g.eval((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
    await g.page.mouse.click(box[0], box[1]);
    await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.S.qTrk, !!window.__G.S.qGOff, document.getElementById('qdW').hidden]), [id, false, true]);
    assert.ok(await g.eval((s) => document.querySelector(s).classList.contains('on'), sel), 'the tracked one is marked');
    await g.eval((s) => document.querySelector(s).click(), sel);
    assert.equal(await g.eval(() => !!window.__G.S.qGOff), true, 'a second press stops tracking');
    // the row itself still opens the details, with track and abandon
    await g.eval(() => document.querySelector('#qtext .qi[data-qd] b').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    assert.equal(await g.eval(() => !document.getElementById('qdW').hidden && !!document.getElementById('qdCancel')), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('tracking a monster that lives in a cave from the encyclopedia points at the cave, without an error', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    for (const k of ['gshaman', 'gscout', 'kshaman']) { await g.eval((k) => { window.__G.S.mbTrk = k; window.__G.S.qGOff = 0; }, k); await g.step(40); }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
